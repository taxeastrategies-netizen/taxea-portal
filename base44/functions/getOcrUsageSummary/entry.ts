import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Returns the current quarter key for Atlantic/Canary timezone
function getCurrentQuarterKey() {
  const now = new Date();
  // Atlantic/Canary is UTC+0 or UTC+1 in summer. Use UTC as safe approximation.
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

function getQuarterBounds(quarterKey) {
  const [year, q] = quarterKey.split('-Q').map(Number);
  const startMonth = (q - 1) * 3; // 0-indexed
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59));
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const quarterKey = body.quarterKey || getCurrentQuarterKey();
    const bounds = getQuarterBounds(quarterKey);

    // Find billing account — try by userId first, then by company_id
    let billingAccountId = null;
    let planCode = null;
    let ocrAccessStatus = 'blocked';

    // Check subscription for this user
    const subs = await base44.entities.Subscription.filter({ userId: user.id });
    const sub = subs?.[0];
    if (sub) {
      planCode = sub.planCode;
    }

    // Look up quota period
    let periods = [];
    // We need to find by userId-based billingAccountId
    // BillingAccount is the ClientAccount entity — search by user email or company
    const clientAccounts = await base44.asServiceRole.entities.ClientAccount.filter({ email: user.email });
    const clientAccount = clientAccounts?.[0];
    if (clientAccount) {
      billingAccountId = clientAccount.id;
      ocrAccessStatus = clientAccount.ocrAccessStatus || 'allowed';
      periods = await base44.asServiceRole.entities.OcrQuotaPeriod.filter({ billingAccountId, quarterKey });
    }

    // Get plan catalog entry
    let planInfo = null;
    if (planCode) {
      const plans = await base44.asServiceRole.entities.PlanCatalog.filter({ planCode });
      planInfo = plans?.[0] || null;
    }

    if (!periods.length && billingAccountId && planInfo) {
      // Auto-create period for this quarter
      const limit = planInfo.isUnlimited ? null : (planInfo.quarterlyOcrLimit || 0);
      const newPeriod = await base44.asServiceRole.entities.OcrQuotaPeriod.create({
        billingAccountId,
        quarterKey,
        periodStart: bounds.start,
        periodEnd: bounds.end,
        planCodeAtStart: planCode,
        currentPlanCode: planCode,
        baseLimit: limit ?? 0,
        currentPlanLimit: limit ?? 0,
        manualCredits: 0,
        consumedCredits: 0,
        reservedCredits: 0,
        isUnlimited: planInfo.isUnlimited || false,
        status: planInfo.isUnlimited ? 'unlimited' : 'available',
      });
      periods = [newPeriod];
    }

    const period = periods?.[0] || null;

    let available = 0;
    let pct = 0;
    let status = 'available';

    if (period) {
      if (period.isUnlimited) {
        available = null;
        status = 'unlimited';
      } else {
        const limit = period.currentPlanLimit + period.manualCredits;
        available = Math.max(0, limit - period.consumedCredits - period.reservedCredits);
        pct = limit > 0 ? Math.round((period.consumedCredits / limit) * 100) : 100;
        status = period.status;
      }
    }

    const nextQuarterDate = bounds.end;

    return Response.json({
      quarterKey,
      billingAccountId,
      planCode,
      planInfo,
      period,
      available,
      pct,
      status,
      ocrAccessStatus,
      nextResetDate: nextQuarterDate,
      blocked: ocrAccessStatus === 'blocked' || (!period?.isUnlimited && available === 0 && period !== null),
    });
  } catch (error) {
    console.error('Error en getOcrUsageSummary:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
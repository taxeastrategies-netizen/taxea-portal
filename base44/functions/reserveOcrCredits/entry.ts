import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function getCurrentQuarterKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

function getQuarterBounds(quarterKey) {
  const [year, q] = quarterKey.split('-Q').map(Number);
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59));
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json();
    const { documentId, batchId, documentType, sourceModule, credits = 1, idempotencyKey } = body;

    if (!idempotencyKey) return Response.json({ error: 'idempotencyKey requerido' }, { status: 400 });
    if (!documentType) return Response.json({ error: 'documentType requerido' }, { status: 400 });

    // Idempotency check
    const existingReservations = await base44.asServiceRole.entities.OcrCreditReservation.filter({ idempotencyKey });
    if (existingReservations.length > 0) {
      const existing = existingReservations[0];
      if (existing.status === 'reserved' || existing.status === 'consumed') {
        return Response.json({ reservationId: existing.id, status: existing.status, idempotent: true });
      }
    }

    // Find billing account
    const clientAccounts = await base44.asServiceRole.entities.ClientAccount.filter({ email: user.email });
    const clientAccount = clientAccounts?.[0];
    if (!clientAccount) return Response.json({ error: 'Cuenta de facturación no encontrada' }, { status: 404 });

    const billingAccountId = clientAccount.id;
    const ocrAccessStatus = clientAccount.ocrAccessStatus || 'allowed';
    if (ocrAccessStatus === 'blocked') {
      return Response.json({ error: 'El acceso OCR está bloqueado para esta cuenta', blocked: true }, { status: 403 });
    }

    // Get subscription and plan
    const subs = await base44.entities.Subscription.filter({ userId: user.id });
    const sub = subs?.[0];
    if (!sub || !['activa'].includes(sub.status)) {
      return Response.json({ error: 'Suscripción no activa', blocked: true }, { status: 403 });
    }

    const planCode = sub.planCode;
    const plans = await base44.asServiceRole.entities.PlanCatalog.filter({ planCode });
    const planInfo = plans?.[0];
    if (!planInfo) return Response.json({ error: 'Plan no encontrado' }, { status: 404 });

    // Platform plan has no OCR
    if (planInfo.clientType === 'platform') {
      return Response.json({ error: 'Tu plan actual no incluye procesamiento OCR de facturas.', blocked: true }, { status: 403 });
    }

    const quarterKey = getCurrentQuarterKey();
    const bounds = getQuarterBounds(quarterKey);

    // Get or create quota period
    let periods = await base44.asServiceRole.entities.OcrQuotaPeriod.filter({ billingAccountId, quarterKey });
    let period = periods?.[0];

    if (!period) {
      const limit = planInfo.isUnlimited ? null : (planInfo.quarterlyOcrLimit || 0);
      period = await base44.asServiceRole.entities.OcrQuotaPeriod.create({
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
    }

    // Check if unlimited
    if (!period.isUnlimited) {
      const totalLimit = period.currentPlanLimit + period.manualCredits;
      const available = totalLimit - period.consumedCredits - period.reservedCredits;
      if (available < credits) {
        // Update status to exhausted
        await base44.asServiceRole.entities.OcrQuotaPeriod.update(period.id, { status: 'exhausted' });
        return Response.json({
          error: `Has utilizado las ${period.currentPlanLimit} facturas incluidas en tu plan para este trimestre.`,
          blocked: true,
          consumed: period.consumedCredits,
          limit: totalLimit,
          available: Math.max(0, available),
        }, { status: 403 });
      }
    }

    // Create reservation
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
    const reservation = await base44.asServiceRole.entities.OcrCreditReservation.create({
      billingAccountId,
      quotaPeriodId: period.id,
      documentId: documentId || null,
      batchId: batchId || null,
      idempotencyKey,
      creditsReserved: credits,
      status: 'reserved',
      reservedAt: new Date().toISOString(),
      expiresAt,
    });

    // Increment reserved count
    await base44.asServiceRole.entities.OcrQuotaPeriod.update(period.id, {
      reservedCredits: (period.reservedCredits || 0) + credits,
    });

    // Create usage event
    await base44.asServiceRole.entities.OcrUsageEvent.create({
      billingAccountId,
      quotaPeriodId: period.id,
      userId: user.id,
      documentId: documentId || null,
      documentType,
      sourceModule: sourceModule || 'unknown',
      idempotencyKey,
      credits,
      status: 'pending',
    });

    console.log(`Reserva OCR creada: ${reservation.id}, usuario ${user.id}, créditos: ${credits}`);
    return Response.json({ reservationId: reservation.id, quotaPeriodId: period.id, status: 'reserved' });
  } catch (error) {
    console.error('Error en reserveOcrCredits:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
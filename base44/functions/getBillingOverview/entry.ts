import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");

function getCanaryMonthBounds() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Atlantic/Canary',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const monthStart = new Date(`${y}-${m}-01T00:00:00Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  return { monthStart, monthEnd };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      return Response.json({ error: 'No autorizado' }, { status: 403 });
    }

    const [clients, subscriptions, payments] = await Promise.all([
      base44.asServiceRole.entities.ClientAccount.list('-created_date', 500),
      base44.asServiceRole.entities.Subscription.list('-created_date', 500),
      base44.asServiceRole.entities.PaymentRecord.list('-created_date', 500),
    ]);

    // Build lookup maps
    const subByUserId = {};
    for (const sub of subscriptions || []) {
      if (sub.userId) {
        if (!subByUserId[sub.userId]) subByUserId[sub.userId] = [];
        subByUserId[sub.userId].push(sub);
      }
    }
    const paymentsByUserId = {};
    for (const p of payments || []) {
      if (p.userId) {
        if (!paymentsByUserId[p.userId]) paymentsByUserId[p.userId] = [];
        paymentsByUserId[p.userId].push(p);
      }
    }

    const stripeConfigured = !!STRIPE_SECRET;
    const isTestMode = STRIPE_SECRET?.startsWith('sk_test_');
    let stripeSummary = { configured: stripeConfigured, isTestMode };
    let stripeCustomers = [];

    if (stripeConfigured) {
      try {
        const stripe = new Stripe(STRIPE_SECRET);
        const [balance, payouts, balanceTxns, customers] = await Promise.all([
          stripe.balance.retrieve(),
          stripe.payouts.list({ limit: 20 }),
          stripe.balanceTransactions.list({ limit: 100 }),
          stripe.customers.list({ limit: 100 }),
        ]);

        stripeCustomers = customers.data || [];

        let gross = 0, refunds = 0, disputes = 0, fees = 0, net = 0;
        for (const tx of balanceTxns.data || []) {
          const amt = tx.amount || 0;
          if (tx.type === 'charge') gross += amt;
          else if (tx.type === 'refund') refunds += amt;
          else if (tx.type === 'dispute') disputes += amt;
          fees += tx.fee || 0;
          net += tx.net || 0;
        }

        let payoutsPaid = 0, payoutsFailed = 0;
        for (const p of payouts.data || []) {
          if (p.status === 'paid') payoutsPaid += p.amount;
          if (p.status === 'failed') payoutsFailed++;
        }

        const availableBalance = (balance.available || []).reduce((s, b) => s + (b.amount || 0), 0);
        const pendingBalance = (balance.pending || []).reduce((s, b) => s + (b.amount || 0), 0);

        stripeSummary = {
          configured: true,
          isTestMode,
          grossCharged: gross / 100,
          refunds: Math.abs(refunds) / 100,
          disputes: Math.abs(disputes) / 100,
          fees: fees / 100,
          net: net / 100,
          availableBalance: availableBalance / 100,
          pendingBalance: pendingBalance / 100,
          payoutsPaid: payoutsPaid / 100,
          payoutsFailed,
          customersCount: stripeCustomers.length,
          recentPayouts: (payouts.data || []).map(p => ({
            id: p.id,
            amount: p.amount / 100,
            currency: p.currency?.toUpperCase(),
            status: p.status,
            arrivalDate: p.arrival_date ? new Date(p.arrival_date * 1000).toISOString() : null,
          })),
        };
      } catch (stripeErr) {
        console.error('[getBillingOverview] Stripe error:', stripeErr.message);
        stripeSummary = { configured: true, isTestMode, error: stripeErr.message };
      }
    }

    // Compute KPIs (Atlantic/Canary timezone)
    const { monthStart, monthEnd } = getCanaryMonthBounds();
    const activeClients = (clients || []).filter(c =>
      c.accessStatus === 'activa' && c.monthlyFee > 0
    );
    const alDia = activeClients.filter(c =>
      c.billingStatus === 'al_dia' || (!c.billingStatus && c.paymentStatus === 'al_dia')
    );
    const enProceso = activeClients.filter(c =>
      c.billingStatus === 'en_proceso' || c.billingStatus === 'pendiente_vincular'
    );
    const pagoFallido = activeClients.filter(c => c.billingStatus === 'pago_fallido');
    const nuevosEsteMes = (clients || []).filter(c => {
      if (!c.created_date) return false;
      const cd = new Date(c.created_date);
      return cd >= monthStart && cd < monthEnd;
    });

    const mrr = activeClients.reduce((s, c) => s + (c.monthlyFee || c.contractAmount || 0), 0);
    const kpis = {
      totalActivos: activeClients.length,
      totalActivosMrr: mrr,
      alDia: alDia.length,
      alDiaPorcentaje: activeClients.length > 0 ? Math.round((alDia.length / activeClients.length) * 100) : 0,
      alDiaMrr: alDia.reduce((s, c) => s + (c.monthlyFee || c.contractAmount || 0), 0),
      enProceso: enProceso.length,
      pagoFallido: pagoFallido.length,
      pagoFallidoImporte: pagoFallido.reduce((s, c) => s + (c.monthlyFee || c.contractAmount || 0), 0),
      nuevosEsteMes: nuevosEsteMes.length,
    };

    // Augment clients with subscription + payment data
    let augmentedClients = (clients || []).map(c => {
      const subs = subByUserId[c.id] || subByUserId[c.userId] || [];
      const activeSub = subs.find(s => ['activa', 'paid_pending_activation', 'past_due', 'processing'].includes(s.status)) || subs[0];
      const userPayments = paymentsByUserId[c.id] || paymentsByUserId[c.userId] || [];
      const lastPayment = userPayments.filter(p => p.status === 'paid')
        .sort((a, b) => new Date(b.paidAt || b.created_date) - new Date(a.paidAt || a.created_date))[0];
      const overdueAmount = userPayments
        .filter(p => p.status === 'failed' || p.status === 'pending')
        .reduce((s, p) => s + (p.amount || 0), 0);

      return {
        ...c,
        subscription: activeSub ? {
          planCode: activeSub.planCode, planName: activeSub.planName,
          status: activeSub.status, stripeSubscriptionId: activeSub.stripeSubscriptionId,
          stripePriceId: activeSub.stripePriceId, amount: activeSub.amount,
          interval: activeSub.interval, currentPeriodEnd: activeSub.currentPeriodEnd,
          nextRenewalAt: activeSub.nextRenewalAt, cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd,
          paymentMethodType: activeSub.paymentMethodType, paymentMethodLast4: activeSub.paymentMethodLast4,
          paymentMethodBrand: activeSub.paymentMethodBrand,
        } : null,
        lastPayment: lastPayment ? { amount: lastPayment.amount, paidAt: lastPayment.paidAt, status: lastPayment.status } : null,
        overdueAmount, subscriptionCount: subs.length,
      };
    });

    // Data quality issues
    const issues = [];
    const emailMap = {};
    for (const c of clients || []) {
      if (c.email) {
        const key = c.email.toLowerCase().trim();
        if (!emailMap[key]) emailMap[key] = [];
        emailMap[key].push(c);
      }
    }
    for (const [email, cs] of Object.entries(emailMap)) {
      if (cs.length > 1) issues.push({ type: 'duplicate_email', severity: 'alta', clientName: cs[0].displayName || cs[0].legalName, explanation: `Email duplicado (${cs.length} clientes): ${email}` });
    }
    for (const c of clients || []) {
      if (!c.taxId && c.accessStatus === 'activa') issues.push({ type: 'missing_tax_id', severity: 'media', clientName: c.displayName || c.legalName, explanation: 'Cliente activo sin NIF/CIF' });
      if (c.accessStatus === 'activa' && c.monthlyFee === 0) issues.push({ type: 'zero_fee', severity: 'baja', clientName: c.displayName || c.legalName, explanation: 'Cliente activo con tarifa de 0€' });
      if (c.accessStatus === 'activa' && c.billingMethod === 'stripe' && !c.stripeCustomerId) issues.push({ type: 'missing_payment_method', severity: 'alta', clientName: c.displayName || c.legalName, explanation: 'Cliente con cobro Stripe sin Customer ID' });
    }

    // Match Stripe customers to local clients by email, filling stripeCustomerId if missing
    const stripeByEmail = {};
    for (const sc of stripeCustomers) {
      const email = sc.email?.toLowerCase().trim();
      if (email) stripeByEmail[email] = sc;
    }
    const localEmailsSet = new Set((clients || []).map(c => c.email?.toLowerCase().trim()).filter(Boolean));

    // Enrich local clients with stripeCustomerId matched by email
    augmentedClients = augmentedClients.map(c => {
      const email = c.email?.toLowerCase().trim();
      const sc = email ? stripeByEmail[email] : null;
      if (sc && !c.stripeCustomerId) {
        return { ...c, stripeCustomerId: sc.id, stripeCustomerName: sc.name, _stripeMatchedByEmail: true };
      }
      if (sc) {
        return { ...c, stripeCustomerName: sc.name };
      }
      return c;
    });

    // Stripe customers without local match → add as synthetic client entries
    const stripeOrphans = stripeCustomers
      .filter(sc => { const email = sc.email?.toLowerCase().trim(); return email && !localEmailsSet.has(email); })
      .map(sc => ({
        id: null,
        _isStripeOnly: true,
        stripeCustomerId: sc.id,
        email: sc.email,
        legalName: sc.name || sc.email,
        displayName: sc.name || sc.email,
        accessStatus: 'pendiente_primer_acceso',
        billingStatus: 'pendiente_vincular',
        paymentStatus: 'pendiente',
        billingMethod: 'stripe',
        monthlyFee: 0,
        contractAmount: 0,
        created_date: sc.created ? new Date(sc.created * 1000).toISOString() : null,
        subscription: null,
        lastPayment: null,
        overdueAmount: 0,
        subscriptionCount: 0,
      }));

    const allClients = [...augmentedClients, ...stripeOrphans];

    return Response.json({
      kpis, stripe: stripeSummary, clients: allClients,
      dataQualityIssues: issues, stripeCustomersWithoutLocal: stripeOrphans.map(o => ({ id: o.stripeCustomerId, email: o.email, name: o.legalName, created: o.created_date })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[getBillingOverview]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
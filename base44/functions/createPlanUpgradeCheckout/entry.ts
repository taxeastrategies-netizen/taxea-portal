import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");
const APP_ID = Deno.env.get("BASE44_APP_ID");
const PUBLISHED_URL = "https://taxeaportal.com";

function getCurrentQuarterKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { toPlanCode } = body;
    if (!toPlanCode) return Response.json({ error: 'toPlanCode requerido' }, { status: 400 });

    // Get current subscription
    const subs = await base44.entities.Subscription.filter({ userId: user.id });
    const sub = subs?.[0];
    if (!sub || !['activa'].includes(sub.status)) {
      return Response.json({ error: 'Suscripción activa requerida para ampliar plan' }, { status: 403 });
    }

    const currentPlanCode = sub.planCode;

    // Load plan catalog
    const allPlans = await base44.asServiceRole.entities.PlanCatalog.filter({ isActive: true });
    const currentPlan = allPlans.find(p => p.planCode === currentPlanCode);
    const targetPlan = allPlans.find(p => p.planCode === toPlanCode);

    if (!currentPlan || !targetPlan) {
      return Response.json({ error: 'Plan no encontrado en catálogo' }, { status: 404 });
    }

    // Validate same clientType
    if (currentPlan.clientType !== targetPlan.clientType) {
      return Response.json({ error: 'No se puede cambiar entre planes de autónomos y empresas' }, { status: 400 });
    }

    // Only allow upgrading to next plan (or skip if admin multi-tier enabled)
    if (currentPlan.nextPlanCode !== toPlanCode) {
      return Response.json({ error: 'Solo se puede subir al siguiente tramo del plan' }, { status: 400 });
    }

    // Calculate difference
    const diff = targetPlan.monthlyBasePrice - currentPlan.monthlyBasePrice;
    if (diff <= 0) {
      return Response.json({ error: 'El plan destino debe ser superior al actual' }, { status: 400 });
    }

    // Find billing account
    const clientAccounts = await base44.asServiceRole.entities.ClientAccount.filter({ email: user.email });
    const clientAccount = clientAccounts?.[0];
    if (!clientAccount) return Response.json({ error: 'Cuenta de facturación no encontrada' }, { status: 404 });

    const billingAccountId = clientAccount.id;
    const quarterKey = getCurrentQuarterKey();

    // Check for existing pending upgrade request
    const existingUpgrades = await base44.asServiceRole.entities.PlanUpgradeRequest.filter({
      billingAccountId,
      toPlanCode,
      status: 'payment_pending',
    });
    if (existingUpgrades.length > 0) {
      return Response.json({ error: 'Ya existe una solicitud de ampliación pendiente de pago' }, { status: 409 });
    }

    const stripe = new Stripe(STRIPE_SECRET);

    // Create upgrade request record
    const upgradeRequest = await base44.asServiceRole.entities.PlanUpgradeRequest.create({
      billingAccountId,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      fromPlanCode: currentPlanCode,
      toPlanCode,
      quarterKey,
      baseDifferenceAmount: diff,
      taxAmount: 0,
      totalAmount: diff,
      currency: 'EUR',
      chargePolicy: 'full_difference_now',
      status: 'payment_pending',
    });

    const stripeCustomerId = sub.stripeCustomerId || user.stripeCustomerId;

    // Create one-time checkout for the difference
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomerId,
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(diff * 100),
          product_data: {
            name: `Ampliación de plan: ${currentPlan.displayName} → ${targetPlan.displayName}`,
            description: `Diferencia mensual. Base sin impuestos: ${diff} €`,
          },
        },
        quantity: 1,
      }],
      success_url: `${PUBLISHED_URL}/suscripcion?upgrade=success`,
      cancel_url: `${PUBLISHED_URL}/suscripcion?upgrade=cancelled`,
      metadata: {
        base44_app_id: APP_ID,
        portalUserId: user.id,
        upgradeRequestId: upgradeRequest.id,
        billingAccountId,
        fromPlanCode: currentPlanCode,
        toPlanCode,
        quarterKey,
        subscriptionId: sub.id,
        eventType: 'plan_upgrade',
      },
      locale: 'es',
    });

    await base44.asServiceRole.entities.PlanUpgradeRequest.update(upgradeRequest.id, {
      stripeCheckoutSessionId: session.id,
    });

    console.log(`Plan upgrade checkout: ${upgradeRequest.id}, ${currentPlanCode} → ${toPlanCode}, diff: ${diff}€`);

    return Response.json({
      url: session.url,
      upgradeRequestId: upgradeRequest.id,
      fromPlan: currentPlan.displayName,
      toPlan: targetPlan.displayName,
      differenceAmount: diff,
      newMonthlyPrice: targetPlan.monthlyBasePrice,
    });
  } catch (error) {
    console.error('Error en createPlanUpgradeCheckout:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
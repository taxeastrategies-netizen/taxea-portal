import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");
const APP_ID = Deno.env.get("BASE44_APP_ID");
const PUBLISHED_URL = "https://taxeaportal.com";

// Legacy plan prices kept for existing subscribers
const LEGACY_PLAN_PRICES = {
  basic_monthly:    "price_1TjegIDqzznToobkpNwexKOi",
};

// New V3 plans — Stripe Price IDs to be set after creating products in Stripe dashboard
// Until Stripe prices are created for V3 plans, fall back to creating checkout via price_data
const PLAN_CATALOG_CODES = [
  'platform_basic',
  'autonomo_basic_70', 'autonomo_medium_150', 'autonomo_advanced_225', 'autonomo_pro_300', 'autonomo_ultra_350',
  'company_basic_200', 'company_medium_260', 'company_advanced_350', 'company_pro_460', 'company_ultra_550',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json();
    const { planCode, successUrl, cancelUrl } = body;

    // Validate plan code
    const isLegacy = !!LEGACY_PLAN_PRICES[planCode];
    const isV3 = PLAN_CATALOG_CODES.includes(planCode);
    if (!isLegacy && !isV3) {
      return Response.json({ error: 'Plan no válido' }, { status: 400 });
    }

    // For V3 plans, load from PlanCatalog
    let planName, planAmount, stripePriceId;
    if (isV3) {
      const catalogPlans = await base44.asServiceRole.entities.PlanCatalog.filter({ planCode });
      const catalogPlan = catalogPlans?.[0];
      if (!catalogPlan || !catalogPlan.isActive) {
        return Response.json({ error: 'Plan no disponible' }, { status: 400 });
      }
      planName = catalogPlan.displayName;
      planAmount = catalogPlan.monthlyBasePrice;
      stripePriceId = catalogPlan.stripePriceId || null;
    } else {
      planName = 'Plan Básico Plataforma';
      planAmount = 9.99;
      stripePriceId = LEGACY_PLAN_PRICES[planCode];
    }

    // Verificar si ya tiene suscripción activa o pago pendiente
    const existingSubs = await base44.entities.Subscription.filter({ userId: user.id });
    const activeSub = existingSubs.find(s =>
      ['activa', 'paid_pending_activation', 'processing', 'pendiente_pago'].includes(s.status)
    );
    if (activeSub) {
      return Response.json({ error: 'Ya tienes una suscripción activa o pendiente de activación.' }, { status: 409 });
    }

    const stripe = new Stripe(STRIPE_SECRET);

    // Crear o recuperar Stripe Customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || user.email,
        metadata: { portalUserId: user.id, base44_app_id: APP_ID },
      });
      customerId = customer.id;
      await base44.asServiceRole.entities.User.update(user.id, { stripeCustomerId: customerId });
    }

    // Crear/actualizar registro de suscripción local
    let subscription;
    const subData = {
      planCode,
      planName,
      amount: planAmount,
      currency: 'EUR',
      interval: 'month',
      status: 'pendiente_pago',
      firstPaymentStatus: 'pending',
      stripePriceId: stripePriceId || '',
      stripeCustomerId: customerId,
      requestedAt: new Date().toISOString(),
    };

    if (existingSubs.length > 0) {
      subscription = existingSubs[0];
      await base44.entities.Subscription.update(subscription.id, subData);
    } else {
      subscription = await base44.entities.Subscription.create({
        userId: user.id,
        ...subData,
      });
    }

    // Build line items — use Stripe Price ID if available, else price_data
    const lineItem = stripePriceId
      ? { price: stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(planAmount * 100),
            recurring: { interval: 'month' },
            product_data: { name: planName, description: 'Taxea Portal — cuota mensual sin impuestos' },
          },
          quantity: 1,
        };

    // Crear sesión de Checkout en Stripe
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [lineItem],
      success_url: successUrl || `${PUBLISHED_URL}/suscripcion?checkout=success`,
      cancel_url: cancelUrl || `${PUBLISHED_URL}/suscripcion?checkout=cancelled`,
      metadata: {
        base44_app_id: APP_ID,
        portalUserId: user.id,
        planCode,
        subscriptionId: subscription.id,
      },
      subscription_data: {
        metadata: {
          base44_app_id: APP_ID,
          portalUserId: user.id,
          planCode,
          subscriptionId: subscription.id,
        },
      },
      payment_method_types: ['card'],
      locale: 'es',
    });

    console.log(`Checkout creado: plan ${planCode}, user ${user.id}, session ${session.id}`);

    await base44.entities.UserAuditLog.create({
      userId: user.id,
      actionType: 'suscripcion_solicitada',
      actionBy: user.email,
      actionAt: new Date().toISOString(),
      details: `Checkout creado: plan ${planCode}, sesión ${session.id}`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Error en createStripeCheckout:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
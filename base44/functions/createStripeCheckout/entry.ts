import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");
const APP_ID = Deno.env.get("BASE44_APP_ID");
const PUBLISHED_URL = "https://app.taxea.co";

const PLAN_PRICES = {
  basic_monthly:    "price_1TjegIDqzznToobkpNwexKOi",
  autonomo_monthly: "price_1TjegIDqzznToobk1RtjRRuY",
  mercantil_monthly:"price_1TjegIDqzznToobk6B3tIuAY",
};

const PLAN_AMOUNTS = {
  basic_monthly: 9.99,
  autonomo_monthly: 69.99,
  mercantil_monthly: 199.99,
};

const PLAN_NAMES = {
  basic_monthly: 'Plan Básico',
  autonomo_monthly: 'Plan Autónomo',
  mercantil_monthly: 'Plan Mercantil',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json();
    const { planCode, successUrl, cancelUrl } = body;

    if (!PLAN_PRICES[planCode]) {
      return Response.json({ error: 'Plan no válido' }, { status: 400 });
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
      planName: PLAN_NAMES[planCode],
      amount: PLAN_AMOUNTS[planCode],
      currency: 'EUR',
      interval: 'month',
      status: 'pendiente_pago',
      firstPaymentStatus: 'pending',
      stripePriceId: PLAN_PRICES[planCode],
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

    // Crear sesión de Checkout en Stripe
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: PLAN_PRICES[planCode], quantity: 1 }],
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
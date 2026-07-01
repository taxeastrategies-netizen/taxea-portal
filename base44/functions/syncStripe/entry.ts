import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'No autorizado' }, { status: 403 });

    const { subscriptionId } = await req.json().catch(() => ({}));
    const sub = await base44.entities.Subscription.get(subscriptionId);
    if (!sub) return Response.json({ error: 'Suscripción no encontrada' }, { status: 404 });

    const stripe = new Stripe(STRIPE_SECRET);

    let stripeSub = null;
    if (sub.stripeSubscriptionId) {
      stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    }

    // Actualizar datos desde Stripe
    const updates = {};
    if (stripeSub) {
      updates.status = stripeSub.status === 'active' ? (sub.status === 'paid_pending_activation' ? 'paid_pending_activation' : 'activa')
        : stripeSub.status === 'past_due' ? 'past_due'
        : stripeSub.status === 'canceled' ? 'cancelada'
        : sub.status;
      updates.currentPeriodStart = stripeSub.current_period_start ? new Date(stripeSub.current_period_start * 1000).toISOString() : sub.currentPeriodStart;
      updates.currentPeriodEnd = stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : sub.currentPeriodEnd;
      updates.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;

      // Obtener último pago
      const invoices = await stripe.invoices.list({
        subscription: sub.stripeSubscriptionId,
        limit: 1,
        status: 'paid',
      });
      if (invoices.data.length > 0) {
        const lastInvoice = invoices.data[0];
        updates.paymentMethodType = lastInvoice.payment_method_details?.type;
        updates.paymentMethodBrand = lastInvoice.payment_method_details?.card?.brand;
        updates.paymentMethodLast4 = lastInvoice.payment_method_details?.card?.last4;
      }
    }

    await base44.entities.Subscription.update(subscriptionId, updates);

    return Response.json({
      synced: true,
      local: { ...sub, ...updates },
      stripe: stripeSub ? { status: stripeSub.status, currentPeriodEnd: stripeSub.current_period_end } : null,
    });
  } catch (error) {
    console.error('Error en syncStripe:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");
const PUBLISHED_URL = "https://taxeaportal.com";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    // Solo la suscripción protegida del usuario autenticado es fuente de verdad.
    // El stripeCustomerId del perfil de usuario es editable y no se puede confiar en él.
    const subs = await base44.asServiceRole.entities.Subscription.filter({ userId: user.id });
    const customerIds = [...new Set((subs || []).map(sub => String(sub.stripeCustomerId || '').trim()).filter(Boolean))];
    if (customerIds.length === 0) {
      return Response.json({ error: 'No tienes un cliente Stripe asociado.' }, { status: 404 });
    }
    if (customerIds.length !== 1 || !/^cus_[A-Za-z0-9]+$/.test(customerIds[0])) {
      return Response.json({ error: 'La vinculación de Stripe requiere revisión del administrador.' }, { status: 409 });
    }
    if (!STRIPE_SECRET) return Response.json({ error: 'Stripe no está configurado.' }, { status: 503 });
    const stripeCustomerId = customerIds[0];
    const stripe = new Stripe(STRIPE_SECRET);

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${PUBLISHED_URL}/suscripcion`,
    });

    console.log(`Customer portal session creada para usuario ${user.id}`);
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Error en stripeCustomerPortal:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
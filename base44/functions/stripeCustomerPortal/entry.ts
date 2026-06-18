import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");
const PUBLISHED_URL = "https://taxeaportal.com";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    // Obtener stripeCustomerId del usuario
    const subs = await base44.entities.Subscription.filter({ userId: user.id });
    const sub = subs?.[0];

    const stripeCustomerId = user.stripeCustomerId || sub?.stripeCustomerId;
    if (!stripeCustomerId) {
      return Response.json({ error: 'No tienes un cliente Stripe asociado.' }, { status: 404 });
    }

    const stripe = new Stripe(STRIPE_SECRET);

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${PUBLISHED_URL}/suscripcion`,
    });

    console.log(`Customer portal session creada para usuario ${user.id}: ${session.url}`);
    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Error en stripeCustomerPortal:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
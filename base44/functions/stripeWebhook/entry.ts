import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.7.0';

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const APP_ID = Deno.env.get("BASE44_APP_ID");

Deno.serve(async (req) => {
  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) return Response.json({ error: 'Firma ausente' }, { status: 400 });

    const body = await req.text();
    const stripe = new Stripe(STRIPE_SECRET);

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
    } catch (err) {
      console.error('Firma webhook inválida:', err.message);
      return Response.json({ error: 'Firma inválida' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Verificar idempotencia
    const existingEvents = await base44.asServiceRole.entities.StripeWebhookEvent.filter({ stripeEventId: event.id });
    if (existingEvents.length > 0) {
      return Response.json({ received: true, idempotent: true });
    }

    // Guardar evento
    await base44.asServiceRole.entities.StripeWebhookEvent.create({
      stripeEventId: event.id,
      eventType: event.type,
      processed: true,
      processedAt: new Date().toISOString(),
      processingResult: 'received',
    });

    const metadata = event.data.object?.metadata || {};
    const portalUserId = metadata.portalUserId;
    const subscriptionId = metadata.subscriptionId;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && subscriptionId && portalUserId) {
          const stripeSubId = session.subscription;
          await base44.asServiceRole.entities.Subscription.update(subscriptionId, {
            stripeSubscriptionId: stripeSubId,
            status: 'processing',
            firstPaymentStatus: 'pending',
          });
          await base44.asServiceRole.entities.UserAuditLog.create({
            userId: portalUserId,
            actionType: 'suscripcion_solicitada',
            actionBy: 'stripe-webhook',
            actionAt: new Date().toISOString(),
            details: `Checkout completado. Stripe subscription: ${stripeSubId}`,
          });
        }
        break;
      }

      case 'checkout.session.async_payment_succeeded': {
        if (subscriptionId && portalUserId) {
          await base44.asServiceRole.entities.Subscription.update(subscriptionId, {
            firstPaymentStatus: 'paid',
            status: 'paid_pending_activation',
            lastPaymentAt: new Date().toISOString(),
          });
          await base44.asServiceRole.entities.UserAuditLog.create({
            userId: portalUserId,
            actionType: 'suscripcion_activada',
            actionBy: 'stripe-webhook',
            actionAt: new Date().toISOString(),
            details: 'Pago asíncrono confirmado (SEPA/domiciliación)',
          });
          await createAdminNotification(base44, portalUserId, subscriptionId, 'pago_verificado',
            'Pago verificado', 'Primer pago confirmado por Stripe. Pendiente de activación admin.');
        }
        break;
      }

      case 'checkout.session.async_payment_failed': {
        if (subscriptionId && portalUserId) {
          await base44.asServiceRole.entities.Subscription.update(subscriptionId, {
            firstPaymentStatus: 'failed',
            status: 'pendiente_pago',
          });
          await createAdminNotification(base44, portalUserId, subscriptionId, 'pago_fallido',
            'Pago inicial fallido', 'El pago asíncrono del usuario ha fallado.');
        }
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subMeta = invoice.subscription_details?.metadata || invoice.metadata || {};
        const subId = subMeta.subscriptionId || subscriptionId;
        const userId = subMeta.portalUserId || portalUserId;

        if (subId && userId) {
          const amount = invoice.amount_paid / 100;
          const isFirst = invoice.billing_reason === 'subscription_create';

          await base44.asServiceRole.entities.PaymentRecord.create({
            userId,
            subscriptionId: subId,
            stripeInvoiceId: invoice.id,
            stripePaymentIntentId: invoice.payment_intent,
            amount,
            currency: invoice.currency?.toUpperCase() || 'EUR',
            status: 'paid',
            paymentType: isFirst ? 'first_payment' : 'renewal',
            periodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
            periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
            paidAt: new Date().toISOString(),
          });

          const sub = await base44.asServiceRole.entities.Subscription.get(subId);

          if (isFirst) {
            await base44.asServiceRole.entities.Subscription.update(subId, {
              firstPaymentStatus: 'paid',
              status: 'paid_pending_activation',
              lastPaymentAt: new Date().toISOString(),
              nextRenewalAt: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
              currentPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
              currentPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
              paymentMethodType: invoice.payment_method_details?.type,
              paymentMethodBrand: invoice.payment_method_details?.card?.brand,
              paymentMethodLast4: invoice.payment_method_details?.card?.last4,
            });
            await createAdminNotification(base44, userId, subId, 'pago_verificado',
              'Nuevo pago verificado pendiente de activación',
              `Primer pago confirmado (${amount}€). Usuario pendiente de activación.`);
            await sendAdminEmail(base44,
              `Pago confirmado — Activación pendiente`,
              `Se ha confirmado el primer pago de ${amount}€ (ID de usuario: ${userId}).\n\nEl usuario está pendiente de activación manual.\n\nAccede al panel de administración para activar la cuenta: https://app.taxea.co/admin/users`);
          } else {
            await base44.asServiceRole.entities.Subscription.update(subId, {
              status: sub?.status === 'paid_pending_activation' ? 'activa' : sub?.status,
              lastPaymentAt: new Date().toISOString(),
              nextRenewalAt: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
              currentPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
              currentPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subMeta = invoice.subscription_details?.metadata || invoice.metadata || {};
        const subId = subMeta.subscriptionId || subscriptionId;
        const userId = subMeta.portalUserId || portalUserId;

        if (subId && userId) {
          await base44.asServiceRole.entities.Subscription.update(subId, {
            firstPaymentStatus: invoice.billing_reason === 'subscription_create' ? 'failed' : undefined,
            status: 'past_due',
          });
          await base44.asServiceRole.entities.PaymentRecord.create({
            userId,
            subscriptionId: subId,
            stripeInvoiceId: invoice.id,
            stripePaymentIntentId: invoice.payment_intent,
            amount: invoice.amount_due / 100,
            currency: invoice.currency?.toUpperCase() || 'EUR',
            status: 'failed',
            paymentType: invoice.billing_reason === 'subscription_create' ? 'first_payment' : 'renewal',
            failureCode: invoice.last_finalization_error?.code,
            failureMessageSafe: invoice.last_finalization_error?.message?.substring(0, 200),
          });
          await createAdminNotification(base44, userId, subId, 'renovacion_fallida',
            'Renovación fallida', `El pago de la renovación ha fallado. Motivo: ${invoice.last_finalization_error?.code || 'desconocido'}`);
          await sendAdminEmail(base44,
            `Pago fallido — Renovación`,
            `El pago de renovación de ${invoice.amount_due / 100}€ ha fallado para el usuario ${userId}.\n\nMotivo: ${invoice.last_finalization_error?.code || 'desconocido'}\n\nRevisa el estado en: https://app.taxea.co/admin/users`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const subId = sub.metadata?.subscriptionId;
        if (subId) {
          const updates = {
            currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : undefined,
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : undefined,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          };
          if (sub.cancel_at_period_end) {
            updates.cancelledAt = new Date().toISOString();
          }
          await base44.asServiceRole.entities.Subscription.update(subId, updates);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const subId = sub.metadata?.subscriptionId;
        const userId = sub.metadata?.portalUserId;
        if (subId) {
          await base44.asServiceRole.entities.Subscription.update(subId, {
            status: 'cancelada',
            cancelledAt: new Date().toISOString(),
          });
          if (userId) {
            await base44.asServiceRole.entities.User.update(userId, {
              isPortalActive: false,
              accountAccessStatus: 'locked',
            });
            await createAdminNotification(base44, userId, subId, 'suscripcion_cancelada',
              'Suscripción cancelada', 'La suscripción ha sido cancelada. Acceso bloqueado.');
            await sendAdminEmail(base44,
              `Suscripción cancelada`,
              `La suscripción del usuario ${userId} ha sido cancelada a través del portal de Stripe.\n\nEl acceso ha sido bloqueado automáticamente.`);
          }
        }
        break;
      }

      default:
        break;
    }

    // Actualizar el evento como procesado correctamente
    const eventRecord = await base44.asServiceRole.entities.StripeWebhookEvent.filter({ stripeEventId: event.id });
    if (eventRecord.length > 0) {
      await base44.asServiceRole.entities.StripeWebhookEvent.update(eventRecord[0].id, {
        processed: true,
        processedAt: new Date().toISOString(),
        relatedUserId: portalUserId,
        relatedSubscriptionId: subscriptionId,
        processingResult: 'success',
      });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Error en stripeWebhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function createAdminNotification(base44, userId, subscriptionId, type, title, message) {
  try {
    await base44.asServiceRole.entities.AdminNotification.create({
      type,
      title,
      message,
      userId,
      subscriptionId,
      isRead: false,
    });
  } catch (err) {
    console.error('Error creando notificación:', err);
  }
}

async function sendAdminEmail(base44, subject, body) {
  try {
    // Buscar la política del admin (guardada en renewalPolicies del primer admin)
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const adminEmail = admins?.[0]?.renewalPolicies?.admin_notification_email || admins?.[0]?.email;
    if (!adminEmail) return;

    const notifyOnPayment = admins?.[0]?.renewalPolicies?.notify_admin_on_payment !== false;
    const notifyOnFailure = admins?.[0]?.renewalPolicies?.notify_admin_on_failure !== false;

    const isPaymentEmail = subject.toLowerCase().includes('pago confirmado') || subject.toLowerCase().includes('verificado');
    const isFailureEmail = subject.toLowerCase().includes('fallido') || subject.toLowerCase().includes('cancelada');

    if (isPaymentEmail && !notifyOnPayment) return;
    if (isFailureEmail && !notifyOnFailure) return;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: adminEmail,
      subject: `[Taxea Portal] ${subject}`,
      body,
    });
    console.log(`Email admin enviado a ${adminEmail}: ${subject}`);
  } catch (err) {
    console.error('Error enviando email admin:', err);
  }
}
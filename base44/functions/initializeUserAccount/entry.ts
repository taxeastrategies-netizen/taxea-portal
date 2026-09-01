import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const existing = await base44.asServiceRole.entities.Subscription.filter({ userId: user.id });
    const isFirstInitialization = !existing?.length;

    if (isFirstInitialization) {
      await base44.asServiceRole.entities.Subscription.create({
        userId: user.id,
        planCode: 'sin_suscripcion',
        plan: 'sin_suscripcion',
        status: 'pendiente_seleccion',
        firstPaymentStatus: 'unpaid',
        requestedAt: new Date().toISOString(),
      });

      // Solo el alta inicial establece el bloqueo. Una llamada repetida nunca revoca una activación existente.
      await base44.asServiceRole.entities.User.update(user.id, {
        isPortalActive: false,
        accountAccessStatus: 'locked',
        adminActivationStatus: 'pending',
        status: 'pendiente',
      });
    }

    const audit = await base44.asServiceRole.entities.UserAuditLog.filter({
      userId: user.id,
      actionType: 'usuario_registrado',
    });

    if (!audit?.length) {
      await base44.asServiceRole.entities.UserAuditLog.create({
        userId: user.id,
        actionType: 'usuario_registrado',
        actionBy: user.email,
        actionAt: new Date().toISOString(),
        details: 'Usuario registrado. Cuenta bloqueada a la espera de suscripción y activación.',
      });
    }

    return Response.json({ initialized: true, idempotent: !isFirstInitialization });
  } catch (error) {
    console.error('[initializeUserAccount] Error:', error);
    return Response.json({ error: 'No se pudo inicializar la cuenta' }, { status: 500 });
  }
});

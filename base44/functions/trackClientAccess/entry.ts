import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
    if (['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ tracked: false, reason: 'admin' });
    }

    const companyId = user.data?.company_id;
    let accounts = companyId
      ? await base44.asServiceRole.entities.ClientAccount.filter({ id: companyId })
      : [];

    if (!accounts?.length && user.email) {
      accounts = await base44.asServiceRole.entities.ClientAccount.filter({ email: user.email });
    }

    const account = accounts?.find((candidate) =>
      candidate.email?.toLowerCase() === user.email?.toLowerCase()
      && (!companyId || candidate.id === companyId)
    );

    if (!account) return Response.json({ error: 'Cuenta de cliente no encontrada' }, { status: 404 });

    const now = new Date().toISOString();
    const updates = { lastLoginAt: now };
    const firstAccess = !account.firstAccessCompleted;
    const activationApproved =
      user.isPortalActive === true
      && user.accountAccessStatus === 'active'
      && user.adminActivationStatus === 'approved';

    if (firstAccess) {
      updates.firstAccessCompleted = true;
      updates.passwordChangedByClient = true;
      updates.lastPasswordChangeAt = now;
      if (account.accessStatus === 'pendiente_primer_acceso' && activationApproved) {
        updates.accessStatus = 'activa';
      }
    }

    await base44.asServiceRole.entities.ClientAccount.update(account.id, updates);
    await base44.asServiceRole.entities.ClientAccessAuditLog.create({
      clientAccountId: account.id,
      clientName: account.legalName,
      actionType: firstAccess ? 'primer_acceso' : 'login_correcto',
      actionBy: user.email,
      actionAt: now,
      details: firstAccess
        ? 'Primer acceso registrado por el servidor.'
        : 'Acceso al portal registrado por el servidor.',
    });

    return Response.json({ tracked: true, firstAccess });
  } catch (error) {
    console.error('[trackClientAccess] Error:', error);
    return Response.json({ error: 'No se pudo registrar el acceso' }, { status: 500 });
  }
});

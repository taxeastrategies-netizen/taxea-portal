import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const invalid = () => Response.json({ valid: false });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action = 'validate', token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== 'string' || token.length < 32) return invalid();

    const accounts = await base44.asServiceRole.entities.ClientAccount.filter({ setupToken: token });
    const account = accounts?.[0];
    if (!account) return invalid();
    if (account.setupTokenExpiresAt && new Date(account.setupTokenExpiresAt) < new Date()) return invalid();

    if (action === 'validate') {
      return Response.json({
        valid: true,
        email: account.email,
        legalName: account.legalName,
      });
    }

    if (action === 'consume') {
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.ClientAccount.update(account.id, {
        setupTokenExpiresAt: now,
      });
      await base44.asServiceRole.entities.ClientAccessAuditLog.create({
        clientAccountId: account.id,
        clientName: account.legalName,
        actionType: 'credenciales_generadas',
        actionBy: account.email,
        actionAt: now,
        details: 'Enlace de establecimiento de contraseña solicitado con token válido.',
      });
      return Response.json({ valid: true, consumed: true });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('[clientSetup] Error:', error);
    return invalid();
  }
});

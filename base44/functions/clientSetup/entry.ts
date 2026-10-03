import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const invalid = () => Response.json({ valid: false });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action = 'validate', token, clientAccountId } = await req.json().catch(() => ({}));
    if (action === 'issue') {
      const user = await base44.auth.me();
      if (!user || !['admin', 'super_admin'].includes(user.role)) {
        return Response.json({ error: 'No autorizado' }, { status: 403 });
      }
      if (typeof clientAccountId !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(clientAccountId)) {
        return Response.json({ error: 'Cliente no válido' }, { status: 400 });
      }
      const account = await base44.asServiceRole.entities.ClientAccount.get(clientAccountId);
      if (!account?.email) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 });
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const issuedToken = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      await base44.asServiceRole.entities.ClientAccount.update(account.id, {
        setupToken: issuedToken,
        setupTokenExpiresAt: expiresAt,
      });
      return Response.json({
        valid: true,
        setupUrl: `https://taxeaportal.com/setup-password#token=${issuedToken}`,
        expiresAt,
      }, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    }
    if (!token || typeof token !== 'string' || !/^[a-f0-9-]{32,64}$/i.test(token)) return invalid();

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
        setupToken: '',
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

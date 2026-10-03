import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id || !user?.email) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.action !== 'set_active_company') {
      return Response.json({ error: 'Acción no admitida' }, { status: 400 });
    }
    const companyId = body.companyId == null ? '' : String(body.companyId).trim();
    if (companyId && !/^[a-zA-Z0-9_-]{1,128}$/.test(companyId)) {
      return Response.json({ error: 'Identificador de empresa no válido' }, { status: 400 });
    }
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (!companyId && !isAdmin) {
      return Response.json({ error: 'Solo el administrador puede limpiar el contexto de empresa' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const current = await svc.entities.User.get(user.id).catch(() => null);
    if (!current || normalizeEmail(current.email) !== normalizeEmail(user.email)) {
      return Response.json({ error: 'Sesión no válida' }, { status: 403 });
    }

    let company = null;
    if (companyId) {
      company = await svc.entities.Company.get(companyId).catch(() => null);
      if (!company || company.activa === false) {
        return Response.json({ error: 'Empresa no disponible' }, { status: 404 });
      }
      if (!isAdmin) {
        const email = normalizeEmail(user.email);
        const owner = normalizeEmail(company.owner_email);
        const authorized = Array.isArray(company.usuarios_autorizados)
          ? company.usuarios_autorizados.some((entry: unknown) => normalizeEmail(entry) === email)
          : false;
        if (owner !== email && !authorized) {
          return Response.json({ error: 'Empresa no autorizada' }, { status: 403 });
        }
      }
    }

    const oldCompanyId = String(current.data?.company_id || current.company_id || '');
    if (oldCompanyId !== companyId) {
      await svc.entities.User.update(user.id, { company_id: companyId || null });
    }
    return Response.json({ ok: true, companyId: companyId || null, changed: oldCompanyId !== companyId });
  } catch (error) {
    console.error('[companyContextOperations]', error);
    return Response.json({ error: 'No se pudo cambiar la empresa activa' }, { status: 500 });
  }
});

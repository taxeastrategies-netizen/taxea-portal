import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Las propiedades ampliadas pueden llegar en la raíz o en data según la versión del SDK.
function isTaxeaAccountDisabled(account: any) {
  return [account, account?.data].filter(Boolean).some(state =>
    state.is_deleted === true
    || ['eliminado', 'bloqueado', 'suspendido'].includes(String(state.status || '').trim().toLowerCase())
    || ['suspended', 'blocked', 'disabled', 'deleted'].includes(String(state.accountAccessStatus || '').trim().toLowerCase()));
}


export default async function(req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Método no permitido' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (isTaxeaAccountDisabled(user)) return Response.json({ error: 'Acceso al portal suspendido.', code: 'ACCOUNT_DISABLED' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const companyId = String(body?.companyId || '').trim();
    if (!companyId) return Response.json({ error: 'companyId requerido' }, { status: 400 });

    const svc = base44.asServiceRole;
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';

    if (!isAdmin) {
      const companies = await svc.entities.Company.filter({ id: companyId });
      const company = companies?.[0];
      if (!company) return Response.json({ error: 'Empresa no encontrada' }, { status: 404 });
      const email = (user.email || '').toLowerCase();
      const owns = (company.owner_email || '').toLowerCase() === email;
      const authorized = (company.usuarios_autorizados || []).some((value) => (value || '').toLowerCase() === email);
      if (!owns && !authorized) return Response.json({ error: 'Empresa no autorizada' }, { status: 403 });
    }

    const contacts = await svc.entities.Contact.filter({ company_id: companyId }, 'nombre', 5000, 0);
    return Response.json({
      success: true,
      contacts: (contacts || []).filter((contact) => contact.activo !== false && !contact.merged_into_contact_id),
    });
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error('[getCompanyContacts]', { requestId, name: String(error?.name || 'Error') });
    return Response.json({ error: 'No se pudieron cargar los contactos. Reintenta; si continúa, comunica la referencia al administrador.', code: 'INTERNAL_ERROR', requestId }, { status: 500 });
  }
}

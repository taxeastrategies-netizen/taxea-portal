import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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
    console.error('[getCompanyContacts]', error);
    return Response.json({ error: 'No se pudieron cargar los contactos', detail: error?.message || String(error) }, { status: 500 });
  }
}
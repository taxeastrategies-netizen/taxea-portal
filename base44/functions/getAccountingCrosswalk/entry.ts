import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

const clean = value => String(value ?? '').trim();
const roleOf = user => clean(user?.role || user?.data?.role).toLowerCase();

Deno.serve(async req => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { company_id } = await req.json().catch(() => ({}));
    if (!company_id) return Response.json({ error: 'company_id es obligatorio.' }, { status: 400 });
    const svc = base44.asServiceRole;
    const company = await svc.entities.Company.get(company_id).catch(() => null);
    if (!company) return Response.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    const email = clean(user.email).toLowerCase();
    const authorized = Array.isArray(company.usuarios_autorizados)
      ? company.usuarios_autorizados.map(value => clean(value).toLowerCase()) : [];
    const allowed = ['admin', 'super_admin'].includes(roleOf(user))
      || clean(user?.data?.company_id || user?.company_id) === company_id
      || (email && clean(company.owner_email).toLowerCase() === email)
      || (email && authorized.includes(email));
    if (!allowed) return Response.json({ error: 'No tienes permiso para consultar esta empresa.' }, { status: 403 });
    const rows = await svc.entities.CounterpartyFiscalProfile.filter({ company_id }, '-created_date', 5001);
    if (rows.length > 5000) return Response.json({ error: 'El censo supera el límite seguro de exportación.' }, { status: 413 });
    return Response.json({ profiles: rows.map(row => ({
      name: row.name || '',
      taxId: row.taxId || '',
      accountingRole: row.accountingRole || '',
      accountingAccountCode: row.accountingAccountCode || '',
      externalAccountCode: row.externalAccountCode || '',
      externalAccountStatus: row.externalAccountStatus || '',
      externalAccountYear: row.externalAccountYear || null,
    })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error?.message || 'No se pudo consultar el maestro contable.' }, { status: 500 });
  }
});

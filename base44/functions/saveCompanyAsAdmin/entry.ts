import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { companyData, clientEmail, companyId } = body;

    if (!companyData || !clientEmail) {
      return Response.json({ error: 'Faltan datos: companyData y clientEmail son obligatorios' }, { status: 400 });
    }

    // Buscar si ya existe una empresa para este cliente
    let existing = null;
    if (companyId) {
      try {
        existing = await base44.asServiceRole.entities.Company.get(companyId);
      } catch {}
    }
    if (!existing) {
      const found = await base44.asServiceRole.entities.Company.filter({ owner_email: clientEmail }, '-created_date', 1);
      existing = found?.[0] || null;
    }

    const payload = {
      ...companyData,
      owner_email: clientEmail,
      activa: true,
    };

    let saved;
    if (existing) {
      saved = await base44.asServiceRole.entities.Company.update(existing.id, payload);
    } else {
      saved = await base44.asServiceRole.entities.Company.create(payload);
    }

    // Vincular todos los accesos con el mismo email a la empresa canónica.
    // Es idempotente y repara usuarios antiguos creados antes de company_id.
    const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const matchingUsers = (users || []).filter(item =>
      String(item.email || '').trim().toLowerCase() === String(clientEmail).trim().toLowerCase()
    );
    for (const matchingUser of matchingUsers) {
      if (matchingUser.data?.company_id !== saved.id && matchingUser.company_id !== saved.id) {
        await base44.asServiceRole.entities.User.update(matchingUser.id, { company_id: saved.id });
      }
    }

    return Response.json({ success: true, company: saved, linkedUsers: matchingUsers.length });
  } catch (error) {
    console.error('Error en saveCompanyAsAdmin:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
});
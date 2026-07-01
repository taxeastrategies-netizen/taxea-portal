import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden — solo administradores' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const email = body?.email?.trim()?.toLowerCase();
    const role = body?.role || 'user';
    const fullName = body?.full_name?.trim();

    if (!email) return Response.json({ error: 'Email requerido' }, { status: 400 });
    if (!['user', 'admin'].includes(role)) return Response.json({ error: 'Rol inválido' }, { status: 400 });

    const result = await base44.users.inviteUser(email, role);

    // Si tenemos nombre, lo guardamos en el perfil del usuario recién invitado
    if (fullName && result?.id) {
      try {
        await base44.asServiceRole.entities.User.update(result.id, { full_name: fullName });
      } catch (e) {
        console.log('No se pudo guardar full_name:', e.message);
      }
    }

    return Response.json({ success: true, user: result });
  } catch (error) {
    console.error('inviteUser error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
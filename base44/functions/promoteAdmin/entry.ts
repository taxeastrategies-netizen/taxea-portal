/**
 * promoteAdmin — Promueve un email específico a super_admin.
 * Solo puede ser invocado por quien ya es admin o super_admin.
 * El primer super_admin debe inicializarse de forma segura durante el despliegue
 * (ej. directamente desde el panel de Base44), no mediante coincidencia de email.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const targetEmail = body.email;

    if (!targetEmail) {
      return Response.json({ error: 'email is required' }, { status: 400 });
    }

    // Solo admin/super_admin pueden promover — sin bypass por email
    const caller = await base44.auth.me().catch(() => null);
    const callerIsAdmin = caller && ['admin', 'super_admin'].includes(caller.role);

    if (!callerIsAdmin) {
      return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    // Buscar el usuario por email
    const users = await base44.asServiceRole.entities.User.filter({ email: targetEmail });
    if (!users || users.length === 0) {
      return Response.json({ error: `Usuario ${targetEmail} no encontrado. Debe registrarse primero en el portal.` }, { status: 404 });
    }

    const targetUser = users[0];

    // Actualizar rol a super_admin
    await base44.asServiceRole.entities.User.update(targetUser.id, { role: 'super_admin' });

    return Response.json({
      success: true,
      message: `Usuario ${targetEmail} promovido a super_admin correctamente.`,
      user: { email: targetEmail, role: 'super_admin' }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
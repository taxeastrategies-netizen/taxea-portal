import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { consulta_id, valoracion, tarea_creada } = await req.json().catch(() => ({}));
    if (!consulta_id) return Response.json({ error: 'Falta consulta_id' }, { status: 400 });

    const consulta = await base44.asServiceRole.entities.AIConsulta.get(consulta_id).catch(() => null);
    if (!consulta) return Response.json({ error: 'Consulta no encontrada' }, { status: 404 });

    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (!isAdmin && consulta.company_id !== user.data?.company_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = {};
    if (valoracion !== undefined) {
      if (!['util', 'no_util', 'sin_valorar'].includes(valoracion)) {
        return Response.json({ error: 'Valoración no válida' }, { status: 400 });
      }
      data.valoracion = valoracion;
    }
    if (tarea_creada !== undefined) {
      if (typeof tarea_creada !== 'boolean') {
        return Response.json({ error: 'tarea_creada debe ser booleana' }, { status: 400 });
      }
      data.tarea_creada = tarea_creada;
    }
    if (!Object.keys(data).length) {
      return Response.json({ error: 'No hay cambios válidos' }, { status: 400 });
    }

    await base44.asServiceRole.entities.AIConsulta.update(consulta.id, data);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
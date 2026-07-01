import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { consulta_id, valoracion, tarea_creada } = await req.json().catch(() => ({}));
    if (!consulta_id) return Response.json({ error: 'Falta consulta_id' }, { status: 400 });

    const data = {};
    if (valoracion) data.valoracion = valoracion;
    if (tarea_creada !== undefined) data.tarea_creada = tarea_creada;

    await base44.asServiceRole.entities.AIConsulta.update(consulta_id, data);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
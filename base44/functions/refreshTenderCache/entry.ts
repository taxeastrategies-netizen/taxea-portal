import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { isSource, refreshSnapshot } from '../searchTenders/snapshot.ts';

Deno.serve(async request => {
  try {
    if (request.method !== 'POST') return Response.json({ error: 'Método no permitido.' }, { status: 405 });
    const sdk = createClientFromRequest(request);
    const user = await sdk.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) return Response.json({ error: 'Acceso reservado al administrador.' }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    if (!isSource(body.source)) return Response.json({ error: 'Fuente no válida.' }, { status: 400 });
    const result = await refreshSnapshot(sdk, body.source);
    return Response.json({ ok: true, source: body.source, fetchedAt: result.fetchedAt, examined: result.examined, matches: result.rows.length });
  } catch (error) {
    console.error('Tender cache refresh failed:', String((error as Error)?.message || error).slice(0, 250));
    return Response.json({ error: 'No se pudo renovar esta fuente oficial. Se conserva la última copia temporal correcta.' }, { status: 502 });
  }
});

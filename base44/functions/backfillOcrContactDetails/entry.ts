import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.disabled) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }
  return Response.json({
    error: 'Migracion historica de contactos completada y desactivada',
    version: 'contacts-v2-2026-08-15',
  }, { status: 410 });
});

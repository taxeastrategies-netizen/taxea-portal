/** Canal WhatsApp automático inactivo. Se conserva el endpoint para llamadas antiguas. */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || !['admin', 'super_admin'].includes(user.role)) {
    return Response.json({ error: 'Acceso restringido a administradores' }, { status: 403 });
  }
  return Response.json({
    success: false,
    status: 'disabled',
    error: 'El envío automático por WhatsApp está desactivado. El mensaje permanece como borrador; no se ha enviado.',
  }, { status: 200 });
});

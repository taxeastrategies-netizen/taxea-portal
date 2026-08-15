Deno.serve(() => Response.json({
  error: 'Migracion historica de contactos completada y desactivada',
  version: 'contacts-v2-2026-08-15',
}, { status: 410 }));

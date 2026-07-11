import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { clientIds, anio } = body;

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return Response.json({ error: 'clientIds array is required' }, { status: 400 });
    }

    const year = anio ? parseInt(anio) : null;

    // Fetch invoices and expenses for all clients in parallel using service role
    const results = {};
    const tasks = clientIds.map(async (cid) => {
      const filter = { company_id: cid };
      if (year) filter.anio = year;
      const [invs, exps] = await Promise.all([
        base44.asServiceRole.entities.Invoice.filter(filter, '-fecha_emision', 5000).catch(() => []),
        base44.asServiceRole.entities.Expense.filter(filter, '-fecha', 5000).catch(() => []),
      ]);
      const activeInvs = (invs || []).filter(i => !i.anulada);
      const activeExps = (exps || []).filter(e => !e.anulada);
      results[cid] = {
        emittedInvoiceIds: activeInvs.filter(i => i.tipo === 'emitida').map(i => i.id),
        receivedInvoiceIds: activeInvs.filter(i => i.tipo === 'recibida').map(i => i.id),
        expenseIds: activeExps.filter(e => e.tipo === 'gasto').map(e => e.id),
      };
    });

    await Promise.all(tasks);

    return Response.json({ clients: results });
  } catch (error) {
    console.error('[getClientExportStatus] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
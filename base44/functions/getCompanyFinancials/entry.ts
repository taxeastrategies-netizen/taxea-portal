import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { company_id, anio } = body;

    if (!company_id) {
      return Response.json({ error: 'company_id es obligatorio' }, { status: 400 });
    }

    const filter = { company_id };
    if (anio) filter.anio = parseInt(anio);

    // Fetch with service role to bypass RLS issues with stale user tokens
    const [invoices, expenses] = await Promise.all([
      base44.asServiceRole.entities.Invoice.filter(filter, '-fecha_emision', 500),
      base44.asServiceRole.entities.Expense.filter(filter, '-fecha', 500),
    ]);

    return Response.json({
      invoices: invoices || [],
      expenses: expenses || [],
      count: { invoices: invoices?.length || 0, expenses: expenses?.length || 0 }
    });

  } catch (error) {
    console.error('[getCompanyFinancials] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
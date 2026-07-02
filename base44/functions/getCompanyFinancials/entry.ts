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
      base44.asServiceRole.entities.Invoice.filter(filter, '-fecha_emision', 5000),
      base44.asServiceRole.entities.Expense.filter(filter, '-fecha', 5000),
    ]);

    const invs = invoices || [];
    const exps = expenses || [];

    // ── Pre-calculated summary (consistent rules) ──────────────────────────
    // Exclude annulled invoices from ALL active totals
    const activeInvs = invs.filter(i => !i.anulada);
    const activeExps = exps.filter(e => !e.anulada);

    const emitidas = activeInvs.filter(i => i.tipo === 'emitida');
    const recibidas = activeInvs.filter(i => i.tipo === 'recibida');
    const gastos = activeExps.filter(e => e.tipo === 'gasto');

    const totalIngresos = emitidas.reduce((s, i) => s + (i.total_factura || 0), 0);
    const totalGastosFacturas = recibidas.reduce((s, i) => s + (i.total_factura || 0), 0);
    const totalGastosExpense = gastos.reduce((s, e) => s + (e.total || 0), 0);
    const totalGastos = totalGastosFacturas + totalGastosExpense;

    const baseIngresos = emitidas.reduce((s, i) => s + (i.base_imponible || 0), 0);
    const baseGastos = recibidas.reduce((s, i) => s + (i.base_imponible || 0), 0)
      + gastos.reduce((s, e) => s + (e.base_imponible || 0), 0);

    const ivaRepercutido = emitidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
    const ivaSoportado = recibidas.reduce((s, i) => s + (i.cuota_iva || 0), 0)
      + gastos.reduce((s, e) => s + (e.cuota_impuesto || 0), 0);

    const now = new Date();
    const facturasVencidas = emitidas.filter(i =>
      i.fecha_vencimiento && new Date(i.fecha_vencimiento) < now &&
      !['cobrada'].includes(i.estado_cobro)
    );
    const cobrosPendientes = emitidas
      .filter(i => ['pendiente', 'vencida'].includes(i.estado_cobro))
      .reduce((s, i) => s + (i.total_factura || 0), 0);
    const pagosPendientes = recibidas
      .filter(i => ['pendiente', 'vencida'].includes(i.estado_cobro))
      .reduce((s, i) => s + (i.total_factura || 0), 0);

    return Response.json({
      invoices: invs,
      expenses: exps,
      count: { invoices: invs.length, expenses: exps.length },
      summary: {
        totalIngresos,
        totalGastos,
        totalGastosFacturas,
        totalGastosExpense,
        resultado: totalIngresos - totalGastos,
        baseIngresos,
        baseGastos,
        ivaRepercutido,
        ivaSoportado,
        ivaNeto: ivaRepercutido - ivaSoportado,
        cobrosPendientes,
        pagosPendientes,
        facturasVencidas: facturasVencidas.length,
        facturasPendientesContabilizar: activeInvs.filter(i => i.estado_contable === 'pendiente').length,
        numFacturasEmitidas: emitidas.length,
        numFacturasRecibidas: recibidas.length,
        numGastos: gastos.length,
        numAnuladas: invs.filter(i => i.anulada).length,
        excludeAnulada: true,
        generatedAt: now.toISOString(),
      }
    });

  } catch (error) {
    console.error('[getCompanyFinancials] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
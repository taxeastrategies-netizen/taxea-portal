/**
 * Financial Core - Capa de calculo financiero unificada
 * 
 * Regla de oro: Un mismo cliente + mismo periodo + mismo criterio de fecha + mismos estados = mismos importes en toda la app.
 * 
 * Todos los dashboards, libros, tablas y KPIs DEBEN usar estas funciones para garantizar consistencia.
 * 
 * Reglas de calculo:
 * - Facturas con anulada=true se excluyen de TODOS los totales activos (ingresos, gastos, IVA, etc.)
 * - Ingresos = facturas emitidas (tipo='emitida'), usando total_factura
 * - Gastos = facturas recibidas (tipo='recibida') usando total_factura + Expense (tipo='gasto') usando total
 * - Base imponible se calcula siempre con base_imponible
 * - IVA/IGIC: cuota_iva para facturas, cuota_impuesto para expenses
 * - Retenciones: base_imponible * retencion_irpf / 100
 */

// ── Filtrado base ───────────────────────────────────────────────────────────

/**
 * Filtra facturas activas (no anuladas).
 * Esta es la regla mas critica: las facturas anuladas NO suman en totales activos.
 */
export function activeInvoices(invoices) {
  return (invoices || []).filter(i => !i.anulada);
}

/**
 * Filtra expenses activos (por ahora no hay campo anulada, pero预留).
 */
export function activeExpenses(expenses) {
  return (expenses || []).filter(e => !e.anulada);
}

// ── Filtrado por periodo ────────────────────────────────────────────────────

/**
 * Filtra por ano y opcionalmente por trimestre.
 * Usa el campo `anio` si existe, sino lo deriva de la fecha.
 */
export function filterByPeriod(items, { year, quarter } = {}) {
  let result = items || [];
  if (year) {
    const y = parseInt(year);
    result = result.filter(item => {
      if (item.anio != null) return item.anio === y;
      const fecha = item.fecha_emision || item.fecha;
      if (!fecha) return false;
      return new Date(fecha).getFullYear() === y;
    });
  }
  if (quarter && quarter !== 'all') {
    result = result.filter(item => item.trimestre === quarter);
  }
  return result;
}

// ── Clasificacion ───────────────────────────────────────────────────────────

export function classifyInvoices(invoices) {
  const active = activeInvoices(invoices);
  return {
    emitidas: active.filter(i => i.tipo === 'emitida'),
    recibidas: active.filter(i => i.tipo === 'recibida'),
    anuladas: (invoices || []).filter(i => i.anulada),
  };
}

// ── Calculos principales ────────────────────────────────────────────────────

/**
 * Calcula todos los KPIs financieros de forma consistente.
 * Todas las pantallas deben usar esta funcion para derivar sus numeros.
 * 
 * @param {Array} invoices - Todas las facturas (incluyendo anuladas)
 * @param {Array} expenses - Todos los gastos
 * @param {Object} options - { year, quarter } opcional
 * @returns {Object} KPIs financieros unificados
 */
export function calculateFinancialKPIs(invoices, expenses, options = {}) {
  const { year, quarter } = options;
  
  // Filtrar activas primero
  const activeInvs = activeInvoices(invoices);
  const activeExps = activeExpenses(expenses);
  
  // Filtrar por periodo
  const periodInvs = filterByPeriod(activeInvs, { year, quarter });
  const periodExps = filterByPeriod(activeExps, { year, quarter });
  
  // Clasificar
  const emitidas = periodInvs.filter(i => i.tipo === 'emitida');
  const recibidas = periodInvs.filter(i => i.tipo === 'recibida');
  const gastos = periodExps.filter(e => e.tipo === 'gasto');
  
  // ── Totales (usando total_factura para facturas, total para expenses) ──
  const totalIngresos = emitidas.reduce((s, i) => s + (i.total_factura || 0), 0);
  const totalGastosFacturas = recibidas.reduce((s, i) => s + (i.total_factura || 0), 0);
  const totalGastosExpense = gastos.reduce((s, e) => s + (e.total || 0), 0);
  const totalGastos = totalGastosFacturas + totalGastosExpense;
  
  // ── Bases imponibles ──
  const baseIngresos = emitidas.reduce((s, i) => s + (i.base_imponible || 0), 0);
  const baseGastosFacturas = recibidas.reduce((s, i) => s + (i.base_imponible || 0), 0);
  const baseGastosExpense = gastos.reduce((s, e) => s + (e.base_imponible || 0), 0);
  const baseGastos = baseGastosFacturas + baseGastosExpense;
  
  // ── IVA/IGIC ──
  const ivaRepercutido = emitidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const ivaSoportadoFacturas = recibidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const ivaSoportadoExpense = gastos.reduce((s, e) => s + (e.cuota_impuesto || 0), 0);
  const ivaSoportado = ivaSoportadoFacturas + ivaSoportadoExpense;
  const ivaNeto = ivaRepercutido - ivaSoportado;
  
  // ── Retenciones IRPF ──
  const retencionIngresos = emitidas.reduce((s, i) => s + ((i.base_imponible || 0) * (i.retencion_irpf || 0) / 100), 0);
  const retencionGastos = recibidas.reduce((s, i) => s + ((i.base_imponible || 0) * (i.retencion_irpf || 0) / 100), 0);
  
  // ── Resultado ──
  const resultado = totalIngresos - totalGastos;
  const margen = totalIngresos > 0 ? (resultado / totalIngresos) * 100 : 0;
  
  // ── Cobros pendientes (facturas emitidas no cobradas) ──
  const facturasPendientesCobro = emitidas.filter(i => 
    ['pendiente', 'vencida'].includes(i.estado_cobro)
  );
  const cobrosPendientes = facturasPendientesCobro.reduce((s, i) => s + (i.total_factura || 0), 0);
  
  // ── Facturas cobradas ──
  const facturasCobradas = emitidas.filter(i => i.estado_cobro === 'cobrada');
  const totalCobrado = facturasCobradas.reduce((s, i) => s + (i.total_factura || 0), 0);
  
  // ── Facturas vencidas ──
  const now = new Date();
  const facturasVencidas = emitidas.filter(i => 
    i.fecha_vencimiento && 
    new Date(i.fecha_vencimiento) < now && 
    !['cobrada', 'anulada'].includes(i.estado_cobro)
  );
  
  // ── Pagos pendientes (facturas recibidas no pagadas) ──
  const facturasPendientesPago = recibidas.filter(i => 
    ['pendiente', 'vencida'].includes(i.estado_cobro)
  );
  const pagosPendientes = facturasPendientesPago.reduce((s, i) => s + (i.total_factura || 0), 0);
  
  // ── Estados contables ──
  const facturasPendientesContabilizar = periodInvs.filter(i => i.estado_contable === 'pendiente');
  const facturasContabilizadas = periodInvs.filter(i => i.estado_contable === 'contabilizada');
  
  // ── Conteos ──
  const numFacturasEmitidas = emitidas.length;
  const numFacturasRecibidas = recibidas.length;
  const numGastos = gastos.length;
  const numAnuladas = (invoices || []).filter(i => i.anulada).length;
  
  // ── Datos crudos filtrados para que las pantallas puedan usarlos ──
  return {
    // Totales principales (total con impuestos)
    totalIngresos,
    totalGastos,
    totalGastosFacturas,
    totalGastosExpense,
    resultado,
    margen,
    
    // Bases imponibles
    baseIngresos,
    baseGastos,
    baseGastosFacturas,
    baseGastosExpense,
    
    // IVA/IGIC
    ivaRepercutido,
    ivaSoportado,
    ivaNeto,
    
    // Retenciones
    retencionIngresos,
    retencionGastos,
    
    // Cobros/pagos
    cobrosPendientes,
    totalCobrado,
    pagosPendientes,
    facturasPendientesCobro: facturasPendientesCobro.length,
    facturasVencidas: facturasVencidas.length,
    facturasVencidasList: facturasVencidas,
    
    // Estados contables
    facturasPendientesContabilizar: facturasPendientesContabilizar.length,
    facturasContabilizadas: facturasContabilizadas.length,
    
    // Conteos
    numFacturasEmitidas,
    numFacturasRecibidas,
    numGastos,
    numAnuladas,
    
    // Datos crudos filtrados (para tablas, listas, etc.)
    emitidas,
    recibidas,
    gastos,
    activeInvoices: periodInvs,
    activeExpenses: periodExps,
    
    // Metadatos
    criteria: { year: year || 'all', quarter: quarter || 'all', excludeAnulada: true },
  };
}

// ── Datos mensuales para graficas ───────────────────────────────────────────

/**
 * Genera datos mensuales de ingresos vs gastos para un ano dado.
 * Usa total_factura para facturas y total para expenses.
 * Excluye anuladas.
 */
export function calculateMonthlyData(invoices, expenses, year) {
  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const y = parseInt(year) || new Date().getFullYear();
  
  const data = MONTHS.map(m => ({ month: m, ingresos: 0, gastos: 0 }));
  
  activeInvoices(invoices).filter(i => i.tipo === 'emitida').forEach(i => {
    const d = new Date(i.fecha_emision || i.created_date);
    if (!isNaN(d) && d.getFullYear() === y) {
      data[d.getMonth()].ingresos += Math.round(i.total_factura || 0);
    }
  });
  
  activeExpenses(expenses).filter(e => e.tipo === 'gasto').forEach(e => {
    const d = new Date(e.fecha || e.created_date);
    if (!isNaN(d) && d.getFullYear() === y) {
      data[d.getMonth()].gastos += Math.round(e.total || 0);
    }
  });
  
  // Anadir gastos de facturas recibidas
  activeInvoices(invoices).filter(i => i.tipo === 'recibida').forEach(i => {
    const d = new Date(i.fecha_emision || i.created_date);
    if (!isNaN(d) && d.getFullYear() === y) {
      data[d.getMonth()].gastos += Math.round(i.total_factura || 0);
    }
  });
  
  return data;
}

// ── Formato ─────────────────────────────────────────────────────────────────

export function fmtCurrency(n) {
  return (parseFloat(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtCurrencyShort(n) {
  return (parseFloat(n) || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 });
}
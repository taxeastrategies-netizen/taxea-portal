// Excel export using SpreadsheetML (XML) for cell style support (green highlighting)

function escapeXml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const n = v => parseFloat(v) || 0;
const pct = (base, tipo) => n(base) * n(tipo) / 100;

function quarter(fecha) {
  const m = new Date(fecha || '').getMonth();
  if (isNaN(m)) return '';
  return m < 3 ? 'T1' : m < 6 ? 'T2' : m < 9 ? 'T3' : 'T4';
}

function sheetToXML(name, rows, colWidths, newRowIndices = []) {
  const newRowSet = new Set(newRowIndices.map(i => i + 1));
  let xml = `<Worksheet ss:Name="${escapeXml(name)}">\n<Table>\n`;
  colWidths.forEach(w => { xml += `<Column ss:Width="${w * 7}"/>\n`; });
  rows.forEach((row, r) => {
    const styleId = r === 0 ? 'Header' : newRowSet.has(r) ? 'NewRow' : 'Default';
    xml += `<Row ss:StyleID="${styleId}">\n`;
    row.forEach(cell => {
      const type = typeof cell === 'number' ? 'Number' : 'String';
      xml += `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>\n`;
    });
    xml += '</Row>\n';
  });
  xml += '</Table>\n</Worksheet>\n';
  return xml;
}

function downloadSpreadsheetML(sheets, filename) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += '<Styles>\n';
  xml += '<Style ss:ID="Default"><Alignment ss:Vertical="Bottom"/></Style>\n';
  xml += '<Style ss:ID="Header"><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/><Font ss:Bold="1" ss:Color="#1E293B"/><Alignment ss:Vertical="Center"/></Style>\n';
  xml += '<Style ss:ID="NewRow"><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/><Font ss:Color="#14532D" ss:Bold="1"/></Style>\n';
  xml += '</Styles>\n';
  sheets.forEach(s => { xml += sheetToXML(s.name, s.rows, s.colWidths, s.newRowIndices); });
  xml += '</Workbook>';
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Hoja 1: Resumen Fiscal ──────────────────────────────────────────────────
function buildResumenFiscal(invoices, expenses, year, companyName, lastExportDate, newEmitted, newReceived, newExpenses) {
  const emitidas = invoices.filter(i => i.tipo === 'emitida');
  const recibidas = invoices.filter(i => i.tipo === 'recibida');
  const gastos = expenses.filter(e => e.tipo === 'gasto');

  const totalBaseIngresos = emitidas.reduce((s, i) => s + n(i.base_imponible), 0);
  const totalIvaRep = emitidas.reduce((s, i) => s + n(i.cuota_iva), 0);
  const totalRetIRPF = emitidas.reduce((s, i) => s + pct(i.base_imponible, i.retencion_irpf), 0);
  const totalIngresos = emitidas.reduce((s, i) => s + n(i.total_factura), 0);

  const totalBaseGastos = [...recibidas, ...gastos].reduce((s, e) => s + n(e.base_imponible), 0);
  const totalIvaSop = recibidas.reduce((s, i) => s + n(i.cuota_iva), 0) + gastos.reduce((s, e) => s + n(e.cuota_impuesto), 0);
  const totalGastos = recibidas.reduce((s, i) => s + n(i.total_factura), 0) + gastos.reduce((s, e) => s + n(e.total), 0);

  const beneficio = totalBaseIngresos - totalBaseGastos;
  const ivaLiquidar = totalIvaRep - totalIvaSop;
  const margen = totalBaseIngresos > 0 ? (beneficio / totalBaseIngresos * 100).toFixed(2) + ' %' : '0,00 %';

  const rows = [
    [`RESUMEN FISCAL — ${companyName} — Ejercicio ${year}`],
    [],
    ['CONCEPTO', 'IMPORTE (€)'],
    ['── INGRESOS ──', ''],
    ['Base imponible facturas emitidas', totalBaseIngresos],
    ['IVA/IGIC repercutido', totalIvaRep],
    ['IRPF retenido (emitidas)', totalRetIRPF],
    ['Total cobrado / pendiente', totalIngresos],
    [],
    ['── GASTOS ──', ''],
    ['Base imponible compras + gastos', totalBaseGastos],
    ['IVA/IGIC soportado deducible', totalIvaSop],
    ['Total pagado / pendiente', totalGastos],
    [],
    ['── P&L (SIN IMPUESTOS) ──', ''],
    ['Beneficio estimado (base)', beneficio],
    ['Margen sobre ingresos', margen],
    [],
    ['── LIQUIDACIÓN IVA/IGIC ESTIMADA ──', ''],
    ['IVA/IGIC a liquidar (repercutido − soportado)', ivaLiquidar],
    [],
    ['── VOLUMEN OPERACIONES ──', ''],
    ['Nº facturas emitidas', emitidas.length],
    ['Nº facturas recibidas', recibidas.length],
    ['Nº gastos registrados', gastos.length],
    [],
    ['Generado por Taxea Portal', new Date().toLocaleDateString('es-ES')],
    [],
    ['── CONTROL DE EXPORTACIÓN ──', ''],
    lastExportDate
      ? ['Última descarga', new Date(lastExportDate).toLocaleString('es-ES')]
      : ['Primera exportación', new Date().toLocaleString('es-ES')],
    ['Facturas emitidas nuevas (verde)', lastExportDate ? newEmitted : 0],
    ['Facturas recibidas nuevas (verde)', lastExportDate ? newReceived : 0],
    ['Gastos nuevos (verde)', lastExportDate ? newExpenses : 0],
  ];
  return rows;
}

// ─── Hoja 2: P&L mensual ────────────────────────────────────────────────────
function buildPnL(invoices, expenses, year) {
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const emitidas = invoices.filter(i => i.tipo === 'emitida');
  const gastos = expenses.filter(e => e.tipo === 'gasto');
  const recibidas = invoices.filter(i => i.tipo === 'recibida');

  const header = ['Mes', 'Ingresos Base (€)', 'Gastos Base (€)', 'Beneficio Estimado (€)', 'Margen %', 'IVA Repercutido (€)', 'IVA Soportado (€)', 'Resultado IVA (€)'];
  const rows = [header];

  let totIng = 0, totGas = 0, totIvaR = 0, totIvaS = 0;
  for (let m = 0; m < 12; m++) {
    const ing = emitidas.filter(i => new Date(i.fecha_emision || '').getMonth() === m).reduce((s, i) => s + n(i.base_imponible), 0);
    const gas = [...gastos, ...recibidas].filter(e => new Date(e.fecha || e.fecha_emision || '').getMonth() === m).reduce((s, e) => s + n(e.base_imponible), 0);
    const ivaR = emitidas.filter(i => new Date(i.fecha_emision || '').getMonth() === m).reduce((s, i) => s + n(i.cuota_iva), 0);
    const ivaS = [...gastos, ...recibidas].filter(e => new Date(e.fecha || e.fecha_emision || '').getMonth() === m).reduce((s, e) => s + n(e.cuota_impuesto || e.cuota_iva), 0);
    const ben = ing - gas;
    const mar = ing > 0 ? parseFloat((ben / ing * 100).toFixed(2)) : 0;
    rows.push([MONTHS[m], ing, gas, ben, mar, ivaR, ivaS, ivaR - ivaS]);
    totIng += ing; totGas += gas; totIvaR += ivaR; totIvaS += ivaS;
  }
  const totBen = totIng - totGas;
  rows.push(['TOTAL', totIng, totGas, totBen, totIng > 0 ? parseFloat((totBen / totIng * 100).toFixed(2)) : 0, totIvaR, totIvaS, totIvaR - totIvaS]);
  return rows;
}

// ─── Account mapping helpers ─────────────────────────────────────────────────
function ctaIngreso(inv) { return inv.revenue_expense_account_code || ''; }
function ctaGasto(inv) { return inv.revenue_expense_account_code || ''; }

// ─── Hoja 3: Facturas Emitidas ───────────────────────────────────────────────
function buildFacturasEmitidas(invoices) {
  const header = ['Nº Factura','Fecha Emisión','Fecha Operación','Fecha Vencimiento','Cliente','NIF/CIF Cliente','Concepto','Base Imponible (€)','Tipo IVA/IGIC %','Cuota IVA/IGIC (€)','Retención IRPF %','Importe Retención (€)','Total Factura (€)','Estado Cobro','Estado Contable','Trimestre','Año','Cta. Ingreso','Cta. Cliente (430)'];
  const rows = [header];
  invoices.filter(i => i.tipo === 'emitida').forEach(i => {
    rows.push([
      i.numero_factura || '', i.fecha_emision || '', i.fecha_operacion || i.fecha_emision || '', i.fecha_vencimiento || '',
      i.cliente_nombre || '', i.cliente_nif || '', i.concepto || '',
      n(i.base_imponible), n(i.tipo_iva), n(i.cuota_iva),
      n(i.retencion_irpf), pct(i.base_imponible, i.retencion_irpf),
      n(i.total_factura),
      i.estado_cobro || '', i.estado_contable || '',
      i.trimestre || quarter(i.fecha_emision), i.anio || new Date(i.fecha_emision || '').getFullYear() || '',
      ctaIngreso(i), i.counterparty_account_code || '',
    ]);
  });
  return rows;
}

// ─── Hoja 4: Facturas Recibidas ──────────────────────────────────────────────
function buildFacturasRecibidas(invoices) {
  const header = ['Nº Factura','Fecha Emisión','Fecha Operación','Proveedor','NIF/CIF Proveedor','Concepto','Categoría','Base Imponible (€)','Tipo IVA/IGIC %','Cuota IVA/IGIC (€)','Retención IRPF %','Importe Retención (€)','Total Factura (€)','Estado Contable','Trimestre','Año','Cta. Gasto (6xx)','Cta. Proveedor (40x/41x)'];
  const rows = [header];
  invoices.filter(i => i.tipo === 'recibida').forEach(i => {
    const provNombre = i.proveedor_nombre || i.cliente_nombre || '';
    const provNif = i.proveedor_nif || i.cliente_nif || '';
    rows.push([
      i.numero_factura || '', i.fecha_emision || '', i.fecha_operacion || i.fecha_emision || '',
      provNombre, provNif, i.concepto || '', i.categoria_gasto || '',
      n(i.base_imponible), n(i.tipo_iva), n(i.cuota_iva),
      n(i.retencion_irpf), pct(i.base_imponible, i.retencion_irpf || 0),
      n(i.total_factura),
      i.estado_contable || '',
      i.trimestre || quarter(i.fecha_emision), i.anio || '',
      ctaGasto(i), i.counterparty_account_code || '',
    ]);
  });
  return rows;
}

// ─── Hoja 5: Libro Ventas (AEAT 303) ────────────────────────────────────────
function buildLibroVentas(invoices) {
  const header = ['Fecha Expedición','Nº Factura','Serie','Nombre/Razón Social','NIF/CIF','Concepto','Base Imponible (€)','Tipo IVA/IGIC %','Cuota IVA/IGIC (€)','Tipo IRPF %','Cuota IRPF (€)','Total (€)','Trimestre','Año','Impuesto','Régimen','Tratamiento','Fundamento legal'];
  const rows = [header];
  invoices.filter(i => i.tipo === 'emitida').forEach(i => {
    rows.push([
      i.fecha_emision || '', i.numero_factura || '', '',
      i.cliente_nombre || '', i.cliente_nif || '', i.concepto || '',
      n(i.base_imponible), n(i.tipo_iva), n(i.cuota_iva),
      n(i.retencion_irpf), pct(i.base_imponible, i.retencion_irpf),
      n(i.total_factura),
      i.trimestre || quarter(i.fecha_emision), i.anio || '',
      i.indirect_tax_kind || '', i.fiscal_regime || '', i.fiscal_treatment || '', i.fiscal_legal_basis || '',
    ]);
  });
  return rows;
}

// ─── Hoja 6: Libro Compras y Gastos (AEAT 303) ──────────────────────────────
function buildLibroCompras(invoices, expenses) {
  const header = ['Fecha','Nº Factura','Proveedor','NIF/CIF','Concepto','Categoría','Base Imponible (€)','Tipo IVA/IGIC %','Cuota Soportada (€)','Cuota Deducible (€)','Cuota No Deducible (€)','Retención IRPF %','Importe Retención (€)','Total (€)','Deducible','Régimen','Tratamiento','Trimestre','Año','Cuenta Contable'];
  const rows = [header];
  invoices.filter(i => i.tipo === 'recibida').forEach(i => {
    rows.push([
      i.fecha_emision || '', i.numero_factura || '',
      i.proveedor_nombre || '', i.proveedor_nif || '', i.concepto || '', i.categoria_gasto || '',
      n(i.base_imponible), n(i.tipo_iva), n(i.cuota_iva),
      i.deductible_tax_amount == null ? '' : n(i.deductible_tax_amount),
      i.non_deductible_tax_amount == null ? '' : n(i.non_deductible_tax_amount),
      n(i.retencion_irpf), pct(i.base_imponible, i.retencion_irpf || 0),
      n(i.total_factura),
      i.deductible_tax_amount == null ? 'Sin validar' : n(i.deductible_tax_amount) === 0 ? 'No' : 'Sí',
      i.fiscal_regime || '', i.fiscal_treatment || '',
      i.trimestre || quarter(i.fecha_emision), i.anio || '', ctaGasto(i),
    ]);
  });
  expenses.filter(e => e.tipo === 'gasto').forEach(e => {
    rows.push([
      e.fecha || '', '',
      e.proveedor_cliente || '', '', e.concepto || '', e.categoria || '',
      n(e.base_imponible), n(e.tipo_impuesto), n(e.cuota_impuesto),
      '', '', n(e.retencion_irpf), pct(e.base_imponible, e.retencion_irpf || 0),
      n(e.total), 'Sin validar', '', '', e.trimestre || quarter(e.fecha), e.anio || '', '',
    ]);
  });
  return rows;
}

// ─── Hojas 7 y 8: asientos y saldos confirmados del motor contable ─────────
function buildLibroDiario(entries) {
  const rows = [['Fecha','Nº Asiento','Cuenta','Descripción Cuenta','Concepto','Debe (€)','Haber (€)','Contrapartida','Documento Ref.','NIF/CIF','Trimestre','Año']];
  for (const entry of entries) {
    for (const line of entry.lines || []) rows.push([
      line.entryDate || entry.date || '', entry.entryNumber || '',
      line.accountCode || line.subcuenta || '', line.accountName || '',
      line.description || entry.description || '', n(line.debit ?? line.debeE), n(line.credit ?? line.haberE),
      line.counterpartyAccountCode || '', line.documentId || entry.documentId || '',
      '', quarter(entry.date), Number(String(entry.date || '').slice(0, 4)) || '',
    ]);
  }
  return rows;
}

function buildLibroMayor(accounts) {
  return [
    ['Cuenta', 'Descripción', 'Debe Acumulado (€)', 'Haber Acumulado (€)', 'Saldo (€)'],
    ...accounts.map(account => [account.code, account.name || '', n(account.debit), n(account.credit), n(account.balance)]),
  ];
}

// ─── Hoja 9: Resumen IVA/IGIC ────────────────────────────────────────────────
function buildResumenIVA(invoices, expenses) {
  const header = ['Trimestre','Periodo','Base Imponible Ventas (€)','IVA/IGIC Repercutido (€)','Base Imponible Compras (€)','IVA/IGIC Soportado (€)','Resultado a Liquidar (€)'];
  const rows = [header];
  const periodos = { T1: 'Ene-Mar', T2: 'Abr-Jun', T3: 'Jul-Sep', T4: 'Oct-Dic' };
  let totRep = 0, totSop = 0, totBaseV = 0, totBaseC = 0;
  ['T1','T2','T3','T4'].forEach(t => {
    const rep = invoices.filter(i => i.tipo === 'emitida' && (i.trimestre === t)).reduce((s, i) => s + n(i.cuota_iva), 0);
    const baseV = invoices.filter(i => i.tipo === 'emitida' && i.trimestre === t).reduce((s, i) => s + n(i.base_imponible), 0);
    const sop = invoices.filter(i => i.tipo === 'recibida' && i.trimestre === t).reduce((s, i) => s + n(i.cuota_iva), 0)
      + expenses.filter(e => e.trimestre === t).reduce((s, e) => s + n(e.cuota_impuesto), 0);
    const baseC = invoices.filter(i => i.tipo === 'recibida' && i.trimestre === t).reduce((s, i) => s + n(i.base_imponible), 0)
      + expenses.filter(e => e.trimestre === t).reduce((s, e) => s + n(e.base_imponible), 0);
    rows.push([t, periodos[t], baseV, rep, baseC, sop, rep - sop]);
    totRep += rep; totSop += sop; totBaseV += baseV; totBaseC += baseC;
  });
  rows.push(['ANUAL', 'Total', totBaseV, totRep, totBaseC, totSop, totRep - totSop]);
  return rows;
}

// ─── Hoja 10: Resumen IRPF ──────────────────────────────────────────────────
function buildResumenIRPF(invoices) {
  const header = ['Trimestre','Periodo','Base Retenciones (€)','Tipo Retención %','IRPF Retenido (€)','Modelo Trimestral','Fecha Límite Presentación'];
  const rows = [header];
  const periodos = { T1: 'Ene-Mar', T2: 'Abr-Jun', T3: 'Jul-Sep', T4: 'Oct-Dic' };
  const limites = { T1: '20/04', T2: '20/07', T3: '20/10', T4: '30/01' };
  ['T1','T2','T3','T4'].forEach(t => {
    const emit = invoices.filter(i => i.tipo === 'emitida' && i.trimestre === t && n(i.retencion_irpf) > 0);
    const base = emit.reduce((s, i) => s + n(i.base_imponible), 0);
    const ret = emit.reduce((s, i) => s + pct(i.base_imponible, i.retencion_irpf), 0);
    rows.push([t, periodos[t], base, emit[0] ? n(emit[0].retencion_irpf) : 15, ret, 'Mod. 130/111', limites[t]]);
  });
  return rows;
}

// ─── Hoja 11: movimientos de caja y bancos confirmados ───────────────────
function buildCajaBancos(entries) {
  const rows = [['Fecha','Concepto','Cuenta','Tipo','Importe (€)','Saldo Acumulado (€)','Referencia','Trimestre']];
  const balances = new Map();
  const movements = entries.flatMap(entry => (entry.lines || [])
    .filter(line => /^57/.test(String(line.accountCode || line.subcuenta || '')))
    .map(line => ({ entry, line })))
    .sort((a, b) => String(a.entry.date || '').localeCompare(String(b.entry.date || '')) || String(a.entry.entryNumber || '').localeCompare(String(b.entry.entryNumber || '')));
  for (const { entry, line } of movements) {
    const code = String(line.accountCode || line.subcuenta);
    const amount = n(line.debit ?? line.debeE) - n(line.credit ?? line.haberE);
    const balance = Math.round(((balances.get(code) || 0) + amount) * 100) / 100;
    balances.set(code, balance);
    rows.push([entry.date || '', line.description || entry.description || '', code,
      amount >= 0 ? 'Entrada' : 'Salida', amount, balance,
      line.documentId || entry.documentId || '', quarter(entry.date)]);
  }
  return rows;
}

// Solo se exporta el diario confirmado que devuelve Contabilidad; nunca se simulan asientos.
async function loadRealAccounting(companyId, year) {
  if (!companyId) throw new Error('Falta la empresa para obtener el Diario y Mayor reales.');
  const { base44 } = await import('@/api/base44Client');
  const invoke = async body => {
    const response = await base44.functions.invoke('accountingOperations', { companyId, year, ...body });
    const data = response?.data || response;
    if (!data?.success) throw new Error(data?.error || 'No se pudo consultar Contabilidad.');
    return data;
  };
  const reports = await invoke({ action: 'reports', scope: 'confirmed' });
  const accounts = reports.report?.accounts || [];
  const entries = [];
  let page = 1;
  while (page <= 1000) {
    const result = await invoke({ action: 'journal', status: 'confirmado', page, pageSize: 200 });
    const journal = result.journal || {};
    entries.push(...(journal.entries || []));
    if (entries.length >= Number(journal.total || 0)) break;
    if (!(journal.entries || []).length) throw new Error('El Diario devolvió una página vacía antes de completar el ejercicio.');
    page++;
  }
  if (page > 1000) throw new Error('El Diario supera el límite de exportación seguro.');
  if (entries.some(entry => entry.isBalanced === false)) throw new Error('Hay asientos confirmados descuadrados; revisa Contabilidad antes de exportar.');
  return { entries, accounts };
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────
export async function exportarLibros({ invoices: rawInvoices, expenses: rawExpenses, companyId, year, companyName = 'Empresa', newInvoiceIds, newExpenseIds, lastExportDate, onlyNew = false }) {
  // Filtrar facturas y gastos anulados — única fuente de datos activos
  const invoices = (rawInvoices || []).filter(i => !i.anulada);
  const expenses = (rawExpenses || []).filter(e => !e.anulada);
  const newInvIds = newInvoiceIds || new Set();
  const newExpIds = newExpenseIds || new Set();
  const accounting = onlyNew ? { entries: [], accounts: [] } : await loadRealAccounting(companyId, year);
  return new Promise(resolve => {
    setTimeout(() => {
      const emitidas = invoices.filter(i => i.tipo === 'emitida');
      const recibidas = invoices.filter(i => i.tipo === 'recibida');
      const gastos = expenses.filter(e => e.tipo === 'gasto');
      const newEmitidaIdx = emitidas.map((inv, idx) => newInvIds.has(inv.id) ? idx : -1).filter(i => i >= 0);
      const newRecibidaIdx = recibidas.map((inv, idx) => newInvIds.has(inv.id) ? idx : -1).filter(i => i >= 0);
      const newComprasIdx = [
        ...recibidas.map((inv, idx) => newInvIds.has(inv.id) ? idx : -1).filter(i => i >= 0),
        ...gastos.map((exp, idx) => newExpIds.has(exp.id) ? idx + recibidas.length : -1).filter(i => i >= 0),
      ];
      const newGastosCount = gastos.filter(e => newExpIds.has(e.id)).length;

      const sheets = [
        { name: '1. Resumen Fiscal', rows: buildResumenFiscal(invoices, expenses, year, companyName, lastExportDate, newEmitidaIdx.length, newRecibidaIdx.length, newGastosCount), colWidths: [40, 20], newRowIndices: [] },
        { name: '2. P&L', rows: buildPnL(invoices, expenses, year), colWidths: [16, 20, 20, 22, 12, 20, 20, 20], newRowIndices: [] },
        { name: '3. Facturas Emitidas', rows: buildFacturasEmitidas(invoices), colWidths: [14, 14, 14, 14, 24, 16, 28, 12, 10, 12, 10, 12, 14, 14, 16, 10, 8, 14, 14], newRowIndices: newEmitidaIdx },
        { name: '4. Facturas Recibidas', rows: buildFacturasRecibidas(invoices), colWidths: [14, 14, 14, 24, 16, 28, 20, 14, 10, 12, 10, 12, 14, 16, 10, 8, 14, 16], newRowIndices: newRecibidaIdx },
        { name: '5. Libro Ventas', rows: buildLibroVentas(invoices), colWidths: [14, 14, 8, 24, 16, 28, 16, 10, 14, 10, 14, 14, 10, 8, 10, 18, 18, 36], newRowIndices: newEmitidaIdx },
        { name: '6. Libro Compras', rows: buildLibroCompras(invoices, expenses), colWidths: [14, 14, 24, 16, 28, 20, 16, 12, 14, 14, 14, 10, 14, 14, 12, 18, 18, 10, 8, 16], newRowIndices: newComprasIdx },
        ...(!onlyNew ? [
          { name: '7. Libro Diario', rows: buildLibroDiario(accounting.entries), colWidths: [14, 10, 10, 26, 28, 14, 14, 12, 14, 14, 10, 8], newRowIndices: [] },
          { name: '8. Libro Mayor', rows: buildLibroMayor(accounting.accounts), colWidths: [12, 28, 20, 20, 18], newRowIndices: [] },
        ] : []),
        { name: '9. Resumen IVA-IGIC', rows: buildResumenIVA(invoices, expenses), colWidths: [12, 14, 22, 22, 22, 22, 22], newRowIndices: [] },
        { name: '10. Resumen IRPF', rows: buildResumenIRPF(invoices), colWidths: [12, 14, 22, 16, 20, 20, 24], newRowIndices: [] },
        ...(!onlyNew ? [{ name: '11. Caja y Bancos', rows: buildCajaBancos(accounting.entries), colWidths: [14, 42, 16, 10, 14, 16, 16, 10], newRowIndices: [] }] : []),
      ];

      const safeName = companyName.replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]/g, '_').substring(0, 30);
      const filename = `Taxea_Libros_${safeName}_${year}.xls`;
      downloadSpreadsheetML(sheets, filename);
      resolve();
    }, 50);
  });
}
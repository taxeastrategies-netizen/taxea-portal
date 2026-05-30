import * as XLSX from 'xlsx';

// ─── Helpers ────────────────────────────────────────────────────────────────
const n = v => parseFloat(v) || 0;
const pct = (base, tipo) => n(base) * n(tipo) / 100;

function quarter(fecha) {
  const m = new Date(fecha || '').getMonth();
  if (isNaN(m)) return '';
  return m < 3 ? 'T1' : m < 6 ? 'T2' : m < 9 ? 'T3' : 'T4';
}

function addSheet(wb, name, rows, colWidths) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = colWidths.map(w => ({ wch: w }));
  // Auto-filter on header row
  if (rows.length > 1) {
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: rows[0].length - 1 } }) };
  }
  XLSX.utils.book_append_sheet(wb, ws, name);
}

// ─── Hoja 1: Resumen Fiscal ──────────────────────────────────────────────────
function buildResumenFiscal(invoices, expenses, year, companyName) {
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
const GASTO_CUENTAS_8 = {
  ventas_servicios: '70000000', compras: '60000000', suministros: '62800000',
  alquiler: '62100000', publicidad_marketing: '62700000',
  servicios_profesionales: '62300000', software: '62800000',
  transporte: '62400000', dietas: '62500000', gastos_financieros: '66900000',
  seguros: '62500000', otros: '62900000',
};
function ctaIngreso8(inv) { return n(inv.tipo_iva) === 0 ? '70500000' : '70000000'; }
function ctaGasto8(inv) { return GASTO_CUENTAS_8[inv.categoria_gasto] || '60000000'; }
function buildClienteMap(invoices) {
  const map = {}; let c = 1;
  invoices.filter(i => i.tipo === 'emitida').forEach(i => {
    const k = i.cliente_nif ? i.cliente_nif.toUpperCase() : (i.cliente_nombre || '').toLowerCase();
    if (k && !map[k]) map[k] = `4300${String(c++).padStart(4, '0')}`;
  });
  return map;
}
function buildProveedorMap(invoices) {
  const map = {}; let c = 1;
  invoices.filter(i => i.tipo === 'recibida').forEach(i => {
    const k = i.proveedor_nif ? i.proveedor_nif.toUpperCase() : (i.proveedor_nombre || i.cliente_nombre || '').toLowerCase();
    if (k && !map[k]) map[k] = `4100${String(c++).padStart(4, '0')}`;
  });
  return map;
}

// ─── Hoja 3: Facturas Emitidas ───────────────────────────────────────────────
function buildFacturasEmitidas(invoices) {
  const clienteMap = buildClienteMap(invoices);
  const header = ['Nº Factura','Fecha Emisión','Fecha Operación','Fecha Vencimiento','Cliente','NIF/CIF Cliente','Concepto','Base Imponible (€)','Tipo IVA/IGIC %','Cuota IVA/IGIC (€)','Retención IRPF %','Importe Retención (€)','Total Factura (€)','Estado Cobro','Estado Contable','Trimestre','Año','Cta. Ingreso','Cta. Cliente (430)'];
  const rows = [header];
  invoices.filter(i => i.tipo === 'emitida').forEach(i => {
    const key = i.cliente_nif ? i.cliente_nif.toUpperCase() : (i.cliente_nombre || '').toLowerCase();
    rows.push([
      i.numero_factura || '', i.fecha_emision || '', i.fecha_operacion || i.fecha_emision || '', i.fecha_vencimiento || '',
      i.cliente_nombre || '', i.cliente_nif || '', i.concepto || '',
      n(i.base_imponible), n(i.tipo_iva) || 21, n(i.cuota_iva),
      n(i.retencion_irpf), pct(i.base_imponible, i.retencion_irpf),
      n(i.total_factura),
      i.estado_cobro || '', i.estado_contable || '',
      i.trimestre || quarter(i.fecha_emision), i.anio || new Date(i.fecha_emision || '').getFullYear() || '',
      ctaIngreso8(i), clienteMap[key] || '43000000',
    ]);
  });
  return rows;
}

// ─── Hoja 4: Facturas Recibidas ──────────────────────────────────────────────
function buildFacturasRecibidas(invoices) {
  const proveedorMap = buildProveedorMap(invoices);
  const header = ['Nº Factura','Fecha Emisión','Fecha Operación','Proveedor','NIF/CIF Proveedor','Concepto','Categoría','Base Imponible (€)','Tipo IVA/IGIC %','Cuota IVA/IGIC (€)','Retenciones (€)','Total Factura (€)','Estado Contable','Trimestre','Año','Cta. Gasto (6xx)','Cta. Proveedor (40x/41x)'];
  const rows = [header];
  invoices.filter(i => i.tipo === 'recibida').forEach(i => {
    const provNombre = i.proveedor_nombre || i.cliente_nombre || '';
    const provNif = i.proveedor_nif || i.cliente_nif || '';
    const key = provNif ? provNif.toUpperCase() : provNombre.toLowerCase();
    rows.push([
      i.numero_factura || '', i.fecha_emision || '', i.fecha_operacion || i.fecha_emision || '',
      provNombre, provNif, i.concepto || '', i.categoria_gasto || '',
      n(i.base_imponible), n(i.tipo_iva) || 21, n(i.cuota_iva),
      pct(i.base_imponible, i.retencion_irpf || 0),
      n(i.total_factura),
      i.estado_contable || '',
      i.trimestre || quarter(i.fecha_emision), i.anio || '',
      ctaGasto8(i), proveedorMap[key] || '41000000',
    ]);
  });
  return rows;
}

// ─── Hoja 5: Libro Ventas (AEAT 303) ────────────────────────────────────────
function buildLibroVentas(invoices) {
  const header = ['Fecha Expedición','Nº Factura','Serie','Nombre/Razón Social','NIF/CIF','Concepto','Base Imponible (€)','Tipo IVA %','Cuota IVA (€)','Tipo IRPF %','Cuota IRPF (€)','Total (€)','Trimestre','Año'];
  const rows = [header];
  invoices.filter(i => i.tipo === 'emitida').forEach(i => {
    rows.push([
      i.fecha_emision || '', i.numero_factura || '', '',
      i.cliente_nombre || '', i.cliente_nif || '', i.concepto || '',
      n(i.base_imponible), n(i.tipo_iva) || 21, n(i.cuota_iva),
      n(i.retencion_irpf), pct(i.base_imponible, i.retencion_irpf),
      n(i.total_factura),
      i.trimestre || quarter(i.fecha_emision), i.anio || '',
    ]);
  });
  return rows;
}

// ─── Hoja 6: Libro Compras y Gastos (AEAT 303) ──────────────────────────────
function buildLibroCompras(invoices, expenses) {
  const header = ['Fecha','Nº Factura','Proveedor','NIF/CIF','Concepto','Categoría','Base Imponible (€)','Tipo IVA %','Cuota IVA (€)','Total (€)','Deducible','Trimestre','Año','Cuenta Contable'];
  const rows = [header];
  invoices.filter(i => i.tipo === 'recibida').forEach(i => {
    rows.push([
      i.fecha_emision || '', i.numero_factura || '',
      i.cliente_nombre || '', i.cliente_nif || '', i.concepto || '', 'Factura recibida',
      n(i.base_imponible), n(i.tipo_iva) || 21, n(i.cuota_iva), n(i.total_factura),
      'Sí', i.trimestre || quarter(i.fecha_emision), i.anio || '', '600000',
    ]);
  });
  expenses.filter(e => e.tipo === 'gasto').forEach(e => {
    rows.push([
      e.fecha || '', '',
      e.proveedor_cliente || '', '', e.concepto || '', e.categoria || '',
      n(e.base_imponible), n(e.tipo_impuesto), n(e.cuota_impuesto), n(e.total),
      'Sí', e.trimestre || quarter(e.fecha), e.anio || '', '600000',
    ]);
  });
  return rows;
}

// ─── Hoja 7: Libro Diario ────────────────────────────────────────────────────
function buildLibroDiario(invoices, expenses) {
  const header = ['Fecha','Nº Asiento','Cuenta','Descripción Cuenta','Concepto','Debe (€)','Haber (€)','Contrapartida','Documento Ref.','NIF/CIF','Trimestre','Año'];
  const rows = [header];
  let asiento = 1;

  invoices.filter(i => i.tipo === 'emitida').forEach(i => {
    const base = n(i.base_imponible);
    const iva = n(i.cuota_iva);
    const ret = pct(i.base_imponible, i.retencion_irpf);
    const total = n(i.total_factura);
    const q = i.trimestre || quarter(i.fecha_emision);
    const yr = i.anio || '';
    // Clientes
    rows.push([i.fecha_emision || '', asiento, '4300000', 'Clientes', i.concepto || '', total, '', '700000', i.numero_factura || '', i.cliente_nif || '', q, yr]);
    // Ventas
    rows.push([i.fecha_emision || '', asiento, '700000', 'Ventas de servicios', i.concepto || '', '', base, '4300000', i.numero_factura || '', '', q, yr]);
    // IVA repercutido
    if (iva > 0) rows.push([i.fecha_emision || '', asiento, '4770000', 'H.P. IVA repercutido', 'IVA ' + (n(i.tipo_iva) || 21) + '%', '', iva, '4300000', i.numero_factura || '', '', q, yr]);
    // IRPF
    if (ret > 0) rows.push([i.fecha_emision || '', asiento, '4751000', 'H.P. IRPF retenido', 'Retención ' + n(i.retencion_irpf) + '%', ret, '', '4300000', i.numero_factura || '', '', q, yr]);
    asiento++;
  });

  expenses.filter(e => e.tipo === 'gasto').forEach(e => {
    const base = n(e.base_imponible);
    const iva = n(e.cuota_impuesto);
    const total = n(e.total);
    const q = e.trimestre || quarter(e.fecha);
    const yr = e.anio || '';
    rows.push([e.fecha || '', asiento, '600000', 'Compras y gastos', e.concepto || '', base, '', '4000000', '', '', q, yr]);
    if (iva > 0) rows.push([e.fecha || '', asiento, '4720000', 'H.P. IVA soportado', 'IVA ' + n(e.tipo_impuesto) + '%', iva, '', '4000000', '', '', q, yr]);
    rows.push([e.fecha || '', asiento, '4000000', 'Proveedores', e.proveedor_cliente || '', '', total, '600000', '', '', q, yr]);
    asiento++;
  });

  return rows;
}

// ─── Hoja 8: Libro Mayor (simplificado) ─────────────────────────────────────
function buildLibroMayor(invoices, expenses) {
  const cuentas = {};
  const addCuenta = (cuenta, descripcion, debe, haber) => {
    if (!cuentas[cuenta]) cuentas[cuenta] = { descripcion, debe: 0, haber: 0 };
    cuentas[cuenta].debe += n(debe);
    cuentas[cuenta].haber += n(haber);
  };

  invoices.filter(i => i.tipo === 'emitida').forEach(i => {
    addCuenta('4300000', 'Clientes', n(i.total_factura), 0);
    addCuenta('700000', 'Ventas de servicios', 0, n(i.base_imponible));
    addCuenta('4770000', 'H.P. IVA repercutido', 0, n(i.cuota_iva));
    if (n(i.retencion_irpf) > 0) addCuenta('4751000', 'H.P. IRPF retenido', pct(i.base_imponible, i.retencion_irpf), 0);
  });
  expenses.filter(e => e.tipo === 'gasto').forEach(e => {
    addCuenta('600000', 'Compras y gastos', n(e.base_imponible), 0);
    addCuenta('4720000', 'H.P. IVA soportado', n(e.cuota_impuesto), 0);
    addCuenta('4000000', 'Proveedores', 0, n(e.total));
  });

  const header = ['Cuenta', 'Descripción', 'Debe Acumulado (€)', 'Haber Acumulado (€)', 'Saldo (€)'];
  const rows = [header];
  Object.entries(cuentas).sort((a, b) => a[0].localeCompare(b[0])).forEach(([cuenta, { descripcion, debe, haber }]) => {
    rows.push([cuenta, descripcion, debe, haber, debe - haber]);
  });
  return rows;
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

// ─── Hoja 11: Caja y Bancos (placeholder) ───────────────────────────────────
function buildCajaBancos(invoices, expenses) {
  const header = ['Fecha','Concepto','Entidad','Tipo','Importe (€)','Saldo Acumulado (€)','Referencia','Trimestre'];
  const rows = [header];
  const movimientos = [
    ...invoices.filter(i => i.tipo === 'emitida' && i.estado_cobro === 'cobrada').map(i => ({
      fecha: i.fecha_emision || '', concepto: `Cobro: ${i.numero_factura || ''} — ${i.cliente_nombre || ''}`,
      tipo: 'Cobro', importe: n(i.total_factura), ref: i.numero_factura || '', trimestre: i.trimestre || '',
    })),
    ...expenses.filter(e => e.tipo === 'gasto').map(e => ({
      fecha: e.fecha || '', concepto: `Pago: ${e.concepto || ''} — ${e.proveedor_cliente || ''}`,
      tipo: 'Pago', importe: -n(e.total), ref: '', trimestre: e.trimestre || '',
    })),
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  let saldo = 0;
  movimientos.forEach(m => {
    saldo += m.importe;
    rows.push([m.fecha, m.concepto, '', m.tipo, m.importe, saldo, m.ref, m.trimestre]);
  });
  return rows;
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────
export async function exportarLibros({ invoices, expenses, year, companyName = 'Empresa' }) {
  return new Promise(resolve => {
    setTimeout(() => {
      const wb = XLSX.utils.book_new();

      // 1. Resumen Fiscal
      const resumenRows = buildResumenFiscal(invoices, expenses, year, companyName);
      addSheet(wb, '1. Resumen Fiscal', resumenRows, [40, 20]);

      // 2. P&L
      addSheet(wb, '2. P&L', buildPnL(invoices, expenses, year), [16, 20, 20, 22, 12, 20, 20, 20]);

      // 3. Facturas Emitidas
      addSheet(wb, '3. Facturas Emitidas', buildFacturasEmitidas(invoices), [14, 14, 14, 14, 24, 16, 28, 12, 10, 12, 10, 12, 14, 14, 16, 10, 8, 14, 14]);

      // 4. Facturas Recibidas
      addSheet(wb, '4. Facturas Recibidas', buildFacturasRecibidas(invoices), [14, 14, 14, 24, 16, 28, 20, 14, 10, 12, 12, 14, 16, 10, 8, 14, 16]);

      // 5. Libro Ventas
      addSheet(wb, '5. Libro Ventas', buildLibroVentas(invoices), [14, 14, 8, 24, 16, 28, 16, 10, 14, 10, 14, 14, 10, 8]);

      // 6. Libro Compras
      addSheet(wb, '6. Libro Compras', buildLibroCompras(invoices, expenses), [14, 14, 24, 16, 28, 20, 16, 10, 14, 14, 10, 10, 8, 12]);

      // 7. Libro Diario
      addSheet(wb, '7. Libro Diario', buildLibroDiario(invoices, expenses), [14, 10, 10, 26, 28, 14, 14, 12, 14, 14, 10, 8]);

      // 8. Libro Mayor
      addSheet(wb, '8. Libro Mayor', buildLibroMayor(invoices, expenses), [12, 28, 20, 20, 18]);

      // 9. Resumen IVA/IGIC
      addSheet(wb, '9. Resumen IVA-IGIC', buildResumenIVA(invoices, expenses), [12, 14, 22, 22, 22, 22, 22]);

      // 10. Resumen IRPF
      addSheet(wb, '10. Resumen IRPF', buildResumenIRPF(invoices), [12, 14, 22, 16, 20, 20, 24]);

      // 11. Caja y Bancos
      addSheet(wb, '11. Caja y Bancos', buildCajaBancos(invoices, expenses), [14, 42, 16, 10, 14, 16, 16, 10]);

      // Nombre del archivo
      const safeName = companyName.replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]/g, '_').substring(0, 30);
      const filename = `Taxea_Libros_${safeName}_${year}.xlsx`;

      XLSX.writeFile(wb, filename);
      resolve();
    }, 50);
  });
}
// Exportador CSV multi-libro compatible AEAT / A3Innuva

function fmt(n) {
  return (parseFloat(n) || 0).toFixed(2).replace('.', ',');
}
function esc(v) {
  const s = String(v ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function row(cells) { return cells.map(esc).join(';') + '\n'; }

function buildLibroVentas(invoices) {
  const headers = ['Fecha Expedición','Fecha Operación','Nº Factura','Serie','Cliente','NIF/CIF','Concepto','Base Imponible','Tipo IVA/IGIC %','Cuota','Retención %','Importe Retención','Total','Forma Pago','Trimestre','Año','Cuenta Contable','Estado'];
  let csv = row(headers);
  invoices.filter(i => i.tipo === 'emitida').forEach(i => {
    const retImporte = (i.base_imponible || 0) * (i.retencion_irpf || 0) / 100;
    csv += row([
      i.fecha_emision || '', i.fecha_emision || '',
      i.numero_factura || '', '',
      i.cliente_nombre || '', i.cliente_nif || '',
      i.concepto || '',
      fmt(i.base_imponible), fmt(i.tipo_iva ?? 0),
      fmt(i.cuota_iva), fmt(i.retencion_irpf ?? 0), fmt(retImporte),
      fmt(i.total_factura),
      i.forma_pago || '', i.trimestre || '', i.anio || '',
      '700000', i.estado_contable || '',
    ]);
  });
  return csv;
}

function buildLibroCompras(invoices, expenses) {
  const headers = ['Fecha','Proveedor','NIF/CIF','Nº Factura','Concepto','Base Imponible','Tipo IVA/IGIC %','Cuota Deducible','Retención %','Total','Deducible','Categoría','Cuenta Contable','Trimestre','Año','Estado'];
  let csv = row(headers);
  invoices.filter(i => i.tipo === 'recibida').forEach(i => {
    csv += row([
      i.fecha_emision || '', i.cliente_nombre || '', i.cliente_nif || '',
      i.numero_factura || '', i.concepto || '',
      fmt(i.base_imponible), fmt(i.tipo_iva ?? 0), fmt(i.cuota_iva),
      fmt(i.retencion_irpf ?? 0), fmt(i.total_factura),
      'Sí', 'servicios_profesionales', '600000',
      i.trimestre || '', i.anio || '', i.estado_contable || '',
    ]);
  });
  expenses.filter(e => e.tipo === 'gasto').forEach(e => {
    csv += row([
      e.fecha || '', e.proveedor_cliente || '', '',
      '', e.concepto || '',
      fmt(e.base_imponible), fmt(e.tipo_impuesto ?? 0), fmt(e.cuota_impuesto),
      '0', fmt(e.total),
      'Sí', e.categoria || '', '600000',
      e.trimestre || '', e.anio || '', e.estado || '',
    ]);
  });
  return csv;
}

function buildResumenPnL(invoices, expenses) {
  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const headers = ['Mes','Ingresos (base)','Gastos (base)','Beneficio estimado','Margen %'];
  let csv = row(headers);
  for (let m = 0; m < 12; m++) {
    const ing = invoices.filter(i => i.tipo === 'emitida' && new Date(i.fecha_emision || '').getMonth() === m)
      .reduce((s, i) => s + (i.base_imponible || 0), 0);
    const gas = expenses.filter(e => e.tipo === 'gasto' && new Date(e.fecha || '').getMonth() === m)
      .reduce((s, e) => s + (e.base_imponible || 0), 0);
    const ben = ing - gas;
    const mar = ing > 0 ? (ben / ing * 100).toFixed(1) : '0,0';
    csv += row([MONTHS[m], fmt(ing), fmt(gas), fmt(ben), mar]);
  }
  const totalIng = invoices.filter(i => i.tipo === 'emitida').reduce((s, i) => s + (i.base_imponible || 0), 0);
  const totalGas = expenses.filter(e => e.tipo === 'gasto').reduce((s, e) => s + (e.base_imponible || 0), 0);
  const totalBen = totalIng - totalGas;
  csv += row(['TOTAL', fmt(totalIng), fmt(totalGas), fmt(totalBen), totalIng > 0 ? (totalBen / totalIng * 100).toFixed(1) : '0,0']);
  return csv;
}

function buildResumenIVA(invoices, expenses) {
  const headers = ['Trimestre','IVA Repercutido','IVA Soportado','Resultado'];
  let csv = row(headers);
  ['T1','T2','T3','T4'].forEach(t => {
    const rep = invoices.filter(i => i.tipo === 'emitida' && i.trimestre === t).reduce((s, i) => s + (i.cuota_iva || 0), 0);
    const sop = invoices.filter(i => i.tipo === 'recibida' && i.trimestre === t).reduce((s, i) => s + (i.cuota_iva || 0), 0)
      + expenses.filter(e => e.trimestre === t).reduce((s, e) => s + (e.cuota_impuesto || 0), 0);
    csv += row([t, fmt(rep), fmt(sop), fmt(rep - sop)]);
  });
  return csv;
}

function buildResumenIRPF(invoices) {
  const headers = ['Trimestre','IRPF a favor (retenciones emitidas)','Modelo 111 (retenciones recibidas)'];
  let csv = row(headers);
  ['T1','T2','T3','T4'].forEach(t => {
    const favor = invoices.filter(i => i.tipo === 'emitida' && i.trimestre === t)
      .reduce((s, i) => s + (i.base_imponible || 0) * (i.retencion_irpf || 0) / 100, 0);
    csv += row([t, fmt(favor), '0,00']);
  });
  return csv;
}

function downloadCSV(name, csv) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportarLibros({ invoices, expenses, year }) {
  const sheets = [
    { name: `LibroVentas_${year}`, csv: buildLibroVentas(invoices) },
    { name: `LibroCompras_${year}`, csv: buildLibroCompras(invoices, expenses) },
    { name: `PnL_${year}`, csv: buildResumenPnL(invoices, expenses) },
    { name: `IVA_IGIC_${year}`, csv: buildResumenIVA(invoices, expenses) },
    { name: `IRPF_${year}`, csv: buildResumenIRPF(invoices) },
  ];
  sheets.forEach(({ name, csv }) => downloadCSV(name, csv));
}
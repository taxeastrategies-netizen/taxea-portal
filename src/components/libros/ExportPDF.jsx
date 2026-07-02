import { jsPDF } from 'jspdf';

// ── helpers ──────────────────────────────────────────────────────────────────
const n = v => parseFloat(v) || 0;
const fmt = v => n(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ── Account helpers (mirrors ExportExcel) ────────────────────────────────────
function buildClienteAccounts(invoices) {
  const map = {};
  let counter = 1;
  invoices.filter(i => i.tipo === 'emitida').forEach(i => {
    const key = i.cliente_nif ? i.cliente_nif.toUpperCase() : (i.cliente_nombre || '').toLowerCase();
    if (key && !map[key]) map[key] = `4300${String(counter++).padStart(4, '0')}`;
  });
  return map;
}
function buildProveedorAccounts(invoices) {
  const map = {};
  let counter = 1;
  invoices.filter(i => i.tipo === 'recibida').forEach(i => {
    const key = i.proveedor_nif ? i.proveedor_nif.toUpperCase() : (i.proveedor_nombre || '').toLowerCase();
    if (key && !map[key]) map[key] = `4100${String(counter++).padStart(4, '0')}`;
  });
  return map;
}
const GASTO_CUENTAS = {
  ventas_servicios: '70000000', compras: '60000000', suministros: '62800000',
  alquiler: '62100000', publicidad_marketing: '62700000',
  servicios_profesionales: '62300000', software: '62800000',
  transporte: '62400000', dietas: '62500000', gastos_financieros: '66900000',
  seguros: '62500000', otros: '62900000',
};
function ctaGasto(inv) {
  return GASTO_CUENTAS[inv.categoria_gasto] || '60000000';
}
function ctaIngreso(inv) {
  return n(inv.tipo_iva) === 0 ? '70500000' : '70000000';
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function drawTaxeaHeader(doc, companyName, period, pageW) {
  // Background bar
  doc.setFillColor(130, 15, 30);
  doc.rect(0, 0, pageW, 28, 'F');

  // TAXEA text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('TAXEA', 15, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(220, 180, 180);
  doc.text('STRATEGIES', 15, 18);

  // Decorative lines (logo swoosh simulation)
  doc.setDrawColor(200, 50, 60);
  doc.setLineWidth(1.2);
  doc.line(14, 22, 60, 22);
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.6);
  doc.line(16, 24, 62, 24);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('LIBRO DE REGISTROS OFICIAL', pageW / 2, 12, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(220, 200, 200);
  doc.text(`Empresa: ${companyName}   ·   Período: ${period}   ·   Generado: ${new Date().toLocaleDateString('es-ES')}`, pageW / 2, 20, { align: 'center' });

  // Right corner
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(200, 180, 180);
  doc.text('taxea.es', pageW - 14, 12, { align: 'right' });
}

function sectionTitle(doc, title, y, pageW) {
  doc.setFillColor(245, 245, 247);
  doc.rect(10, y - 5, pageW - 20, 8, 'F');
  doc.setDrawColor(130, 15, 30);
  doc.setLineWidth(2);
  doc.line(10, y - 5, 10, y + 3);
  doc.setLineWidth(0.3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(130, 15, 30);
  doc.text(title, 15, y);
  return y + 8;
}

function tableHeader(doc, headers, colX, colW, y) {
  doc.setFillColor(40, 40, 50);
  doc.rect(colX[0] - 2, y - 4, colX[colX.length - 1] + colW[colW.length - 1] - colX[0] + 2, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  headers.forEach((h, i) => {
    const align = i >= 4 ? 'right' : 'left';
    const x = align === 'right' ? colX[i] + colW[i] - 1 : colX[i];
    doc.text(h, x, y, { align });
  });
  return y + 5;
}

function tableRow(doc, cells, colX, colW, y, isAlt) {
  if (isAlt) {
    doc.setFillColor(250, 248, 248);
    doc.rect(colX[0] - 2, y - 3.5, colX[colX.length - 1] + colW[colW.length - 1] - colX[0] + 2, 6, 'F');
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(40, 40, 50);
  cells.forEach((c, i) => {
    const align = i >= 4 ? 'right' : 'left';
    const x = align === 'right' ? colX[i] + colW[i] - 1 : colX[i];
    const text = String(c ?? '—').substring(0, 22);
    doc.text(text, x, y, { align });
  });
  return y + 5.5;
}

function tableSummary(doc, label, values, colX, colW, y) {
  doc.setDrawColor(130, 15, 30);
  doc.setLineWidth(0.4);
  doc.line(colX[0] - 2, y - 1, colX[colX.length - 1] + colW[colW.length - 1], y - 1);
  doc.setFillColor(240, 235, 235);
  doc.rect(colX[0] - 2, y - 1, colX[colX.length - 1] + colW[colW.length - 1] - colX[0] + 2, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(130, 15, 30);
  doc.text(label, colX[0], y + 3);
  values.forEach(({ text, col }) => {
    doc.text(text, colX[col] + colW[col] - 1, y + 3, { align: 'right' });
  });
  return y + 9;
}

function pageFooter(doc, pageNum, totalPages, pageW, pageH) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(160, 160, 170);
  doc.text(`Página ${pageNum} de ${totalPages}  ·  Documento generado por Taxea Portal  ·  taxea.es`, pageW / 2, pageH - 6, { align: 'center' });
  doc.setDrawColor(130, 15, 30);
  doc.setLineWidth(0.3);
  doc.line(10, pageH - 9, pageW - 10, pageH - 9);
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export async function exportarLibrosPDF({ invoices: rawInvoices, expenses: rawExpenses, year, companyName = 'Empresa' }) {
  // Filtrar facturas y gastos anulados — única fuente de datos activos
  const invoices = (rawInvoices || []).filter(i => !i.anulada);
  const expenses = (rawExpenses || []).filter(e => !e.anulada);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const period = `Ejercicio ${year}`;

  const emitidas = invoices.filter(i => i.tipo === 'emitida');
  const recibidas = invoices.filter(i => i.tipo === 'recibida');
  const clienteMap = buildClienteAccounts(invoices);
  const proveedorMap = buildProveedorAccounts(invoices);

  const totalPages = 2; // simple 2-page doc
  let page = 1;

  // ── PAGE 1: Facturas Emitidas ──────────────────────────────────────────────
  drawTaxeaHeader(doc, companyName, period, pageW);
  let y = 35;

  y = sectionTitle(doc, '📄  LIBRO DE FACTURAS EMITIDAS', y, pageW);
  y += 2;

  // Emitidas table
  const eColX = [11, 30, 45, 85, 107, 122, 138, 155, 172, 200, 224, 248];
  const eColW = [18, 14, 39, 21, 14, 15, 16, 16, 27, 23, 23, 20];
  const eHeaders = ['Nº Factura','Fecha','Cliente','NIF/CIF','Base Imp.','IVA','Ret.','Total','Cta. Ingreso','Cta. 430x','Estado Cobro','Estado Cont.'];

  y = tableHeader(doc, eHeaders, eColX, eColW, y);

  let totBaseE = 0, totIvaE = 0, totRetE = 0, totTotalE = 0;
  emitidas.forEach((inv, idx) => {
    if (y > pageH - 25) {
      pageFooter(doc, page, totalPages, pageW, pageH);
      doc.addPage();
      page++;
      drawTaxeaHeader(doc, companyName, period, pageW);
      y = 35;
      y = tableHeader(doc, eHeaders, eColX, eColW, y);
    }
    const base = n(inv.base_imponible);
    const iva = n(inv.cuota_iva);
    const ret = base * n(inv.retencion_irpf) / 100;
    const total = n(inv.total_factura);
    totBaseE += base; totIvaE += iva; totRetE += ret; totTotalE += total;
    const key = inv.cliente_nif ? inv.cliente_nif.toUpperCase() : (inv.cliente_nombre || '').toLowerCase();
    const ctaCliente = clienteMap[key] || '43000000';
    y = tableRow(doc, [
      inv.numero_factura || '—', fmtDate(inv.fecha_emision), inv.cliente_nombre || '—',
      inv.cliente_nif || '—', fmt(base), fmt(iva), fmt(ret), fmt(total),
      ctaIngreso(inv), ctaCliente,
      inv.estado_cobro || '—', inv.estado_contable || '—',
    ], eColX, eColW, y, idx % 2 === 1);
  });
  if (emitidas.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(150, 150, 160);
    doc.text('Sin facturas emitidas en este período', eColX[0], y + 3); y += 8;
  } else {
    y = tableSummary(doc, `Resumen: ${emitidas.length} facturas`, [
      { text: fmt(totBaseE), col: 4 }, { text: fmt(totIvaE), col: 5 },
      { text: fmt(totRetE), col: 6 }, { text: fmt(totTotalE), col: 7 },
    ], eColX, eColW, y);
  }
  y += 6;

  // ── PAGE 2: Facturas Recibidas ─────────────────────────────────────────────
  pageFooter(doc, page, totalPages, pageW, pageH);
  doc.addPage();
  page++;
  drawTaxeaHeader(doc, companyName, period, pageW);
  y = 35;

  y = sectionTitle(doc, '📥  LIBRO DE FACTURAS RECIBIDAS', y, pageW);
  y += 2;

  const rColX = [11, 30, 45, 90, 112, 128, 144, 162, 185, 210, 234, 258];
  const rColW = [18, 14, 44, 21, 15, 15, 17, 22, 24, 23, 23, 12];
  const rHeaders = ['Nº Factura','Fecha','Proveedor','NIF/CIF','Base Imp.','IVA','Total','Categoría','Cta. Gasto','Cta. 40x/41x','Estado Cont.','T'];

  y = tableHeader(doc, rHeaders, rColX, rColW, y);

  let totBaseR = 0, totIvaR = 0, totTotalR = 0;
  recibidas.forEach((inv, idx) => {
    if (y > pageH - 25) {
      pageFooter(doc, page, totalPages, pageW, pageH);
      doc.addPage();
      page++;
      drawTaxeaHeader(doc, companyName, period, pageW);
      y = 35;
      y = tableHeader(doc, rHeaders, rColX, rColW, y);
    }
    const base = n(inv.base_imponible);
    const iva = n(inv.cuota_iva);
    const total = n(inv.total_factura);
    totBaseR += base; totIvaR += iva; totTotalR += total;
    const provNombre = inv.proveedor_nombre || inv.cliente_nombre || '—';
    const provNif = inv.proveedor_nif || inv.cliente_nif || '—';
    const key = provNif !== '—' ? provNif.toUpperCase() : provNombre.toLowerCase();
    const ctaProv = proveedorMap[key] || '40000000';
    const catLabel = inv.categoria_gasto ? inv.categoria_gasto.replace(/_/g, ' ') : '—';
    y = tableRow(doc, [
      inv.numero_factura || '—', fmtDate(inv.fecha_emision), provNombre,
      provNif, fmt(base), fmt(iva), fmt(total),
      catLabel, ctaGasto(inv), ctaProv,
      inv.estado_contable || '—', inv.trimestre || '—',
    ], rColX, rColW, y, idx % 2 === 1);
  });
  if (recibidas.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(150, 150, 160);
    doc.text('Sin facturas recibidas en este período', rColX[0], y + 3); y += 8;
  } else {
    y = tableSummary(doc, `Resumen: ${recibidas.length} facturas`, [
      { text: fmt(totBaseR), col: 4 }, { text: fmt(totIvaR), col: 5 },
      { text: fmt(totTotalR), col: 6 },
    ], rColX, rColW, y);
  }

  // ── Resumen General ───────────────────────────────────────────────────────
  y += 10;
  if (y > pageH - 45) {
    pageFooter(doc, page, totalPages, pageW, pageH);
    doc.addPage(); page++;
    drawTaxeaHeader(doc, companyName, period, pageW); y = 35;
  }
  y = sectionTitle(doc, '📊  RESUMEN GENERAL', y, pageW);
  y += 4;

  const summaryData = [
    ['Total facturas emitidas', emitidas.length],
    ['Total facturas recibidas', recibidas.length],
    ['Base imponible ingresos', fmt(totBaseE)],
    ['Base imponible gastos', fmt(totBaseR)],
    ['IVA repercutido', fmt(totIvaE)],
    ['IVA soportado', fmt(totIvaR)],
    ['Resultado IVA (a liquidar)', fmt(totIvaE - totIvaR)],
    ['Beneficio estimado (base)', fmt(totBaseE - totBaseR)],
  ];

  const cols = 2;
  const colSpacing = (pageW - 20) / cols;
  summaryData.forEach((row, i) => {
    const col = i % cols;
    const rowY = y + Math.floor(i / cols) * 9;
    const xStart = 12 + col * colSpacing;
    doc.setFillColor(col === 0 ? 252 : 248, col === 0 ? 248 : 252, 252);
    doc.rect(xStart - 2, rowY - 4, colSpacing - 4, 7, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(80, 80, 90);
    doc.text(row[0], xStart + 1, rowY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(130, 15, 30);
    doc.text(String(row[1]), xStart + colSpacing - 8, rowY, { align: 'right' });
  });

  pageFooter(doc, page, page, pageW, pageH);

  const safeName = companyName.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 30);
  doc.save(`Taxea_LibroRegistros_${safeName}_${year}.pdf`);
}
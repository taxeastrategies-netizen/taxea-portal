import { jsPDF } from 'jspdf';

function fmt(n) {
  return (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function drawHeader(doc, title, subtitle) {
  // Dark background header strip
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, 210, 38, 'F');

  // TAXEA text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('TAXEA', 14, 17);

  // STRATEGIES text in red
  doc.setFontSize(9);
  doc.setTextColor(180, 30, 50);
  doc.text('STRATEGIES', 14, 24);

  // Decorative swoosh lines
  doc.setDrawColor(26, 26, 26);
  doc.setLineWidth(0.8);
  doc.setDrawColor(60, 60, 60);
  doc.line(14, 26.5, 60, 26.5);
  doc.setDrawColor(180, 30, 50);
  doc.setLineWidth(0.5);
  doc.line(14, 28, 55, 28);

  // Report title (right side)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 210 - 14, 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text(subtitle, 210 - 14, 23, { align: 'right' });

  // Red accent line below header
  doc.setDrawColor(180, 30, 50);
  doc.setLineWidth(1.5);
  doc.line(0, 38, 210, 38);

  return 50; // return Y cursor
}

function drawSection(doc, title, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 26);
  doc.text(title, 14, y);

  doc.setDrawColor(180, 30, 50);
  doc.setLineWidth(0.4);
  doc.line(14, y + 2, 196, y + 2);

  return y + 10;
}

function drawStatsGrid(doc, stats, y) {
  const colW = 91;
  const rowH = 9;
  let col = 0, row = 0;

  stats.forEach(([label, value], i) => {
    const x = 14 + col * colW;
    const cy = y + row * rowH;

    // Alternate row bg
    if (Math.floor(i / 2) % 2 === 0) {
      doc.setFillColor(248, 248, 250);
      doc.rect(x, cy - 5.5, colW - 2, rowH, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text(label + ':', x + 3, cy);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 26, 26);
    doc.text(String(value), x + colW - 5, cy, { align: 'right' });

    col++;
    if (col > 1) { col = 0; row++; }
  });

  return y + Math.ceil(stats.length / 2) * rowH + 6;
}

function drawTable(doc, headers, rows, y) {
  const colWidths = [70, 40, 72];
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const rowH = 8;

  // Header row
  doc.setFillColor(26, 26, 26);
  doc.rect(14, y, tableW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  let cx = 14;
  headers.forEach((h, i) => {
    doc.text(h, cx + 4, y + 5.5);
    cx += colWidths[i];
  });

  // Data rows
  rows.forEach((row, ri) => {
    const ry = y + rowH + ri * rowH;
    if (ri % 2 === 0) {
      doc.setFillColor(250, 248, 248);
      doc.rect(14, ry, tableW, rowH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    let cx2 = 14;
    row.forEach((cell, ci) => {
      doc.text(String(cell), cx2 + 4, ry + 5.5);
      cx2 += colWidths[ci];
    });
  });

  // Border
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.rect(14, y, tableW, rowH + rows.length * rowH, 'S');

  return y + rowH + rows.length * rowH + 10;
}

function drawConversionBar(doc, label, percent, y) {
  const barW = 182;
  const filled = (percent / 100) * barW;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text(label, 14, y);

  y += 5;
  doc.setFillColor(235, 235, 240);
  doc.roundedRect(14, y, barW, 6, 1.5, 1.5, 'F');

  if (filled > 0) {
    doc.setFillColor(180, 30, 50);
    doc.roundedRect(14, y, Math.max(filled, 2), 6, 1.5, 1.5, 'F');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(26, 26, 26);
  doc.text(percent.toFixed(1) + '%', 210 - 14, y + 4.5, { align: 'right' });

  return y + 14;
}

function drawFooter(doc, note) {
  const pageH = doc.internal.pageSize.height;
  doc.setDrawColor(180, 30, 50);
  doc.setLineWidth(0.5);
  doc.line(14, pageH - 22, 196, pageH - 22);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.text(note, 105, pageH - 16, { align: 'center' });

  const now = new Date();
  doc.text(
    now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) +
    ' · ' + now.toLocaleTimeString('es-ES'),
    105, pageH - 10, { align: 'center' }
  );
}

// ─── PUBLIC EXPORTS ──────────────────────────────────────────────────────────

export function downloadPresupuestosPDF(items, company) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  let y = drawHeader(doc, 'Resumen de Presupuestos', 'Generado el ' + today);

  const total = items.length;
  const borradores = items.filter(i => i.estado === 'borrador' || !i.estado).length;
  const enviados = items.filter(i => i.estado === 'enviado').length;
  const aceptados = items.filter(i => i.estado === 'aceptado').length;
  const rechazados = items.filter(i => i.estado === 'rechazado').length;
  const convertidos = items.filter(i => i.estado === 'convertido').length;
  const tasa = total > 0 ? ((aceptados + convertidos) / total) * 100 : 0;
  const valorTotal = items.reduce((s, i) => s + (i.total || 0), 0);
  const valorAceptado = items.filter(i => i.estado === 'aceptado').reduce((s, i) => s + (i.total || 0), 0);
  const valorPendiente = items.filter(i => ['enviado', 'pendiente'].includes(i.estado)).reduce((s, i) => s + (i.total || 0), 0);

  if (company?.legalName || company?.displayName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text('Cliente: ' + (company.legalName || company.displayName), 14, y - 4);
  }

  y = drawSection(doc, 'Estadísticas Generales', y);
  y = drawStatsGrid(doc, [
    ['Total de presupuestos', total],
    ['Presupuestos en borrador', borradores],
    ['Presupuestos enviados', enviados],
    ['Presupuestos aceptados', aceptados],
    ['Presupuestos rechazados', rechazados],
    ['Tasa de conversión', tasa.toFixed(1) + '%'],
    ['Valor total', fmt(valorTotal)],
    ['Valor aceptados', fmt(valorAceptado)],
    ['Pendientes por aceptar', fmt(valorPendiente)],
  ], y);

  y = drawSection(doc, 'Distribución de Presupuestos', y);
  y = drawTable(doc,
    ['Estado', 'Cantidad', 'Porcentaje'],
    [
      ['Borradores', borradores, total > 0 ? ((borradores / total) * 100).toFixed(1) + '%' : '0.0%'],
      ['Enviados', enviados, total > 0 ? ((enviados / total) * 100).toFixed(1) + '%' : '0.0%'],
      ['Aceptados', aceptados, total > 0 ? ((aceptados / total) * 100).toFixed(1) + '%' : '0.0%'],
      ['Rechazados', rechazados, total > 0 ? ((rechazados / total) * 100).toFixed(1) + '%' : '0.0%'],
    ],
    y
  );

  y = drawSection(doc, 'Tasa de Conversión', y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text('Porcentaje de presupuestos aceptados sobre el total enviado:', 14, y);
  y += 6;
  y = drawConversionBar(doc, '', tasa, y);

  // Listado si hay items
  if (items.length > 0) {
    y = drawSection(doc, 'Listado de Presupuestos', y);
    const rows = items.slice(0, 25).map(i => [
      i.numero_presupuesto || i.numero || '—',
      i.cliente_nombre || '—',
      fmt(i.total),
      (i.estado || 'borrador').charAt(0).toUpperCase() + (i.estado || 'borrador').slice(1),
    ]);
    drawTable(doc, ['Nº Presupuesto', 'Cliente', 'Total', 'Estado'], rows.map(r => [r[0], r[1], r[2], r[3]]), y);
    if (items.length > 25) {
      y += 8 * (rows.length + 1) + 4;
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`... y ${items.length - 25} más.`, 14, y);
    }
  }

  drawFooter(doc, 'Este informe es un resumen de los presupuestos generados en Taxea Portal. Para más detalles, consulte la aplicación.');
  doc.save('resumen-presupuestos-taxea.pdf');
}

export function downloadProformasPDF(items, company) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  let y = drawHeader(doc, 'Resumen de Facturas Proforma', 'Generado el ' + today);

  const total = items.length;
  const borradores = items.filter(i => i.estado === 'borrador' || !i.estado).length;
  const enviadas = items.filter(i => i.estado === 'enviado').length;
  const aceptadas = items.filter(i => i.estado === 'aceptado').length;
  const rechazadas = items.filter(i => i.estado === 'rechazado').length;
  const convertidas = items.filter(i => ['convertida', 'facturada'].includes(i.estado)).length;
  const tasa = total > 0 ? ((convertidas) / total) * 100 : 0;
  const valorTotal = items.reduce((s, i) => s + (i.total || 0), 0);
  const valorAceptado = items.filter(i => i.estado === 'aceptado').reduce((s, i) => s + (i.total || 0), 0);
  const valorPendiente = items.filter(i => ['enviado', 'pendiente'].includes(i.estado)).reduce((s, i) => s + (i.total || 0), 0);

  if (company?.legalName || company?.displayName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text('Cliente: ' + (company.legalName || company.displayName), 14, y - 4);
  }

  y = drawSection(doc, 'Estadísticas Generales', y);
  y = drawStatsGrid(doc, [
    ['Total de proformas', total],
    ['Proformas en borrador', borradores],
    ['Proformas enviadas', enviadas],
    ['Proformas aceptadas', aceptadas],
    ['Proformas rechazadas', rechazadas],
    ['Convertidas a factura', convertidas],
    ['Tasa de conversión', tasa.toFixed(1) + '%'],
    ['Valor total', fmt(valorTotal)],
    ['Valor proformas aceptadas', fmt(valorAceptado)],
    ['Pendientes por aceptar', fmt(valorPendiente)],
  ], y);

  y = drawSection(doc, 'Distribución de Proformas', y);
  y = drawTable(doc,
    ['Estado', 'Cantidad', 'Porcentaje'],
    [
      ['Borradores', borradores, total > 0 ? ((borradores / total) * 100).toFixed(1) + '%' : '0.0%'],
      ['Enviadas', enviadas, total > 0 ? ((enviadas / total) * 100).toFixed(1) + '%' : '0.0%'],
      ['Aceptadas', aceptadas, total > 0 ? ((aceptadas / total) * 100).toFixed(1) + '%' : '0.0%'],
      ['Rechazadas', rechazadas, total > 0 ? ((rechazadas / total) * 100).toFixed(1) + '%' : '0.0%'],
      ['Convertidas', convertidas, total > 0 ? ((convertidas / total) * 100).toFixed(1) + '%' : '0.0%'],
    ],
    y
  );

  y = drawSection(doc, 'Tasa de Conversión a Factura', y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text('Porcentaje de proformas convertidas a factura:', 14, y);
  y += 6;
  y = drawConversionBar(doc, '', tasa, y);

  if (items.length > 0) {
    y = drawSection(doc, 'Listado de Facturas Proforma', y);
    const rows = items.slice(0, 25).map(i => [
      i.numero_proforma || '—',
      i.cliente_nombre || '—',
      fmt(i.total),
      (i.estado || 'borrador').charAt(0).toUpperCase() + (i.estado || 'borrador').slice(1),
    ]);
    drawTable(doc, ['Nº Proforma', 'Cliente', 'Total', 'Estado'], rows.map(r => [r[0], r[1], r[2], r[3]]), y);
    if (items.length > 25) {
      y += 8 * (rows.length + 1) + 4;
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(`... y ${items.length - 25} más.`, 14, y);
    }
  }

  drawFooter(doc, 'Las proformas son documentos sin valor fiscal. Este informe ha sido generado por Taxea Portal.');
  doc.save('resumen-proformas-taxea.pdf');
}
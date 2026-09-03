/**
 * invoicePdfExport — Genera y descarga el PDF de una factura emitida
 * replicando la plantilla visual Taxea (cabecera, emisor/receptor,
 * líneas, totales e instrucciones de pago).
 */
import { jsPDF } from 'jspdf';
import { getWithholdingAmount } from '@/lib/accountingUtils';

const BRAND = [185, 28, 28]; // #b91c1c
const LOGO = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';

function loadLogo(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const fmtEUR = (n) => (typeof n === 'number'
  ? n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '0,00');

const fmtDate = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return String(d); }
};

export async function exportInvoiceToPdf(invoice, company) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210;
  const M = 18;
  let y = 24;

  // ── Cabecera ──────────────────────────────────────────────────────────────
  const logo = await loadLogo(company?.logo_url || LOGO);
  let titleX = M;
  if (logo) {
    const logoH = 13;
    const logoW = Math.min(48, (logo.w / logo.h) * logoH);
    doc.addImage(logo.dataUrl, 'PNG', M, 11, logoW, logoH);
    titleX = M + logoW + 6;
  }
  doc.setFont('helvetica', 'bold').setFontSize(24).setTextColor(...BRAND);
  doc.text('FACTURA', titleX, y);
  doc.setFontSize(11).setTextColor(30, 41, 59);
  doc.text(String(invoice.numero_factura || '—'), titleX, y + 7);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100, 116, 139);
  doc.text(`Fecha de emisión: ${fmtDate(invoice.fecha_emision)}`, W - M, y, { align: 'right' });
  if (invoice.fecha_vencimiento) {
    doc.text(`Vencimiento: ${fmtDate(invoice.fecha_vencimiento)}`, W - M, y + 5, { align: 'right' });
  }

  // ── Emisor / Receptor ─────────────────────────────────────────────────────
  y += 18;
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(148, 163, 184);
  doc.text('EMISOR', M, y);
  const emisor = [
    company?.razon_social || company?.nombre_comercial || '—',
    company?.nif_cif && `NIF/CIF: ${company.nif_cif}`,
    company?.direccion_fiscal,
    company?.email,
    company?.telefono,
  ].filter(Boolean);
  emisor.forEach((line, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal').setFontSize(9).setTextColor(51, 65, 85);
    doc.text(String(line), M, y + 6 + i * 5);
  });

  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(148, 163, 184);
  doc.text('RECEPTOR / CLIENTE', 120, y);
  const receptor = [
    invoice.cliente_nombre || '—',
    invoice.cliente_nif && `NIF/CIF: ${invoice.cliente_nif}`,
    invoice.cliente_direccion,
  ].filter(Boolean);
  receptor.forEach((line, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal').setFontSize(9).setTextColor(51, 65, 85);
    doc.text(String(line), 120, y + 6 + i * 5);
  });

  // ── Concepto ──────────────────────────────────────────────────────────────
  y += 8 + Math.max(emisor.length, receptor.length) * 5 + 8;
  if (invoice.concepto) {
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(148, 163, 184);
    doc.text('CONCEPTO', M, y);
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(String(invoice.concepto), W - M * 2);
    doc.text(lines, M, y + 6);
    y += 6 + lines.length * 5;
  }

  // ── Tabla de líneas ───────────────────────────────────────────────────────
  y += 6;
  doc.setFillColor(...BRAND);
  doc.rect(M, y, W - M * 2, 9, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(255, 255, 255);
  doc.text('Descripción', M + 3, y + 6);
  doc.text('Cant.', 140, y + 6, { align: 'center' });
  doc.text('Precio u.', 165, y + 6, { align: 'right' });
  doc.text('Importe', W - M - 3, y + 6, { align: 'right' });
  y += 9;

  const lineas = Array.isArray(invoice?.lineas) && invoice.lineas.length
    ? invoice.lineas.map((l) => ({
      desc: l.descripcion || l.concepto || '—',
      cant: l.cantidad || 1,
      precio: l.precio_unitario ?? l.precio ?? 0,
      importe: l.importe ?? ((l.cantidad || 1) * (l.precio_unitario ?? l.precio ?? 0)),
    }))
    : [{
      desc: invoice.concepto || 'Servicio profesional',
      cant: 1,
      precio: invoice.base_imponible || 0,
      importe: invoice.base_imponible || 0,
    }];

  lineas.forEach((l, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(M, y, W - M * 2, 8, 'F');
    }
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(51, 65, 85);
    doc.text(String(l.desc).slice(0, 60), M + 3, y + 5.5);
    doc.text(String(l.cant), 140, y + 5.5, { align: 'center' });
    doc.text(`${fmtEUR(l.precio)} €`, 165, y + 5.5, { align: 'right' });
    doc.text(`${fmtEUR(l.importe)} €`, W - M - 3, y + 5.5, { align: 'right' });
    y += 8;
  });

  // ── Totales ───────────────────────────────────────────────────────────────
  y += 4;
  const totalRows = [
    ['Base imponible', `${fmtEUR(invoice.base_imponible)} €`],
    [`IVA (${invoice.tipo_iva ?? 21}%)`, `${fmtEUR(invoice.cuota_iva)} €`],
  ];
  if (invoice.retencion_irpf > 0) {
    totalRows.push(['Retención IRPF', `-${fmtEUR(getWithholdingAmount(invoice))} €`]);
  }
  totalRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100, 116, 139);
    doc.text(label, 130, y);
    doc.text(val, W - M - 3, y, { align: 'right' });
    y += 6;
  });
  doc.setFillColor(254, 242, 242);
  doc.rect(128, y, W - M - 128, 10, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(30, 41, 59);
  doc.text('Total', 131, y + 6.5);
  doc.setFontSize(12).setTextColor(...BRAND);
  doc.text(`${fmtEUR(invoice.total_factura)} €`, W - M - 3, y + 6.8, { align: 'right' });

  // ── Instrucciones de pago ──────────────────────────────────────────────────
  y += 20;
  if (invoice.forma_pago || company?.datos_bancarios) {
    doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(6, 95, 70);
    doc.text('Instrucciones de pago', M, y);
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(51, 65, 85);
    let py = y + 5;
    if (invoice.forma_pago) { doc.text(`Método: ${invoice.forma_pago}`, M, py); py += 4.5; }
    if (company?.datos_bancarios) { doc.text(`Datos bancarios: ${company.datos_bancarios}`, M, py); py += 4.5; }
    doc.text(`Indica el número ${invoice.numero_factura} como referencia del pago.`, M, py);
  }

  // ── Notas ─────────────────────────────────────────────────────────────────
  if (invoice.notas) {
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(148, 163, 184);
    doc.text(doc.splitTextToSize(String(invoice.notas), W - M * 2), M, 278);
  }

  // ── Pie ───────────────────────────────────────────────────────────────────
  doc.setFontSize(7).setTextColor(148, 163, 184);
  doc.text('Documento generado con Taxea Strategies · Portal de gestión financiera y fiscal', W / 2, 291, { align: 'center' });

  doc.save(`Factura_${invoice.numero_factura || invoice.id}.pdf`);
}
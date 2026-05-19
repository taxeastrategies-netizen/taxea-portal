/**
 * invoicePremiumEmail.js — Generador de email HTML premium para facturas
 * Taxea Strategies · No requiere librerías externas
 */

const LOGO = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';
const BRAND_COLOR = '#b91c1c'; // taxea-red — usar solo como acento, nunca como fondo masivo

const fmt = (n) =>
  typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

const maskIban = (iban) => {
  if (!iban || iban.length < 8) return iban || '—';
  return iban.substring(0, 4) + ' ' + iban.substring(4, 8) + ' ···· ···· ···· ' + iban.slice(-4);
};

/**
 * Genera el HTML completo del email premium de factura
 * @param {object} invoice - Datos de la factura
 * @param {object} company - Datos del emisor (company)
 * @param {string} publicLink - Enlace público seguro sin login
 * @param {string} templateId - ID de la plantilla
 */
export function buildPremiumInvoiceEmail(invoice, company, publicLink, templateId = 'envio_factura') {
  const issuerName = company?.nombre || company?.razon_social || 'Taxea Portal';
  const issuerNif = company?.nif || company?.cif || '';
  const issuerAddress = company?.direccion_fiscal || company?.direccion || '';
  const issuerEmail = company?.email_contacto || company?.email || '';
  const issuerPhone = company?.telefono || '';
  const issuerIban = company?.iban || invoice?.iban_cobro || '';

  const customerName = invoice?.cliente_nombre || '—';
  const customerNif = invoice?.cliente_nif || '';

  const invNumber = invoice?.numero_factura || '—';
  const invDate = fmtDate(invoice?.fecha_emision);
  const invDue = invoice?.fecha_vencimiento ? fmtDate(invoice.fecha_vencimiento) : null;
  const invBase = fmt(invoice?.base_imponible);
  const invIva = fmt(invoice?.cuota_iva);
  const invIvaPct = invoice?.tipo_iva || 21;
  const invRetention = invoice?.retencion_irpf > 0 ? fmt(invoice.retencion_irpf) : null;
  const invTotal = fmt(invoice?.total_factura);
  const invConcept = invoice?.concepto || '';
  const paymentMethod = invoice?.metodo_pago || 'Transferencia bancaria';
  const pdfName = `Factura_${invNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  const isReminder = templateId === 'recordatorio';
  const isOverdue = templateId === 'vencida';
  const isPaid = templateId === 'pagada';

  // Acento de color según plantilla — solo para detalles, NO para cabecera masiva
  const accentColor = isOverdue ? '#dc2626' : isReminder ? '#d97706' : isPaid ? '#059669' : BRAND_COLOR;
  // Badge de estado para la cabecera
  const statusBadgeBg = isOverdue ? '#fef2f2' : isReminder ? '#fffbeb' : isPaid ? '#f0fdf4' : '#fef2f2';
  const statusBadgeColor = isOverdue ? '#dc2626' : isReminder ? '#b45309' : isPaid ? '#059669' : BRAND_COLOR;
  const statusBadgeBorder = isOverdue ? '#fca5a5' : isReminder ? '#fcd34d' : isPaid ? '#a7f3d0' : '#fca5a5';

  let headerTitle = 'Factura emitida';
  let statusLabel = 'Pendiente de pago';
  let introText = `Te enviamos la factura <strong>${invNumber}</strong> emitida por <strong>${issuerName}</strong>.`;

  if (isReminder) {
    headerTitle = 'Recordatorio de vencimiento';
    statusLabel = 'Pendiente de pago';
    introText = `Te recordamos que la factura <strong>${invNumber}</strong> emitida por <strong>${issuerName}</strong> está pendiente de pago.`;
  } else if (isOverdue) {
    headerTitle = 'Factura vencida';
    statusLabel = 'Vencida · Requiere atención';
    introText = `Nos ponemos en contacto porque la factura <strong>${invNumber}</strong> de <strong>${issuerName}</strong> está pendiente de pago y ha superado la fecha de vencimiento.`;
  } else if (isPaid) {
    headerTitle = 'Confirmación de pago';
    statusLabel = 'Pagada';
    introText = `Confirmamos la recepción del pago de la factura <strong>${invNumber}</strong>. Muchas gracias.`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headerTitle} — ${invNumber}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.5; }
    .wrapper { max-width: 600px; margin: 24px auto; }
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
    /* CABECERA: blanca con línea de acento arriba — NO fondo rojo masivo */
    .header { background: #ffffff; padding: 28px 32px 20px; border-top: 3px solid ${accentColor}; border-bottom: 1px solid #f1f5f9; }
    .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .header-logo { height: 32px; object-fit: contain; display: block; }
    .header-brand { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
    .header-meta { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .header-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .header-number { font-size: 13px; color: #64748b; font-weight: 500; }
    .status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: ${statusBadgeBg}; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeBorder}; margin-top: 6px; }
    .body { padding: 28px 32px; }
    .intro { font-size: 14px; color: #475569; line-height: 1.7; margin-bottom: 22px; }
    /* Bloque total — fondo muy suave, acento solo en la cifra */
    .total-block { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid ${accentColor}; border-radius: 8px; padding: 16px 20px; margin-bottom: 22px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
    .total-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .total-amount { font-size: 28px; font-weight: 700; color: ${accentColor}; }
    .due-badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; background: ${invDue ? (isOverdue ? '#fef2f2' : '#fffbeb') : '#f1f5f9'}; color: ${invDue ? (isOverdue ? '#dc2626' : '#92400e') : '#64748b'}; border: 1px solid ${invDue ? (isOverdue ? '#fca5a5' : '#fcd34d') : '#e2e8f0'}; }
    .section-title { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin: 22px 0 8px; }
    .detail-table { width: 100%; border-collapse: collapse; }
    .detail-table td { font-size: 13px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .detail-table td:first-child { color: #64748b; width: 48%; }
    .detail-table td:last-child { color: #1e293b; font-weight: 500; text-align: right; }
    .totals-table { width: 100%; border-collapse: collapse; margin-top: 8px; background: #f8fafc; border-radius: 8px; overflow: hidden; }
    .totals-table td { font-size: 13px; padding: 6px 12px; }
    .totals-table tr:not(:last-child) td { border-bottom: 1px solid #f1f5f9; }
    .totals-table td:first-child { color: #64748b; }
    .totals-table td:last-child { text-align: right; font-weight: 600; color: #1e293b; }
    .totals-table .total-row td { font-size: 15px; font-weight: 700; color: ${accentColor}; border-top: 1px solid #e2e8f0 !important; padding-top: 10px; padding-bottom: 10px; background: #fff; }
    .payment-box { background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 16px; margin-top: 8px; }
    .payment-box .pm-label { font-size: 11px; color: #059669; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
    .payment-box .pm-row { font-size: 13px; color: #1e293b; margin-bottom: 4px; }
    .payment-box .pm-row span { color: #64748b; margin-right: 6px; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 22px 0; }
    /* CTA centrado — botón rojo solo aquí como acción principal */
    .cta-block { text-align: center; margin: 24px 0; }
    .btn-primary { display: inline-block; background: ${accentColor}; color: #ffffff !important; font-size: 14px; font-weight: 600; padding: 13px 36px; border-radius: 8px; text-decoration: none; letter-spacing: 0.3px; }
    .btn-fallback { display: block; margin-top: 10px; font-size: 11px; color: #94a3b8; word-break: break-all; }
    .attach-note { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #64748b; margin-top: 14px; text-align: center; }
    .footer { padding: 18px 32px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
    .footer-issuer { font-size: 12px; color: #64748b; line-height: 1.7; }
    .footer-taxea { font-size: 11px; color: #94a3b8; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
    .footer-legal { font-size: 10px; color: #cbd5e1; margin-top: 6px; }
    @media (max-width: 480px) {
      .wrapper { margin: 0; }
      .card { border-radius: 0; }
      .header, .body, .footer { padding: 18px 16px; }
      .total-amount { font-size: 24px; }
    }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="card">

    <!-- CABECERA: blanca con línea de acento, no fondo rojo masivo -->
    <div class="header">
      <div class="header-top">
        <img src="${LOGO}" alt="Taxea Strategies" class="header-logo" />
        <span class="header-brand">Taxea Strategies</span>
      </div>
      <div class="header-meta">
        <div>
          <div class="header-title">${headerTitle}</div>
          <div class="header-number">Documento ${invNumber} · ${issuerName}</div>
        </div>
      </div>
      <div><span class="status-badge">${statusLabel}</span></div>
    </div>

    <!-- CUERPO -->
    <div class="body">
      <p class="intro">Hola, <strong>${customerName}</strong>.<br/><br/>${introText}</p>

      <!-- TOTAL DESTACADO — fondo neutro, acento solo en cifra y borde izquierdo -->
      <div class="total-block">
        <div>
          <div class="total-label">Total de la factura</div>
          <div class="total-amount">${invTotal}</div>
        </div>
        ${invDue ? `<div><div class="total-label">Fecha de vencimiento</div><div class="due-badge">${invDue}</div></div>` : ''}
      </div>

      <!-- RESUMEN DE FACTURA -->
      <div class="section-title">Datos de la factura</div>
      <table class="detail-table">
        <tr><td>Nº de factura</td><td>${invNumber}</td></tr>
        <tr><td>Emisor</td><td>${issuerName}${issuerNif ? ` · <span style="color:#94a3b8">${issuerNif}</span>` : ''}</td></tr>
        <tr><td>Receptor</td><td>${customerName}${customerNif ? ` · <span style="color:#94a3b8">${customerNif}</span>` : ''}</td></tr>
        <tr><td>Fecha de emisión</td><td>${invDate}</td></tr>
        ${invDue ? `<tr><td>Fecha de vencimiento</td><td><strong>${invDue}</strong></td></tr>` : ''}
        ${invConcept ? `<tr><td>Concepto</td><td>${invConcept}</td></tr>` : ''}
      </table>

      <!-- DESGLOSE DE IMPORTES -->
      <div class="section-title">Desglose de importes</div>
      <table class="totals-table">
        <tr><td>Base imponible</td><td>${invBase}</td></tr>
        <tr><td>IVA (${invIvaPct}%)</td><td>${invIva}</td></tr>
        ${invRetention ? `<tr><td>Retención IRPF</td><td>−${invRetention}</td></tr>` : ''}
        <tr class="total-row"><td>Total</td><td>${invTotal}</td></tr>
      </table>

      ${(paymentMethod || issuerIban) ? `
      <!-- DATOS DE COBRO -->
      <div class="section-title">Instrucciones de pago</div>
      <div class="payment-box">
        <div class="pm-label">Datos para realizar el pago</div>
        ${paymentMethod ? `<div class="pm-row"><span>Método:</span>${paymentMethod}</div>` : ''}
        ${issuerIban ? `<div class="pm-row"><span>IBAN:</span>${maskIban(issuerIban)}</div>` : ''}
        ${issuerName ? `<div class="pm-row"><span>Titular:</span>${issuerName}</div>` : ''}
        <div class="pm-row" style="margin-top:8px;font-size:12px;color:#64748b;">Por favor, indica el número de factura <strong>${invNumber}</strong> como referencia de tu transferencia.</div>
      </div>` : ''}

      <hr class="divider" />

      <!-- CTA: botón de acento, único elemento con color fuerte -->
      <div class="cta-block">
        <a href="${publicLink}" class="btn-primary">Ver factura online →</a>
        <div class="btn-fallback">Si el botón no funciona, accede desde: <a href="${publicLink}" style="color:#64748b">${publicLink}</a></div>
      </div>
      <div class="attach-note">📎 El PDF de la factura <strong>${pdfName}</strong> va adjunto a este correo.</div>

      <p style="font-size:13px;color:#64748b;margin-top:18px;">Si tienes cualquier consulta sobre esta factura, puedes responder directamente a este email${issuerEmail ? ` o contactarnos en <a href="mailto:${issuerEmail}" style="color:${accentColor}">${issuerEmail}</a>` : ''}.</p>
    </div>

    <!-- PIE -->
    <div class="footer">
      <div class="footer-issuer">
        <strong>${issuerName}</strong>${issuerNif ? ` · ${issuerNif}` : ''}<br/>
        ${issuerAddress ? `${issuerAddress}<br/>` : ''}
        ${issuerEmail ? issuerEmail : ''}${issuerPhone ? ` · ${issuerPhone}` : ''}
      </div>
      <div class="footer-taxea">
        Gestionado con <strong>Taxea Strategies</strong> — Portal de gestión financiera y fiscal
      </div>
      <div class="footer-legal">
        Este correo electrónico y sus adjuntos son confidenciales y están destinados únicamente al destinatario indicado. Si lo ha recibido por error, elimínelo y notifíquenoslo.
      </div>
    </div>

  </div>
</div>
</body>
</html>`;
}

/**
 * ensureInvoicePdf — Genera o recupera el PDF de una factura automáticamente.
 * Si la factura ya tiene archivo_url válido, lo reutiliza.
 * Si no, renderiza el HTML de la factura y lo sube como PDF (vía html2canvas + jsPDF).
 * Devuelve { pdfUrl, fileName, ok, error }
 */
export async function ensureInvoicePdf(invoice, company, base44Client) {
  // 1. Si ya existe PDF, reutilizarlo
  if (invoice?.archivo_url) {
    return {
      ok: true,
      pdfUrl: invoice.archivo_url,
      fileName: `Factura_${(invoice.numero_factura || 'factura').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
    };
  }

  // 2. Generar PDF desde el HTML de la factura con jsPDF
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const LOGO_B44 = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';
    const fmtN = (n) => typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';
    const fmtD = (d) => {
      if (!d) return '—';
      try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
      catch { return d; }
    };

    const red = [185, 28, 28];
    const dark = [15, 23, 42];
    const muted = [100, 116, 139];
    const light = [241, 245, 249];

    const M = 15; // margen izquierdo
    const W = 180; // ancho útil
    let Y = 15;

    // Línea superior roja
    doc.setFillColor(...red);
    doc.rect(0, 0, 210, 2, 'F');

    // Logo (intentar cargar; si falla, solo texto)
    try {
      // Cargamos la imagen como blob y la convertimos a dataURL
      const resp = await fetch(LOGO_B44);
      const blob = await resp.blob();
      const dataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(blob);
      });
      doc.addImage(dataUrl, 'PNG', M, Y, 40, 10);
    } catch {
      doc.setFontSize(11).setTextColor(...red).setFont(undefined, 'bold');
      doc.text('Taxea Strategies', M, Y + 6);
    }

    // Número de factura (derecha)
    doc.setFontSize(20).setTextColor(...red).setFont(undefined, 'bold');
    doc.text('FACTURA', 210 - M, Y + 8, { align: 'right' });
    doc.setFontSize(11).setTextColor(...dark);
    doc.text(invoice.numero_factura || '—', 210 - M, Y + 15, { align: 'right' });
    doc.setFontSize(8).setTextColor(...muted).setFont(undefined, 'normal');
    doc.text(`Fecha de emisión: ${fmtD(invoice.fecha_emision)}`, 210 - M, Y + 20, { align: 'right' });
    if (invoice.fecha_vencimiento) {
      doc.text(`Vencimiento: ${fmtD(invoice.fecha_vencimiento)}`, 210 - M, Y + 24, { align: 'right' });
    }

    Y += 35;
    doc.setDrawColor(226, 232, 240);
    doc.line(M, Y, 210 - M, Y);
    Y += 6;

    // Emisor / Receptor
    doc.setFontSize(7).setTextColor(...muted).setFont(undefined, 'bold');
    doc.text('EMISOR', M, Y);
    doc.text('RECEPTOR', M + W / 2, Y);
    Y += 4;
    doc.setFont(undefined, 'normal').setFontSize(8).setTextColor(...dark);
    const issuerLines = [
      company?.nombre || 'Taxea Portal',
      company?.nif ? `NIF: ${company.nif}` : null,
      company?.direccion_fiscal || null,
    ].filter(Boolean);
    const clientLines = [
      invoice.cliente_nombre || '—',
      invoice.cliente_nif ? `NIF: ${invoice.cliente_nif}` : null,
    ].filter(Boolean);
    issuerLines.forEach((l) => { doc.text(l, M, Y); Y += 4; });
    const Y2 = Y - issuerLines.length * 4;
    clientLines.forEach((l, i) => doc.text(l, M + W / 2, Y2 + i * 4));

    Y += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(M, Y, 210 - M, Y);
    Y += 6;

    // Concepto
    if (invoice.concepto) {
      doc.setFontSize(7).setTextColor(...muted).setFont(undefined, 'bold');
      doc.text('CONCEPTO', M, Y);
      Y += 4;
      doc.setFont(undefined, 'normal').setFontSize(8).setTextColor(...dark);
      doc.text(invoice.concepto, M, Y);
      Y += 8;
    }

    // Tabla de líneas
    doc.setFillColor(...red);
    doc.rect(M, Y, W, 6, 'F');
    doc.setFontSize(7).setTextColor(255, 255, 255).setFont(undefined, 'bold');
    doc.text('Descripción', M + 2, Y + 4);
    doc.text('Cant.', M + 110, Y + 4, { align: 'center' });
    doc.text('Precio u.', M + 140, Y + 4, { align: 'right' });
    doc.text('Importe', M + W - 1, Y + 4, { align: 'right' });
    Y += 6;

    doc.setFont(undefined, 'normal').setTextColor(...dark);
    const lineas = invoice.lineas?.length ? invoice.lineas : [{
      descripcion: invoice.concepto || 'Servicio profesional',
      cantidad: 1,
      precio_unitario: invoice.base_imponible,
      importe: invoice.base_imponible,
    }];
    lineas.forEach((l, i) => {
      if (i % 2 === 1) { doc.setFillColor(...light); doc.rect(M, Y, W, 5.5, 'F'); }
      doc.setFontSize(7).setTextColor(...dark);
      doc.text(String(l.descripcion || l.concepto || '—').substring(0, 55), M + 2, Y + 4);
      doc.text(String(l.cantidad ?? 1), M + 110, Y + 4, { align: 'center' });
      doc.text(fmtN(l.precio_unitario || l.precio || 0), M + 140, Y + 4, { align: 'right' });
      doc.text(fmtN(l.importe || (l.cantidad || 1) * (l.precio_unitario || l.precio || 0)), M + W - 1, Y + 4, { align: 'right' });
      Y += 5.5;
    });

    Y += 6;

    // Totales (derecha)
    const totX = M + W / 2;
    const totW = W / 2;
    const addTotRow = (label, value, bold = false, colorArr = dark) => {
      doc.setFontSize(8).setTextColor(...muted).setFont(undefined, 'normal');
      doc.text(label, totX, Y);
      doc.setTextColor(...colorArr).setFont(undefined, bold ? 'bold' : 'normal');
      doc.text(value, totX + totW, Y, { align: 'right' });
      Y += 5;
    };
    doc.setDrawColor(226, 232, 240);
    doc.line(totX, Y, totX + totW, Y);
    Y += 4;
    addTotRow('Base imponible', fmtN(invoice.base_imponible));
    addTotRow(`IVA (${invoice.tipo_iva || 21}%)`, fmtN(invoice.cuota_iva));
    if (invoice.retencion_irpf > 0) addTotRow('Retención IRPF', `−${fmtN(invoice.retencion_irpf)}`, false, [220, 38, 38]);
    doc.line(totX, Y, totX + totW, Y); Y += 4;
    addTotRow('Total', fmtN(invoice.total_factura), true, red);

    // Método de pago
    if (invoice.metodo_pago || company?.iban) {
      Y += 6;
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(M, Y, W, invoice.metodo_pago && company?.iban ? 18 : 12, 2, 2, 'F');
      doc.setFontSize(7).setTextColor(5, 150, 105).setFont(undefined, 'bold');
      doc.text('INSTRUCCIONES DE PAGO', M + 3, Y + 4);
      doc.setFont(undefined, 'normal').setTextColor(...dark);
      if (invoice.metodo_pago) doc.text(`Método: ${invoice.metodo_pago}`, M + 3, Y + 9);
      if (company?.iban) doc.text(`IBAN: ${company.iban}`, M + 3, Y + (invoice.metodo_pago ? 14 : 9));
      Y += invoice.metodo_pago && company?.iban ? 22 : 16;
    }

    // Pie
    Y = 285;
    doc.setFontSize(7).setTextColor(...muted).setFont(undefined, 'normal');
    doc.text('Documento generado con Taxea Strategies · Portal de gestión financiera y fiscal', 105, Y, { align: 'center' });

    // Convertir a Blob y subir
    const pdfBlob = doc.output('blob');
    const fileName = `Factura_${(invoice.numero_factura || 'factura').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
    const { file_url } = await base44Client.integrations.Core.UploadFile({ file });

    // Guardar en la factura
    await base44Client.entities.Invoice.update(invoice.id, { archivo_url: file_url });

    return { ok: true, pdfUrl: file_url, fileName };
  } catch (e) {
    return { ok: false, error: e.message || 'Error generando PDF.' };
  }
}

/**
 * Genera el asunto del email según plantilla
 */
export function buildEmailSubject(invoice, company, templateId) {
  const issuerName = company?.nombre || 'Taxea';
  const invNumber = invoice?.numero_factura || '';
  const total = invoice?.total_factura != null
    ? invoice.total_factura.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €'
    : '';

  switch (templateId) {
    case 'recordatorio': return `Recordatorio de pago · Factura ${invNumber} · ${total}`;
    case 'vencida':      return `Factura ${invNumber} de ${issuerName} · Pendiente de pago`;
    case 'pagada':       return `Confirmación de pago · Factura ${invNumber}`;
    default:             return `Factura ${invNumber} de ${issuerName} · ${total}`;
  }
}

/**
 * Genera el asiento contable sugerido de una factura emitida
 * Devuelve { lines, cuadra, warnings, status }
 */
export function generateInvoiceAccountingEntry(invoice) {
  if (!invoice) return null;

  const total = invoice.total_factura || 0;
  const base = invoice.base_imponible || 0;
  const iva = invoice.cuota_iva || 0;
  const retencion = invoice.retencion_irpf || 0;
  const warnings = [];

  // Determinar cuentas según configuración o PGC por defecto
  const cuentaCliente = '430000';
  const descCliente = '430 · Clientes';
  const cuentaIngresos = invoice.concepto?.toLowerCase().includes('servicio') ? '705000' : '700000';
  const descIngresos = cuentaIngresos === '705000' ? '705 · Prestaciones de servicios' : '700 · Ventas de mercaderías';
  const cuentaIva = invoice.tipo_iva === 10 ? '477100' : invoice.tipo_iva === 4 ? '477200' : '477000';
  const descIva = `477 · H.P. IVA repercutido (${invoice.tipo_iva || 21}%)`;
  const cuentaRetencion = '4751000';
  const descRetencion = '4751 · H.P. retenciones y pagos a cuenta';

  const lines = [];

  // Línea 1: Cliente (Debe)
  lines.push({
    cuenta: cuentaCliente,
    descripcion: descCliente,
    debe: total,
    haber: 0,
    tags: ['cliente', 'deudor'],
    source: 'pgc_default',
    nota: 'Cuenta de clientes. Pendiente de validar si existe subcuenta del cliente.',
  });

  // Línea 2: Ingresos (Haber)
  lines.push({
    cuenta: cuentaIngresos,
    descripcion: descIngresos,
    debe: 0,
    haber: base,
    tags: ['ingresos'],
    source: base > 0 ? 'pgc_default' : 'incompleto',
    nota: base === 0 ? 'Base imponible no disponible.' : 'Sugerida por PGC. Configurar cuenta en el producto/servicio para mayor precisión.',
  });

  // Línea 3: IVA repercutido (Haber)
  if (iva > 0) {
    lines.push({
      cuenta: cuentaIva,
      descripcion: descIva,
      debe: 0,
      haber: iva,
      tags: ['iva', 'impuesto'],
      source: 'pgc_default',
      nota: 'IVA repercutido. Verificar tipo si es IVA reducido o superreducido.',
    });
  }

  // Línea 4: Retención IRPF (si existe)
  if (retencion > 0) {
    // La retención reduce el cobro del cliente y genera un crédito fiscal
    lines[0].debe = lines[0].debe - retencion; // Ajustar debe del cliente
    lines.push({
      cuenta: cuentaRetencion,
      descripcion: descRetencion,
      debe: retencion,
      haber: 0,
      tags: ['retencion', 'irpf'],
      source: 'pgc_default',
      nota: 'Retención IRPF a cuenta del emisor.',
    });
  }

  // Validar cuadre
  const totalDebe = lines.reduce((s, l) => s + (l.debe || 0), 0);
  const totalHaber = lines.reduce((s, l) => s + (l.haber || 0), 0);
  const cuadra = Math.abs(totalDebe - totalHaber) < 0.01;

  if (!cuadra) warnings.push(`Descuadre detectado: Debe ${fmt(totalDebe)} / Haber ${fmt(totalHaber)}`);
  if (base === 0) warnings.push('Base imponible cero: verificar datos de la factura.');
  if (!invoice.tipo_iva) warnings.push('Tipo de IVA no especificado. Se ha usado 21% por defecto.');

  const status = warnings.length > 0
    ? (cuadra ? 'pendiente_validar' : 'descuadrado')
    : 'generado';

  return { lines, cuadra, warnings, status, totalDebe, totalHaber };
}
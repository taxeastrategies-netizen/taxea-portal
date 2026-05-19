/**
 * invoicePremiumEmail.js — Generador de email HTML premium para facturas
 * Taxea Strategies · No requiere librerías externas
 */

const LOGO = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';
const BRAND_COLOR = '#b91c1c'; // taxea-red

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

  const headerColor = isOverdue ? '#dc2626' : isReminder ? '#d97706' : isPaid ? '#059669' : BRAND_COLOR;

  let headerTitle = 'Factura emitida';
  let headerSubtitle = `Documento ${invNumber}`;
  let introText = `Te enviamos la factura <strong>${invNumber}</strong> emitida por <strong>${issuerName}</strong>.`;

  if (isReminder) {
    headerTitle = 'Recordatorio de pago';
    headerSubtitle = `Factura ${invNumber} · Pendiente de pago`;
    introText = `Te recordamos que la factura <strong>${invNumber}</strong> emitida por <strong>${issuerName}</strong> está pendiente de pago.`;
  } else if (isOverdue) {
    headerTitle = 'Factura vencida';
    headerSubtitle = `Factura ${invNumber} · Requiere atención`;
    introText = `Nos ponemos en contacto porque la factura <strong>${invNumber}</strong> de <strong>${issuerName}</strong> está pendiente de pago y ha superado la fecha de vencimiento.`;
  } else if (isPaid) {
    headerTitle = 'Confirmación de pago';
    headerSubtitle = `Factura ${invNumber} · Pagada`;
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
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .header { background: ${headerColor}; padding: 28px 32px; }
    .header img { height: 36px; object-fit: contain; margin-bottom: 16px; display: block; }
    .header-brand { font-size: 11px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .header-title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 2px; }
    .header-subtitle { font-size: 13px; color: rgba(255,255,255,0.8); }
    .body { padding: 28px 32px; }
    .intro { font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 20px; }
    .total-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
    .total-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .total-amount { font-size: 26px; font-weight: 700; color: ${headerColor}; }
    .due-badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; background: ${invDue ? (isOverdue ? '#fef2f2' : '#fffbeb') : '#f1f5f9'}; color: ${invDue ? (isOverdue ? '#dc2626' : '#92400e') : '#64748b'}; border: 1px solid ${invDue ? (isOverdue ? '#fca5a5' : '#fcd34d') : '#e2e8f0'}; }
    .section-title { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 8px; }
    .detail-table { width: 100%; border-collapse: collapse; }
    .detail-table td { font-size: 13px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .detail-table td:first-child { color: #64748b; width: 48%; }
    .detail-table td:last-child { color: #1e293b; font-weight: 500; text-align: right; }
    .totals-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .totals-table td { font-size: 13px; padding: 5px 0; }
    .totals-table td:first-child { color: #64748b; }
    .totals-table td:last-child { text-align: right; font-weight: 600; color: #1e293b; }
    .totals-table .total-row td { font-size: 15px; font-weight: 700; color: ${headerColor}; border-top: 2px solid #e2e8f0; padding-top: 8px; }
    .payment-box { background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 16px; margin-top: 8px; }
    .payment-box .pm-label { font-size: 11px; color: #059669; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; }
    .payment-box .pm-row { font-size: 13px; color: #1e293b; margin-bottom: 3px; }
    .payment-box .pm-row span { color: #64748b; margin-right: 6px; }
    .cta-block { text-align: center; margin: 24px 0; }
    .btn-primary { display: inline-block; background: ${headerColor}; color: #ffffff !important; font-size: 14px; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none; letter-spacing: 0.3px; }
    .btn-secondary { display: inline-block; margin-top: 10px; font-size: 12px; color: #64748b; text-decoration: underline; }
    .attach-note { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #475569; display: flex; align-items: center; gap-6: 8px; margin-top: 16px; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
    .footer { padding: 18px 32px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; }
    .footer-issuer { font-size: 12px; color: #64748b; line-height: 1.6; }
    .footer-taxea { font-size: 11px; color: #94a3b8; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
    .footer-legal { font-size: 10px; color: #94a3b8; margin-top: 6px; }
    @media (max-width: 480px) {
      .wrapper { margin: 0; }
      .card { border-radius: 0; }
      .header, .body, .footer { padding: 20px 18px; }
      .total-amount { font-size: 22px; }
    }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="card">

    <!-- CABECERA -->
    <div class="header">
      <img src="${LOGO}" alt="Taxea Strategies" />
      <div class="header-brand">Taxea Strategies</div>
      <div class="header-title">${headerTitle}</div>
      <div class="header-subtitle">${headerSubtitle}</div>
    </div>

    <!-- CUERPO -->
    <div class="body">
      <p class="intro">Hola, <strong>${customerName}</strong>.<br/><br/>${introText}</p>

      <!-- TOTAL DESTACADO -->
      <div class="total-block">
        <div>
          <div class="total-label">Total a pagar</div>
          <div class="total-amount">${invTotal}</div>
        </div>
        ${invDue ? `<div><div class="total-label">Vencimiento</div><div class="due-badge">${invDue}</div></div>` : ''}
      </div>

      <!-- RESUMEN DE FACTURA -->
      <div class="section-title">Datos de la factura</div>
      <table class="detail-table">
        <tr><td>Nº de factura</td><td>${invNumber}</td></tr>
        <tr><td>Emisor</td><td>${issuerName}${issuerNif ? ` · ${issuerNif}` : ''}</td></tr>
        <tr><td>Receptor</td><td>${customerName}${customerNif ? ` · ${customerNif}` : ''}</td></tr>
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
        <div class="pm-label">Datos para el pago</div>
        ${paymentMethod ? `<div class="pm-row"><span>Método:</span>${paymentMethod}</div>` : ''}
        ${issuerIban ? `<div class="pm-row"><span>IBAN:</span>${maskIban(issuerIban)}</div>` : ''}
        ${issuerName ? `<div class="pm-row"><span>Titular:</span>${issuerName}</div>` : ''}
        <div class="pm-row" style="margin-top:6px;font-size:12px;color:#64748b;">Por favor, indica el número de factura <strong>${invNumber}</strong> como referencia del pago.</div>
      </div>` : ''}

      <hr class="divider" />

      <!-- CTA -->
      <div class="cta-block">
        <a href="${publicLink}" class="btn-primary">Ver factura online →</a>
        <br/>
        <a href="${publicLink}" class="btn-secondary">Si el botón no funciona, copia este enlace: ${publicLink}</a>
        <p style="font-size:12px;color:#94a3b8;margin-top:12px;">📎 También adjuntamos el PDF de la factura a este correo (${pdfName}).</p>
      </div>

      <p style="font-size:13px;color:#64748b;margin-top:12px;">Si tienes cualquier duda, puedes responder directamente a este email${issuerEmail ? ` o escribirnos a <a href="mailto:${issuerEmail}" style="color:${headerColor}">${issuerEmail}</a>` : ''}.</p>
    </div>

    <!-- PIE -->
    <div class="footer">
      <div class="footer-issuer">
        <strong>${issuerName}</strong>${issuerNif ? ` · ${issuerNif}` : ''}<br/>
        ${issuerAddress ? `${issuerAddress}<br/>` : ''}
        ${issuerEmail ? `${issuerEmail}` : ''}${issuerPhone ? ` · ${issuerPhone}` : ''}
      </div>
      <div class="footer-taxea">
        Gestionado con <strong>Taxea Strategies</strong> — Portal de gestión financiera y fiscal
      </div>
      <div class="footer-legal">
        Este correo electrónico y sus adjuntos son confidenciales y están destinados únicamente al destinatario indicado. Si lo ha recibido por error, por favor notifíquelo y elimínelo.
      </div>
    </div>

  </div>
</div>
</body>
</html>`;
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
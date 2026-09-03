/**
 * Envío transaccional de facturas desde el Gmail conectado por cada usuario.
 * La operación está limitada a facturas de la empresa activa y registra el éxito
 * únicamente después de que Gmail confirme el envío.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const GMAIL_CONNECTOR_ID = '6a1b49be4d83894815de65a2';
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function encodeHeader(value) {
  return `=?UTF-8?B?${bytesToBase64(new TextEncoder().encode(String(value || '')))}?=`;
}

function base64Lines(value) {
  return value.match(/.{1,76}/g)?.join('\r\n') || '';
}

function safeFilename(value) {
  return String(value || 'documento.pdf').replace(/[\r\n"]/g, '_').slice(0, 160);
}

function isSafeRemoteUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (/^(10|127|169\.254|192\.168)\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeEmails(input, label, required = false) {
  const values = (Array.isArray(input) ? input : input ? [input] : [])
    .map(value => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(values)];
  if (required && unique.length === 0) throw Object.assign(new Error(`Añade al menos un destinatario en ${label}.`), { status: 400 });
  if (unique.length > 10) throw Object.assign(new Error(`Demasiados destinatarios en ${label}.`), { status: 400 });
  const invalid = unique.filter(value => !EMAIL_RE.test(value));
  if (invalid.length) throw Object.assign(new Error(`Dirección no válida en ${label}: ${invalid.join(', ')}`), { status: 400 });
  return unique;
}

async function getGmailConnection(base44) {
  try {
    // El cliente se crea desde la petición autenticada: Base44 resuelve aquí
    // la conexión OAuth del usuario actual, nunca un buzón global compartido.
    const connection = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR_ID);
    return connection?.accessToken ? connection : null;
  } catch {
    return null;
  }
}

async function getConnectedEmail(connection) {
  const configured = connection?.connectionConfig?.email
    || connection?.connectionConfig?.emailAddress
    || connection?.connectionConfig?.accountEmail;
  if (configured && EMAIL_RE.test(configured)) return configured;
  // Fallback sin gmail.metadata: OpenID userinfo solo requiere el scope "email".
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${connection.accessToken}` },
  }).catch(() => null);
  if (!response?.ok) return '';
  const userinfo = await response.json().catch(() => ({}));
  return EMAIL_RE.test(userinfo.email || '') ? userinfo.email : '';
}

async function loadAttachments(input, allowedUrl, requireInvoicePdf) {
  const attachments = Array.isArray(input) ? input : [];
  if (requireInvoicePdf && attachments.length !== 1) {
    throw Object.assign(new Error('La factura debe enviarse con un único PDF adjunto.'), { status: 400 });
  }
  if (!requireInvoicePdf && attachments.length > 0) {
    throw Object.assign(new Error('Este tipo de documento no admite adjuntos en este flujo.'), { status: 400 });
  }
  const loaded = [];
  let totalSize = 0;
  for (const item of attachments) {
    const url = typeof item === 'string' ? item : item?.url;
    if (!url || url !== allowedUrl || !isSafeRemoteUrl(url)) {
      throw Object.assign(new Error('El adjunto no coincide con el PDF de la factura.'), { status: 400 });
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo descargar el PDF adjunto (${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('El PDF supera el límite de 10 MB.');
    totalSize += bytes.byteLength;
    if (totalSize > MAX_TOTAL_ATTACHMENT_BYTES) throw new Error('Los adjuntos superan el límite total de 20 MB.');
    loaded.push({
      name: safeFilename(typeof item === 'string' ? url.split('/').pop() : item.name),
      mimeType: 'application/pdf',
      content: bytesToBase64(bytes),
    });
  }
  return loaded;
}

function buildRawMessage({ from, to, cc, bcc, subject, html, attachments }) {
  const headers = [
    `From: ${from}`,
    `To: ${to.join(', ')}`,
  ];
  if (cc.length) headers.push(`Cc: ${cc.join(', ')}`);
  if (bcc.length) headers.push(`Bcc: ${bcc.join(', ')}`);
  headers.push(`Subject: ${encodeHeader(subject)}`, 'MIME-Version: 1.0');
  const boundary = `taxea_${crypto.randomUUID()}`;
  const htmlBase64 = base64Lines(bytesToBase64(new TextEncoder().encode(html)));
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`, '');
  const parts = [
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    htmlBase64,
  ];
  for (const attachment of attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.name}"`,
      '',
      base64Lines(attachment.content),
    );
  }
  parts.push(`--${boundary}--`, '');
  return [...headers, ...parts].join('\r\n');
}

function toBase64Url(raw) {
  return bytesToBase64(new TextEncoder().encode(raw))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  let base44;
  let user;
  let invoice;
  let companyId;
  let body = {};
  try {
    base44 = createClientFromRequest(req);
    user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    body = await req.json().catch(() => ({}));
    const connection = await getGmailConnection(base44);

    if (body.action === 'status') {
      if (!connection) return Response.json({ ok: true, connected: false, error: 'gmail_not_connected' });
      const email = await getConnectedEmail(connection);
      return Response.json({ ok: true, connected: Boolean(email), email, scope: 'user' });
    }

    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    companyId = body.company_id || user.data?.company_id;
    if (!companyId || (!isAdmin && body.company_id && body.company_id !== user.data?.company_id)) {
      return Response.json({ error: 'La empresa activa no es válida.' }, { status: 403 });
    }
    if (body.invoice_id) {
      invoice = await base44.asServiceRole.entities.Invoice.get(body.invoice_id).catch(() => null);
      if (!invoice || invoice.company_id !== companyId) {
        return Response.json({ error: 'Factura no encontrada en la empresa activa.' }, { status: 404 });
      }
      if (invoice.anulada) return Response.json({ error: 'No se puede enviar una factura anulada.' }, { status: 409 });
    } else {
      const entityName = body.document_type === 'quote' ? 'Quote' : body.document_type === 'proforma' ? 'Proforma' : '';
      if (!entityName || !body.document_id) {
        return Response.json({ error: 'El documento de origen no es válido.' }, { status: 400 });
      }
      const document = await base44.asServiceRole.entities[entityName].get(body.document_id).catch(() => null);
      if (!document || document.company_id !== companyId) {
        return Response.json({ error: 'Documento no encontrado en la empresa activa.' }, { status: 404 });
      }
    }
    if (!connection) {
      return Response.json({
        error: 'gmail_not_connected',
        message: 'Conecta tu cuenta Gmail para enviar desde tu propio correo.',
      }, { status: 403 });
    }

    const to = normalizeEmails(body.to, 'Para', true);
    const cc = normalizeEmails(body.cc, 'CC');
    const bcc = normalizeEmails(body.bcc, 'CCO');
    const subject = String(body.subject || '').trim().slice(0, 240);
    const html = String(body.html || '');
    if (!subject || !html || html.length > 250_000) {
      return Response.json({ error: 'El asunto o el contenido del email no son válidos.' }, { status: 400 });
    }
    if (invoice && !invoice.archivo_url) return Response.json({ error: 'La factura no tiene un PDF preparado.' }, { status: 409 });
    if (invoice && (!invoice.public_token || !String(body.public_invoice_url || '').endsWith(`/public/invoice/${invoice.public_token}`))) {
      return Response.json({ error: 'El enlace público de la factura no está validado.' }, { status: 409 });
    }

    const idempotencyKey = String(body.idempotency_key || '').trim().slice(0, 100);
    if (invoice && idempotencyKey) {
      const duplicate = await base44.asServiceRole.entities.InvoiceEmailLog.filter({
        company_id: companyId,
        invoice_id: invoice.id,
        idempotency_key: idempotencyKey,
        delivery_status: 'enviada',
      }, '-sent_at', 1);
      if (duplicate?.[0]) {
        return Response.json({
          ok: true,
          duplicate: true,
          id: duplicate[0].provider_message_id || '',
          thread_id: duplicate[0].provider_thread_id || '',
          via: 'gmail',
          from: duplicate[0].sender_email || '',
          attachment_count: duplicate[0].attachments?.length || 0,
        });
      }
    }

    const attachments = await loadAttachments(body.attachments, invoice?.archivo_url, Boolean(invoice));
    const connectedEmail = await getConnectedEmail(connection);
    if (!connectedEmail) {
      return Response.json({ error: 'gmail_identity_unavailable', message: 'No se pudo identificar el buzón Gmail conectado.' }, { status: 502 });
    }
    const senderName = String(body.from_name || 'Taxea Portal').replace(/[\r\n"]/g, '').slice(0, 100);
    const raw = buildRawMessage({
      from: `"${senderName}" <${connectedEmail}>`,
      to,
      cc,
      bcc,
      subject,
      html,
      attachments,
    });
    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${connection.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: toBase64Url(raw) }),
    });
    const gmailData = await gmailResponse.json().catch(() => ({}));
    if (!gmailResponse.ok) {
      const authorizationExpired = gmailResponse.status === 401 || gmailResponse.status === 403;
      throw Object.assign(new Error(gmailData.error?.message || 'Gmail no ha aceptado el envío.'), {
        status: authorizationExpired ? 403 : 502,
        code: authorizationExpired ? 'gmail_authorization_expired' : 'gmail_send_failed',
      });
    }

    const now = new Date().toISOString();
    let trackingWarning = '';
    try {
      if (invoice) await base44.asServiceRole.entities.InvoiceEmailLog.create({
        invoice_id: invoice.id,
        company_id: companyId,
        to: to.join(', '),
        cc: cc.join(', '),
        bcc: bcc.join(', '),
        subject,
        body: html,
        template_id: String(body.template_id || 'envio_factura').slice(0, 80),
        attachments: [invoice.archivo_url],
        public_invoice_url: body.public_invoice_url,
        pdf_attachment_name: attachments[0]?.name || '',
        sent_at: now,
        sent_by: user.full_name || user.email || 'Usuario',
        sender_email: connectedEmail,
        provider_message_id: gmailData.id || '',
        provider_thread_id: gmailData.threadId || '',
        idempotency_key: idempotencyKey || '',
        delivery_status: 'enviada',
        to_was_manual: Boolean(body.to_was_manual),
        error_message: null,
      });
      if (invoice) await base44.asServiceRole.entities.Invoice.update(invoice.id, { estado_envio: 'enviada' });
      if (invoice) await base44.asServiceRole.entities.InvoiceTimelineEvent.create({
        invoice_id: invoice.id,
        company_id: companyId,
        event_type: 'email_enviado',
        event_label: 'Email enviado',
        event_detail: `Enviado a ${to.join(', ')} · PDF adjunto · Gmail ${connectedEmail}`,
        created_at: now,
        created_by: user.full_name || user.email || 'Usuario',
        origin: 'manual',
      });
    } catch (trackingError) {
      trackingWarning = 'El correo se envió, pero parte de la trazabilidad no pudo guardarse.';
      console.error('[sendEmail] tracking after Gmail success:', trackingError);
    }

    return Response.json({
      ok: true,
      id: gmailData.id,
      thread_id: gmailData.threadId,
      via: 'gmail',
      from: connectedEmail,
      attachment_count: attachments.length,
      warning: trackingWarning || undefined,
    });
  } catch (error) {
    console.error('[sendEmail]', error);
    if (base44 && invoice && companyId) {
      await base44.asServiceRole.entities.InvoiceEmailLog.create({
        invoice_id: invoice.id,
        company_id: companyId,
        to: Array.isArray(body.to) ? body.to.join(', ') : String(body.to || ''),
        subject: String(body.subject || '').slice(0, 240),
        sent_at: new Date().toISOString(),
        sent_by: user?.full_name || user?.email || 'Usuario',
        delivery_status: 'error_envio',
        error_message: String(error?.message || 'Error desconocido').slice(0, 500),
      }).catch(() => {});
    }
    return Response.json({ error: error?.code || 'send_failed', message: error?.message || 'Error interno.' }, { status: error?.status || 500 });
  }
});
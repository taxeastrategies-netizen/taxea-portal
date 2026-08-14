/**
 * Envía emails desde el Gmail conectado del usuario.
 * Permite comprobar el estado del conector sin enviar y adjuntar archivos remotos.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const GMAIL_CONNECTOR_ID = '6a1b49be4d83894815de65a2';
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

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

async function loadAttachments(input) {
  const attachments = Array.isArray(input) ? input : [];
  const loaded = [];
  let totalSize = 0;

  for (const item of attachments) {
    const url = typeof item === 'string' ? item : item?.url;
    if (!url || !isSafeRemoteUrl(url)) throw new Error('URL de adjunto no permitida.');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se pudo descargar el adjunto (${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error('Un adjunto supera el límite de 10 MB.');
    totalSize += bytes.byteLength;
    if (totalSize > MAX_TOTAL_ATTACHMENT_BYTES) throw new Error('Los adjuntos superan el límite total de 20 MB.');
    loaded.push({
      name: safeFilename(typeof item === 'string' ? url.split('/').pop() : item.name),
      mimeType: (typeof item === 'object' && item.mimeType) || response.headers.get('content-type') || 'application/octet-stream',
      content: bytesToBase64(bytes),
    });
  }
  return loaded;
}

function buildRawMessage({ from, to, cc, bcc, subject, html, attachments }) {
  const headers = [
    `From: ${from}`,
    `To: ${Array.isArray(to) ? to.join(', ') : to}`,
  ];
  if (cc?.length) headers.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
  if (bcc?.length) headers.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
  headers.push(`Subject: ${encodeHeader(subject)}`, 'MIME-Version: 1.0');

  const htmlBase64 = base64Lines(bytesToBase64(new TextEncoder().encode(html)));
  if (!attachments.length) {
    headers.push('Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', htmlBase64);
    return headers.join('\r\n');
  }

  const boundary = `taxea_${crypto.randomUUID()}`;
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
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    let connection;
    try {
      connection = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR_ID);
    } catch {
      connection = null;
    }

    if (body.action === 'status') {
      if (!connection?.accessToken) {
        return Response.json({ ok: true, connected: false, error: 'gmail_not_connected' });
      }
      const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      });
      const profile = await profileRes.json().catch(() => ({}));
      return Response.json({
        ok: profileRes.ok,
        connected: profileRes.ok,
        email: profile.emailAddress || '',
        error: profileRes.ok ? undefined : 'gmail_profile_failed',
      }, { status: profileRes.ok ? 200 : 502 });
    }

    const { to, cc, bcc, subject, html, from_name, attachments: attachmentInput } = body;
    if (!to || !subject || !html) {
      return Response.json({ error: 'Faltan campos requeridos: to, subject, html' }, { status: 400 });
    }
    if (!connection?.accessToken) {
      return Response.json({
        error: 'gmail_not_connected',
        message: 'Conecta tu cuenta Gmail para enviar emails desde tu propio correo.',
      }, { status: 403 });
    }

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
    const profile = await profileRes.json().catch(() => ({}));
    if (!profileRes.ok || !profile.emailAddress) {
      return Response.json({ error: 'gmail_profile_failed' }, { status: 502 });
    }

    const toArray = (Array.isArray(to) ? to : [to]).filter(Boolean);
    const ccArray = (cc ? (Array.isArray(cc) ? cc : [cc]) : []).filter(Boolean);
    const bccArray = (bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : []).filter(Boolean);
    const attachments = await loadAttachments(attachmentInput);
    const fromAddress = from_name ? `"${String(from_name).replace(/[\r\n"]/g, '')}" <${profile.emailAddress}>` : profile.emailAddress;
    const raw = buildRawMessage({
      from: fromAddress,
      to: toArray,
      cc: ccArray,
      bcc: bccArray,
      subject,
      html,
      attachments,
    });

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${connection.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: toBase64Url(raw) }),
    });
    const gmailData = await gmailRes.json().catch(() => ({}));
    if (!gmailRes.ok) {
      return Response.json({
        error: 'gmail_send_failed',
        message: gmailData.error?.message || 'Gmail send failed',
      }, { status: 502 });
    }

    return Response.json({
      ok: true,
      id: gmailData.id,
      via: 'gmail',
      from: profile.emailAddress,
      attachmentCount: attachments.length,
    });
  } catch (error) {
    console.error('sendEmail error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
});

/**
 * Envía emails desde la cuenta Gmail del propio cliente (app user connector)
 * Fallback a Resend si Gmail no está conectado
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GMAIL_CONNECTOR_ID = '6a10346bedd89bd7e97c35ed';

function encodeSubject(subject) {
  const bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function buildRawMessage({ from, to, cc, bcc, subject, html }) {
  const toStr = Array.isArray(to) ? to.join(', ') : to;
  const headers = [`From: ${from}`, `To: ${toStr}`];
  if (cc?.length > 0) headers.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
  if (bcc?.length > 0) headers.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
  headers.push(`Subject: ${encodeSubject(subject)}`);
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/html; charset=UTF-8');
  headers.push('Content-Transfer-Encoding: base64');
  headers.push('');
  const htmlBytes = new TextEncoder().encode(html);
  let binary = '';
  for (const byte of htmlBytes) binary += String.fromCharCode(byte);
  headers.push(btoa(binary));
  return headers.join('\r\n');
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { to, cc, bcc, subject, html, from_name } = await req.json();
    if (!to || !subject || !html) {
      return Response.json({ error: 'Faltan campos requeridos: to, subject, html' }, { status: 400 });
    }

    const toArray = Array.isArray(to) ? to : [to];
    const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean) : [];
    const bccArray = bcc ? (Array.isArray(bcc) ? bcc : [bcc]).filter(Boolean) : [];

    // ── 1. Intentar enviar desde Gmail del cliente ─────────────────────────────
    let gmailConnected = false;
    try {
      const conn = await base44.asServiceRole.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR_ID);
      if (conn?.accessToken) {
        gmailConnected = true;
        const accessToken = conn.accessToken;

        // Obtener email del usuario en Gmail
        const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const profile = await profileRes.json();
        const fromEmail = profile.emailAddress;
        const fromAddress = from_name ? `"${from_name}" <${fromEmail}>` : fromEmail;

        const raw = buildRawMessage({ from: fromAddress, to: toArray, cc: ccArray, bcc: bccArray, subject, html });

        const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: toBase64Url(raw) }),
        });
        const gmailData = await gmailRes.json();
        if (!gmailRes.ok) throw new Error(gmailData.error?.message || 'Gmail send failed');

        return Response.json({ ok: true, id: gmailData.id, via: 'gmail', from: fromEmail });
      }
    } catch (gmailErr) {
      if (gmailConnected) {
        // Gmail estaba conectado pero falló al enviar
        console.error('Gmail send error:', gmailErr.message);
        return Response.json({ error: 'gmail_send_failed', message: gmailErr.message }, { status: 500 });
      }
      // Gmail no conectado — continuar con Resend
    }

    // ── 2. Gmail no conectado → devolver error específico ─────────────────────
    return Response.json({
      error: 'gmail_not_connected',
      message: 'Conecta tu cuenta Gmail para enviar emails desde tu propio correo.',
    }, { status: 403 });

  } catch (error) {
    console.error('sendEmail error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
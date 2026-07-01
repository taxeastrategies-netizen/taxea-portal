/**
 * Función backend para enviar WhatsApp via Twilio
 * Compatible con WhatsApp Business API (Twilio Sandbox / Production)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acceso restringido a administradores' }, { status: 403 });
    }

    const { to, mensaje, whatsapp_log_id } = await req.json().catch(() => ({}));

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM') || 'whatsapp:+14155238886'; // Sandbox por defecto

    if (!accountSid || !authToken) {
      return Response.json({
        success: false,
        error: 'Twilio no configurado. Configura TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_FROM en los secretos.'
      }, { status: 200 }); // 200 para que el portal lo maneje gracefully
    }

    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const body = new URLSearchParams({
      From: fromNumber,
      To: toFormatted,
      Body: mensaje,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Actualizar log con error
      if (whatsapp_log_id) {
        await base44.asServiceRole.entities.WhatsAppLog.update(whatsapp_log_id, {
          estado: 'error',
          error_detalle: data.message || 'Error desconocido',
        });
      }
      return Response.json({ success: false, error: data.message, code: data.code });
    }

    // Actualizar log como enviado
    if (whatsapp_log_id) {
      await base44.asServiceRole.entities.WhatsAppLog.update(whatsapp_log_id, {
        estado: 'enviado',
        message_sid: data.sid,
      });
    }

    return Response.json({ success: true, sid: data.sid, status: data.status });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const PORTAL_ORIGIN = 'https://taxeaportal.com';
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function safeSetupUrl(candidate) {
  try {
    const url = new URL(candidate);
    if (url.origin !== PORTAL_ORIGIN || url.pathname !== '/setup-password') return null;
    return url.toString();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
    if (!['admin', 'super_admin'].includes(user.role)) {
      return Response.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { email, clientName, setupUrl, isResend } = await req.json().catch(() => ({}));

    if (!email || !clientName || !setupUrl) {
      return Response.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Email no válido' }, { status: 400 });
    }
    const validatedSetupUrl = safeSetupUrl(setupUrl);
    if (!validatedSetupUrl) {
      return Response.json({ error: 'URL de configuración no válida' }, { status: 400 });
    }
    const safeClientName = escapeHtml(clientName);
    const safeLink = escapeHtml(validatedSetupUrl);

    const subject = isResend
      ? `Acceso a tu portal Taxea Strategies — Nuevo enlace`
      : `Bienvenido/a a Taxea Strategies — Configura tu acceso`;

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #b91c3c; font-size: 24px; margin: 0;">Taxea Strategies</h1>
  </div>
  <h2 style="font-size: 20px;">${isResend ? 'Nuevo enlace de acceso' : 'Bienvenido/a al portal'}</h2>
  <p>Hola <strong>${safeClientName}</strong>,</p>
  <p>${isResend
    ? 'Te enviamos un nuevo enlace para acceder a tu portal privado.'
    : 'Tu cuenta en el portal privado de Taxea Strategies ha sido creada correctamente.'
  }</p>
  <p>Haz clic en el botón para configurar tu contraseña y acceder:</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${safeLink}" style="background-color: #b91c3c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
      Acceder al portal
    </a>
  </div>
  <p style="color: #666; font-size: 13px;">Este enlace es válido durante 72 horas. Si tienes dudas, contacta con nosotros.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  <p style="color: #999; font-size: 12px; text-align: center;">Taxea Strategies · Asesoría fiscal y contable</p>
</body>
</html>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Taxea Strategies <onboarding@resend.dev>',
        to: [email],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend error:', resendData);
      return Response.json({ error: resendData.message || 'Error enviando email' }, { status: 500 });
    }

    return Response.json({ success: true, id: resendData.id });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
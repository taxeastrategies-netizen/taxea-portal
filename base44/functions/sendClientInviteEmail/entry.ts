import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const adminRoles = ['admin', 'super_admin', 'gestor', 'asesor'];
    if (!user || !adminRoles.includes(user.role)) {
      return Response.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const { email, clientName, setupUrl, isResend } = await req.json();
    if (!email || !setupUrl) {
      return Response.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const subject = isResend
      ? 'Nuevo enlace de acceso — Taxea Portal'
      : 'Activa tu acceso a Taxea Portal';

    const body = `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <div style="background:#ffffff;padding:32px 40px 20px;text-align:center;border-bottom:1px solid #f3f4f6;">
          <img src="https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/b059a58db_ChatGPTImage7may202610_56_53pm.png"
               alt="Taxea Strategies" style="height:56px;object-fit:contain;" />
        </div>

        <!-- Body -->
        <div style="padding:36px 40px;">
          <h2 style="font-size:22px;font-weight:700;color:#1e293b;margin:0 0 16px 0;">
            ${isResend ? 'Nuevo enlace de acceso' : 'Tu acceso privado está listo'}
          </h2>
          <p style="color:#475569;font-size:15px;line-height:1.65;margin:0 0 8px 0;">Hola, <strong>${clientName || email}</strong>,</p>
          <p style="color:#475569;font-size:15px;line-height:1.65;margin:0 0 20px 0;">
            Taxea Strategies ha ${isResend ? 'generado un nuevo enlace de acceso para' : 'creado tu acceso privado al'} <strong>Portal de Clientes Taxea</strong>.
          </p>
          <p style="color:#475569;font-size:14px;line-height:1.65;margin:0 0 6px 0;">
            Tu usuario de acceso es: <strong style="color:#1e293b;">${email}</strong>
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.65;margin:0 0 28px 0;">
            Para activar tu cuenta, establece tu contraseña personal desde el siguiente enlace seguro:
          </p>

          <!-- CTA Button -->
          <div style="text-align:center;margin:0 0 28px 0;">
            <a href="${setupUrl}"
               style="display:inline-block;background:#b91c2c;color:#ffffff;font-weight:600;font-size:16px;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.01em;">
              Establecer contraseña
            </a>
          </div>

          <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin:0 0 6px 0;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:
          </p>
          <p style="color:#b91c2c;font-size:13px;word-break:break-all;margin:0 0 28px 0;">
            <a href="${setupUrl}" style="color:#b91c2c;">${setupUrl}</a>
          </p>

          <div style="background:#fef9f0;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin:0 0 8px 0;">
            <p style="color:#92400e;font-size:12px;line-height:1.5;margin:0;">
              ⚠️ Por seguridad, este enlace es personal e intransferible. Si no has solicitado este acceso o el enlace ha expirado, contacta con Taxea Strategies.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:18px 40px;text-align:center;border-top:1px solid #f1f5f9;">
          <p style="color:#94a3b8;font-size:11px;margin:0;">
            Taxea Strategies · Portal de Clientes ·
            <a href="mailto:info@taxeastrategies.com" style="color:#94a3b8;">info@taxeastrategies.com</a>
          </p>
        </div>
      </div>
    `;

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
        html: body,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      throw new Error(`Resend error ${resendRes.status}: ${errText}`);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
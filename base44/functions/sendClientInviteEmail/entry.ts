import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { email, clientName, setupUrl, isResend } = await req.json();

    if (!email || !clientName || !setupUrl) {
      return Response.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const subject = isResend
      ? `Acceso a tu portal Taxea Strategies — Nuevo enlace`
      : `Bienvenido/a a Taxea Strategies — Configura tu acceso`;

    const body = `
Hola ${clientName},

${isResend ? 'Te enviamos un nuevo enlace de acceso a tu portal.' : 'Tu cuenta en el portal privado de Taxea Strategies ha sido creada.'}

Para configurar tu contraseña y acceder, haz clic en el siguiente enlace:

${setupUrl}

Este enlace es válido durante 72 horas. Si tienes alguna duda, contacta con nosotros.

Un saludo,
El equipo de Taxea Strategies
    `.trim();

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject,
      body,
      from_name: 'Taxea Strategies',
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error enviando email:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
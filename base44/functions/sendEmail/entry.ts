/**
 * Backend email sender using Resend API
 * Supports to, cc, bcc, html body, subject, from_name
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, cc, bcc, subject, html, from_name } = await req.json();

    if (!to || !subject || !html) {
      return Response.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const fromAddress = from_name
      ? `${from_name} <onboarding@resend.dev>`
      : 'Taxea Portal <onboarding@resend.dev>';

    const toArray = Array.isArray(to) ? to : [to];
    const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean) : undefined;
    const bccArray = bcc ? (Array.isArray(bcc) ? bcc : [bcc]).filter(Boolean) : undefined;

    const payload = {
      from: fromAddress,
      to: toArray,
      subject,
      html,
    };
    if (ccArray && ccArray.length > 0) payload.cc = ccArray;
    if (bccArray && bccArray.length > 0) payload.bcc = bccArray;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return Response.json({ error: data.message || 'Failed to send email', details: data }, { status: 500 });
    }

    return Response.json({ ok: true, id: data.id });
  } catch (error) {
    console.error('sendEmail error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
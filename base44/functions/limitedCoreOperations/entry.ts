import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {assetIdFromReference,authorizedAsset,resolvePrivateAsset} from './storageRuntime.generated.mjs';

// Las propiedades ampliadas pueden llegar en la raíz o en data según la versión del SDK.
function isTaxeaAccountDisabled(account) {
  return [account, account?.data].filter(Boolean).some(state =>
    state.is_deleted === true
    || ['eliminado', 'bloqueado', 'suspendido'].includes(String(state.status || '').trim().toLowerCase())
    || ['suspended', 'blocked', 'disabled', 'deleted'].includes(String(state.accountAccessStatus || '').trim().toLowerCase()));
}


const APP_ID = '6a00fec50cc522a74ddde4b2';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const limits = {
  extract: { minute: 4, day: 15 },
  reminder: { minute: 2, day: 10 },
  tax_notice: { minute: 10, day: 100 },
};
const norm = (value: unknown) => String(value || '').trim().toLowerCase();
const isAdmin = (user: any) => user.role === 'admin' || user.role === 'super_admin';

function safeAppFileUrl(raw: unknown) {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'base44.app'
      && !url.username && !url.password && !url.port && !url.hash
      && url.pathname.startsWith('/api/apps/' + APP_ID + '/files/mp/');
  } catch { return false; }
}

async function allowedCompany(svc: any, user: any, companyId: string) {
  const company = await svc.entities.Company.get(companyId).catch(() => null);
  if (!company || company.activa === false) return null;
  if (isAdmin(user)) return company;
  const email = norm(user.email);
  if (norm(company.owner_email) === email
    || (Array.isArray(company.usuarios_autorizados) && company.usuarios_autorizados.some((value: unknown) => norm(value) === email))) return company;
  return null;
}

Deno.serve(async (req) => {
  let client: any;
  let event: any;
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Método no permitido' }, { status: 405 });
    // The SDK reads the caller from Authorization, separately from its service token.
    // Reject absent or malformed user credentials before constructing a privileged client.
    const callerAuthorization = req.headers.get('Authorization') || '';
    if (!/^Bearer [^\s]{1,16384}$/.test(callerAuthorization)) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }
    client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'No autenticado' }, { status: 401 });
    if (isTaxeaAccountDisabled(user)) return Response.json({ error: 'Acceso al portal suspendido.', code: 'ACCOUNT_DISABLED' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const operation = String(body.operation || '');
    if (!Object.hasOwn(limits, operation)) return Response.json({ error: 'Operación no admitida' }, { status: 400 });
    const companyId = String(body.companyId || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(companyId)) return Response.json({ error: 'Empresa no válida' }, { status: 400 });
    const svc = client.asServiceRole;
    const company = await allowedCompany(svc, user, companyId);
    if (!company) return Response.json({ error: 'Empresa no autorizada' }, { status: 403 });
    if (operation === 'tax_notice' && !isAdmin(user)) return Response.json({ error: 'Solo administrador' }, { status: 403 });

    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    const minuteKey = now.toISOString().slice(0, 16);
    let targetId = '';
    let params: Record<string, unknown> = {};

    if (operation === 'extract') {
      let providerFileUrl=body.file_url;
      const assetId=assetIdFromReference(body.file_url);
      if(assetId){
        const asset=await authorizedAsset(svc,user,assetId);
        if(!asset||asset.company_id!==companyId)return Response.json({error:'Archivo no disponible'},{status:404});
        const resolved=await resolvePrivateAsset(svc,user,assetId,Deno.env);
        if(!resolved)return Response.json({error:'Archivo no disponible'},{status:404});
        providerFileUrl=resolved.url;
      }else if (!safeAppFileUrl(body.file_url)) return Response.json({ error: 'Archivo no admitido' }, { status: 400 });
      const schema = body.json_schema;
      if (!schema || typeof schema !== 'object' || Array.isArray(schema) || JSON.stringify(schema).length > 30000) {
        return Response.json({ error: 'Esquema de extracción no válido' }, { status: 400 });
      }
      targetId = String(body.file_url);
      params = { file_url: providerFileUrl, json_schema: schema };
    } else if (operation === 'reminder') {
      // Preserve the authenticated caller so Base44 resolves that user's Gmail.
      // Never send client reminders through the shared Core email identity.
      const response = await client.functions.invoke('sendEmail', {
        action: 'reminder', company_id: companyId, invoice_id: String(body.invoiceId || ''),
      });
      return Response.json({ok:true,result:response?.data ?? response});
    } else {
      const document = await svc.entities.Document.get(String(body.documentId || '')).catch(() => null);
      if (!document || document.company_id !== companyId || document.fiscal_document_kind !== 'justificante_presentacion') {
        return Response.json({ error: 'Justificante fiscal no disponible' }, { status: 404 });
      }
      const recipient = norm(company.email || company.owner_email);
      if (!EMAIL_RE.test(recipient)) return Response.json({ error: 'Empresa sin correo válido' }, { status: 400 });
      const subject = String(body.subject || '').trim();
      const html = String(body.body || '');
      if (!subject || subject.length > 240 || !html || html.length > 50000) {
        return Response.json({ error: 'Correo fiscal no válido' }, { status: 400 });
      }
      targetId = String(document.id);
      params = { to: recipient, from_name: 'Taxea Strategies', subject, body: html };
    }

    const usage = await svc.entities.CoreIntegrationUsage.filter({
      userId: String(user.id), dayKey, operation,
    }, '-created_date', 500, 0);
    const active = (usage || []).filter((row: any) => row.status !== 'error');
    const perMinute = active.filter((row: any) => row.minuteKey === minuteKey).length;
    const cap = limits[operation as keyof typeof limits];
    if (active.length >= cap.day || perMinute >= cap.minute) {
      return Response.json({ error: 'Límite temporal de uso alcanzado' }, { status: 429 });
    }
    if (operation !== 'extract' && active.some((row: any) => row.targetId === targetId)) {
      return Response.json({ error: 'Este aviso ya fue solicitado hoy' }, { status: 409 });
    }
    event = await svc.entities.CoreIntegrationUsage.create({
      userId: String(user.id), companyId, dayKey, minuteKey, operation, targetId, status: 'reserved',
    });
    const result = operation === 'extract'
      ? await svc.integrations.Core.ExtractDataFromUploadedFile(params)
      : await svc.integrations.Core.SendEmail(params);
    await svc.entities.CoreIntegrationUsage.update(event.id, { status: 'success', completedAt: new Date().toISOString() });
    return Response.json({ ok: true, result });
  } catch (error) {
    if (/^Invalid (?:service role )?authorization header format/.test(String(error?.message||''))) return Response.json({error:'No autenticado'},{status:401});
    console.error('[limitedCoreOperations] provider_or_internal_error');
    if (event?.id && client?.asServiceRole?.entities?.CoreIntegrationUsage) {
      await client.asServiceRole.entities.CoreIntegrationUsage.update(event.id, {
        status: 'error', completedAt: new Date().toISOString(),
      }).catch(() => {});
    }
    const upstream=error?.response?.data;
    const safeCodes=['gmail_not_connected','gmail_identity_unavailable','gmail_authorization_expired','reminder_busy','reminder_already_requested','reminder_limit','reminder_delivery_uncertain','reminder_rejected','invoice_unavailable'];
    const code=safeCodes.includes(upstream?.error)?upstream.error:'operation_failed';
    const messages={gmail_not_connected:'Conecta tu Gmail para enviar el recordatorio desde tu correo.',gmail_identity_unavailable:'No se pudo identificar tu Gmail.',gmail_authorization_expired:'Vuelve a conectar tu Gmail.',reminder_busy:'Hay un envío en curso. Espera antes de volver a intentarlo.',reminder_already_requested:'Este recordatorio ya se solicitó hoy. Revisa tu carpeta Enviados.',reminder_limit:'Límite temporal de recordatorios alcanzado.',reminder_delivery_uncertain:'Gmail no confirmó el resultado. Revisa Enviados antes de repetir; el portal no reenviará automáticamente.',reminder_rejected:'Gmail no aceptó el recordatorio. No se ha enviado.',invoice_unavailable:'Factura no disponible para este recordatorio.'};
    const status=Number(error?.response?.status);
    return Response.json({error:code,message:messages[code]||'No se pudo completar la operación'}, {status:[400,401,403,404,409,429,502,503,504].includes(status)?status:502});
  }
});

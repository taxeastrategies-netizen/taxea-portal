import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {assetIdFromReference,invoicePdfReference,publicInvoiceCapabilityValid,readPublicInvoicePdf} from './storageRuntime.generated.mjs';
import {readPublicInvoiceRequest} from './publicInvoiceRequest.mjs';

const pick = (source, keys) => Object.fromEntries(
  keys.filter(key => source?.[key] !== undefined).map(key => [key, source[key]])
);

const publicJson = (body, init = {}) => Response.json(body, {
  ...init,
  headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff', ...(init.headers || {}) },
});

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return publicJson({ error: 'Método no permitido.' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    let body;try{body=await readPublicInvoiceRequest(req);}catch{return publicJson({error:'Solicitud no válida.'},{status:400});}
    const action=body.action||'view';
    if(!['view','download','download_pdf'].includes(action))return publicJson({error:'Operación no admitida.'},{status:400});
    const token = String(body.token || '').trim();

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return publicJson({ error: 'Enlace no válido.' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities.Invoice.filter({ public_token: token }, '-created_date', 2);
    const invoice = records?.[0];
    if (!invoice || records.length !== 1) {
      return publicJson({ error: 'Factura no encontrada.' }, { status: 404 });
    }
    if (invoice.anulada) {
      return publicJson({ error: 'Esta factura ha sido anulada.' }, { status: 410 });
    }
    if (invoice.public_token_revoked_at) {
      return publicJson({ error: 'Este enlace ha sido revocado.' }, { status: 410 });
    }
    if (invoice.public_token_expires_at && new Date(invoice.public_token_expires_at) < new Date()) {
      return publicJson({ error: 'Este enlace ha caducado.' }, { status: 410 });
    }

    if(!publicInvoiceCapabilityValid(invoice,token))return publicJson({error:'Este enlace no está disponible.'},{status:410});
    const company = await base44.asServiceRole.entities.Company.get(invoice.company_id);
    if (!company || company.activa===false) return publicJson({ error: 'Emisor no disponible.' }, { status: 404 });
    let privatePdf;
    const privatePdfReference=assetIdFromReference(invoicePdfReference(invoice));
    if(action==='download_pdf'){
      if(!privatePdfReference)return publicJson({error:'El PDF privado no está disponible.'},{status:404});
      try{privatePdf=await readPublicInvoicePdf(base44.asServiceRole,invoice,token,Deno.env);}catch{return publicJson({error:'No se pudo verificar el PDF de esta factura.'},{status:404});}
    }

    const logs = await base44.asServiceRole.entities.InvoiceEmailLog.filter({
      invoice_id: invoice.id,
      company_id: invoice.company_id,
    }, '-sent_at', 1).catch(() => []);

    if (logs?.[0] && !logs[0].opened_at) {
      await base44.asServiceRole.entities.InvoiceEmailLog.update(logs[0].id, {
        delivery_status: 'abierta',
        opened_at: new Date().toISOString(),
      }).catch(() => {});
    }

    const isDownload = action === 'download' || action === 'download_pdf';
    const publicEventType = isDownload ? 'enlace_publico_descarga' : 'enlace_publico_abierto';
    const recentEvents = await base44.asServiceRole.entities.InvoiceTimelineEvent.filter({
      invoice_id: invoice.id,
      company_id: invoice.company_id,
      event_type: publicEventType,
    }, '-created_at', 1).catch(() => []);
    const lastEventAt = recentEvents?.[0]?.created_at
      ? new Date(recentEvents[0].created_at).getTime()
      : 0;

    // Evita que recargas o automatismos llenen el historial con miles de eventos.
    if (!lastEventAt || Date.now() - lastEventAt > 5 * 60 * 1000) {
      await base44.asServiceRole.entities.InvoiceTimelineEvent.create({
        invoice_id: invoice.id,
        company_id: invoice.company_id,
        event_type: publicEventType,
        event_label: isDownload ? 'PDF descargado por destinatario' : 'Factura vista por destinatario',
        event_detail: isDownload
          ? 'El destinatario ha descargado el PDF desde el enlace público.'
          : 'El destinatario ha abierto el enlace público de la factura.',
        created_at: new Date().toISOString(),
        origin: 'cliente',
      }).catch(() => {});
    }

    if(privatePdf){
      const name=('Factura_'+String(invoice.numero_factura||'documento')+'.pdf').replace(/[\x00-\x1f\x7f]/g,'').slice(0,180);
      return new Response(privatePdf.bytes,{status:200,headers:{'Content-Type':'application/pdf','Content-Length':String(privatePdf.bytes.length),'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(name),'Cache-Control':'private, no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Taxea-File-Sha256':privatePdf.asset.sha256,'X-Taxea-File-Size':String(privatePdf.bytes.length),'Access-Control-Expose-Headers':'X-Taxea-File-Sha256,X-Taxea-File-Size,Content-Type'}});
    }
    const publicInvoice = pick(invoice, [
      'numero_factura', 'fecha_emision', 'fecha_vencimiento', 'tipo', 'cliente_nombre',
      'cliente_nif', 'cliente_direccion', 'proveedor_nombre', 'proveedor_nif', 'proveedor_direccion', 'concepto', 'base_imponible',
      'tipo_iva', 'cuota_iva', 'indirect_tax_kind', 'retencion_irpf', 'importe_retencion',
      'total_factura', 'moneda', 'estado_cobro', 'importe_pagado', 'importe_pendiente', 'forma_pago', 'coletilla_fiscal',
      'archivo_url', 'qr_url', 'qr_mode', 'qr_pdf_url', 'es_rectificativa', 'factura_rectificada',
    ]);
    if(privatePdfReference){delete publicInvoice.archivo_url;delete publicInvoice.qr_pdf_url;publicInvoice.has_private_pdf=true;}
    const publicCompany = pick(company, [
      'nombre_comercial', 'razon_social', 'nif_cif', 'direccion_fiscal',
      'email', 'telefono', 'logo_url', 'datos_bancarios', 'tipo_impuesto',
    ]);

    return publicJson({ ok: true, invoice: publicInvoice, company: publicCompany });
  } catch (error) {
    console.error('[getPublicInvoice] Operación no disponible.');
    return publicJson({ error: 'No se pudo abrir la factura.' }, { status: 500 });
  }
});


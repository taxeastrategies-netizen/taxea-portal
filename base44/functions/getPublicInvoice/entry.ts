import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const pick = (source, keys) => Object.fromEntries(
  keys.filter(key => source?.[key] !== undefined).map(key => [key, source[key]])
);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '').trim();

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return Response.json({ error: 'Enlace no válido.' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities.Invoice.filter({ public_token: token }, '-created_date', 2);
    const invoice = records?.[0];
    if (!invoice || records.length !== 1) {
      return Response.json({ error: 'Factura no encontrada.' }, { status: 404 });
    }
    if (invoice.anulada) {
      return Response.json({ error: 'Esta factura ha sido anulada.' }, { status: 410 });
    }
    if (invoice.public_token_revoked_at) {
      return Response.json({ error: 'Este enlace ha sido revocado.' }, { status: 410 });
    }
    if (invoice.public_token_expires_at && new Date(invoice.public_token_expires_at) < new Date()) {
      return Response.json({ error: 'Este enlace ha caducado.' }, { status: 410 });
    }

    const company = await base44.asServiceRole.entities.Company.get(invoice.company_id);
    if (!company) return Response.json({ error: 'Emisor no encontrado.' }, { status: 404 });

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

    const isDownload = body.action === 'download';
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

    const publicInvoice = pick(invoice, [
      'numero_factura', 'fecha_emision', 'fecha_vencimiento', 'cliente_nombre',
      'cliente_nif', 'cliente_direccion', 'concepto', 'base_imponible',
      'tipo_iva', 'cuota_iva', 'retencion_irpf', 'importe_retencion',
      'total_factura', 'moneda', 'estado_cobro', 'forma_pago', 'coletilla_fiscal',
      'archivo_url', 'es_rectificativa', 'factura_rectificada',
    ]);
    const publicCompany = pick(company, [
      'nombre_comercial', 'razon_social', 'nif_cif', 'direccion_fiscal',
      'email', 'telefono', 'logo_url', 'datos_bancarios', 'tipo_impuesto',
    ]);

    return Response.json({ ok: true, invoice: publicInvoice, company: publicCompany });
  } catch (error) {
    console.error('[getPublicInvoice]', error);
    return Response.json({ error: 'No se pudo abrir la factura.' }, { status: 500 });
  }
});

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

const clean = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return /^(null|undefined|n\/a)$/i.test(text) ? '' : text;
};

const taxKey = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const emailKey = (value) => clean(value).toLowerCase();
const phoneKey = (value) => clean(value).replace(/\D/g, '').replace(/^00/, '');
const nameKey = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
const unique = (values) => [...new Set((values || []).map(clean).filter(Boolean))];
const listify = (value) => Array.isArray(value) ? value : (clean(value) ? [value] : []);
const isPlaceholderName = (value) => /^(proveedor|cliente|desconocido|sin identificar|varios|n\/a|no consta)$/i.test(clean(value));

const parseExtracted = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
};

const sourceForInvoice = (invoice) => {
  if (invoice.origin === 'ocr' || invoice.ocr_document_id) return 'factura_ocr';
  if (invoice.origin === 'recurring_invoice' || invoice.isRecurringGenerated) return 'factura_recurrente';
  if (invoice.origin === 'importacion') return 'factura_importada';
  if (invoice.origin === 'presupuesto' || invoice.origin === 'proforma') return 'conversion_documento';
  return 'factura_manual';
};

const partyFromInvoice = (invoice) => {
  const received = invoice.tipo === 'recibida';
  return {
    company_id: invoice.company_id,
    nombre: received ? invoice.proveedor_nombre : invoice.cliente_nombre,
    razon_social: received ? invoice.proveedor_nombre : invoice.cliente_nombre,
    nif_cif: received ? invoice.proveedor_nif : invoice.cliente_nif,
    email: received ? invoice.proveedor_email : invoice.cliente_email,
    telefono: received ? invoice.proveedor_telefono : invoice.cliente_telefono,
    direccion_fiscal: received ? invoice.proveedor_direccion : invoice.cliente_direccion,
    codigo_postal: received ? invoice.proveedor_codigo_postal : invoice.cliente_codigo_postal,
    ciudad: received ? invoice.proveedor_ciudad : invoice.cliente_ciudad,
    provincia: received ? invoice.proveedor_provincia : invoice.cliente_provincia,
    pais: received ? invoice.proveedor_pais : invoice.cliente_pais,
    tipo: received ? 'proveedor' : 'cliente',
    source: sourceForInvoice(invoice),
    invoice_id: invoice.id,
    ocr_document_id: invoice.ocr_document_id,
    seen_at: invoice.created_date,
    captured_by_email: invoice.subido_por,
  };
};

const partyFromOcr = (doc, override) => {
  const data = override && typeof override === 'object' ? override : parseExtracted(doc.extractedData);
  const expense = doc.documentType === 'expense_invoice';
  return {
    company_id: doc.company_id,
    nombre: expense ? (data.proveedor || data.proveedor_nombre) : data.cliente_nombre,
    razon_social: expense ? (data.proveedor || data.proveedor_nombre) : data.cliente_nombre,
    nif_cif: expense ? data.nif_proveedor : data.cliente_nif,
    email: expense ? (data.email_proveedor || data.proveedor_email || data.emails_proveedor?.[0]) : (data.email_cliente || data.cliente_email || data.emails_cliente?.[0]),
    telefono: expense ? (data.telefono_proveedor || data.proveedor_telefono || data.telefonos_proveedor?.[0]) : (data.telefono_cliente || data.cliente_telefono || data.telefonos_cliente?.[0]),
    emails: expense ? listify(data.emails_proveedor) : listify(data.emails_cliente),
    telefonos: expense ? listify(data.telefonos_proveedor) : listify(data.telefonos_cliente),
    direccion_fiscal: expense ? (data.direccion_proveedor || data.proveedor_direccion) : (data.direccion_cliente || data.cliente_direccion),
    codigo_postal: expense ? (data.codigo_postal_proveedor || data.proveedor_codigo_postal) : (data.codigo_postal_cliente || data.cliente_codigo_postal),
    ciudad: expense ? (data.ciudad_proveedor || data.proveedor_ciudad) : (data.ciudad_cliente || data.cliente_ciudad),
    provincia: expense ? (data.provincia_proveedor || data.proveedor_provincia) : (data.provincia_cliente || data.cliente_provincia),
    pais: expense ? (data.pais_proveedor || data.proveedor_pais) : (data.pais_cliente || data.cliente_pais),
    tipo: expense ? 'proveedor' : 'cliente',
    source: 'ocr_reconocido',
    ocr_document_id: doc.id,
    invoice_id: doc.linkedInvoiceId,
    seen_at: doc.analysisCompletedAt || doc.updated_date || doc.created_date,
    captured_by_user_id: doc.uploadedByUserId,
    captured_by_email: doc.uploadedByEmail,
  };
};

const findExisting = (contacts, party) => {
  const availableContacts = contacts.filter((contact) => !contact.merged_into_contact_id);
  const nif = taxKey(party.nif_cif);
  const email = emailKey(party.email);
  const phone = phoneKey(party.telefono);
  const name = nameKey(party.nombre);
  return (
    (nif && availableContacts.find((c) => taxKey(c.nif_cif) === nif)) ||
    (email && availableContacts.find((c) => emailKey(c.email) === email || (c.emails || []).some((v) => emailKey(v) === email))) ||
    (phone && availableContacts.find((c) => phoneKey(c.telefono) === phone || (c.telefonos || []).some((v) => phoneKey(v) === phone))) ||
    (name && availableContacts.find((c) => nameKey(c.nombre || c.razon_social) === name)) ||
    null
  );
};

const contactPayload = (party, current) => {
  const now = new Date().toISOString();
  const tipo = current && current.tipo !== party.tipo && current.tipo !== 'ambos' ? 'ambos' : (current?.tipo || party.tipo);
  const emails = unique([...(current?.emails || []), current?.email, party.email, ...listify(party.emails)]);
  const telefonos = unique([...(current?.telefonos || []), current?.telefono, party.telefono, ...listify(party.telefonos)]);
  const fuentes = unique([...(current?.fuentes || []), party.source]);
  const facturaIds = unique([...(current?.factura_origen_ids || []), party.invoice_id]);
  const ocrIds = unique([...(current?.ocr_origen_ids || []), party.ocr_document_id]);

  return {
    company_id: party.company_id,
    nombre: clean(current?.nombre) || clean(party.nombre),
    razon_social: clean(current?.razon_social) || clean(party.razon_social) || clean(party.nombre),
    nif_cif: clean(current?.nif_cif) || clean(party.nif_cif),
    email: clean(current?.email) || clean(party.email) || emails[0] || '',
    telefono: clean(current?.telefono) || clean(party.telefono) || telefonos[0] || '',
    emails,
    telefonos,
    direccion_fiscal: clean(current?.direccion_fiscal) || clean(party.direccion_fiscal),
    codigo_postal: clean(current?.codigo_postal) || clean(party.codigo_postal),
    ciudad: clean(current?.ciudad) || clean(party.ciudad),
    provincia: clean(current?.provincia) || clean(party.provincia),
    pais: clean(current?.pais) || clean(party.pais) || 'España',
    tipo,
    activo: true,
    origen_automatico: true,
    fuentes,
    factura_origen_ids: facturaIds,
    ocr_origen_ids: ocrIds,
    ultima_factura_id: clean(party.invoice_id) || clean(current?.ultima_factura_id),
    ultimo_documento_ocr_id: clean(party.ocr_document_id) || clean(current?.ultimo_documento_ocr_id),
    primera_deteccion_at: current?.primera_deteccion_at || party.seen_at || now,
    ultima_deteccion_at: party.seen_at || now,
    capturado_por_user_id: clean(party.captured_by_user_id) || clean(current?.capturado_por_user_id),
    capturado_por_email: clean(party.captured_by_email) || clean(current?.capturado_por_email),
    consentimiento_comercial: current?.consentimiento_comercial || 'no_solicitado',
    uso_contacto: current?.uso_contacto || 'operativo_facturacion',
  };
};

async function syncParty(svc, contactsByCompany, party) {
  party.nombre = clean(party.nombre);
  party.company_id = clean(party.company_id);
  if (!party.company_id || !party.nombre || isPlaceholderName(party.nombre)) return { skipped: true };

  let contacts = contactsByCompany.get(party.company_id);
  if (!contacts) {
    contacts = await svc.entities.Contact.filter({ company_id: party.company_id }, null, 5000, 0);
    contactsByCompany.set(party.company_id, contacts || []);
  }

  const current = findExisting(contacts, party);
  const payload = contactPayload(party, current);
  if (current) {
    const updated = await svc.entities.Contact.update(current.id, payload);
    Object.assign(current, updated || payload);
    return { updated: true, id: current.id };
  }

  const created = await svc.entities.Contact.create(payload);
  contacts.push(created);
  return { created: true, id: created.id };
}

async function listAll(handler, query = null) {
  const rows = [];
  const pageSize = 5000;
  for (let skip = 0; ; skip += pageSize) {
    const page = query
      ? await handler.filter(query, 'created_date', pageSize, skip)
      : await handler.list('created_date', pageSize, skip);
    rows.push(...(page || []));
    if (!page || page.length < pageSize) break;
  }
  return rows;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'sync_company';
    const isAdmin = user.role === 'admin' || user.role === 'super_admin' || user.is_service === true;
    const svc = base44.asServiceRole;
    const contactsByCompany = new Map();
    const summary = { created: 0, updated: 0, skipped: 0, invoices: 0, ocrDocuments: 0 };

    const record = (result) => {
      if (result?.created) summary.created++;
      else if (result?.updated) summary.updated++;
      else summary.skipped++;
    };

    if (action === 'sync_invoice') {
      const invoice = await svc.entities.Invoice.get(body.invoiceId);
      if (!invoice) return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
      if (!isAdmin && invoice.company_id !== user.data?.company_id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      record(await syncParty(svc, contactsByCompany, partyFromInvoice(invoice)));
      summary.invoices = 1;
      return Response.json({ success: true, summary });
    }

    if (action === 'sync_ocr') {
      const doc = await svc.entities.OcrInvoiceDocument.get(body.docId);
      if (!doc) return Response.json({ error: 'Documento OCR no encontrado' }, { status: 404 });
      if (!isAdmin && doc.company_id !== user.data?.company_id) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      record(await syncParty(svc, contactsByCompany, partyFromOcr(doc, body.extractedData)));
      summary.ocrDocuments = 1;
      return Response.json({ success: true, summary });
    }

    if (action === 'backfill_all' && !isAdmin) {
      return Response.json({ error: 'Solo administradores pueden reprocesar todas las empresas' }, { status: 403 });
    }

    const companyId = action === 'backfill_all' ? '' : clean(body.companyId || user.data?.company_id);
    if (action !== 'backfill_all' && (!companyId || (!isAdmin && companyId !== user.data?.company_id))) {
      return Response.json({ error: 'Empresa no autorizada' }, { status: 403 });
    }

    const invoiceQuery = companyId ? { company_id: companyId } : null;
    const ocrQuery = companyId ? { company_id: companyId } : null;
    const invoices = await listAll(svc.entities.Invoice, invoiceQuery);
    const ocrDocs = await listAll(svc.entities.OcrInvoiceDocument, ocrQuery);

    for (const invoice of invoices) {
      record(await syncParty(svc, contactsByCompany, partyFromInvoice(invoice)));
      summary.invoices++;
    }
    for (const doc of ocrDocs) {
      const extracted = parseExtracted(doc.extractedData);
      if (!Object.keys(extracted).length) continue;
      record(await syncParty(svc, contactsByCompany, partyFromOcr(doc)));
      summary.ocrDocuments++;
    }

    return Response.json({ success: true, scope: action === 'backfill_all' ? 'all' : companyId, summary });
  } catch (error) {
    console.error('[syncInvoiceContacts]', error);
    return Response.json({ error: 'No se pudieron sincronizar los contactos', detail: error?.message || String(error) }, { status: 500 });
  }
});

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

const MIGRATION_TOKEN = '814b1007b23271e2ef6e4408ae51c28c4b7088b690950b3ca3eec3dbf117b58b';
const VERSION = 'contacts-v2-2026-08-15';
const clean = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return /^(null|undefined|n\/a|no consta)$/i.test(text) ? '' : text;
};
const listify = (value) => Array.isArray(value) ? value : (clean(value) ? [value] : []);
const unique = (values) => [...new Set(listify(values).map(clean).filter(Boolean))];
const normalizeTax = (value) => clean(value).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const validEmails = (value) => unique(value).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
const validPhones = (value) => unique(value).filter((phone) => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 18;
});
const parseExtracted = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
};
const missingIdentity = (value) => !clean(value) || /^(proveedor|cliente|desconocido|sin identificar|varios)$/i.test(clean(value));
const hasCompleted = (doc) => doc.contactBackfillVersion === VERSION && doc.contactBackfillStatus === 'completed' || (doc.auditTrail || []).some((entry) => clean(entry).includes('"action":"contactos_reocr_historico"') && clean(entry).includes(`"version":"${VERSION}"`) && !clean(entry).includes('"status":"failed"'));
const mergeIfEmpty = (current, incoming) => clean(current) || clean(incoming);

const CONTACT_SCHEMA = {
  type: 'object',
  properties: {
    nombre_razon_social: { type: 'string' },
    nif_cif_dni: { type: 'string' },
    emails: { type: 'array', items: { type: 'string' } },
    telefonos: { type: 'array', items: { type: 'string' } },
    direccion: { type: 'string' },
    codigo_postal: { type: 'string' },
    ciudad: { type: 'string' },
    provincia: { type: 'string' },
    pais: { type: 'string' },
  },
};

const companyLabel = (company) => clean(company?.razon_social) || clean(company?.nombre_comercial) || clean(company?.name);
const companyTax = (company) => clean(company?.nif_cif) || clean(company?.nif) || clean(company?.tax_id);

function currentParty(doc, extracted) {
  const expense = doc.documentType === 'expense_invoice';
  return {
    name: expense ? (extracted.proveedor || extracted.proveedor_nombre) : extracted.cliente_nombre,
    tax: expense ? extracted.nif_proveedor : extracted.cliente_nif,
  };
}

function buildPrompt(doc, company, extracted) {
  const expense = doc.documentType === 'expense_invoice';
  const ownName = companyLabel(company);
  const ownTax = companyTax(company);
  const current = currentParty(doc, extracted);
  const target = expense
    ? 'el PROVEEDOR o EMISOR que ha expedido la factura. No extraigas los datos del receptor/comprador'
    : 'el CLIENTE o DESTINATARIO de la factura emitida. No extraigas los datos del emisor';
  return `Analiza visualmente el documento adjunto y extrae EXCLUSIVAMENTE los datos de contacto de ${target}.

Empresa propietaria del portal (la parte que debes excluir): ${ownName || 'no indicada'}; NIF/CIF: ${ownTax || 'no indicado'}.
La extracción histórica sugiere como contraparte: ${clean(current.name) || 'no indicada'}; NIF/CIF/DNI: ${clean(current.tax) || 'no indicado'}.

Devuelve solo información que aparezca realmente en el documento:
- nombre o razón social de la contraparte;
- NIF, CIF, DNI o VAT de la contraparte;
- todos los correos electrónicos de la contraparte;
- todos los teléfonos de la contraparte;
- dirección fiscal o postal, código postal, ciudad, provincia y país.

No inventes datos. No confundas números de factura, cuenta bancaria, IBAN, fechas o importes con teléfonos. Si un dato no aparece, devuelve cadena vacía o lista vacía. Si el documento muestra datos de ambas partes, elige únicamente la contraparte indicada.`;
}

function mergeContactFields(doc, extracted, result, company) {
  const expense = doc.documentType === 'expense_invoice';
  const ownTax = normalizeTax(companyTax(company));
  const ownName = companyLabel(company);
  const resultTax = normalizeTax(result?.nif_cif_dni);
  const returnedOwnCompany = ownTax && resultTax && ownTax === resultTax;
  const current = currentParty(doc, extracted);
  const currentTaxIsOwn = ownTax && normalizeTax(current.tax) === ownTax;
  const currentNameIsOwn = ownName && clean(current.name).localeCompare(ownName, undefined, { sensitivity: 'base' }) === 0;
  const emails = returnedOwnCompany ? [] : validEmails(result?.emails);
  const phones = returnedOwnCompany ? [] : validPhones(result?.telefonos);
  const safeName = returnedOwnCompany ? '' : clean(result?.nombre_razon_social);
  const safeTax = returnedOwnCompany ? '' : clean(result?.nif_cif_dni);
  const address = returnedOwnCompany ? '' : clean(result?.direccion);
  const postal = returnedOwnCompany ? '' : clean(result?.codigo_postal);
  const city = returnedOwnCompany ? '' : clean(result?.ciudad);
  const province = returnedOwnCompany ? '' : clean(result?.provincia);
  const country = returnedOwnCompany ? '' : clean(result?.pais);

  if (expense) {
    if ((missingIdentity(extracted.proveedor || extracted.proveedor_nombre) || currentNameIsOwn) && safeName) extracted.proveedor = safeName;
    if ((!clean(extracted.nif_proveedor) || currentTaxIsOwn) && safeTax) extracted.nif_proveedor = safeTax;
    extracted.emails_proveedor = unique([...listify(extracted.emails_proveedor), ...emails]);
    extracted.telefonos_proveedor = unique([...listify(extracted.telefonos_proveedor), ...phones]);
    extracted.email_proveedor = mergeIfEmpty(extracted.email_proveedor || extracted.proveedor_email, extracted.emails_proveedor[0]);
    extracted.telefono_proveedor = mergeIfEmpty(extracted.telefono_proveedor || extracted.proveedor_telefono, extracted.telefonos_proveedor[0]);
    extracted.direccion_proveedor = mergeIfEmpty(extracted.direccion_proveedor || extracted.proveedor_direccion, address);
    extracted.codigo_postal_proveedor = mergeIfEmpty(extracted.codigo_postal_proveedor || extracted.proveedor_codigo_postal, postal);
    extracted.ciudad_proveedor = mergeIfEmpty(extracted.ciudad_proveedor || extracted.proveedor_ciudad, city);
    extracted.provincia_proveedor = mergeIfEmpty(extracted.provincia_proveedor || extracted.proveedor_provincia, province);
    extracted.pais_proveedor = mergeIfEmpty(extracted.pais_proveedor || extracted.proveedor_pais, country);
  } else {
    if ((missingIdentity(extracted.cliente_nombre) || currentNameIsOwn) && safeName) extracted.cliente_nombre = safeName;
    if ((!clean(extracted.cliente_nif) || currentTaxIsOwn) && safeTax) extracted.cliente_nif = safeTax;
    extracted.emails_cliente = unique([...listify(extracted.emails_cliente), ...emails]);
    extracted.telefonos_cliente = unique([...listify(extracted.telefonos_cliente), ...phones]);
    extracted.email_cliente = mergeIfEmpty(extracted.email_cliente || extracted.cliente_email, extracted.emails_cliente[0]);
    extracted.telefono_cliente = mergeIfEmpty(extracted.telefono_cliente || extracted.cliente_telefono, extracted.telefonos_cliente[0]);
    extracted.direccion_cliente = mergeIfEmpty(extracted.direccion_cliente || extracted.cliente_direccion, address);
    extracted.codigo_postal_cliente = mergeIfEmpty(extracted.codigo_postal_cliente || extracted.cliente_codigo_postal, postal);
    extracted.ciudad_cliente = mergeIfEmpty(extracted.ciudad_cliente || extracted.cliente_ciudad, city);
    extracted.provincia_cliente = mergeIfEmpty(extracted.provincia_cliente || extracted.cliente_provincia, province);
    extracted.pais_cliente = mergeIfEmpty(extracted.pais_cliente || extracted.cliente_pais, country);
  }

  return {
    returnedOwnCompany,
    emails: emails.length,
    phones: phones.length,
    address: Boolean(address || postal || city || province || country),
    nameAdded: (missingIdentity(current.name) || currentNameIsOwn) && Boolean(safeName),
    taxAdded: (!clean(current.tax) || currentTaxIsOwn) && Boolean(safeTax),
  };
}

async function enrichLinkedInvoice(svc, doc, extracted) {
  if (!doc.linkedInvoiceId) return false;
  const invoice = await svc.entities.Invoice.get(doc.linkedInvoiceId).catch(() => null);
  if (!invoice) return false;
  const expense = doc.documentType === 'expense_invoice';
  const changes = {};
  const setMissing = (field, value) => {
    if (!clean(invoice[field]) && clean(value)) changes[field] = clean(value);
  };
  if (expense) {
    setMissing('proveedor_nombre', extracted.proveedor || extracted.proveedor_nombre);
    setMissing('proveedor_nif', extracted.nif_proveedor);
    setMissing('proveedor_email', extracted.email_proveedor || extracted.emails_proveedor?.[0]);
    setMissing('proveedor_telefono', extracted.telefono_proveedor || extracted.telefonos_proveedor?.[0]);
    setMissing('proveedor_direccion', extracted.direccion_proveedor);
    setMissing('proveedor_codigo_postal', extracted.codigo_postal_proveedor);
    setMissing('proveedor_ciudad', extracted.ciudad_proveedor);
    setMissing('proveedor_provincia', extracted.provincia_proveedor);
    setMissing('proveedor_pais', extracted.pais_proveedor);
  } else {
    setMissing('cliente_nombre', extracted.cliente_nombre);
    setMissing('cliente_nif', extracted.cliente_nif);
    setMissing('cliente_email', extracted.email_cliente || extracted.emails_cliente?.[0]);
    setMissing('cliente_telefono', extracted.telefono_cliente || extracted.telefonos_cliente?.[0]);
    setMissing('cliente_direccion', extracted.direccion_cliente);
    setMissing('cliente_codigo_postal', extracted.codigo_postal_cliente);
    setMissing('cliente_ciudad', extracted.ciudad_cliente);
    setMissing('cliente_provincia', extracted.provincia_cliente);
    setMissing('cliente_pais', extracted.pais_cliente);
  }
  if (!Object.keys(changes).length) return false;
  await svc.entities.Invoice.update(invoice.id, changes);
  return true;
}

async function repairMislabeledImage(svc, doc) {
  const response = await fetch(doc.fileStorageUrl);
  if (!response.ok) throw new Error(`No se pudo descargar el archivo mal etiquetado: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let mime = '';
  let extension = '';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mime = 'image/jpeg';
    extension = 'jpg';
  } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    mime = 'image/png';
    extension = 'png';
  } else {
    throw new Error('El archivo no es un PDF ni una imagen JPEG/PNG reconocible');
  }
  const baseName = clean(doc.originalFileName || doc.fileName || doc.id).replace(/\.[^.]+$/, '') || doc.id;
  const fileName = `${baseName}.${extension}`;
  const file = new File([bytes], fileName, { type: mime });
  const uploaded = await svc.integrations.Core.UploadFile({ file });
  if (!uploaded?.file_url) throw new Error('Base44 no devolvio URL al corregir el archivo');
  return { url: uploaded.file_url, mime, fileName, size: bytes.length };
}

async function processDocument(base44, doc, companyCache) {
  const svc = base44.asServiceRole;
  const now = new Date().toISOString();
  if (!doc.fileStorageUrl) {
    await svc.entities.OcrInvoiceDocument.update(doc.id, {
      contactBackfillVersion: VERSION,
      contactBackfillAt: now,
      contactBackfillStatus: 'skipped_no_file',
      contactBackfillError: '',
    });
    return { id: doc.id, status: 'skipped_no_file' };
  }

  try {
    let company = companyCache.get(doc.company_id);
    if (!company) {
      company = await svc.entities.Company.get(doc.company_id).catch(() => ({}));
      companyCache.set(doc.company_id, company || {});
    }
    const extracted = parseExtracted(doc.extractedData);
    let repairedFile = null;
    let result;
    try {
      result = await svc.integrations.Core.InvokeLLM({
        prompt: buildPrompt(doc, company, extracted),
        file_urls: [doc.fileStorageUrl],
        response_json_schema: CONTACT_SCHEMA,
      });
    } catch (initialError) {
      const invalidDocument = /INVALID_ARGUMENT|no pages/i.test(clean(initialError?.message || initialError));
      if (!invalidDocument) throw initialError;
      repairedFile = await repairMislabeledImage(svc, doc);
      result = await svc.integrations.Core.InvokeLLM({
        prompt: buildPrompt(doc, company, extracted),
        file_urls: [repairedFile.url],
        response_json_schema: CONTACT_SCHEMA,
      });
    }
    const found = mergeContactFields(doc, extracted, result || {}, company);
    const auditTrail = [...(doc.auditTrail || []), JSON.stringify({
      at: now,
      action: 'contactos_reocr_historico',
      version: VERSION,
      fields: found,
    })].slice(-200);

    const docUpdate = {
      extractedData: JSON.stringify(extracted),
      auditTrail,
      contactBackfillVersion: VERSION,
      contactBackfillAt: now,
      contactBackfillStatus: 'completed',
      contactBackfillError: '',
    };
    if (repairedFile) Object.assign(docUpdate, {
      fileStorageUrl: repairedFile.url,
      fileMimeType: repairedFile.mime,
      fileName: repairedFile.fileName,
      fileSize: repairedFile.size,
    });
    await svc.entities.OcrInvoiceDocument.update(doc.id, docUpdate);

    const invoiceUpdated = await enrichLinkedInvoice(svc, doc, extracted);
    const syncResponse = await svc.functions.invoke('syncInvoiceContacts', {
      action: 'sync_ocr',
      docId: doc.id,
      extractedData: extracted,
    });
    const syncResult = syncResponse?.data || syncResponse;
    if (!syncResult?.success) throw new Error(syncResult?.error || 'No se pudo sincronizar el contacto');

    return { id: doc.id, status: 'completed', invoiceUpdated, ...found };
  } catch (error) {
    const message = clean(error?.message || error).slice(0, 500);
    const auditTrail = [...(doc.auditTrail || []), JSON.stringify({
      at: now,
      action: 'contactos_reocr_historico',
      version: VERSION,
      status: 'failed',
      error: message,
    })].slice(-200);
    await svc.entities.OcrInvoiceDocument.update(doc.id, {
      auditTrail,
      contactBackfillVersion: VERSION,
      contactBackfillAt: now,
      contactBackfillStatus: 'failed',
      contactBackfillError: message,
    }).catch(() => null);
    return { id: doc.id, status: 'failed', error: message };
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  if (body.token !== MIGRATION_TOKEN) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const skip = Math.max(0, Number(body.skip) || 0);
  const limit = Math.min(10, Math.max(1, Number(body.limit) || 5));
  const force = body.force === true;
  const docIds = Array.isArray(body.docIds) ? body.docIds.map(clean).filter(Boolean).slice(0, 20) : [];
  const docs = docIds.length
    ? (await Promise.all(docIds.map((id) => base44.asServiceRole.entities.OcrInvoiceDocument.get(id).catch(() => null)))).filter(Boolean)
    : await base44.asServiceRole.entities.OcrInvoiceDocument.list('created_date', limit, skip);
  const companyCache = new Map();
  const results = [];

  for (let i = 0; i < docs.length; i += 5) {
    const pair = docs.slice(i, i + 5);
    const pairResults = await Promise.all(pair.map(async (doc) => {
      if (!force && hasCompleted(doc)) {
        return { id: doc.id, status: 'already_completed' };
      }
      return processDocument(base44, doc, companyCache);
    }));
    results.push(...pairResults);
  }

  const summary = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    acc.emails += item.emails || 0;
    acc.phones += item.phones || 0;
    acc.addresses += item.address ? 1 : 0;
    acc.namesAdded += item.nameAdded ? 1 : 0;
    acc.taxIdsAdded += item.taxAdded ? 1 : 0;
    acc.invoicesUpdated += item.invoiceUpdated ? 1 : 0;
    return acc;
  }, { completed: 0, failed: 0, already_completed: 0, skipped_no_file: 0, emails: 0, phones: 0, addresses: 0, namesAdded: 0, taxIdsAdded: 0, invoicesUpdated: 0 });

  return Response.json({
    success: summary.failed === 0,
    version: VERSION,
    skip,
    limit,
    returned: docs.length,
    nextSkip: skip + docs.length,
    summary,
    failures: results.filter((item) => item.status === 'failed'),
  });
});

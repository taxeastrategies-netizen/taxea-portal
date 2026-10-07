// Recovery never creates an Invoice, tax line, contact or manual journal.
const privileged = user => ['admin', 'super_admin'].includes(user?.role);
const text = value => String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
const cents = value => Math.round(Number(value) * 100);
export function sourceData(doc) {
  try { return JSON.parse(doc.extractedData || '{}'); } catch { return {}; }
}
export function sourceTotalMatches(doc, invoice) {
  const source = sourceData(doc);
  return source.total == null || (Number.isFinite(Number(source.total))
    && Number.isFinite(Number(invoice.total_factura)) && Math.abs(cents(source.total) - cents(invoice.total_factura)) <= 2);
}
export async function acquireApprovalLease(svc, companyId) {
  const token = crypto.randomUUID();
  const claim = await svc.entities.Company.updateMany({
    id: companyId, ocr_approval_lock_token: { $in: [null, ''] },
  }, { $set: { ocr_approval_lock_token: token, ocr_approval_lock_started_at: new Date().toISOString() } });
  if (Number(claim?.updated) !== 1) {
    const error = new Error('Hay otra aprobación OCR en curso para esta empresa. Espera a que termine; no se ha creado otra factura.');
    error.status = 409; throw error;
  }
  return async () => {
    await svc.entities.Company.updateMany({ id: companyId, ocr_approval_lock_token: token },
      { $set: { ocr_approval_lock_token: '', ocr_approval_lock_started_at: '' } });
  };
}
export async function resumeExistingOcr(svc, user, doc, invoiceType, confirmReview, postInvoice, schemaVersion) {
  const expected = doc.documentType === 'expense_invoice' ? 'recibida' : doc.documentType === 'income_invoice' ? 'emitida' : null;
  if (!expected || invoiceType !== expected) return { status: 422, json: { error: 'El tipo de factura no coincide con el documento OCR.' } };
  const found = await svc.entities.Invoice.filter({ company_id: doc.company_id, ocr_document_id: doc.id }, '-created_date', 10);
  let invoice = null;
  if (doc.linkedInvoiceId) {
    invoice = await svc.entities.Invoice.get(doc.linkedInvoiceId);
    if (!invoice) return { status: 409, json: { error: 'El enlace OCR no se puede resolver; no se creará otra factura.' } };
  }
  if (found?.length > 1 || (invoice && found?.some(row => row.id !== invoice.id))) {
    return { status: 409, json: { error: 'Hay varias facturas asociadas al mismo OCR. Revisión de duplicados requerida; sin nuevas escrituras contables.' } };
  }
  invoice ||= found?.[0] || null;
  if (!invoice) return null;
  if (invoice.company_id !== doc.company_id || invoice.tipo !== expected || invoice.anulada) {
    return { status: 409, json: { error: 'La factura enlazada no pertenece al documento, tiene otra dirección o está anulada.' } };
  }
  if (!doc.linkedInvoiceId) {
    await svc.entities.OcrInvoiceDocument.update(doc.id, { linkedInvoiceId: invoice.id });
    doc = { ...doc, linkedInvoiceId: invoice.id };
  }
  if (!sourceTotalMatches(doc, invoice)) {
    const message = 'El total de la factura difiere del documento OCR. Revisar el original y el tratamiento de impuestos no deducibles antes de continuar.';
    await svc.entities.OcrInvoiceDocument.update(doc.id, { safeErrorMessage: message, duplicateWarning: 'SOURCE_TOTAL_MISMATCH', lastStatusChangedAt: new Date().toISOString() });
    return { status: 409, json: { error: message, invoiceId: invoice.id, alreadyProcessed: true, review_required: true } };
  }
  if (invoice.estado_contable !== 'contabilizada' && (
    !privileged(user) || confirmReview !== true || invoice.fiscal_review_status !== 'validado'
    || invoice.accounting_migration_hold === true)) {
    return { status: 200, json: { success: true, alreadyProcessed: true, review_required: true,
      invoiceId: invoice.id, message: 'La factura ya existe y espera revisión fiscal del asesor. No se ha creado otra.' } };
  }
  if (invoice.estado_contable !== 'contabilizada') {
    const taxLines = await svc.entities.InvoiceTaxLine.filter({ companyId: doc.company_id, invoiceId: invoice.id }, 'lineNumber', 100);
    if (!taxLines?.length || taxLines.some(line => line.reviewStatus !== 'validado')) {
      return { status: 409, json: { error: 'La factura existente requiere revisar su detalle fiscal antes de recuperar el asiento.', invoiceId: invoice.id } };
    }
  }
  // The shared engine validates the real lines and reuses its stable postingKey.
  const posting = await postInvoice(svc, doc.company_id, invoice, user.email, {
    ocrDocumentId: doc.id, source: 'OCR', status: 'confirmado',
  });
  const now = new Date().toISOString();
  await svc.entities.OcrInvoiceDocument.update(doc.id, {
    status: 'accounted', linkedInvoiceId: invoice.id, linkedJournalEntryId: posting.entry.id,
    accountedAt: now, reviewedAt: now, reviewedByAdminId: user.id,
    accountingSchemaVersion: schemaVersion, lastStatusChangedAt: now, safeErrorMessage: '', duplicateWarning: '',
    auditTrail: [...(Array.isArray(doc.auditTrail) ? doc.auditTrail : []), JSON.stringify({
      action: 'ocr_recovery_existing_invoice', invoiceId: invoice.id, journalEntryId: posting.entry.id,
      actor: user.email, timestamp: now, noInvoiceCreated: true,
    })],
  });
  return { status: 200, json: { success: true, alreadyProcessed: true, recovered: true,
    invoiceId: invoice.id, journalEntryId: posting.entry.id, message: 'Factura existente y OCR sincronizados, sin duplicar.' } };
}
export async function findFinancialDuplicates(svc, doc, invoiceData) {
  const identity = invoiceData.tipo === 'recibida' ? 'proveedor_nif' : 'cliente_nif';
  const name = invoiceData.tipo === 'recibida' ? 'proveedor_nombre' : 'cliente_nombre';
  const candidates = await svc.entities.Invoice.filter({
    company_id: doc.company_id, tipo: invoiceData.tipo,
    numero_factura: invoiceData.numero_factura, fecha_emision: invoiceData.fecha_emision,
  }, '-created_date', 100);
  const source = sourceData(doc);
  const totals = [invoiceData.total_factura, source.total].filter(value => value != null && Number.isFinite(Number(value))).map(cents);
  return (candidates || []).filter(row => !row.anulada
    && (text(invoiceData[identity]) ? text(row[identity]) === text(invoiceData[identity])
      : text(invoiceData[name]) && text(row[name]) === text(invoiceData[name]))
    && totals.some(total => Math.abs(cents(row.total_factura) - total) <= 2));
}

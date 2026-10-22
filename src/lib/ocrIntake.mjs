export async function ocrIntake(client, params) {
  const response = await client.functions.invoke('ocrDocumentIntake', params);
  const result = response?.data ?? response;
  if (!result?.ok) throw new Error(result?.error || 'No se pudo completar la entrega del documento.');
  return result;
}

// New deliveries are pending. Older review rows without extraction can still
// be analysed, without migrating or approving historical documents.
export function needsOcrAnalysis(doc) {
  if (['pending', 'analysis_failed', 'queued_for_analysis'].includes(doc.status)) return true;
  if (doc.status !== 'review_required' || doc.invoiceSource || doc.invoiceOnly) return false;
  try {
    const data = typeof doc.extractedData === 'string' ? JSON.parse(doc.extractedData || '{}') : doc.extractedData;
    return !data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length;
  } catch { return true; }
}

const unlinkedDocument = doc => !!doc && !doc.invoiceOnly && !doc.invoiceSource
  && !doc.linkedInvoiceId && !doc.linkedJournalEntryId && !doc.accountedAt;
export const canReturnOcrToPending = doc => unlinkedDocument(doc)
  && ['review_required','analysis_failed'].includes(doc.status);
export const canRejectOcrDocument = doc => unlinkedDocument(doc)
  && ['pending','review_required','analysis_failed'].includes(doc.status);

export async function loadIntakeDocuments(client, companyId, documentType) {
  const rows = new Map();
  let offset = 0;
  for (let page = 0; page < 100; page++) {
    const result = await ocrIntake(client, { action: 'list', companyId, documentType, offset });
    if (!Array.isArray(result.rows)) throw new Error('No se pudo recuperar la lista de documentos.');
    for (const row of result.rows) rows.set(row.id, row);
    if (result.nextOffset == null) return [...rows.values()].sort((a,b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')) || String(b.id).localeCompare(String(a.id)));
    if (result.nextOffset <= offset) throw new Error('La paginación OCR no ha avanzado.');
    offset = result.nextOffset;
  }
  throw new Error('La cola supera el límite de lectura completo. Filtra por cliente.');
}

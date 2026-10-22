import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const lower = (value: unknown) => String(value || '').trim().toLowerCase();
const types = { expense_invoice: 'ocr_expense', income_invoice: 'ocr_income' };
const mutable = new Set(['pending', 'review_required', 'analysis_failed', 'queued_for_analysis', 'processing']);
const fail = (error: string, status: number, code: string) => Response.json({ error, code }, { status });
function canAccess(user: any, company: any) {
  if (!company || company.activa === false) return false;
  if (['admin', 'super_admin'].includes(user.role)) return true;
  const email = lower(user.email);
  return !!email && (lower(company.owner_email) === email
    || (Array.isArray(company.usuarios_autorizados) && company.usuarios_autorizados.some((item: unknown) => lower(item) === email)));
}
function audit(user: any, action: string, from: string, to: string) {
  return `[${new Date().toISOString()}] user=${user.email} role=${user.role || 'user'} action=${action} from=${from} to=${to}`;
}
function fileKind(bytes: Uint8Array) {
  if (new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') return 'pdf';
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP') return 'webp';
  return '';
}

// This is a document intake boundary, never an invoice/accounting approval.
Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return fail('Método no permitido', 405, 'METHOD_NOT_ALLOWED');
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id || !user.email) return fail('Tu sesión ha caducado. Vuelve a entrar.', 401, 'AUTH_EXPIRED');
    if (user.is_deleted || ['eliminado','bloqueado','suspendido'].includes(user.status)
      || user.accountAccessStatus === 'suspended') return fail('Acceso al portal suspendido.', 403, 'ACCOUNT_DISABLED');
    const multipart = (req.headers.get('content-type') || '').includes('multipart/form-data');
    let body: any;
    try { body = multipart ? Object.fromEntries((await req.formData()).entries()) : await req.json(); }
    catch { return fail('Solicitud no válida', 400, 'INVALID_REQUEST'); }
    const companyId = typeof body?.companyId === 'string' ? body.companyId.trim() : '';
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(companyId)) return fail('Selecciona una empresa válida.', 400, 'INVALID_COMPANY');
    const svc = client.asServiceRole;
    const company = await svc.entities.Company.get(companyId).catch(() => null);
    // Never trust body.company_id, user.company_id or a self-declared advisor flag.
    if (!canAccess(user, company)) return fail('No tienes acceso a esta empresa.', 403, 'COMPANY_FORBIDDEN');
    const documents = svc.entities.OcrInvoiceDocument;
    const documentType = body.documentType;

    if (body.action === 'list') {
      if (!Object.hasOwn(types, documentType)) return fail('Tipo de documento no válido', 400, 'INVALID_TYPE');
      const offset = Number(body.offset || 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > 50000) return fail('Página no válida', 400, 'INVALID_PAGE');
      const rows = await documents.filter({ company_id: companyId, documentType }, 'id', 500, offset);
      return Response.json({ ok: true, rows, nextOffset: rows.length === 500 ? offset + 500 : null });
    }

    if (body.action === 'upload') {
      if (!multipart || !Object.hasOwn(types, documentType)) return fail('Subida no válida', 400, 'INVALID_TYPE');
      const file = body.file;
      if (!(file instanceof File) || !file.size) return fail('El archivo está vacío.', 400, 'EMPTY_FILE');
      if (file.size > 10 * 1024 * 1024) return fail('El archivo supera los 10 MB.', 413, 'FILE_TOO_LARGE');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = fileKind(bytes);
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!kind || !(kind === ext || (kind === 'jpeg' && ext === 'jpg'))) return fail('Sube un PDF, JPG, PNG o WEBP válido.', 415, 'UNSUPPORTED_TYPE');
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2,'0')).join('');
      const previous = await documents.filter({ company_id: companyId, documentType, fileHash: digest }, '-created_date', 1);
      if (previous[0]) return Response.json({ ok: true, document: previous[0], reused: true });
      const uploaded = await svc.integrations.Core.UploadFile({ file });
      if (!uploaded?.file_url) return fail('El servidor no confirmó la subida. Reintenta.', 502, 'NO_URL_RETURNED');
      const now = new Date().toISOString();
      const captureMethod = ['camera','drag_drop','file_picker'].includes(body.captureMethod) ? body.captureMethod : 'file_picker';
      const device = ['mobile','tablet','desktop'].includes(body.deviceType) ? body.deviceType : 'desktop';
      const source = ['admin','super_admin'].includes(user.role) ? 'admin_upload' : captureMethod === 'camera' ? 'mobile_camera' : device === 'desktop' ? 'desktop_upload' : 'mobile_upload';
      const name = file.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 240);
      const doc = await documents.create({
        company_id: companyId, uploadedByUserId: user.id, uploadedByEmail: user.email,
        documentType, sourceModule: types[documentType], status: 'review_required',
        originalFileName: name, fileName: name, fileMimeType: file.type, fileSize: file.size,
        fileStorageUrl: uploaded.file_url, fileHash: digest, captureMethod, uploadSource: source,
        uploadedFromDeviceType: device, uploadedAt: now, lastStatusChangedAt: now,
        auditTrail: [audit(user, 'documento_subido', '', 'review_required')],
      });
      // Non-critical timeline failure cannot turn a saved delivery into a retry.
      await svc.entities.TimelineEvent.create({ company_id: companyId, tipo: 'documento_subido',
        titulo: `Documento entregado: ${name}`, descripcion: 'En revisión. Análisis OCR y aprobación contable pendientes.',
        color: 'azul', usuario_email: user.email, automatico: true, visibilidad: 'ambos' }).catch(() => {});
      return Response.json({ ok: true, document: doc, reused: false });
    }

    if (!['analysis_start','analysis_complete','analysis_fail','duplicate_warning'].includes(body.action)) return fail('Operación no válida', 400, 'INVALID_ACTION');
    const doc = await documents.get(String(body.docId || '')).catch(() => null);
    if (!doc || doc.company_id !== companyId) return fail('Documento no disponible', 404, 'DOCUMENT_NOT_FOUND');
    if (!mutable.has(doc.status) || doc.linkedInvoiceId || doc.linkedJournalEntryId) return fail('El documento ya no admite cambios de análisis. Actualiza la lista.', 409, 'DOCUMENT_CHANGED');
    const now = new Date().toISOString();
    let patch: any;
    if (body.action === 'analysis_start') {
      if (doc.status === 'processing' && Date.now() - Date.parse(doc.analysisStartedAt) < 10 * 60 * 1000) return fail('Este documento ya se está analizando.', 409, 'ANALYSIS_RUNNING');
      patch = { status: 'processing', analysisStartedAt: now, safeErrorMessage: '' };
    } else if (body.action === 'duplicate_warning') {
      patch = { duplicateWarning: String(body.warning || '').slice(0, 1000) };
    } else {
      if (doc.status !== 'processing' || !body.analysisStartedAt || doc.analysisStartedAt !== body.analysisStartedAt) return fail('El análisis ha cambiado. Actualiza antes de reintentar.', 409, 'STALE_ANALYSIS');
      patch = { status: 'review_required' };
      if (body.action === 'analysis_complete') {
        const data = body.extractedData;
        if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length || JSON.stringify(data).length > 200000) return fail('Respuesta OCR no válida.', 400, 'INVALID_EXTRACTION');
        patch.extractedData = JSON.stringify(data);
        patch.analysisCompletedAt = now;
        patch.safeErrorMessage = '';
      } else {
        patch.safeErrorMessage = 'No se ha podido analizar automáticamente. El documento sigue guardado en revisión para reintentar o revisar manualmente.';
      }
    }
    patch.lastStatusChangedAt = now;
    patch.auditTrail = [...(Array.isArray(doc.auditTrail) ? doc.auditTrail : []), audit(user, body.action, doc.status, patch.status || doc.status)];
    return Response.json({ ok: true, document: await documents.update(doc.id, patch) });
  } catch (error) {
    // Do not expose provider payloads or document contents in logs/responses.
    console.error('[ocrDocumentIntake]', String(error?.name || 'Error'));
    return fail('No se pudo guardar el documento. Reintenta; no se ha aprobado ni contabilizado ninguna factura.', 502, 'INTAKE_UNAVAILABLE');
  }
});


import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Play, CheckCircle, FileText, Loader2, XCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import BulkDropZone from '@/components/lector/BulkDropZone';
import ReviewPanel from '@/components/lector/ReviewPanel';
import OcrDocumentTable from '@/components/ocr/OcrDocumentTable';
import { detectDeviceType, detectUploadSource, buildAuditEntry, appendAuditTrail, classifyUploadError, generateTraceId, generateIdempotencyKey, validateFile } from '@/lib/ocrUploadUtils';
import { runBatch, debounce } from '@/lib/batchProcessor';

const DOC_TYPE = 'income_invoice';
const SOURCE_MODULE = 'ocr_income';
const INVOICE_TIPO = 'emitida';

const trimestre = (fecha) => {
  const m = new Date(fecha || '').getMonth() + 1;
  return m <= 3 ? 'T1' : m <= 6 ? 'T2' : m <= 9 ? 'T3' : 'T4';
};

const parseExtracted = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  return raw;
};

const mapForm = (r) => ({
  numero_factura: r?.numero_factura || '',
  fecha_emision: r?.fecha || '',
  cliente_nombre: r?.cliente_nombre || '',
  cliente_nif: r?.cliente_nif || '',
  concepto: r?.concepto || '',
  base_imponible: r?.base_imponible || '',
  tipo_iva: r?.tipo_iva || 21,
  cuota_iva: r?.cuota_iva || '',
  retencion_irpf: r?.retencion_irpf || 0,
  retencion_tipo: r?.retencion_tipo || 'ninguna',
  importe_retencion: r?.importe_retencion || 0,
  total_factura: r?.total_factura || '',
  fecha_vencimiento: r?.fecha_vencimiento || '',
  estado_cobro: r?.estado_cobro_sugerido || 'pendiente',
  es_rectificativa: r?.es_rectificativa || false,
  factura_rectificada: r?.factura_rectificada || '',
});

const OCR_PROMPT = `Analiza esta factura emitida y extrae los datos en JSON. Si no encuentras un dato, usa null.
IMPORTANTE: Si es una factura rectificativa (abono, nota de crédito, o tiene importes negativos), marca es_rectificativa=true y extrae los importes con signo negativo.
Datos: numero_factura, fecha (YYYY-MM-DD), cliente_nombre, cliente_nif, concepto, base_imponible (número, negativo si rectificativa),
tipo_iva (número %), cuota_iva (número, negativo si rectificativa), retencion_irpf (número %, 0 si no aplica),
retencion_tipo (string: ninguna/profesional/alquiler/premios/otros), importe_retencion (número, negativo si rectificativa, 0 si no aplica),
total_factura (número, negativo si rectificativa), fecha_vencimiento (YYYY-MM-DD), estado_cobro_sugerido (pendiente/cobrada),
es_rectificativa (boolean, true si es factura rectificativa/abono), factura_rectificada (número de factura original rectificada, si aparece),
alertas_fiscales (array strings), datos_faltantes (array strings),
impuesto_detectado (string: IVA/IGIC/ninguno segun lo que aparezca en la factura),
tipo_operacion (string: interior/intracomunitaria/exportacion/adquisicion_intracomunitaria/inversion_sujeto_pasivo/isp),
pais_cliente (string codigo pais si se identifica, ej: ES, PT, FR, US),
es_cliente_ue (boolean, true si el cliente tiene NIF-IVA UE y parece operacion intracomunitaria),
nif_vies (string, NIF-IVA UE del cliente si aparece en factura intracomunitaria)`;

const OCR_SCHEMA = {
  type: 'object',
  properties: {
    numero_factura: { type: 'string' }, fecha: { type: 'string' },
    cliente_nombre: { type: 'string' }, cliente_nif: { type: 'string' },
    concepto: { type: 'string' }, base_imponible: { type: 'number' },
    tipo_iva: { type: 'number' }, cuota_iva: { type: 'number' },
    retencion_irpf: { type: 'number' }, retencion_tipo: { type: 'string' }, importe_retencion: { type: 'number' },
    total_factura: { type: 'number' },
    fecha_vencimiento: { type: 'string' }, estado_cobro_sugerido: { type: 'string' },
    es_rectificativa: { type: 'boolean' }, factura_rectificada: { type: 'string' },
    alertas_fiscales: { type: 'array', items: { type: 'string' } },
    datos_faltantes: { type: 'array', items: { type: 'string' } },
    impuesto_detectado: { type: 'string' },
    tipo_operacion: { type: 'string' },
    pais_cliente: { type: 'string' },
    es_cliente_ue: { type: 'boolean' },
    nif_vies: { type: 'string' },
  }
};

export default function LectorIngresos() {
  const { company, user, isAdmin, loadingCompany } = useOutletContext() || {};
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [validatingAll, setValidatingAll] = useState(false);

  const loadDocs = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const data = await base44.entities.OcrInvoiceDocument.filter(
        { company_id: company.id, documentType: DOC_TYPE },
        '-uploadedAt'
      );
      setDocuments(data || []);
    } catch {}
    setLoading(false);
  }, [company?.id]);

  useEffect(() => { if (company?.id) loadDocs(); }, [company?.id, loadDocs]);

  const debouncedLoadDocs = useMemo(() => debounce(loadDocs, 1200), [loadDocs]);

  useEffect(() => {
    if (!company?.id) return;
    const unsub = base44.entities.OcrInvoiceDocument.subscribe(() => debouncedLoadDocs());
    return () => { unsub(); debouncedLoadDocs.cancel(); };
  }, [company?.id, debouncedLoadDocs]);

  // Re-fetch when user returns to the tab (mobile-PC sync guarantee)
  useEffect(() => {
    const onFocus = () => { if (company?.id) loadDocs(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [company?.id, loadDocs]);

  const handleFilesAdded = async (files, captureMethod = 'file_picker') => {
    if (!company?.id) return;
    setUploading(true);
    const progress = files.map(f => ({ name: f.name, size: f.size, status: 'uploading' }));
    setUploadProgress(progress);

    const deviceType = detectDeviceType();
    const uploadSource = detectUploadSource(captureMethod, isAdmin, deviceType);

    const { succeeded: successCount, failed: errorCount } = await runBatch(files, async (file, i) => {
      const validation = validateFile(file);
      if (!validation.valid) throw new Error(validation.message);

      const traceId = generateTraceId();
      const idempotencyKey = generateIdempotencyKey(file, company.id, user?.id);

      const uploadResult = await Promise.race([
        base44.integrations.Core.UploadFile({ file }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 120000)),
      ]);
      const file_url = uploadResult?.file_url;
      if (!file_url) throw new Error('NO_URL_RETURNED');

      await base44.entities.OcrInvoiceDocument.create({
        company_id: company.id,
        uploadedByUserId: user?.id,
        uploadedByEmail: user?.email,
        documentType: DOC_TYPE,
        sourceModule: SOURCE_MODULE,
        status: 'pending',
        originalFileName: file.name,
        fileName: file.name,
        fileMimeType: file.type,
        fileSize: file.size,
        fileStorageUrl: file_url,
        uploadSource,
        captureMethod,
        uploadedFromDeviceType: deviceType,
        uploadedAt: new Date().toISOString(),
        lastStatusChangedAt: new Date().toISOString(),
        auditTrail: [buildAuditEntry({
          user, action: 'documento_subido', newStatus: 'pending',
          detail: `${captureMethod} from ${deviceType} | trace=${traceId} | idempotency=${idempotencyKey}`,
        })],
      });

      // Fire-and-forget timeline event — no await to keep upload fast
      base44.entities.TimelineEvent.create({
        company_id: company.id,
        tipo: 'documento_subido',
        titulo: `Factura de ingreso entregada: ${file.name}`,
        descripcion: 'Documento pendiente de revision por Taxea',
        color: 'verde',
        usuario_email: user?.email,
        automatico: true,
        visibilidad: 'ambos',
      }).catch(() => {});

      progress[i].status = 'done';
      setUploadProgress([...progress]);
    }, {
      concurrency: 5,
      onItemComplete: (i, { ok, error }) => {
        if (!ok) {
          const classified = classifyUploadError(error);
          console.error(`[OCR Upload] file="${files[i].name}" code=${classified.errorCode} raw=${classified.rawError || error?.message || error}`);
          progress[i].status = 'error';
          progress[i].error = classified.safeMessage;
          setUploadProgress([...progress]);
        }
      },
    });

    setUploading(false);
    if (successCount > 0 && errorCount === 0) {
      setToast({ type: 'success', message: `${successCount} factura(s) recibida(s). Quedan pendientes de revision por Taxea.` });
      setTimeout(() => setToast(null), 6000);
    } else if (successCount > 0 && errorCount > 0) {
      setToast({ type: 'error', message: `Se han subido ${successCount} archivo(s) y ${errorCount} han fallado. Reintenta solo los fallidos.` });
      setTimeout(() => setToast(null), 8000);
    } else if (errorCount > 0) {
      setToast({ type: 'error', message: progress[0]?.error || 'No se pudo subir el archivo. Inténtalo de nuevo.' });
      setTimeout(() => setToast(null), 8000);
    }
    const hadErrors = errorCount > 0;
    setTimeout(() => setUploadProgress([]), hadErrors ? 8000 : 5000);
    loadDocs();
  };

  const processOcr = async (doc) => {
    setProcessingIds(prev => new Set([...prev, doc.id]));
    const now = new Date().toISOString();
    await base44.entities.OcrInvoiceDocument.update(doc.id, {
      status: 'processing',
      analysisStartedAt: now,
      lastStatusChangedAt: now,
      safeErrorMessage: '',
      auditTrail: appendAuditTrail(doc.auditTrail, buildAuditEntry({ user, action: 'ocr_iniciado', prevStatus: doc.status, newStatus: 'processing' })),
    });
    debouncedLoadDocs();

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: OCR_PROMPT,
        file_urls: [doc.fileStorageUrl],
        response_json_schema: OCR_SCHEMA,
      });
      const doneNow = new Date().toISOString();
      await base44.entities.OcrInvoiceDocument.update(doc.id, {
        status: 'review_required',
        extractedData: JSON.stringify(result),
        analysisCompletedAt: doneNow,
        lastStatusChangedAt: doneNow,
        auditTrail: appendAuditTrail(doc.auditTrail, buildAuditEntry({ user, action: 'ocr_completado', prevStatus: 'processing', newStatus: 'review_required' })),
      });
    } catch {
      const failNow = new Date().toISOString();
      await base44.entities.OcrInvoiceDocument.update(doc.id, {
        status: 'analysis_failed',
        safeErrorMessage: 'No se ha podido analizar automaticamente. El documento sigue guardado para revision manual.',
        lastStatusChangedAt: failNow,
        auditTrail: appendAuditTrail(doc.auditTrail, buildAuditEntry({ user, action: 'ocr_fallido', prevStatus: 'processing', newStatus: 'analysis_failed' })),
      });
    }
    setProcessingIds(prev => { const n = new Set(prev); n.delete(doc.id); return n; });
    debouncedLoadDocs();
  };

  const processAllPending = async () => {
    const pending = documents.filter(d => d.status === 'pending' || d.status === 'analysis_failed');
    await runBatch(pending, (doc) => processOcr(doc), { concurrency: 3 });
  };

  const handleReview = (doc) => {
    const extracted = parseExtracted(doc.extractedData);
    setReviewing({
      id: doc.id,
      file: { name: doc.originalFileName, size: doc.fileSize },
      fileUrl: doc.fileStorageUrl,
      extracted,
      formData: mapForm(extracted),
    });
  };

  const [validating, setValidating] = useState(false);

  const handleValidate = async (docId, form) => {
    if (!form.numero_factura) {
      setToast({ type: 'error', message: 'El número de factura es obligatorio.' });
      setTimeout(() => setToast(null), 6000);
      return;
    }
    if (!form.fecha_emision) {
      setToast({ type: 'error', message: 'La fecha de emisión es obligatoria.' });
      setTimeout(() => setToast(null), 6000);
      return;
    }
    if (!form.base_imponible || parseFloat(form.base_imponible) <= 0) {
      setToast({ type: 'error', message: 'La base imponible debe ser mayor que 0.' });
      setTimeout(() => setToast(null), 6000);
      return;
    }
    setValidating(true);
    try {
      const res = await Promise.race([
        base44.functions.invoke('approveOcrDocument', {
          docId,
          form,
          invoiceType: 'emitida',
          extractedData: reviewing?.extracted,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('El servidor tarda demasiado en responder.')), 45000)),
      ]);
      const result = res?.data || res;
      if (!result?.success) {
        throw new Error(result?.error || 'No se pudo crear la factura');
      }
      setReviewing(null);
      setToast({ type: 'success', message: 'Factura aprobada y guardada correctamente.' });
      setTimeout(() => setToast(null), 6000);
      loadDocs();
    } catch (err) {
      console.error('[LectorIngresos] Error al aprobar:', err);
      setToast({ type: 'error', message: `No se ha podido guardar la factura en el area financiera. El documento sigue pendiente de revision. (${err?.message || 'inténtalo de nuevo'})` });
      setTimeout(() => setToast(null), 8000);
    }
    setValidating(false);
  };

  const handleReject = async (docId) => {
    setValidating(true);
    try {
      const doc = documents.find(d => d.id === docId);
      const now = new Date().toISOString();
      await base44.entities.OcrInvoiceDocument.update(docId, {
        status: 'rejected',
        rejectedAt: now,
        lastStatusChangedAt: now,
        reviewedByAdminId: user?.id,
        auditTrail: appendAuditTrail(doc?.auditTrail, buildAuditEntry({ user, action: 'rechazado', prevStatus: doc?.status, newStatus: 'rejected' })),
      });
      setReviewing(null);
      loadDocs();
    } catch (err) {
      console.error('[LectorIngresos] Error al rechazar:', err);
      setToast({ type: 'error', message: `Error al rechazar: ${err?.message || 'inténtalo de nuevo'}` });
      setTimeout(() => setToast(null), 8000);
    }
    setValidating(false);
  };

  const handleWithdraw = async (docId) => {
    const doc = documents.find(d => d.id === docId);
    const now = new Date().toISOString();
    await base44.entities.OcrInvoiceDocument.update(docId, {
      status: 'cancelled_by_client',
      lastStatusChangedAt: now,
      auditTrail: appendAuditTrail(doc?.auditTrail, buildAuditEntry({ user, action: 'retirado_por_cliente', prevStatus: doc?.status, newStatus: 'cancelled_by_client' })),
    });
    loadDocs();
  };

  const validateAll = async () => {
    const reviewDocs = documents.filter(d => d.status === 'review_required');
    if (reviewDocs.length === 0) {
      setToast({ type: 'error', message: 'No hay documentos pendientes de validación.' });
      setTimeout(() => setToast(null), 6000);
      return;
    }
    setValidatingAll(true);
    const { succeeded: ok, failed: fail } = await runBatch(reviewDocs, async (doc) => {
      const extracted = parseExtracted(doc.extractedData);
      const form = mapForm(extracted);
      const res = await base44.functions.invoke('approveOcrDocument', {
        docId: doc.id, form, invoiceType: 'emitida', extractedData: extracted,
      });
      const result = res?.data || res;
      if (!result?.success) throw new Error(result?.error || 'Error al contabilizar');
    }, { concurrency: 5 });
    setValidatingAll(false);
    window.dispatchEvent(new Event('financials:refresh'));
    loadDocs();
    if (fail === 0) {
      setToast({ type: 'success', message: `${ok} factura(s) contabilizada(s) automáticamente con los datos de la IA.` });
      setTimeout(() => setToast(null), 6000);
    } else {
      setToast({ type: 'error', message: `${ok} contabilizadas OK, ${fail} fallaron. Revisa la lista para detalles.` });
      setTimeout(() => setToast(null), 8000);
    }
  };

  if (loadingCompany) return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!company) return <NoCompanyState pageName="el Lector de Ingresos" />;

  const pendingCount = documents.filter(d => d.status === 'pending' || d.status === 'analysis_failed').length;
  const reviewCount = documents.filter(d => d.status === 'review_required').length;

  return (
    <div>
      <PageHeader title="Lector de Ingresos" subtitle="Entrega de facturas emitidas · Taxea revisa y contabiliza">
        {pendingCount > 0 && (
          <Button onClick={processAllPending} disabled={uploading || validatingAll} className="bg-teal hover:bg-teal-dark h-9 gap-2">
            <Play className="w-4 h-4" /> Procesar {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </Button>
        )}
        {reviewCount > 0 && (
          <Button onClick={validateAll} disabled={uploading || validatingAll} variant="default" className="h-9 gap-2">
            {validatingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {validatingAll ? 'Validando...' : `Validar ${reviewCount} revisada${reviewCount > 1 ? 's' : ''}`}
          </Button>
        )}
      </PageHeader>

      {!isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Entrega tus facturas de ingreso aqui</p>
            <p className="text-xs text-blue-700 mt-0.5">Arrastra los archivos y quedan registradas como pendientes. Taxea las revisara antes de validarlas o contabilizarlas.</p>
          </div>
        </div>
      )}

      {uploadProgress.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-card mb-5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-secondary/40">
            <p className="text-sm font-semibold">Subiendo {uploadProgress.length} archivo(s)...</p>
          </div>
          <div className="divide-y divide-border">
            {uploadProgress.map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.size ? `${(p.size/1024/1024).toFixed(2)} MB` : ''}</p>
                </div>
                {p.status === 'uploading' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                {p.status === 'done' && <CheckCircle className="w-4 h-4 text-green-500" />}
                {p.status === 'error' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-500 hidden sm:inline">{p.error || 'Error'}</span>
                    <XCircle className="w-4 h-4 text-red-500" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className={toast.type === 'error' ? 'bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex items-center gap-3' : 'bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-center gap-3'}>
          {toast.type === 'error'
            ? <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            : <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />}
          <p className={toast.type === 'error' ? 'text-sm text-red-800' : 'text-sm text-green-800'}>{toast.message}</p>
        </div>
      )}

      <div className="mb-5">
        <BulkDropZone onFilesAdded={handleFilesAdded} />
      </div>

      {reviewing && (
        <div className="mb-5">
          <ReviewPanel
            doc={reviewing}
            tipo="ingresos"
            onApprove={handleValidate}
            onReject={handleReject}
            onCancel={() => setReviewing(null)}
            loading={validating}
            companyId={company?.id}
          />
        </div>
      )}

      <OcrDocumentTable
        documents={documents}
        loading={loading}
        isAdmin={isAdmin}
        onRefresh={loadDocs}
        onProcessOcr={processOcr}
        onReview={handleReview}
        onWithdraw={handleWithdraw}
        processingIds={processingIds}
        emptyMessage="Todavia no hay facturas de ingreso entregadas en este apartado."
      />
    </div>
  );
}
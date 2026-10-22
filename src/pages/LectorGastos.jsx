import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { loadOcrWorkspace, invoiceSourceData, approveWorkspaceDocument, approveStoredOcrBatch } from '@/lib/ocrWorkspace.mjs';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Play, CheckCircle, FileText, Loader2, XCircle, CopyCheck } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import BulkDropZone from '@/components/lector/BulkDropZone';
import ReviewPanel from '@/components/lector/ReviewPanel';
import OcrReviewWorkspace from '@/components/lector/OcrReviewWorkspace';
import { reviewableDocuments, nextAfterConfirmation } from '@/lib/ocrReviewQueue.mjs';
import OcrDocumentTable from '@/components/ocr/OcrDocumentTable';
import DuplicateCheckModal from '@/components/shared/DuplicateCheckModal';
import { detectDeviceType, classifyUploadError, validateFile } from '@/lib/ocrUploadUtils';
import { ocrIntake, needsOcrAnalysis } from '@/lib/ocrIntake.mjs';
import { runBatch, debounce } from '@/lib/batchProcessor';

const DOC_TYPE = 'expense_invoice';
const SOURCE_MODULE = 'ocr_expense';
const INVOICE_TIPO = 'recibida';

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
  numero_factura:r?.numero_factura || '',
  fiscal_activity_id:r?.fiscal_activity_id || '',fiscal_criteria:r?.fiscal_criteria || {},
  cuenta_contable_manual:r?.cuenta_contable_manual || '',
  proveedor_cliente: r?.proveedor || '',
  nif_proveedor: r?.nif_proveedor || '',
  email_proveedor: r?.email_proveedor || r?.proveedor_email || '',
  telefono_proveedor: r?.telefono_proveedor || r?.proveedor_telefono || '',
  direccion_proveedor: r?.direccion_proveedor || r?.proveedor_direccion || '',
  codigo_postal_proveedor: r?.codigo_postal_proveedor || r?.proveedor_codigo_postal || '',
  ciudad_proveedor: r?.ciudad_proveedor || r?.proveedor_ciudad || '',
  provincia_proveedor: r?.provincia_proveedor || r?.proveedor_provincia || '',
  pais_proveedor: r?.pais_proveedor || r?.proveedor_pais || '',
  concepto: r?.concepto || '',
  fecha: r?.fecha || '',
  fecha_recepcion: r?.fecha_recepcion || new Date().toISOString().slice(0, 10),
  base_imponible: r?.base_imponible || '',
  tipo_impuesto: r?.tipo_impuesto ?? 21,
  cuota_impuesto: r?.cuota_impuesto || '',
  total: r?.total || '',
  categoria: r?.categoria_sugerida || 'otros',
  cuenta_pgc: r?.cuenta_pgc || '',
  confianza_pgc: r?.confianza_pgc || 0,
  motivo_clasificacion: r?.motivo_clasificacion || '',
  retencion_irpf: r?.retencion_irpf || 0,
  retencion_tipo: r?.retencion_tipo || 'ninguna',
  importe_retencion: r?.importe_retencion || 0,
  es_rectificativa: r?.es_rectificativa || false,
  factura_rectificada: r?.factura_rectificada || '',
  situacion_impuesto: r?.situacion_impuesto || 'sujeta_gravada',
});

const buildOcrPrompt = (company, fiscalProfile, activity) => {
  const territory = fiscalProfile?.mainTerritory || '';
  const regime = activity?.indirectTaxRegime || '';
  const isCanarias = territory === 'canarias';

  return `Analiza este documento fiscal (factura, ticket o justificante de gasto) RECIBIDO por la empresa y extrae los datos en JSON.
CONTEXTO FISCAL DEL RECEPTOR:
- Territorio: ${isCanarias ? 'Canarias (IGIC)' : territory}
- Régimen: ${regime}
- El PROVEEDOR es quien EMITE la factura (no la empresa receptora).
- Extrae el NIF del proveedor (nif_proveedor) tal como aparece en la factura.

REGLAS:
- Si no encuentras un dato, usa null.
- Si es factura rectificativa (abono, nota de crédito, importes negativos), marca es_rectificativa=true y extrae importes con signo negativo.
- Solo extrae retenciones si aparecen EXPLÍCITAMENTE en la factura. No las inventes.

Datos: proveedor (nombre emisor), nif_proveedor, email_proveedor, telefono_proveedor, direccion_proveedor, codigo_postal_proveedor, ciudad_proveedor, provincia_proveedor, pais_proveedor, fecha (YYYY-MM-DD), numero_factura, base_imponible (número, negativo si rectificativa),
tipo_impuesto (número %), cuota_impuesto (número, negativo si rectificativa), total (número, negativo si rectificativa),
retencion_irpf (número %, 0 si no aplica), retencion_tipo (string: ninguna/profesional/alquiler/premios/otros), importe_retencion (número, negativo si rectificativa, 0 si no aplica),
categoria_sugerida (compras/suministros/alquiler/servicios_profesionales/software/transporte/dietas/seguros/otros),
cuenta_pgc (cuenta 6XX PGC), confianza_pgc (0-100), motivo_clasificacion,
es_factura_completa (boolean), es_proveedor_extranjero (boolean),
es_rectificativa (boolean, true si es factura rectificativa/abono), factura_rectificada (número de factura original rectificada, si aparece),
datos_faltantes (array strings), alertas_fiscales (array strings), concepto,
impuesto_detectado (string: IVA/IGIC/ninguno segun lo que aparezca en la factura),
situacion_impuesto (string: sujeta_gravada/sujeta_exenta/no_sujeta - sujeta_gravada si aplica IGIC/IVA, sujeta_exenta si la operación está exenta, no_sujeta si no está sujeta al impuesto),
tipo_operacion (string: interior/intracomunitaria/exportacion/importacion/adquisicion_intracomunitaria/inversion_sujeto_pasivo/isp),
pais_proveedor (string codigo pais si se identifica, ej: ES, PT, FR, US),
es_profesional_pf (boolean, true si el proveedor parece ser profesional persona fisica con NIF que empieza por numero o ciertas letras),
es_arrendamiento (boolean, true si el concepto parece alquiler de local/inmueble),
nif_vies (string, NIF-IVA UE si aparece en factura intracomunitaria)`;
};

const OCR_SCHEMA = {
  type: 'object',
  properties: {
    proveedor: { type: 'string' }, nif_proveedor: { type: 'string' },
    email_proveedor: { type: 'string' }, telefono_proveedor: { type: 'string' },
    direccion_proveedor: { type: 'string' }, codigo_postal_proveedor: { type: 'string' },
    ciudad_proveedor: { type: 'string' }, provincia_proveedor: { type: 'string' }, pais_proveedor: { type: 'string' },
    fecha: { type: 'string' }, numero_factura: { type: 'string' },
    base_imponible: { type: 'number' }, tipo_impuesto: { type: 'number' },
    cuota_impuesto: { type: 'number' }, total: { type: 'number' },
    categoria_sugerida: { type: 'string' }, cuenta_pgc: { type: 'string' },
    confianza_pgc: { type: 'number' }, motivo_clasificacion: { type: 'string' },
    es_factura_completa: { type: 'boolean' }, es_proveedor_extranjero: { type: 'boolean' },
    es_rectificativa: { type: 'boolean' }, factura_rectificada: { type: 'string' },
    datos_faltantes: { type: 'array', items: { type: 'string' } },
    alertas_fiscales: { type: 'array', items: { type: 'string' } },
    concepto: { type: 'string' },
    retencion_irpf: { type: 'number' },
    retencion_tipo: { type: 'string' },
    importe_retencion: { type: 'number' },
    impuesto_detectado: { type: 'string' },
    situacion_impuesto: { type: 'string' },
    tipo_operacion: { type: 'string' },
    es_profesional_pf: { type: 'boolean' },
    es_arrendamiento: { type: 'boolean' },
    nif_vies: { type: 'string' },
  }
};

export default function LectorGastos({ reviewPage = false }) {
  const { company, isAdmin, loadingCompany } = useOutletContext() || {};
  const navigate = useNavigate();
  const location = useLocation();
  const selectedReviewId = new URLSearchParams(location.search).get('doc');
  const reviewDone = new URLSearchParams(location.search).get('done') === '1';
  const reviewPath = '/tax-accounting/ocr-gastos-revision';
  const openReviewPage = id => {
    setReviewMessage('');
    navigate(`${reviewPath}?doc=${encodeURIComponent(id)}`, reviewPage ? undefined : {
      state: { companyId: company?.id, ocrDocuments: reviewableDocuments(documents) },
    });
  };
  const [documents, setDocuments] = useState(() => reviewPage && location.state?.companyId === company?.id
    && Array.isArray(location.state?.ocrDocuments) ? location.state.ocrDocuments : []);
  const loadVersion = useRef(0);
  const activeCompanyId = useRef(company?.id);
  useEffect(() => {
    if (activeCompanyId.current === company?.id) return;
    activeCompanyId.current = company?.id;
    loadVersion.current++; setDocuments([]); setReviewing(null);
  }, [company?.id]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [validatingAll, setValidatingAll] = useState(false);
  const [bulkIds,setBulkIds]=useState([]);
  const [bulkProgress,setBulkProgress]=useState(null);
  const cancelBulk=useRef(false);
  const [reviewError,setReviewError]=useState('');
  const [reviewMessage,setReviewMessage]=useState('');
  useEffect(()=>{cancelBulk.current=true;setBulkIds([]);setBulkProgress(null);setReviewError('');},[company?.id]);
  const [showDuplicateCheck, setShowDuplicateCheck] = useState(false);
  const [fiscalContext, setFiscalContext] = useState(/** @type {any} */ ({}));

  useEffect(() => {
    if (!company?.id) return;
    let cancelled=false;
    base44.functions.invoke('fiscalOperations',{action:'source_context',companyId:company.id}).then(response=>{
      const result=response?.data??response;
      if(!cancelled && result?.success) setFiscalContext({...result,activity:result.activities?.find(row=>row.active!==false),
        activities:(result.activities || []).filter(row=>row.active!==false)});
    }).catch(()=>{if(!cancelled)setFiscalContext({});});
    return ()=>{cancelled=true;};
  }, [company?.id]);

  const loadDocs = useCallback(async () => {
    if (!company?.id) return;
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const data = await loadOcrWorkspace(base44,company.id,DOC_TYPE);
      if (version === loadVersion.current) setDocuments(data);
    } catch {
      if (version === loadVersion.current) setToast({ type: 'error', message: 'No se pudo actualizar el OCR. Se conserva la última lista; pulsa Actualizar antes de volver a aprobar.' });
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
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
    if (!company?.id || uploadLock.current || !files.length) return;
    const companyId = company.id;
    uploadLock.current = true;
    setUploading(true);
    const progress = files.map(f => ({ name: f.name, size: f.size, status: 'uploading' }));
    setUploadProgress(progress);
    const deviceType = detectDeviceType();
    try {
      const { succeeded, failed } = await runBatch(files, async (file, i) => {
        const validation = validateFile(file);
        if (!validation.valid) throw new Error(validation.message);
        await ocrIntake(base44, { action: 'upload', companyId, documentType: DOC_TYPE,
          file, captureMethod, deviceType });
        progress[i].status = 'done';
        if (activeCompanyId.current === companyId) setUploadProgress([...progress]);
      }, {
        concurrency: 3,
        onItemComplete: (i, { ok, error }) => {
          if (ok) return;
          const classified = classifyUploadError(error);
          console.error('[OCR Upload]', classified.errorCode);
          progress[i].status = 'error';
          progress[i].error = classified.safeMessage;
          if (activeCompanyId.current === companyId) setUploadProgress([...progress]);
        },
      });
      if (activeCompanyId.current !== companyId) return;
      setToast({ type: failed ? 'error' : 'success', message: failed
        ? (succeeded ? `Se han entregado ${succeeded} archivo(s) y ${failed} han fallado. Reintenta solo los fallidos.` : progress.find(item => item.error)?.error || 'No se pudo completar la entrega. Reintenta solo los fallidos.')
        : `${succeeded} archivo(s) entregados. Los nuevos están en Pendientes para analizar; los ya entregados conservan su estado. No se han aprobado ni contabilizado.` });
      loadDocs();
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  };

  const processOcr = async (doc) => {
    const companyId = company.id;
    setProcessingIds(prev => new Set([...prev, doc.id]));
    let started;
    try {
      const result = await ocrIntake(base44, { action: 'analysis_start', companyId, docId: doc.id });
      started = result.document.analysisStartedAt;
      debouncedLoadDocs();
      const extracted = await (/** @type {any} */ (base44)).controlledCore.InvokeLLM({
        prompt: buildOcrPrompt(company, fiscalContext.profile, fiscalContext.activity),
        file_urls: [doc.fileStorageUrl],
        response_json_schema: OCR_SCHEMA,
      });
      await ocrIntake(base44, { action: 'analysis_complete', companyId, docId: doc.id,
        analysisStartedAt: started, extractedData: extracted });
      const [contactSync, duplicateScan] = await Promise.allSettled([
        base44.functions.invoke('syncInvoiceContacts', { action: 'sync_ocr', docId: doc.id, extractedData: extracted }),
        base44.functions.invoke('checkDuplicates', { action: 'check_one', company_id: companyId, scope: SOURCE_MODULE, docId: doc.id, period_type: 'all' }),
      ]);
      if (contactSync.status === 'rejected') console.warn('[OCR] No se pudo sincronizar el contacto.');
      if (duplicateScan.status === 'fulfilled') {
        const scan = duplicateScan.value?.data ?? duplicateScan.value;
        const warning = scan?.duplicateGroupsCount > 0
          ? 'Posible duplicado: coinciden tercero, número y fecha con otra factura o documento OCR. Revísalo antes de confirmar.' : '';
        await ocrIntake(base44, { action: 'duplicate_warning', companyId, docId: doc.id, warning })
          .catch(() => console.warn('[OCR] No se pudo guardar el aviso de duplicado.'));
      }
    } catch (error) {
      if (started) await ocrIntake(base44, { action: 'analysis_fail', companyId, docId: doc.id,
        analysisStartedAt: started }).catch(() => {});
      if (activeCompanyId.current === companyId) setToast({ type: 'error',
        message: error?.response?.data?.error || 'El documento sigue guardado en revisión. No se pudo completar el análisis.' });
    } finally {
      setProcessingIds(prev => { const next = new Set(prev); next.delete(doc.id); return next; });
      if (activeCompanyId.current === companyId) debouncedLoadDocs();
    }
  };

  const processAllPending = async () => {
    if (validatingAll) return;
    setValidatingAll(true);
    try { await runBatch(documents.filter(needsOcrAnalysis), doc => processOcr(doc), { concurrency: 3 }); }
    finally { setValidatingAll(false); }
  };

  const handleReview = (doc) => {
    const extracted = doc.invoiceSource ? invoiceSourceData(doc.invoiceSource) : parseExtracted(doc.extractedData);
    setReviewError('');
    setReviewing({
      ...doc,
      id: doc.id,
      file: { name: doc.originalFileName, size: doc.fileSize },
      fileUrl: doc.fileStorageUrl,
      extracted,
      formData: mapForm(extracted),
    });
  };

  useEffect(() => {
    if (!reviewPage || (loading && documents.length === 0)) return;
    if (!selectedReviewId && !reviewDone) {
      const first = reviewableDocuments(documents)[0];
      if (first) navigate(`${reviewPath}?doc=${encodeURIComponent(first.id)}`, { replace: true });
      return;
    }
    const selected = reviewableDocuments(documents).find(doc => doc.id === selectedReviewId);
    if (selected && reviewing?.id !== selected.id) handleReview(selected);
    if (!selected && reviewing) setReviewing(null);
  }, [reviewPage, loading, selectedReviewId, reviewDone, documents, reviewing?.id, navigate]);

  const [validating, setValidating] = useState(false);

  const handleApproveSelected = async () => {
    if(!company?.id || !bulkIds.length || validating) return;
    cancelBulk.current=false;
    setValidating(true);
    setBulkProgress({done:0,failed:0,total:bulkIds.length,remaining:bulkIds.length});
    try {
      const result=await approveStoredOcrBatch(base44,company.id,documents,bulkIds,mapForm,INVOICE_TIPO,{
        activities:fiscalContext.activities || [],
        shouldStop:()=>cancelBulk.current,
        onSuccess:doc=>setDocuments(rows=>rows.map(row=>row.id===doc.id?{...row,status:'accounted',safeErrorMessage:''}:row)),
        onFailure:(doc,reason)=>{if(doc)setDocuments(rows=>rows.map(row=>row.id===doc.id?{...row,safeErrorMessage:reason}:row));},
        onProgress:setBulkProgress,
      });
      setBulkProgress(result);
      setToast({type:result.failed?'error':'success',message:`Lote: ${result.done} contabilizadas, ${result.failed} con incidencia, ${result.remaining} pendientes.`});
      window.dispatchEvent(new Event('financials:refresh'));
    } catch(error) {
      setToast({type:'error',message:error?.response?.data?.error || error?.message || 'El lote se ha detenido. Los documentos no confirmados siguen pendientes.'});
    } finally {
      setBulkIds([]);setReviewing(null);setValidating(false);
      loadDocs();
    }
  };

  const handleValidate = async (docId, form) => {
    if (!form.proveedor_cliente) {
      setReviewError('El nombre del proveedor es obligatorio.');
      setToast({ type: 'error', message: 'El nombre del proveedor es obligatorio.' });
      setTimeout(() => setToast(null), 6000);
      return;
    }
    if (!form.fecha) {
      setReviewError('La fecha de la factura es obligatoria.');
      setToast({ type: 'error', message: 'La fecha de la factura es obligatoria.' });
      setTimeout(() => setToast(null), 6000);
      return;
    }
    const baseValue = parseFloat(form.base_imponible);
    const isRectificative = form.es_rectificativa === true || form.es_rectificativa === 'true';
    if (!Number.isFinite(baseValue) || baseValue === 0 || (baseValue < 0 && !isRectificative)) {
      setReviewError('La base imponible debe ser distinta de 0; los importes negativos requieren marcar factura rectificativa.');
      setToast({ type: 'error', message: 'La base imponible debe ser distinta de 0; los importes negativos requieren marcar factura rectificativa.' });
      setTimeout(() => setToast(null), 6000);
      return;
    }
    setValidating(true);
    try {
      const doc=documents.find(row=>row.id===docId) || reviewing;
      await approveWorkspaceDocument(base44,company.id,doc,form,INVOICE_TIPO);
      const followingId = reviewPage ? nextAfterConfirmation(documents, docId) : null;
      setDocuments(rows => rows.map(row => row.id === docId ? { ...row, status: 'accounted', safeErrorMessage: '' } : row));
      setReviewing(null);
      setReviewMessage('Factura contabilizada. Puedes continuar con la siguiente.');
      setToast({type:'success',message:'Factura, libro y asiento confirmados desde el OCR, sin un segundo check.'});
      window.dispatchEvent(new Event('financials:refresh'));
      setTimeout(() => setToast(null), 6000);
      if (reviewPage) navigate(followingId ? `${reviewPath}?doc=${encodeURIComponent(followingId)}` : `${reviewPath}?done=1`, { replace: true });
      loadDocs();
    } catch (err) {
      console.error('[LectorGastos] Error al aprobar:', err);
      const message=err?.response?.data?.error || err?.message || 'No se pudo completar el documento.';
      setReviewError(message);
      setToast({type:'error',message});
      setTimeout(() => setToast(null), 8000);
    } finally {setValidating(false);}
  };

  const handleDocumentAction = async (docId, action) => {
    if (!company?.id || validating) return;
    if (action === 'return_to_pending' && !window.confirm('¿Volver a pendientes y repetir el análisis OCR? Se reemplazarán los datos extraídos al analizar de nuevo. Se conserva el archivo original; no se crea ni elimina ninguna factura o asiento.')) return;
    const companyId = company.id;
    setValidating(true);
    setReviewError('');
    try {
      const result = await ocrIntake(base44, { action, companyId, docId });
      if (activeCompanyId.current !== companyId) return;
      const followingId = reviewPage ? nextAfterConfirmation(documents, docId) : null;
      setDocuments(rows => rows.map(row => row.id === docId ? { ...row, ...result.document } : row));
      setReviewing(null);
      setBulkIds([]);
      const message = action === 'reject' ? 'Documento movido a Rechazados. No se ha borrado el archivo.'
        : action === 'return_to_pending' ? 'Documento devuelto a Pendientes. Pulsa Procesar OCR para repetir la extracción.'
        : 'Documento retirado. Lo encontrarás en Rechazados.';
      setReviewMessage(message);
      setToast({ type: 'success', message });
      if (reviewPage) navigate(followingId ? `${reviewPath}?doc=${encodeURIComponent(followingId)}` : `${reviewPath}?done=1`, { replace: true });
      loadDocs();
    } catch (err) {
      if (activeCompanyId.current !== companyId) return;
      const message = err?.response?.data?.error || err?.message || 'No se pudo guardar el cambio. El documento conserva su estado anterior.';
      setReviewError(message);
      setToast({ type: 'error', message });
    } finally { setValidating(false); }
  };
  const handleReject = docId => handleDocumentAction(docId, 'reject');
  const handleReturnToPending = docId => handleDocumentAction(docId, 'return_to_pending');
  const handleWithdraw = docId => handleDocumentAction(docId, 'withdraw');

  if (loadingCompany) return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!company) return <NoCompanyState pageName="el Lector de Gastos" />;

  const pendingCount = documents.filter(needsOcrAnalysis).length;

  if (reviewPage) return (
    <OcrReviewWorkspace kind="recibidas" documents={documents} selectedId={selectedReviewId} loading={loading}
      busy={validating} message={reviewMessage} onNavigate={openReviewPage}
      onExit={() => { setReviewing(null); navigate('/tax-accounting/lector-gastos'); }}>
      {reviewing && reviewing.id === selectedReviewId && <ReviewPanel key={reviewing.id} expanded
        doc={reviewing} fiscalContext={fiscalContext} error={reviewError} tipo="gastos"
        onApprove={handleValidate} onReject={handleReject} onReturnToPending={handleReturnToPending}
        onCancel={() => navigate('/tax-accounting/lector-gastos')} loading={validating}
        companyId={company?.id} fiscalActivities={fiscalContext.activities || []} />}
    </OcrReviewWorkspace>
  );

  return (
    <div data-ocr-intake-version="2">
      <PageHeader title="Lector de Gastos" subtitle="Entrega de facturas recibidas y tickets · Taxea revisa y contabiliza">
        <Button variant="outline" onClick={() => setShowDuplicateCheck(true)} className="h-9 gap-2">
          <CopyCheck className="w-4 h-4" /> Chequeo duplicado
        </Button>
        {pendingCount > 0 && (
          <Button onClick={processAllPending} disabled={uploading || validatingAll} className="bg-teal hover:bg-teal-dark h-9 gap-2">
            <Play className="w-4 h-4" /> Procesar {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </Button>
        )}
      </PageHeader>

      {!isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Entrega tus facturas de gasto aqui</p>
            <p className="text-xs text-blue-700 mt-0.5">Escanea, arrastra o selecciona archivos: quedan en Pendientes. Al procesar el OCR se extraen los datos y pasan a En revisión. Solo al confirmar se contabilizan.</p>
          </div>
        </div>
      )}

      {uploadProgress.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-card mb-5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-secondary/40">
            <p className="text-sm font-semibold">{uploading ? 'Subiendo' : 'Resultado de la entrega'}: {uploadProgress.length} archivo(s)</p>
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
        <BulkDropZone onFilesAdded={handleFilesAdded} disabled={uploading} />
      </div>

      {bulkIds.length>0 && !reviewPage && <div className="mb-5 rounded-xl border border-teal/30 bg-teal/5 p-4 text-sm">
        <p className="font-semibold">Procesar {bulkIds.length} OCR con sus propuestas individuales</p>
        <p className="mt-1 text-muted-foreground">Cada factura conserva sus propios datos, cuenta sugerida y criterio fiscal guardado. Los casos con datos insuficientes quedarán pendientes para revisión individual.</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={validating} onClick={handleApproveSelected}>{validating?'Procesando lote...':`Confirmar y procesar ${bulkIds.length}`}</Button>
          <Button size="sm" variant="outline" disabled={validating} onClick={()=>setBulkIds([])}>Cancelar</Button>
        </div>
      </div>}
      {reviewing && !bulkIds.length && (
        <div className="mb-5">
          <ReviewPanel
            key={`${reviewing.id}:${bulkIds.length}`}
            doc={reviewing}
            fiscalContext={fiscalContext}
            bulkCount={bulkIds.length}
            error={reviewError}
            tipo="gastos"
            onApprove={handleValidate}
            onReject={handleReject}
            onReturnToPending={handleReturnToPending}
            onCancel={() => {setReviewing(null);setBulkIds([]);}}
            loading={validating}
            companyId={company?.id}
            fiscalActivities={fiscalContext.activities || []}
          />
        </div>
      )}

      {bulkProgress && <div role="status" className="mb-3 rounded-lg border p-3 text-sm">
        Lote: {bulkProgress.done} contabilizadas · {bulkProgress.failed} incidencias · {bulkProgress.remaining ?? bulkProgress.total-bulkProgress.done-bulkProgress.failed} pendientes.
        {validating && <button className="ml-3 underline" onClick={()=>{cancelBulk.current=true;}}>Detener al terminar la factura actual</button>}
        {bulkProgress.issues?.length>0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">{bulkProgress.issues.slice(0,10).map(issue=><li key={issue.id}>{issue.reason}</li>)}{bulkProgress.issues.length>10 && <li>Hay {bulkProgress.issues.length-10} incidencias más. Revisa los OCR que continúan pendientes.</li>}</ul>}
      </div>}
      <OcrDocumentTable
        documents={documents}
        loading={loading}
        isAdmin={isAdmin}
        onRefresh={loadDocs}
        onProcessOcr={processOcr}
        onReview={doc=>{setBulkIds([]);openReviewPage(doc.id);}}
        onBulkReview={ids=>{setBulkIds(ids);setBulkProgress(null);setReviewing(null);setReviewError('');}}
        busy={validating}
        onWithdraw={handleWithdraw}
        onReturnToPending={handleReturnToPending}
        processingIds={processingIds}
        emptyMessage="Todavia no hay facturas de gasto entregadas en este apartado."
      />

      <DuplicateCheckModal
        open={showDuplicateCheck}
        onClose={() => { setShowDuplicateCheck(false); loadDocs(); }}
        companyId={company?.id}
        scope="ocr_expense"
        scopeLabel="Lector de Gastos"
      />
    </div>
  );
}



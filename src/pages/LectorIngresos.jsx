import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { loadOcrWorkspace, invoiceSourceData, approveWorkspaceDocument } from '@/lib/ocrWorkspace.mjs';
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
  
  fiscal_activity_id:r?.fiscal_activity_id || '',fiscal_criteria:r?.fiscal_criteria || {},
  cuenta_contable_manual:r?.cuenta_contable_manual || '',
  numero_factura: r?.numero_factura || '',
  fecha_emision: r?.fecha || '',
  cliente_nombre: r?.cliente_nombre || '',
  cliente_nif: r?.cliente_nif || '',
  cliente_email: r?.email_cliente || r?.cliente_email || '',
  cliente_telefono: r?.telefono_cliente || r?.cliente_telefono || '',
  cliente_direccion: r?.direccion_cliente || r?.cliente_direccion || '',
  cliente_codigo_postal: r?.codigo_postal_cliente || r?.cliente_codigo_postal || '',
  cliente_ciudad: r?.ciudad_cliente || r?.cliente_ciudad || '',
  cliente_provincia: r?.provincia_cliente || r?.cliente_provincia || '',
  cliente_pais: r?.pais_cliente || r?.cliente_pais || '',
  concepto: r?.concepto || '',
  base_imponible: r?.base_imponible || '',
  tipo_iva: r?.tipo_iva ?? 21,
  cuota_iva: r?.cuota_iva || '',
  retencion_irpf: r?.retencion_irpf || 0,
  retencion_tipo: r?.retencion_tipo || 'ninguna',
  importe_retencion: r?.importe_retencion || 0,
  total_factura: r?.total_factura || '',
  fecha_vencimiento: r?.fecha_vencimiento || '',
  estado_cobro: r?.estado_cobro_sugerido || 'pendiente',
  es_rectificativa: r?.es_rectificativa || false,
  factura_rectificada: r?.factura_rectificada || '',
  situacion_impuesto: r?.situacion_impuesto || 'sujeta_gravada',
  cuenta_pgc: r?.cuenta_pgc || '',
  confianza_pgc: r?.confianza_pgc ?? null,
  motivo_clasificacion: r?.motivo_clasificacion || '',
});

const buildOcrPrompt = (company, fiscalProfile, activity) => {
  const issuerName = company?.razon_social || company?.nombre_comercial || '';
  const issuerNif = company?.nif_cif || '';
  const territory = fiscalProfile?.mainTerritory || '';
  const regime = activity?.indirectTaxRegime || '';
  const isComercianteMinorista = regime === 'comerciante_minorista_igic' || regime === 'recargo_equivalencia';
  const isCanarias = territory === 'canarias';
  const isPropertyLessor = fiscalProfile?.isPropertyLessor || false;
  const isProfessionalRetention = fiscalProfile?.isProfessionalWithRetention || false;

  return `Analiza esta factura EMITIDA por ${issuerName} (NIF: ${issuerNif}) y extrae los datos en JSON.
CONTEXTO FISCAL DEL EMISOR:
- El EMISOR (proveedor) de esta factura es ${issuerName}, NIF ${issuerNif}. NO es el cliente.
- El CLIENTE es la otra parte que aparece en la factura como destinatario (NO el emisor).
- Territorio: ${territory === 'canarias' ? 'Canarias (IGIC)' : territory}
- Régimen: ${regime}
${isComercianteMinorista ? '- Es COMERCIANTE MINORISTA: NO repercute IGIC/IVA en sus facturas de venta al por menor. tipo_iva=0, cuota_iva=0, situacion_impuesto="sujeta_exenta".' : ''}
${!isProfessionalRetention && !isPropertyLessor ? '- NO es profesional con retención NI arrendador de inmuebles. NO aplicar retenciones IRPF (retencion_irpf=0, importe_retencion=0, retencion_tipo="ninguna") a menos que aparezca explícitamente en la factura.' : ''}
${isPropertyLessor ? '- Es arrendador de inmuebles: puede aplicar retención IRPF 19% si aparece en la factura.' : ''}
${isProfessionalRetention ? '- Es profesional con retención IRPF: aplicar retención si corresponde.' : ''}

REGLAS:
- Si no encuentras un dato, usa null.
- cliente_nombre y cliente_nif deben ser los del CLIENTE (destinatario), NUNCA los del emisor ${issuerName}.
- Si es factura rectificativa (abono, nota de crédito, importes negativos), marca es_rectificativa=true y extrae importes con signo negativo.
- Solo extrae retenciones si aparecen EXPLÍCITAMENTE en la factura. No las inventes.

Datos: numero_factura, fecha (YYYY-MM-DD), cliente_nombre, cliente_nif, email_cliente, telefono_cliente, direccion_cliente, codigo_postal_cliente, ciudad_cliente, provincia_cliente, pais_cliente, concepto, base_imponible (número, negativo si rectificativa),
tipo_iva (número %), cuota_iva (número, negativo si rectificativa), retencion_irpf (número %, 0 si no aplica),
retencion_tipo (string: ninguna/profesional/alquiler/premios/otros), importe_retencion (número, negativo si rectificativa, 0 si no aplica),
total_factura (número, negativo si rectificativa), fecha_vencimiento (YYYY-MM-DD), estado_cobro_sugerido (pendiente/cobrada),
es_rectificativa (boolean, true si es factura rectificativa/abono), factura_rectificada (número de factura original rectificada, si aparece),
alertas_fiscales (array strings), datos_faltantes (array strings),
cuenta_pgc (cuenta 7XX PGC sugerida para el ingreso), confianza_pgc (0-100), motivo_clasificacion (explicación breve; la propuesta requiere revisión humana),
impuesto_detectado (string: IVA/IGIC/ninguno segun lo que aparezca en la factura),
situacion_impuesto (string: sujeta_gravada/sujeta_exenta/no_sujeta - sujeta_gravada si aplica IGIC/IVA, sujeta_exenta si la operación está exenta, no_sujeta si no está sujeta al impuesto),
tipo_operacion (string: interior/intracomunitaria/exportacion/adquisicion_intracomunitaria/inversion_sujeto_pasivo/isp),
pais_cliente (string codigo pais si se identifica, ej: ES, PT, FR, US),
es_cliente_ue (boolean, true si el cliente tiene NIF-IVA UE y parece operacion intracomunitaria),
nif_vies (string, NIF-IVA UE del cliente si aparece en factura intracomunitaria)`;
};

const OCR_SCHEMA = {
  type: 'object',
  properties: {
    numero_factura: { type: 'string' }, fecha: { type: 'string' },
    cliente_nombre: { type: 'string' }, cliente_nif: { type: 'string' },
    email_cliente: { type: 'string' }, telefono_cliente: { type: 'string' },
    direccion_cliente: { type: 'string' }, codigo_postal_cliente: { type: 'string' },
    ciudad_cliente: { type: 'string' }, provincia_cliente: { type: 'string' }, pais_cliente: { type: 'string' },
    concepto: { type: 'string' }, base_imponible: { type: 'number' },
    tipo_iva: { type: 'number' }, cuota_iva: { type: 'number' },
    retencion_irpf: { type: 'number' }, retencion_tipo: { type: 'string' }, importe_retencion: { type: 'number' },
    total_factura: { type: 'number' },
    fecha_vencimiento: { type: 'string' }, estado_cobro_sugerido: { type: 'string' },
    es_rectificativa: { type: 'boolean' }, factura_rectificada: { type: 'string' },
    alertas_fiscales: { type: 'array', items: { type: 'string' } },
    datos_faltantes: { type: 'array', items: { type: 'string' } },
    cuenta_pgc: { type: 'string' }, confianza_pgc: { type: 'number' }, motivo_clasificacion: { type: 'string' },
    impuesto_detectado: { type: 'string' },
    situacion_impuesto: { type: 'string' },
    tipo_operacion: { type: 'string' },
    es_cliente_ue: { type: 'boolean' },
    nif_vies: { type: 'string' },
  }
};

export default function LectorIngresos({ reviewPage = false }) {
  const { company, user, isAdmin, loadingCompany } = useOutletContext() || {};
  const navigate = useNavigate();
  const location = useLocation();
  const selectedReviewId = new URLSearchParams(location.search).get('doc');
  const reviewDone = new URLSearchParams(location.search).get('done') === '1';
  const reviewPath = '/tax-accounting/ocr-ingresos-revision';
  const openReviewPage = id => navigate(`${reviewPath}?doc=${encodeURIComponent(id)}`, reviewPage ? undefined : {
    state: { companyId: company?.id, ocrDocuments: reviewableDocuments(documents) },
  });
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

  const loadDocs=useCallback(async()=>{
    if(!company?.id)return;
    const version=++loadVersion.current;setLoading(true);
    try{const data=await loadOcrWorkspace(base44,company.id,DOC_TYPE);
      if(version===loadVersion.current)setDocuments(data);
    }catch{if(version===loadVersion.current)setToast({type:'error',message:'No se pudo actualizar el OCR. Se conserva la última lista.'});}
    finally{if(version===loadVersion.current)setLoading(false);}
  },[company?.id]);

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
      const result = await (/** @type {any} */ (base44)).controlledCore.InvokeLLM({
        prompt: buildOcrPrompt(company, fiscalContext.profile, fiscalContext.activity),
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
      const [contactSync, duplicateScan] = await Promise.allSettled([
        base44.functions.invoke('syncInvoiceContacts', { action: 'sync_ocr', docId: doc.id, extractedData: result }),
        base44.functions.invoke('checkDuplicates', { action: 'check_one', company_id: company.id, scope: SOURCE_MODULE, docId: doc.id, period_type: 'all' }),
      ]);
      if (contactSync.status === 'rejected') console.warn('[OCR] Contact sync failed:', contactSync.reason);
      if (duplicateScan.status === 'fulfilled') {
        const scan = duplicateScan.value?.data ?? duplicateScan.value;
        const warning = scan?.duplicateGroupsCount > 0
          ? 'Posible duplicado: coinciden tercero, número y fecha con otra factura o documento OCR. Revísalo antes de confirmar.' : '';
        await base44.entities.OcrInvoiceDocument.update(doc.id, { duplicateWarning: warning }).catch(error => console.warn('[OCR] Duplicate warning could not be saved:', error));
      } else console.warn('[OCR] Duplicate scan unavailable:', duplicateScan.reason);
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
    const baseValue = parseFloat(form.base_imponible);
    const isRectificative = form.es_rectificativa === true || form.es_rectificativa === 'true';
    if (!Number.isFinite(baseValue) || baseValue === 0 || (baseValue < 0 && !isRectificative)) {
      setToast({ type: 'error', message: 'La base imponible debe ser distinta de 0; los importes negativos requieren marcar factura rectificativa.' });
      setTimeout(() => setToast(null), 6000);
      return;
    }
    setValidating(true);
    try {
      if(bulkIds.length){
        cancelBulk.current=false;
        let done=0,failed=0;
        for(const id of bulkIds){
          if(cancelBulk.current) break;
          const doc=documents.find(row=>row.id===id);
          if(!doc) {failed++;continue;}
          const original=mapForm(doc.invoiceSource?invoiceSourceData(doc.invoiceSource):parseExtracted(doc.extractedData));
          try{
            await approveWorkspaceDocument(base44,company.id,doc,{...original,
              fiscal_activity_id:form.fiscal_activity_id,fiscal_criteria:form.fiscal_criteria,
              cuenta_contable_manual:form.cuenta_contable_manual},INVOICE_TIPO);
            done++;
            setDocuments(rows=>rows.map(row=>row.id===id?{...row,status:'accounted',safeErrorMessage:''}:row));
          }catch(error){
            failed++;
            const message=error?.response?.data?.error || error.message;
            if(Number(error?.response?.status)===409 && /otra aprobaci[oó]n|siendo confirmado/i.test(message)) cancelBulk.current=true;
            setDocuments(rows=>rows.map(row=>row.id===id?{...row,safeErrorMessage:message}:row));
          }
          setBulkProgress({done,failed,total:bulkIds.length});
        }
        setBulkIds([]);setReviewing(null);
        setToast({type:failed?'error':'success',message:`Lote: ${done} contabilizadas, ${failed} con incidencia.${cancelBulk.current?' Proceso detenido; el resto sigue pendiente.':''}`});
        window.dispatchEvent(new Event('financials:refresh'));
        await loadDocs();
        return;
      }
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
      console.error('[LectorIngresos] Error al aprobar:', err);
      const message=err?.response?.data?.error || err?.message || 'No se pudo completar el documento.';
      setReviewError(message);
      setToast({type:'error',message});
      setTimeout(() => setToast(null), 8000);
    } finally {setValidating(false);}
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
      const followingId = reviewPage ? nextAfterConfirmation(documents, docId) : null;
      setDocuments(rows => rows.map(row => row.id === docId ? { ...row, status: 'rejected' } : row));
      setReviewing(null);
      setReviewMessage('Documento rechazado. Puedes continuar con el siguiente.');
      if (reviewPage) navigate(followingId ? `${reviewPath}?doc=${encodeURIComponent(followingId)}` : `${reviewPath}?done=1`, { replace: true });
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

  if (loadingCompany) return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!company) return <NoCompanyState pageName="el Lector de Ingresos" />;

  const pendingCount = documents.filter(d => d.status === 'pending' || d.status === 'analysis_failed').length;

  if (reviewPage) return (
    <OcrReviewWorkspace kind="emitidas" documents={documents} selectedId={selectedReviewId} loading={loading}
      busy={validating} message={reviewMessage} onNavigate={openReviewPage}
      onExit={() => navigate('/tax-accounting/lector-ingresos')}>
      {reviewing && reviewing.id === selectedReviewId && <ReviewPanel key={reviewing.id} expanded
        doc={reviewing} fiscalContext={fiscalContext} error={reviewError} tipo="ingresos"
        onApprove={handleValidate} onReject={handleReject}
        onCancel={() => navigate('/tax-accounting/lector-ingresos')} loading={validating}
        companyId={company?.id} fiscalActivities={fiscalContext.activities || []} />}
    </OcrReviewWorkspace>
  );

  return (
    <div>
      <PageHeader title="Lector de Ingresos" subtitle="Entrega de facturas emitidas · Taxea revisa y contabiliza">
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
            key={`${reviewing.id}:${bulkIds.length}`}
            doc={reviewing}
            fiscalContext={fiscalContext}
            bulkCount={bulkIds.length}
            error={reviewError}
            tipo="ingresos"
            onApprove={handleValidate}
            onReject={handleReject}
            onCancel={() => {setReviewing(null);setBulkIds([]);}}
            loading={validating}
            companyId={company?.id}
            fiscalActivities={fiscalContext.activities || []}
          />
        </div>
      )}

      {bulkProgress && <div role="status" className="mb-3 rounded-lg border p-3 text-sm">
        Lote: {bulkProgress.done} contabilizadas · {bulkProgress.failed} incidencias · {bulkProgress.total} seleccionadas.
        {validating && <button className="ml-3 underline" onClick={()=>{cancelBulk.current=true;}}>Detener al terminar la factura actual</button>}
      </div>}
      <OcrDocumentTable
        documents={documents}
        loading={loading}
        isAdmin={isAdmin}
        onRefresh={loadDocs}
        onProcessOcr={processOcr}
        onReview={doc=>{setBulkIds([]);openReviewPage(doc.id);}}
        onBulkReview={ids=>{setBulkIds(ids);handleReview(documents.find(row=>row.id===ids[0]));}}
        busy={validating}
        onWithdraw={handleWithdraw}
        processingIds={processingIds}
        emptyMessage="Todavia no hay facturas de ingreso entregadas en este apartado."
      />

      <DuplicateCheckModal
        open={showDuplicateCheck}
        onClose={() => { setShowDuplicateCheck(false); loadDocs(); }}
        companyId={company?.id}
        scope="ocr_income"
        scopeLabel="Lector de Ingresos"
      />
    </div>
  );
}
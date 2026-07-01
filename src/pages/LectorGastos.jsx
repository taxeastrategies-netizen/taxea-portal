import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { ScanLine, Play, CheckCircle, FileText, Loader2, XCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import BulkDropZone from '@/components/lector/BulkDropZone';
import ReviewPanel from '@/components/lector/ReviewPanel';
import OcrDocumentTable from '@/components/ocr/OcrDocumentTable';

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
  proveedor_cliente: r?.proveedor || '',
  concepto: r?.concepto || '',
  fecha: r?.fecha || '',
  base_imponible: r?.base_imponible || '',
  tipo_impuesto: r?.tipo_impuesto || 21,
  cuota_impuesto: r?.cuota_impuesto || '',
  total: r?.total || '',
  categoria: r?.categoria_sugerida || 'otros',
  cuenta_pgc: r?.cuenta_pgc || '',
  confianza_pgc: r?.confianza_pgc || 0,
  motivo_clasificacion: r?.motivo_clasificacion || '',
});

const OCR_PROMPT = `Analiza este documento fiscal (factura, ticket o justificante de gasto) y extrae los datos en JSON. Si no encuentras un dato, usa null.
Datos: proveedor (nombre emisor), nif_proveedor, fecha (YYYY-MM-DD), numero_factura, base_imponible (número),
tipo_impuesto (número %), cuota_impuesto (número), total (número),
categoria_sugerida (compras/suministros/alquiler/servicios_profesionales/software/transporte/dietas/seguros/otros),
cuenta_pgc (cuenta 6XX PGC), confianza_pgc (0-100), motivo_clasificacion,
es_factura_completa (boolean), es_proveedor_extranjero (boolean),
datos_faltantes (array strings), alertas_fiscales (array strings), concepto`;

const OCR_SCHEMA = {
  type: 'object',
  properties: {
    proveedor: { type: 'string' }, nif_proveedor: { type: 'string' },
    fecha: { type: 'string' }, numero_factura: { type: 'string' },
    base_imponible: { type: 'number' }, tipo_impuesto: { type: 'number' },
    cuota_impuesto: { type: 'number' }, total: { type: 'number' },
    categoria_sugerida: { type: 'string' }, cuenta_pgc: { type: 'string' },
    confianza_pgc: { type: 'number' }, motivo_clasificacion: { type: 'string' },
    es_factura_completa: { type: 'boolean' }, es_proveedor_extranjero: { type: 'boolean' },
    datos_faltantes: { type: 'array', items: { type: 'string' } },
    alertas_fiscales: { type: 'array', items: { type: 'string' } },
    concepto: { type: 'string' },
  }
};

export default function LectorGastos() {
  const { company, user, isAdmin, loadingCompany } = useOutletContext() || {};
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [toast, setToast] = useState(null);

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

  useEffect(() => {
    if (!company?.id) return;
    const unsub = base44.entities.OcrInvoiceDocument.subscribe(() => loadDocs());
    return unsub;
  }, [company?.id, loadDocs]);

  const handleFilesAdded = async (files) => {
    if (!company?.id) return;
    setUploading(true);
    const progress = files.map(f => ({ name: f.name, size: f.size, status: 'uploading' }));
    setUploadProgress(progress);

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        let duplicateWarning = '';
        try {
          const existing = await base44.entities.OcrInvoiceDocument.filter({
            company_id: company.id,
            documentType: DOC_TYPE,
            originalFileName: file.name,
            status: { $ne: 'cancelled_by_client' },
          });
          if (existing?.length > 0) {
            duplicateWarning = `Ya existe un documento con el nombre "${file.name}" subido anteriormente.`;
          }
        } catch {}

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
          uploadedAt: new Date().toISOString(),
          lastStatusChangedAt: new Date().toISOString(),
          duplicateWarning,
        });

        await base44.entities.TimelineEvent.create({
          company_id: company.id,
          tipo: 'documento_subido',
          titulo: `Factura de gasto entregada: ${file.name}`,
          descripcion: 'Documento pendiente de revision por Taxea',
          color: 'azul',
          usuario_email: user?.email,
          automatico: true,
          visibilidad: 'ambos',
        }).catch(() => {});

        progress[i].status = 'done';
        successCount++;
      } catch {
        progress[i].status = 'error';
      }
      setUploadProgress([...progress]);
    }

    setUploading(false);
    if (successCount > 0) {
      setToast({ type: 'success', message: `${successCount} factura(s) recibida(s). Quedan pendientes de revision por Taxea.` });
      setTimeout(() => setToast(null), 6000);
    }
    setTimeout(() => setUploadProgress([]), 5000);
    loadDocs();
  };

  const processOcr = async (doc) => {
    setProcessingIds(prev => new Set([...prev, doc.id]));
    await base44.entities.OcrInvoiceDocument.update(doc.id, {
      status: 'processing',
      analysisStartedAt: new Date().toISOString(),
      lastStatusChangedAt: new Date().toISOString(),
      safeErrorMessage: '',
    });
    loadDocs();

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: OCR_PROMPT,
        file_urls: [doc.fileStorageUrl],
        response_json_schema: OCR_SCHEMA,
      });
      await base44.entities.OcrInvoiceDocument.update(doc.id, {
        status: 'review_required',
        extractedData: JSON.stringify(result),
        analysisCompletedAt: new Date().toISOString(),
        lastStatusChangedAt: new Date().toISOString(),
      });
    } catch {
      await base44.entities.OcrInvoiceDocument.update(doc.id, {
        status: 'analysis_failed',
        safeErrorMessage: 'No se ha podido analizar automaticamente. El documento sigue guardado para revision manual.',
        lastStatusChangedAt: new Date().toISOString(),
      });
    }
    setProcessingIds(prev => { const n = new Set(prev); n.delete(doc.id); return n; });
    loadDocs();
  };

  const processAllPending = async () => {
    const pending = documents.filter(d => d.status === 'pending' || d.status === 'analysis_failed');
    for (const doc of pending) { await processOcr(doc); }
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

  const handleValidate = async (docId, form) => {
    const fecha = form.fecha || '';
    const year = fecha ? new Date(fecha).getFullYear() : new Date().getFullYear();
    const inv = await base44.entities.Invoice.create({
      tipo: INVOICE_TIPO,
      company_id: company.id,
      numero_factura: reviewing?.extracted?.numero_factura || '',
      cliente_nombre: form.proveedor_cliente,
      cliente_nif: reviewing?.extracted?.nif_proveedor || '',
      concepto: form.concepto,
      fecha_emision: form.fecha,
      base_imponible: parseFloat(form.base_imponible) || 0,
      tipo_iva: parseFloat(form.tipo_impuesto) || 21,
      cuota_iva: parseFloat(form.cuota_impuesto) || 0,
      total_factura: parseFloat(form.total) || 0,
      archivo_url: reviewing?.fileUrl || '',
      estado_contable: 'pendiente',
      estado_cobro: 'pendiente',
      anio: year,
      trimestre: trimestre(fecha),
      subido_por: user?.email,
      categoria_gasto: form.categoria || 'otros',
    });
    await base44.entities.OcrInvoiceDocument.update(docId, {
      status: 'accounted',
      accountedAt: new Date().toISOString(),
      linkedInvoiceId: inv?.id || '',
      lastStatusChangedAt: new Date().toISOString(),
    });
    setReviewing(null);
    loadDocs();
  };

  const handleReject = async (docId) => {
    await base44.entities.OcrInvoiceDocument.update(docId, {
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      lastStatusChangedAt: new Date().toISOString(),
    });
    setReviewing(null);
    loadDocs();
  };

  const handleWithdraw = async (docId) => {
    await base44.entities.OcrInvoiceDocument.update(docId, {
      status: 'cancelled_by_client',
      lastStatusChangedAt: new Date().toISOString(),
    });
    loadDocs();
  };

  if (loadingCompany) return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!company) return <NoCompanyState pageName="el Lector de Gastos" />;

  const pendingCount = documents.filter(d => d.status === 'pending' || d.status === 'analysis_failed').length;

  return (
    <div>
      <PageHeader title="Lector de Gastos" subtitle="Entrega de facturas recibidas y tickets · Taxea revisa y contabiliza">
        {isAdmin && pendingCount > 0 && (
          <Button onClick={processAllPending} disabled={uploading} className="bg-teal hover:bg-teal-dark h-9 gap-2">
            <Play className="w-4 h-4" /> Procesar {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </Button>
        )}
      </PageHeader>

      {!isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Entrega tus facturas de gasto aqui</p>
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
                {p.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800">{toast.message}</p>
        </div>
      )}

      <div className="mb-5">
        <BulkDropZone onFilesAdded={handleFilesAdded} />
      </div>

      {reviewing && (
        <div className="mb-5">
          <ReviewPanel
            doc={reviewing}
            tipo="gastos"
            onApprove={handleValidate}
            onReject={handleReject}
            onCancel={() => setReviewing(null)}
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
        emptyMessage="Todavia no hay facturas de gasto entregadas en este apartado."
      />
    </div>
  );
}
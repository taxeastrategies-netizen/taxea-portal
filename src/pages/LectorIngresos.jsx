import { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { ScanText, Play, CheckCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import BulkDropZone from '@/components/lector/BulkDropZone';
import DocumentQueue from '@/components/lector/DocumentQueue';
import ReviewPanel from '@/components/lector/ReviewPanel';

let idCounter = 0;
const mkId = () => `doc-${++idCounter}`;

const trimestre = (fecha) => {
  const m = new Date(fecha || '').getMonth() + 1;
  return m <= 3 ? 'T1' : m <= 6 ? 'T2' : m <= 9 ? 'T3' : 'T4';
};

export default function LectorIngresos() {
  const { company, user, loadingCompany } = useOutletContext() || {};
  const [docs, setDocs] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const setDocState = (id, patch) =>
    setDocs(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));

  const handleFilesAdded = useCallback((files) => {
    const newDocs = files.map(file => ({ id: mkId(), file, status: 'pendiente', fileUrl: null, extracted: null, formData: null }));
    setDocs(prev => [...prev, ...newDocs]);
  }, []);

  const processDoc = async (doc) => {
    setDocState(doc.id, { status: 'subiendo' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file: doc.file });
    setDocState(doc.id, { status: 'procesando', fileUrl: file_url });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza esta factura emitida y extrae los datos en JSON. Si no encuentras un dato, usa null.
Datos: numero_factura, fecha (YYYY-MM-DD), cliente_nombre, cliente_nif, concepto, base_imponible (número),
tipo_iva (número %), cuota_iva (número), retencion_irpf (número %), total_factura (número),
fecha_vencimiento (YYYY-MM-DD), estado_cobro_sugerido (pendiente/cobrada),
alertas_fiscales (array strings), datos_faltantes (array strings)`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          numero_factura: { type: 'string' }, fecha: { type: 'string' },
          cliente_nombre: { type: 'string' }, cliente_nif: { type: 'string' },
          concepto: { type: 'string' }, base_imponible: { type: 'number' },
          tipo_iva: { type: 'number' }, cuota_iva: { type: 'number' },
          retencion_irpf: { type: 'number' }, total_factura: { type: 'number' },
          fecha_vencimiento: { type: 'string' }, estado_cobro_sugerido: { type: 'string' },
          alertas_fiscales: { type: 'array', items: { type: 'string' } },
          datos_faltantes: { type: 'array', items: { type: 'string' } },
        }
      }
    });

    const formData = {
      numero_factura: result.numero_factura || '',
      fecha_emision: result.fecha || '',
      cliente_nombre: result.cliente_nombre || '',
      cliente_nif: result.cliente_nif || '',
      concepto: result.concepto || '',
      base_imponible: result.base_imponible || '',
      tipo_iva: result.tipo_iva || 21,
      cuota_iva: result.cuota_iva || '',
      retencion_irpf: result.retencion_irpf || 0,
      total_factura: result.total_factura || '',
      fecha_vencimiento: result.fecha_vencimiento || '',
      estado_cobro: result.estado_cobro_sugerido || 'pendiente',
    };

    setDocState(doc.id, { status: 'pendiente_revision', fileUrl: file_url, extracted: result, formData });
  };

  const handleProcessAll = async () => {
    setProcessing(true);
    const pending = docs.filter(d => d.status === 'pendiente');
    for (const doc of pending) {
      await processDoc(doc);
    }
    setProcessing(false);
  };

  const handleProcessOne = async (doc) => {
    await processDoc(doc);
  };

  const handleApprove = async (docId, form) => {
    const doc = docs.find(d => d.id === docId);
    setDocState(docId, { status: 'subiendo' });
    const fecha = form.fecha_emision || '';
    const year = fecha ? new Date(fecha).getFullYear() : new Date().getFullYear();
    await base44.entities.Invoice.create({
      ...form,
      tipo: 'emitida',
      company_id: company.id,
      base_imponible: parseFloat(form.base_imponible) || 0,
      cuota_iva: parseFloat(form.cuota_iva) || 0,
      total_factura: parseFloat(form.total_factura) || 0,
      tipo_iva: parseFloat(form.tipo_iva) || 21,
      retencion_irpf: parseFloat(form.retencion_irpf) || 0,
      archivo_url: doc?.fileUrl || '',
      estado_contable: 'pendiente',
      anio: year,
      trimestre: trimestre(fecha),
      subido_por: user?.email,
    });
    setDocState(docId, { status: 'aprobado' });
    setSavedCount(c => c + 1);
    setReviewing(null);
  };

  const handleReject = (docId) => {
    setDocState(docId, { status: 'rechazado' });
    setReviewing(null);
  };

  const handleReview = (doc) => {
    // Refresh form from latest state
    const latest = docs.find(d => d.id === doc.id);
    setReviewing(latest || doc);
  };

  const pendingCount = docs.filter(d => d.status === 'pendiente').length;
  const reviewCount = docs.filter(d => d.status === 'pendiente_revision').length;

  if (loadingCompany) return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!company) return <NoCompanyState pageName="el Lector de Ingresos" />;

  return (
    <div>
      <PageHeader
        title="Lector de Ingresos"
        subtitle="Carga masiva de facturas emitidas · IA + revisión humana"
      >
        {pendingCount > 0 && (
          <Button onClick={handleProcessAll} disabled={processing} className="bg-teal hover:bg-teal-dark h-9 gap-2">
            {processing
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Procesando...</>
              : <><Play className="w-4 h-4" /> Procesar {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}</>
            }
          </Button>
        )}
      </PageHeader>

      {/* KPIs rápidos */}
      {docs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total subidos', val: docs.length, color: 'text-foreground' },
            { label: 'Pendiente IA', val: pendingCount, color: 'text-amber-600' },
            { label: 'Pendiente revisión', val: reviewCount, color: 'text-orange-600' },
            { label: 'Aprobados', val: savedCount, color: 'text-green-600' },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-xl p-4 text-center shadow-card">
              <p className="text-xs text-muted-foreground mb-0.5">{k.label}</p>
              <p className={`text-2xl font-jakarta font-bold ${k.color}`}>{k.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div className="mb-5">
        <BulkDropZone onFilesAdded={handleFilesAdded} />
      </div>

      {/* Revisión activa */}
      {reviewing && (
        <div className="mb-5">
          <ReviewPanel
            doc={reviewing}
            tipo="ingresos"
            onApprove={handleApprove}
            onReject={handleReject}
            onCancel={() => setReviewing(null)}
          />
        </div>
      )}

      {/* Cola */}
      <DocumentQueue
        docs={docs}
        onRemove={id => setDocs(prev => prev.filter(d => d.id !== id))}
        onReview={handleReview}
        onProcessOne={handleProcessOne}
      />

      {/* Estado vacío inicial */}
      {!docs.length && (
        <div className="text-center py-12 text-muted-foreground">
          <ScanText className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Arrastra tus facturas emitidas para comenzar</p>
          <p className="text-sm mt-1">Hasta 200 documentos por lote</p>
        </div>
      )}

      {/* Éxito final */}
      {savedCount > 0 && docs.every(d => ['aprobado','rechazado'].includes(d.status)) && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="font-jakarta font-semibold text-green-800 text-lg">
            {savedCount} factura{savedCount > 1 ? 's' : ''} registrada{savedCount > 1 ? 's' : ''}
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <Button variant="outline" onClick={() => { setDocs([]); setSavedCount(0); }}>Nuevo lote</Button>
            <Button className="bg-teal hover:bg-teal-dark" asChild><a href="/facturas">Ver facturas</a></Button>
          </div>
        </div>
      )}
    </div>
  );
}
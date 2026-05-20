import { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { ScanLine, Play, CheckCircle } from 'lucide-react';
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

export default function LectorGastos() {
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
      prompt: `Analiza este documento fiscal (factura, ticket o justificante de gasto) y extrae los datos en JSON. Si no encuentras un dato, usa null.
Datos: proveedor (nombre emisor), nif_proveedor, fecha (YYYY-MM-DD), numero_factura, base_imponible (número),
tipo_impuesto (número %), cuota_impuesto (número), total (número),
categoria_sugerida (compras/suministros/alquiler/servicios_profesionales/software/transporte/dietas/seguros/otros),
cuenta_pgc (cuenta 6XX PGC), confianza_pgc (0-100), motivo_clasificacion,
es_factura_completa (boolean), es_proveedor_extranjero (boolean),
datos_faltantes (array strings), alertas_fiscales (array strings), concepto`,
      file_urls: [file_url],
      response_json_schema: {
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
      }
    });

    const formData = {
      proveedor_cliente: result.proveedor || '',
      concepto: result.concepto || '',
      fecha: result.fecha || '',
      base_imponible: result.base_imponible || '',
      tipo_impuesto: result.tipo_impuesto || 21,
      cuota_impuesto: result.cuota_impuesto || '',
      total: result.total || '',
      categoria: result.categoria_sugerida || 'otros',
      cuenta_pgc: result.cuenta_pgc || '',
      confianza_pgc: result.confianza_pgc || 0,
      motivo_clasificacion: result.motivo_clasificacion || '',
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
    const fecha = form.fecha || '';
    const year = fecha ? new Date(fecha).getFullYear() : new Date().getFullYear();
    await base44.entities.Invoice.create({
      tipo: 'recibida',
      company_id: company.id,
      numero_factura: doc?.extracted?.numero_factura || '',
      cliente_nombre: form.proveedor_cliente,
      cliente_nif: doc?.extracted?.nif_proveedor || '',
      concepto: form.concepto,
      fecha_emision: form.fecha,
      base_imponible: parseFloat(form.base_imponible) || 0,
      tipo_iva: parseFloat(form.tipo_impuesto) || 21,
      cuota_iva: parseFloat(form.cuota_impuesto) || 0,
      total_factura: parseFloat(form.total) || 0,
      archivo_url: doc?.fileUrl || '',
      estado_contable: 'pendiente',
      estado_cobro: 'pendiente',
      anio: year,
      trimestre: trimestre(fecha),
      subido_por: user?.email,
    });
    await base44.entities.TimelineEvent.create({
      company_id: company.id,
      tipo: 'documento_subido',
      titulo: `Gasto subido: ${form.proveedor_cliente || 'sin proveedor'} — ${(parseFloat(form.total) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`,
      descripcion: form.cuenta_pgc ? `Cuenta PGC: ${form.cuenta_pgc} (confianza: ${form.confianza_pgc}%)` : '',
      color: 'azul',
      usuario_email: user?.email,
      automatico: true,
      visibilidad: 'ambos',
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
    const latest = docs.find(d => d.id === doc.id);
    setReviewing(latest || doc);
  };

  const pendingCount = docs.filter(d => d.status === 'pendiente').length;
  const reviewCount = docs.filter(d => d.status === 'pendiente_revision').length;

  if (loadingCompany) return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!company) return <NoCompanyState pageName="el Lector de Gastos" />;

  return (
    <div>
      <PageHeader
        title="Lector de Gastos"
        subtitle="Carga masiva de facturas recibidas y tickets · IA + revisión humana"
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

      {/* KPIs */}
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
            tipo="gastos"
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

      {/* Estado vacío */}
      {!docs.length && (
        <div className="text-center py-12 text-muted-foreground">
          <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Arrastra tus facturas o tickets para comenzar</p>
          <p className="text-sm mt-1">Hasta 200 documentos por lote · PDF, JPG, PNG, WEBP</p>
        </div>
      )}

      {/* Éxito final */}
      {savedCount > 0 && docs.every(d => ['aprobado','rechazado'].includes(d.status)) && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="font-jakarta font-semibold text-green-800 text-lg">
            {savedCount} gasto{savedCount > 1 ? 's' : ''} registrado{savedCount > 1 ? 's' : ''}
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <Button variant="outline" onClick={() => { setDocs([]); setSavedCount(0); }}>Nuevo lote</Button>
            <Button className="bg-teal hover:bg-teal-dark" asChild><a href="/tax-accounting/facturas">Ver facturas recibidas</a></Button>
          </div>
        </div>
      )}
    </div>
  );
}
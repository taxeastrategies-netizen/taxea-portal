import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Upload, ScanLine, CheckCircle, AlertCircle, Edit3, Save } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const CATEGORIAS = [
  { value: 'compras', label: 'Compras' },
  { value: 'suministros', label: 'Suministros' },
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'servicios_profesionales', label: 'Servicios Profesionales' },
  { value: 'software', label: 'Software' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'dietas', label: 'Dietas' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'otros', label: 'Otros' },
];

const STAGES = {
  idle: 'idle',
  reading: 'reading',
  review: 'review',
  saved: 'saved',
};

export default function LectorGastos() {
  const { company, user } = useOutletContext() || {};
  const [stage, setStage] = useState(STAGES.idle);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleRead = async () => {
    if (!file) return;
    setStage(STAGES.reading);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFileUrl(file_url);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza este documento fiscal (factura, ticket o justificante de gasto) y extrae los siguientes datos en formato JSON. Si no encuentras un dato, usa null.
      
Datos a extraer:
- proveedor: nombre del emisor/proveedor
- nif_proveedor: NIF o CIF del proveedor  
- fecha: fecha de la factura o ticket (formato YYYY-MM-DD)
- numero_factura: número de factura (null si es ticket)
- base_imponible: base imponible sin impuestos (número)
- tipo_impuesto: tipo de IVA o IGIC en porcentaje (número, ej: 21)
- cuota_impuesto: importe del IVA/IGIC (número)
- total: importe total (número)
- categoria_sugerida: una de estas categorías: compras, suministros, alquiler, servicios_profesionales, software, transporte, dietas, seguros, otros
- es_factura_completa: true si tiene todos los datos obligatorios (NIF, número, etc.), false si parece un ticket sin NIF
- datos_faltantes: lista de campos obligatorios que faltan como array de strings
- concepto: descripción breve del gasto`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          proveedor: { type: 'string' },
          nif_proveedor: { type: 'string' },
          fecha: { type: 'string' },
          numero_factura: { type: 'string' },
          base_imponible: { type: 'number' },
          tipo_impuesto: { type: 'number' },
          cuota_impuesto: { type: 'number' },
          total: { type: 'number' },
          categoria_sugerida: { type: 'string' },
          es_factura_completa: { type: 'boolean' },
          datos_faltantes: { type: 'array', items: { type: 'string' } },
          concepto: { type: 'string' },
        }
      }
    });
    setExtracted(result);
    setForm({
      proveedor_cliente: result.proveedor || '',
      concepto: result.concepto || '',
      fecha: result.fecha || '',
      base_imponible: result.base_imponible || '',
      tipo_impuesto: result.tipo_impuesto || 21,
      cuota_impuesto: result.cuota_impuesto || '',
      total: result.total || '',
      categoria: result.categoria_sugerida || 'otros',
    });
    setStage(STAGES.review);
  };

  const handleSave = async () => {
    setSaving(true);
    const year = form.fecha ? new Date(form.fecha).getFullYear() : new Date().getFullYear();
    const month = form.fecha ? new Date(form.fecha).getMonth() + 1 : new Date().getMonth() + 1;
    const trimestre = month <= 3 ? 'T1' : month <= 6 ? 'T2' : month <= 9 ? 'T3' : 'T4';
    await base44.entities.Expense.create({
      ...form,
      tipo: 'gasto',
      company_id: company.id,
      base_imponible: parseFloat(form.base_imponible) || 0,
      cuota_impuesto: parseFloat(form.cuota_impuesto) || 0,
      total: parseFloat(form.total) || 0,
      tipo_impuesto: parseFloat(form.tipo_impuesto) || 21,
      archivo_url: fileUrl,
      estado: 'pendiente',
      anio: year,
      trimestre,
      subido_por: user?.email,
    });
    setSaving(false);
    setStage(STAGES.saved);
  };

  const reset = () => {
    setStage(STAGES.idle);
    setFile(null);
    setFileUrl('');
    setExtracted(null);
    setForm({});
  };

  return (
    <div>
      <PageHeader
        title="Lector de Gastos"
        subtitle="Sube una factura recibida o ticket y la IA extrae los datos automáticamente"
      />

      {stage === STAGES.idle && (
        <div className="max-w-xl mx-auto">
          <div
            className="border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:border-teal/50 hover:bg-teal/3 transition-all"
            onClick={() => document.getElementById('expense-upload').click()}
          >
            <div className="w-16 h-16 bg-teal-light rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ScanLine className="w-8 h-8 text-teal" />
            </div>
            {file ? (
              <div>
                <p className="font-jakarta font-semibold text-foreground text-lg">{file.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <>
                <p className="font-jakarta font-semibold text-foreground text-lg mb-2">
                  Arrastra o selecciona tu factura/ticket
                </p>
                <p className="text-muted-foreground text-sm">PDF, JPG, PNG hasta 25MB</p>
                <p className="text-xs text-muted-foreground mt-2">La IA extraerá automáticamente todos los datos fiscales</p>
              </>
            )}
            <input id="expense-upload" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} />
          </div>
          {file && (
            <Button onClick={handleRead} className="w-full mt-4 bg-teal hover:bg-teal-dark h-11">
              <ScanLine className="w-4 h-4 mr-2" />
              Leer con IA
            </Button>
          )}
        </div>
      )}

      {stage === STAGES.reading && (
        <div className="max-w-xl mx-auto text-center py-16">
          <div className="w-16 h-16 bg-teal-light rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ScanLine className="w-8 h-8 text-teal animate-pulse" />
          </div>
          <p className="font-jakarta font-semibold text-foreground text-lg">Analizando documento...</p>
          <p className="text-muted-foreground mt-2 text-sm">La IA está extrayendo los datos fiscales</p>
          <div className="flex justify-center gap-1 mt-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-teal animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {stage === STAGES.review && extracted && (
        <div className="max-w-2xl mx-auto">
          {/* Alerta si hay datos faltantes */}
          {extracted.datos_faltantes?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700">Datos faltantes detectados</p>
                <p className="text-xs text-amber-600 mt-0.5">Faltan: {extracted.datos_faltantes.join(', ')}</p>
                {!extracted.es_factura_completa && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Parece un ticket, no una factura completa. Para deducir gastos necesitas factura con NIF.</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-teal-light rounded-lg flex items-center justify-center">
                <Edit3 className="w-4 h-4 text-teal" />
              </div>
              <div>
                <p className="font-jakarta font-semibold text-foreground">Revisar datos extraídos</p>
                <p className="text-xs text-muted-foreground">Confirma o corrige los datos antes de guardar</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Proveedor</Label>
                <Input value={form.proveedor_cliente} onChange={e => setForm(f => ({ ...f, proveedor_cliente: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Concepto</Label>
                <Input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Base imponible (€)</Label>
                <Input type="number" step="0.01" value={form.base_imponible} onChange={e => setForm(f => ({ ...f, base_imponible: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo IVA/IGIC (%)</Label>
                <Input type="number" value={form.tipo_impuesto} onChange={e => setForm(f => ({ ...f, tipo_impuesto: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Cuota impuesto (€)</Label>
                <Input type="number" step="0.01" value={form.cuota_impuesto} onChange={e => setForm(f => ({ ...f, cuota_impuesto: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Total (€)</Label>
                <Input type="number" step="0.01" value={form.total} onChange={e => setForm(f => ({ ...f, total: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              <Button variant="outline" onClick={reset}>← Subir otro</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar gasto'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {stage === STAGES.saved && (
        <div className="max-w-xl mx-auto text-center py-16">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <p className="font-jakarta font-semibold text-foreground text-xl">¡Gasto registrado!</p>
          <p className="text-muted-foreground mt-2">Tu asesor revisará el documento en breve</p>
          <div className="flex justify-center gap-3 mt-6">
            <Button variant="outline" onClick={reset}>Subir otro gasto</Button>
            <Button className="bg-teal hover:bg-teal-dark" asChild>
              <a href="/ingresos-gastos">Ver todos los gastos</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
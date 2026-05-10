import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ScanText, CheckCircle, AlertCircle, Save } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STAGES = { idle: 'idle', reading: 'reading', review: 'review', saved: 'saved' };

export default function LectorIngresos() {
  const { company, user } = useOutletContext() || {};
  const [stage, setStage] = useState(STAGES.idle);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [extracted, setExtracted] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const handleRead = async () => {
    if (!file) return;
    setStage(STAGES.reading);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFileUrl(file_url);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza esta factura emitida y extrae los datos en JSON. Si no encuentras un dato, usa null.
Datos a extraer:
- numero_factura: número de factura
- fecha: fecha de emisión (YYYY-MM-DD)
- cliente_nombre: nombre del cliente  
- cliente_nif: NIF/CIF del cliente
- concepto: descripción del servicio o producto
- base_imponible: base imponible (número)
- tipo_iva: tipo de IVA/IGIC en % (número)
- cuota_iva: importe del IVA/IGIC (número)
- retencion_irpf: retención IRPF en % si aplica (número)
- total_factura: total de la factura (número)
- fecha_vencimiento: fecha de vencimiento si aparece (YYYY-MM-DD)
- estado_cobro_sugerido: "pendiente" o "cobrada" según si indica pagada`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          numero_factura: { type: 'string' },
          fecha: { type: 'string' },
          cliente_nombre: { type: 'string' },
          cliente_nif: { type: 'string' },
          concepto: { type: 'string' },
          base_imponible: { type: 'number' },
          tipo_iva: { type: 'number' },
          cuota_iva: { type: 'number' },
          retencion_irpf: { type: 'number' },
          total_factura: { type: 'number' },
          fecha_vencimiento: { type: 'string' },
          estado_cobro_sugerido: { type: 'string' },
        }
      }
    });
    setExtracted(result);
    setForm({
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
    });
    setStage(STAGES.review);
  };

  const handleSave = async () => {
    setSaving(true);
    const year = form.fecha_emision ? new Date(form.fecha_emision).getFullYear() : new Date().getFullYear();
    const month = form.fecha_emision ? new Date(form.fecha_emision).getMonth() + 1 : new Date().getMonth() + 1;
    const trimestre = month <= 3 ? 'T1' : month <= 6 ? 'T2' : month <= 9 ? 'T3' : 'T4';
    await base44.entities.Invoice.create({
      ...form, tipo: 'emitida', company_id: company.id,
      base_imponible: parseFloat(form.base_imponible) || 0,
      cuota_iva: parseFloat(form.cuota_iva) || 0,
      total_factura: parseFloat(form.total_factura) || 0,
      tipo_iva: parseFloat(form.tipo_iva) || 21,
      retencion_irpf: parseFloat(form.retencion_irpf) || 0,
      archivo_url: fileUrl, estado_contable: 'pendiente',
      anio: year, trimestre, subido_por: user?.email,
    });
    setSaving(false);
    setStage(STAGES.saved);
  };

  const reset = () => { setStage(STAGES.idle); setFile(null); setFileUrl(''); setExtracted(null); setForm({}); };

  return (
    <div>
      <PageHeader title="Lector de Ingresos" subtitle="Sube una factura emitida y la IA extrae los datos automáticamente" />

      {stage === STAGES.idle && (
        <div className="max-w-xl mx-auto">
          <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:border-teal/50 hover:bg-teal/3 transition-all"
            onClick={() => document.getElementById('income-upload').click()}>
            <div className="w-16 h-16 bg-teal-light rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ScanText className="w-8 h-8 text-teal" />
            </div>
            {file ? (
              <div>
                <p className="font-jakarta font-semibold text-foreground text-lg">{file.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <>
                <p className="font-jakarta font-semibold text-foreground text-lg mb-2">Arrastra o selecciona tu factura</p>
                <p className="text-muted-foreground text-sm">PDF, JPG, PNG hasta 25MB</p>
              </>
            )}
            <input id="income-upload" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} />
          </div>
          {file && (
            <Button onClick={handleRead} className="w-full mt-4 bg-teal hover:bg-teal-dark h-11">
              <ScanText className="w-4 h-4 mr-2" /> Leer con IA
            </Button>
          )}
        </div>
      )}

      {stage === STAGES.reading && (
        <div className="max-w-xl mx-auto text-center py-16">
          <div className="w-16 h-16 bg-teal-light rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ScanText className="w-8 h-8 text-teal animate-pulse" />
          </div>
          <p className="font-jakarta font-semibold text-foreground text-lg">Analizando factura...</p>
          <div className="flex justify-center gap-1 mt-4">
            {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-teal animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
          </div>
        </div>
      )}

      {stage === STAGES.review && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <p className="font-jakarta font-semibold text-foreground mb-4">Revisar datos extraídos</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Nº Factura</Label><Input value={form.numero_factura} onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Fecha emisión</Label><Input type="date" value={form.fecha_emision} onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Cliente</Label><Input value={form.cliente_nombre} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>NIF/CIF cliente</Label><Input value={form.cliente_nif} onChange={e => setForm(f => ({ ...f, cliente_nif: e.target.value }))} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Concepto</Label><Input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Base imponible (€)</Label><Input type="number" step="0.01" value={form.base_imponible} onChange={e => setForm(f => ({ ...f, base_imponible: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Tipo IVA/IGIC (%)</Label><Input type="number" value={form.tipo_iva} onChange={e => setForm(f => ({ ...f, tipo_iva: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Cuota (€)</Label><Input type="number" step="0.01" value={form.cuota_iva} onChange={e => setForm(f => ({ ...f, cuota_iva: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Total (€)</Label><Input type="number" step="0.01" value={form.total_factura} onChange={e => setForm(f => ({ ...f, total_factura: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>Estado cobro</Label>
                <Select value={form.estado_cobro} onValueChange={v => setForm(f => ({ ...f, estado_cobro: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="cobrada">Cobrada</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={reset}>← Subir otra</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">
                <Save className="w-4 h-4 mr-2" />{saving ? 'Guardando...' : 'Guardar factura'}
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
          <p className="font-jakarta font-semibold text-foreground text-xl">¡Factura registrada!</p>
          <div className="flex justify-center gap-3 mt-6">
            <Button variant="outline" onClick={reset}>Subir otra factura</Button>
            <Button className="bg-teal hover:bg-teal-dark" asChild><a href="/facturas">Ver facturas</a></Button>
          </div>
        </div>
      )}
    </div>
  );
}
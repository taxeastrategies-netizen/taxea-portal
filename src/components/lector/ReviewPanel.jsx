import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, ZoomIn, ZoomOut, FileText, Loader2, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import FiscalAssessmentPanel from './FiscalAssessmentPanel';

export default function ReviewPanel({ doc, tipo, onApprove, onReject, onCancel, loading, companyId }) {
  const [form, setForm] = useState(doc.formData || {});
  const [zoom, setZoom] = useState(1);
  const isPDF = doc.fileUrl?.toLowerCase().includes('.pdf') || doc.file?.name?.toLowerCase().endsWith('.pdf');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40">
        <div>
          <p className="font-jakarta font-semibold text-foreground text-sm">{doc.file?.name || 'Documento'}</p>
          <p className="text-xs text-muted-foreground">Revisión humana obligatoria</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={loading} className="h-8 gap-1 text-xs border-red-200 text-red-600 hover:bg-red-50" onClick={() => onReject(doc.id)}>
            <XCircle className="w-3.5 h-3.5" /> {loading ? 'Procesando...' : 'Rechazar'}
          </Button>
          <Button size="sm" disabled={loading} className="h-8 gap-1 text-xs bg-green-600 hover:bg-green-700" onClick={() => onApprove(doc.id, form)}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} {loading ? 'Guardando...' : 'Aprobar y guardar'}
          </Button>
          <button onClick={onCancel} className="ml-1 text-muted-foreground hover:text-foreground text-xs">✕</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[500px]">
        {/* Preview */}
        <div className="border-b lg:border-b-0 lg:border-r border-border bg-secondary/20 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <span className="text-xs text-muted-foreground font-medium">Vista previa</span>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1 rounded hover:bg-secondary text-muted-foreground"><ZoomOut className="w-3.5 h-3.5" /></button>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1 rounded hover:bg-secondary text-muted-foreground"><ZoomIn className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
            {isPDF ? (
              <iframe
                src={doc.fileUrl}
                className="w-full rounded border border-border"
                style={{ height: '460px', transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                title="Preview"
              />
            ) : doc.fileUrl ? (
              <img
                src={doc.fileUrl}
                alt="Preview"
                className="max-w-full rounded border border-border object-contain"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', maxHeight: '460px' }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <FileText className="w-10 h-10 opacity-30 mb-2" />
                <p className="text-sm">Sin previsualización</p>
              </div>
            )}
          </div>
        </div>

        {/* Formulario */}
        <div className="overflow-y-auto p-4 space-y-3 max-h-[560px]">
          {/* Confianza IA */}
          {doc.extracted?.confianza_pgc != null && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-1">
              <p className="text-xs font-semibold text-blue-700 mb-0.5">Clasificación IA</p>
              <p className="text-sm font-bold text-blue-900">{doc.extracted?.cuenta_pgc || '—'}</p>
              {doc.extracted?.motivo_clasificacion && <p className="text-xs text-blue-600 mt-0.5">{doc.extracted.motivo_clasificacion}</p>}
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 bg-blue-200 rounded-full">
                  <div className="h-1.5 bg-blue-600 rounded-full" style={{ width: `${doc.extracted.confianza_pgc}%` }} />
                </div>
                <span className="text-xs font-bold text-blue-700">{doc.extracted.confianza_pgc}%</span>
              </div>
            </div>
          )}

          {/* Alertas */}
          {doc.extracted?.alertas_fiscales?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">Alertas fiscales</p>
                <ul className="text-xs text-amber-600 mt-0.5 space-y-0.5">
                  {doc.extracted.alertas_fiscales.map((a, i) => <li key={i}>· {a}</li>)}
                </ul>
              </div>
            </div>
          )}

          {/* Banner rectificativa */}
          {form.es_rectificativa && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex gap-2">
              <MinusCircle className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-purple-700">Factura rectificativa (abono)</p>
                <p className="text-xs text-purple-600 mt-0.5">Los importes son negativos y disminuyen la base, IGIC/IVA y totales del periodo.</p>
                {form.factura_rectificada && <p className="text-xs text-purple-500 mt-0.5">Rectifica factura: {form.factura_rectificada}</p>}
              </div>
            </div>
          )}

          {/* Toggle rectificativa */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.es_rectificativa || false} onCheckedChange={(v) => set('es_rectificativa', v === true)} />
            <span className="text-xs font-medium text-foreground">Es factura rectificativa / abono</span>
          </label>
          {form.es_rectificativa && (
            <F label="Factura rectificada (nº original)" col2>
              <Input value={form.factura_rectificada || ''} onChange={e => set('factura_rectificada', e.target.value)} className="h-8 text-sm" placeholder="Nº factura original" />
            </F>
          )}

          {/* Panel de evaluación fiscal automática */}
          <FiscalAssessmentPanel
            ocrData={doc.extracted}
            companyId={companyId}
            direction={tipo === 'ingresos' ? 'ingreso' : 'gasto'}
            counterpartyName={tipo === 'ingresos' ? form.cliente_nombre : form.proveedor_cliente}
            counterpartyTaxId={tipo === 'ingresos' ? form.cliente_nif : doc.extracted?.nif_proveedor}
            invoiceBase={parseFloat(form.base_imponible) || 0}
            invoiceTaxRate={parseFloat(tipo === 'ingresos' ? form.tipo_iva : form.tipo_impuesto) || 0}
            invoiceTaxAmount={parseFloat(tipo === 'ingresos' ? form.cuota_iva : form.cuota_impuesto) || 0}
            invoiceWithholdingRate={parseFloat(form.retencion_irpf) || 0}
            invoiceWithholdingAmount={parseFloat(form.importe_retencion) || 0}
            esProveedorExtranjero={doc.extracted?.es_proveedor_extranjero}
          />

          {/* Campos según tipo */}
          {tipo === 'ingresos' ? (
            <IngresosFields form={form} set={set} />
          ) : (
            <GastosFields form={form} set={set} />
          )}
        </div>
      </div>
    </div>
  );
}

function IngresosFields({ form, set }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <F label="Nº Factura"><Input value={form.numero_factura || ''} onChange={e => set('numero_factura', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Fecha emisión"><Input type="date" value={form.fecha_emision || ''} onChange={e => set('fecha_emision', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Cliente" col2><Input value={form.cliente_nombre || ''} onChange={e => set('cliente_nombre', e.target.value)} className="h-8 text-sm" /></F>
      <F label="NIF/CIF cliente"><Input value={form.cliente_nif || ''} onChange={e => set('cliente_nif', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Fecha vencimiento"><Input type="date" value={form.fecha_vencimiento || ''} onChange={e => set('fecha_vencimiento', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Concepto" col2><Input value={form.concepto || ''} onChange={e => set('concepto', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Base imponible (€)"><Input type="number" step="0.01" value={form.base_imponible || ''} onChange={e => set('base_imponible', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Tipo IVA/IGIC %"><Input type="number" value={form.tipo_iva || 21} onChange={e => set('tipo_iva', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Cuota IVA (€)"><Input type="number" step="0.01" value={form.cuota_iva || ''} onChange={e => set('cuota_iva', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Retención IRPF %"><Input type="number" step="0.01" value={form.retencion_irpf || 0} onChange={e => set('retencion_irpf', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Importe retención (€)"><Input type="number" step="0.01" value={form.importe_retencion || ''} onChange={e => set('importe_retencion', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Total (€)"><Input type="number" step="0.01" value={form.total_factura || ''} onChange={e => set('total_factura', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Estado cobro">
        <Select value={form.estado_cobro || 'pendiente'} onValueChange={v => set('estado_cobro', v)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="cobrada">Cobrada</SelectItem>
            <SelectItem value="vencida">Vencida</SelectItem>
          </SelectContent>
        </Select>
      </F>
    </div>
  );
}

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

function GastosFields({ form, set }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <F label="Proveedor" col2><Input value={form.proveedor_cliente || ''} onChange={e => set('proveedor_cliente', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Fecha"><Input type="date" value={form.fecha || ''} onChange={e => set('fecha', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Categoría">
        <Select value={form.categoria || 'otros'} onValueChange={v => set('categoria', v)}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
      </F>
      <F label="Concepto" col2><Input value={form.concepto || ''} onChange={e => set('concepto', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Base imponible (€)"><Input type="number" step="0.01" value={form.base_imponible || ''} onChange={e => set('base_imponible', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Tipo IVA/IGIC %"><Input type="number" value={form.tipo_impuesto || 21} onChange={e => set('tipo_impuesto', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Cuota impuesto (€)"><Input type="number" step="0.01" value={form.cuota_impuesto || ''} onChange={e => set('cuota_impuesto', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Retención IRPF %"><Input type="number" step="0.01" value={form.retencion_irpf || 0} onChange={e => set('retencion_irpf', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Importe retención (€)"><Input type="number" step="0.01" value={form.importe_retencion || ''} onChange={e => set('importe_retencion', e.target.value)} className="h-8 text-sm" /></F>
      <F label="Total (€)"><Input type="number" step="0.01" value={form.total || ''} onChange={e => set('total', e.target.value)} className="h-8 text-sm" /></F>
    </div>
  );
}

function F({ label, children, col2 }) {
  return (
    <div className={`space-y-1 ${col2 ? 'col-span-2' : ''}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
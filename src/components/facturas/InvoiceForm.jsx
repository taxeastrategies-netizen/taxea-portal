import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Link } from 'lucide-react';

const IVA_RATES = [0, 4, 10, 21];
const IGIC_RATES = [0, 3, 7, 9.5, 15];
const RETENTION_RATES = [7, 15, 19];

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcTotals(base, taxPct, retentionPct) {
  const b = parseFloat(base) || 0;
  const cuota = b * (parseFloat(taxPct) || 0) / 100;
  const retencionImporte = b * (parseFloat(retentionPct) || 0) / 100;
  const total = b + cuota - retencionImporte;
  return { cuota, retencionImporte, total };
}

export default function InvoiceForm({ open, onOpenChange, editing, company, user, onSaved }) {
  const taxType = company?.tipo_impuesto === 'igic' ? 'IGIC' : 'IVA';
  const taxRates = taxType === 'IGIC' ? IGIC_RATES : IVA_RATES;

  const getEmpty = () => ({
    tipo: 'emitida',
    numero_factura: '',
    fecha_emision: new Date().toISOString().slice(0, 10),
    fecha_vencimiento: '',
    cliente_nombre: '',
    cliente_nif: '',
    concepto: '',
    base_imponible: '',
    tipo_iva: taxType === 'IGIC' ? 7 : 21,
    cuota_iva: '',
    aplica_retencion: false,
    retencion_irpf: 0,
    total_factura: '',
    estado_cobro: 'pendiente',
    estado_contable: 'pendiente',
    comentarios: '',
  });

  const [form, setForm] = useState(getEmpty());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [customRetention, setCustomRetention] = useState(false);
  const loadedRef = useRef(false);

  // Computed
  const { cuota, retencionImporte, total } = calcTotals(
    form.base_imponible,
    form.tipo_iva,
    form.aplica_retencion ? form.retencion_irpf : 0
  );

  // Load editing data once
  useEffect(() => {
    if (!open) { loadedRef.current = false; return; }
    if (editing && !loadedRef.current) {
      loadedRef.current = true;
      setForm({
        ...getEmpty(),
        ...editing,
        aplica_retencion: (parseFloat(editing.retencion_irpf) || 0) > 0,
      });
      setCustomRetention(!RETENTION_RATES.includes(parseFloat(editing.retencion_irpf)));
    } else if (!editing && !loadedRef.current) {
      loadedRef.current = true;
      setForm(getEmpty());
    }
    setErrors({});
    setSaveError('');
  }, [open, editing?.id]);

  const set = useCallback((field) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm(prev => ({ ...prev, [field]: val }));
    setErrors(prev => { if (!prev[field]) return prev; const n = { ...prev }; delete n[field]; return n; });
  }, []);

  const validate = () => {
    const e = {};
    if (!form.numero_factura?.trim()) e.numero_factura = 'Obligatorio';
    if (!form.fecha_emision) e.fecha_emision = 'Obligatorio';
    if (form.base_imponible === '' || isNaN(parseFloat(form.base_imponible))) e.base_imponible = 'Introduce un importe válido';
    else if (parseFloat(form.base_imponible) < 0) e.base_imponible = 'No puede ser negativo';
    if (form.aplica_retencion && (form.retencion_irpf === '' || isNaN(parseFloat(form.retencion_irpf)))) {
      e.retencion_irpf = 'Introduce el porcentaje';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError('');
    const { base44 } = await import('@/api/base44Client');
    const year = new Date(form.fecha_emision).getFullYear();
    const month = new Date(form.fecha_emision).getMonth() + 1;
    const trimestre = month <= 3 ? 'T1' : month <= 6 ? 'T2' : month <= 9 ? 'T3' : 'T4';
    const payload = {
      ...form,
      company_id: company.id,
      base_imponible: parseFloat(form.base_imponible) || 0,
      tipo_iva: parseFloat(form.tipo_iva) || 0,
      cuota_iva: cuota,
      retencion_irpf: form.aplica_retencion ? (parseFloat(form.retencion_irpf) || 0) : 0,
      total_factura: total,
      anio: year,
      trimestre,
      subido_por: user?.email,
    };
    try {
      if (editing?.id) {
        await base44.entities.Invoice.update(editing.id, payload);
      } else {
        const inv = await base44.entities.Invoice.create(payload);
        base44.entities.TimelineEvent.create({
          company_id: company.id, tipo: 'factura_clasificada',
          titulo: `Nueva factura: ${payload.numero_factura}`,
          descripcion: `${payload.tipo === 'emitida' ? 'Emitida' : 'Recibida'} · ${payload.cliente_nombre || ''} · ${fmt(total)} €`,
          color: 'azul', usuario_email: user?.email, automatico: true, visibilidad: 'ambos',
        }).catch(() => {});
      }
      onSaved?.();
      onOpenChange(false);
    } catch {
      setSaveError('No se pudo guardar la factura. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const ErrMsg = ({ field }) => errors[field]
    ? <p className="text-xs text-destructive flex items-center gap-1 mt-0.5"><AlertCircle className="w-3 h-3" />{errors[field]}</p>
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar factura' : 'Nueva factura'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-2">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={set('tipo')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="emitida">Emitida</SelectItem>
                <SelectItem value="recibida">Recibida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Nº factura */}
          <div className="space-y-1.5">
            <Label>Nº Factura *</Label>
            <Input value={form.numero_factura} onChange={set('numero_factura')} placeholder="F-2026-001" className={errors.numero_factura ? 'border-destructive' : ''} />
            <ErrMsg field="numero_factura" />
          </div>

          {/* Fechas */}
          <div className="space-y-1.5">
            <Label>Fecha emisión *</Label>
            <Input type="date" value={form.fecha_emision} onChange={set('fecha_emision')} className={errors.fecha_emision ? 'border-destructive' : ''} />
            <ErrMsg field="fecha_emision" />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha vencimiento</Label>
            <Input type="date" value={form.fecha_vencimiento || ''} onChange={set('fecha_vencimiento')} />
          </div>

          {/* Cliente */}
          <div className="space-y-1.5">
            <Label>Cliente / Proveedor</Label>
            <Input value={form.cliente_nombre} onChange={set('cliente_nombre')} placeholder="Nombre o razón social" />
          </div>
          <div className="space-y-1.5">
            <Label>NIF / CIF</Label>
            <Input value={form.cliente_nif} onChange={set('cliente_nif')} placeholder="B12345678" />
          </div>

          {/* Concepto */}
          <div className="col-span-2 space-y-1.5">
            <Label>Concepto</Label>
            <Input value={form.concepto} onChange={set('concepto')} placeholder="Descripción del servicio o producto" />
          </div>

          {/* Base imponible */}
          <div className="space-y-1.5">
            <Label>Base imponible (€) *</Label>
            <Input type="number" step="0.01" min="0" value={form.base_imponible}
              onChange={set('base_imponible')} placeholder="0,00"
              className={errors.base_imponible ? 'border-destructive' : ''} />
            <ErrMsg field="base_imponible" />
          </div>

          {/* Tipo impuesto */}
          <div className="space-y-1.5">
            <Label>% {taxType}</Label>
            <Select value={String(form.tipo_iva)} onValueChange={v => set('tipo_iva')(parseFloat(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {taxRates.map(r => (
                  <SelectItem key={r} value={String(r)}>{r} %</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cuota impuesto (readonly) */}
          <div className="space-y-1.5">
            <Label>Cuota {taxType}</Label>
            <div className="h-9 flex items-center px-3 bg-secondary/60 rounded-md border border-border text-sm font-medium text-foreground">
              {fmt(cuota)} €
            </div>
          </div>

          {/* Retención toggle */}
          <div className="space-y-1.5">
            <Label>Retención IRPF</Label>
            <div className="flex items-center gap-3 h-9">
              <Switch checked={form.aplica_retencion}
                onCheckedChange={v => setForm(f => ({ ...f, aplica_retencion: v, retencion_irpf: v ? 15 : 0 }))} />
              <span className="text-sm text-muted-foreground">{form.aplica_retencion ? 'Aplicar retención' : 'Sin retención'}</span>
            </div>
          </div>

          {/* Porcentaje retención */}
          {form.aplica_retencion && (
            <div className="space-y-1.5">
              <Label>% Retención *</Label>
              {!customRetention ? (
                <div className="flex gap-2">
                  <Select value={String(form.retencion_irpf)}
                    onValueChange={v => { if (v === 'otro') { setCustomRetention(true); } else { set('retencion_irpf')(parseFloat(v)); } }}>
                    <SelectTrigger className={errors.retencion_irpf ? 'border-destructive' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETENTION_RATES.map(r => <SelectItem key={r} value={String(r)}>{r} %</SelectItem>)}
                      <SelectItem value="otro">Otro...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input type="number" step="0.01" min="0" max="100" value={form.retencion_irpf}
                    onChange={set('retencion_irpf')} placeholder="%" className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => setCustomRetention(false)}>←</Button>
                </div>
              )}
              <ErrMsg field="retencion_irpf" />
            </div>
          )}

          {/* Importe retención (readonly) */}
          {form.aplica_retencion && (
            <div className="space-y-1.5">
              <Label>Importe retención</Label>
              <div className="h-9 flex items-center px-3 bg-secondary/60 rounded-md border border-border text-sm font-medium text-destructive">
                -{fmt(retencionImporte)} €
              </div>
            </div>
          )}

          {/* Resumen total */}
          <div className="col-span-2 mt-2">
            <div className="bg-secondary/40 rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Resumen</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base imponible</span>
                  <span className="font-medium">{fmt(parseFloat(form.base_imponible) || 0)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{taxType} {form.tipo_iva} %</span>
                  <span className="font-medium">+ {fmt(cuota)} €</span>
                </div>
                {form.aplica_retencion && (
                  <div className="flex justify-between text-destructive">
                    <span>Retención IRPF {form.retencion_irpf} %</span>
                    <span className="font-medium">- {fmt(retencionImporte)} €</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border text-base font-bold text-foreground">
                  <span>Total factura</span>
                  <span className="text-teal">{fmt(total)} €</span>
                </div>
              </div>
            </div>
          </div>

          {/* Estados */}
          <div className="space-y-1.5">
            <Label>Estado de cobro</Label>
            <Select value={form.estado_cobro} onValueChange={set('estado_cobro')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="cobrada">Cobrada</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estado contable</Label>
            <Select value={form.estado_contable} onValueChange={set('estado_contable')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_revision">En revisión</SelectItem>
                <SelectItem value="revisada">Revisada</SelectItem>
                <SelectItem value="contabilizada">Contabilizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Comentarios / Notas</Label>
            <Input value={form.comentarios || ''} onChange={set('comentarios')} placeholder="Notas adicionales..." />
          </div>
        </div>

        {saveError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-3">{saveError}</p>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">
            {saving ? 'Guardando...' : 'Guardar factura'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
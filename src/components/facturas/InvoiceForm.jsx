import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, UserSearch } from 'lucide-react';
import ContactPickerModal from './ContactPickerModal';
import RecurringFields from './RecurringFields';
import { getDefaultRecurring, calculateNextRun, calculateDueDate } from '@/lib/recurringUtils';

const IVA_RATES = [0, 4, 10, 21];
const IGIC_RATES = [0, 3, 7, 9.5, 15];
const RETENTION_RATES = [7, 15, 19];
const FORMAS_PAGO = [
  'Transferencia bancaria', 'Bizum', 'Tarjeta', 'Efectivo',
  'Domiciliación bancaria', 'PayPal', 'Stripe', 'Otro',
];
const COLETILLAS = [
  'Operación exenta de IGIC por franquicia fiscal (art. 10.Uno.28º Ley 20/1991).',
  'Operación exenta de IVA.',
  'Operación no sujeta a IVA por reglas de localización.',
  'Inversión del sujeto pasivo.',
  'Factura emitida sin IGIC por aplicación del REPEP.',
  'Retención profesional aplicada.',
  'Servicios intracomunitarios exentos de IVA.',
  'Exportación de servicios.',
];

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

function ErrMsg({ msg }) {
  if (!msg) return null;
  return (
    <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
      <AlertCircle className="w-3 h-3" />{msg}
    </p>
  );
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
    cliente_direccion: '',
    cliente_email: '',
    concepto: '',
    base_imponible: '',
    tipo_iva: taxType === 'IGIC' ? 7 : 21,
    cuota_iva: '',
    aplica_retencion: false,
    retencion_irpf: 0,
    total_factura: '',
    estado_cobro: 'pendiente',
    estado_contable: 'pendiente',
    forma_pago: 'Transferencia bancaria',
    coletilla_fiscal: '',
    comentarios: '',
  });

  const [form, setForm] = useState(getEmpty());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [customRetention, setCustomRetention] = useState(false);
  const [useCustomColetilla, setUseCustomColetilla] = useState(false);
  const loadedRef = useRef(false);
  const [favoriteNotes, setFavoriteNotes] = useState([]);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [recurring, setRecurring] = useState(getDefaultRecurring());

  const handleSelectContact = (contact) => {
    setForm(prev => ({
      ...prev,
      cliente_nombre: contact.nombre || prev.cliente_nombre,
      cliente_nif: contact.nif_cif || prev.cliente_nif,
      cliente_email: contact.email || prev.cliente_email,
      cliente_direccion: contact.direccion_fiscal || prev.cliente_direccion,
    }));
  };

  const { cuota, retencionImporte, total } = calcTotals(
    form.base_imponible,
    form.tipo_iva,
    form.aplica_retencion ? form.retencion_irpf : 0
  );

  useEffect(() => {
    const run = async () => {
    if (!open) { loadedRef.current = false; return; }
    if (editing && !loadedRef.current) {
      loadedRef.current = true;
      setForm({ ...getEmpty(), ...editing, aplica_retencion: (parseFloat(editing.retencion_irpf) || 0) > 0 });
      setCustomRetention(!RETENTION_RATES.includes(parseFloat(editing.retencion_irpf)));
      setUseCustomColetilla(editing.coletilla_fiscal && !COLETILLAS.includes(editing.coletilla_fiscal));
      setRecurring(getDefaultRecurring());
    } else if (!editing && !loadedRef.current) {
      loadedRef.current = true;
      setForm(getEmpty());
      setRecurring(getDefaultRecurring());
    }
    setErrors({});
    setSaveError('');
    };
    run();
  }, [open, editing?.id]);

  const set = useCallback((field) => (e) => {
    const val = e?.target !== undefined ? e.target.value : e;
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
        const createdInvoice = await base44.entities.Invoice.create(payload);
        base44.entities.TimelineEvent.create({
          company_id: company.id, tipo: 'factura_clasificada',
          titulo: `Nueva factura: ${payload.numero_factura}`,
          descripcion: `${payload.tipo === 'emitida' ? 'Emitida' : 'Recibida'} · ${payload.cliente_nombre || ''} · ${fmt(total)} €`,
          color: 'azul', usuario_email: user?.email, automatico: true, visibilidad: 'ambos',
        }).catch(() => {});

        // Create recurring template if enabled and invoice is "emitida"
        if (recurring.enabled && payload.tipo === 'emitida') {
          const nextRun = calculateNextRun(recurring, recurring.startDate);
          await base44.entities.RecurringInvoiceTemplate.create({
            ownerAccountId: company.id,
            createdByUserId: user?.id,
            createdByEmail: user?.email,
            status: 'active',
            mode: recurring.mode,
            frequency: recurring.frequency,
            interval: recurring.interval,
            startDate: recurring.startDate,
            endDate: recurring.endDate || null,
            nextRunDate: nextRun,
            dayOfWeek: recurring.dayOfWeek,
            dayOfMonth: recurring.frequency === 'yearly' ? recurring.dayOfMonthYearly : recurring.dayOfMonth,
            monthOfYear: recurring.monthOfYear,
            dueDateMode: recurring.dueDateMode,
            dueDaysAfterIssue: recurring.dueDaysAfterIssue,
            dueDayOfMonth: recurring.dueDayOfMonth,
            invoiceType: 'emitida',
            concept: payload.concepto,
            baseAmount: parseFloat(payload.base_imponible) || 0,
            taxRate: parseFloat(payload.tipo_iva) || 0,
            taxType: taxType.toLowerCase(),
            retentionRate: payload.retencion_irpf || 0,
            totalAmount: total,
            currency: payload.moneda || 'EUR',
            sendEmailAutomatically: false,
            clientName: payload.cliente_nombre,
            clientNif: payload.cliente_nif,
            clientAddress: payload.cliente_direccion,
            clientEmail: payload.cliente_email,
            formaPago: payload.forma_pago,
            coletillaFiscal: payload.coletilla_fiscal || '',
            totalGenerated: 0,
          }).catch(() => {});
        }
      }
      onSaved?.();
      onOpenChange(false);
    } catch {
      setSaveError('No se pudo guardar la factura. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar factura' : 'Nueva factura'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Tipo + Nº */}
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-1.5">
              <Label>Nº Factura *</Label>
              <Input value={form.numero_factura} onChange={set('numero_factura')} placeholder="F-2026-001" className={errors.numero_factura ? 'border-destructive' : ''} />
              <ErrMsg msg={errors.numero_factura} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha emisión *</Label>
              <Input type="date" value={form.fecha_emision} onChange={set('fecha_emision')} className={errors.fecha_emision ? 'border-destructive' : ''} />
              <ErrMsg msg={errors.fecha_emision} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha vencimiento</Label>
              <Input type="date" value={form.fecha_vencimiento || ''} onChange={set('fecha_vencimiento')} />
            </div>
          </div>

          {/* Cliente */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Datos del cliente</p>
              <button
                type="button"
                onClick={() => setShowContactPicker(true)}
                className="flex items-center gap-1.5 text-xs text-teal hover:text-teal-dark font-medium transition-colors">
                <UserSearch className="w-3.5 h-3.5" />
                Seleccionar contacto guardado
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre / Razón social</Label>
                <Input value={form.cliente_nombre} onChange={set('cliente_nombre')} placeholder="Nombre o razón social" />
              </div>
              <div className="space-y-1.5">
                <Label>NIF / CIF</Label>
                <Input value={form.cliente_nif} onChange={set('cliente_nif')} placeholder="B12345678" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Dirección fiscal</Label>
                <Input value={form.cliente_direccion || ''} onChange={set('cliente_direccion')} placeholder="Calle, número, CP, municipio" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.cliente_email || ''} onChange={set('cliente_email')} placeholder="cliente@ejemplo.com" />
              </div>
            </div>
          </div>

          {/* Concepto */}
          <div className="space-y-1.5">
            <Label>Concepto / Descripción</Label>
            <Textarea value={form.concepto} onChange={set('concepto')} placeholder="Descripción detallada del servicio..." rows={3} />
          </div>

          {/* Importes */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Importes</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Base imponible (€) *</Label>
                <Input type="number" step="0.01" min="0" value={form.base_imponible}
                  onChange={set('base_imponible')} placeholder="0,00"
                  className={errors.base_imponible ? 'border-destructive' : ''} />
                <ErrMsg msg={errors.base_imponible} />
              </div>
              <div className="space-y-1.5">
                <Label>% {taxType}</Label>
                <Select value={String(form.tipo_iva)} onValueChange={v => set('tipo_iva')(parseFloat(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {taxRates.map(r => <SelectItem key={r} value={String(r)}>{r} %</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cuota {taxType}</Label>
                <div className="h-9 flex items-center px-3 bg-secondary/60 rounded-md border border-border text-sm font-medium">
                  {fmt(cuota)} €
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Retención IRPF</Label>
                <div className="flex items-center gap-3 h-9">
                  <Switch checked={form.aplica_retencion}
                    onCheckedChange={v => setForm(f => ({ ...f, aplica_retencion: v, retencion_irpf: v ? 15 : 0 }))} />
                  <span className="text-sm text-muted-foreground">{form.aplica_retencion ? 'Aplicar' : 'Sin retención'}</span>
                </div>
              </div>
              {form.aplica_retencion && (
                <>
                  <div className="space-y-1.5">
                    <Label>% Retención *</Label>
                    {!customRetention ? (
                      <Select value={String(form.retencion_irpf)}
                        onValueChange={v => { if (v === 'otro') setCustomRetention(true); else set('retencion_irpf')(parseFloat(v)); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RETENTION_RATES.map(r => <SelectItem key={r} value={String(r)}>{r} %</SelectItem>)}
                          <SelectItem value="otro">Otro...</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex gap-2">
                        <Input type="number" step="0.01" min="0" max="100" value={form.retencion_irpf}
                          onChange={set('retencion_irpf')} placeholder="%" className="flex-1" />
                        <Button variant="outline" size="sm" onClick={() => setCustomRetention(false)}>←</Button>
                      </div>
                    )}
                    <ErrMsg msg={errors.retencion_irpf} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Importe retención</Label>
                    <div className="h-9 flex items-center px-3 bg-secondary/60 rounded-md border border-border text-sm font-medium text-destructive">
                      -{fmt(retencionImporte)} €
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Resumen */}
            <div className="bg-secondary/40 rounded-xl border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resumen</p>
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
                <div className="flex justify-between pt-2 border-t border-border text-base font-bold">
                  <span>Total factura</span>
                  <span className="text-teal">{fmt(total)} €</span>
                </div>
              </div>
            </div>
          </div>

          {/* Forma de pago */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Forma de pago</Label>
              <Select value={form.forma_pago} onValueChange={set('forma_pago')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          {/* Coletilla fiscal */}
          <div className="space-y-2">
            <Label>Coletilla fiscal (opcional)</Label>
            {!useCustomColetilla ? (
              <div className="flex gap-2">
                <Select value={form.coletilla_fiscal}
                  onValueChange={v => { if (v === '__custom__') { setUseCustomColetilla(true); set('coletilla_fiscal')(''); } else set('coletilla_fiscal')(v); }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar coletilla predefinida..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sin coletilla</SelectItem>
                    {COLETILLAS.map(c => (
                      <SelectItem key={c} value={c}>{c.slice(0, 60)}…</SelectItem>
                    ))}
                    <SelectItem value="__custom__">Escribir coletilla personalizada...</SelectItem>
                  </SelectContent>
                </Select>
                {form.coletilla_fiscal && (
                  <Button variant="outline" size="sm" onClick={() => set('coletilla_fiscal')('')}>Quitar</Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Textarea value={form.coletilla_fiscal} onChange={set('coletilla_fiscal')}
                  placeholder="Texto de la coletilla fiscal..." rows={2} className="flex-1" />
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setUseCustomColetilla(false)}>←</Button>
              </div>
            )}
            {form.coletilla_fiscal && !useCustomColetilla && (
              <p className="text-xs text-muted-foreground bg-secondary/60 rounded px-3 py-2 italic">{form.coletilla_fiscal}</p>
            )}
          </div>

          {/* Comentarios */}
          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Input value={form.comentarios || ''} onChange={set('comentarios')} placeholder="Notas adicionales..." />
          </div>

          {/* Recurring */}
          {!editing && form.tipo === 'emitida' && (
            <RecurringFields recurring={recurring} setRecurring={setRecurring} />
          )}
        </div>

        <ContactPickerModal
          open={showContactPicker}
          onOpenChange={setShowContactPicker}
          companyId={company?.id}
          tipo={form.tipo === 'emitida' ? 'cliente' : 'proveedor'}
          onSelect={handleSelectContact}
        />

        {saveError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-3">{saveError}</p>
        )}

        <div className="flex justify-end gap-3 mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">
            {saving ? 'Guardando...' : 'Guardar factura'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
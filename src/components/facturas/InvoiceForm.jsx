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
import { getDefaultRecurring, calculateNextRun } from '@/lib/recurringUtils';

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
  return (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcTotals(base, taxPct, retentionPct) {
  const b = Number(base) || 0;
  const cuota = b * (Number(taxPct) || 0) / 100;
  const retencionImporte = b * (Number(retentionPct) || 0) / 100;
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
    fiscal_activity_id: '',
    numero_factura: '',
    fecha_emision: new Date().toISOString().slice(0, 10),
    fecha_operacion: '',
    fecha_recepcion: new Date().toISOString().slice(0, 10),
    fecha_vencimiento: '',
    cliente_nombre: '',
    cliente_nif: '',
    cliente_direccion: '',
    cliente_email: '',
    cliente_telefono: '',
    cliente_codigo_postal: '',
    cliente_ciudad: '',
    cliente_provincia: '',
    cliente_pais: 'España',
    concepto: '',
    base_imponible: '',
    tax_breakdown_rows: [],
    es_rectificativa: false,
    factura_rectificada: '',
    tipo_iva: taxType === 'IGIC' ? 7 : 21,
    cuota_iva: '',
    aplica_recargo: false,
    tipo_recargo: 0,
    aplica_retencion: false,
    retencion_irpf: 0,
    total_factura: '',
    estado_cobro: 'pendiente',
    estado_contable: 'pendiente',
    forma_pago: 'Transferencia bancaria',
    coletilla_fiscal: '',
    comentarios: '',
    moneda: 'EUR',
  });

  const [form, setForm] = useState(getEmpty());
  const [errors, setErrors] = useState(/** @type {any} */ ({}));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [customRetention, setCustomRetention] = useState(false);
  const [useCustomColetilla, setUseCustomColetilla] = useState(false);
  const loadedRef = useRef(false);
  const creationKeyRef = useRef('');
  const [favoriteNotes, setFavoriteNotes] = useState([]);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [recurring, setRecurring] = useState(getDefaultRecurring());
  const [fiscalContext, setFiscalContext] = useState({ profile: null, activities: [], loading: false });

  useEffect(() => {
    if (!open || !company?.id) return;
    let active = true;
    setFiscalContext({ profile: null, activities: [], loading: true });
    import('@/api/base44Client').then(({ base44 }) => base44.functions.invoke('fiscalOperations', { action: 'bundle', companyId: company.id }))
      .then(response => {
        if (!active) return;
        const bundle = response?.data || response;
        const activities = (bundle?.activities || []).filter(item => item.active !== false);
        setFiscalContext({ profile: bundle?.profile || null, activities, loading: false });
        if (!editing && activities.length === 1) setForm(current => current.fiscal_activity_id ? current : {
          ...current,
          fiscal_activity_id: activities[0].id,
          tipo_iva: current.tipo === 'emitida' && ['exenta_limitada', 'exenta_plena', 'pequeno_empresario_igic'].includes(activities[0].indirectTaxRegime) ? 0 : current.tipo_iva,
        });
      })
      .catch(() => { if (active) setFiscalContext({ profile: null, activities: [], loading: false }); });
    return () => { active = false; };
  }, [open, company?.id, editing?.id]);

  const handleSelectContact = (contact) => {
    setForm(prev => ({
      ...prev,
      cliente_nombre: contact.nombre || prev.cliente_nombre,
      cliente_nif: contact.nif_cif || prev.cliente_nif,
      cliente_email: contact.email || prev.cliente_email,
      cliente_telefono: contact.telefono || prev.cliente_telefono,
      cliente_direccion: contact.direccion_fiscal || prev.cliente_direccion,
      cliente_codigo_postal: contact.codigo_postal || prev.cliente_codigo_postal,
      cliente_ciudad: contact.ciudad || prev.cliente_ciudad,
      cliente_provincia: contact.provincia || prev.cliente_provincia,
      cliente_pais: contact.pais || prev.cliente_pais,
    }));
  };

  const { cuota: ordinaryQuota, retencionImporte } = calcTotals(
    form.base_imponible,
    form.tipo_iva,
    form.aplica_retencion ? form.retencion_irpf : 0
  );
  const quotaRows = form.tax_breakdown_rows || [];
  const cuota = quotaRows.length ? Math.round(quotaRows.reduce((sum, row) => sum + Math.round(Number(row.base || 0) * Number(row.rate) + Number.EPSILON) / 100, 0) * 100) / 100 : ordinaryQuota;
  const ordinaryTotal = Number(form.base_imponible || 0) + cuota - retencionImporte;
  const updateQuotaRows = rows => setForm(current => ({ ...current, tax_breakdown_rows: rows,
    base_imponible: rows.length ? String(Math.round(rows.reduce((sum, row) => sum + Number(row.base || 0), 0) * 100) / 100) : current.base_imponible,
    tipo_iva: rows.length > 1 ? 0 : rows[0]?.rate ?? current.tipo_iva }));
  const recargoImporte = form.aplica_recargo ? Math.round((Number(form.base_imponible || 0) * Number(form.tipo_recargo || 0) / 100 + Number.EPSILON) * 100) / 100 : 0;
  const total = ordinaryTotal + recargoImporte;

  useEffect(() => {
    const run = async () => {
    if (!open) { loadedRef.current = false; creationKeyRef.current = ''; return; }
    if (editing && !loadedRef.current) {
      loadedRef.current = true;
      let savedBreakdown = [];
      try { savedBreakdown = JSON.parse(editing.tax_breakdown || '[]'); } catch { /* Documento heredado sin desglose. */ }
      setForm({ ...getEmpty(), ...editing, tax_breakdown_rows: Array.isArray(savedBreakdown) ? savedBreakdown : [], aplica_retencion: (Number(editing.retencion_irpf) || 0) > 0, aplica_recargo: Number(editing.cuota_recargo || 0) !== 0 });
      setCustomRetention(!RETENTION_RATES.includes(Number(editing.retencion_irpf)));
      setUseCustomColetilla(Boolean(editing.coletilla_fiscal && !COLETILLAS.includes(editing.coletilla_fiscal)));
      setRecurring(getDefaultRecurring());
    } else if (!editing && !loadedRef.current) {
      loadedRef.current = true;
      creationKeyRef.current = globalThis.crypto?.randomUUID?.() || `invoice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setForm(getEmpty());
      setRecurring(getDefaultRecurring());
    }
    setErrors({});
    setSaveError('');
    setSaveNotice('');
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
    if (fiscalContext.activities.length > 1 && !form.fiscal_activity_id) e.fiscal_activity_id = 'Selecciona la actividad fiscal';
    if (!form.fecha_emision) e.fecha_emision = 'Obligatorio';
    if (form.tipo === 'recibida' && !form.fecha_recepcion) e.fecha_recepcion = 'Obligatorio para asignar la deducción al período correcto';
    if (form.tipo === 'recibida' && form.fecha_recepcion && form.fecha_emision && form.fecha_recepcion < form.fecha_emision) e.fecha_recepcion = 'No puede ser anterior a la fecha de emisión';
    if (form.base_imponible === '' || isNaN(Number(form.base_imponible))) e.base_imponible = 'Introduce un importe válido';
    else if (Number(form.base_imponible) < 0 && !form.es_rectificativa) e.base_imponible = 'Una base negativa requiere factura rectificativa';
    if (form.es_rectificativa && !form.factura_rectificada?.trim()) e.base_imponible = 'Indica la factura original que rectificas';
    if (quotaRows.length > 3 || new Set(quotaRows.map(row => Number(row.rate))).size !== quotaRows.length || quotaRows.some(row => row.base === '' || !Number.isFinite(Number(row.base)) || ![4,10,21].includes(Number(row.rate)) || (Number(row.base) !== 0 && Math.sign(Number(row.base)) !== Math.sign(Number(form.base_imponible))))) e.base_imponible = 'Revisa el desglose: un máximo de tres tipos distintos y bases del mismo signo';
    if (quotaRows.length > 1 && form.aplica_recargo) e.tipo_recargo = 'El recargo necesita un documento con un único tipo de IVA revisado por asesor.';
    if (form.aplica_recargo && (taxType !== 'IVA' || !Number.isFinite(Number(form.tipo_recargo)) || Number(form.tipo_recargo) <= 0 || Number(form.tipo_recargo) > 100)) e.tipo_recargo = 'Indica un tipo de recargo IVA válido';
    if (form.aplica_recargo && recurring.enabled) e.tipo_recargo = 'El recargo necesita revisión individual: desactiva la recurrencia.';
    if (form.aplica_retencion && (String(form.retencion_irpf) === '' || isNaN(Number(form.retencion_irpf)))) {
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
      base_imponible: Number(form.base_imponible) || 0,
      tipo_iva: Number(form.tipo_iva) || 0,
      cuota_iva: cuota,
      tax_breakdown: quotaRows.length ? JSON.stringify(quotaRows.map(row => ({ base: Number(row.base), rate: Number(row.rate), quota: Math.round(Number(row.base) * Number(row.rate) + Number.EPSILON) / 100 }))) : '',
      tipo_recargo: form.aplica_recargo ? Number(form.tipo_recargo) : 0,
      cuota_recargo: recargoImporte,
      retencion_irpf: form.aplica_retencion ? (Number(form.retencion_irpf) || 0) : 0,
      importe_retencion: form.aplica_retencion ? retencionImporte : 0,
      total_factura: total,
      anio: year,
      trimestre,
      subido_por: user?.email,
    };
    if (payload.tipo !== 'recibida') delete payload.fecha_recepcion;
    try {
      if (editing?.id) {
        setSaveError('Las facturas definitivas no se editan. Anula la factura y emite una nueva o rectificativa.');
        return;
      } else {
        const response = await base44.functions.invoke('invoiceOperations', {
          action: 'create_invoice',
          company_id: company.id,
          idempotency_key: creationKeyRef.current,
          invoice: { ...payload, numero_factura: payload.numero_factura.trim() },
        });
        const result = response?.data || response;
        if (!result?.ok || !result?.invoice) throw new Error(result?.error || 'No se pudo crear la factura.');
        const createdInvoice = result.invoice;
        await base44.functions.invoke('syncInvoiceContacts', {
          action: 'sync_invoice',
          invoiceId: createdInvoice.id,
        }).catch(error => console.error('[InvoiceForm] Contact sync failed:', error));
        base44.entities.TimelineEvent.create({
          company_id: company.id, tipo: 'factura_clasificada',
          titulo: `${result.review_required ? 'Factura pendiente de revisión' : 'Nueva factura'}: ${payload.numero_factura}`,
          descripcion: `${payload.tipo === 'emitida' ? 'Emitida' : 'Recibida'} · ${result.review_required ? 'sin contabilizar · ' : ''}${payload.cliente_nombre || ''} · ${fmt(total)} €`,
          color: 'azul', usuario_email: user?.email, automatico: true, visibilidad: 'ambos',
        }).catch(() => {});

        if (result.accounting_warning && !result.review_required) {
          setSaveError(`La factura se guardó, pero necesita revisión contable: ${result.accounting_warning}`);
          onSaved?.();
          return;
        }

        // Create recurring template if enabled and invoice is "emitida"
        if (recurring.enabled && payload.tipo === 'emitida') {
          const nextRun = calculateNextRun(recurring, recurring.startDate);
          try {
            const tmplResp = await base44.functions.invoke('generateRecurringInvoices', {
              action: 'create_template',
              template: {
                ownerAccountId: company.id,
                createdByUserId: user?.id,
                createdByEmail: user?.email,
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
                concept: payload.concepto,
                baseAmount: Number(payload.base_imponible) || 0,
                taxRate: Number(payload.tipo_iva) || 0,
                taxType: taxType.toLowerCase(),
                fiscalActivityId: payload.fiscal_activity_id || createdInvoice.fiscal_activity_id,
                retentionRate: payload.retencion_irpf || 0,
                totalAmount: total,
                currency: payload.moneda || 'EUR',
                clientName: payload.cliente_nombre,
                clientNif: payload.cliente_nif,
                clientAddress: payload.cliente_direccion,
                clientEmail: payload.cliente_email,
                formaPago: payload.forma_pago,
                coletillaFiscal: payload.coletilla_fiscal || '',
              },
            });
            const tmplResult = tmplResp?.data || tmplResp;
            if (!tmplResult?.ok) throw new Error(tmplResult?.error || 'Error desconocido');
          } catch (tmplError) {
            setSaveError(`La factura se guardó, pero la plantilla recurrente no pudo crearse: ${tmplError?.message || 'inténtalo de nuevo.'}`);
            onSaved?.();
            return;
          }
        }
        if (result.review_required) {
          setSaveNotice('Documento guardado como pendiente. El asesor debe confirmar su clasificación fiscal antes de emitir el QR, enviar o contabilizar.');
          onSaved?.();
          return;
        }
      }
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      setSaveError(error?.response?.data?.error || error?.message || 'No se pudo guardar la factura. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva factura · revisión fiscal previa</DialogTitle>
        </DialogHeader>
        {form.tipo === 'emitida' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            El número quedará reservado y la factura pendiente de revisión. El QR tributario se genera tras la confirmación fiscal y contable del asesor. La remisión VERI*FACTU a la AEAT no está activada.
          </div>
        )}

        <div className="space-y-5 mt-2">
          {fiscalContext.loading ? <p className="text-xs text-muted-foreground">Comprobando perfil fiscal…</p> : !fiscalContext.profile || fiscalContext.profile.profileStatus !== 'validado_asesor' ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Puedes guardar una propuesta, pero el asesor debe validar el perfil y la actividad en Configuración fiscal antes de confirmar la factura y su asiento. Las facturas y subcuentas anteriores no cambian.</div>
          ) : null}
          {fiscalContext.activities.length > 0 && (
            <div className="space-y-1.5">
              <Label>Actividad fiscal de esta factura</Label>
              <Select value={form.fiscal_activity_id || ''} onValueChange={value => {
                const activity = fiscalContext.activities.find(item => item.id === value);
                setForm(current => ({ ...current, fiscal_activity_id: value,
                  tipo_iva: current.tipo === 'emitida' && ['exenta_limitada', 'exenta_plena', 'pequeno_empresario_igic'].includes(activity?.indirectTaxRegime) ? 0 : current.tipo_iva,
                }));
              }}>
                <SelectTrigger><SelectValue placeholder="Selecciona una actividad" /></SelectTrigger>
                <SelectContent>{fiscalContext.activities.map(activity => <SelectItem key={activity.id} value={activity.id}>{activity.name} · {String(activity.indirectTax || '').toUpperCase()} · {activity.indirectTaxRegime}</SelectItem>)}</SelectContent>
              </Select>
              <ErrMsg msg={errors.fiscal_activity_id} />
            </div>
          )}
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
              <Label>Fecha de operación (si difiere)</Label><Input type="date" value={form.fecha_operacion || ''} onChange={set('fecha_operacion')} />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha vencimiento</Label>
              <Input type="date" value={form.fecha_vencimiento || ''} onChange={set('fecha_vencimiento')} />
            </div>
            {form.tipo === 'recibida' && <div className="col-span-2 space-y-1.5">
              <Label>Fecha real de recepción *</Label>
              <Input type="date" value={form.fecha_recepcion || ''} onChange={set('fecha_recepcion')} className={errors.fecha_recepcion ? 'border-destructive' : ''} />
              <p className="text-xs text-muted-foreground">Determina desde qué período puede deducirse el IVA/IGIC. No cambia el ejercicio contable de la factura.</p>
              <ErrMsg msg={errors.fecha_recepcion} />
            </div>}
          </div>

          {/* Cliente */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{form.tipo === 'recibida' ? 'Datos del proveedor' : 'Datos del cliente'}</p>
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
                <Input value={form.cliente_direccion || ''} onChange={set('cliente_direccion')} placeholder="Calle y número" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.cliente_email || ''} onChange={set('cliente_email')} placeholder="cliente@ejemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={form.cliente_telefono || ''} onChange={set('cliente_telefono')} placeholder="+34 600 000 000" />
              </div>
              <div className="space-y-1.5">
                <Label>Código postal</Label>
                <Input value={form.cliente_codigo_postal || ''} onChange={set('cliente_codigo_postal')} placeholder="38001" />
              </div>
              <div className="space-y-1.5">
                <Label>Ciudad</Label>
                <Input value={form.cliente_ciudad || ''} onChange={set('cliente_ciudad')} placeholder="Santa Cruz de Tenerife" />
              </div>
              <div className="space-y-1.5">
                <Label>Provincia</Label>
                <Input value={form.cliente_provincia || ''} onChange={set('cliente_provincia')} placeholder="Santa Cruz de Tenerife" />
              </div>
              <div className="space-y-1.5">
                <Label>País</Label>
                <Input value={form.cliente_pais || ''} onChange={set('cliente_pais')} placeholder="España" />
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
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.es_rectificativa)} onChange={event => setForm(current => ({ ...current, es_rectificativa: event.target.checked }))} />Factura rectificativa (requiere revisión del asesor)</label>
            {form.es_rectificativa && <Input value={form.factura_rectificada} onChange={set('factura_rectificada')} placeholder="Número de la factura original" aria-label="Factura original rectificada" />}
            {taxType === 'IVA' && <div className="rounded-xl border p-3 space-y-2">
              <button type="button" className="text-xs font-semibold text-primary" onClick={() => updateQuotaRows(quotaRows.length ? [] : [{ base: form.base_imponible || '', rate: Number(form.tipo_iva) || 21 }])}>{quotaRows.length ? 'Volver a un tipo único' : 'Desglosar varios tipos de IVA'}</button>
              {quotaRows.map((row, index) => <div key={index} className="flex items-center gap-2">
                <Input aria-label={`Base IVA línea ${index + 1}`} type="number" step="0.01" value={row.base} onChange={event => updateQuotaRows(quotaRows.map((item, i) => i === index ? { ...item, base: event.target.value } : item))} />
                <select aria-label={`Tipo IVA línea ${index + 1}`} className="rounded-lg border p-2" value={row.rate} onChange={event => updateQuotaRows(quotaRows.map((item, i) => i === index ? { ...item, rate: Number(event.target.value) } : item))}>{[4,10,21].map(rate => <option key={rate} value={rate}>{rate}%</option>)}</select>
                <button type="button" aria-label={`Eliminar línea IVA ${index + 1}`} onClick={() => updateQuotaRows(quotaRows.filter((_, i) => i !== index))}>×</button>
              </div>)}
              {quotaRows.length > 0 && quotaRows.length < 3 && <button type="button" className="text-xs text-primary" onClick={() => updateQuotaRows([...quotaRows, { base: '', rate: [21,10,4].find(rate => !quotaRows.some(row => Number(row.rate) === rate)) }])}>Añadir tipo de IVA</button>}
            </div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Base imponible (€) *</Label>
                <Input type="number" step="0.01" min={form.es_rectificativa ? undefined : 0} disabled={quotaRows.length > 0} value={form.base_imponible}
                  onChange={set('base_imponible')} placeholder="0,00"
                  className={errors.base_imponible ? 'border-destructive' : ''} />
                <ErrMsg msg={errors.base_imponible} />
              </div>
              <div className="space-y-1.5">
                <Label>{quotaRows.length ? 'Tipos IVA por línea' : `% ${taxType}`}</Label>
                {quotaRows.length ? <div className="flex h-9 items-center rounded-md border border-border bg-secondary/60 px-3 text-sm">{quotaRows.map(row => `${row.rate} %`).join(' · ')}</div> : <Select value={String(form.tipo_iva)} onValueChange={v => set('tipo_iva')(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {taxRates.map(r => <SelectItem key={r} value={String(r)}>{r} %</SelectItem>)}
                  </SelectContent>
                </Select>}
              </div>
              <div className="space-y-1.5">
                <Label>Cuota {taxType}</Label>
                <div className="h-9 flex items-center px-3 bg-secondary/60 rounded-md border border-border text-sm font-medium">
                  {fmt(cuota)} €
                </div>
              </div>
              {taxType === 'IVA' && <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2"><div className="flex items-center gap-3"><Switch checked={Boolean(form.aplica_recargo)} onCheckedChange={value => setForm(current => ({ ...current, aplica_recargo: value, tipo_recargo: value ? (Number(current.tipo_iva) === 21 ? 5.2 : Number(current.tipo_iva) === 10 ? 1.4 : Number(current.tipo_iva) === 4 ? 0.5 : 0) : 0 }))} /><span className="text-sm font-medium text-amber-900">Factura con recargo de equivalencia</span></div>{form.aplica_recargo && <><label className="block text-xs text-amber-900">Tipo de recargo (%)<Input type="number" min="0" max="100" step="0.01" value={form.tipo_recargo ?? ''} onChange={set('tipo_recargo')} className="mt-1 bg-white" /></label><p className="text-[11px] text-amber-800">La cuota se consigna por separado. El documento quedará pendiente de validación fiscal y contable del asesor; no se emitirá ni contabilizará automáticamente.</p><ErrMsg msg={errors.tipo_recargo} /></>}</div>}
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
                        onValueChange={v => { if (v === 'otro') setCustomRetention(true); else set('retencion_irpf')(Number(v)); }}>
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
                  <span className="font-medium">{fmt(Number(form.base_imponible) || 0)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{quotaRows.length ? `IVA (${quotaRows.map(row => `${row.rate} %`).join(' · ')})` : `${taxType} ${form.tipo_iva} %`}</span>
                  <span className="font-medium">+ {fmt(cuota)} €</span>
                </div>
                {form.aplica_recargo && <div className="flex justify-between"><span className="text-muted-foreground">Recargo de equivalencia {form.tipo_recargo} %</span><span className="font-medium">+ {fmt(recargoImporte)} €</span></div>}
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

        {saveNotice && <p className="text-sm text-amber-900 bg-amber-50 rounded-lg px-3 py-2 mt-3">{saveNotice}</p>}
        {saveError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-3">{saveError}</p>
        )}

        <div className="flex justify-end gap-3 mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">
            {saving ? 'Guardando...' : form.tipo === 'emitida' ? 'Guardar para revisión fiscal' : 'Guardar recibida para revisión'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
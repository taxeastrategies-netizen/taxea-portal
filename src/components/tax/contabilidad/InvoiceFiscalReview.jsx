import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, PencilLine, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const unwrap = response => response?.data ?? response;
const reviewError = error => error?.response?.data?.error || error?.response?.data?.message || error?.message || 'No se pudo completar la revisión fiscal.';
const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
const DEDUCTION_CATEGORIES = [
  ['interior_current', 'Operación interior corriente'], ['interior_investment', 'Operación interior · bien de inversión'],
  ['import_current', 'Importación corriente'], ['import_investment', 'Importación · bien de inversión'],
  ['intra_goods_current', 'Adquisición intracomunitaria de bienes corrientes'], ['intra_goods_investment', 'Adquisición intracomunitaria · bien de inversión'],
  ['intra_services', 'Adquisición intracomunitaria de servicios'], ['agriculture_compensation', 'Compensación agricultura, ganadería y pesca'],
  ['administrative_resolution', 'Resolución administrativa o sentencia'], ['deduction_adjustment', 'Rectificación/regularización de deducciones'],
];

async function invoke(payload) {
  const result = unwrap(await base44.functions.invoke('fiscalOperations', payload));
  if (!result || result.success === false || result.error) throw new Error(result?.error || 'No se pudo completar la revisión fiscal.');
  return result;
}

export default function InvoiceFiscalReview({ companyId, invoice, advisorAccess = false }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bundle, setBundle] = useState(/** @type {any} */ (null));
  const [catalog, setCatalog] = useState(/** @type {any} */ (null));
  const [evaluation, setEvaluation] = useState(/** @type {any} */ (null));
  const [error, setError] = useState('');
  const [canApprove, setCanApprove] = useState(false);
  const [classificationSaved, setClassificationSaved] = useState(false);
  const [form, setForm] = useState(/** @type {Record<string, any>} */ ({}));

  const activeActivities = useMemo(() => (bundle?.activities || []).filter(item => item.active !== false), [bundle]);
  const selectedActivity = activeActivities.find(item => item.id === form.activityId) || activeActivities[0];
  const taxKind = form.taxKind || selectedActivity?.indirectTax || bundle?.profile?.indirectTaxDefault || invoice.indirect_tax_kind || 'iva';
  const selectedRegime = form.regime || selectedActivity?.indirectTaxRegime || 'general';
  const specialInputs = form.specialInputs || {};

  useEffect(() => {
    if (!open) return;
    if (advisorAccess) { setCanApprove(true); return; }
    base44.auth.me().then(identity => setCanApprove(['admin', 'super_admin', 'advisor', 'asesor'].includes(String(identity?.role || '').toLowerCase()))).catch(() => setCanApprove(false));
  }, [open, advisorAccess]);

  useEffect(() => {
    if (!open || bundle) return;
    setLoading(true);
    setError('');
    Promise.all([
      invoke({ action: 'bundle', companyId, invoiceId: invoice.id }),
      invoke({ action: 'catalog', companyId }),
    ]).then(([bundleData, catalogData]) => {
      setBundle(bundleData);
      setCatalog(catalogData);
      const activity = (bundleData.activities || []).find(item => item.id === invoice.fiscal_activity_id)
        || (bundleData.activities || []).find(item => item.active !== false);
      let metadata = {}, breakdown = [];
      try { metadata = JSON.parse(invoice.recc_metadata || '{}'); breakdown = JSON.parse(invoice.tax_breakdown || '[]'); } catch { /* Documento heredado sin desglose utilizable. */ }
      const existingTaxLine = (bundleData.invoiceTaxLines || [])[0];
      setClassificationSaved(invoice.fiscal_review_status === 'validado' && invoice.accounting_migration_hold_reason === 'FISCAL_POSTING_ERROR');
      setForm({
        activityId: activity?.id || '',
        operationDate: invoice.fecha_operacion || invoice.fecha_emision,
        taxBreakdown: breakdown.length ? breakdown : undefined,
        recc: { ...metadata, eligibility: metadata.eligibility || { year: Number((invoice.fecha_operacion || invoice.fecha_emision).slice(0,4)),
          previousAnnualizedTurnover: '', previousMaxCashPerRecipient: '', newActivity: false, confirmed: false, censusOptionConfirmed: false } },
        taxKind: invoice.indirect_tax_kind || activity?.indirectTax || bundleData.profile?.indirectTaxDefault || 'iva',
        regime: existingTaxLine?.regime || invoice.fiscal_regime || activity?.indirectTaxRegime || 'general',
        operationType: invoice.fiscal_treatment || activity?.[invoice.tipo === 'recibida' ? 'expenseDefaultTreatment' : 'incomeDefaultTreatment'] || 'subject_taxed',
        base: Number(invoice.base_imponible || 0),
        taxRate: Number(invoice.tipo_iva || 0),
        taxAmount: Number(invoice.cuota_iva || 0),
        deductiblePercent: invoice.cuota_iva ? Math.round(Number(invoice.deductible_tax_amount ?? (invoice.tipo === 'recibida' ? invoice.cuota_iva : 0)) * 10000 / Number(invoice.cuota_iva)) / 100 : 0,
        deductionCategory: existingTaxLine?.deductionCategory || '',
        deductionUse: existingTaxLine?.deductionUse || '',
        withholdingRate: Number(invoice.retencion_irpf || 0),
        counterpartyIsWithholdingAgent: Boolean(invoice.retencion_irpf || invoice.importe_retencion),
        exemptionKey: invoice.fiscal_exemption_key || invoice.exemption_key || '',
        legalBasis: invoice.fiscal_legal_basis || invoice.exemption_legal_basis || '',
        specialInputs: {
          saleGross: Number(invoice.total_factura || 0),
          invoiceGross: Number(invoice.total_factura || 0),
          directCostGross: '', surchargeRate: invoice.tipo_recargo || '', consignmentIntrinsicValue: '', isExcise: false,
          destinationCountry: /^[A-Z]{2}$/.test(String(invoice.cliente_pais || '').toUpperCase()) ? String(invoice.cliente_pais).toUpperCase() : '',
          destinationRateConfirmed: false,
          groupId: bundleData.profile?.taxGroupId || '', groupRole: bundleData.profile?.taxGroupRole || '',
          payments: (bundleData.invoicePayments || []).filter(item => item.operation_status === 'committed' || !item.operation_status).map(item => ({ id: item.id, date: item.payment_date, amount: item.amount })),
        },
        manualOverride: breakdown.length > 1 || Boolean(existingTaxLine?.manualOverride || invoice.fiscal_manual_override),
        manualOverrideReason: existingTaxLine?.manualOverrideReason || invoice.fiscal_manual_override_reason || (breakdown.length > 1 ? 'Desglose de varios tipos IVA revisado por asesor' : ''),
      });
    }).catch(err => setError(reviewError(err))).finally(() => setLoading(false));
  }, [open, bundle, companyId, invoice]);

  const update = (key, value) => {
    setClassificationSaved(false);
    setForm(current => ({ ...current, [key]: value }));
    setEvaluation(null);
  };

  const updateSpecial = (key, value) => {
    setClassificationSaved(false);
    setForm(current => ({ ...current, specialInputs: { ...(current.specialInputs || {}), [key]: value } }));
    setEvaluation(null);
  };

  const payload = confirmReviewed => ({
    action: 'save_invoice_tax_line', companyId, invoiceId: invoice.id,
    ...form, taxKind, confirmReviewed,
  });

  const review = async () => {
    setSaving(true); setError('');
    try {
      const result = await invoke(payload(false));
      if (result.mode === 'saved') {
        setEvaluation(result.evaluation);
        window.dispatchEvent(new Event('financials:refresh'));
      } else setEvaluation(result.evaluation);
    } catch (err) { setError(reviewError(err)); } finally { setSaving(false); }
  };

  const confirm = async () => {
    if (form.manualOverride && !String(form.manualOverrideReason || '').trim()) {
      setError('La modificación manual requiere un motivo trazable.');
      return;
    }
    setSaving(true); setError('');
    try {
      let confirmedEvaluation = evaluation;
      if (!classificationSaved) {
        const result = await invoke(payload(true));
        confirmedEvaluation = result.evaluation;
        if (result.mode !== 'saved') throw new Error('La clasificación fiscal no quedó confirmada.');
        setClassificationSaved(true);
      }
      if (['FISCAL_ADVISOR_REVIEW_PHASE1', 'FISCAL_POSTING_ERROR'].includes(invoice.accounting_migration_hold_reason)) {
        const finalized = unwrap(await base44.functions.invoke('invoiceOperations', {
          action: 'finalize_fiscal_review', company_id: companyId, invoice_id: invoice.id,
        }));
        if (!finalized?.ok) throw new Error(finalized?.error || 'La factura quedó pendiente de contabilización. Reintenta la finalización.');
      }
      setEvaluation(confirmedEvaluation);
      window.dispatchEvent(new Event('financials:refresh'));
      setTimeout(() => setOpen(false), 650);
    } catch (err) { setError(reviewError(err)); } finally { setSaving(false); }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Revisar tratamiento fiscal"
        className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:border-cyan-300 hover:text-cyan-700">
        <PencilLine className="h-3 w-3" /> Fiscal
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-jakarta text-base font-bold text-slate-900">Tratamiento fiscal de la factura</h3>
                <p className="mt-1 text-xs text-slate-500">{invoice.numero_factura || invoice.id} · {invoice.tipo === 'recibida' ? 'recibida' : 'emitida'} · {money(invoice.total_factura)}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            {loading && <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando perfil fiscal…</div>}
            {!loading && (!bundle?.profile || !activeActivities.length) && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Antes de automatizar esta factura, valida el perfil fiscal y al menos una actividad IAE en la pestaña Perfil fiscal.</div>}
            {!loading && bundle?.profile && activeActivities.length > 0 && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-700">Actividad
                    <select value={form.activityId || ''} onChange={event => update('activityId', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                      {activeActivities.map(item => <option key={item.id} value={item.id}>{item.iaeCode ? `${item.iaeCode} · ` : ''}{item.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">Impuesto
                    <select value={taxKind} onChange={event => update('taxKind', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                      <option value="iva">IVA</option><option value="igic">IGIC</option><option value="no_aplica">No aplica</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">Régimen
                    <select value={form.regime || 'general'} onChange={event => update('regime', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                      {(catalog?.regimes?.[taxKind] || []).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">Tipo de operación
                    <select value={form.operationType || 'subject_taxed'} onChange={event => update('operationType', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                      {(catalog?.operations || []).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">Base imponible
                    <input type="number" step="0.01" value={form.base ?? 0} onChange={event => update('base', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                  <label className="text-xs font-medium text-slate-700">Tipo (%)
                    <input type="number" step="0.01" value={form.taxRate ?? 0} onChange={event => update('taxRate', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                  {['rebu', 'agencias_viajes'].includes(selectedRegime) && invoice.tipo === 'emitida' && <div className="sm:col-span-2 rounded-xl border border-cyan-200 bg-cyan-50 p-3 space-y-2">
                    <p className="text-xs font-bold text-cyan-900">Cálculo interno del margen · propuesta para el asesor</p>
                    <p className="text-[11px] text-cyan-800">El precio total al cliente incluye el impuesto; la cuota calculada no se desglosa en la factura. Debe vincularse la compra o los servicios directos antes de contabilizar.</p>
                    <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs">Precio total al cliente (€)<input type="number" step="0.01" value={specialInputs.saleGross ?? ''} onChange={event => updateSpecial('saleGross', event.target.value)} className="mt-1 w-full rounded-lg border border-cyan-200 px-3 py-2" /></label><label className="text-xs">{selectedRegime === 'rebu' ? 'Adquisición del bien' : 'Costes directos del viaje'} (€)<input type="number" step="0.01" value={specialInputs.directCostGross ?? ''} onChange={event => updateSpecial('directCostGross', event.target.value)} className="mt-1 w-full rounded-lg border border-cyan-200 px-3 py-2" /></label></div>
                  </div>}
                  {Number(invoice.cuota_recargo || 0) !== 0 && <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">El documento incluye recargo de equivalencia {money(invoice.cuota_recargo)} ({invoice.tipo_recargo || 0} %). Su tratamiento depende del régimen confirmado: mayor coste para compras del minorista o IVA y recargo repercutidos para ventas a minoristas. El asesor debe revisar el desglose antes de contabilizar.</div>}
                  {selectedRegime === 'recargo_equivalencia' && invoice.tipo === 'emitida' && <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">En una venta nacional ordinaria de actividad minorista confirmada, se repercute IVA sin recargo al cliente. Tras la revisión del asesor, el IVA forma parte del ingreso contable; no se contabiliza en 477 ni se liquida en el 303 ordinario. Ventas de inmuebles y otras excepciones siguen pendientes de circuito específico.</div>}
                  {selectedRegime === 'recargo_equivalencia' && invoice.tipo === 'recibida' && <label className="text-xs font-medium text-slate-700">Recargo registrado en factura (%)<input type="number" readOnly value={invoice.tipo_recargo || 0} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /><span className="mt-1 block font-normal text-slate-500">El IVA y el recargo de esta compra son mayor coste, no IVA deducible.</span></label>}
                  {['oss_union', 'oss_exterior_union', 'ioss_importacion'].includes(selectedRegime) && invoice.tipo === 'emitida' && <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2"><label className="text-xs">Estado miembro de consumo (ISO 2 letras)<input value={specialInputs.destinationCountry || ''} maxLength={2} onChange={event => updateSpecial('destinationCountry', event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="text-xs">Tipo IVA de destino (%)<input type="number" min="0" max="100" step="0.01" value={specialInputs.destinationRate ?? ''} onChange={event => updateSpecial('destinationRate', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(specialInputs.destinationRateConfirmed)} onChange={event => updateSpecial('destinationRateConfirmed', event.target.checked)} />Tipo de IVA del país de destino confirmado por asesor</label></div>}
                  {selectedRegime === 'ioss_importacion' && invoice.tipo === 'emitida' && <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2"><label className="text-xs">Valor intrínseco del envío (€)<input type="number" min="0" step="0.01" value={specialInputs.consignmentIntrinsicValue ?? ''} onChange={event => updateSpecial('consignmentIntrinsicValue', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(specialInputs.isExcise)} onChange={event => updateSpecial('isExcise', event.target.checked)} />Mercancía sujeta a impuestos especiales</label></div>}
                  {selectedRegime === 'grupo_entidades' && <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">Grupo validado en el perfil: {bundle?.profile?.taxGroupId || 'sin identificador'} · rol: {bundle?.profile?.taxGroupRole || 'sin confirmar'}. Solo puede cambiarse en Perfil fiscal y validarse por el asesor.</div>}
                  {selectedRegime === 'criterio_caja' && <div className="sm:col-span-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 space-y-2">
                    {bundle?.invoicePaymentsTruncated && <p className="font-semibold text-red-700">El histórico de pagos supera el límite de esta vista. No se puede confirmar el cálculo hasta revisar todos los movimientos.</p>}
                    <p>Criterio de caja: {specialInputs.payments?.length || 0} cobro(s)/pago(s) confirmados. La factura se contabiliza al devengo; el IVA se liquida por cobros/pagos trazados y, como límite, el 31 de diciembre del año siguiente. No se crean cobros desde esta revisión.</p>
                    {(bundle?.invoicePayments || []).length > 0 && <div className="overflow-x-auto"><table className="min-w-full text-left text-[11px]"><thead><tr className="border-b border-indigo-200"><th className="pr-3 py-1">Fecha</th><th className="pr-3 py-1">Importe</th><th className="pr-3 py-1">Medio</th><th className="pr-3 py-1">Referencia</th><th className="py-1">Estado</th></tr></thead><tbody>{bundle.invoicePayments.map(payment => <tr key={payment.id} className="border-b border-indigo-100"><td className="pr-3 py-1">{payment.payment_date || '—'}</td><td className="pr-3 py-1">{money(payment.amount)}</td><td className="pr-3 py-1">{payment.method || '—'}</td><td className="pr-3 py-1">{payment.reference || '—'}</td><td className="py-1">{payment.operation_status || 'histórico sin estado'}</td></tr>)}</tbody></table></div>}
                  </div>}
                  {invoice.tipo === 'recibida' && selectedActivity?.deductionRight === 'prorrata_especial' && <label className="text-xs font-medium text-slate-700 sm:col-span-2">Destino del gasto · prorrata especial
                    <select value={form.deductionUse || ''} onChange={event => update('deductionUse', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                      <option value="">Seleccionar destino antes de confirmar</option>
                      <option value="exclusive_right">Exclusivo de operaciones con derecho a deducción · 100 %</option>
                      <option value="exclusive_no_right">Exclusivo de operaciones sin derecho a deducción · 0 %</option>
                      <option value="shared">Uso común · porcentaje de prorrata confirmado en la actividad</option>
                    </select>
                    <span className="mt-1 block font-normal text-slate-500">La elección queda en la línea fiscal y debe revisarla el asesor; el porcentaje general no se aplica a los gastos exclusivos.</span>
                  </label>}
                  {invoice.tipo === 'recibida' && selectedActivity?.deductionRight !== 'prorrata_especial' && <label className="text-xs font-medium text-slate-700">Cuota deducible (%)
                    <input type="number" min="0" max="100" step="0.01" value={form.deductiblePercent ?? 0} onChange={event => update('deductiblePercent', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
                  </label>}
                  {invoice.tipo === 'recibida' && taxKind === 'iva' && <label className="text-xs font-medium text-slate-700 sm:col-span-2">Clasificación anual para el modelo 390
                    <select value={form.deductionCategory || ''} onChange={event => update('deductionCategory', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                      <option value="">Propuesta automática pendiente de revisar</option>
                      {DEDUCTION_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <span className="mt-1 block font-normal text-slate-500">Permite separar correctamente operaciones corrientes, inversiones, importaciones e intracomunitarias en el resumen anual.</span>
                  </label>}
                  <label className="text-xs font-medium text-slate-700">Retención IRPF (%)
                    <input type="number" min="0" max="100" step="0.01" value={form.withholdingRate ?? 0} onChange={event => update('withholdingRate', Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                  <label className="text-xs font-medium text-slate-700">Clave de exención/no sujeción
                    <select value={form.exemptionKey || ''} onChange={event => update('exemptionKey', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
                      <option value="">No aplica / seleccionar…</option>
                      {(catalog?.exemptionKeys?.[taxKind] || []).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700 sm:col-span-2">Fundamento legal
                    <input value={form.legalBasis || ''} onChange={event => update('legalBasis', event.target.value)} placeholder="Artículo y motivo concreto revisado" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
                  </label>
                </div>
                {form.regime === 'criterio_caja' && <fieldset className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-xs">
                  <legend className="px-1 font-semibold">Control RECC del asesor</legend>
                  <label className="block">Fecha de realización de la operación<input type="date" className="mt-1 block rounded border p-2" value={form.operationDate || ''} onChange={event => update('operationDate', event.target.value)} /></label>
                  <p>La fecha determina el límite legal, no la fecha del cobro. Los anticipos requieren su propia factura y cuenta 438/407; no se duplican en la factura final.</p>
                  <label className="flex gap-2"><input type="checkbox" checked={Boolean(form.recc?.advanceConfirmed)} onChange={event => update('recc', { ...form.recc, advanceConfirmed: event.target.checked })} />Anticipos trazados, sin duplicar importes ya facturados por separado</label>
                  <label className="block">Fecha del auto de concurso (solo hechos anteriores)<input type="date" className="mt-1 block rounded border p-2" value={form.recc?.insolvencyDate || ''} onChange={event => update('recc', { ...form.recc, insolvencyDate: event.target.value })} /></label>
                  {invoice.es_rectificativa && <>
                    <label className="block">Tratamiento de la rectificación<select className="mt-1 w-full rounded border p-2" value={form.recc?.adjustmentMode || ''} onChange={event => update('recc', { ...form.recc, adjustmentMode: event.target.value })}>
                      <option value="">Seleccionar tras revisión del asesor</option><option value="price_change">Variación del precio · caja y saldo pendiente</option><option value="tax_adjustment">Ajuste de cuotas · período fiscal confirmado (arts. 89 y 114)</option></select></label>
                    <label className="block">Causa legal para el resumen anual<select className="mt-1 w-full rounded border p-2" value={form.recc?.adjustmentCause || 'other'} onChange={event => update('recc', { ...form.recc, adjustmentCause: event.target.value })}><option value="other">Descuento, devolución, impago u otra causa revisada</option><option value="insolvency">Modificación por concurso de acreedores (art. 80.3)</option></select></label>
                    <label className="block">ID de factura original RECC<input className="mt-1 w-full rounded border p-2" value={form.recc?.originalInvoiceId || ''} onChange={event => update('recc', { ...form.recc, originalInvoiceId: event.target.value })} placeholder="Identificador del documento original de esta empresa" /></label>
                    <label className="block">Fecha fiscal de la rectificación<input type="date" className="mt-1 block rounded border p-2" value={form.recc?.adjustmentDate || ''} onChange={event => update('recc', { ...form.recc, adjustmentDate: event.target.value })} /></label>
                  </>}
                  <label className="block">Motivo y referencia documental<textarea className="mt-1 w-full rounded border p-2" value={form.recc?.reason || ''} onChange={event => update('recc', { ...form.recc, reason: event.target.value })} placeholder="Auto de concurso o causa legal de rectificación, revisados por asesor" /></label>
                  <p>Elegibilidad del ejercicio {form.recc?.eligibility?.year}: información del año anterior; no se calcula desde un histórico incompleto.</p>
                  <label className="flex gap-2"><input type="checkbox" checked={Boolean(form.recc?.eligibility?.newActivity)} onChange={event => update('recc', { ...form.recc, eligibility: { ...form.recc?.eligibility, newActivity: event.target.checked } })} />Inicio de actividad sin actividad en el año anterior</label>
                  {!form.recc?.eligibility?.newActivity && <div className="grid gap-2 sm:grid-cols-2">
                    <label>Volumen anterior anualizado (€)<input type="number" min="0" className="mt-1 w-full rounded border p-2" value={form.recc?.eligibility?.previousAnnualizedTurnover ?? ''} onChange={event => update('recc', { ...form.recc, eligibility: { ...form.recc?.eligibility, previousAnnualizedTurnover: event.target.value } })} /></label>
                    <label>Máximo efectivo por destinatario (€)<input type="number" min="0" className="mt-1 w-full rounded border p-2" value={form.recc?.eligibility?.previousMaxCashPerRecipient ?? ''} onChange={event => update('recc', { ...form.recc, eligibility: { ...form.recc?.eligibility, previousMaxCashPerRecipient: event.target.value } })} /></label>
                  </div>}
                  <label className="flex gap-2"><input type="checkbox" checked={Boolean(form.recc?.eligibility?.confirmed)} onChange={event => update('recc', { ...form.recc, eligibility: { ...form.recc?.eligibility, confirmed: event.target.checked, censusOptionConfirmed: event.target.checked } })} />Confirmo requisitos, opción censal vigente y ausencia de renuncia o exclusión para esta operación</label>
                  {form.taxBreakdown?.length > 0 && <p>Desglose: {form.taxBreakdown.map(row => `${row.rate}%: base ${money(row.base)}, cuota ${money(row.quota)}`).join(' · ')}</p>}
                </fieldset>}
                <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={Boolean(form.manualOverride)} onChange={event => update('manualOverride', event.target.checked)} />Modificar manualmente la propuesta automática</label>
                {form.manualOverride && <label className="block text-xs font-medium text-slate-700">Motivo obligatorio del cambio
                  <textarea value={form.manualOverrideReason || ''} onChange={event => update('manualOverrideReason', event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2" />
                </label>}

                {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertTriangle className="h-4 w-4 flex-shrink-0" />{error}</div>}
                {evaluation && <div className={`rounded-xl border p-4 text-xs ${evaluation.reviewRequired ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                  <div className="flex items-center gap-2 font-bold">{evaluation.reviewRequired ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{evaluation.reviewRequired ? 'Revisión profesional requerida' : 'Regla fiscal coherente'}</div>
                  {evaluation.postingBlocked ? <p className="mt-2">Importes actuales del documento: {evaluation.taxKind?.toUpperCase()} {evaluation.taxRate}% · cuota registrada {money(evaluation.taxAmount)}. No representan todavía el resultado definitivo del régimen especial.</p> : <p className="mt-2">{evaluation.taxKind?.toUpperCase()} {evaluation.taxRate}% · cuota {money(evaluation.taxAmount)} · deducible {money(evaluation.deductibleTax)} · retención {money(evaluation.withholdingAmount)}</p>}
                  {evaluation.specialPreview && <div className="mt-2 rounded-lg border border-amber-300 bg-white/70 p-2"><p className="font-semibold">Desglose específico · {evaluation.postingBlocked ? 'solo simulación' : 'revisión del asesor'}</p><p className="mt-1">{evaluation.specialPreview.reason}</p>{evaluation.specialPreview.marginGross != null && <p className="mt-1">Margen bruto {money(evaluation.specialPreview.marginGross)} · base interna {money(evaluation.specialPreview.taxableBase)} · impuesto incluido en margen {money(evaluation.specialPreview.embeddedTax)}</p>}{evaluation.specialPreview.surcharge != null && <p className="mt-1">IVA compra {money(evaluation.specialPreview.vat)} · recargo {money(evaluation.specialPreview.surcharge)} · mayor coste {money(evaluation.specialPreview.purchaseCost)}</p>}{evaluation.specialPreview.events && <p className="mt-1">Reconocimientos propuestos: {evaluation.specialPreview.events.map(item => `${item.date}: base ${money(item.taxableBase)} · cuota ${money(item.taxQuota)}${item.kind === 'forced_deadline' ? ' (fecha límite)' : ''}`).join(' · ')}</p>}{evaluation.specialPreview.destinationTax != null && <p className="mt-1">{evaluation.specialPreview.destinationCountry} · impuesto destino {money(evaluation.specialPreview.destinationTax)}</p>}{evaluation.specialPreview.individualModel && <p className="mt-1">Modelo individual {evaluation.specialPreview.individualModel}{evaluation.specialPreview.aggregateModel ? ` · agregado ${evaluation.specialPreview.aggregateModel}` : ''}</p>}</div>}
                  {[...(evaluation.reasons || []), ...(evaluation.alerts || [])].map((item, index) => <p key={index} className="mt-1">· {item}</p>)}
                  <p className="mt-2 font-medium">Libros propuestos: {(evaluation.bookImpact || []).join(', ') || 'sin impacto'} · modelos orientativos: {(evaluation.modelImpact || []).join(', ') || 'revisar'}</p>
                  {evaluation.postingBlocked && <p className="mt-2 font-semibold text-red-700">Confirmación bloqueada: falta el circuito específico de este régimen. La factura y el diario no se modificarán.</p>}
                </div>}
                {canApprove ? <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={review} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Analizar propuesta</button>
                  <button type="button" onClick={confirm} disabled={saving || evaluation?.postingBlocked} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{classificationSaved ? 'Reintentar contabilización' : 'Confirmar y guardar'}</button>
                </div> : <p className="text-xs text-amber-800">Solo el asesor o administrador puede confirmar esta clasificación.</p>}
                <p className="text-[11px] leading-relaxed text-slate-400">La confirmación guarda regla, actividad, fundamento legal, usuario y versión. No presenta ningún modelo tributario.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}


import { Input } from '@/components/ui/input';
const DEDUCTIONS=[['interior_current','Interior corriente'],['interior_investment','Interior · inversión'],
  ['intra_services','Adquisición intracomunitaria de servicios'],['intra_goods_current','Adquisición intracomunitaria de bienes'],
  ['intra_goods_investment','Adquisición intracomunitaria · inversión'],['import_current','Importación corriente'],
  ['import_investment','Importación · inversión'],['agriculture_compensation','Compensación agraria'],
  ['deduction_adjustment','Rectificación de deducciones']];
export default function OcrFiscalFields({value={},onChange,context={},direction,activityId,sourceTaxRate=0,disabled=false}) {
  const activity=(context.activities || []).find(row=>row.id===activityId)
    || ((context.activities || []).length===1?context.activities[0]:null);
  const taxKind=value.taxKind || activity?.indirectTax || context.profile?.indirectTaxDefault || 'iva';
  const regime=value.regime || activity?.indirectTaxRegime || 'general';
  const noDeduction=activity?.deductionRight==='sin_derecho' || ['comerciante_minorista_igic','pequeno_empresario_igic','exenta_limitada','recargo_equivalencia','agricultura_ganaderia_pesca'].includes(regime);
  const operation=value.operationType || (direction==='gasto'?(Number(sourceTaxRate)===0?'subject_zero':'subject_taxed')
    :regime==='comerciante_minorista_igic'?'exempt_limited':activity?.incomeDefaultTreatment || 'subject_taxed');
  const update=(key,val)=>onChange({...value,[key]:val,
    ...(key==='taxKind'?{regime:'',exemptionKey:''}:{}),
    ...(key==='deductionCategory' && String(val).startsWith('intra_')?{operationType:'intra_eu_acquisition'}:{})});
  const select=(label,key,options,current)=>(
    <label className="space-y-1 text-xs"><span>{label}</span><select disabled={disabled} value={current ?? value[key] ?? ''}
      onChange={event=>update(key,event.target.value)} className="w-full min-h-9 rounded-md border border-input bg-background px-2 text-xs">
      <option value="">Según actividad / seleccionar</option>{options.map(([code,title])=><option key={code} value={code}>{title}</option>)}
    </select></label>);
  return <fieldset disabled={disabled} className="rounded-xl border border-teal/25 bg-teal/5 p-3 space-y-3">
    <legend className="px-1 text-sm font-semibold">Criterio fiscal · único check</legend>
    <p className="text-xs text-muted-foreground">Revisa aquí el impuesto, la deducción y la cuenta contable. Aprobar registra la factura, el libro y su asiento; no hay otra revisión posterior.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {select('Impuesto','taxKind',[['iva','IVA'],['igic','IGIC'],['no_aplica','No aplica']],taxKind)}
      {select('Régimen','regime',context.regimes?.[taxKind] || [[regime,regime]],regime)}
      {select('Tipo de operación','operationType',context.operations || [['subject_taxed','Sujeta y no exenta'],['subject_zero','Tipo cero'],['exempt_limited','Exenta sin derecho a deducción'],['non_subject_location','No sujeta por localización'],['reverse_charge','Inversión del sujeto pasivo'],['intra_eu_acquisition','Adquisición intracomunitaria']],operation)}
      {direction==='gasto' && <label className="space-y-1 text-xs"><span>Cuota deducible (%)</span><Input type="number" min="0" max="100" step="0.01"
        value={value.deductiblePercent ?? (noDeduction?0:activity?.proRataPercent ?? 100)} onChange={e=>update('deductiblePercent',e.target.value)} className="h-9" /></label>}
      {direction==='gasto' && select('Clasificación del gasto','deductionCategory',DEDUCTIONS)}
      {direction==='gasto' && select('Destino · prorrata especial','deductionUse',[['exclusive_right','Exclusivo con derecho'],['exclusive_no_right','Exclusivo sin derecho'],['shared','Común / compartido']])}
      {direction==='gasto' && ['reverse_charge','intra_eu_acquisition'].includes(operation) && <label className="space-y-1 text-xs"><span>Tipo de autorrepercusión (%) · distinto del impuesto del proveedor</span><Input type="number" min="0.01" max="100" step="0.01" value={value.selfAssessmentRate ?? value.taxRate ?? ''} onChange={e=>update('selfAssessmentRate',e.target.value)} /></label>}
      {select('Clave de exención / no sujeción','exemptionKey',(context.exemptionKeys?.[taxKind] || []).map(row=>[row[0],row[1]]),value.exemptionKey || activity?.exemptionKey || '')}
      <label className="space-y-1 text-xs sm:col-span-2"><span>Fundamento legal / motivo</span><Input value={value.legalBasis ?? activity?.exemptionLegalBasis ?? ''} onChange={e=>update('legalBasis',e.target.value)} placeholder="Artículo o motivo concreto, cuando corresponda" /></label>
      <label className="space-y-1 text-xs sm:col-span-2"><span>Observaciones del criterio (opcional)</span><Input value={value.manualOverrideReason || ''} onChange={e=>update('manualOverrideReason',e.target.value)} placeholder="Criterio del asesor para esta factura, sin cambiar el perfil de la empresa" /></label>
    </div>
    {direction==='gasto' && noDeduction && <p className="text-xs text-amber-800">La cuota soportada se conserva en la factura y aumenta el gasto cuando no sea deducible. No se elimina ni se suma dos veces.</p>}
  </fieldset>;
}

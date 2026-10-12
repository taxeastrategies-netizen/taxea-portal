import { Input } from '@/components/ui/input';
const DEDUCTIONS=[['interior_current','Interior corriente'],['interior_investment','Interior · inversión'],
  ['intra_services','Adquisición intracomunitaria de servicios'],['intra_goods_current','Adquisición intracomunitaria de bienes'],
  ['intra_goods_investment','Adquisición intracomunitaria · inversión'],['import_current','Importación corriente'],
  ['import_investment','Importación · inversión'],['agriculture_compensation','Compensación agraria'],
  ['deduction_adjustment','Rectificación de deducciones']];
/** @param {{value?: Record<string, any>, onChange: Function, context?: any, direction: string, activityId?: string, sourceTaxRate?: number, disabled?: boolean}} props */
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
    ...(key==='deductionUse'?{deductiblePercent:val==='exclusive_right'?100:val==='exclusive_no_right'?0:Number(activity?.proRataPercent || 0)}:{}),
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
    {regime==='criterio_caja' && <details className="rounded-lg border bg-background p-3 text-xs">
      <summary className="cursor-pointer font-medium">Datos RECC · anticipos, rectificativas y requisitos</summary>
      <div className="mt-3 space-y-3">
        <label className="block">Fecha de realización de la operación<Input type="date" value={value.operationDate || ''} onChange={e=>update('operationDate',e.target.value)} /></label>
        <label className="block">Tipo de documento<select className="w-full rounded border p-2" value={value.recc?.documentKind || 'ordinary'}
          onChange={e=>update('recc',{...value.recc,documentKind:e.target.value})}>
          <option value="ordinary">Factura ordinaria</option><option value="advance">Anticipo · 438/407</option><option value="final">Factura final · saldo después de anticipos</option></select></label>
        {value.recc?.documentKind==='final' && <>
          <label className="block">Base total antes de los anticipos<Input type="number" step="0.01" value={value.recc?.finalOperationBase || ''} onChange={e=>update('recc',{...value.recc,finalOperationBase:e.target.value})}/></label>
          <p>Vincula los anticipos por ID de factura y base aplicada. El servidor verifica titular, tercero, saldo y contabilización: no se duplica el IVA.</p>
          {(value.recc?.advanceAllocations || []).map((row,index)=><div key={index} className="flex gap-2">
            <Input aria-label="ID de anticipo" value={row.invoiceId || ''} onChange={e=>update('recc',{...value.recc,advanceAllocations:value.recc.advanceAllocations.map((item,i)=>i===index?{...item,invoiceId:e.target.value}:item)})}/>
            <Input aria-label="Base aplicada" type="number" step="0.01" value={row.base || ''} onChange={e=>update('recc',{...value.recc,advanceAllocations:value.recc.advanceAllocations.map((item,i)=>i===index?{...item,base:e.target.value}:item)})}/>
            <button type="button" onClick={()=>update('recc',{...value.recc,advanceAllocations:value.recc.advanceAllocations.filter((item,i)=>i!==index)})}>Quitar</button></div>)}
          <button type="button" className="underline" onClick={()=>update('recc',{...value.recc,advanceAllocations:[...(value.recc?.advanceAllocations || []),{invoiceId:'',base:''}]})}>Añadir anticipo</button>
        </>}
        <label className="flex gap-2"><input type="checkbox" checked={Boolean(value.recc?.advanceConfirmed)} onChange={e=>update('recc',{...value.recc,advanceConfirmed:e.target.checked})}/>Anticipos trazados, sin duplicar importes ya facturados</label>
        <label className="block">ID de factura original (solo rectificativas)<Input value={value.recc?.originalInvoiceId || ''} onChange={e=>update('recc',{...value.recc,originalInvoiceId:e.target.value})}/></label>
        <label className="block">Tratamiento de rectificación<select className="w-full rounded border p-2" value={value.recc?.adjustmentMode || ''} onChange={e=>update('recc',{...value.recc,adjustmentMode:e.target.value})}><option value="">No aplica / elegir</option><option value="price_change">Variación de precio</option><option value="tax_adjustment">Ajuste de cuotas (arts. 89 y 114)</option></select></label>
        <label className="block">Fecha fiscal de la rectificación<Input type="date" value={value.recc?.adjustmentDate || ''} onChange={e=>update('recc',{...value.recc,adjustmentDate:e.target.value})}/></label>
        <label className="block">Fecha de auto de concurso<Input type="date" value={value.recc?.insolvencyDate || ''} onChange={e=>update('recc',{...value.recc,insolvencyDate:e.target.value})}/></label>
        <label className="block">Motivo de la rectificación<Input value={value.recc?.reason || ''} onChange={e=>update('recc',{...value.recc,reason:e.target.value})}/></label>
        <label className="block">Ejercicio de los requisitos<Input type="number" value={value.recc?.eligibility?.year || ''} onChange={e=>update('recc',{...value.recc,eligibility:{...value.recc?.eligibility,year:Number(e.target.value)}})}/></label>
        <label className="flex gap-2"><input type="checkbox" checked={Boolean(value.recc?.eligibility?.newActivity)} onChange={e=>update('recc',{...value.recc,eligibility:{...value.recc?.eligibility,newActivity:e.target.checked}})}/>Inicio de actividad sin ejercicio anterior</label>
        <label className="block">Volumen anterior anualizado (€)<Input type="number" min="0" value={value.recc?.eligibility?.previousAnnualizedTurnover ?? ''} onChange={e=>update('recc',{...value.recc,eligibility:{...value.recc?.eligibility,previousAnnualizedTurnover:e.target.value}})}/></label>
        <label className="block">Máximo efectivo por destinatario (€)<Input type="number" min="0" value={value.recc?.eligibility?.previousMaxCashPerRecipient ?? ''} onChange={e=>update('recc',{...value.recc,eligibility:{...value.recc?.eligibility,previousMaxCashPerRecipient:e.target.value}})}/></label>
        <label className="flex gap-2"><input type="checkbox" checked={Boolean(value.recc?.eligibility?.confirmed)} onChange={e=>update('recc',{...value.recc,eligibility:{...value.recc?.eligibility,confirmed:e.target.checked,censusOptionConfirmed:e.target.checked}})}/>Confirmo requisitos, opción censal vigente y ausencia de exclusión</label>
      </div>
    </details>}
    {direction==='gasto' && noDeduction && <p className="text-xs text-amber-800">La cuota soportada se conserva en la factura y aumenta el gasto cuando no sea deducible. No se elimina ni se suma dos veces.</p>}
  </fieldset>;
}

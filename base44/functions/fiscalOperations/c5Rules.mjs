// C5: reglas separadas por territorio, fecha, operación y destino de la compra.
// Fuentes: LIVA 94 y 101-110; Ley 20/1991 29 y 35-43; TR IGIC 27, 70, 89-91;
// D-L canario 3/2026, art. 1. El asesor confirma el censo y los hechos.
import { fxMoney, fxRatioMoney, accountingFx } from './reccCurrency.mjs';
export class C5ValidationError extends Error { constructor(message){super(message);this.name='C5ValidationError';this.status=422;} }
export const C5_VERSION = 'taxea-c5-2026.11.02-v1';
const text = value => String(value ?? '').trim();
const amount = value => fxMoney(Number(value || 0), 1);
export const c5Percent = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new C5ValidationError('El porcentaje debe estar entre 0 y 100.');
  return n;
};
export function c5Date(value) {
  const s = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0,10) !== s) throw new C5ValidationError('Indica una fecha válida.');
  return s;
}
export function repepAt(profile, date) {
  if (!['incluido','transitorio_2026'].includes(text(profile?.repepStatus))) return false;
  const d = text(date).slice(0,10);
  // Los perfiles históricos sin fecha se mantienen protegidos, no se presume una deducción.
  return !!d && (!profile.repepEffectiveFrom || d >= profile.repepEffectiveFrom)
    && (!profile.repepEffectiveUntil || d <= profile.repepEffectiveUntil);
}
export function validateRepepProfile(profile) {
  if (!['incluido','transitorio_2026'].includes(text(profile?.repepStatus))) return null;
  if (profile.entityType !== 'autonomo' || profile.mainTerritory !== 'canarias') throw new C5ValidationError('REPEP: solo personas físicas establecidas en Canarias. No se aplica a sociedades ni entidades en atribución de rentas.');
  const from = c5Date(profile.repepEffectiveFrom);
  if (profile.repepEffectiveUntil && c5Date(profile.repepEffectiveUntil) < from) throw new C5ValidationError('El fin del REPEP no puede ser anterior a su inicio.');
  if (profile.repepCensusConfirmed !== true) throw new C5ValidationError('El asesor debe confirmar la inclusión censal y el volumen total de todas las actividades para REPEP.');
  const volume = Number(profile.repepPreviousTurnover);
  if (!Number.isFinite(volume) || volume < 0) throw new C5ValidationError('Indica el volumen total del año anterior, anualizado cuando proceda.');
  const exceptional = profile.repepStatus === 'transitorio_2026';
  const limit = Number(from.slice(0,4)) >= 2027 || exceptional ? 50000 : 30000;
  if (volume > limit) throw new C5ValidationError(`REPEP: el volumen informado supera ${limit.toLocaleString('es-ES')} euros para la fecha elegida.`);
  if (exceptional) {
    const filed = c5Date(profile.repepOptionFiledOn);
    if (from !== '2026-07-01' || filed < '2026-07-01' || filed > '2026-07-31') throw new C5ValidationError('La opción excepcional de 2026 debe presentarse del 1 al 31 de julio, con efectos el 1 de julio.');
  }
  return { from, limit, exceptional, volume };
}
export function activityAtDate(activity, date) {
  const d = text(date).slice(0,10);
  return (!activity?.startDate || d >= activity.startDate) && (!activity?.endDate || d <= activity.endDate);
}
export function c5Deduction(activity, input, regime) {
  const noRight = activity?.deductionRight === 'sin_derecho' || ['exenta_limitada','pequeno_empresario_igic','comerciante_minorista_igic','recargo_equivalencia','agricultura_ganaderia_pesca'].includes(regime);
  const right = activity?.deductionRight || 'pleno';
  const requested = input.deductiblePercent;
  const prorata = Math.ceil(c5Percent(activity?.proRataPercent ?? 100));
  const expectedOrdinary=noRight?0:['prorrata_general','limitado'].includes(right)?prorata:100;
  if(requested!=null&&!['pequeno_empresario_igic','comerciante_minorista_igic'].includes(regime)&&!['prorrata_especial','sector_diferenciado'].includes(right)&&Number(requested)!==expectedOrdinary&&!text(input.manualOverrideReason))throw new C5ValidationError('Motiva expresamente el porcentaje distinto del derecho o prorrata provisional confirmados.');
  if (noRight && requested == null) return 0;
  if (['prorrata_especial','sector_diferenciado'].includes(right)) {
    if (!['exclusive_right','exclusive_no_right','shared'].includes(input.deductionUse)) throw new C5ValidationError('Indica el destino: exclusivo con derecho, exclusivo sin derecho o común.');
    if (right === 'sector_diferenciado' && !text(activity.sectorId)) throw new C5ValidationError('La actividad necesita un sector diferenciado identificado por el asesor.');
    const expected = input.deductionUse === 'exclusive_right' ? 100 : input.deductionUse === 'exclusive_no_right' ? 0 : prorata;
    if (requested != null && Number(requested) !== expected && !input.manualOverrideReason) throw new C5ValidationError('Motiva la deducción distinta de la asignación por destino.');
    return requested != null ? c5Percent(requested) : expected;
  }
  return requested != null ? c5Percent(requested) : noRight ? 0 : ['prorrata_general','limitado'].includes(right) ? prorata : 100;
}
export function c5InvoiceRules(profile, activity, input, direction) {
  const regime = input.regime || activity.indirectTaxRegime || 'general';
  const taxKind = input.taxKind || activity.indirectTax || profile.indirectTaxDefault;
  const date = c5Date(input.operationDate);
  if (!activityAtDate(activity, date)) throw new C5ValidationError('La fecha no está dentro de la vigencia de la actividad. Selecciona su actividad histórica; no se cambia ninguna factura anterior.');
  const patch = { ...input, regime, taxKind };
  if(taxKind==='igic' && repepAt(profile,date) && !['pequeno_empresario_igic','comerciante_minorista_igic'].includes(regime))throw new C5ValidationError('El perfil REPEP está vigente en esta fecha. Selecciona su actividad/régimen REPEP o el sector minorista, o revisa el censo con el asesor.');
  if(input.c5?.volumeClass && !['with_right','without_right','exclude'].includes(input.c5.volumeClass))throw new C5ValidationError('Clasificación del volumen no admitida.');
  if(input.c5?.repepBox && !['142','143','144','145'].includes(String(input.c5.repepBox)))throw new C5ValidationError('Selecciona una casilla de volumen REPEP válida. La casilla 146 es volumen del transmitente: se informa en el modelo anual, no como una factura propia.');
  if(input.c5?.eligiblePercent!=null)c5Percent(input.c5.eligiblePercent);
  if (direction === 'gasto') patch.deductiblePercent = c5Deduction(activity, input, regime);
  if (regime === 'pequeno_empresario_igic') {
    if (taxKind !== 'igic') throw new C5ValidationError('REPEP pertenece al IGIC, no al IVA.');
    const legacy=profile.profileStatus==='validado_asesor' && /^taxea-fiscal-es-/.test(profile.ruleSetVersion||'') && profile.ruleSetVersion!=='taxea-fiscal-es-2026.11.02-c5'
      && /^taxea-fiscal-es-/.test(activity.ruleSetVersion||'') && activity.ruleSetVersion!=='taxea-fiscal-es-2026.11.02-c5' && profile.repepPreviousTurnover==null;
    // Una actividad REPEP existente puede ser confirmada por su propio emisor
    // aunque un guardado posterior del resumen censal no conserve sus campos.
    // No se cambia el censo ni se presume volumen/censo confirmado. Compras y
    // renuncias/exclusiones expresas siguen en el circuito previo.
    const issuerChoice=direction==='ingreso' && input.issuerConfirmed===true
      && activity.indirectTaxRegime===regime && activity.exemptionKey==='IGIC_REPEP'
      && profile.repepPreviousTurnover==null
      && ['','no_aplica','pendiente_confirmar'].includes(text(profile.repepStatus));
    if(legacy || issuerChoice){
      if(profile.entityType!=='autonomo'||profile.mainTerritory!=='canarias')throw new C5ValidationError('La configuración REPEP anterior no identifica una persona física establecida en Canarias. Revisión del asesor.');
      if((profile.repepEffectiveFrom && date<profile.repepEffectiveFrom)||(profile.repepEffectiveUntil && date>profile.repepEffectiveUntil))throw new C5ValidationError('La operación queda fuera de la vigencia REPEP confirmada.');
      patch.legacyCensusReviewRequired=true;
      if(issuerChoice)patch.issuerCensusReviewRequired=true;
    }else{
      validateRepepProfile(profile);
      if (!repepAt(profile,date)) throw new C5ValidationError('La operación no está dentro de la inclusión REPEP confirmada. Selecciona el régimen vigente en esa fecha.');
    }
    if (direction === 'ingreso' && ['subject_taxed','subject_zero','exempt_limited'].includes(patch.operationType || 'subject_taxed')) {
      patch.operationType = 'exempt_limited'; patch.exemptionKey ||= 'IGIC_REPEP';
      patch.legalBasis ||= 'Art. 90 del TR IGIC (DLeg 1/2025): operaciones propias exentas en REPEP.';
      patch.taxRate = 0; patch.taxAmount = 0;
    }
    if (direction === 'gasto' && Number(patch.deductiblePercent) !== 0) throw new C5ValidationError('Las cuotas devengadas durante REPEP no son deducibles, aunque se abandone el régimen posteriormente. Selecciona otra actividad solo si corresponde realmente.');
  }
  if (regime === 'comerciante_minorista_igic') {
    if (taxKind !== 'igic') throw new C5ValidationError('El comerciante minorista canario es un régimen IGIC distinto del recargo de equivalencia IVA.');
    if (direction === 'gasto' && Number(patch.deductiblePercent) !== 0) throw new C5ValidationError('La compra afecta al sector minorista sin derecho a deducción. Para otro sector selecciona su actividad.');
    if (direction === 'ingreso' && ['subject_taxed','subject_zero','exempt_limited'].includes(patch.operationType || 'subject_taxed')) {
      patch.operationType = 'exempt_limited'; patch.exemptionKey = 'IGIC_COMERCIANTE_MINORISTA';
      patch.legalBasis ||= 'Art. 27 del TR IGIC (DLeg 1/2025): entrega comercial de comerciante minorista.';
      patch.taxRate = 0; patch.taxAmount = 0;
    }
  }
  return patch;
}
export function c5SpecialPurchase(invoice, input, evaluation) {
  const details = input.c5 || {};
  if (invoice.tipo !== 'recibida') return null;
  if (details.kind === 'implicit_igic') {
    if (evaluation.taxKind !== 'igic' || evaluation.operationType !== 'exempt_limited' || evaluation.exemptionKey !== 'IGIC_COMERCIANTE_MINORISTA'
      || details.supplierRetailLegendConfirmed !== true || amount(invoice.cuota_iva) !== 0 || amount(invoice.cuota_recargo) !== 0)
      throw new C5ValidationError('Carga implícita: exige compra de bienes exenta a minorista, factura sin IGIC repercutido y mención «comerciante minorista» comprobada.');
    const rate = Number(details.underlyingRate);
    if (![0,1,3,5,7,9.5,15,20].includes(rate)) throw new C5ValidationError('Indica el tipo IGIC legal de los bienes si no estuvieran exentos.');
    const implicitQuota = fxMoney(Number(invoice.base_imponible),0.7,rate,0.01);
    const eligible = ['pequeno_empresario_igic','comerciante_minorista_igic','exenta_limitada'].includes(evaluation.regime) ? 0 : c5Percent(input.deductiblePercent ?? evaluation.deductiblePercent);
    const deductible = fxRatioMoney(implicitQuota,eligible,100);
    return { version:C5_VERSION, kind:'implicit_igic', underlyingRate:rate, implicitQuota, deductible, supplierRetailLegendConfirmed:true, legalBasis:'Art. 29.3 Ley 20/1991; art. 70.3 TR IGIC', originalSupplierQuota:0 };
  }
  if (details.kind === 'minorista_import') {
    if (evaluation.taxKind !== 'igic' || evaluation.regime !== 'comerciante_minorista_igic' || evaluation.operationType !== 'import'
      || details.forResale !== true || details.customsDocumentConfirmed !== true || !text(details.customsReference))
      throw new C5ValidationError('Recargo minorista: confirma DUA, referencia y destino de los bienes para reventa. No se aplica a inmovilizado ni a bienes ajenos a la actividad comercial.');
    const rate = Number(invoice.tipo_iva), surchargeRate = ({0:0,1:0.1,3:0.3,5:0.5,7:0.7,9.5:0.95,15:1.5,20:2})[rate];
    const aiem = Number(details.aiem || 0), taxBase = Number(details.importTaxBase ?? invoice.base_imponible);
    if (surchargeRate == null || !Number.isFinite(aiem) || !Number.isFinite(taxBase) || ((!invoice.es_rectificativa) && (taxBase < 0 || aiem < 0))) throw new C5ValidationError('Base de importación, AIEM o tipo IGIC no válidos.');
    const surcharge = fxRatioMoney(amount(taxBase + aiem),surchargeRate,100);
    if (!Number.isFinite(Number(invoice.tipo_recargo)) || Math.abs(surcharge - amount(invoice.cuota_recargo)) > 0.01 || Math.abs(Number(invoice.tipo_recargo)-surchargeRate)>.001 || Math.abs(fxRatioMoney(taxBase,rate,100)-amount(invoice.cuota_iva)) > 0.01) throw new C5ValidationError('El IGIC o recargo del documento no coincide con las bases del DUA. Corrige el documento, no se cambia su total automáticamente.');
    return { version:C5_VERSION, kind:'minorista_import', importTaxBase:taxBase, aiem, surchargeRate, surcharge, customsReference:text(details.customsReference), customsDocumentConfirmed:true, forResale:true, legalBasis:'Art. 70.1.a TR IGIC' };
  }
  return null;
}
export function c5Metadata(invoice) {
  try { const data=typeof invoice?.fiscal_c5_data === 'object' ? invoice.fiscal_c5_data : JSON.parse(invoice?.fiscal_c5_data || '{}');return data?.version===C5_VERSION?data:{}; } catch {return {};}
}
export function c5CashProvisional(line,data,bounds){
  if(!line||line.invoice?.tipo!=='recibida')return line;
  const metadata=c5Metadata(line.invoice);
  if(!['prorrata_general','prorrata_especial','sector_diferenciado'].includes(metadata.deductionRight))return line;
  const year=Number(bounds.end.slice(0,4)),scopeKey=metadata.sectorId?'sector:'+metadata.sectorId:'activity:'+line.activityId;
  const previous=(data.fiscalAdjustments || []).filter(row=>Number(row.year)===year-1 && row.kind==='prorata' && row.scopeKey===scopeKey && row.taxKind===line.taxKind && row.status==='confirmed')
    .sort((a,b)=>String(b.reviewedAt||'').localeCompare(String(a.reviewedAt||'')))[0];
  if(!previous)return line;
  if(!previous.noJournalRequired && Array.isArray(data.entries) && !data.entries.some(entry=>entry.id===previous.journalEntryId && entry.status==='confirmado' && entry.validationStatus==='CONFIRMADO'))throw new C5ValidationError('La prorrata definitiva anterior tiene un asiento pendiente de revisión. No se toma como provisional sin verificar.');
  const calculation=previous.details?.calculation;
  if(calculation?.percent==null)return line;
  const method=calculation.method,sharedPercent=c5Percent(calculation.percent),use=metadata.deductionUse||line.deductionUse;
  if(method==='special'&&!['shared','exclusive_right','exclusive_no_right'].includes(use))throw new C5ValidationError('Prorrata especial: falta el destino del gasto RECC para aplicar la prorrata provisional del año.');
  const percent=method==='special'?(use==='exclusive_right'?100:use==='exclusive_no_right'?0:sharedPercent):sharedPercent;
  const eligible=c5Percent(metadata.eligiblePercent??100),deductible=fxMoney(Number(line.quota),percent,.01,eligible,.01);
  return {...line,deductibleQuota:deductible,nonDeductibleQuota:amount(Number(line.quota)-deductible),c5Provisional:{year,percent,sourceId:'FiscalDeductionAdjustment:'+previous.id},fiscalSourceIds:[...new Set([...(line.fiscalSourceIds||[line.sourceId]),'FiscalDeductionAdjustment:'+previous.id])]};
}
export function c5RepepVolume(data, bounds, adjustments={}) {
  const fields=Object.fromEntries(['142','143','144','145','146'].map(code=>[code,{amount:0,sourceIds:[]}])),pending=[];
  let wholeYearTurnover=0,active=false;
  for(const line of data.taxLines || []){
    const invoice=line.invoice,date=text(line.date||line.operationDate||invoice?.fecha_operacion||invoice?.fecha_emision).slice(0,10);
    if(!invoice || invoice.tipo!=='emitida' || invoice.anulada || date<bounds.start || date>bounds.end || line.operationType==='outside_scope')continue;
    const metadata=c5Metadata(invoice),base=fxMoney(Number(line.base),accountingFx(invoice)),id=line.sourceId||'InvoiceTaxLine:'+line.id;
    wholeYearTurnover=amount(wholeYearTurnover+base);
    const included=typeof metadata.repepActive==='boolean'?metadata.repepActive:line.regime==='pequeno_empresario_igic'||repepAt(data.profile,date);
    if(!included)continue;active=true;
    let code=text(metadata.repepBox);
    if(code && !fields[code])throw new C5ValidationError('Casilla de volumen REPEP no admitida.');
    if(!code){
      if(metadata.repepEstablishment==='outside_canarias')code='145';
      else if(line.regime==='comerciante_minorista_igic'||line.exemptionKey==='IGIC_COMERCIANTE_MINORISTA')code='143';
      else if(['non_subject_article','non_subject_location'].includes(line.operationType))code='144';
      else if(line.exemptionKey==='IGIC_REPEP'||line.regime==='pequeno_empresario_igic')code='142';
      else pending.push({sourceId:id,base,reason:'Confirma la casilla REPEP para esta operación exenta por otra causa o realizada desde otro establecimiento.'});
    }
    if(code){fields[code].amount=amount(fields[code].amount+base);fields[code].sourceIds.push(id);}
  }
  const inherited=Number(adjustments.repepInheritedTurnover||0);
  if(!Number.isFinite(inherited)||inherited<0)throw new C5ValidationError('El volumen del transmitente debe ser un importe no negativo.');
  if(inherited){
    if(adjustments.repepInheritedConfirmed!==true||!text(adjustments.repepInheritedEvidence))throw new C5ValidationError('Casilla 146: confirma el volumen del transmitente correspondiente al patrimonio adquirido e indica la evidencia revisada. No es una factura de compra ni de venta.');
    fields['146']={amount:amount(inherited),sourceIds:['ManualAdjustment:repepInheritedTurnover']};
    wholeYearTurnover=amount(wholeYearTurnover+inherited);active=true;
  }
  const total=amount(Object.values(fields).reduce((sum,row)=>sum+row.amount,0)+pending.reduce((sum,row)=>sum+row.base,0));
  return {fields,total,pending,active,wholeYearTurnover,exceedsNextYearLimit:wholeYearTurnover>50000};
}
export function c5ProrataPercent(numerator, denominator) {
  const n = amount(numerator), d = amount(denominator);
  if (d <= 0 || n < 0 || n > d) throw new C5ValidationError('El volumen con derecho debe estar entre cero y el volumen total positivo. Revisa las exclusiones legales y rectificativas.');
  const ni=BigInt(Math.round(n*100)),di=BigInt(Math.round(d*100));
  return Number((ni*100n+di-1n)/di);
}
export function c5ProrataComparison(rows, percent) {
  const p=c5Percent(percent);
  let general=0,special=0,current=0;
  const details=rows.map(row=>{
    const quota=amount(row.eligibleQuota ?? row.quota),provisional=amount(row.deductibleQuota);
    if (!['exclusive_right','exclusive_no_right','shared'].includes(row.deductionUse)) throw new C5ValidationError('Clasifica el destino de todos los gastos para comparar prorrata general y especial.');
    const g=fxRatioMoney(quota,p,100),s=row.deductionUse==='exclusive_right'?quota:row.deductionUse==='exclusive_no_right'?0:g;
    general=amount(general+g);special=amount(special+s);current=amount(current+provisional);
    return {sourceId:row.sourceId,invoiceId:row.invoiceId,quota,provisional,general:g,special:s,use:row.deductionUse};
  });
  const gc=BigInt(Math.round(general*100)),sc=BigInt(Math.round(special*100));
  if(general<0||special<0)throw new C5ValidationError('El conjunto de cuotas elegibles del ejercicio es negativo; revisa las rectificativas antes de regularizar.');
  const mandatorySpecial=general>special && gc*100n>=sc*110n;
  return {percent:p,general,special,current,mandatorySpecial,details};
}
export function c5InvestmentAdjustment({quota,initialPercent,definitivePercent,inServiceDate,acquisitionDate=null,year,realEstate=false,disposal=null}) {
  const initial=c5Percent(initialPercent),current=c5Percent(definitivePercent),service=c5Date(inServiceDate),first=Number(service.slice(0,4)),length=realEstate?10:5;
  if (!Number.isInteger(year)||year<first||year>=first+length) throw new C5ValidationError('El ejercicio queda fuera del periodo de regularización de este bien de inversión.');
  if (Number(quota)<0 || !Number.isFinite(Number(quota))) throw new C5ValidationError('Cuota original del bien de inversión no válida.');
  if (disposal && !['taxed','exempt_no_right'].includes(disposal)) throw new C5ValidationError('Confirma el tratamiento fiscal de la transmisión del bien.');
  const effective=disposal?disposal==='taxed'?100:0:current;
  const acquisitionYear=acquisitionDate?Number(c5Date(acquisitionDate).slice(0,4)):first;
  if(acquisitionYear>first)throw new C5ValidationError('La fecha de adquisición no puede ser posterior a la puesta en servicio.');
  const years=disposal?first+length-year:year===first&&acquisitionYear===first?0:1;
  const difference=effective-initial;
  const delta=!years || (!disposal && Math.abs(difference)<=10) ? 0 : fxMoney(Number(quota),difference,years,length===5?0.002:0.001);
  return {delta,initialPercent:initial,definitivePercent:effective,periodYears:length,remainingYears:years,inServiceDate:service,firstYear:first,year,disposal};
}

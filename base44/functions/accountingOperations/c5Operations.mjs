import {C5ValidationError,C5_VERSION,c5Percent,c5Metadata,c5ProrataPercent,c5ProrataComparison,c5InvestmentAdjustment,repepAt,c5CashProvisional} from './c5Rules.mjs';
import {fxMoney,fxRatioMoney,accountingFx,invoiceCurrency,taxFx} from './reccCurrency.mjs';
import {reccMetadata,reccDate,reccSchedule,reccCorrections} from './reccRules.mjs';
import {isZeroResidualReccFinal} from './reccAdvances.mjs';
import {createCashTaxLineForPeriod} from './reccTaxLines.ts';
import {PublicAccountingError} from './publicAccountingError.mjs';
const text=v=>String(v??'').trim(),money=v=>fxMoney(Number(v||0),1);
const problem=(message,status=422)=>new PublicAccountingError(message,status);
const cashForPeriod=createCashTaxLineForPeriod({clean:text,dateOf:item=>text(item.operationDate||item.payment_date||item.fecha_operacion||item.fecha_emision||item.date),money:v=>Math.round(Number(v||0)*100)/100,isZeroResidualReccFinal,invoicePayable:i=>Math.abs(money(i.total_factura))||Math.abs(money(i.base_imponible)+money(i.cuota_iva)-money(i.importe_retencion||money(i.base_imponible)*Number(i.retencion_irpf||0)/100)),reccMetadata,reccDate,reccSchedule,reccCorrections,taxModelValidation:problem,unique:values=>[...new Set(values)],invoiceCurrency,taxFx,fxMoney});
const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}':JSON.stringify(value??null);
async function digest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(value)));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function all(entity,query){const result=[];for(let skip=0;skip<100000;skip+=500){const rows=await entity.filter(query,'id',500,skip);result.push(...rows);if(rows.length<500)return result;}throw problem('Demasiados registros: segmenta el ejercicio.');}
function volumeClass(line,invoice,override,profile){
 const metadata=c5Metadata(invoice),manual=override?.volumeClass || metadata.volumeClass;
 if(manual && !['with_right','without_right','exclude'].includes(manual))throw problem('Clasificación del volumen no admitida.');
 if(repepAt(profile,line.operationDate) && line.regime==='pequeno_empresario_igic')return manual==='exclude'?'exclude':'without_right';
 if(manual)return manual;
 if(['subject_taxed','subject_zero','exempt_full','export','intra_eu_supply','reverse_charge'].includes(line.operationType))return 'with_right';
 if(line.operationType==='exempt_limited')return 'without_right';
 return '';
}
async function buildC5AdjustmentPreview(svc,companyId,body){
 const year=Number(body.year);if(!Number.isInteger(year)||year<2000||year>2100)throw problem('Ejercicio no válido.');
 if(body.action==='c5_deduction_context'){
  const [assets,adjustments]=await Promise.all([all(svc.entities.AccountingAsset,{companyId}),all(svc.entities.FiscalDeductionAdjustment,{companyId,year})]);
  return {success:true,assets:assets.map(a=>({id:a.id,name:a.name,sourceInvoiceId:a.sourceInvoiceId})),adjustments:adjustments.map(a=>({id:a.id,kind:a.kind,status:a.status,delta:a.delta,fiscalDelta:a.fiscalDelta,journalEntryId:a.journalEntryId}))};
 }
 const [profiles,activities,invoices,taxLines,adjustments,assets,rawPayments,postingOperations,journals]=await Promise.all([
  all(svc.entities.FiscalProfile,{company_id:companyId,active:true}),all(svc.entities.FiscalActivity,{company_id:companyId}),
  all(svc.entities.Invoice,{company_id:companyId}),all(svc.entities.InvoiceTaxLine,{companyId}),
  all(svc.entities.FiscalDeductionAdjustment,{companyId,year:{$in:[year,year-1]}}),all(svc.entities.AccountingAsset,{companyId}),all(svc.entities.InvoicePayment,{company_id:companyId}),all(svc.entities.AccountingPostingOperation,{companyId}),all(svc.entities.JournalEntry,{companyId})]);
 if(profiles.length!==1||profiles[0].profileStatus!=='validado_asesor')throw problem('Debe existir un perfil fiscal único confirmado por el asesor.');
 const profile=profiles[0],activity=activities.find(a=>a.id===body.activityId);
 if(!activity||!['iva','igic'].includes(activity.indirectTax))throw problem('Selecciona una actividad IVA o IGIC de esta empresa.');
 const kind=body.kind==='investment'?'investment':'prorata',taxKind=activity.indirectTax;
 const sector=text(activity.sectorId),scopeActivities=sector?activities.filter(a=>a.indirectTax===taxKind&&a.sectorId===sector):[activity];
 const activityIds=new Set(scopeActivities.map(a=>a.id)),scopeKey=kind==='investment'?'investment:'+text(body.assetId):(sector?'sector:'+sector:'activity:'+activity.id);
 const invoicesById=new Map(invoices.map(i=>[i.id,i])),sourceRows=[];
 const normalized=taxLines.map(line=>({...line,sourceId:'InvoiceTaxLine:'+line.id,date:line.operationDate,invoice:invoicesById.get(line.invoiceId)}));
 const committed=new Map(postingOperations.map(row=>[row.id,row.status]));
 const invoicePayments=rawPayments.filter(row=>(!row.operation_status||row.operation_status==='committed')&&(!row.accounting_operation_id||committed.get(row.accounting_operation_id)==='committed'));
 const cashData={invoices,taxLines:normalized,invoicePayments,rawInvoicePayments:rawPayments,fiscalAdjustments:adjustments};
 const journalById=new Map(journals.map(row=>[row.id,row]));
 const validOriginal=invoice=>{const row=journalById.get(invoice?.linked_journal_entry_id);return row?.companyId===companyId&&row.status==='confirmado'&&row.validationStatus==='CONFIRMADO'&&row.isBalanced!==false;};
 cashData.entries=journals;
 const sources=normalized.filter(l=>activityIds.has(l.activityId)&&l.taxKind===taxKind&&(text(l.operationDate).slice(0,4)===String(year)||l.regime==='criterio_caja'&&Number(text(l.operationDate).slice(0,4))<=year));
 let target=0,fiscalTarget=0,calculation={},start=`${year}-01-01`,end=`${year}-12-31`;
 if(kind==='prorata'){
  if(!['prorrata_general','prorrata_especial','sector_diferenciado'].includes(activity.deductionRight))throw problem('Esta actividad no aplica prorrata. Los perfiles sin derecho conservan la cuota como coste.');
  if(scopeActivities.some(a=>['prorrata_general','prorrata_especial','sector_diferenciado'].includes(a.deductionRight)&&a.deductionRight!==activity.deductionRight))throw problem('Los métodos de deducción dentro del mismo sector no coinciden; revísalos antes de regularizar.');
  if(taxKind==='igic'&&year===2026&&profile.repepStatus==='transitorio_2026'&&profile.repepEffectiveFrom==='2026-07-01')end='2026-06-30';
  let numerator=0,denominator=0;const expenses=[];
  for(const line of sources){
   const invoice=invoicesById.get(line.invoiceId);if(!invoice||invoice.anulada)continue;
   if(invoice.company_id!==companyId||line.reviewStatus!=='validado'||invoice.fiscal_review_status!=='validado'||!validOriginal(invoice))throw problem('Hay una factura sin asiento y clasificación confirmados en el ámbito elegido. Revisa la incidencia del asiento de origen.');
   if(line.operationDate>end||invoice.tipo==='emitida'&&line.operationDate<start)continue;
   const metadata=c5Metadata(invoice),override=body.sourceOverrides?.[line.id]||{},fx=accountingFx(invoice);
   const sourceId='InvoiceTaxLine:'+line.id;
   const row={sourceId,invoiceId:invoice.id,journalEntryId:invoice.linked_journal_entry_id,number:invoice.numero_factura,date:line.operationDate,direction:invoice.tipo,base:fxMoney(Number(line.base),fx),quota:fxMoney(Number(line.quota),fx),deductibleQuota:fxMoney(Number(line.deductibleQuota),fx),operationType:line.operationType};
   if(line.regime==='criterio_caja'&&invoice.tipo==='recibida'){
    const cash=cashForPeriod(line,cashData,{start,end});
    if(cash.review)throw problem(cash.review.reason);
    if(!cash.line)continue;
    const fiscal=c5CashProvisional(cash.line,cashData,{start,end});
    Object.assign(row,{base:cash.line.base,quota:cash.line.quota,deductibleQuota:cash.line.deductibleQuota,fiscalProvisionalQuota:fiscal.deductibleQuota,sourceRefs:fiscal.fiscalSourceIds,recognitionDates:cash.line.cashRecognition.events.map(event=>event.date)});
   }
   if(invoice.tipo==='emitida'){
    const category=volumeClass(line,invoice,override,profile);row.volumeClass=category;
    if(category && category!=='exclude')denominator=money(denominator+row.base);
    if(category==='with_right')numerator=money(numerator+row.base);
   }else{
    const use=override.deductionUse||line.deductionUse||metadata.deductionUse;
    const eligiblePercent=Number(override.eligiblePercent??metadata.eligiblePercent??100);
    if(!Number.isFinite(eligiblePercent)||eligiblePercent<0||eligiblePercent>100)throw problem('La afectación elegible debe estar entre 0 y 100 %.');
    const quota=metadata.kind==='implicit_igic'?fxMoney(metadata.implicitQuota,fx):row.quota;
    Object.assign(row,{deductionUse:use,eligiblePercent,eligibleQuota:fxRatioMoney(quota,eligiblePercent,100)});expenses.push(row);
   }
   sourceRows.push(row);
  }
  const needsReview=sourceRows.filter(row=>row.direction==='emitida'?!row.volumeClass:!['exclusive_right','exclusive_no_right','shared'].includes(row.deductionUse));
  if(needsReview.length)return {success:true,requiresReview:true,sourceRows,activityId:activity.id,activityNames:scopeActivities.map(a=>a.name),companyId,year,kind,taxKind,start,end,delta:null,fingerprint:null,reviewMessage:`Clasifica ${needsReview.length} línea(s) en la tabla. Las decisiones se guardarán en la regularización, sin modificar las facturas.`};
  const calculatedPercent=denominator>0?c5ProrataPercent(numerator,denominator):null;
  if(body.useConfirmedPercent===true && !text(body.reason))throw problem('Indica la evidencia del porcentaje definitivo confirmado por el asesor.');
  if(calculatedPercent==null && body.useConfirmedPercent!==true)throw problem('No hay volumen suficiente para determinar la prorrata. El asesor puede informar un porcentaje definitivo motivado si la normativa del caso lo permite.');
  const percent=body.useConfirmedPercent===true?c5Percent(body.confirmedPercent):calculatedPercent,comparison=c5ProrataComparison(expenses,percent);
  const special=activity.deductionRight!=='prorrata_general'||comparison.mandatorySpecial;
  target=money((special?comparison.special:comparison.general)-comparison.current);
  const fiscalCurrent=money(expenses.reduce((sum,row)=>sum+Number(row.fiscalProvisionalQuota??row.deductibleQuota),0));
  fiscalTarget=money((special?comparison.special:comparison.general)-fiscalCurrent);
  calculation={...comparison,fiscalCurrent,numerator,denominator,calculatedPercent,percentSource:body.useConfirmedPercent===true?'advisor_confirmed':'source_turnover',start,end,method:special?'special':'general',configuredMethod:activity.deductionRight,targetAdjustment:target,fiscalTargetAdjustment:fiscalTarget,legalBasis:taxKind==='iva'?'Arts. 103-106 LIVA':'Arts. 35-39 Ley 20/1991',transitionalRepep:end==='2026-06-30'};
 }else{
  const asset=assets.find(a=>a.id===body.assetId);if(!asset||!asset.sourceInvoiceId)throw problem('Selecciona un activo de esta empresa con factura de origen.');
  const invoice=invoicesById.get(asset.sourceInvoiceId),rows=taxLines.filter(l=>l.invoiceId===asset.sourceInvoiceId&&l.taxKind===taxKind);
  if(!invoice||invoice.company_id!==companyId||invoice.anulada||invoice.tipo!=='recibida'||invoice.fiscal_review_status!=='validado'||!validOriginal(invoice)||rows.length!==1||rows[0].reviewStatus!=='validado')throw problem('El activo necesita una factura recibida, su asiento confirmado y una línea fiscal de origen inequívoca y confirmada.');
  if(body.investmentQualificationConfirmed!==true)throw problem('Confirma que cumple la definición fiscal de bien de inversión: no basta su clasificación contable como activo.');
  const line=rows[0],fx=accountingFx(invoice),quota=fxMoney(Number(line.quota),fx);
  if(quota<=0)throw problem('No existe cuota original de inversión regularizable.');
  if(body.disposal)throw problem('La transmisión de un activo requiere su factura y el límite de la cuota repercutida, no una regularización anual ordinaria.');
  if(body.initialPercent==null||body.initialPercent==='')throw problem('Confirma el porcentaje definitivo del año de adquisición; no se presume que la deducción provisional fuese definitiva.');
  const initialPercent=Number(body.initialPercent);
  if(!text(body.reason))throw problem('Motiva el porcentaje definitivo del año de adquisición y la afectación del bien.');
  calculation=c5InvestmentAdjustment({quota,initialPercent,definitivePercent:Number(body.definitivePercent),inServiceDate:asset.inServiceDate||asset.acquisitionDate,acquisitionDate:asset.acquisitionDate||invoice.fecha_operacion||invoice.fecha_emision,year,realEstate:body.realEstate===true,disposal:body.disposal||null});
  target=calculation.delta;
  fiscalTarget=target;
  sourceRows.push({sourceId:'InvoiceTaxLine:'+line.id,invoiceId:invoice.id,journalEntryId:invoice.linked_journal_entry_id,number:invoice.numero_factura,quota,initialPercent,assetId:asset.id,assetName:asset.name});
  calculation={...calculation,quota,legalBasis:taxKind==='iva'?'Arts. 107-110 LIVA':'Arts. 40-42 Ley 20/1991'};
 }
 const targetModel=taxKind==='iva'?'303':kind==='investment'&&repepAt(profile,`${year}-12-31`)?'412':profile.usesSII?'417':'420';
 const previous=adjustments.filter(a=>Number(a.year)===year&&a.scopeKey===scopeKey&&a.taxKind===taxKind&&a.kind===kind&&a.status==='confirmed');
 for(const prior of previous){if(Number(prior.delta)===0&&prior.noJournalRequired===true)continue;const journal=await svc.entities.JournalEntry.get(prior.journalEntryId);if(!journal||journal.companyId!==companyId||journal.status!=='confirmado'||journal.validationStatus!=='CONFIRMADO')throw problem('Existe una regularización anterior cuyo asiento debe revisarse antes de calcular diferencias.');}
 const alreadyPosted=money(previous.reduce((sum,a)=>sum+Number(a.delta||0),0)),fiscalAlreadyPosted=money(previous.reduce((sum,a)=>sum+Number(a.fiscalDelta??a.delta??0),0)),delta=money(target-alreadyPosted),fiscalDelta=money(fiscalTarget-fiscalAlreadyPosted);
 const basisHash=await digest({version:C5_VERSION,companyId,year,kind,taxKind,targetModel,scopeKey,calculation,sources:sourceRows});
 const needsPercentageConfirmation=kind==='prorata'&&!previous.some(row=>row.basisHash===basisHash);
 const fingerprint=await digest({basisHash,previous:previous.map(a=>[a.id,a.delta,a.fiscalDelta??a.delta,a.journalEntryId]).sort()});
 return {success:true,version:C5_VERSION,companyId,year,kind,taxKind,targetModel,activityId:activity.id,scopeKey,activityNames:scopeActivities.map(a=>a.name),start,end,calculation,sourceRows,postedAmount:alreadyPosted,fiscalAlreadyPosted,delta,fiscalDelta,basisHash,needsPercentageConfirmation,fingerprint,previous:previous.map(a=>({id:a.id,delta:a.delta,fiscalDelta:a.fiscalDelta??a.delta,journalEntryId:a.journalEntryId})),assets:assets.map(a=>({id:a.id,name:a.name,sourceInvoiceId:a.sourceInvoiceId})),requiresAdvisorConfirmation:true};
}
export async function c5AdjustmentPreview(svc,companyId,body){try{return await buildC5AdjustmentPreview(svc,companyId,body);}catch(error){if(error instanceof C5ValidationError)throw problem(error.message);throw error;}}
export async function c5AdjustmentOperation({svc,companyId,user,createJournalEntry,ensureAccount},body){
 if([user,user?.data].filter(Boolean).some(state=>state.is_deleted===true || ['eliminado','bloqueado','suspendido'].includes(text(state.status).toLowerCase()) || ['suspended','blocked','disabled','deleted'].includes(text(state.accountAccessStatus).toLowerCase())))throw problem('Acceso suspendido.',403);
 if(['c5_deduction_preview','c5_deduction_context'].includes(body.action)){
  const result=await c5AdjustmentPreview(svc,companyId,body);
  if(body.action==='c5_deduction_context'&&['admin','super_admin','asesor','advisor'].includes(text(user.role).toLowerCase())){
   const company=await svc.entities.Company.get(companyId);
   if(company?.fiscal_adjustment_lock_token)result.lock={token:company.fiscal_adjustment_lock_token,startedAt:company.fiscal_adjustment_lock_started_at,recoverable:Number.isFinite(Date.parse(company.fiscal_adjustment_lock_started_at))&&Date.now()-Date.parse(company.fiscal_adjustment_lock_started_at)>=600000};
  }
  return result;
 }
 if(!['admin','super_admin','asesor','advisor'].includes(text(user.role).toLowerCase()))throw problem('Solo el asesor o administrador confirma una regularización.',403);
 if(body.action==='c5_deduction_recover_lock'){
  const company=await svc.entities.Company.get(companyId),started=Date.parse(company.fiscal_adjustment_lock_started_at);
  if(!body.processStopped||!text(body.reason)||!body.expectedToken||body.expectedToken!==company.fiscal_adjustment_lock_token||!Number.isFinite(started)||Date.now()-started<600000)throw problem('Confirma el proceso detenido, token y motivo; espera diez minutos.');
  const result=await svc.entities.Company.updateMany({id:companyId,fiscal_adjustment_lock_token:body.expectedToken},{$set:{fiscal_adjustment_lock_token:'',fiscal_adjustment_lock_started_at:'',fiscal_adjustment_lock_recovery:{by:user.email,at:new Date().toISOString(),reason:text(body.reason)}}});
  return {success:Number(result?.updated)===1};
 }
 if(body.action!=='c5_deduction_post'||body.confirmReviewed!==true||!text(body.reason)||!text(body.expectedFingerprint))throw problem('Analiza primero y confirma el ajuste con un motivo.');
 const company=await svc.entities.Company.get(companyId),oldToken=company.fiscal_adjustment_lock_token||'';
 if(oldToken)throw problem('Otra regularización está en curso. Actualiza; no se liberan bloqueos automáticamente.',409);
 const token=crypto.randomUUID(),filter={id:companyId,$or:[{fiscal_adjustment_lock_token:''},{fiscal_adjustment_lock_token:null},{fiscal_adjustment_lock_token:{$exists:false}}]};
 const lock=await svc.entities.Company.updateMany(filter,{$set:{fiscal_adjustment_lock_token:token,fiscal_adjustment_lock_started_at:new Date().toISOString()}});
 if(Number(lock?.updated)!==1)throw problem('Otra regularización se adelantó. Actualiza.',409);
 try{
  const completed=await svc.entities.FiscalDeductionAdjustment.filter({companyId,fingerprint:body.expectedFingerprint,status:'confirmed'},'id',2);
  if(completed.length===1){const record=completed[0],journal=record.noJournalRequired?null:await svc.entities.JournalEntry.get(record.journalEntryId);if(!record.noJournalRequired&&(!journal||journal.companyId!==companyId||journal.status!=='confirmado'||journal.validationStatus!=='CONFIRMADO'))throw problem('El ajuste ya existe pero su asiento necesita revisión.',409);return {success:true,alreadyPosted:true,noChanges:true,adjustmentId:record.id,journalEntryId:record.journalEntryId,delta:0,fiscalDelta:0,year:record.year,taxKind:record.taxKind};}
  const preview=await c5AdjustmentPreview(svc,companyId,body);
  if(preview.requiresReview)throw problem(preview.reviewMessage);
  if(preview.fingerprint!==body.expectedFingerprint)throw problem('Los datos cambiaron desde el análisis. Recalcula antes de confirmar.',409);
  if(new Date().toISOString().slice(0,10)<`${preview.year}-12-31`)throw problem('El ejercicio no ha terminado. Puedes simular, pero el porcentaje definitivo y su asiento anual se confirman al cierre.');
  if(preview.delta===0&&preview.fiscalDelta===0&&!preview.needsPercentageConfirmation)return {...preview,alreadyPosted:true,noChanges:true};
  const postingKey='fiscal-deduction:'+companyId+':'+preview.fingerprint;
  const existing=await svc.entities.FiscalDeductionAdjustment.filter({companyId,fingerprint:preview.fingerprint},'id',2);
  if(existing.length>1)throw problem('Regularización duplicada pendiente de revisión; no se crea otra.',409);
  const pending=existing[0];
  const now=new Date().toISOString();
  const record=pending||await svc.entities.FiscalDeductionAdjustment.create({companyId,year:preview.year,taxKind:preview.taxKind,targetModel:preview.targetModel,kind:preview.kind,scopeKey:preview.scopeKey,activityId:preview.activityId,fingerprint:preview.fingerprint,basisHash:preview.basisHash,delta:preview.delta,fiscalDelta:preview.fiscalDelta,status:'pending',sourceIds:[...new Set(preview.sourceRows.flatMap(r=>[r.sourceId,...(r.sourceRefs||[])]))],details:{calculation:preview.calculation,sourceRows:preview.sourceRows,sourceOverrides:body.sourceOverrides||{},reason:text(body.reason)},reviewedBy:user.email,reviewedAt:now,version:C5_VERSION});
  if(preview.delta===0){const saved=await svc.entities.FiscalDeductionAdjustment.update(record.id,{status:'confirmed',noJournalRequired:true,reviewedAt:now,reviewedBy:user.email});return {...preview,adjustmentId:saved.id,noJournalRequired:true};}
  const taxCode=preview.taxKind==='igic'?'47270000':'47200000',positive=preview.delta>0,adjustCode=positive?'63910000':'63410000';
  await ensureAccount(svc,companyId,taxCode,preview.taxKind==='igic'?'H.P. IGIC soportado':'H.P. IVA soportado','activo');
  await ensureAccount(svc,companyId,adjustCode,positive?'Ajustes positivos en imposición indirecta':'Ajustes negativos en imposición indirecta',positive?'ingreso':'gasto');
  const amount=Math.abs(preview.delta),date=`${preview.year}-12-31`,description=`Regularización ${preview.kind==='investment'?'bien de inversión':'prorrata'} ${preview.taxKind.toUpperCase()} ${preview.year}`;
  const result=await createJournalEntry(svc,companyId,{date,description,type:'ajuste',source:'sistema',sourceEvent:'fiscal_deduction_c5',sourceId:record.id,postingKey,status:'confirmado',lines:[{accountCode:taxCode,debit:positive?amount:0,credit:positive?0:amount,description,sourceLineType:'impuesto'},{accountCode:adjustCode,debit:positive?0:amount,credit:positive?amount:0,description,sourceLineType:'ajuste'}]},user.email);
  const saved=await svc.entities.FiscalDeductionAdjustment.update(record.id,{status:'confirmed',journalEntryId:result.entry.id,reviewedBy:user.email,reviewedAt:now});
  return {...preview,adjustmentId:saved.id,journalEntryId:result.entry.id,entryNumber:result.entry.entryNumber,alreadyPosted:result.alreadyPosted===true};
 }finally{await svc.entities.Company.updateMany({id:companyId,fiscal_adjustment_lock_token:token},{$set:{fiscal_adjustment_lock_token:'',fiscal_adjustment_lock_started_at:''}});}
}

import {recurringCallerIdentity} from './recurringCallerIdentity.mjs';
export const RECURRING_ISSUANCE_VERSION='issued-single-check-2026.11.02-v2';
const text=v=>String(v||'').trim();
export class RecurringDomainError extends Error{constructor(message,status=409){super(message);this.status=status;}}
const problem=(message,status=409)=>new RecurringDomainError(message,status);
const money=v=>Math.round((Number(v)+Number.EPSILON)*100)/100;
export function recurringDate(value){const s=text(value);const d=new Date(s+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw problem('Revisa las fechas de la plantilla.',422);return s;}
export function recurringToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Atlantic/Canary',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function nextRecurringDate(template,date){
 const d=new Date(recurringDate(date)+'T00:00:00Z'),interval=Number(template.interval||1);if(!Number.isInteger(interval)||interval<1||interval>366)throw problem('La frecuencia de la plantilla no es válida.',422);
 const frequency=template.frequency;let result;
 if(['daily','weekly'].includes(frequency)){d.setUTCDate(d.getUTCDate()+interval*(frequency==='weekly'?7:1));result=d;}
 else if(['monthly','yearly'].includes(frequency)){const months=frequency==='yearly'?interval*12:interval;const base=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months,1));const last=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+1,0)).getUTCDate();base.setUTCDate(Math.min(frequency==='monthly'&&Number(template.dayOfMonth)>0?Number(template.dayOfMonth):d.getUTCDate(),last));result=base;}
 else throw problem('Selecciona una frecuencia válida.',422);
 const next=result.toISOString().slice(0,10);if(next<=date)throw problem('La frecuencia no permite avanzar al período siguiente.',422);return next;
}
export function recurringDueDate(template,date){const d=new Date(recurringDate(date)+'T00:00:00Z');if(template.dueDateMode==='days_after'){const n=Number(template.dueDaysAfterIssue??30);if(!Number.isInteger(n)||n<0||n>3650)throw problem('Revisa los días de vencimiento.',422);d.setUTCDate(d.getUTCDate()+n);}else if(template.dueDateMode==='fixed_day'){const day=Number(template.dueDayOfMonth||15);if(!Number.isInteger(day)||day<1||day>31)throw problem('Revisa el día de vencimiento.',422);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));}return d.toISOString().slice(0,10);}
export function recurringCriteria(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw problem('El criterio de la plantilla no es válido.',422);
 const keys=['activityId','taxKind','regime','operationType','deductiblePercent','exemptionKey','legalBasis','manualOverrideReason','deductionUse','deductionCategory','c5','taxBreakdown','accountCode'];
 const result=Object.fromEntries(keys.filter(k=>input[k]!==undefined).map(k=>[k,input[k]]));
 if(input.recc){if(input.recc.documentKind&&input.recc.documentKind!=='ordinary')throw problem('Los anticipos y facturas finales necesitan sus vínculos individuales; no se repiten como plantilla ordinaria.',422);result.recc={documentKind:'ordinary',...(input.recc.eligibility?{eligibility:input.recc.eligibility}:{}),...(input.recc.fxQuotes?{fxQuotes:input.recc.fxQuotes}:{} )};}
 if(JSON.stringify(result).length>12000)throw problem('El criterio de la plantilla excede el tamaño admitido.',422);return result;
}
export async function recurringScope(svc,user,templateId,companyId,authorize){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(text(templateId)))throw problem('Selecciona una plantilla válida.',400);
 const identity=await recurringCallerIdentity(user,id=>svc.entities.User.get(id));if(!identity.allowed)throw problem('Identidad no habilitada.',403);
 const template=await svc.entities.RecurringInvoiceTemplate.get(templateId);
 if(!template||!template.ownerAccountId||(companyId&&companyId!==template.ownerAccountId))throw problem('Plantilla no accesible en esta empresa.',403);
 const company=await svc.entities.Company.get(template.ownerAccountId);if(!company||company.activa===false)throw problem('La empresa no está habilitada para emitir.',403);
 if(!identity.isService)await authorize(svc,identity.freshUser,template.ownerAccountId,company);
 return {template,company,companyId:template.ownerAccountId,identity};
}
export function assertRecurringInvoice(invoice,scope){const t=scope.template;if(!invoice||invoice.company_id!==scope.companyId||invoice.tipo!=='emitida'||!invoice.isRecurringGenerated||invoice.recurringInvoiceTemplateId!==t.id||!invoice.recurringPeriodStart||!invoice.recurringPeriodEnd||invoice.recurringPeriodKey!==`${t.id}_${invoice.recurringPeriodStart}_${invoice.recurringPeriodEnd}`)throw problem('La factura no corresponde a esta plantilla y empresa.',403);if(invoice.anulada)throw problem('La factura de este período está anulada; no se reutiliza su número ni se emite otra automáticamente.');return invoice;}
async function nextNumber(svc,companyId,year){let max=0;const pattern=new RegExp('^F-'+year+'-(\\d+)$');for(let skip=0;skip<100000;skip+=500){const page=await svc.entities.Invoice.filter({company_id:companyId,tipo:'emitida'},'id',500,skip);for(const row of page){const m=pattern.exec(text(row.numero_factura));if(m){const n=Number(m[1]);if(!Number.isSafeInteger(n))throw problem('La numeración supera el rango admitido.',422);max=Math.max(max,n);}}if(page.length<500)return `F-${year}-${max+1}`;}throw problem('La numeración requiere una consulta segmentada; no se emitirá con una lista truncada.',422);}
export async function issueRecurringInvoice({base44,user,body,authorize,acquireLease,buildPayload,complete}){
 const svc=base44.asServiceRole,scope=await recurringScope(svc,user,body.template_id,body.company_id,authorize),template=scope.template;
 if(!body.generation_token||template.generation_lock_token!==body.generation_token)throw problem('La generación no tiene una reserva activa. Reintenta desde la plantilla.');
 const start=recurringDate(body.period_start),end=nextRecurringDate(template,start);if(body.period_end!==end)throw problem('El período no coincide con la frecuencia guardada.',422);
 if(start>recurringToday())throw problem('El período todavía no está disponible para emitir.',422);
 const periodKey=`${template.id}_${start}_${end}`,release=await acquireLease(svc,scope.companyId);
 try{
  const fresh=await svc.entities.RecurringInvoiceTemplate.get(template.id);if(fresh?.generation_lock_token!==body.generation_token)throw problem('La reserva de generación cambió. Se conserva la factura existente.');
  if(fresh.ownerAccountId!==scope.companyId||nextRecurringDate(fresh,start)!==end)throw problem('La plantilla cambió durante la generación. Actualiza antes de emitir.');Object.assign(template,fresh);
  const existing=await svc.entities.Invoice.filter({company_id:scope.companyId,recurringInvoiceTemplateId:template.id,recurringPeriodKey:periodKey},'id',3);
  if(existing.length>1)throw problem('Hay varias facturas previas para este período. No se creará otra.');
  let invoice=existing[0],criteria;
  if(invoice){assertRecurringInvoice(invoice,scope);try{const stored=JSON.parse(invoice.fiscalAssessment||'{}');criteria=stored.source==='recurring_single_check'?recurringCriteria(stored.criteria):null;}catch{throw problem('El criterio guardado de esta emisión no puede recuperarse.',422);}criteria ||= recurringCriteria(template.fiscalCriteria||{});}
  else{
   if(template.status!=='active')throw problem('La plantilla no está activa.',409);
   const cursor=recurringDate(template.nextRunDate||template.startDate);if(start!==cursor||start<template.startDate||template.endDate&&start>template.endDate)throw problem('El período cambió o queda fuera de la vigencia de la plantilla. Actualiza antes de emitir.');
   if(!text(template.clientName)||!text(template.clientNif)||!text(template.concept))throw problem('Completa cliente, identificación y concepto antes de emitir.',422);
   const base=money(template.baseAmount),rate=Number(template.taxRate||0),retention=Number(template.retentionRate||0);
   if(!Number.isFinite(base)||base<=0||!Number.isFinite(rate)||rate<0||rate>100||!Number.isFinite(retention)||retention<0||retention>100)throw problem('Revisa los importes de la plantilla.',422);
   criteria=recurringCriteria(template.fiscalCriteria||{});criteria.activityId=template.fiscalActivityId||criteria.activityId;
   let quota=money(base*rate/100);
   if(criteria.taxBreakdown){
    if(!Array.isArray(criteria.taxBreakdown)||!criteria.taxBreakdown.length||criteria.taxBreakdown.length>12)throw problem('Revisa el desglose de impuestos guardado.',422);
    const rows=criteria.taxBreakdown.map(row=>({base:money(row.base),rate:Number(row.rate),quota:money(row.quota)}));
    if(rows.some(row=>!Number.isFinite(row.base)||row.base<0||!Number.isFinite(row.rate)||row.rate<0||row.rate>100||!Number.isFinite(row.quota)||Math.abs(row.quota-money(row.base*row.rate/100))>.01)||Math.abs(money(rows.reduce((sum,row)=>sum+row.base,0))-base)>.01)throw problem('El desglose no coincide con la base de la plantilla.',422);
    criteria.taxBreakdown=rows;quota=money(rows.reduce((sum,row)=>sum+row.quota,0));
   }
   const withheld=money(base*retention/100),total=money(base+quota-withheld);
   const number=await nextNumber(svc,scope.companyId,Number(start.slice(0,4)));
   const payload=buildPayload({tipo:'emitida',numero_factura:number,fecha_emision:start,fecha_operacion:start,fecha_vencimiento:recurringDueDate(template,start),cliente_nombre:template.clientName,cliente_nif:template.clientNif,cliente_email:template.clientEmail||'',cliente_direccion:template.clientAddress||'',concepto:template.concept,base_imponible:base,tipo_iva:rate,cuota_iva:quota,retencion_irpf:retention,importe_retencion:withheld,total_factura:total,moneda:template.currency||'EUR',fiscal_activity_id:criteria.activityId,...(criteria.taxBreakdown?{tax_breakdown:JSON.stringify(criteria.taxBreakdown)}:{}),forma_pago:template.formaPago||'Transferencia bancaria',coletilla_fiscal:template.coletillaFiscal||'',origin:'recurring_invoice'},scope.companyId,user,criteria);
   const hashBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([payload,criteria])));
   const sourceHash=Array.from(new Uint8Array(hashBytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
   invoice=await svc.entities.Invoice.create({...payload,isRecurringGenerated:true,recurringInvoiceTemplateId:template.id,recurringPeriodStart:start,recurringPeriodEnd:end,recurringPeriodKey:periodKey,creation_idempotency_key:'recurring:'+periodKey,source_hash:sourceHash,fiscal_review_status:'pendiente_revision',accounting_migration_hold:true,accounting_migration_hold_reason:'SOURCE_CHECK_PENDING',fiscalAssessment:JSON.stringify({source:'recurring_single_check',version:RECURRING_ISSUANCE_VERSION,templateId:template.id,periodKey,criteria})});
  }
  const result=await complete(invoice,criteria);
  if(!result?.ok||result.invoice?.estado_contable!=='contabilizada'||!result.journalEntryId||!result.invoice.qr_url||!result.invoice.qr_integrity_hash)throw problem('La emisión no está completa; se conserva la misma factura para reintentar.',503);
  return {...result,issuance_version:RECURRING_ISSUANCE_VERSION,recurringPeriodKey:periodKey,recovered:!!existing[0]};
 }finally{await release();}
}

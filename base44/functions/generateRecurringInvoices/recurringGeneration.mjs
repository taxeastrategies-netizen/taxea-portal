import{nextRecurringDate,recurringDate,recurringToday,RECURRING_ISSUANCE_VERSION,RecurringDomainError}from'./recurringIssuance.mjs';
const error=(text,status=409)=>new RecurringDomainError(text,status);
async function rows(entity,filter){const out=[];for(let skip=0;skip<100000;skip+=200){const page=await entity.filter(filter,'id',200,skip);out.push(...page);if(page.length<200)return out;}throw error('La lista de plantillas requiere segmentación; no se procesa una lista truncada.',422);}
async function claimTemplate(svc,id){const token=crypto.randomUUID();let result=await svc.entities.RecurringInvoiceTemplate.updateMany({id,generation_lock_token:{$in:[null,'']}},{$set:{generation_lock_token:token,generation_lock_started_at:new Date().toISOString()}});
 if(Number(result?.updated)!==1){const old=await svc.entities.RecurringInvoiceTemplate.get(id);if(old?.generation_lock_token&&Number.isFinite(Date.parse(old.generation_lock_started_at))&&Date.now()-Date.parse(old.generation_lock_started_at)>600000)result=await svc.entities.RecurringInvoiceTemplate.updateMany({id,generation_lock_token:old.generation_lock_token,generation_lock_started_at:old.generation_lock_started_at},{$set:{generation_lock_token:token,generation_lock_started_at:new Date().toISOString()}});}
 if(Number(result?.updated)!==1)throw error('Esta plantilla ya está generándose. No se ha creado otra factura.');
 return{token,release:()=>svc.entities.RecurringInvoiceTemplate.updateMany({id,generation_lock_token:token},{$set:{generation_lock_token:'',generation_lock_started_at:''}})};
}
async function saveRun(svc,template,key,payload){const previous=await svc.entities.RecurringInvoiceRun.filter({ownerAccountId:template.ownerAccountId,recurringInvoiceTemplateId:template.id,periodKey:key},'id',100);const successful=previous.find(r=>r.status==='generated');if(successful&&payload.status!=='generated')return successful;const row=successful||previous.find(r=>r.status==='draft_created')||previous.find(r=>r.status==='error')||previous[0];return row?await svc.entities.RecurringInvoiceRun.update(row.id,payload):await svc.entities.RecurringInvoiceRun.create({ownerAccountId:template.ownerAccountId,recurringInvoiceTemplateId:template.id,periodKey:key,...payload});}
export async function generateRecurringBatch({base44,user,identity,activeCompanyId,body}){
 const svc=base44.asServiceRole,preview=body.action==='preview',globalScan=identity.isService||(identity.isAdminUser&&!activeCompanyId);
 if(!globalScan&&!activeCompanyId)throw error('Selecciona una empresa antes de generar.',403);
 let templates;
 if(body.templateId){const t=await svc.entities.RecurringInvoiceTemplate.get(body.templateId);if(!t)throw error('Plantilla no encontrada.',404);if(!globalScan&&t.ownerAccountId!==activeCompanyId)throw error('La plantilla no pertenece a la empresa activa.',403);templates=[t];}
 else templates=await rows(svc.entities.RecurringInvoiceTemplate,{status:'active',...(!globalScan?{ownerAccountId:activeCompanyId}:{})});
 const today=recurringToday(),result={status:'ok',preview:[],generated:0,recovered:0,skipped:0,errors:0,drafts:0,busy:0,remaining:false,issues:[],generatedInvoiceNumber:null,issuance_version:RECURRING_ISSUANCE_VERSION};
 for(const initial of templates){let lease=null;
  try{
   if(initial.status!=='active')continue;
   if(!preview)lease=await claimTemplate(svc,initial.id);
   const template=preview?initial:await svc.entities.RecurringInvoiceTemplate.get(initial.id);if(template.ownerAccountId!==initial.ownerAccountId||template.status!=='active')throw error('La plantilla cambió. Actualiza la lista.');
   const runType=identity.isService?'scheduled':body.runType||'manual';let date=recurringDate(template.nextRunDate||template.startDate),processed=0;
   if(template.endDate&&date>template.endDate){if(!preview)await svc.entities.RecurringInvoiceTemplate.updateMany({id:template.id,generation_lock_token:lease.token},{$set:{status:'finished'}});continue;}
   while(date<=today&&(!template.endDate||date<=template.endDate)&&processed<8){
    const end=nextRecurringDate(template,date),key=`${template.id}_${date}_${end}`;
    const existing=await svc.entities.Invoice.filter({company_id:template.ownerAccountId,recurringInvoiceTemplateId:template.id,recurringPeriodKey:key},'id',3);
    if(existing.length>1)throw error('Este período tiene varias facturas anteriores. No se emitirá otra.');
    if(preview){result.preview.push({templateId:template.id,clientName:template.clientName,concept:template.concept,frequency:template.frequency,interval:template.interval,dayOfWeek:template.dayOfWeek,dayOfMonth:template.dayOfMonth,monthOfYear:template.monthOfYear,periodStart:date,periodEnd:end,status:existing[0]?.estado_contable==='contabilizada'?'skipped_duplicate':existing.length?'recovery_required':'pending',baseAmount:template.baseAmount,totalAmount:template.totalAmount});date=end;processed++;continue;}
    if(template.mode==='draft_review'&&runType==='scheduled'){
     await saveRun(svc,template,key,{runType,status:'draft_created',runAt:new Date().toISOString(),triggeredByUserId:user.id,triggeredByEmail:user.email,periodStart:date,periodEnd:end,safeErrorMessage:'Pendiente de que el emisor pulse Generar. No se ha emitido una factura ni creado un asiento.'});result.drafts++;break;
    }
    const still=await svc.entities.RecurringInvoiceTemplate.get(template.id);if(still.generation_lock_token!==lease.token)throw error('La reserva de generación cambió. Actualiza la lista.');
    let generated;
    try{const response=await base44.asServiceRole.functions.invoke('invoiceOperations',{action:'issue_recurring_invoice',company_id:template.ownerAccountId,template_id:template.id,period_start:date,period_end:end,generation_token:lease.token});generated=response?.data||response;if(!generated?.ok||generated.invoice?.estado_contable!=='contabilizada'||!generated.journalEntryId||!generated.invoice.qr_url||!generated.invoice.qr_integrity_hash)throw error('La factura no está completa. Se conserva el mismo documento para reintentar.',503);}
    catch(failure){const status=Number(failure?.response?.status||failure?.status);const safe=[400,403,409,422].includes(status)?String(failure?.response?.data?.error||failure.message||'Revisa los datos de la plantilla.').slice(0,500):'No se pudo completar la emisión. Reintenta: se recuperará la misma factura, sin otra numeración.';const saved=await svc.entities.Invoice.filter({company_id:template.ownerAccountId,recurringInvoiceTemplateId:template.id,recurringPeriodKey:key},'id',2);await saveRun(svc,template,key,{runType,status:'error',runAt:new Date().toISOString(),triggeredByUserId:user.id,triggeredByEmail:user.email,periodStart:date,periodEnd:end,generatedInvoiceId:saved.length===1?saved[0].id:undefined,generatedInvoiceNumber:saved.length===1?saved[0].numero_factura:undefined,safeErrorMessage:safe});result.errors++;result.issues.push({templateId:template.id,periodStart:date,error:safe});result.errorDetail=safe;break;}
    await saveRun(svc,template,key,{runType,status:'generated',runAt:new Date().toISOString(),triggeredByUserId:user.id,triggeredByEmail:user.email,periodStart:date,periodEnd:end,generatedInvoiceId:generated.invoice.id,generatedInvoiceNumber:generated.invoice.numero_factura,safeErrorMessage:''});
    // Comparar token y cursor: una respuesta tardía nunca pisa el avance de otra ejecución.
    const advance=await svc.entities.RecurringInvoiceTemplate.updateMany({id:template.id,generation_lock_token:lease.token,nextRunDate:template.nextRunDate},{$set:{nextRunDate:end,lastRunDate:new Date().toISOString(),...(template.endDate&&end>template.endDate?{status:'finished'}:{})},$inc:{totalGenerated:1}});
    if(Number(advance?.updated)!==1)throw error('La factura está confirmada, pero el cursor cambió. Reintenta para recuperar el mismo período.');
    template.nextRunDate=end;
    if(existing.length){if(generated.duplicate)result.skipped++;else{result.generated++;result.recovered++;}}else result.generated++;
    result.generatedInvoiceNumber ||= generated.invoice.numero_factura;date=end;processed++;
   }
   if(date<=today&&(!template.endDate||date<=template.endDate)&&processed>=8)result.remaining=true;
  }catch(failure){const status=Number(failure?.status||failure?.response?.status);if(status===409){result.busy++;result.issues.push({templateId:initial.id,error:failure instanceof RecurringDomainError?failure.message:'Hay otra operación en curso; no se ha duplicado la factura.'});}else{result.errors++;result.issues.push({templateId:initial.id,error:failure instanceof RecurringDomainError?failure.message:'No se pudo completar esta plantilla. Reintenta para recuperar su estado.'});}}
  finally{if(lease)await lease.release();}
 }
 return result;
}

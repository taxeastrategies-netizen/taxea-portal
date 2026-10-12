import { reviewFilter, commonReviewCriteria, REVIEW_REASONS } from './advisorReview.mjs';
const clean = value => String(value || '').trim();
const fail = (message,status=409) => { throw Object.assign(new Error(message),{status}); };
const free = field => ({$or:[{[field]:{$exists:false}},{[field]:''},{[field]:null}]});
export async function fiscalReviewBatch({svc,base44,companyId,user,save},body) {
  const jobs=svc.entities.FiscalReviewBatch, chunks=svc.entities.FiscalReviewBatchChunk;
  if(body.action==='list_review_batches') return {success:true,batches:await jobs.filter({company_id:companyId},'-created_date',20)};
  if(body.action==='create_review_batch') {
    if(body.confirmReviewed!==true) fail('Confirma expresamente el criterio común.',422);
    const criteria=commonReviewCriteria(body.criteria);
    if(!criteria.activityId||!criteria.taxKind||!criteria.regime||!criteria.operationType) fail('Selecciona actividad, impuesto, régimen y operación.',422);
    const requestId=clean(body.requestId);
    if(!requestId) fail('Falta identificador de preparación.',422);
    const previous=await jobs.filter({company_id:companyId,request_id:requestId},'-created_date',2);
    if(previous.length) return {success:true,batch:previous[0]};
    const ids=Array.isArray(body.invoiceIds)?[...new Set(body.invoiceIds.map(clean))]:[];
    if(!body.allFiltered&&(!ids.length||ids.length>20000)) fail('Selecciona entre 1 y 20.000 facturas.',422);
    const query=reviewFilter(companyId,body.filters);
    if(!body.allFiltered) query.id={$in:ids};
    const snapshot=[];
    for(let offset=0;offset<=20000;offset+=500) {
      const page=await svc.entities.Invoice.filter(query,'created_date',500,offset);
      snapshot.push(...page.map(row=>({id:row.id,version:row.updated_date||row.created_date,number:row.numero_factura})));
      if(snapshot.length>20000) fail('Más de 20.000 pendientes: divide por fechas o tipo. Ninguna factura confirmada.',422);
      if(page.length<500) break;
    }
    if(!snapshot.length) fail('No quedan facturas pendientes.',422);
    if(!body.allFiltered&&snapshot.length!==ids.length) fail('La selección cambió o contiene facturas ajenas. Actualiza la bandeja.');
    const job=await jobs.create({company_id:companyId,request_id:requestId,criteria,status:'preparing',total:snapshot.length,
      processed:0,succeeded:0,failed:0,pending_accounting:0,chunk_index:0,created_by:user.email,lock_token:''});
    try {
      const manifest=[];
      for(let i=0;i<snapshot.length;i+=200) manifest.push({company_id:companyId,batch_id:job.id,chunk_index:i/200,items:snapshot.slice(i,i+200),next_index:0,outcomes:[]});
      for(let i=0;i<manifest.length;i+=25) await chunks.bulkCreate(manifest.slice(i,i+25));
      return {success:true,batch:await jobs.update(job.id,{status:'ready'})};
    } catch(error) {
      await jobs.update(job.id,{status:'failed',last_error:'Manifiesto incompleto. Ninguna factura procesada: '+error.message});
      throw error;
    }
  }
  const job=await jobs.get(clean(body.batchId));
  if(!job||job.company_id!==companyId) fail('Lote no accesible.',403);
  if(body.action==='get_review_batch') {
    const offset=Math.max(0,Number(body.resultPage)||0)*5;
    const pages=await chunks.filter({company_id:companyId,batch_id:job.id},'chunk_index',5,offset);
    return {success:true,batch:job,results:pages.flatMap(row=>row.outcomes||[]),hasMore:pages.length===5};
  }
  if(body.action==='recover_review_batch') {
    if(!body.processStopped||!clean(body.reason)||body.expectedToken!==job.lock_token||!job.lock_token
      ||Date.now()-Date.parse(job.lock_started_at)<600000) fail('Recuperación: espera 10 minutos, confirma proceso terminado e indica motivo.',422);
    const locked=await svc.entities.Invoice.filter({company_id:companyId,fiscal_review_lock_token:job.lock_token},'id',500);
    for(const row of locked) await svc.entities.Invoice.updateMany({id:row.id,company_id:companyId,fiscal_review_lock_token:job.lock_token},
      {$set:{fiscal_review_lock_token:'',fiscal_review_lock_started_at:''}});
    await jobs.updateMany({id:job.id,company_id:companyId,lock_token:job.lock_token},
      {$set:{lock_token:'',status:'paused',recovery_by:user.email,recovery_reason:clean(body.reason),recovery_at:new Date().toISOString()}});
    return {success:true,batch:await jobs.get(job.id)};
  }
  if(body.action!=='process_review_batch') fail('Acción de lote no válida.',400);
  if(['completed','failed','preparing'].includes(job.status)) return {success:true,batch:job};
  const token=crypto.randomUUID();
  const acquired=await jobs.updateMany({id:job.id,company_id:companyId,...free('lock_token')},
    {$set:{lock_token:token,lock_started_at:new Date().toISOString(),status:'running'}});
  if(Number(acquired?.updated||0)!==1) fail('El lote está ejecutándose en otra pestaña.');
  let heldInvoice='';
  try {
    const part=(await chunks.filter({company_id:companyId,batch_id:job.id,chunk_index:job.chunk_index},'chunk_index',2))[0];
    if(!part) fail('Falta un bloque del manifiesto. No se modifica ninguna factura.',422);
    const i=Number(part.next_index||0),item=part.items[i];
    if(!item) fail('Cursor de lote incoherente.',422);
    let outcome={invoice_id:item.id,number:item.number,status:'failed',message:''};
    try {
      const invoice=await svc.entities.Invoice.get(item.id);
      if(!invoice||invoice.company_id!==companyId||invoice.anulada) fail('Factura no accesible o anulada.');
      const own=invoice.fiscal_review_batch_id===job.id&&invoice.fiscal_review_status==='validado';
      if(!own&&(invoice.updated_date||invoice.created_date)!==item.version) fail('La factura cambió después de seleccionarla. Revísala de nuevo.');
      if(!own&&!REVIEW_REASONS.includes(invoice.accounting_migration_hold_reason)) fail('La factura ya no está pendiente. No se repite ni reclasifica.');
      const lock=await svc.entities.Invoice.updateMany({id:item.id,company_id:companyId,...free('fiscal_review_lock_token')},
        {$set:{fiscal_review_lock_token:token,fiscal_review_lock_started_at:new Date().toISOString()}});
      if(Number(lock?.updated||0)!==1) fail('Otra revisión está trabajando con esta factura.');
      heldInvoice=item.id;
      let saved;
      if(!own) {
        const response=await save({...job.criteria,invoiceId:item.id,confirmReviewed:true},job.id);
        saved=await response.json();
        if(!response.ok||saved.error) fail(saved.error||'No se guardó el criterio.',response.status);
      }
      if(saved?.mode==='classified_pending') outcome={...outcome,status:'pending_accounting',message:saved.warning};
      else {
        const response=await base44.functions.invoke('invoiceOperations',{action:'finalize_fiscal_review',company_id:companyId,invoice_id:item.id});
        const final=response?.data??response;
        if(!final?.ok) fail(final?.error||'Criterio guardado; contabilización pendiente. Reintenta la incidencia.');
        outcome={...outcome,status:'succeeded',message:'Confirmada y contabilizada',journal_id:final.invoice?.linked_journal_entry_id};
      }
    } catch(error) { outcome.message=error?.response?.data?.error||error.message||'Incidencia de revisión'; }
    if(heldInvoice) {
      await svc.entities.Invoice.updateMany({id:heldInvoice,company_id:companyId,fiscal_review_lock_token:token},
        {$set:{fiscal_review_lock_token:'',fiscal_review_lock_started_at:''}});
      heldInvoice='';
    }
    await chunks.update(part.id,{outcomes:[...(part.outcomes||[]),outcome],next_index:i+1});
    const allParts=await chunks.filter({company_id:companyId,batch_id:job.id},'chunk_index',101);
    const done=allParts.flatMap(row=>row.outcomes||[]);
    const batch=await jobs.update(job.id,{processed:done.length,succeeded:done.filter(row=>row.status==='succeeded').length,
      failed:done.filter(row=>row.status==='failed').length,pending_accounting:done.filter(row=>row.status==='pending_accounting').length,
      chunk_index:i+1>=part.items.length?Number(job.chunk_index)+1:Number(job.chunk_index),status:done.length>=job.total?'completed':'paused'});
    return {success:true,batch,lastResult:outcome};
  } finally {
    if(heldInvoice) await svc.entities.Invoice.updateMany({id:heldInvoice,company_id:companyId,fiscal_review_lock_token:token},
      {$set:{fiscal_review_lock_token:'',fiscal_review_lock_started_at:''}});
    await jobs.updateMany({id:job.id,company_id:companyId,lock_token:token},{$set:{lock_token:'',lock_started_at:''}});
  }
}

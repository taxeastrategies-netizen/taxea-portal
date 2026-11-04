const fail=(message,status=409)=>Object.assign(new Error(message),{status});
export async function acquirePaymentLease(svc,companyId,invoiceId,key){
 const token=crypto.randomUUID(),startedAt=new Date().toISOString();
 const claim=await svc.entities.Invoice.updateMany({id:invoiceId,company_id:companyId,anulada:{$ne:true},payment_lock_token:{$in:[null,'']}},{$set:{payment_lock_token:token,payment_lock_started_at:startedAt,payment_lock_key:String(key||'')}});
 if(Number(claim?.updated)!==1)throw fail('Hay otro cobro/pago en curso para esta factura. Espera a que termine; no se ha registrado otra operación.');
 return async()=>{const result=await svc.entities.Invoice.updateMany({id:invoiceId,company_id:companyId,payment_lock_token:token},{$set:{payment_lock_token:'',payment_lock_started_at:'',payment_lock_key:''}});if(Number(result?.updated)!==1)throw fail('El pago puede estar confirmado, pero su bloqueo necesita revisión. Consulta los pagos antes de repetir.');};
}
export async function recoverPaymentLease(svc,companyId,invoiceId,input,actor){
 const invoice=await svc.entities.Invoice.get(invoiceId);
 if(!invoice||invoice.company_id!==companyId)throw fail('Factura no accesible.',403);
 if(!invoice.payment_lock_token)return {ok:true,released:false};
 if(input.processStopped!==true||String(input.reason||'').trim().length<12||input.expectedStartedAt!==invoice.payment_lock_started_at||input.expectedKey!==invoice.payment_lock_key||!Number.isFinite(Date.parse(invoice.payment_lock_started_at))||Date.now()-Date.parse(invoice.payment_lock_started_at)<600000)
  throw fail('Espera diez minutos, confirma que el proceso terminó y documenta el motivo. El bloqueo debe coincidir con el consultado.',422);
 const audit=await svc.entities.AccountingAuditLog.create({companyId,eventType:'payment_lock_recovery',eventKey:'payment-lock:'+crypto.randomUUID(),fiscalYear:Number(String(invoice.fecha_emision||'').slice(0,4)),reason:String(input.reason).trim(),actor,occurredAt:new Date().toISOString(),beforeJson:JSON.stringify({invoiceId,startedAt:invoice.payment_lock_started_at,key:invoice.payment_lock_key}),afterJson:'{"status":"attempt_approved"}',schemaVersion:'pgc8-v1'});
 const claim=await svc.entities.Invoice.updateMany({id:invoiceId,company_id:companyId,payment_lock_token:invoice.payment_lock_token,payment_lock_started_at:invoice.payment_lock_started_at},{$set:{payment_lock_token:'',payment_lock_started_at:'',payment_lock_key:''}});
 if(Number(claim?.updated)!==1)throw fail('El bloqueo cambió durante la revisión; no se ha forzado su liberación.');
 await svc.entities.AccountingAuditLog.update(audit.id,{afterJson:JSON.stringify({status:'released',invoiceId})});
 return {ok:true,released:true};
}

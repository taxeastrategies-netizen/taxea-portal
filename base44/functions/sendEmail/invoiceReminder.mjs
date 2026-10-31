const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const result=(status,error,message)=>Response.json({error,message},{status});

// The company row already exists, so a conditional update is an atomic lease:
// no create-then-check race, no client-writable lock and no financial mutations.
export async function sendInvoiceReminder({service,user,company,invoice,connection,getConnectedEmail,buildRawMessage,toBase64Url,fetchImpl=fetch,now=Date.now}){
 if(!company?.id||!invoice||invoice.company_id!==company.id||invoice.tipo!=='emitida'||invoice.anulada||invoice.estado_cobro==='cobrada')return result(404,'invoice_unavailable','Factura no disponible para este recordatorio.');
 const recipient=String(invoice.cliente_email||'').trim().toLowerCase();
 if(!EMAIL.test(recipient)||/[\r\n]/.test(recipient))return result(400,'invoice_unavailable','La factura no tiene un destinatario válido.');
 if(!connection?.accessToken)return result(403,'gmail_not_connected','Conecta tu Gmail para enviar desde tu propio correo.');
 const sender=await getConnectedEmail(connection);
 if(!EMAIL.test(sender||'')||/[\r\n]/.test(sender))return result(502,'gmail_identity_unavailable','No se pudo identificar el buzón Gmail conectado.');
 const stamp=new Date(now()).toISOString(),dayKey=stamp.slice(0,10),minuteKey=stamp.slice(0,16);
 const token=crypto.randomUUID(),expires=now()+90_000;
 const lock=await service.entities.Company.updateMany({id:company.id,$or:[{reminder_delivery_lock_token:{$in:[null,'']}},{reminder_delivery_lock_expires_at:{$lte:now()}}]},{$set:{reminder_delivery_lock_token:token,reminder_delivery_lock_expires_at:expires}});
 if(Number(lock?.updated)!==1)return result(409,'reminder_busy','Hay un envío en curso. Espera antes de volver a intentarlo.');
 let event,dispatched=false,accepted=false;
 try{
  const usage=await service.entities.CoreIntegrationUsage.filter({companyId:company.id,dayKey,operation:'reminder'},'-created_date',500,0);
  const active=(usage||[]).filter(row=>row.status!=='error');
  if(active.some(row=>row.targetId===invoice.id))return result(409,'reminder_already_requested','Este recordatorio ya se solicitó hoy. Revisa tu carpeta Enviados.');
  if(active.length>=10||active.filter(row=>row.minuteKey===minuteKey).length>=2)return result(429,'reminder_limit','Límite temporal de recordatorios alcanzado.');
  // Reload under the lease: a payment or annulment may have arrived while waiting.
  const current=await service.entities.Invoice.get(invoice.id);
  if(!current||current.company_id!==company.id||current.tipo!=='emitida'||current.anulada||current.estado_cobro==='cobrada'||String(current.cliente_email||'').trim().toLowerCase()!==recipient)return result(409,'invoice_unavailable','La factura ha cambiado. Actualiza antes de enviar.');
  const number=String(current.numero_factura||'').replace(/[\r\n]/g,' ').slice(0,80);
  const name=String(company.nombre_comercial||company.razon_social||'').replace(/[\r\n"<>]/g,'').slice(0,100);
  const html='<p>Le recordamos que la factura <strong>'+escapeHtml(number)+'</strong> está pendiente de pago.</p><p>Fecha de vencimiento: '+escapeHtml(String(current.fecha_vencimiento||'no indicada').slice(0,20))+'</p><p>Si ya realizó el pago, ignore este aviso.</p><p>'+escapeHtml(name)+'</p>';
  const raw=buildRawMessage({from:'"'+name+'" <'+sender+'>',to:[recipient],cc:[],bcc:[],subject:'Recordatorio de pago — Factura '+number,html,attachments:[]});
  event=await service.entities.CoreIntegrationUsage.create({userId:String(user.id),companyId:company.id,dayKey,minuteKey,operation:'reminder',targetId:invoice.id,status:'reserved'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20_000);
  let response,data;
  try{
   dispatched=true;
   response=await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',redirect:'manual',signal:controller.signal,headers:{Authorization:'Bearer '+connection.accessToken,'Content-Type':'application/json'},body:JSON.stringify({raw:toBase64Url(raw)})});
   // A 4xx is an explicit rejection. A lost response, redirect or 5xx is ambiguous.
   if(response.status>=400&&response.status<500){
    await response.body?.cancel();
    await service.entities.CoreIntegrationUsage.update(event.id,{status:'error',completedAt:new Date(now()).toISOString()});
    return result(response.status===401||response.status===403?403:502,response.status===401||response.status===403?'gmail_authorization_expired':'reminder_rejected','Gmail no aceptó el recordatorio. Revisa la conexión antes de repetir.');
   }
   if(!response.ok){await response.body?.cancel();throw Error('AMBIGUOUS_PROVIDER_RESPONSE');}
   // Gmail's success payload is tiny; refuse oversized or malformed responses.
   const declared=Number(response.headers.get('content-length')||0);if(declared>32_768)throw Error('AMBIGUOUS_PROVIDER_RESPONSE');
   const reader=response.body?.getReader();let text='',size=0;
   if(reader)try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>32_768)throw Error('AMBIGUOUS_PROVIDER_RESPONSE');text+=new TextDecoder().decode(part.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   data=JSON.parse(text);if(typeof data?.id!=='string'||!data.id)throw Error('AMBIGUOUS_PROVIDER_RESPONSE');
   accepted=true;
  }finally{clearTimeout(timer);controller.abort();}
  // If persistence fails after Gmail accepted, keep the reservation. It blocks
  // automatic retries and the caller receives a truthful success with warning.
  let warning;
  try{await service.entities.CoreIntegrationUsage.update(event.id,{status:'success',completedAt:new Date(now()).toISOString()});}catch{warning='Gmail confirmó el envío, pero la trazabilidad está pendiente. No repitas el envío.';}
  return Response.json({ok:true,via:'gmail',from:sender,id:data.id,attachment_count:0,warning});
 }catch{
  // A reservation persists for the rest of the day after an ambiguous dispatch.
  // Never change invoice amounts, posting, paid state, source PDF or subaccounts.
  if(dispatched&&!accepted)return result(409,'reminder_delivery_uncertain','Gmail no confirmó el resultado. Revisa Enviados; el portal no reenviará automáticamente.');
  return result(503,'reminder_unavailable','No se pudo preparar el recordatorio. No se ha enviado.');
 }finally{
  await service.entities.Company.updateMany({id:company.id,reminder_delivery_lock_token:token},{$set:{reminder_delivery_lock_token:'',reminder_delivery_lock_expires_at:0}}).catch(()=>{});
 }
}

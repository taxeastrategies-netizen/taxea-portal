import {createClientFromRequest} from 'npm:@base44/sdk@0.8.48';
import {mercantilOperation} from './mercantilOperations.mjs';
import {storageAccountEnabled} from './storageRuntime.generated.mjs';
Deno.serve(async req=>{
 const response=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 try{
  if(req.method!=='POST')return response({error:'Método no permitido.'},405);
  const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
  if(!user?.id)return response({error:'Inicia sesión.'},401);
  if(!storageAccountEnabled(user))return response({error:'Acceso al portal suspendido.'},403);
  let bytes=0,text='',reader=req.body?.getReader();if(!reader)return response({error:'Solicitud no válida.'},400);
  const timer=setTimeout(()=>{void reader.cancel().catch(()=>{});},5000);
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>131072)return response({error:'Solicitud demasiado grande.'},413);text+=new TextDecoder().decode(part.value);}}finally{clearTimeout(timer);await reader.cancel().catch(()=>{});reader.releaseLock();}
  let body;try{body=JSON.parse(text);}catch{return response({error:'Solicitud no válida.'},400);}
  const result=await mercantilOperation(client.asServiceRole,user,body);
  return response({ok:true,result});
 }catch(error){
  const status=Number(error?.status);
  if([400,401,403,404,409,413].includes(status))return response({error:error.message},status);
  console.error('[mercantilDocumentOperations] operation_failed');
  return response({error:'No se pudo completar la operación de Mercantil.'},503);
 }
});

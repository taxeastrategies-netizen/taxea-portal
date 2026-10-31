import {createClientFromRequest} from 'npm:@base44/sdk@0.8.48';
import {knowledgeAdmin,saveKnowledge} from './knowledgePolicy.mjs';
const answer=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
Deno.serve(async req=>{
 try{
  if(req.method!=='POST')return answer({error:'Método no permitido.'},405);
  const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
  if(!user?.id)return answer({error:'Inicia sesión.'},401);
  if(!knowledgeAdmin(user))return answer({error:'Solo administración puede revisar el conocimiento compartido.'},403);
  const reader=req.body?.getReader();if(!reader)return answer({error:'Solicitud no válida.'},400);
  let size=0;const chunks=[];
  try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>49152){await reader.cancel();return answer({error:'Solicitud demasiado grande.'},413);}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const value of chunks){bytes.set(value,offset);offset+=value.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return answer({error:'Solicitud no válida.'},400);}
  const result=await saveKnowledge(client.asServiceRole,user,body);
  return answer({ok:true,result});
 }catch(error){const code=/^KNOWLEDGE_[A-Z_]+$/.test(error?.message||'')?error.message:'KNOWLEDGE_UNAVAILABLE';return answer({error:code==='KNOWLEDGE_CHANGED'?'Otra revisión ha cambiado esta respuesta. Actualiza antes de guardar.':'No se pudo guardar la respuesta revisada.',code},error?.status||400);}
});

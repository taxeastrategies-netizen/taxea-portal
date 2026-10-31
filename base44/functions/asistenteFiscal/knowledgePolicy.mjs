export const KNOWLEDGE_APPROVAL_VERSION='admin-reviewed-v1';
const id=value=>/^[A-Za-z0-9_-]{1,128}$/.test(String(value||''));
export const knowledgeAdmin=user=>!!user?.id&&['admin','super_admin'].includes(user.role)&&![user,user.data].filter(Boolean).some(s=>s.is_deleted===true||['eliminado','bloqueado','suspendido'].includes(String(s.status||'').trim().toLowerCase())||['disabled','deleted','blocked','suspended'].includes(String(s.accountAccessStatus||'').trim().toLowerCase()));
const strings={titulo:240,pregunta_tipo:2000,respuesta:16000,nota_interna:4000};
const taxes=['irpf','iva','igic','sociedades','facturacion','gastos_deducibles','modelos','retenciones','general','otro'];
export function normalizeKnowledge(input,current={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('KNOWLEDGE_INVALID');
 const result={};
 for(const[key,max]of Object.entries(strings)){const value=input[key]??current[key]??'';if(typeof value!=='string'||value.length>max)throw Error('KNOWLEDGE_INVALID');result[key]=value.trim();}
 if(!result.titulo||!result.pregunta_tipo||!result.respuesta)throw Error('KNOWLEDGE_REQUIRED');
 const words=input.palabras_clave??current.palabras_clave??[];
 if(!Array.isArray(words)||words.length>50||words.some(x=>typeof x!=='string'||x.length>160))throw Error('KNOWLEDGE_INVALID');
 result.palabras_clave=[...new Set(words.map(x=>x.trim()).filter(Boolean))];
 result.nivel_riesgo=input.nivel_riesgo??current.nivel_riesgo??'verde';result.impuesto=input.impuesto??current.impuesto??'general';
 if(!['verde','amarillo','rojo'].includes(result.nivel_riesgo)||!taxes.includes(result.impuesto))throw Error('KNOWLEDGE_INVALID');
 for(const key of ['activa','aprobada']){const value=input[key]??current[key]??(key==='activa');if(typeof value!=='boolean')throw Error('KNOWLEDGE_INVALID');result[key]=value;}
 return result;
}
export async function knowledgeDigest(row){
 const data=JSON.stringify([row.titulo,row.pregunta_tipo,row.respuesta,row.palabras_clave,row.nivel_riesgo,row.impuesto,row.activa,row.aprobada]);
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export async function trustedKnowledge(row){
 try{if(row?.approval_version!==KNOWLEDGE_APPROVAL_VERSION||!id(row.approved_by_admin_id)||!Number.isFinite(Date.parse(row.approved_at||''))||!row.aprobada||!row.activa||!/^[a-f0-9]{64}$/.test(row.approval_sha256||''))return false;return await knowledgeDigest(normalizeKnowledge(row))===row.approval_sha256;}catch{return false;}
}
export async function saveKnowledge(service,user,body){
 if(!knowledgeAdmin(user))throw Object.assign(Error('KNOWLEDGE_ADMIN_ONLY'),{status:403});
 if(body?.action!=='save')throw Object.assign(Error('KNOWLEDGE_INVALID_ACTION'),{status:400});
 let current;
 if(body.id){if(!id(body.id))throw Object.assign(Error('KNOWLEDGE_INVALID'),{status:400});current=await service.entities.AIRespuestaBase.get(body.id).catch(()=>null);if(!current)throw Object.assign(Error('KNOWLEDGE_UNAVAILABLE'),{status:404});if(String(body.expectedRevision||'')!==String(current.approval_revision||''))throw Object.assign(Error('KNOWLEDGE_CHANGED'),{status:409});}
 const data=normalizeKnowledge(body.data,current);
 Object.assign(data,{approval_revision:crypto.randomUUID()},data.aprobada?{approval_version:KNOWLEDGE_APPROVAL_VERSION,approved_by_admin_id:user.id,approved_at:new Date().toISOString(),approval_sha256:await knowledgeDigest(data)}:{approval_version:'',approved_by_admin_id:'',approved_at:'',approval_sha256:''});
 if(!current){data.creada_por=user.email;return service.entities.AIRespuestaBase.create(data);}
 const update=await service.entities.AIRespuestaBase.updateMany({id:current.id,approval_revision:current.approval_revision||{$in:[null,'']}},{$set:data});
 if(Number(update?.updated)!==1)throw Object.assign(Error('KNOWLEDGE_CHANGED'),{status:409});
 return service.entities.AIRespuestaBase.get(current.id);
}

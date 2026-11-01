import{privateDocumentId}from'./documentClient.mjs';
import{normalizeLegacyDocumentReference}from'./nativeDocumentReference.mjs';
export function safeDisplayDocumentReference(value){
 if(!value)return'';if(typeof value!=='string')return'';const text=value.trim();
 if(privateDocumentId(text))return text;const native=normalizeLegacyDocumentReference(text);if(native)return /^mp\//.test(text)?native:text;
 try{const u=new URL(text);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!['base44.app','media.base44.com','taxeaportal.com'].includes(u.hostname))return text;const origin=globalThis.location?.origin||'https://taxeaportal.com',prefix='blob:'+origin+'/';if(u.protocol==='blob:'&&origin.startsWith('https:')&&u.origin===origin&&text.startsWith(prefix)&&/^[A-Za-z0-9-]+$/.test(text.slice(prefix.length)))return text;}catch{}
 return'';
}
export function createLegacyReferenceClient(api,onSessionCleanup){
 const cache=new Map(),pending=new Map();let epoch=0,queued=false,groups=new Map();
 const sessionError=()=>new Error('La sesión ha cambiado. Vuelve a abrir el documento.');
 const clear=()=>{epoch++;cache.clear();for(const item of pending.values())item.reject(sessionError());pending.clear();groups.clear();};onSessionCleanup?.(clear);
 const finish=(item,error,value)=>{if(pending.get(item.key)===item)pending.delete(item.key);if(item.epoch!==epoch)return item.reject(sessionError());if(error)return item.reject(error);cache.set(item.key,{value,expiresAt:Date.now()+(privateDocumentId(value)?60000:5000)});while(cache.size>1000)cache.delete(cache.keys().next().value);item.resolve(value);};
 const flush=async()=>{
  queued=false;const current=groups;groups=new Map();
  for(const list of current.values()){
   let at=0;
   while(at<list.length){
    const batch=[];const scope=list[at].scope;
    while(at<list.length&&batch.length<20){const candidate=[...batch,list[at]],body={action:'resolve_legacy_references',mappingVersion:2,...scope,references:candidate.map(item=>item.reference)};if(new TextEncoder().encode(JSON.stringify(body)).length>14500){if(!batch.length){finish(list[at++],new Error('La referencia del archivo es demasiado larga.'));}break;}batch.push(list[at++]);}
    if(!batch.length)continue;
    try{
     if(batch.some(item=>item.epoch!==epoch))throw sessionError();
     const response=await api.functions.invoke('documentStorage',{action:'resolve_legacy_references',mappingVersion:2,...scope,references:batch.map(item=>item.reference)}),data=response?.data??response;
     if(data?.ok!==true||!Array.isArray(data.mappings)||data.mappings.length!==batch.length)throw Error('No se pudo verificar el acceso al documento.');
     const results=new Map();for(const row of data.mappings){if(!Number.isInteger(row.index)||row.index<0||row.index>=batch.length||results.has(row.index)||![true,false].includes(row.mapped)||(row.mapped&&!privateDocumentId(row.file_url))||(row.unavailable!==undefined&&typeof row.unavailable!=='boolean')||(row.unavailable&&row.mapped))throw Error('La respuesta documental no es válida.');results.set(row.index,row);}
     for(let i=0;i<batch.length;i++){const row=results.get(i);if(row.unavailable)finish(batch[i],new Error('No se pudo verificar el acceso al documento.'));else finish(batch[i],null,row.mapped?row.file_url:safeDisplayDocumentReference(batch[i].reference));}
    }catch(error){for(const item of batch)finish(item,error);}
   }
  }
 };
 const resolve=(reference,options={})=>{
  const safe=safeDisplayDocumentReference(reference);if(reference&&!safe)return Promise.reject(new Error('Referencia de documento no permitida.'));
  if(privateDocumentId(reference)||!normalizeLegacyDocumentReference(reference))return Promise.resolve(safe);
  const scope={};for(const key of ['companyId','contextKind','contextId'])if(options[key])scope[key]=String(options[key]);
  const scopeKey=JSON.stringify(scope),key=scopeKey+'|'+reference;
  const saved=cache.get(key);if(options.force!==true&&saved?.expiresAt>Date.now())return Promise.resolve(saved.value);if(pending.has(key))return pending.get(key).promise;
  let yes,no;const promise=new Promise((resolve,reject)=>{yes=resolve;no=reject;});
  const item={key,scope,reference,epoch,resolve:yes,reject:no,promise};pending.set(key,item);if(!groups.has(scopeKey))groups.set(scopeKey,[]);groups.get(scopeKey).push(item);
  if(!queued){queued=true;queueMicrotask(()=>{void flush();});}return promise;
 };
 return{resolve,clear};
}

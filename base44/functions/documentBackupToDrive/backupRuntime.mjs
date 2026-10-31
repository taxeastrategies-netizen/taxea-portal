const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const statusOf=error=>Number(error?.status||error?.response?.status||0);
export function throttledBackupClient(client,{pause=delay,now=Date.now,spacing=250}={}){
 let chain=Promise.resolve(),last=0;const cache=new Map();
 const schedule=(method,call)=>{const task=chain.then(async()=>{for(let attempt=0;;attempt++){
  const wait=Math.max(0,last+spacing-now());if(wait)await pause(wait);last=now();
  try{return await call();}catch(error){const status=statusOf(error),read=['list','filter','get'].includes(method);if(attempt>=3||!(status===429||(read&&status>=500&&status<=599)))throw error;await pause(Math.min(5000,500*2**attempt));}
 }});chain=task.catch(()=>{});return task;};
 const entities=new Proxy(client.asServiceRole.entities,{get(target,name){if(typeof name!=='string')return Reflect.get(target,name);if(cache.has(name))return cache.get(name);const entity=target[name],wrapped=new Proxy(entity,{get(object,method){const value=Reflect.get(object,method);return typeof value==='function'?(...args)=>schedule(method,()=>value.apply(object,args)):value;}});cache.set(name,wrapped);return wrapped;}});
 const service=new Proxy(client.asServiceRole,{get(target,name){return name==='entities'?entities:Reflect.get(target,name);}});
 return new Proxy(client,{get(target,name){return name==='asServiceRole'?service:Reflect.get(target,name);}});
}
export async function acquireBackupLease(entity,id,now=Date.now()){
 const token=crypto.randomUUID(),expires=now+10*60*1000;
 const result=await entity.updateMany({id,$or:[{backupLockToken:{$in:[null,'']}},{backupLockExpiresAt:{$lte:now}}]},{$set:{backupLockToken:token,backupLockExpiresAt:expires}});
 return Number(result?.updated)===1?{id,token,expires}:null;
}
export async function releaseBackupLease(entity,lease){if(lease)await entity.updateMany({id:lease.id,backupLockToken:lease.token},{$set:{backupLockToken:'',backupLockExpiresAt:0}});}
export async function boundedBackupBody(response,max,signal){
 if(Number(response.headers.get('content-length')||0)>max)throw new Error('BACKUP_FILE_TOO_LARGE');
 if(!response.body)return new Uint8Array();const reader=response.body.getReader(),parts=[];let size=0,onAbort;
 const aborted=new Promise((_,reject)=>{onAbort=()=>reject(new Error('BACKUP_DOWNLOAD_TIMEOUT'));if(signal?.aborted)onAbort();else signal?.addEventListener('abort',onAbort,{once:true});});
 try{for(;;){const {done,value}=await Promise.race([reader.read(),aborted]);if(done)break;size+=value.length;if(size>max)throw new Error('BACKUP_FILE_TOO_LARGE');parts.push(value);}}
 catch(error){void reader.cancel().catch(()=>{});throw error;}finally{signal?.removeEventListener('abort',onAbort);reader.releaseLock();}
 const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
export async function boundedBackupDownload(value,validate,{fetcher=globalThis.fetch,max=50*1024*1024,timeoutMs=20000}={}){
 const url=validate(value),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{let response=await fetcher(url,{redirect:'manual',signal:controller.signal});
  if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location)throw new Error('BACKUP_REDIRECT_WITHOUT_LOCATION');const next=validate(new URL(location,url).toString());response=await fetcher(next,{redirect:'manual',signal:controller.signal});}
  if(!response.ok)throw new Error('BACKUP_DOWNLOAD_HTTP_'+response.status);
  return await boundedBackupBody(response,max,controller.signal);
 }finally{clearTimeout(timer);}
}
export function backupSnapshot(items,sources){
 const keys=new Set(),allowed=new Map(sources.map(s=>[s.entity+':'+s.urlField+':'+s.companyField,s]));
 return items.map(item=>{const source=allowed.get(item.source?.entity+':'+item.source?.urlField+':'+item.source?.companyField),r=item.record;if(!source||!r?.id)throw new Error('BACKUP_INDEX_INVALID');const key=source.entity+':'+r.id;if(keys.has(key))throw new Error('BACKUP_INDEX_DUPLICATE');keys.add(key);
  const record={};for(const field of new Set(['id',source.urlField,source.companyField,source.mimeField,source.sizeField,'numero_factura','tipo','nombre','documentType','originalFileName','fileName','__backupCompanyId','__backupRecordId','__backupField','sociedadId','expedienteId','auditCaseId',source.nameField].filter(Boolean)))if(r[field]!==undefined)record[field]=r[field];
  if(typeof record[source.urlField]!=='string'||record[source.urlField].length>4096)throw new Error('BACKUP_INDEX_INVALID');return {source,record};
 });
}

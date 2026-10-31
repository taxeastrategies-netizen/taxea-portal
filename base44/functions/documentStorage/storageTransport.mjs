import { storageConfiguration, importStorageKey, base64url, STORAGE_BUCKET, STORAGE_ACCOUNT } from './storageCredentials.mjs';
const encoder=new TextEncoder();
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export async function boundedBytes(response,max=50*1024*1024){
 if(Number(response.headers.get('content-length')||0)>max)throw new Error('STORAGE_RESPONSE_TOO_LARGE');
 if(!response.body)return new Uint8Array();
 const reader=response.body.getReader(),parts=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new Error('STORAGE_RESPONSE_TOO_LARGE');parts.push(value);}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const out=new Uint8Array(size);let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;
}
async function boundedFetch(url,init,max,fetcher){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 // Base44's runtime accepts manual/follow. Manual keeps credentials from following any redirect.
 try{const response=await fetcher(url,{...init,redirect:'manual',signal:controller.signal});return {status:response.status,headers:response.headers,bytes:await boundedBytes(response,max)};}
 finally{clearTimeout(timer);}
}
export async function storageTransport(env,fetcher=(...args)=>globalThis.fetch(...args)){
 const config=storageConfiguration(env),key=await importStorageKey(config),now=Math.floor(Date.now()/1000);
 const segment=value=>base64url(encoder.encode(JSON.stringify(value)));
 const payload=segment({alg:'RS256',typ:'JWT'})+'.'+segment({iss:STORAGE_ACCOUNT,scope:'https://www.googleapis.com/auth/devstorage.read_write',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+600});
 const signature=base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(payload))));
 let tokenResponse;try{tokenResponse=await boundedFetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:payload+'.'+signature}).toString()},16384,fetcher);}catch(error){
  const message=String(error?.message||'').toLowerCase();
  const kind=/illegal invocation|brand check|does not implement/.test(message)?'BINDING':/certificate|certificat|tls|ssl/.test(message)?'TLS':/dns|resolve|lookup/.test(message)?'DNS':/timed? ?out|abort/.test(message)?'TIMEOUT':/duplex|body|serializ/.test(message)?'BODY':/connect|network|fetch/.test(message)?'CONNECT':['TypeError','AbortError','OperationError','InvalidAccessError','ReferenceError'].includes(error?.name)?error.name:'Error';
  const failure=new Error('STORAGE_AUTH_NETWORK_'+kind);
  const words=new Set(['illegal','invocation','headers','signal','abortsignal','argument','class','constructor','url','required','not','supported','fetch','failed','object','function','request','response','readable','locked','release','valid','invalid','cannot','value','promise','undefined','type','read','properties','data','bytes','array','buffer','cancel','decoder','length','duplex','controller','clone','getreader','redirect']);
  failure.storageHints=[...new Set(message.split(/\W+/).filter(word=>words.has(word)))].slice(0,12);
  throw failure;
 }
 let token;try{token=JSON.parse(new TextDecoder().decode(tokenResponse.bytes));}catch{throw new Error('STORAGE_AUTH_NOT_JSON_'+tokenResponse.status);}
 if(tokenResponse.status!==200||typeof token.access_token!=='string'||token.token_type!=='Bearer'){
  const reason=['invalid_grant','invalid_client','invalid_request','invalid_scope','unauthorized_client','access_denied'].includes(token.error)?token.error.toUpperCase():'UNEXPECTED';
  throw new Error('STORAGE_AUTH_FAILED_'+tokenResponse.status+'_'+reason);
 }
 const auth={Authorization:'Bearer '+token.access_token};
 const objectUrl=name=>'https://storage.googleapis.com/storage/v1/b/'+STORAGE_BUCKET+'/o/'+encodeURIComponent(name);
 const validName=name=>{if(typeof name!=='string'||name.length>512||!/^(__taxea_security_probe__|companies)\/[a-zA-Z0-9_/-]+(?:\.[a-zA-Z0-9]+)?$/.test(name)||name.includes('..'))throw new Error('STORAGE_INVALID_OBJECT');return name;};
 return {
  async put(name,bytes,mime='application/octet-stream'){
   validName(name);if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>50*1024*1024)throw new Error('STORAGE_INVALID_SIZE');
   if(!/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i.test(mime))throw new Error('STORAGE_INVALID_MIME');
   const disposition=/^(application\/pdf|image\/(jpeg|png|webp))$/.test(mime)?'inline':'attachment';
   const boundary='taxea_'+crypto.randomUUID().replace(/-/g,'');
   const metadata={name,contentType:mime,cacheControl:'private, no-store',contentDisposition:disposition};
   const body=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: '+mime+'\r\n\r\n',bytes,'\r\n--'+boundary+'--\r\n']);
   const url='https://storage.googleapis.com/upload/storage/v1/b/'+STORAGE_BUCKET+'/o?uploadType=multipart&ifGenerationMatch=0';
   const r=await boundedFetch(url,{method:'POST',headers:{...auth,'Content-Type':'multipart/related; boundary='+boundary},body},32768,fetcher);
   if(r.status!==200)throw new Error('STORAGE_UPLOAD_FAILED_'+r.status);
   const meta=JSON.parse(new TextDecoder().decode(r.bytes));
   if(meta.name!==name||meta.bucket!==STORAGE_BUCKET||Number(meta.size)!==bytes.length||!/^\d+$/.test(meta.generation))throw new Error('STORAGE_UPLOAD_UNVERIFIED');
   if(meta.cacheControl!=='private, no-store'||meta.contentDisposition!==disposition)throw new Error('STORAGE_METADATA_UNVERIFIED');
   return {name,generation:meta.generation,size:Number(meta.size),contentType:meta.contentType};
  },
  async get(name,generation){
   validName(name);if(!/^\d+$/.test(generation))throw new Error('STORAGE_INVALID_GENERATION');
   const r=await boundedFetch(objectUrl(name)+'?alt=media&generation='+generation,{headers:auth},50*1024*1024,fetcher);
   if(r.status!==200)throw new Error('STORAGE_DOWNLOAD_FAILED_'+r.status);return r.bytes;
  },
  async remove(name,generation){
   validName(name);if(!/^\d+$/.test(generation))throw new Error('STORAGE_INVALID_GENERATION');
   const r=await boundedFetch(objectUrl(name)+'?ifGenerationMatch='+generation,{method:'DELETE',headers:auth},8192,fetcher);
   if(r.status!==204)throw new Error('STORAGE_CLEANUP_FAILED');return true;
  },
  async unsignedStatus(name){validName(name);const r=await boundedFetch(objectUrl(name)+'?alt=media',{},4096,fetcher);return r.status;}
 };
}
export async function verifyStorageConnection(env,fetcher=(...args)=>globalThis.fetch(...args)){
 let storage;try{storage=await storageTransport(env,fetcher);}catch(error){if(/^STORAGE_AUTH_(FAILED_\d{3}_[A-Z_]+|NETWORK_[A-Za-z]+|NOT_JSON_\d{3})$/.test(error?.message||''))throw error;const kind=['TypeError','AbortError','OperationError','InvalidAccessError','ReferenceError'].includes(error?.name)?error.name:'Error';throw new Error('STORAGE_STEP_AUTH_'+kind);}
 const name='__taxea_security_probe__/'+crypto.randomUUID()+'.txt';
 const expected=encoder.encode('TAXEA SYNTHETIC STORAGE PROBE - NO CUSTOMER DATA\n');
 let uploaded;try{uploaded=await storage.put(name,expected,'text/plain');}catch{throw new Error('STORAGE_STEP_UPLOAD');}let report;
 try{let bytes,unsignedStatus;try{bytes=await storage.get(name,uploaded.generation);}catch{throw new Error('STORAGE_STEP_READ');}try{unsignedStatus=await storage.unsignedStatus(name);}catch{throw new Error('STORAGE_STEP_UNSIGNED');}report={hashVerified:await sha256(bytes)===await sha256(expected),publicAccessDenied:[401,403,404].includes(unsignedStatus),unsignedStatus,size:bytes.length};}
 finally{try{await storage.remove(name,uploaded.generation);}catch{throw new Error('STORAGE_STEP_CLEANUP');}}
 if(!report.hashVerified||!report.publicAccessDenied)throw new Error('STORAGE_PROBE_FAILED');
 return {...report,syntheticOnly:true,cleanupVerified:true,checkedAt:new Date().toISOString()};
}

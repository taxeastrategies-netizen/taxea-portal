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
 try{const response=await fetcher(url,{...init,redirect:'error',signal:controller.signal});return {status:response.status,headers:response.headers,bytes:await boundedBytes(response,max)};}
 finally{clearTimeout(timer);}
}
export async function storageTransport(env,fetcher=fetch){
 const config=storageConfiguration(env),key=await importStorageKey(config),now=Math.floor(Date.now()/1000);
 const segment=value=>base64url(encoder.encode(JSON.stringify(value)));
 const payload=segment({alg:'RS256',typ:'JWT'})+'.'+segment({iss:STORAGE_ACCOUNT,scope:'https://www.googleapis.com/auth/devstorage.read_write',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+600});
 const signature=base64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(payload))));
 const tokenResponse=await boundedFetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:payload+'.'+signature})},16384,fetcher);
 let token;try{token=JSON.parse(new TextDecoder().decode(tokenResponse.bytes));}catch{throw new Error('STORAGE_AUTH_FAILED');}
 if(tokenResponse.status!==200||typeof token.access_token!=='string'||token.token_type!=='Bearer')throw new Error('STORAGE_AUTH_FAILED');
 const auth={Authorization:'Bearer '+token.access_token};
 const objectUrl=name=>'https://storage.googleapis.com/storage/v1/b/'+STORAGE_BUCKET+'/o/'+encodeURIComponent(name);
 const validName=name=>{if(typeof name!=='string'||name.length>512||!/^(__taxea_security_probe__|companies)\/[a-zA-Z0-9_/-]+(?:\.[a-zA-Z0-9]+)?$/.test(name)||name.includes('..'))throw new Error('STORAGE_INVALID_OBJECT');return name;};
 return {
  async put(name,bytes,mime='application/octet-stream'){
   validName(name);if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>50*1024*1024)throw new Error('STORAGE_INVALID_SIZE');
   const url='https://storage.googleapis.com/upload/storage/v1/b/'+STORAGE_BUCKET+'/o?uploadType=media&ifGenerationMatch=0&name='+encodeURIComponent(name);
   const r=await boundedFetch(url,{method:'POST',headers:{...auth,'Content-Type':mime},body:bytes},32768,fetcher);
   if(r.status!==200)throw new Error('STORAGE_UPLOAD_FAILED');
   const meta=JSON.parse(new TextDecoder().decode(r.bytes));
   if(meta.name!==name||meta.bucket!==STORAGE_BUCKET||Number(meta.size)!==bytes.length||!/^\d+$/.test(meta.generation))throw new Error('STORAGE_UPLOAD_UNVERIFIED');
   return {name,generation:meta.generation,size:Number(meta.size),contentType:meta.contentType};
  },
  async get(name,generation){
   validName(name);if(!/^\d+$/.test(generation))throw new Error('STORAGE_INVALID_GENERATION');
   const r=await boundedFetch(objectUrl(name)+'?alt=media&generation='+generation,{headers:auth},50*1024*1024,fetcher);
   if(r.status!==200)throw new Error('STORAGE_DOWNLOAD_FAILED');return r.bytes;
  },
  async remove(name,generation){
   validName(name);if(!/^\d+$/.test(generation))throw new Error('STORAGE_INVALID_GENERATION');
   const r=await boundedFetch(objectUrl(name)+'?ifGenerationMatch='+generation,{method:'DELETE',headers:auth},8192,fetcher);
   if(r.status!==204)throw new Error('STORAGE_CLEANUP_FAILED');return true;
  },
  async unsignedStatus(name){validName(name);const r=await boundedFetch(objectUrl(name)+'?alt=media',{},4096,fetcher);return r.status;}
 };
}
export async function verifyStorageConnection(env,fetcher=fetch){
 const storage=await storageTransport(env,fetcher),name='__taxea_security_probe__/'+crypto.randomUUID()+'.txt';
 const expected=encoder.encode('TAXEA SYNTHETIC STORAGE PROBE - NO CUSTOMER DATA\n');
 const uploaded=await storage.put(name,expected,'text/plain');let report;
 try{const bytes=await storage.get(name,uploaded.generation),unsignedStatus=await storage.unsignedStatus(name);report={hashVerified:await sha256(bytes)===await sha256(expected),publicAccessDenied:[401,403,404].includes(unsignedStatus),unsignedStatus,size:bytes.length};}
 finally{await storage.remove(name,uploaded.generation);}
 if(!report.hashVerified||!report.publicAccessDenied)throw new Error('STORAGE_PROBE_FAILED');
 return {...report,syntheticOnly:true,cleanupVerified:true,checkedAt:new Date().toISOString()};
}

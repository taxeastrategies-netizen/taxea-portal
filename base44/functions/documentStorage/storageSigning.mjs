import {storageConfiguration,importStorageKey,STORAGE_BUCKET,STORAGE_ACCOUNT} from './storageCredentials.mjs';
import {sha256,storageTransport,boundedBytes} from './storageTransport.mjs';
const encode=value=>encodeURIComponent(value).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
export async function signedStorageRead(env,asset,now=new Date()){
 if(!asset||!/^companies\/[A-Za-z0-9_-]{1,128}\/[a-f0-9-]{36}\.[a-z0-9]{1,8}$/.test(asset.object_name||'')||!/^\d+$/.test(asset.generation||''))throw new Error('STORAGE_INVALID_ASSET');
 const timestamp=now.toISOString().replace(/[-:]|\.\d{3}/g,''),day=timestamp.slice(0,8),scope=day+'/auto/storage/goog4_request';
 const path='/'+STORAGE_BUCKET+'/'+asset.object_name.split('/').map(encode).join('/');
 const query={'X-Goog-Algorithm':'GOOG4-RSA-SHA256','X-Goog-Credential':STORAGE_ACCOUNT+'/'+scope,'X-Goog-Date':timestamp,'X-Goog-Expires':'120','X-Goog-SignedHeaders':'host',generation:asset.generation,'response-cache-control':'private, no-store'};
 const canonicalQuery=Object.entries(query).map(([k,v])=>[encode(k),encode(v)]).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('&');
 const canonical=['GET',path,canonicalQuery,'host:storage.googleapis.com\n','host','UNSIGNED-PAYLOAD'].join('\n');
 const toSign=['GOOG4-RSA-SHA256',timestamp,scope,await sha256(new TextEncoder().encode(canonical))].join('\n');
 const key=await importStorageKey(storageConfiguration(env));
 const signature=Array.from(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(toSign))),b=>b.toString(16).padStart(2,'0')).join('');
 return {url:'https://storage.googleapis.com'+path+'?'+canonicalQuery+'&X-Goog-Signature='+signature,expiresAt:new Date(now.getTime()+120000).toISOString()};
}
export async function verifySignedStorageConnection(env){
 const storage=await storageTransport(env),name='companies/__taxea_security_probe__/'+crypto.randomUUID()+'.txt',bytes=new TextEncoder().encode('TAXEA SYNTHETIC SIGNED DOWNLOAD - NO CUSTOMER DATA\n');
 const object=await storage.put(name,bytes,'text/plain');let result;
 try{
  const signed=await signedStorageRead(env,{object_name:name,generation:object.generation});
  const response=await globalThis.fetch(signed.url,{redirect:'manual',signal:AbortSignal.timeout(25000)});
  if(response.status!==200)throw new Error('STORAGE_SIGNED_READ_FAILED_'+response.status);
  const actual=await boundedBytes(response,4096);
  result={signedReadVerified:await sha256(actual)===await sha256(bytes),expiresInSeconds:120,syntheticOnly:true,checkedAt:new Date().toISOString()};
  if(!result.signedReadVerified)throw new Error('STORAGE_HASH_MISMATCH');
 }finally{await storage.remove(name,object.generation);}
 return {...result,cleanupVerified:true};
}

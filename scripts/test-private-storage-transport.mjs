import assert from 'node:assert/strict';import {generateKeyPairSync,webcrypto} from 'node:crypto';import {storageTransport,verifyStorageConnection,boundedBytes} from '../base44/functions/documentStorage/storageTransport.mjs';import {STORAGE_PROJECT,STORAGE_BUCKET,STORAGE_ACCOUNT} from '../base44/functions/documentStorage/storageCredentials.mjs';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const config={type:'service_account',project_id:STORAGE_PROJECT,client_email:STORAGE_ACCOUNT,token_uri:'https://oauth2.googleapis.com/token',private_key:privateKey.export({format:'pem',type:'pkcs8'})};
const env={get:name=>({TAXEA_GCS_CREDENTIALS_JSON:JSON.stringify(config),TAXEA_GCS_BUCKET:STORAGE_BUCKET,TAXEA_GCS_PROJECT_ID:STORAGE_PROJECT})[name]};
let data,objectName,removed=false,calls=0;
const fetcher=async(url,init)=>{
 calls++;assert.equal(init.redirect,'manual');assert.ok(init.signal instanceof AbortSignal);
 if(url==='https://oauth2.googleapis.com/token'){
  const jwt=new URLSearchParams(init.body).get('assertion'),[h,p,s]=jwt.split('.');const claims=JSON.parse(Buffer.from(p,'base64url'));
  assert.equal(claims.iss,STORAGE_ACCOUNT);assert.equal(claims.exp-claims.iat,600);assert.equal(claims.scope,'https://www.googleapis.com/auth/devstorage.read_write');
  const {verify}=await import('node:crypto');assert.ok(verify('RSA-SHA256',Buffer.from(h+'.'+p),publicKey,Buffer.from(s,'base64url')));
  return Response.json({access_token:'SYNTHETIC',token_type:'Bearer'});
 }
 const u=new URL(url);
 if(init.method==='POST'){assert.equal(u.searchParams.get('ifGenerationMatch'),'0');assert.equal(u.searchParams.get('uploadType'),'multipart');const raw=Buffer.from(await init.body.arrayBuffer()),boundary=init.headers['Content-Type'].split('boundary=')[1],metaEnd=raw.indexOf('\r\n--'+boundary),metadata=JSON.parse(raw.subarray(raw.indexOf('\r\n\r\n')+4,metaEnd).toString());objectName=metadata.name;data=new Uint8Array(raw.subarray(raw.indexOf('\r\n\r\n',metaEnd)+4,raw.lastIndexOf('\r\n--'+boundary+'--')));assert.equal(metadata.cacheControl,'private, no-store');return Response.json({...metadata,bucket:STORAGE_BUCKET,size:String(data.length),generation:'123'});}
 assert.ok(u.pathname.endsWith(encodeURIComponent(objectName)));
 if(init.method==='DELETE'){assert.equal(u.searchParams.get('ifGenerationMatch'),'123');removed=true;return new Response(null,{status:204});}
 if(!init.headers?.Authorization)return new Response('denied',{status:403});
 assert.equal(u.searchParams.get('generation'),'123');return new Response(data);
};
const result=await verifyStorageConnection(env,fetcher);assert.ok(result.hashVerified&&result.publicAccessDenied&&result.cleanupVerified&&removed);assert.equal(calls,5);
const client=await storageTransport(env,fetcher);await assert.rejects(()=>client.get('../secret','123'));await assert.rejects(()=>client.get('companies/a/b','12&x=1'));
await assert.rejects(()=>boundedBytes(new Response('abcdef'),3));await assert.rejects(()=>boundedBytes(new Response('a',{headers:{'content-length':'9999'}}),3));
await assert.rejects(()=>storageTransport(env,async()=>new Response('server details',{status:401})),/STORAGE_AUTH_NOT_JSON_401/);
await assert.rejects(()=>storageTransport(env,async(_url,init)=>{assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://untrusted.invalid'}});}),/STORAGE_AUTH_NOT_JSON_302/);
console.log(JSON.stringify({ok:true,jwtSignatureVerified:true,narrowOAuthScope:true,createOnlyUpload:true,generationPinned:true,hashVerified:true,unsignedAccessDenied:true,syntheticCleanup:true,pathTraversalDenied:true,oversizedBodyDenied:true,providerErrorsRedacted:true}));

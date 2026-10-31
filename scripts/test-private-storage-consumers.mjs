import assert from 'node:assert/strict';import vm from 'node:vm';import {webcrypto} from 'node:crypto';import {build} from 'esbuild';
const crypto=webcrypto,encoder=new TextEncoder();
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64')+'\n-----END PRIVATE KEY-----\n';
let user={id:'user-a',email:'a@qa.invalid',role:'user'},envReads=0,nativeUploads=0,providerCalls=[],storageWrites=0,stored=new Map(),assets=new Map(),documents=[];
const own={id:'own',activa:true,owner_email:'a@qa.invalid',private_document_storage_enabled:true},foreign={id:'foreign',activa:true,owner_email:'b@qa.invalid',private_document_storage_enabled:true};
const synthetic='%PDF-1.4\nTAXEA SYNTHETIC CONSUMER TEST - NO CUSTOMER DATA\n%%EOF';
const sha=bytes=>crypto.subtle.digest('SHA-256',bytes).then(x=>Buffer.from(x).toString('hex'));
const makeAsset=async(id,company)=>({id,company_id:company,object_name:'companies/'+company+'/11111111-1111-4111-8111-111111111111.pdf',generation:'123',status:'ready',size:encoder.encode(synthetic).length,sha256:await sha(encoder.encode(synthetic)),mime_type:'application/pdf',original_name:'qa.pdf'});
assets.set('asset-own',await makeAsset('asset-own','own'));assets.set('asset-foreign',await makeAsset('asset-foreign','foreign'));
const env={get(name){envReads++;return ({TAXEA_GCS_PROJECT_ID:'plasma-minutia-510419-c4',TAXEA_GCS_BUCKET:'taxea-portal-private-es-6a00fec5',TAXEA_GCS_CREDENTIALS_JSON:JSON.stringify({type:'service_account',project_id:'plasma-minutia-510419-c4',client_email:'taxea-portal-storage@plasma-minutia-510419-c4.iam.gserviceaccount.com',private_key:pem,private_key_id:'synthetic-key',token_uri:'https://oauth2.googleapis.com/token'})})[name];}};
const events={filter:async()=>[],create:async data=>({...data,id:'event'}),update:async()=>({})};
const svc={entities:{Company:{get:async id=>id==='own'?own:id==='foreign'?foreign:null},DocumentAsset:{get:async id=>assets.get(id),filter:async q=>[...assets.values()].filter(x=>Object.entries(q).every(([k,v])=>x[k]===v)),create:async data=>{const a={...data,id:'new-'+assets.size};assets.set(a.id,a);return a;},update:async(id,data)=>Object.assign(assets.get(id),data)},OcrInvoiceDocument:{filter:async q=>documents.filter(d=>Object.entries(q).every(([k,v])=>d[k]===v)),create:async data=>{const d={...data,id:'doc-'+documents.length};documents.push(d);return d;}},TimelineEvent:{create:async()=>({})},AIUsageEvent:events,CoreIntegrationUsage:events,get Invoice(){throw new Error('Financial write/read forbidden in synthetic intake');},get JournalEntry(){throw new Error('Financial write/read forbidden');}},integrations:{Core:{UploadFile:async()=>{nativeUploads++;throw new Error('Private flow may not downgrade');},InvokeLLM:async params=>{providerCalls.push(params);return {synthetic:true};},ExtractDataFromUploadedFile:async params=>{providerCalls.push(params);return {status:'success',output:{synthetic:true}};}}}};
const client={auth:{me:async()=>user},asServiceRole:svc};
const fakeFetch=async(url,init={})=>{
 assert.equal(init.redirect,'manual');
 if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-only',token_type:'Bearer'});
 if(url.startsWith('https://storage.googleapis.com/upload/')){
  storageWrites++;const raw=await init.body.text(),boundary=init.headers['Content-Type'].split('boundary=')[1],parts=raw.split('--'+boundary);
  const metadata=JSON.parse(parts[1].split('\r\n\r\n')[1].trim()),content=parts[2].split('\r\n\r\n')[1].replace(/\r\n$/,'');stored.set(metadata.name,encoder.encode(content));
  return Response.json({...metadata,bucket:'taxea-portal-private-es-6a00fec5',generation:'123',size:String(encoder.encode(content).length)});
 }
 if(url.startsWith('https://storage.googleapis.com/storage/v1/'))return new Response(stored.get(decodeURIComponent(new URL(url).pathname.split('/o/')[1])));
 throw new Error('Unapproved test destination');
};
async function load(name){let handler;const bundle=await build({entryPoints:['base44/functions/'+name+'/entry.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'sdk-stub',setup(b){b.onResolve({filter:/^npm:@base44/},()=>({path:'sdk',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({loader:'js',contents:'export const createClientFromRequest=()=>globalThis.__client;'}));}}]});vm.runInNewContext(bundle.outputFiles[0].text,{__client:client,crypto,console:{error(){}},TextEncoder,TextDecoder,URL,URLSearchParams,Uint8Array,Request,Response,File,Blob,AbortController,AbortSignal,setTimeout,clearTimeout,atob,btoa,fetch:fakeFetch,Deno:{env,serve:f=>handler=f}});return body=>handler(new Request('https://qa.invalid',{method:'POST',body:body instanceof FormData?body:JSON.stringify(body),headers:body instanceof FormData?{}:{'Content-Type':'application/json'}}));}
const llm=await load('invokeLimitedLLM');
let previous=envReads,r=await llm({prompt:'Synthetic only',file_urls:['https://taxeaportal.com/private-document/asset-foreign']});assert.equal(r.status,400);assert.equal(envReads,previous);assert.equal(providerCalls.length,0);
r=await llm({prompt:'Synthetic only',file_urls:['https://taxeaportal.com/private-document/asset-own']});assert.equal(r.status,200);assert.equal((await r.json()).result.synthetic,true);assert.match(providerCalls.at(-1).file_urls[0],/^https:\/\/storage.googleapis.com\//);assert.match(providerCalls.at(-1).file_urls[0],/X-Goog-Expires=120/);
const count=providerCalls.length;r=await llm({prompt:'Synthetic only',file_urls:[providerCalls.at(-1).file_urls[0]]});assert.equal(r.status,400);assert.equal(providerCalls.length,count,'Raw provider URLs must not bypass tenant authorization');
const extract=await load('limitedCoreOperations');
previous=envReads;r=await extract({operation:'extract',companyId:'own',file_url:'https://taxeaportal.com/private-document/asset-foreign',json_schema:{type:'object'}});assert.equal(r.status,404);assert.equal(envReads,previous);
r=await extract({operation:'extract',companyId:'own',file_url:'https://taxeaportal.com/private-document/asset-own',json_schema:{type:'object'}});assert.equal(r.status,200);assert.match(providerCalls.at(-1).file_url,/X-Goog-Expires=120/);assert.equal(JSON.stringify(await r.json()).includes('storage.googleapis.com'),false);
const intake=await load('ocrDocumentIntake'),upload=()=>{const f=new FormData();for(const [k,v] of Object.entries({action:'upload',companyId:'own',documentType:'expense_invoice',captureMethod:'camera',file:new File([synthetic+'\nINTAKE'],'qa.pdf',{type:'application/pdf'})}))f.set(k,v);return f;};
r=await intake(upload());assert.equal(r.status,200);let result=await r.json();assert.equal(result.document.status,'pending');assert.match(result.document.fileStorageUrl,/^https:\/\/taxeaportal.com\/private-document\//);assert.equal(nativeUploads,0);assert.equal(storageWrites,1);assert.equal(documents.length,1);
r=await intake(upload());assert.equal(r.status,200);assert.equal((await r.json()).reused,true);assert.equal(storageWrites,1);assert.equal(documents.length,1);
user={...user,data:{accountAccessStatus:'suspended'}};previous=envReads;r=await intake(upload());assert.equal(r.status,403);assert.equal(envReads,previous);assert.equal(documents.length,1);
console.log(JSON.stringify({ok:true,privateLlmOwnAllowed:true,foreignLlmDeniedBeforeSecrets:true,rawProviderUrlDenied:true,extractCompanyBound:true,noProviderUrlInResponse:true,privateOcrUpload:true,pendingPreserved:true,retryIdempotent:true,noNativeDowngrade:true,disabledNestedAccountDenied:true,financialWrites:0,externalCalls:0}));



import assert from 'node:assert/strict';import vm from 'node:vm';import {webcrypto,generateKeyPairSync,createHash} from 'node:crypto';import {build} from 'esbuild';
import {downloadPublicInvoiceDocument} from '../src/lib/publicInvoiceDocument.mjs';
const crypto=webcrypto,enc=new TextEncoder(),pdf=enc.encode('%PDF-1.7\nTAXEA SYNTHETIC ONLY\n%%EOF\n'),hash=createHash('sha256').update(pdf).digest('hex'),token='a'.repeat(64),url='https://taxeaportal.com/private-document/assetA';
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const credentials={type:'service_account',project_id:'plasma-minutia-510419-c4',client_email:'taxea-portal-storage@plasma-minutia-510419-c4.iam.gserviceaccount.com',token_uri:'https://oauth2.googleapis.com/token',private_key:privateKey.export({format:'pem',type:'pkcs8'})};
let checks=0;const check=(condition,label)=>{assert.ok(condition,label);checks++;};
const bundles=new Map();
async function fixture(name,settings={}){
 let handler,envReads=0,invoiceReads=0,storageReads=0,signerCalls=0;const invoiceWrites=[],attachmentWrites=[],events=[];
 const user={id:'qa-user',email:'owner@qa.invalid',role:'user',...settings.user};
 const invoice={id:'qa-invoice',company_id:'A',tipo:'recibida',numero_factura:'QA-PRIVATE-1',archivo_url:url,public_token:token,public_token_expires_at:new Date(Date.now()+3600000).toISOString(),total_factura:121,base_imponible:100,cuota_iva:21,...settings.invoice};
 if(invoice.qr_url){invoice.qr_integrity_hash=createHash('sha256').update(JSON.stringify(['taxea-qr-identity-v1',invoice.company_id,invoice.id,invoice.qr_url])).digest('hex').toUpperCase();invoice.qr_integrity_version='taxea-qr-identity-v1';invoice.qr_integrity_algorithm='SHA-256';invoice.qr_integrity_created_at='2026-11-01T00:00:00Z';}
 const assetA={id:'assetA',company_id:'A',object_name:'companies/A/11111111-1111-4111-8111-111111111111.pdf',generation:'123',status:'ready',size:pdf.length,mime_type:'application/pdf',sha256:hash,original_name:'qa.pdf',...settings.asset};
 const assetB={...assetA,id:'assetB',company_id:'B',object_name:'companies/B/11111111-1111-4111-8111-111111111111.pdf'};
 const company={id:'A',owner_email:'owner@qa.invalid',activa:settings.active!==false,razon_social:'QA SYNTHETIC',secret_should_not_leak:'NEVER_PUBLIC'};
 const entities={
  Company:{get:async id=>id==='A'?company:id==='B'?{id:'B',owner_email:'foreign@qa.invalid',activa:true}:null},
  Invoice:{get:async id=>id===invoice.id?invoice:null,filter:async query=>{invoiceReads++;return query.public_token===token?(settings.duplicate?[invoice,{...invoice,id:'duplicate'}]:[invoice]):[];},update:async(id,patch)=>{for(const key of Object.keys(patch))check(['archivo_url','qr_pdf_url'].includes(key),'Only attachment references may change');invoiceWrites.push(patch);Object.assign(invoice,patch);return invoice;}},
  DocumentAsset:{get:async id=>id==='assetA'?assetA:id==='assetB'?assetB:null,filter:async query=>query.company_id==='A'?[assetA]:[]},
  DocumentLegacyReference:{filter:async query=>{const digest=query.reference_digest?.$in?.[0];if(settings.legacy==='owned'&&(!query.company_id||query.company_id==='A'))return [{id:'aliasA',company_id:'A',asset_id:'assetA',reference_digest:digest,status:'verified',sha256:hash,size:pdf.length}];if(settings.legacy==='foreign'&&!query.company_id)return [{id:'aliasB',company_id:'B',asset_id:'assetB',reference_digest:digest,status:'verified',sha256:hash,size:pdf.length}];return [];}},
  InvoiceAttachment:{filter:async()=>settings.attachments||[],create:async value=>{attachmentWrites.push(value);return {...value,id:'qa-attachment'};}},
  InvoiceEmailLog:{filter:async()=>[],update:async()=>{throw new Error('No mail rows exist in this fixture');}},
  InvoiceTimelineEvent:{filter:async()=>[],create:async value=>{events.push(value);return {...value,id:'event'};}},
 };
 const svc={entities:new Proxy(entities,{get(target,key){if(!(key in target))throw new Error('Unexpected entity access '+String(key));return target[key];}}),integrations:{Core:{CreateFileSignedUrl:async()=>{signerCalls++;return {signed_url:'https://base44.app/synthetic-legacy'};}}}};
 const client={auth:{me:async()=>user},asServiceRole:svc};
 if(!bundles.has(name))bundles.set(name,(await build({entryPoints:['base44/functions/'+name+'/entry.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'sdk',setup(b){b.onResolve({filter:/^npm:@base44/},()=>({path:'sdk',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({loader:'js',contents:'export const createClientFromRequest=()=>globalThis.__client;'}));}}]})).outputFiles[0].text);
 const env={get(key){envReads++;return ({TAXEA_GCS_CREDENTIALS_JSON:JSON.stringify(credentials),TAXEA_GCS_BUCKET:'taxea-portal-private-es-6a00fec5',TAXEA_GCS_PROJECT_ID:'plasma-minutia-510419-c4'})[key];}};
 const fetcher=async(request,init)=>{check(init.redirect==='manual','Provider redirects must not be followed');if(request==='https://oauth2.googleapis.com/token')return Response.json({access_token:'SYNTHETIC',token_type:'Bearer'});if(String(request).startsWith('https://storage.googleapis.com/storage/v1/')){storageReads++;check(new URL(request).searchParams.get('generation')==='123','Pinned generation required');return new Response(settings.corrupt?'CORRUPT':pdf);}throw new Error('Unexpected network destination');};
 vm.runInNewContext(bundles.get(name),{__client:client,crypto,Request,Response,ReadableStream,Blob,File,TextEncoder,TextDecoder,URL,URLSearchParams,Uint8Array,AbortController,AbortSignal,setTimeout,clearTimeout,atob,btoa,fetch:fetcher,console:{error(){},warn(){},log(){}},Deno:{env,serve:fn=>handler=fn}});
 return {invoice,invoiceWrites,attachmentWrites,events,counts:()=>({envReads,invoiceReads,storageReads,signerCalls}),invoke:async body=>handler(new Request('https://qa.invalid/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(name==='getPublicInvoice'?{token,action:'view',...body}:{company_id:'A',invoice_id:'qa-invoice',...body})})),raw:handler};
}
let f=await fixture('getPublicInvoice'),r=await f.invoke({}),data=await r.json();check(r.status===200,'Valid public invoice remains readable');check(data.invoice.has_private_pdf===true,'Private download capability advertised');check(!data.invoice.archivo_url&&!data.invoice.qr_pdf_url,'Private asset references not exposed in public DTO');check(!JSON.stringify(data).includes('secret_should_not_leak'),'Internal company fields omitted');
r=await f.invoke({action:'download_pdf',assetId:'assetB',file_url:'https://evil.invalid/ignored'});check(r.status===200,'Valid capability downloads exactly its PDF');check(Buffer.from(await r.arrayBuffer()).equals(pdf),'PDF bytes match original');check(r.headers.get('X-Taxea-File-Sha256')===hash,'Download hash provided');check(r.headers.get('Cache-Control')==='private, no-store','Public-capability bytes not cached');check(f.invoiceWrites.length===0,'Public access never mutates invoices');
for(const [settings,body,status]of [
 [{},{token:'invalid'},400],[{},{token:'b'.repeat(64)},404],[{duplicate:true},{},404],
 [{invoice:{public_token_revoked_at:'2026-01-01'}},{action:'download_pdf'},410],
 [{invoice:{anulada:true}},{action:'download_pdf'},410],
 [{invoice:{public_token_expires_at:'invalid-date'}},{},410],
 [{invoice:{public_token_expires_at:new Date(Date.now()-1).toISOString()}},{},410],
 [{active:false},{action:'download_pdf'},404],
 [{invoice:{archivo_url:'https://taxeaportal.com/private-document/assetB'}},{action:'download_pdf'},404],
 [{asset:{mime_type:'text/html'}},{action:'download_pdf'},404],
 [{asset:{size:26*1024*1024}},{action:'download_pdf'},404],
 [{asset:{status:'failed'}},{action:'download_pdf'},404],
 [{asset:{object_name:'companies/B/11111111-1111-4111-8111-111111111111.pdf'}},{action:'download_pdf'},404],
 [{},{action:'arbitrary'},400],
 ]){f=await fixture('getPublicInvoice',settings);r=await f.invoke(body);check(r.status===status,'Invalid capability or asset rejected: '+JSON.stringify(settings));check(f.counts().envReads===0,'Rejected requests never read storage secrets');check(f.invoiceWrites.length===0,'Rejected public request never mutates invoice');}
f=await fixture('getPublicInvoice',{corrupt:true});r=await f.invoke({action:'download_pdf'});check(r.status===404,'Corrupted object not returned');check(!JSON.stringify(await r.json()).includes('googleapis'),'Provider internals redacted');
f=await fixture('getPublicInvoice');r=await f.raw(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify({token,padding:'x'.repeat(9000)})}));check(r.status===400&&f.counts().invoiceReads===0,'Oversized unauthenticated request rejected before privileged read');r=await f.raw(new Request('https://qa.invalid',{method:'GET'}));check(r.status===405,'GET has no public side effects');
f=await fixture('invoiceOperations');r=await f.invoke({action:'set_primary_pdf',file_url:url,mime_type:'application/pdf',size_bytes:pdf.length});check(r.status===409&&f.invoiceWrites.length===0,'Existing primary PDF never overwritten');
for(const user of [{role:'user'},{role:'admin'}]){f=await fixture('invoiceOperations',{user,invoice:{archivo_url:''}});r=await f.invoke({action:'set_primary_pdf',file_url:'https://taxeaportal.com/private-document/assetB',mime_type:'application/pdf',size_bytes:pdf.length});check(r.status===404,'Cross-company binding rejected including admin');check(f.invoiceWrites.length===0,'No mutation on foreign binding');}
f=await fixture('invoiceOperations',{invoice:{archivo_url:''}});r=await f.invoke({action:'set_primary_pdf',file_url:url,mime_type:'application/pdf',size_bytes:pdf.length});check(r.status===200,'Own private PDF can be linked');check(f.invoice.total_factura===121&&f.invoice.base_imponible===100,'Financial fields preserved');
f=await fixture('invoiceOperations',{invoice:{archivo_url:''}});r=await f.invoke({action:'set_primary_pdf',file_url:url,mime_type:'application/pdf',size_bytes:1});check(r.status===400&&f.invoiceWrites.length===0,'Forged metadata rejected');
f=await fixture('invoiceOperations');r=await f.invoke({action:'add_attachment',file_uri:url,filename:'qa.pdf',mime_type:'application/pdf',size_bytes:pdf.length});check(r.status===200&&f.attachmentWrites.length===1,'Private supporting attachment linked');check(f.invoiceWrites.length===0,'Supporting attachment does not modify invoice');
f=await fixture('invoiceOperations',{attachments:[{id:'good',file_uri:url},{id:'foreign',file_uri:'https://taxeaportal.com/private-document/assetB'}]});r=await f.invoke({action:'list_attachments'});data=await r.json();check(r.status===200&&data.attachments[0].signed_url===url,'Own attachment opens protected viewer');check(data.attachments[1].signed_url===''&&data.attachments[1].unavailable,'Foreign attachment content stays inaccessible');check(f.counts().signerCalls===0,'Private attachment never uses native signer');
const legacy='https://base44.app/api/apps/6a00fec50cc522a74ddde4b2/files/mp/private/6a00fec50cc522a74ddde4b2/synthetic-only.pdf';
for(const action of ['set_primary_pdf','set_qr_pdf','add_attachment']){
 for(const legacyKind of ['unmapped','foreign']){
  f=await fixture('invoiceOperations',{legacy:legacyKind,invoice:{archivo_url:'',tipo:'emitida',qr_url:'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=B12345678'}});
  r=await f.invoke({action,file_url:legacy,file_uri:'private/synthetic-only.pdf',filename:'qa.pdf',mime_type:'application/pdf',size_bytes:pdf.length});
  check(r.status===404,'Unverified or foreign legacy reference rejected: '+action+'/'+legacyKind+' status='+r.status+' body='+await r.clone().text());check(f.invoiceWrites.length===0&&f.attachmentWrites.length===0,'Rejected legacy reference performs no data mutation');check(f.counts().envReads===0,'Legacy rejection never reads storage secrets');
 }
}
f=await fixture('invoiceOperations',{legacy:'owned',invoice:{archivo_url:''}});r=await f.invoke({action:'set_primary_pdf',file_url:legacy,mime_type:'application/pdf',size_bytes:pdf.length});check(r.status===200&&f.invoice.archivo_url===url,'Owned verified legacy alias is stored as canonical private reference');
f=await fixture('invoiceOperations',{legacy:'owned',invoice:{archivo_url:''}});r=await f.invoke({action:'set_primary_pdf',file_url:legacy,mime_type:'application/pdf',size_bytes:1});check(r.status===400&&f.invoiceWrites.length===0,'Legacy metadata is verified against the owned private asset');
const api={functions:{fetch:async()=>new Response(pdf,{headers:{'Content-Type':'application/pdf','X-Taxea-File-Sha256':hash,'X-Taxea-File-Size':String(pdf.length)}})}};
check((await downloadPublicInvoiceDocument(api,{token})).blob.size===pdf.length,'Client verifies successful download');
await assert.rejects(()=>downloadPublicInvoiceDocument({functions:{fetch:async()=>new Response('CORRUPT',{headers:{'Content-Type':'application/pdf','X-Taxea-File-Sha256':hash,'X-Taxea-File-Size':'7'}})}},{token}),/coincide/);checks++;
await assert.rejects(()=>downloadPublicInvoiceDocument({functions:{fetch:async()=>Response.json({error:'Caducado'},{status:410})}},{token}),/Caducado/);checks++;
console.log(JSON.stringify({ok:true,checks,publicCapabilityBoundToInvoice:true,expiryAndRevocationVerified:true,foreignAssetDeniedBeforeSecrets:true,privateAttachmentBindingVerified:true,noFinancialMutations:true,publicBlobHashVerified:true,externalCalls:0,realDataWrites:0}));

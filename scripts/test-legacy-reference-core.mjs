import assert from'node:assert/strict';
import{normalizeLegacyDocumentReference,legacyReferenceDigest,resolveStoredDocumentReference,legacyDocumentMappings}from'../base44/functions/documentStorage/storageAssets.mjs';
const app='6a00fec50cc522a74ddde4b2',uri='https://media.base44.com/files/public/'+app+'/QA.pdf',company={id:'company-a',activa:true,owner_email:'normal@example.invalid'},user={id:'user-a',role:'user',email:company.owner_email};
let checks=0,aliasReads=0,aliasRows=[],assetRows=[];const ok=(a,b)=>{assert.deepEqual(a,b);checks++;};
for(const ref of [uri,uri+'?width=10',uri+'#page=1','mp/public/'+app+'/QA.pdf'])ok(Boolean(normalizeLegacyDocumentReference(ref)),true);
ok(normalizeLegacyDocumentReference(uri+'#page=1'),uri);ok(normalizeLegacyDocumentReference(uri+'?width=10')===normalizeLegacyDocumentReference(uri+'?width=20'),false);
for(const ref of ['http://media.base44.com/files/public/'+app+'/QA.pdf','https://evil.example/QA.pdf','https://media.base44.com.evil.example/files/public/'+app+'/QA.pdf','https://u:p@media.base44.com/files/public/'+app+'/QA.pdf','https://media.base44.com:444/files/public/'+app+'/QA.pdf',uri.replace(app,'other-app'),uri.replace('QA.pdf','a/../QA.pdf'),uri.replace('QA.pdf','%252e%252e/QA.pdf'),uri.replace('QA.pdf','%00QA.pdf'),null,'x'.repeat(4097)])ok(normalizeLegacyDocumentReference(ref),'');
const digest=await legacyReferenceDigest(uri);ok(/^[a-f0-9]{64}$/.test(digest),true);
const svc={entities:{Company:{async get(id){return id===company.id?company:{id,activa:true,owner_email:'foreign@example.invalid'};}},DocumentLegacyReference:{async filter(query){aliasReads++;return aliasRows.filter(row=>(!query.company_id||row.company_id===query.company_id)&&query.reference_digest.$in.includes(row.reference_digest));}},DocumentAsset:{async get(id){return assetRows.find(row=>row.id===id)||null;},async filter(query){return assetRows.filter(row=>query.id.$in.includes(row.id)&&row.company_id===query.company_id&&row.status===query.status);}}}};
ok(await resolveStoredDocumentReference(svc,user,uri,company.id),uri);ok(aliasReads,2);
for(const actor of [null,{...user,accountAccessStatus:'suspended'},{...user,email:'foreign@example.invalid'}]){const before=aliasReads;await assert.rejects(()=>legacyDocumentMappings(svc,actor,company.id,[uri]),/COMPANY_FORBIDDEN/);checks++;ok(aliasReads,before);}
await assert.rejects(()=>legacyDocumentMappings(svc,user,'company-b',[uri]),/COMPANY_FORBIDDEN/);checks++;
const asset={id:'asset-a',company_id:company.id,status:'ready',object_name:'companies/'+company.id+'/qa.pdf',sha256:'a'.repeat(64),size:10};assetRows=[asset];
const alias={id:'alias-a',company_id:company.id,reference_digest:digest,asset_id:asset.id,sha256:asset.sha256,size:10,status:'verified'};aliasRows=[alias];
ok(await resolveStoredDocumentReference(svc,user,uri,company.id),'https://taxeaportal.com/private-document/asset-a');
ok(await resolveStoredDocumentReference(svc,user,uri),'https://taxeaportal.com/private-document/asset-a');
await assert.rejects(()=>resolveStoredDocumentReference(svc,{...user,email:'foreign@example.invalid'},uri),/ASSET_UNVERIFIED/);checks++;
ok(await legacyDocumentMappings(svc,user,company.id,[uri,uri+'?width=10']),[{index:0,mapped:true,file_url:'https://taxeaportal.com/private-document/asset-a'},{index:1,mapped:false}]);
for(const patch of [{status:'disabled'},{sha256:'b'.repeat(64)},{size:11},{asset_id:'missing'}]){aliasRows=[{...alias,...patch}];await assert.rejects(()=>resolveStoredDocumentReference(svc,user,uri,company.id),/ASSET_UNVERIFIED/);checks++;}
aliasRows=[alias,{...alias,id:'duplicate'}];await assert.rejects(()=>legacyDocumentMappings(svc,user,company.id,[uri]),/AMBIGUOUS/);checks++;
aliasRows=[alias];for(const patch of [{object_name:'companies/foreign/qa.pdf'},{status:'failed'},{company_id:'foreign'},{sha256:'invalid'}]){assetRows=[{...asset,...patch}];await assert.rejects(()=>legacyDocumentMappings(svc,user,company.id,[uri]),/ASSET_UNVERIFIED/);checks++;}
assetRows=[asset];for(const refs of [[],Array(21).fill(uri),['https://evil.example']]){await assert.rejects(()=>legacyDocumentMappings(svc,user,company.id,refs),/REFERENCE_INVALID/);checks++;}
const source={archivo_url:uri,total:121};const copy=JSON.stringify(source);await resolveStoredDocumentReference(svc,user,source.archivo_url,company.id);ok(JSON.stringify(source),copy);
svc.entities.DocumentLegacyReference.filter=async()=>{throw Error('PROVIDER_UNAVAILABLE');};await assert.rejects(()=>resolveStoredDocumentReference(svc,user,uri,company.id),/PROVIDER_UNAVAILABLE/);checks++;
console.log(JSON.stringify({ok:true,checks,externalCalls:0,sourceRecordWrites:0,productionInstalled:false,coverage:'App-owned URI canonicalization, exact company authority, batched aliases, disabled/ambiguous/corrupt mappings fail closed, original financial fields unchanged'}));

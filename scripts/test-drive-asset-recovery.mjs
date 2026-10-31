import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {restorePrivateAssetFromBackup,privateAssetBackupPlan} from '../base44/functions/documentStorage/storageRecovery.mjs';
import {readDriveRecoveryBytes,boundedRecoveryBytes} from '../base44/functions/documentStorage/driveRecovery.mjs';
const bytes=new TextEncoder().encode('QA BACKUP RECOVERY - FICTITIOUS ONLY\n'),digest=createHash('sha256').update(bytes).digest('hex'),admin={id:'admin',role:'admin',email:'admin@example.test'};
let checks=0;const check=(ok,label)=>{assert.ok(ok,label);checks++;};
function fixture(options={}){
 let asset={id:'asset',company_id:'A',object_name:'companies/A/qa.txt',generation:'100',sha256:digest,size:bytes.length,mime_type:'text/plain',original_name:'qa.txt',status:'ready'},current=options.live?'100':null;
 const counters={reads:0,writes:0,put:0,backup:0,fetch:0},patches=[],urls=[];
 const record={id:'record',fileStorageUrl:'https://taxeaportal.com/private-document/asset',clientAccountId:'A',checksum:digest,fileSize:bytes.length,backupStatus:'verified',driveFileId:'drive-qa'};
 const service={entities:{DocumentAsset:{async get(){counters.reads++;return structuredClone(asset);},async updateMany(_q,p){counters.writes++;patches.push(p.$set);Object.assign(asset,p.$set);return{updated:1};}},Company:{async get(){counters.reads++;return{id:'A',activa:true};}},DocumentBackupRecord:{async filter(){counters.backup++;return options.foreignRecord?[{...record,clientAccountId:'B'}]:[record];}}},connectors:{async getConnection(){return{accessToken:'SYNTHETIC_TOKEN'};}}};
 const transport={async get(name,generation){check(name===asset.object_name,'storage target stays bound to ledger');if(generation!==current)throw Error('STORAGE_DOWNLOAD_FAILED_404');return bytes;},async metadata(){return current?{generation:current}:null;},async put(name,content,mime){counters.put++;check(name===asset.object_name&&mime===asset.mime_type,'put cannot change target or MIME');check(createHash('sha256').update(content).digest('hex')===digest,'put receives only verified backup bytes');if(options.putFailure)throw Error('STORAGE_UPLOAD_FAILED_503');current='200';if(options.lostAck)throw Error('network lost');return{generation:'200'};},async restore(){throw Error('No native restore expected for absent object');}};
 const fetcher=async(url,init)=>{
  counters.fetch++;urls.push(url);check(url.startsWith('https://www.googleapis.com/drive/v3/'),'Drive origin fixed');check(init.redirect==='manual','Drive token cannot follow redirects');
  if(options.redirect)return new Response(null,{status:302,headers:{location:'https://evil.example'}});
  if(url.includes('/about?'))return Response.json({user:{emailAddress:options.wrongAccount?'wrong@example.test':'taxeastrategies@gmail.com'}});
  if(url.includes('/permissions?'))return Response.json({permissions:[{type:'user',role:'owner',emailAddress:'taxeastrategies@gmail.com'},...(options.publicBackup?[{type:'anyone',role:'reader'}]:[])]});
  if(url.includes('alt=media'))return new Response(options.corrupt?new Uint8Array(bytes.length).fill(0):bytes);
  return Response.json({id:'drive-qa',size:bytes.length,trashed:options.trashed||false});
 };
 const readBackup=(svc,user,selected)=>readDriveRecoveryBytes(svc,user,selected,{fetcher});
 const request={assetId:'asset',expectedGeneration:'100',expectedSha256:digest};
 return{service,transport,counters,patches,urls,request,readBackup,get asset(){return structuredClone(asset);},run:(user=admin,extra={})=>restorePrivateAssetFromBackup(service,user,{...request,...extra},{},async()=>transport,readBackup),plan:()=>privateAssetBackupPlan(service,admin,'asset')};
}
let f=fixture(),plan=await f.plan();check(plan.backupAvailable&&!plan.backupContentVerified&&f.counters.fetch===0,'backup plan is a ledger candidate, not a false verified-download claim');
let result=await f.run();check(result.ok&&result.backupVerified&&result.generationChanged,'actual Drive bytes restored into a new storage generation');check(f.asset.sha256===digest&&f.asset.size===bytes.length&&result.file_url==='https://taxeaportal.com/private-document/asset','reference, hash and size preserved');check(f.patches.every(p=>Object.keys(p).every(k=>['generation','verified_at','restored_at','restored_by','restore_source_generation'].includes(k))),'no financial or document-reference fields changed');
const firstFetches=f.counters.fetch;result=await f.run();check(result.alreadyRestored&&f.counters.put===1&&f.counters.fetch===firstFetches,'same old plan retry does not create another copy or read Drive again');
for(const options of [{wrongAccount:true},{publicBackup:true},{corrupt:true},{trashed:true},{redirect:true},{foreignRecord:true}]){f=fixture(options);await assert.rejects(()=>f.run());checks++;check(f.counters.put===0&&f.counters.writes===0,'bad/foreign/unavailable backup cannot mutate storage or ledger');check(f.urls.every(url=>url.startsWith('https://www.googleapis.com/')),'no credential redirect followed');}
f=fixture({lostAck:true});check((await f.run()).backupVerified&&f.counters.put===1,'lost GCS acknowledgement reconciled with bytes, not blind retry');
f=fixture({putFailure:true});await assert.rejects(()=>f.run(),/STORAGE_UPLOAD_FAILED_503/);checks++;check(f.counters.writes===0,'failed GCS copy leaves the ledger unchanged');
f=fixture({live:true});check((await f.run()).alreadyAvailable&&f.counters.put===0&&f.counters.backup===0,'healthy file does not need a backup download');
for(const user of [{id:'normal',role:'user'},{...admin,data:{accountAccessStatus:'disabled'}}]){f=fixture();await assert.rejects(()=>f.run(user));checks++;check(f.counters.reads===0&&f.counters.fetch===0&&f.counters.put===0,'non-admin and disabled denied before storage/data/Drive');}
f=fixture();await assert.rejects(()=>f.run(admin,{expectedSha256:'0'.repeat(64)}),/PLAN_STALE/);checks++;check(f.counters.backup===0&&f.counters.put===0,'tampered expected hash denied before external calls');
let canceled=false;const controller=new AbortController(),response=new Response(new ReadableStream({pull(){},cancel(){canceled=true;}}));const pending=boundedRecoveryBytes(response,10,controller.signal);controller.abort();await assert.rejects(()=>pending,/TIMEOUT/);checks++;check(canceled,'stalled backup reader canceled on timeout');
const over=new Response(new Uint8Array(12));await assert.rejects(()=>boundedRecoveryBytes(over,10,new AbortController().signal),/TOO_LARGE/);checks++;
console.log(JSON.stringify({ok:true,checks,realDataWrites:0,realExternalCalls:0,credentialValuesExposed:0}));

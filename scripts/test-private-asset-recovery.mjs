import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {privateAssetRecoveryPlan,restorePrivateAsset} from '../base44/functions/documentStorage/storageRecovery.mjs';
let checks=0;const check=(value,label)=>{assert.ok(value,label);checks++;};
const bytes=new TextEncoder().encode('TAXEA QA RECOVERY - NO CUSTOMER DATA\n'),digest=createHash('sha256').update(bytes).digest('hex');
const admin={id:'qa-admin',email:'admin@example.test',role:'admin'},normal={id:'qa-user',email:'qa@example.test',role:'user'};
function fixture(options={}){
 let asset={id:'asset-a',company_id:'company-a',object_name:'companies/company-a/qa.txt',generation:'100',sha256:digest,size:bytes.length,mime_type:'application/octet-stream',original_name:'qa.txt',status:'ready',...options.asset};
 let reads=0,writes=0,transportCalls=0,restoreCalls=0,current=options.live?'100':options.relinked?'200':null,softDeleted=options.expired?false:true;
 const changes=[],original=structuredClone(asset);
 const service={entities:{
  DocumentAsset:{async get(id){reads++;return id===asset.id?structuredClone(asset):null;},async updateMany(query,patch){writes++;changes.push(patch.$set);if(options.casConflict){asset={...asset,generation:'999'};return{updated:0};}Object.assign(asset,patch.$set);return{updated:1};}},
  Company:{async get(id){reads++;return{id,activa:options.archived?false:true,owner_email:normal.email};}}
 }};
 const transport={
  async get(name,generation){check(name===original.object_name,'recovery never changes the object path');if(options.readFailure)throw Error('STORAGE_DOWNLOAD_FAILED_503');if(generation!==current)throw Error('STORAGE_DOWNLOAD_FAILED_404');return options.corrupt?new Uint8Array([0,1,2]):bytes;},
  async metadata(name,query){check(name===original.object_name,'metadata stays on the bound object');if(query?.softDeleted)return softDeleted?{generation:'100',softDeleteTime:'2026-10-31T00:00:00Z',hardDeleteTime:'2099-01-01T00:00:00Z'}:null;return current?{generation:current}:null;},
  async restore(name,generation){restoreCalls++;check(name===original.object_name&&generation===original.generation,'restore targets the pinned old generation');if(options.restoreFailure)throw Error('STORAGE_RESTORE_FAILED_403');current='200';softDeleted=false;if(options.lostAcknowledgement)throw Error('network lost');return{generation:current};}
 };
 const makeTransport=async()=>{transportCalls++;return transport;},request={assetId:asset.id,expectedGeneration:asset.generation,expectedSha256:asset.sha256};
 return{service,makeTransport,request,changes,original,get stats(){return{reads,writes,transportCalls,restoreCalls};},get asset(){return structuredClone(asset);},plan:user=>privateAssetRecoveryPlan(service,user??admin,asset.id,{},makeTransport),run:(extra={},user=admin)=>restorePrivateAsset(service,user,{...request,...extra},{},makeTransport)};
}
let f=fixture();let plan=await f.plan();check(plan.mode==='soft_delete'&&plan.canRestore&&plan.expectedGeneration==='100','plan offers the exact deleted generation');check(f.stats.writes===0&&f.stats.restoreCalls===0,'plan is read-only');
let result=await f.run();check(result.ok&&result.verified&&result.generationChanged,'restored bytes verified before success');check(f.asset.id===f.original.id&&f.asset.generation==='200','stable asset identity, new storage generation');check(result.file_url==='https://taxeaportal.com/private-document/asset-a','invoice/document references stay unchanged');check(f.asset.sha256===f.original.sha256&&f.asset.size===f.original.size&&f.asset.company_id===f.original.company_id,'hash, size and company preserved');check(f.changes.length===1&&Object.keys(f.changes[0]).every(k=>['generation','verified_at','restored_at','restored_by','restore_source_generation'].includes(k)),'only storage recovery metadata changes');
result=await f.run();check(result.alreadyRestored&&f.stats.restoreCalls===1&&f.stats.writes===1,'lost client response retry does not restore or relink twice');
for(const user of [normal,{...admin,data:{accountAccessStatus:'disabled'}},{...admin,status:'bloqueado'}]){f=fixture();await assert.rejects(()=>f.plan(user),e=>e.status===403);checks++;check(f.stats.reads===0&&f.stats.transportCalls===0,'non-admin/disabled denied before storage or data');await assert.rejects(()=>f.run({},user),e=>e.status===403);checks++;}
f=fixture({live:true});plan=await f.plan();check(plan.mode==='available'&&!plan.canRestore,'healthy documents do not need restoration');result=await f.run();check(result.alreadyAvailable&&f.stats.writes===0&&f.stats.restoreCalls===0,'healthy asset not rewritten');
f=fixture({relinked:true});plan=await f.plan();check(plan.mode==='relink','manual recovery with a new generation detected');result=await f.run();check(result.restored&&f.asset.generation==='200'&&f.stats.restoreCalls===0,'verified recovered object relinked without another copy');
f=fixture({lostAcknowledgement:true});result=await f.run();check(result.verified&&f.stats.restoreCalls===1&&f.asset.generation==='200','ambiguous restore reconciled by metadata and byte hash');
f=fixture({expired:true});plan=await f.plan();check(plan.mode==='backup_required'&&!plan.canRestore,'expired retention requires an actual backup');await assert.rejects(()=>f.run(),e=>e.recoveryCode==='RECOVERY_BACKUP_REQUIRED');checks++;check(f.stats.writes===0&&f.stats.restoreCalls===0,'no fabricated recovery when no source exists');
for(const extra of [{expectedGeneration:'wrong'},{expectedSha256:'0'.repeat(64)}]){f=fixture();await assert.rejects(()=>f.run(extra),e=>e.recoveryCode==='RECOVERY_PLAN_STALE');checks++;check(f.stats.restoreCalls===0&&f.stats.writes===0,'stale/forged plan cannot mutate');}
for(const options of [{relinked:true,corrupt:true},{live:true,corrupt:true},{corrupt:true}]){f=fixture(options);await assert.rejects(()=>f.run(),e=>e.recoveryCode==='RECOVERY_HASH_MISMATCH');checks++;check(f.stats.writes===0,'wrong bytes never replace the asset ledger');}
f=fixture({readFailure:true});await assert.rejects(()=>f.plan(),/STORAGE_DOWNLOAD_FAILED_503/);checks++;check(f.stats.restoreCalls===0&&f.stats.writes===0,'transient read failure is not treated as deletion');
f=fixture({restoreFailure:true});await assert.rejects(()=>f.run(),/STORAGE_RESTORE_FAILED_403/);checks++;check(f.stats.writes===0,'permission failure cannot become success');
f=fixture({casConflict:true});await assert.rejects(()=>f.run(),e=>e.recoveryCode==='RECOVERY_LEDGER_CHANGED');checks++;check(f.asset.generation==='999','concurrent ledger changes are preserved');
f=fixture({archived:true});check((await f.run()).verified,'admin can recover documents of an archived company');
console.log(JSON.stringify({ok:true,checks,realDataWrites:0,coverage:'soft deletion, new generations, stable references, byte hashes, recovery ambiguity, CAS, expiry, disabled accounts and idempotent retry'}));

import assert from'node:assert/strict';import{runLegacyProtectionJob}from'../base44/functions/documentBackupToDrive/legacyProtectionJob.mjs';
const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join(''),digest='a'.repeat(64),user={id:'admin-qa',role:'admin'};let checks=0;const ok=(a,b)=>{assert.deepEqual(a,b);checks++;};
function fixture(count=3,options={}){
 const groups=Array.from({length:count},(_,i)=>({companyId:'company-a',referenceDigest:i.toString(16).padStart(64,'0')})),jobs=[],aliases=[],calls=[],writes=[];let lost=false;
 const matches=(r,q)=>Object.entries(q).every(([k,v])=>r[k]===v);
 const entity={async get(id){return structuredClone(jobs.find(j=>j.id===id));},async filter(q){return structuredClone(jobs.filter(j=>matches(j,q)));},async create(p){jobs.push({id:'job-'+(jobs.length+1),...structuredClone(p)});if(options.createLostAck&&!lost){lost=true;throw Error('Lost create ack');}return structuredClone(jobs.at(-1));},async update(id,p){writes.push(p);Object.assign(jobs.find(j=>j.id===id),structuredClone(p));if(options.cursorLostAck&&p.cursor&&!lost){lost=true;throw Error('Lost cursor ack');}}};
 const service={entities:{DocumentProtectionJob:entity,DocumentLegacyReference:{async filter(q){return aliases.filter(a=>matches(a,q));},async updateMany(q,p){const a=aliases.find(a=>matches(a,q));if(!a)return{updated:0};Object.assign(a,p.$set);return{updated:1};}}}};
 const base={action:'protect_legacy_documents',backupJobId:'backup-qa',planDigest:digest,confirmCopy:true};
 const invoke=(body={},override={})=>runLegacyProtectionJob({service,user,body:{...base,...body},scopeCompanyId:'',leaseHeld:true,hash,loadPlan:async()=>({digest,plan:{backupJobId:'backup-qa',groups}}),protectGroup:async(g,_p,jobId)=>{calls.push(g.referenceDigest);if(options.failure===g.referenceDigest)throw Error('PROTECTION_SOURCE_CHANGED');const old=aliases.find(a=>a.reference_digest===g.referenceDigest);if(old){old.status='verified';return{ok:true,alreadyProtected:true};}aliases.push({id:'alias-'+calls.length,company_id:g.companyId,reference_digest:g.referenceDigest,protection_job_id:jobId,plan_id:digest,status:'verified'});return{ok:true,alreadyProtected:false};},now:()=>0,deadline:40000,...override});
 return{invoke,jobs,aliases,calls,writes,groups,base};
}
for(const actor of [null,{...user,role:'user'},{...user,status:'bloqueado'},{...user,data:{accountAccessStatus:'disabled'}}]){const f=fixture();await assert.rejects(()=>f.invoke({}, {user:actor}),/ADMIN_ONLY/);checks++;ok(f.jobs.length,0);}
let f=fixture();await assert.rejects(()=>f.invoke({}, {leaseHeld:false}),/LEASE_REQUIRED/);checks++;ok(f.jobs.length,0);
for(const body of [{confirmCopy:false},{planDigest:'x'},{planDigest:'b'.repeat(64)},{selection:[]},{selection:[{companyId:'company-a',referenceDigest:'f'.repeat(64)}]},{selection:[{companyId:'bad/path',referenceDigest:digest}]}]){f=fixture();await assert.rejects(()=>f.invoke(body));checks++;ok(f.jobs.length,0);ok(f.calls.length,0);}
f=fixture();let r=await f.invoke();ok(r.cursor,1);ok(r.continueRequired,true);r=await f.invoke({protectionJobId:r.jobId});ok(r.cursor,2);r=await f.invoke({protectionJobId:r.jobId});ok(r.status,'completed');ok(r.verified,3);ok(r.issueCount,0);r=await f.invoke();ok(r.alreadyCompleted,true);ok(f.jobs.length,1);ok(f.calls.length,3);ok(r.financialWrites,0);ok(r.originalsDeleted,0);
let rollback=await f.invoke({action:'rollback_legacy_protection',protectionJobId:r.jobId,confirmDisableLinks:true});while(rollback.continueRequired)rollback=await f.invoke({action:'rollback_legacy_protection',protectionJobId:r.jobId,confirmDisableLinks:true});ok(rollback.status,'rolled_back');ok(rollback.disabledAliases,3);ok(f.aliases.every(a=>a.status==='disabled'),true);
await assert.rejects(()=>f.invoke({protectionJobId:r.jobId}),/REACTIVATION_REQUIRED/);checks++;r=await f.invoke({protectionJobId:r.jobId,reactivateDisabled:true});ok(r.cursor,1);while(r.continueRequired)r=await f.invoke({protectionJobId:r.jobId,reactivateDisabled:true});ok(r.status,'completed');ok(r.reused,3);ok(f.aliases.length,3);
f=fixture(3,{failure:'1'.padStart(64,'0')});r=await f.invoke();while(r.continueRequired)r=await f.invoke({protectionJobId:r.jobId});ok(r.status,'incidents');ok(r.verified,2);ok(r.issueCount,1);ok(r.issues[0].code,'PROTECTION_SOURCE_CHANGED');
const beforeRetryCalls=f.calls.length;r=await f.invoke({protectionJobId:r.jobId,retryIncidents:true});ok(r.cursor,3);ok(r.verified,2);ok(r.issueCount,1);ok(r.targetedRetry,true);ok(f.calls.length-beforeRetryCalls,1);ok(f.jobs[0].previousIssues.length,1);
r=await f.invoke({protectionJobId:r.jobId,retryIncidents:true},{protectGroup:async()=>({ok:true,alreadyProtected:true})});ok(r.status,'completed');ok(r.verified,3);ok(r.issueCount,0);ok(r.cursor,3);ok(f.aliases.length,2);
f=fixture(3,{createLostAck:true});r=await f.invoke();ok(f.jobs.length,1);ok(r.cursor,1);
f=fixture(3,{cursorLostAck:true});await assert.rejects(()=>f.invoke(),/Lost cursor/);checks++;r=await f.invoke();ok(r.cursor,2);ok(f.calls.length,2);ok(f.jobs.length,1);
f=fixture(1203);r=await f.invoke({selection:[f.groups[1000]]});ok(r.total,1);ok(r.status,'completed');ok(f.calls[0],f.groups[1000].referenceDigest);
f=fixture(1203);r=await f.invoke();while(r.continueRequired)r=await f.invoke({protectionJobId:r.jobId});ok(r.total,1203);ok(r.verified,1203);ok(f.calls.length,1203);ok(f.jobs.length,1);
f=fixture();r=await f.invoke({}, {deadline:19000});ok(r.cursor,0);ok(f.calls.length,0);ok(r.continueRequired,true);
await assert.rejects(()=>f.invoke({protectionJobId:r.jobId,action:'rollback_legacy_protection'}),/ROLLBACK_CONFIRMATION/);checks++;

// Explicit bounded throughput preserves per-file commits and the default one-file contract.
f=fixture(8);r=await f.invoke({fileBudget:3});ok(r.cursor,3);ok(f.jobs.length,1);ok(f.writes.filter(w=>w.cursor).map(w=>w.cursor),[1,2,3]);
r=await f.invoke({fileBudget:3,protectionJobId:r.jobId});ok(r.cursor,6);r=await f.invoke({fileBudget:3,protectionJobId:r.jobId});ok(r.cursor,8);ok(r.status,'completed');ok(f.calls.length,8);
f=fixture(4);r=await f.invoke({fileBudget:2000});ok(r.cursor,1);
f=fixture(4);r=await f.invoke({fileBudget:3},{deadline:19000});ok(r.cursor,0);ok(r.continueRequired,true);
f=fixture(4,{failure:'1'.padStart(64,'0')});r=await f.invoke({fileBudget:3});ok(r.cursor,3);ok(r.verified,2);ok(r.issueCount,1);ok(f.writes.filter(w=>w.cursor).map(w=>w.cursor),[1,2,3]);
f=fixture(4,{cursorLostAck:true});await assert.rejects(()=>f.invoke({fileBudget:3}),/Lost cursor/);checks++;r=await f.invoke({fileBudget:3});ok(r.cursor,4);ok(f.jobs.length,1);ok(f.calls.length,6);ok(f.aliases.length,4);ok(r.reused,2);ok(r.verified,4);
f=fixture(1203);r=await f.invoke({fileBudget:3});while(r.continueRequired)r=await f.invoke({fileBudget:3,protectionJobId:r.jobId});ok(r.verified,1203);ok(f.calls.length,1203);ok(f.jobs.length,1);ok(r.financialWrites,0);ok(r.originalsDeleted,0);

f=fixture(6);let active=0,maxActive=0;r=await f.invoke({fileBudget:3},{protectGroup:async()=>{active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return{ok:true};}});ok(r.cursor,3);ok(maxActive,3);ok(active,0);
f=fixture(4);f.groups[0].sha256='same-content';f.groups[1].sha256='same-content';r=await f.invoke({fileBudget:3});ok(r.cursor,1);ok(f.calls.length,1);r=await f.invoke({fileBudget:3,protectionJobId:r.jobId});ok(r.cursor,4);ok(f.calls.length,4);
f=fixture(6);let attempts=0;r=await f.invoke({fileBudget:3},{protectGroup:async()=>{attempts++;if(attempts===2)throw Error('untrusted error with confidential details');return{ok:true};}});ok(r.cursor,3);ok(r.verified,2);ok(r.issueCount,1);ok(r.issues[0].code,'PROTECTION_COPY_INTERRUPTED');ok(JSON.stringify(r).includes('confidential'),false);
// Retrying cannot restart a running copy or accept a corrupt incident binding.
f=fixture(3);r=await f.invoke();await assert.rejects(()=>f.invoke({protectionJobId:r.jobId,retryIncidents:true}),/COPY_IN_PROGRESS/);checks++;ok(f.calls.length,1);
f=fixture(3,{failure:'1'.padStart(64,'0')});r=await f.invoke({fileBudget:3});f.jobs[0].issues[0].companyId='foreign';await assert.rejects(()=>f.invoke({protectionJobId:r.jobId,retryIncidents:true}),/JOB_CHANGED/);checks++;ok(f.calls.length,3);
f=fixture(3,{failure:'1'.padStart(64,'0')});r=await f.invoke({fileBudget:3});const stoppedBefore=f.calls.length;r=await f.invoke({protectionJobId:r.jobId,retryIncidents:true},{deadline:19000});ok(r.issueCount,1);ok(r.verified,2);ok(f.calls.length,stoppedBefore);
// Recovery after a saved targeted result must never apply its counter twice.
r=await f.invoke({protectionJobId:r.jobId,retryIncidents:true},{protectGroup:async()=>({ok:true,alreadyProtected:true})});ok(r.verified,3);r=await f.invoke({protectionJobId:r.jobId,retryIncidents:true});ok(r.verified,3);ok(r.alreadyCompleted,true);
console.log(JSON.stringify({ok:true,checks,largePlan:1203,resumable:true,financialWrites:0,cloudCalls:0,originalsDeleted:0}));

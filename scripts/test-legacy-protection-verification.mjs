import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{verifyLegacyProtectionGroup,runLegacyProtectionVerification}from'../base44/functions/documentBackupToDrive/legacyProtectionVerification.mjs';
const hash=async x=>createHash('sha256').update(x).digest('hex'),encode=x=>new TextEncoder().encode(x),user={id:'qa-admin',role:'admin'},planDigest='b'.repeat(64);let checks=0;
const ok=(a,b)=>{assert.deepEqual(a,b);checks++;};const rejects=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++;};
const bytes=encode('%PDF-1.7\nSYNTHETIC QA\n'),sha=await hash(bytes),reference='https://media.base44.com/files/public/6a00fec50cc522a74ddde4b2/qa-only.pdf',referenceDigest=await hash(encode(reference));
function groupFixture(){
 const group={companyId:'company-qa',reference,referenceDigest,sha256:sha,size:bytes.length,backupFileIds:['drive-qa'],sources:[{entity:'Document',id:'source-qa',field:'file_url'}]};
 const alias={id:'alias-qa',company_id:'company-qa',reference_digest:referenceDigest,asset_id:'asset-qa',sha256:sha,size:bytes.length,plan_id:planDigest,status:'verified',secret:'EXCLUDED'},asset={id:'asset-qa',company_id:'company-qa',sha256:sha,size:bytes.length,status:'ready',object_name:'companies/company-qa/qa.pdf',generation:'12345',original_name:'QA.pdf',mime_type:'application/pdf',private_key:'EXCLUDED'};
 const backup={documentEntity:'DocumentAsset',documentId:'asset-qa',clientAccountId:'company-qa',checksum:sha,fileSize:bytes.length,fileStorageUrl:'https://taxeaportal.com/private-document/asset-qa',driveFileId:'drive-qa',backupStatus:'verified'};
 let sourceChecks=0,reads=0;const service={entities:{DocumentLegacyReference:{filter:async()=>[alias]},DocumentBackupRecord:{filter:async()=>[backup]}}};
 return{group,alias,asset,backup,get sourceChecks(){return sourceChecks},get reads(){return reads},args:{service,user,group,planDigest,hash,verifySources:async()=>{sourceChecks++;},readAsset:async()=>{reads++;return{asset,bytes};}}};
}
let f=groupFixture(),result=await verifyLegacyProtectionGroup(f.args);ok(result.asset.id,'asset-qa');ok(result.alias.id,'alias-qa');ok(result.backupFileIds,['drive-qa']);ok(f.sourceChecks,1);ok(JSON.stringify(result).includes('EXCLUDED'),false);ok(result.sources,f.group.sources);
for(const actor of [null,{...user,role:'user'},{...user,data:{accountAccessStatus:'disabled'}}]){f=groupFixture();await rejects(()=>verifyLegacyProtectionGroup({...f.args,user:actor}),/ADMIN_ONLY/);ok(f.reads,0);}
f=groupFixture();await rejects(()=>verifyLegacyProtectionGroup({...f.args,verifySources:async()=>{throw Error('PROTECTION_SOURCE_CHANGED')}}),/SOURCE_CHANGED/);ok(f.reads,0);
for(const patch of [{company_id:'other'},{reference_digest:'c'.repeat(64)},{plan_id:'c'.repeat(64)},{status:'disabled'},{size:1},{sha256:'f'.repeat(64)},{asset_id:'../escape'}]){f=groupFixture();Object.assign(f.alias,patch);await rejects(()=>verifyLegacyProtectionGroup(f.args),/ALIAS_UNVERIFIED/);ok(f.reads,0);}
for(const patch of [{company_id:'other'},{id:'other'},{status:'uploading'},{object_name:'companies/foreign/qa.pdf'},{generation:'not-a-generation'},{size:1},{sha256:'c'.repeat(64)}]){f=groupFixture();Object.assign(f.asset,patch);await rejects(()=>verifyLegacyProtectionGroup(f.args),/PRIVATE_COPY_UNVERIFIED/);}
f=groupFixture();await rejects(()=>verifyLegacyProtectionGroup({...f.args,readAsset:async()=>({asset:f.asset,bytes:encode('CORRUPTED')})}),/PRIVATE_COPY_UNVERIFIED/);
for(const patch of [{clientAccountId:'other'},{checksum:'f'.repeat(64)},{fileSize:1},{driveFileId:'foreign'},{backupStatus:'failed'},{fileStorageUrl:'https://taxeaportal.com/private-document/foreign'}]){f=groupFixture();Object.assign(f.backup,patch);await rejects(()=>verifyLegacyProtectionGroup(f.args),/BACKUP_BINDING_UNVERIFIED/);}
const canonical=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
async function fixture(count=25,options={}){
 const groups=Array.from({length:count},(_,i)=>({companyId:'company-qa',referenceDigest:i.toString(16).padStart(64,'0')})),selection=[];
 const job={id:'job-qa',status:'completed',scopeCompanyId:'',backupJobId:'backup-qa',planDigest,total:count,cursor:count,verified:count,issueCount:0,selectionKeys:selection,selectionDigest:await hash(encode(canonical({planDigest,scopeCompanyId:'',selection})))};
 const archives=new Map(),writes=[];let calls=0,lost=false,active=0,maxActive=0,gets=0;
 const entity={get:async()=>{gets++;return structuredClone(job);},update:async(_id,patch)=>{writes.push(structuredClone(patch));Object.assign(job,structuredClone(patch));if(options.lostCursor&&!lost&&patch.verificationCursor>0){lost=true;throw Error('LOST_CURSOR_ACK');}}};
 const args={service:{entities:{DocumentProtectionJob:entity}},user,scopeCompanyId:'',leaseHeld:true,hash,now:()=>1000,deadline:90000,loadPlan:async()=>({digest:planDigest,plan:{groups}}),verifyGroup:async group=>{calls++;active++;maxActive=Math.max(maxActive,active);try{await new Promise(resolve=>setTimeout(resolve,0));if(group.referenceDigest===options.failure)throw Error('PROTECTION_PRIVATE_COPY_UNVERIFIED');return{synthetic:true,referenceDigest:group.referenceDigest};}finally{active--;}}
 ,writeArchive:async(name,text)=>{const digest=await hash(encode(text));let saved=archives.get(name);if(saved)ok(saved.text,text);else{saved={id:'drive-'+archives.size,text,sha256:digest};archives.set(name,saved);}if(options.lostArchive&&!lost){lost=true;throw Error('LOST_ARCHIVE_ACK');}return{id:saved.id,sha256:options.badArchiveHash?'f'.repeat(64):digest};}};
 const body={action:'verify_legacy_protection',protectionJobId:'job-qa',planDigest},invoke=(b={},o={})=>runLegacyProtectionVerification({...args,body:{...body,...b},...o});
 return{job,groups,archives,writes,args,invoke,get calls(){return calls},get maxActive(){return maxActive},get gets(){return gets}};
}
for(const actor of [null,{...user,role:'user'},{...user,status:'suspendido'}]){f=await fixture();await rejects(()=>f.invoke({}, {user:actor}),/ADMIN_ONLY/);ok(f.gets,0);}
f=await fixture();await rejects(()=>f.invoke({}, {leaseHeld:false}),/LEASE_REQUIRED/);ok(f.gets,0);
for(const patch of [{status:'processing'},{cursor:1},{verified:1},{issueCount:1}]){f=await fixture();Object.assign(f.job,patch);await rejects(()=>f.invoke(),/COPY_NOT_COMPLETE/);ok(f.calls,0);}
for(const patch of [{scopeCompanyId:'foreign'},{planDigest:'c'.repeat(64)}]){f=await fixture();Object.assign(f.job,patch);await rejects(()=>f.invoke(),/JOB_UNAVAILABLE/);}
f=await fixture();await rejects(()=>f.invoke({}, {loadPlan:async()=>({digest:'c'.repeat(64)})}),/PLAN_CHANGED/);ok(f.calls,0);
f=await fixture();f.job.selectionDigest='c'.repeat(64);await rejects(()=>f.invoke(),/JOB_CHANGED/);ok(f.calls,0);
f=await fixture();result=await f.invoke();ok(result.verificationCursor,12);ok(result.verificationChecked,12);ok(result.continueRequired,true);ok(f.maxActive,3);ok(f.archives.size,1);
while(result.continueRequired)result=await f.invoke();ok(result.verificationStatus,'ok');ok(result.verificationChecked,25);ok(result.verificationIssueCount,0);ok(result.recoveryManifestReady,true);ok(f.archives.size,4);ok(result.financialWrites,0);ok(result.originalsDeleted,0);
const callsBefore=f.calls;result=await f.invoke();ok(result.alreadyVerified,true);ok(f.calls,callsBefore);ok(f.archives.size,4);
f=await fixture(25,{lostArchive:true});await rejects(()=>f.invoke(),/LOST_ARCHIVE_ACK/);ok(f.job.verificationCursor,0);result=await f.invoke();ok(result.verificationCursor,12);ok(f.archives.size,1);ok(f.job.verificationChecked,12);
f=await fixture(25,{lostCursor:true});await rejects(()=>f.invoke(),/LOST_CURSOR_ACK/);ok(f.job.verificationCursor,12);result=await f.invoke();ok(result.verificationCursor,24);ok(f.calls,24);ok(f.archives.size,2);
f=await fixture(25,{badArchiveHash:true});await rejects(()=>f.invoke(),/ARCHIVE_UNVERIFIED/);ok(f.job.verificationCursor,0);ok(f.job.verificationStatus,'checking');
f=await fixture(25,{failure:'1'.padStart(64,'0')});result=await f.invoke();while(result.continueRequired)result=await f.invoke();ok(result.verificationStatus,'incidents');ok(result.verificationChecked,24);ok(result.verificationIssueCount,1);ok(result.recoveryManifestReady,false);ok(result.verificationIssues[0].index,1);
f=await fixture();result=await f.invoke({}, {deadline:20000});ok(result.verificationCursor,0);ok(f.calls,0);
f=await fixture();await f.invoke();f.job.verificationCursor=-1;await rejects(()=>f.invoke(),/STATE_INVALID/);ok(f.calls,12);
f=await fixture(1);await f.invoke();f.job.verificationStatus='checking';f.job.verificationParts[0].start=1;await rejects(()=>f.invoke(),/PARTS_INVALID/);
f=await fixture(1203);result=await f.invoke();while(result.continueRequired)result=await f.invoke();ok(result.verificationChecked,1203);ok(result.verificationCursor,1203);ok(result.verificationStatus,'ok');ok(f.calls,1203);ok(f.maxActive,3);ok(f.archives.size,102);
console.log(JSON.stringify({ok:true,checks,fullPlan:1203,realCloudCalls:0,financialWrites:0,originalsDeleted:0,coverage:'Fresh private bytes, company/source/alias binding, Drive backup link, resumable hash-checked metadata archive, lost acknowledgements, partial failures and ordered progress'}));

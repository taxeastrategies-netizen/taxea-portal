import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{loadLegacyProtectionPlan}from'../base44/functions/documentBackupToDrive/legacyPlanLoader.mjs';
let checks=0,reads=0,gets=0;const hash=async b=>createHash('sha256').update(b).digest('hex'),bytes=v=>new TextEncoder().encode(JSON.stringify(v));
const reference='https://base44.app/api/apps/6a00fec50cc522a74ddde4b2/files/mp/public/6a00fec50cc522a74ddde4b2/qa.pdf',source={entity:'Document',urlField:'file_url',companyField:'company_id'},user={id:'qa-admin',role:'admin'};
const index={version:4,jobId:'backup-qa',scopeCompanyId:'',cutoff:'2026-10-31T10:00:00Z',unassigned:0,excludedExternal:0,documents:[{source,record:{id:'document-qa',company_id:'company-qa',file_url:reference}}]},manifest={totalDocuments:1,documents:[{documentEntity:'Document',documentId:'document-qa',clientAccountId:'company-qa',driveFileId:'copy-qa',checksum:'a'.repeat(64),size:100,status:'backed_up'}]};
const indexBytes=bytes(index),manifestBytes=bytes(manifest),base={id:'backup-qa',scopeCompanyId:'',runVersion:'snapshot-v4',status:'completed',verificationStatus:'ok',sourceIndexCount:1,documentsScanned:1,documentsVerified:1,verificationChecked:1,verificationChecksumChecked:1,documentsFailed:0,verificationMissing:0,verificationIssues:[],sourceIndexDriveFileId:'index-qa',manifestDriveFileId:'manifest-qa',sourceIndexChecksum:await hash(indexBytes),manifestChecksum:await hash(manifestBytes)};
let job=base;
const service={entities:{BackupJob:{async get(){gets++;return job;},async update(){throw Error('NO WRITES ALLOWED');}}}};
const args={service,user,jobId:base.id,hash,sources:[source],privateId:()=>'',async readPrivateDriveFile(id){reads++;assert.ok(['index-qa','manifest-qa'].includes(id));return id==='index-qa'?indexBytes:manifestBytes;}};
for(const u of [null,{id:'qa',role:'user'},{...user,status:'suspendido'},{...user,data:{accountAccessStatus:'disabled'}}]){await assert.rejects(()=>loadLegacyProtectionPlan({...args,user:u}),/ADMIN_ONLY/);checks++;}
assert.equal(gets,0);checks++;
for(const jobId of ['', '../escape', 'https://evil.test']){await assert.rejects(()=>loadLegacyProtectionPlan({...args,jobId}),/JOB_INVALID/);checks++;}
for(const patch of [{status:'failed'},{verificationStatus:'partial'},{verificationStatus:'incidents'},{runVersion:'snapshot-v3'},{sourceIndexCount:2},{documentsVerified:0},{verificationChecked:0},{verificationChecksumChecked:0},{verificationMissing:1},{documentsFailed:1},{verificationIssues:[{code:'MISSING'}]},{manifestChecksum:''},{sourceIndexDriveFileId:'../escape'}]){job={...base,...patch};await assert.rejects(()=>loadLegacyProtectionPlan(args),/BACKUP_NOT_VERIFIED/);checks++;}
job={...base,scopeCompanyId:'foreign'};await assert.rejects(()=>loadLegacyProtectionPlan(args),/JOB_UNAVAILABLE/);checks++;
job=null;await assert.rejects(()=>loadLegacyProtectionPlan(args),/JOB_UNAVAILABLE/);checks++;
assert.equal(reads,0);checks++;
job=base;
await assert.rejects(()=>loadLegacyProtectionPlan({...args,readPrivateDriveFile:async()=>new Uint8Array([0])}),/HASH_MISMATCH/);checks++;
await assert.rejects(()=>loadLegacyProtectionPlan({...args,readPrivateDriveFile:async()=>{throw Error('DRIVE_PRIVATE_ACL_DENIED');}}),/ACL_DENIED/);checks++;
const result=await loadLegacyProtectionPlan(args),replay=await loadLegacyProtectionPlan(args);
assert.equal(result.digest,replay.digest);assert.equal(result.summary.eligibleFiles,1);assert.equal(result.summary.blockedFiles,0);assert.equal(result.summary.migrationStarted,false);assert.equal(result.summary.financialWrites,0);assert.equal(result.summary.originalsDeleted,0);assert.equal(JSON.stringify(result.summary).includes(reference),false);assert.equal(JSON.stringify(result.summary).includes('copy-qa'),false);checks+=8;
console.log(JSON.stringify({ok:true,checks,realDataRead:0,realCloudCalls:0,filesMoved:0,sourceWrites:0,deterministicSummaryOnly:true}));

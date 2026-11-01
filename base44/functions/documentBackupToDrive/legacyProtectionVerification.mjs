import{protectionAdmin}from'./legacyProtectionExecutor.mjs';
const fail=code=>{throw Error(code);},id=v=>/^[A-Za-z0-9_-]{1,128}$/.test(String(v||'')),hex=v=>/^[a-f0-9]{64}$/.test(String(v||''));
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const assetFields=['id','company_id','object_name','generation','sha256','size','mime_type','original_name','status','storage_provider','uploaded_by','purpose','verified_at','restored_at','restore_source_generation'];
const aliasFields=['id','company_id','reference_digest','asset_id','sha256','size','plan_id','protection_job_id','status','source_references','linked_by','linked_at'];
const pick=(value,fields)=>Object.fromEntries(fields.filter(k=>value[k]!==undefined).map(k=>[k,value[k]]));
export function protectionVerificationSummary(job){return{verificationStatus:job.verificationStatus||'not_started',verificationCursor:Number(job.verificationCursor||0),verificationChecked:Number(job.verificationChecked||0),verificationIssueCount:Number(job.verificationIssueCount||0),verificationIssues:job.verificationIssues||[],recoveryManifestReady:job.verificationStatus==='ok'&&!!job.recoveryManifestDriveFileId&&hex(job.recoveryManifestSha256),verificationFinishedAt:job.verificationFinishedAt||''};}
export async function verifyLegacyProtectionGroup({service,user,group,planDigest,hash,verifySources,readAsset}){
 if(!protectionAdmin(user))fail('PROTECTION_ADMIN_ONLY');
 if(!id(group?.companyId)||!hex(group.referenceDigest)||!hex(group.sha256)||!hex(planDigest)||!Number.isSafeInteger(group.size)||group.size<1||group.size>25*1024*1024)fail('PROTECTION_GROUP_INVALID');
 await verifySources(group);
 const aliases=await service.entities.DocumentLegacyReference.filter({company_id:group.companyId,reference_digest:group.referenceDigest},'id',2);
 if(aliases.length!==1)fail('PROTECTION_ALIAS_UNAVAILABLE');const alias=aliases[0];
 if(alias.company_id!==group.companyId||alias.reference_digest!==group.referenceDigest||alias.status!=='verified'||alias.plan_id!==planDigest||!id(alias.asset_id)||alias.sha256!==group.sha256||alias.size!==group.size)fail('PROTECTION_ALIAS_UNVERIFIED');
 const{asset,bytes}=await readAsset(alias.asset_id,group.companyId);
 if(asset?.id!==alias.asset_id||asset.company_id!==group.companyId||asset.status!=='ready'||!String(asset.object_name||'').startsWith('companies/'+group.companyId+'/')||!/^\d+$/.test(asset.generation||'')||asset.sha256!==group.sha256||asset.size!==group.size||bytes?.length!==group.size||await hash(bytes)!==group.sha256)fail('PROTECTION_PRIVATE_COPY_UNVERIFIED');
 const backups=await service.entities.DocumentBackupRecord.filter({documentEntity:'DocumentAsset',documentId:asset.id,clientAccountId:group.companyId,checksum:group.sha256},'id',20);
 const matching=backups.filter(b=>b.fileStorageUrl==='https://taxeaportal.com/private-document/'+asset.id&&b.clientAccountId===group.companyId&&b.checksum===group.sha256&&b.fileSize===group.size&&group.backupFileIds.includes(b.driveFileId)&&['verified','backed_up'].includes(b.backupStatus));
 if(!matching.length)fail('PROTECTION_BACKUP_BINDING_UNVERIFIED');
 return{companyId:group.companyId,reference:group.reference,referenceDigest:group.referenceDigest,sha256:group.sha256,size:group.size,sources:group.sources,asset:pick(asset,assetFields),alias:pick(alias,aliasFields),backupFileIds:[...new Set(matching.map(b=>b.driveFileId))].sort()};
}
export async function runLegacyProtectionVerification({service,user,body,scopeCompanyId='',leaseHeld=false,loadPlan,hash,verifyGroup,writeArchive,now=Date.now,deadline=now()+90000}){
 if(!protectionAdmin(user))fail('PROTECTION_ADMIN_ONLY');if(!leaseHeld)fail('PROTECTION_LEASE_REQUIRED');
 if(body.action!=='verify_legacy_protection'||!id(body.protectionJobId)||!hex(body.planDigest))fail('PROTECTION_VERIFICATION_REQUEST_INVALID');
 const entity=service.entities.DocumentProtectionJob;let job=await entity.get(body.protectionJobId);
 if(!job||String(job.scopeCompanyId||'')!==scopeCompanyId||job.planDigest!==body.planDigest)fail('PROTECTION_JOB_UNAVAILABLE');
 if(job.status!=='completed'||job.cursor!==job.total||job.verified!==job.total||job.issueCount!==0)fail('PROTECTION_COPY_NOT_COMPLETE');
 const loaded=await loadPlan(job.backupJobId);if(loaded.digest!==job.planDigest)fail('PROTECTION_PLAN_CHANGED');
 const selection=job.selectionKeys;if(!Array.isArray(selection)||selection.some(k=>typeof k!=='string'))fail('PROTECTION_SELECTION_INVALID');
 const groups=selection.length?loaded.plan.groups.filter(g=>selection.includes(g.companyId+'|'+g.referenceDigest)):loaded.plan.groups;
 const selectionDigest=await hash(new TextEncoder().encode(canonical({planDigest:loaded.digest,scopeCompanyId,selection})));
 if(selectionDigest!==job.selectionDigest||groups.length!==job.total)fail('PROTECTION_JOB_CHANGED');
 const update=async patch=>{await entity.update(job.id,patch);job={...job,...patch};};
 if(!job.verificationStatus||body.restartVerification===true)await update({verificationStatus:'checking',verificationCursor:0,verificationChecked:0,verificationIssueCount:0,verificationIssues:[],verificationParts:[],recoveryManifestDriveFileId:'',recoveryManifestSha256:'',verificationStartedAt:new Date(now()).toISOString(),verificationFinishedAt:''});
 if(['ok','incidents'].includes(job.verificationStatus))return{ok:true,jobId:job.id,total:job.total,...protectionVerificationSummary(job),continueRequired:false,alreadyVerified:true,financialWrites:0,originalsDeleted:0};
 if(job.verificationStatus!=='checking'||!Number.isSafeInteger(job.verificationCursor)||job.verificationCursor<0||job.verificationCursor>groups.length||!Array.isArray(job.verificationParts))fail('PROTECTION_VERIFICATION_STATE_INVALID');
 if(job.verificationCursor<groups.length&&now()<deadline-25000){
  const start=job.verificationCursor,batch=groups.slice(start,start+12),results=[];let next=0;
  await Promise.all(Array.from({length:Math.min(3,batch.length)},async()=>{for(;;){if(now()>=deadline-25000)return;const at=next++;if(at>=batch.length)return;try{results[at]={index:start+at,entry:await verifyGroup(batch[at],loaded.digest)};}catch(error){results[at]={index:start+at,code:/^(PROTECTION|STORAGE)_[A-Z_0-9]+$/.test(error?.message||'')?error.message:'PROTECTION_VERIFICATION_INTERRUPTED'};}}}));
  const entries=results.filter(r=>r.entry).map(r=>r.entry),issues=results.filter(r=>r.code).map(({index,code})=>({index,code}));
  const part={version:1,kind:'taxea-document-protection-ledger-part',protectionJobId:job.id,backupJobId:job.backupJobId,planDigest:loaded.digest,start,count:results.length,entries,issues};
  const text=canonical(part),saved=await writeArchive('protection_ledger_'+job.id+'_'+start+'.json',text);
  if(!id(saved?.id)||saved.sha256!==await hash(new TextEncoder().encode(text)))fail('PROTECTION_ARCHIVE_UNVERIFIED');
  await update({verificationCursor:start+results.length,verificationChecked:Number(job.verificationChecked||0)+entries.length,verificationIssueCount:Number(job.verificationIssueCount||0)+issues.length,verificationIssues:[...(job.verificationIssues||[]),...issues].slice(0,100),verificationParts:[...job.verificationParts,{start,count:results.length,verified:entries.length,id:saved.id,sha256:saved.sha256}]});
 }
 if(job.verificationCursor===groups.length&&now()<deadline-10000){
  let end=0,checked=0;for(const part of job.verificationParts){if(part.start!==end||!Number.isSafeInteger(part.count)||part.count<1||part.count>12||!id(part.id)||!hex(part.sha256))fail('PROTECTION_ARCHIVE_PARTS_INVALID');end+=part.count;checked+=part.verified;}
  if(end!==job.total||checked!==job.verificationChecked||job.verificationChecked+job.verificationIssueCount!==job.total)fail('PROTECTION_ARCHIVE_PARTS_INVALID');
  const index={version:1,kind:'taxea-document-protection-ledger',protectionJobId:job.id,backupJobId:job.backupJobId,planDigest:loaded.digest,scopeCompanyId,files:job.total,verified:job.verificationChecked,incidents:job.verificationIssueCount,parts:job.verificationParts,scope:'Document metadata, private aliases and verified backup locations. No invoice, journal, account or authentication data.'};
  const text=canonical(index),saved=await writeArchive('protection_recovery_index_'+job.id+'.json',text);
  if(!id(saved?.id)||saved.sha256!==await hash(new TextEncoder().encode(text)))fail('PROTECTION_ARCHIVE_UNVERIFIED');
  await update({verificationStatus:job.verificationIssueCount?'incidents':'ok',recoveryManifestDriveFileId:saved.id,recoveryManifestSha256:saved.sha256,verificationFinishedAt:new Date(now()).toISOString()});
 }
 return{ok:true,jobId:job.id,total:job.total,...protectionVerificationSummary(job),continueRequired:job.verificationStatus==='checking',financialWrites:0,originalsDeleted:0};
}

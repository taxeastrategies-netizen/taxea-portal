import{protectionAdmin}from'./legacyProtectionExecutor.mjs';
const id=v=>/^[A-Za-z0-9_-]{1,128}$/.test(String(v||'')),driveId=v=>/^[A-Za-z0-9_-]{1,200}$/.test(String(v||'')),hex=v=>/^[a-f0-9]{64}$/.test(String(v||'')),fail=c=>{throw Error(c);};
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export const recoveryDrillSummary=job=>({recoveryDrillStatus:job.recoveryDrillStatus||'not_started',recoveryDrillCursor:Number(job.recoveryDrillCursor||0),recoveryDrillVerified:Number(job.recoveryDrillVerified||0),recoveryDrillIssueCount:Number(job.recoveryDrillIssueCount||0),recoveryDrillIssues:job.recoveryDrillIssues||[],recoveryDrillFinishedAt:job.recoveryDrillFinishedAt||'',virtualAssetsRebuilt:Object.keys(job.recoveryDrillAssets||{}).length,virtualAliasesRebuilt:(job.recoveryDrillAliases||[]).length,metadataReconstructionOnly:true,restoredFinancialRows:0,nativeFilesRead:0});
export async function validateRecoveryArchiveEntry({entry,planDigest,hash,normalizeReference,sources}){
 const e=entry,a=e?.asset,l=e?.alias,reference=normalizeReference(e?.reference);
 if(!id(e?.companyId)||!reference||reference!==e.reference||!hex(e.referenceDigest)||await hash(new TextEncoder().encode(reference))!==e.referenceDigest||!hex(e.sha256)||!Number.isSafeInteger(e.size)||e.size<1||e.size>25*1024*1024)fail('PROTECTION_ARCHIVE_ENTRY_INVALID');
 if(!id(a?.id)||a.company_id!==e.companyId||a.status!=='ready'||a.sha256!==e.sha256||a.size!==e.size||!/^\d+$/.test(a.generation||'')||!String(a.object_name||'').startsWith('companies/'+e.companyId+'/')||!/^companies\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(a.object_name))fail('PROTECTION_ARCHIVE_ASSET_INVALID');
 if(!id(l?.id)||l.company_id!==e.companyId||l.asset_id!==a.id||l.reference_digest!==e.referenceDigest||l.sha256!==e.sha256||l.size!==e.size||l.plan_id!==planDigest||l.status!=='verified')fail('PROTECTION_ARCHIVE_ALIAS_INVALID');
 if(!Array.isArray(e.backupFileIds)||!e.backupFileIds.length||e.backupFileIds.some(v=>!driveId(v)))fail('PROTECTION_ARCHIVE_BACKUP_INVALID');
 const catalog=new Map(sources.map(s=>[s.entity+':'+s.urlField+':'+s.companyField,s]));
 if(!Array.isArray(e.sources)||!e.sources.length)fail('PROTECTION_ARCHIVE_SOURCE_INVALID');
 for(const source of e.sources){const allowed=catalog.get(source.sourceKey);if(!allowed||source.entity!==allowed.entity||source.field!==allowed.urlField||!id(source.id))fail('PROTECTION_ARCHIVE_SOURCE_INVALID');}
 return{assetKey:a.id,assetFingerprint:await hash(new TextEncoder().encode(canonical(a))),aliasKey:e.companyId+'|'+e.referenceDigest};
}
export async function runLegacyRecoveryDrill({service,user,body,scopeCompanyId='',leaseHeld=false,readArchive,readArchivedAsset,hash,normalizeReference,sources,now=Date.now,deadline=now()+90000}){
 if(!protectionAdmin(user))fail('PROTECTION_ADMIN_ONLY');if(!leaseHeld)fail('PROTECTION_LEASE_REQUIRED');
 if(body.action!=='drill_legacy_protection_recovery'||!id(body.protectionJobId)||!hex(body.planDigest))fail('PROTECTION_DRILL_REQUEST_INVALID');
 const entity=service.entities.DocumentProtectionJob;let job=await entity.get(body.protectionJobId);
 if(!job||String(job.scopeCompanyId||'')!==scopeCompanyId||job.planDigest!==body.planDigest||job.status!=='completed'||job.verificationStatus!=='ok'||job.verificationIssueCount!==0||job.verificationChecked!==job.total||!driveId(job.recoveryManifestDriveFileId)||!hex(job.recoveryManifestSha256))fail('PROTECTION_DRILL_ARCHIVE_UNAVAILABLE');
 const bytes=await readArchive(job.recoveryManifestDriveFileId);if(await hash(bytes)!==job.recoveryManifestSha256)fail('PROTECTION_ARCHIVE_HASH_MISMATCH');
 let index;try{index=JSON.parse(new TextDecoder().decode(bytes));}catch{fail('PROTECTION_ARCHIVE_INVALID');}
 if(index?.version!==1||index.kind!=='taxea-document-protection-ledger'||index.protectionJobId!==job.id||index.backupJobId!==job.backupJobId||index.planDigest!==job.planDigest||String(index.scopeCompanyId||'')!==scopeCompanyId||index.files!==job.total||index.verified!==job.total||index.incidents!==0||!Array.isArray(index.parts))fail('PROTECTION_ARCHIVE_INVALID');
 let end=0;for(const p of index.parts){if(p.start!==end||!Number.isSafeInteger(p.count)||p.count<1||p.count>12||p.verified!==p.count||!driveId(p.id)||!hex(p.sha256))fail('PROTECTION_ARCHIVE_PARTS_INVALID');end+=p.count;}if(end!==job.total)fail('PROTECTION_ARCHIVE_PARTS_INVALID');
 const update=async patch=>{await entity.update(job.id,patch);job={...job,...patch};};
 if(!job.recoveryDrillStatus||body.restartDrill===true)await update({recoveryDrillStatus:'checking',recoveryDrillCursor:0,recoveryDrillVerified:0,recoveryDrillIssueCount:0,recoveryDrillIssues:[],recoveryDrillAssets:{},recoveryDrillAliases:[],recoveryDrillStartedAt:new Date(now()).toISOString(),recoveryDrillFinishedAt:''});
 if(['ok','incidents'].includes(job.recoveryDrillStatus))return{ok:true,jobId:job.id,total:job.total,...recoveryDrillSummary(job),continueRequired:false,alreadyChecked:true,sourceRecordsWritten:0,originalsDeleted:0};
 const cursor=job.recoveryDrillCursor;if(job.recoveryDrillStatus!=='checking'||!Number.isSafeInteger(cursor)||cursor<0||cursor>job.total||!job.recoveryDrillAssets||typeof job.recoveryDrillAssets!=='object'||!Array.isArray(job.recoveryDrillAliases))fail('PROTECTION_DRILL_STATE_INVALID');
 if(cursor<job.total&&now()<deadline-20000){
  const pointer=index.parts.find(p=>p.start<=cursor&&cursor<p.start+p.count),partBytes=await readArchive(pointer.id);if(await hash(partBytes)!==pointer.sha256)fail('PROTECTION_ARCHIVE_HASH_MISMATCH');
  let part;try{part=JSON.parse(new TextDecoder().decode(partBytes));}catch{fail('PROTECTION_ARCHIVE_INVALID');}
  if(part?.version!==1||part.kind!=='taxea-document-protection-ledger-part'||part.protectionJobId!==job.id||part.backupJobId!==job.backupJobId||part.planDigest!==job.planDigest||part.start!==pointer.start||part.count!==pointer.count||!Array.isArray(part.entries)||part.entries.length!==pointer.count||!Array.isArray(part.issues)||part.issues.length)fail('PROTECTION_ARCHIVE_PARTS_INVALID');
  const offset=cursor-pointer.start,batch=part.entries.slice(offset,offset+6),results=[];let next=0;
  await Promise.all(Array.from({length:Math.min(3,batch.length)},async()=>{for(;;){if(now()>=deadline-20000)return;const at=next++;if(at>=batch.length)return;try{const entry=batch[at],keys=await validateRecoveryArchiveEntry({entry,planDigest:job.planDigest,hash,normalizeReference,sources});const content=await readArchivedAsset(entry.asset);if(content.length!==entry.size||await hash(content)!==entry.sha256)fail('PROTECTION_ARCHIVE_CONTENT_MISMATCH');results[at]={keys};}catch(error){results[at]={code:/^(PROTECTION|STORAGE)_[A-Z_0-9]+$/.test(error?.message||'')?error.message:'PROTECTION_DRILL_INTERRUPTED'};}}}));
  const assets=Object.assign(Object.create(null),job.recoveryDrillAssets),aliases=new Set(job.recoveryDrillAliases),issues=[];let verified=0;
  for(let at=0;at<results.length;at++){const r=results[at];let code=r.code;if(r.keys){if(aliases.has(r.keys.aliasKey))code='PROTECTION_ARCHIVE_ALIAS_DUPLICATE';else if(assets[r.keys.assetKey]&&assets[r.keys.assetKey]!==r.keys.assetFingerprint)code='PROTECTION_ARCHIVE_ASSET_CONFLICT';else{assets[r.keys.assetKey]=r.keys.assetFingerprint;aliases.add(r.keys.aliasKey);verified++;}}if(code)issues.push({index:cursor+at,code});}
  await update({recoveryDrillCursor:cursor+results.length,recoveryDrillVerified:Number(job.recoveryDrillVerified||0)+verified,recoveryDrillIssueCount:Number(job.recoveryDrillIssueCount||0)+issues.length,recoveryDrillIssues:[...(job.recoveryDrillIssues||[]),...issues].slice(0,100),recoveryDrillAssets:assets,recoveryDrillAliases:[...aliases]});
 }
 if(job.recoveryDrillCursor===job.total)await update({recoveryDrillStatus:job.recoveryDrillVerified===job.total&&job.recoveryDrillIssueCount===0?'ok':'incidents',recoveryDrillFinishedAt:new Date(now()).toISOString()});
 return{ok:true,jobId:job.id,total:job.total,...recoveryDrillSummary(job),continueRequired:job.recoveryDrillStatus==='checking',sourceRecordsWritten:0,originalsDeleted:0};
}

import{buildLegacyProtectionPlan}from'./legacyProtectionPlan.mjs';
import{normalizeLegacyDocumentReference}from'./legacyNativeReference.mjs';
// In-memory only: no tokens or URLs are written to disk. Recheck the verified job on every use.
const planCache=new Map();
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
const id=value=>/^[A-Za-z0-9_-]{1,200}$/.test(String(value||''));
const admin=user=>!!user?.id&&['admin','super_admin'].includes(user.role)&&![user,user.data].filter(Boolean).some(s=>s.is_deleted===true||['eliminado','bloqueado','suspendido'].includes(String(s.status||'').trim().toLowerCase())||['disabled','deleted','blocked','suspended'].includes(String(s.accountAccessStatus||'').trim().toLowerCase()));
export async function loadLegacyProtectionPlan({service,user,jobId,scopeCompanyId='',readPrivateDriveFile,hash,sources,privateId,cacheTtlMs=0,now=Date.now}){
 if(!admin(user))throw Error('PROTECTION_ADMIN_ONLY');
 if(!id(jobId))throw Error('PROTECTION_JOB_INVALID');
 const job=await service.entities.BackupJob.get(jobId).catch(e=>{if(Number(e?.status||e?.response?.status)===404)return null;throw e;});
 if(!job||String(job.scopeCompanyId||'')!==scopeCompanyId)throw Error('PROTECTION_JOB_UNAVAILABLE');
 const count=Number(job.sourceIndexCount);
 if(job.runVersion!=='snapshot-v4'||job.status!=='completed'||job.verificationStatus!=='ok'||!Number.isSafeInteger(count)||count<1||Number(job.documentsScanned)!==count||Number(job.documentsVerified)!==count||Number(job.verificationChecked)!==count||Number(job.verificationChecksumChecked)!==count||Number(job.documentsFailed)!==0||Number(job.verificationMissing)!==0||(job.verificationIssues||[]).length)throw Error('PROTECTION_BACKUP_NOT_VERIFIED');
 if(![job.sourceIndexDriveFileId,job.manifestDriveFileId].every(id)||![job.sourceIndexChecksum,job.manifestChecksum].every(v=>/^[a-f0-9]{64}$/.test(v||'')))throw Error('PROTECTION_BACKUP_NOT_VERIFIED');
 const cacheKey=JSON.stringify([scopeCompanyId,job.id,job.sourceIndexDriveFileId,job.manifestDriveFileId,job.sourceIndexChecksum,job.manifestChecksum,count,sources]);
 const ttl=Number.isFinite(cacheTtlMs)?Math.min(120000,Math.max(0,cacheTtlMs)):0,cached=ttl?planCache.get(cacheKey):null;
 if(cached&&cached.expires>now())return cached.value;
 const indexBytes=await readPrivateDriveFile(job.sourceIndexDriveFileId),manifestBytes=await readPrivateDriveFile(job.manifestDriveFileId);
 if(await hash(indexBytes)!==job.sourceIndexChecksum||await hash(manifestBytes)!==job.manifestChecksum)throw Error('PROTECTION_BACKUP_HASH_MISMATCH');
 let index,manifest;try{index=JSON.parse(new TextDecoder().decode(indexBytes));manifest=JSON.parse(new TextDecoder().decode(manifestBytes));}catch{throw Error('PROTECTION_SNAPSHOT_INVALID');}
 if(String(index.scopeCompanyId||'')!==scopeCompanyId||index.documents?.length!==count)throw Error('PROTECTION_SNAPSHOT_INVALID');
 const result=await buildLegacyProtectionPlan({index,manifest,backupJobId:job.id,indexSha256:job.sourceIndexChecksum,manifestSha256:job.manifestChecksum,sources,normalizeReference:normalizeLegacyDocumentReference,privateId,hash});
 const value={...result,summary:{...result.summary,unassignedReferences:Number(index.unassigned||0),excludedExternalReferences:Number(index.excludedExternal||0),migrationStarted:false,originalsDeleted:0,financialWrites:0}};
 if(ttl){for(const[key,entry]of planCache)if(entry.expires<=now())planCache.delete(key);while(planCache.size>=2)planCache.delete(planCache.keys().next().value);planCache.set(cacheKey,{value:freeze(value),expires:now()+ttl});}return value;
}

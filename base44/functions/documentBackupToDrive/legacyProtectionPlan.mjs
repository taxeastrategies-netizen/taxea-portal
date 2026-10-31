const allowedId=value=>/^[A-Za-z0-9_-]{1,200}$/.test(String(value||''));
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export async function buildLegacyProtectionPlan({index,manifest,backupJobId,indexSha256,manifestSha256,sources,normalizeReference,privateId,hash}){
 if(index?.version!==4||index.jobId!==backupJobId||!Array.isArray(index.documents)||!Array.isArray(manifest?.documents)||index.documents.length!==manifest.documents.length||Number(manifest.totalDocuments)!==manifest.documents.length||!allowedId(backupJobId)||![indexSha256,manifestSha256].every(value=>/^[a-f0-9]{64}$/.test(value||'')))throw Error('PROTECTION_SNAPSHOT_INVALID');
 const catalog=new Map(sources.map(source=>[source.entity+':'+source.urlField+':'+source.companyField,source])),entries=new Map(),groups=new Map(),seen=new Set();let privateReferences=0;
 for(const entry of manifest.documents){const key=entry.documentEntity+':'+entry.documentId;if(entries.has(key))throw Error('PROTECTION_MANIFEST_DUPLICATE');entries.set(key,entry);}
 for(const item of index.documents){
  const key=item.source?.entity+':'+item.source?.urlField+':'+item.source?.companyField,source=catalog.get(key),record=item.record;
  if(!source||!record?.id)throw Error('PROTECTION_SOURCE_NOT_ALLOWED');
  const recordKey=source.entity+':'+record.id;if(seen.has(recordKey))throw Error('PROTECTION_SNAPSHOT_DUPLICATE');seen.add(recordKey);
  const entry=entries.get(recordKey),companyId=record[source.companyField],reference=record[source.urlField];
  if(!entry||entry.clientAccountId!==companyId||!allowedId(companyId))throw Error('PROTECTION_COMPANY_MISMATCH');
  if(privateId(reference)){privateReferences++;continue;}
  const normalized=normalizeReference(reference);if(!normalized)throw Error('PROTECTION_REFERENCE_INVALID');
  const groupKey=companyId+'|'+normalized;
  const issue=!entry.driveFileId||!allowedId(entry.driveFileId)||!/^[a-f0-9]{64}$/.test(entry.checksum||'')||!['copied','skipped_existing','skipped_unchanged','backed_up'].includes(entry.status)?'BACKUP_NOT_VERIFIED':!Number.isSafeInteger(entry.size)||entry.size<1?'SIZE_INVALID':entry.size>25*1024*1024?'FILE_OVER_25_MB':'';
  let group=groups.get(groupKey);
  if(group&&(group.sha256!==entry.checksum||group.size!==entry.size))throw Error('PROTECTION_SOURCE_SNAPSHOT_CONFLICT');
  if(!group){group={companyId,reference:normalized,referenceDigest:await hash(new TextEncoder().encode(normalized)),sha256:entry.checksum,size:entry.size,mimeType:entry.mimeType||'',originalName:entry.originalFileName||'',backupFileIds:[],sources:[],issue};groups.set(groupKey,group);}
  if(issue)group.issue=issue;
  if(entry.driveFileId&&!group.backupFileIds.includes(entry.driveFileId))group.backupFileIds.push(entry.driveFileId);
  group.sources.push({sourceKey:key,entity:source.entity,id:record.__backupRecordId||record.id,field:source.urlField});
 }
 const ordered=[...groups.values()].sort((a,b)=>(a.companyId+'|'+a.reference).localeCompare(b.companyId+'|'+b.reference));
 for(const group of ordered){group.backupFileIds.sort();group.sources.sort((a,b)=>(a.entity+'|'+a.id+'|'+a.field).localeCompare(b.entity+'|'+b.id+'|'+b.field));}
 const plan={version:1,backupJobId,indexSha256,manifestSha256,cutoff:index.cutoff||'',totalReferences:index.documents.length,privateReferences,groups:ordered};
 const digest=await hash(new TextEncoder().encode(canonical(plan))),companies=new Map(),issues={};
 for(const group of ordered){const company=companies.get(group.companyId)||{companyId:group.companyId,files:0,bytes:0,blockedFiles:0};company.files++;company.bytes+=Number.isSafeInteger(group.size)?group.size:0;if(group.issue){company.blockedFiles++;issues[group.issue]=(issues[group.issue]||0)+1;}companies.set(group.companyId,company);}
 return{plan,digest,summary:{backupJobId,planDigest:digest,totalReferences:plan.totalReferences,privateReferences,legacyFiles:ordered.length,eligibleFiles:ordered.filter(group=>!group.issue).length,blockedFiles:ordered.filter(group=>group.issue).length,bytes:ordered.reduce((sum,group)=>sum+(Number.isSafeInteger(group.size)?group.size:0),0),companies:[...companies.values()],issues,sourceBytesCopied:0,originalsDeleted:0,financialWrites:0}};
}

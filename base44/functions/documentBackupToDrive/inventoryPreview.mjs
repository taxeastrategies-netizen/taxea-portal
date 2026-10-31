import {BACKUP_DOCUMENT_SOURCES,advanceDocumentInventory,createBackupContextResolver,freshInventory,loadInventoryDocuments,canonicalInventoryJson} from './backupCatalog.mjs';
const allowedId=value=>/^[A-Za-z0-9_-]{1,128}$/.test(value||'');
export async function inventoryPreview({service,user,body,scopeCompanyId,deadline,hash,snapshot}){
 if(!['admin','super_admin'].includes(user?.role))throw Error('INVENTORY_ADMIN_ONLY');
 let stage='job_lookup';
 service=new Proxy(service,{get(target,key){if(key!=='entities')return Reflect.get(target,key);return new Proxy(target.entities,{get(entities,name){stage=String(name);const model=Reflect.get(entities,name);if(!model)return model;return new Proxy(model,{get(object,method){const value=Reflect.get(object,method);return typeof value==='function'?(...args)=>{stage=String(name)+'.'+String(method);return value.apply(object,args);}:value;}});}});}});
 let job;
 if(body.inventoryJobId){
  if(!allowedId(body.inventoryJobId))throw Error('INVENTORY_JOB_INVALID');
  job=await service.entities.BackupJob.get(body.inventoryJobId);
  if(job?.runVersion!=='inventory-preview-v1'||job.triggeredByUserId!==user.id||String(job.scopeCompanyId||'')!==scopeCompanyId)throw Error('INVENTORY_JOB_UNAVAILABLE');
 }else{
  const existing=await service.entities.BackupJob.filter({runVersion:'inventory-preview-v1',status:'verifying',triggeredByUserId:user.id,scopeCompanyId},'-startedAt',1);
  if(body.startNewInventory===true&&existing[0]){await service.entities.BackupJob.update(existing[0].id,{status:'cancelled',completedAt:new Date().toISOString()});existing.length=0;}
  job=existing[0]||await service.entities.BackupJob.create({jobType:'verification',status:'verifying',runVersion:'inventory-preview-v1',scopeCompanyId,triggeredByUserId:user.id,startedAt:new Date().toISOString(),lastHeartbeatAt:new Date().toISOString(),documentsScanned:0});
 }
 try{
  let state=job.inventoryStateData||(job.inventoryState?JSON.parse(job.inventoryState):freshInventory(job.id,job.startedAt,scopeCompanyId));
  if(state.jobId!==job.id||state.scopeCompanyId!==scopeCompanyId)throw Error('INVENTORY_JOB_UNAVAILABLE');
  state=await advanceDocumentInventory({service,state,resolveCompany:createBackupContextResolver(service),deadline,pageSize:100,
   uploadPage:async page=>{
    const content=canonicalInventoryJson({...page,documents:snapshot(page.documents,BACKUP_DOCUMENT_SOURCES)}),bytes=new TextEncoder().encode(content),sha256=await hash(bytes);
    if(bytes.length>524288)throw Error('INVENTORY_PAGE_TOO_LARGE');
    const key='inventory-page-'+page.index,matches=await service.entities.BackupJobItem.filter({backupJobId:job.id,documentId:key},'created_date',2);
    if(matches.length>1||matches[0]&&matches[0].inventoryPageSha256!==sha256)throw Error('INVENTORY_SOURCE_CHANGED_RESTART_REQUIRED');
    const item=matches[0]||await service.entities.BackupJobItem.create({backupJobId:job.id,documentId:key,documentEntity:'DocumentInventory',status:'verified',action:'verify',inventoryPageData:JSON.parse(content),inventoryPageSha256:sha256,inventoryIndex:page.index});
    return{id:item.id,sha256};
   },
   persist:async current=>{const patch={inventoryStateData:current,documentsScanned:current.count,lastHeartbeatAt:new Date().toISOString()};await service.entities.BackupJob.update(job.id,patch);job={...job,...patch};}
  });
  if(!state.done)return{ok:true,status:'verifying',inventoryJobId:job.id,continueRequired:true,referencesScanned:state.count,sourcesCompleted:state.source,totalSources:BACKUP_DOCUMENT_SOURCES.length,sourceBytesCopied:0,financialWrites:0,retryAfterSeconds:1};
  const documents=await loadInventoryDocuments(state,async id=>{const item=await service.entities.BackupJobItem.get(id);if(item.backupJobId!==job.id||item.documentEntity!=='DocumentInventory')throw Error('INVENTORY_PAGE_UNAVAILABLE');return new TextEncoder().encode(item.inventoryPageData?canonicalInventoryJson(item.inventoryPageData):item.inventoryPage);},hash);
  const sourceCounts={},nativeFiles=new Set(),privateFiles=new Set(),nativeOwners=new Map();let nativeReferences=0,privateReferences=0;
  for(const {source,record}of documents){
   const reference=record[source.urlField],companyId=record[source.companyField],key=source.entity+'.'+source.urlField;
   sourceCounts[key]=(sourceCounts[key]||0)+1;
   if(reference.startsWith('https://taxeaportal.com/private-document/')){privateReferences++;privateFiles.add(reference);}
   else{nativeReferences++;let normalized=reference;try{const url=new URL(reference);url.search='';url.hash='';normalized=url.toString();}catch{}
    nativeFiles.add(companyId+'|'+normalized);if(!nativeOwners.has(normalized))nativeOwners.set(normalized,new Set());nativeOwners.get(normalized).add(companyId);
   }
  }
  const result={ok:true,status:'completed',inventoryJobId:job.id,continueRequired:false,cutoff:state.cutoff,referencesScanned:documents.length,privateReferences,privateUniqueFiles:privateFiles.size,nativeReferences,nativeFilesByCompany:nativeFiles.size,unassignedReferences:state.unassigned,externalReferencesExcluded:state.excludedExternal,sharedNativeReferenceGroups:[...nativeOwners.values()].filter(owners=>owners.size>1).length,sourceCounts,sourceBytesCopied:0,historicalDocumentsMigrated:0,originalsDeleted:0,financialWrites:0};
  await service.entities.BackupJob.update(job.id,{status:'completed',completedAt:new Date().toISOString(),inventoryPreviewResult:JSON.stringify(result),documentsScanned:documents.length});
  return result;
 }catch(error){
  const failedStage=stage;
  const code=/^(INVENTORY|BACKUP_INVENTORY|BACKUP_INDEX)_[A-Z_]+$/.test(error?.message||'')?error.message:'INVENTORY_UNAVAILABLE';
  await service.entities.BackupJob.update(job.id,{safeErrorMessage:code,lastHeartbeatAt:new Date().toISOString()}).catch(()=>{});
  const providerStatus=Number(error?.status||error?.response?.status||0),errorName=['Error','TypeError','ReferenceError','RangeError'].includes(error?.name)?error.name:'ProviderError';
  let detail='';try{detail=JSON.stringify(error?.data||error?.response?.data||error?.message||'');}catch{}
  const hint=/max.?length|string.{0,40}(long|length)|at most|less than/i.test(detail)?'STRING_LENGTH_LIMIT':/too large|payload.{0,30}(size|limit)|document.{0,30}size/i.test(detail)?'PAYLOAD_SIZE_LIMIT':/validat|schema|required/i.test(detail)?'SCHEMA_VALIDATION':/permission|forbidden/i.test(detail)?'PERMISSION':/rate.?limit|too many requests/i.test(detail)?'RATE_LIMIT':'UNCLASSIFIED';
  const limit=Number(detail.match(/(?:max_length|maxLength|at most|less than|maximum length)\D{0,12}(\d{1,8})/i)?.[1]||0);
  return{ok:false,status:'needs_attention',inventoryJobId:job.id,continueRequired:false,canResume:true,code,diagnostic:{stage:failedStage,providerStatus,errorName,hint,limit},sourceBytesCopied:0,financialWrites:0};
 }
}

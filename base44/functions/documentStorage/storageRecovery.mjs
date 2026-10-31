import {driveBackupCandidates,readDriveRecoveryBytes} from './driveRecovery.mjs';
import {authorizedAsset,assetReference,isStorageAdmin,storageAccountEnabled} from './storageAssets.mjs';
import {storageTransport,sha256} from './storageTransport.mjs';
const fail=(code,status=409)=>Object.assign(new Error(code),{recoveryCode:code,status});
const assertAdmin=user=>{if(!storageAccountEnabled(user)||!isStorageAdmin(user))throw fail('RECOVERY_ADMIN_ONLY',403);};
async function snapshot(service,user,id){
 assertAdmin(user);const asset=await authorizedAsset(service,user,id);
 if(!asset||!/^\d+$/.test(asset.generation)||!/^[a-f0-9]{64}$/.test(asset.sha256)||!Number.isSafeInteger(asset.size)||asset.size<=0||asset.size>25*1024*1024)throw fail('RECOVERY_ASSET_UNAVAILABLE',404);
 return asset;
}
const verify=async(asset,bytes)=>{if(bytes.length!==asset.size||await sha256(bytes)!==asset.sha256)throw fail('RECOVERY_HASH_MISMATCH');};
async function inspect(asset,transport){
 try{const bytes=await transport.get(asset.object_name,asset.generation);await verify(asset,bytes);return{mode:'available',generation:asset.generation};}
 catch(error){if(error?.message!=='STORAGE_DOWNLOAD_FAILED_404')throw error;}
 const current=await transport.metadata(asset.object_name);
 if(current){await verify(asset,await transport.get(asset.object_name,current.generation));return{mode:'relink',generation:current.generation};}
 const deleted=await transport.metadata(asset.object_name,{generation:asset.generation,softDeleted:true});
 if(deleted?.softDeleteTime&&Number.isFinite(Date.parse(deleted.hardDeleteTime))&&Date.parse(deleted.hardDeleteTime)>Date.now())return{mode:'soft_delete',generation:deleted.generation,expiresAt:deleted.hardDeleteTime};
 return{mode:'backup_required',generation:asset.generation};
}
export async function privateAssetRecoveryPlan(service,user,id,env,makeTransport=storageTransport){
 const asset=await snapshot(service,user,id),transport=await makeTransport(env),state=await inspect(asset,transport);
 return{assetId:asset.id,companyId:asset.company_id,name:asset.original_name,size:asset.size,sha256:asset.sha256,expectedGeneration:asset.generation,mode:state.mode,canRestore:['soft_delete','relink'].includes(state.mode),expiresAt:state.expiresAt||null,financialWrites:0};
}
export async function restorePrivateAsset(service,user,request,env,makeTransport=storageTransport){
 const asset=await snapshot(service,user,request?.assetId);
 if(request.expectedSha256!==asset.sha256)throw fail('RECOVERY_PLAN_STALE');
 const transport=await makeTransport(env);
 if(request.expectedGeneration!==asset.generation){
  if(asset.restore_source_generation===request.expectedGeneration){await verify(asset,await transport.get(asset.object_name,asset.generation));return{ok:true,alreadyRestored:true,file_url:assetReference(asset.id),sha256:asset.sha256,size:asset.size,financialWrites:0};}
  throw fail('RECOVERY_PLAN_STALE');
 }
 let state=await inspect(asset,transport);
 if(state.mode==='available')return{ok:true,alreadyAvailable:true,file_url:assetReference(asset.id),sha256:asset.sha256,size:asset.size,financialWrites:0};
 if(state.mode==='backup_required')throw fail('RECOVERY_BACKUP_REQUIRED');
 let generation=state.generation;
 if(state.mode==='soft_delete'){
  try{const recovered=await transport.restore(asset.object_name,asset.generation);generation=recovered.generation;}
  catch(error){
   // A lost acknowledgement can leave a restored live object. Reconcile it,
   // never overwrite it and never blindly issue another restore operation.
   const current=await transport.metadata(asset.object_name).catch(()=>null);
   if(!current)throw error;generation=current.generation;
  }
 }
 if(!/^\d+$/.test(generation))throw fail('RECOVERY_INVALID_GENERATION');
 await verify(asset,await transport.get(asset.object_name,generation));
 const stamp=new Date().toISOString(),updated=await service.entities.DocumentAsset.updateMany({id:asset.id,company_id:asset.company_id,object_name:asset.object_name,generation:asset.generation,sha256:asset.sha256,size:asset.size,status:'ready'},{$set:{generation,verified_at:stamp,restored_at:stamp,restored_by:String(user.id),restore_source_generation:asset.generation}});
 const after=await service.entities.DocumentAsset.get(asset.id);
 if(after?.company_id!==asset.company_id||after.object_name!==asset.object_name||after.sha256!==asset.sha256||after.size!==asset.size||after.generation!==generation||after.status!=='ready')throw fail('RECOVERY_LEDGER_CHANGED');
 if(Number(updated?.updated)!==1&&after.restore_source_generation!==asset.generation)throw fail('RECOVERY_LEDGER_CHANGED');
 return{ok:true,restored:true,assetId:asset.id,file_url:assetReference(asset.id),sha256:asset.sha256,size:asset.size,generationChanged:generation!==asset.generation,verified:true,financialWrites:0};
}

export async function privateAssetBackupPlan(service,user,id){
 const asset=await snapshot(service,user,id),records=await driveBackupCandidates(service,user,asset);
 return{ok:true,assetId:asset.id,companyId:asset.company_id,name:asset.original_name,size:asset.size,sha256:asset.sha256,expectedGeneration:asset.generation,backupAvailable:records.length>0,backupContentVerified:false,financialWrites:0};
}
export async function restorePrivateAssetFromBackup(service,user,request,env,makeTransport=storageTransport,readBackup=readDriveRecoveryBytes){
 const asset=await snapshot(service,user,request?.assetId);
 if(request.expectedSha256!==asset.sha256)throw fail('RECOVERY_PLAN_STALE');
 const transport=await makeTransport(env);
 if(request.expectedGeneration!==asset.generation){
  if(asset.restore_source_generation===request.expectedGeneration){await verify(asset,await transport.get(asset.object_name,asset.generation));return{ok:true,alreadyRestored:true,file_url:assetReference(asset.id),sha256:asset.sha256,size:asset.size,financialWrites:0};}
  throw fail('RECOVERY_PLAN_STALE');
 }
 const state=await inspect(asset,transport);
 if(['available','relink'].includes(state.mode))return restorePrivateAsset(service,user,request,env,()=>transport);
 const copy=await readBackup(service,user,asset);await verify(asset,copy.bytes);
 try{await transport.put(asset.object_name,copy.bytes,asset.mime_type);}
 catch(error){const current=await transport.metadata(asset.object_name).catch(()=>null);if(!current)throw error;await verify(asset,await transport.get(asset.object_name,current.generation));}
 const result=await restorePrivateAsset(service,user,request,env,()=>transport);
 return{...result,backupVerified:true,backupRecordId:copy.backupRecordId};
}

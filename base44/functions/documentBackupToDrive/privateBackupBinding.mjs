const validId=value=>/^[A-Za-z0-9_-]{1,200}$/.test(String(value||''));
// A second metadata reference points to an already verified Drive object. No upload or source-row update.
export async function bindProtectedAssetBackup({service,user,asset,group,planDigest,backupJobId}){
 if(!user?.id||!['admin','super_admin'].includes(user.role)||[user,user.data].filter(Boolean).some(s=>s.is_deleted===true||['eliminado','bloqueado','suspendido'].includes(String(s.status||'').toLowerCase())||['disabled','deleted','blocked','suspended'].includes(String(s.accountAccessStatus||'').toLowerCase())))throw Error('PROTECTION_ADMIN_ONLY');
 if(!validId(asset?.id)||asset.company_id!==group.companyId||asset.sha256!==group.sha256||asset.size!==group.size||asset.status!=='ready'||!group.backupFileIds?.length||group.backupFileIds.some(id=>!validId(id))||!/^[a-f0-9]{64}$/.test(planDigest||'')||!validId(backupJobId))throw Error('PROTECTION_BACKUP_BINDING_INVALID');
 const entity=service.entities.DocumentBackupRecord,uri='https://taxeaportal.com/private-document/'+asset.id;
 const query={documentEntity:'DocumentAsset',documentId:asset.id,clientAccountId:asset.company_id,checksum:asset.sha256};
 const matching=rows=>rows.find(row=>row.fileStorageUrl===uri&&row.clientAccountId===asset.company_id&&row.checksum===asset.sha256&&row.fileSize===asset.size&&group.backupFileIds.includes(row.driveFileId)&&['verified','backed_up'].includes(row.backupStatus));
 const found=await entity.filter(query,'id',20);if(matching(found))return{linked:true,reused:true};
 const payload={...query,fileStorageUrl:uri,fileSize:asset.size,driveFileId:group.backupFileIds[0],backupStatus:'verified',lastBackedUpAt:new Date().toISOString(),mimeType:asset.mime_type,originalFileName:asset.original_name};
 try{await entity.create(payload);}catch(error){if(!matching(await entity.filter(query,'id',20)))throw error;}
 if(!matching(await entity.filter(query,'id',20)))throw Error('PROTECTION_BACKUP_BINDING_UNVERIFIED');return{linked:true,reused:false};
}

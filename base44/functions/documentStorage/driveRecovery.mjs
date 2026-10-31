import {assetReference,isStorageAdmin,storageAccountEnabled} from './storageAssets.mjs';
import {sha256} from './storageTransport.mjs';
const owner='taxeastrategies@gmail.com',api='https://www.googleapis.com/drive/v3';
const fail=code=>Object.assign(new Error(code),{recoveryCode:code,status:503});
export async function driveBackupCandidates(service,user,asset){
 if(!isStorageAdmin(user)||!storageAccountEnabled(user))throw fail('RECOVERY_ADMIN_ONLY');
 const records=await service.entities.DocumentBackupRecord.filter({fileStorageUrl:assetReference(asset.id),clientAccountId:asset.company_id,checksum:asset.sha256,fileSize:asset.size,backupStatus:{$in:['backed_up','verified']}},'-lastBackedUpAt',5);
 return records.filter(record=>record.fileStorageUrl===assetReference(asset.id)&&record.clientAccountId===asset.company_id&&record.checksum===asset.sha256&&record.fileSize===asset.size&&['backed_up','verified'].includes(record.backupStatus)&&/^[A-Za-z0-9_-]{1,200}$/.test(record.driveFileId||''));
}
export async function boundedRecoveryBytes(response,max,signal){
 if(Number(response.headers.get('content-length')||0)>max)throw fail('RECOVERY_BACKUP_TOO_LARGE');
 if(!response.body)return new Uint8Array();
 const reader=response.body.getReader(),chunks=[];let size=0,onAbort;
 const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail('RECOVERY_BACKUP_TIMEOUT'));if(signal.aborted)onAbort();else signal.addEventListener('abort',onAbort,{once:true});});
 try{for(;;){const part=await Promise.race([reader.read(),stopped]);if(part.done)break;size+=part.value.length;if(size>max)throw fail('RECOVERY_BACKUP_TOO_LARGE');chunks.push(part.value);}}
 catch(error){void reader.cancel().catch(()=>{});throw error;}finally{signal.removeEventListener('abort',onAbort);reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
export async function readDriveRecoveryBytes(service,user,asset,{fetcher=(...args)=>globalThis.fetch(...args),now=Date.now}={}){
 const candidates=await driveBackupCandidates(service,user,asset);if(!candidates.length)throw fail('RECOVERY_BACKUP_NOT_FOUND');
 const connection=await service.connectors.getConnection('googledrive');if(typeof connection?.accessToken!=='string'||!connection.accessToken)throw fail('RECOVERY_DRIVE_NOT_CONNECTED');
 const deadline=now()+25000;
 const get=async(path,max=65536)=>{
  const remaining=deadline-now();if(remaining<1)throw fail('RECOVERY_BACKUP_TIMEOUT');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(10000,remaining));
  try{const response=await fetcher(api+path,{method:'GET',headers:{Authorization:'Bearer '+connection.accessToken},redirect:'manual',signal:controller.signal});if(response.status>=300&&response.status<400)throw fail('RECOVERY_DRIVE_REDIRECT_DENIED');if(!response.ok)throw fail('RECOVERY_BACKUP_UNAVAILABLE');return await boundedRecoveryBytes(response,max,controller.signal);}
  finally{clearTimeout(timer);}
 };
 const json=async path=>{try{return JSON.parse(new TextDecoder().decode(await get(path)));}catch(error){if(error?.recoveryCode)throw error;throw fail('RECOVERY_BACKUP_METADATA_INVALID');}};
 if((await json('/about?fields=user(emailAddress)')).user?.emailAddress?.toLowerCase()!==owner)throw fail('RECOVERY_DRIVE_WRONG_ACCOUNT');
 let lastError;
 for(const candidate of candidates){
  try{
   const id=encodeURIComponent(candidate.driveFileId),metadata=await json('/files/'+id+'?fields=id,size,trashed');
   if(metadata.id!==candidate.driveFileId||metadata.trashed||Number(metadata.size)!==asset.size)throw fail('RECOVERY_BACKUP_METADATA_INVALID');
   let token='',ownerVerified=false;const seen=new Set();
   do{if(seen.has(token))throw fail('RECOVERY_BACKUP_METADATA_INVALID');seen.add(token);const page=await json('/files/'+id+'/permissions?fields=permissions(type,emailAddress,role,deleted),nextPageToken&pageSize=100'+(token?'&pageToken='+encodeURIComponent(token):''));
    if(!Array.isArray(page.permissions)||!page.permissions.length||page.permissions.some(p=>!p.deleted&&(p.type!=='user'||String(p.emailAddress||'').toLowerCase()!==owner)))throw fail('RECOVERY_BACKUP_NOT_PRIVATE');
    if(page.permissions.some(p=>!p.deleted&&p.role==='owner'&&String(p.emailAddress||'').toLowerCase()===owner))ownerVerified=true;token=page.nextPageToken||'';
   }while(token);
   if(!ownerVerified)throw fail('RECOVERY_BACKUP_OWNER_UNVERIFIED');
   const bytes=await get('/files/'+id+'?alt=media',Math.min(25*1024*1024,asset.size));
   if(bytes.length!==asset.size||await sha256(bytes)!==asset.sha256)throw fail('RECOVERY_HASH_MISMATCH');
   return{bytes,backupRecordId:candidate.id};
  }catch(error){lastError=error;}
 }
 throw lastError||fail('RECOVERY_BACKUP_UNAVAILABLE');
}

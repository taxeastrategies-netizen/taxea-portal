import {storageTransport,sha256} from './storageTransport.mjs';
import {signedStorageRead} from './storageSigning.mjs';
const norm=value=>String(value||'').trim().toLowerCase();
export const isStorageAdmin=user=>['admin','super_admin'].includes(user?.role);
export const storageAccountEnabled=user=>!!user?.id&&![user,user.data].filter(Boolean).some(state=>state.is_deleted===true||['eliminado','bloqueado','suspendido'].includes(norm(state.status))||['disabled','deleted','blocked','suspended'].includes(norm(state.accountAccessStatus)));
export const storageEnabled=(company,env)=>company?.private_document_storage_enabled===true||env?.get?.('TAXEA_PRIVATE_STORAGE_ENFORCED')==='true';
export function mayAccessStorageCompany(user,company){
 if(!storageAccountEnabled(user)||!company||company.activa===false)return false;
 if(isStorageAdmin(user))return true;
 const email=norm(user.email);return !!email&&(norm(company.owner_email)===email||(Array.isArray(company.usuarios_autorizados)&&company.usuarios_autorizados.some(value=>norm(value)===email)));
}
export const assetReference=id=>'https://taxeaportal.com/private-document/'+encodeURIComponent(id);
export function assetIdFromReference(value){
 if(typeof value!=='string')return '';
 try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='taxeaportal.com'||u.port||u.username||u.password||u.search||u.hash)return '';const m=u.pathname.match(/^\/private-document\/([A-Za-z0-9_-]{1,128})$/);return m?.[1]||'';}catch{return '';}
}
export function privateFileFormat(file,bytes){
 const ext=String(file.name||'').split('.').pop().toLowerCase();
 const text=new TextDecoder().decode(bytes.slice(0,12));
 if(ext==='pdf'&&text.startsWith('%PDF-'))return {ext,mime:'application/pdf'};
 if(['jpg','jpeg'].includes(ext)&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {ext:'jpg',mime:'image/jpeg'};
 if(ext==='png'&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return {ext,mime:'image/png'};
 if(ext==='webp'&&text.startsWith('RIFF')&&text.slice(8)==='WEBP')return {ext,mime:'image/webp'};
 if(['xlsx','docx','pptx'].includes(ext)&&bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4)return {ext,mime:({xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'})[ext]};
 if(['txt','csv','json'].includes(ext)&&!bytes.slice(0,8192).includes(0))return {ext,mime:'application/octet-stream'};
 if(['xls','doc'].includes(ext)&&[208,207,17,224,161,177,26,225].every((v,i)=>bytes[i]===v))return {ext,mime:'application/octet-stream'};
 throw new Error('STORAGE_UNSUPPORTED_FILE');
}
export async function storageCompany(svc,user,id){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(id||''))return null;
 const company=await svc.entities.Company.get(id).catch(()=>null);return mayAccessStorageCompany(user,company)?company:null;
}
export async function savePrivateAsset(svc,user,company,file,env,fetcher){
 if(!mayAccessStorageCompany(user,company)||!storageEnabled(company,env))throw new Error('STORAGE_COMPANY_NOT_ENABLED');
 if(!file?.size||file.size>20*1024*1024)throw new Error('STORAGE_INVALID_SIZE');
 const bytes=new Uint8Array(await file.arrayBuffer()),format=privateFileFormat(file,bytes),digest=await sha256(bytes);
 const previous=await svc.entities.DocumentAsset.filter({company_id:company.id,sha256:digest,status:'ready'},'-created_date',1);
 if(previous[0])return {asset:previous[0],file_url:assetReference(previous[0].id),reused:true};
 const objectName='companies/'+company.id+'/'+crypto.randomUUID()+'.'+format.ext;
 // Record intent before the remote write, so an interrupted upload remains traceable.
 const pending=await svc.entities.DocumentAsset.create({company_id:company.id,object_name:objectName,generation:'',sha256:digest,size:bytes.length,mime_type:format.mime,original_name:String(file.name||'documento').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,240),status:'uploading',uploaded_by:String(user.id),storage_provider:'gcs'});
 let object,bytesVerified=false;
 try{
  const transport=await storageTransport(env,fetcher);object=await transport.put(objectName,bytes,format.mime);
  await svc.entities.DocumentAsset.update(pending.id,{generation:object.generation});
  const read=await transport.get(objectName,object.generation);
  if(await sha256(read)!==digest)throw new Error('STORAGE_HASH_MISMATCH');
  bytesVerified=true;
  await svc.entities.DocumentAsset.update(pending.id,{status:'ready',verified_at:new Date().toISOString(),error_code:''});
  const asset=await svc.entities.DocumentAsset.get(pending.id);
  if(asset.status!=='ready'||asset.sha256!==digest||asset.generation!==object.generation||asset.company_id!==company.id)throw new Error('STORAGE_ASSET_UNVERIFIED');
  return {asset,file_url:assetReference(asset.id),reused:false};
 }catch(error){
  if(bytesVerified){
   const recovered=await svc.entities.DocumentAsset.get(pending.id).catch(()=>null);
   if(recovered?.status==='ready'&&recovered.sha256===digest&&recovered.generation===object?.generation&&recovered.company_id===company.id)return {asset:recovered,file_url:assetReference(recovered.id),reused:true};
  }else{
   const code=/^STORAGE_[A-Z_0-9]+$/.test(error?.message||'')?error.message:'STORAGE_UPLOAD_INTERRUPTED';
   await svc.entities.DocumentAsset.update(pending.id,{status:'failed',generation:object?.generation||'',error_code:code}).catch(()=>{});
  }
  throw error;
 }
}
export async function authorizedAsset(svc,user,id){
 if(!storageAccountEnabled(user)||!/^[A-Za-z0-9_-]{1,128}$/.test(id||''))return null;
 const asset=await svc.entities.DocumentAsset.get(id).catch(()=>null);
 if(!asset||asset.status!=='ready'||!asset.object_name?.startsWith('companies/'+asset.company_id+'/'))return null;
 if(asset.company_id==='__admin_staging__')return isStorageAdmin(user)?asset:null;
 return await storageCompany(svc,user,asset.company_id)?asset:null;
}
export async function readPrivateAssetBytes(svc,user,reference,env,companyId){
 const asset=await authorizedAsset(svc,user,assetIdFromReference(reference));
 if(!asset||(companyId&&asset.company_id!==companyId))throw new Error('STORAGE_ASSET_FORBIDDEN');
 const transport=await storageTransport(env),bytes=await transport.get(asset.object_name,asset.generation);
 if(bytes.length!==asset.size||await sha256(bytes)!==asset.sha256)throw new Error('STORAGE_HASH_MISMATCH');
 return {asset,bytes};
}
export async function resolvePrivateAsset(svc,user,id,env){
 const asset=await authorizedAsset(svc,user,id);if(!asset)return null;
 return {...await signedStorageRead(env,asset),mimeType:asset.mime_type,name:asset.original_name,size:asset.size,sha256:asset.sha256};
}

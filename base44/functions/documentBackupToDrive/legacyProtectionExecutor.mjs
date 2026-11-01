const fail=code=>{throw new Error(code);};
const validId=value=>/^[A-Za-z0-9_-]{1,128}$/.test(String(value||''));
export function protectionAdmin(user){return !!user?.id&&['admin','super_admin'].includes(user.role)&&![user,user.data].filter(Boolean).some(s=>s.is_deleted===true||['eliminado','bloqueado','suspendido'].includes(String(s.status||'').toLowerCase())||['disabled','deleted','blocked','suspended'].includes(String(s.accountAccessStatus||'').toLowerCase()));}
export async function verifyProtectionSourceBindings({service,group,sources,resolveCompany,normalizeReference}){
 const catalog=new Map(sources.map(source=>[source.entity+':'+source.urlField+':'+source.companyField,source]));
 if(!Array.isArray(group.sources)||!group.sources.length)fail('PROTECTION_SOURCE_CHANGED');
 for(const binding of group.sources){const source=catalog.get(binding.sourceKey);if(!source||source.entity!==binding.entity||source.urlField!==binding.field||!validId(binding.id))fail('PROTECTION_SOURCE_NOT_ALLOWED');
  const row=await service.entities[source.entity].get(binding.id).catch(error=>{if(Number(error?.status||error?.response?.status)===404)return null;throw error;});
  if(!row||await resolveCompany(source,row)!==group.companyId||normalizeReference(row[source.urlField])!==group.reference)fail('PROTECTION_SOURCE_CHANGED');
 }
 return group.sources.length;
}
export function protectionFileName(group,bytes){
 const text=new TextDecoder().decode(bytes.slice(0,1024));if(/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/.test(text))fail('PROTECTION_CERTIFICATE_REVIEW');
 let ext='';const name=String(group.originalName||'documento').replace(/[\u0000-\u001f\u007f\\/]/g,'_').slice(0,210),provided=(name.split('.').pop()||'').toLowerCase();
 const nativeExtension=(()=>{try{return new URL(String(group.reference||'')).pathname.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toLowerCase()||'';}catch{return'';}})();
 if(['pfx','p12','p8','pem','key','cer','crt'].includes(nativeExtension))fail('PROTECTION_CERTIFICATE_REVIEW');
 if(['pfx','p12','p8','pem','key','cer','crt'].includes(provided))fail('PROTECTION_CERTIFICATE_REVIEW');
 if(text.startsWith('%PDF-')||provided==='pdf'&&/%PDF-[12]\.[0-9][\r\n ]/.test(text))ext='pdf';else if([137,80,78,71,13,10,26,10].every((value,i)=>bytes[i]===value))ext='png';else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';else if(text.startsWith('RIFF')&&text.slice(8,12)==='WEBP')ext='webp';else if(/^GIF8[79]a/.test(text))ext='gif';else if(text.startsWith('BM'))ext='bmp';else if(bytes[0]===80&&bytes[1]===75)ext=['xlsx','docx','pptx'].includes(provided)?provided:'zip';else if([208,207,17,224,161,177,26,225].every((value,i)=>bytes[i]===value)&&['xls','doc','ppt'].includes(provided))ext=provided;
 else if(/^\uFEFF?\s*<\?xml(?:\s|\?)/.test(text))ext='xml';
 else if(['txt','csv','json','xml','111','115','123','130','131','180','190','193','200','202','216','232','296','303','347','349','390','415','417','420','421','425'].includes(provided))ext=provided;
 else if(['txt','csv','json','xml','111','115','123','130','131','180','190','193','200','202','216','232','296','303','347','349','390','415','417','420','421','425'].includes(nativeExtension))ext=nativeExtension;
 if(!ext)fail('PROTECTION_FORMAT_REVIEW');return name.replace(/\.[A-Za-z0-9]{1,8}$/,'')+'.'+ext;
}
export async function protectLegacyGroup({service,user,group,planDigest,expectedPlanDigest,normalizeReference,hash,verifySources,readBackup,readSource,saveAsset,readAsset,reactivateDisabled=false,protectionJobId='',onAssetVerified=async()=>{}}){
 if(!protectionAdmin(user))fail('PROTECTION_ADMIN_ONLY');
 if(protectionJobId&&!validId(protectionJobId))fail('PROTECTION_JOB_INVALID');
 if(!/^[a-f0-9]{64}$/.test(planDigest||'')||expectedPlanDigest!==planDigest)fail('PROTECTION_PLAN_CHANGED');
 if(!group||group.issue||!validId(group.companyId)||!normalizeReference(group.reference)||await hash(new TextEncoder().encode(normalizeReference(group.reference)))!==group.referenceDigest||!/^[a-f0-9]{64}$/.test(group.sha256||'')||!Number.isSafeInteger(group.size)||group.size<1||group.size>25*1024*1024)fail('PROTECTION_GROUP_INVALID');
 const entity=service.entities.DocumentLegacyReference,query={company_id:group.companyId,reference_digest:group.referenceDigest},existing=await entity.filter(query,'id',2);
 if(existing.length>1)fail('PROTECTION_ALIAS_AMBIGUOUS');
 const alias=existing[0];
 if(alias){
  if(alias.company_id!==group.companyId||alias.reference_digest!==group.referenceDigest||alias.sha256!==group.sha256||alias.size!==group.size||!validId(alias.asset_id))fail('PROTECTION_ALIAS_CONFLICT');
  const wasDisabled=alias.status==='disabled';if(wasDisabled&&!reactivateDisabled)fail('PROTECTION_ALIAS_DISABLED_REVIEW');
  const saved=await readAsset(alias.asset_id,group.companyId);
  if(saved?.asset?.company_id!==group.companyId||saved.asset?.id!==alias.asset_id||saved?.bytes?.length!==group.size||await hash(saved.bytes)!==group.sha256)fail('PROTECTION_PRIVATE_COPY_UNVERIFIED');
  await onAssetVerified(saved.asset,group);
  if(alias.status==='disabled'){
   if(alias.plan_id!==planDigest)fail('PROTECTION_ALIAS_CONFLICT');
   const updated=await entity.updateMany({id:alias.id,status:'disabled',plan_id:planDigest,sha256:group.sha256},{$set:{status:'verified',disabled_at:'',linked_by:user.id,linked_at:new Date().toISOString()}});if(Number(updated?.updated)!==1)fail('PROTECTION_ALIAS_CHANGED');
  }else if(alias.status!=='verified')fail('PROTECTION_ALIAS_CONFLICT');
  return{ok:true,assetId:alias.asset_id,alreadyProtected:true,reactivated:wasDisabled,sourceRecordsWritten:0,originalsDeleted:0};
 }
 const verifiedSources=await verifySources(group);
 const backup=await readBackup(group);if(backup.length!==group.size||await hash(backup)!==group.sha256)fail('PROTECTION_BACKUP_UNVERIFIED');
 const original=await readSource(group);if(original.length!==group.size||await hash(original)!==group.sha256)fail('PROTECTION_SOURCE_BYTES_CHANGED');
 const name=protectionFileName(group,original),saved=await saveAsset({companyId:group.companyId,bytes:original,name,mimeType:group.mimeType});
 if(!validId(saved?.asset?.id)||saved.asset.company_id!==group.companyId||saved.asset.sha256!==group.sha256||saved.asset.size!==group.size)fail('PROTECTION_PRIVATE_COPY_UNVERIFIED');
 const reread=await readAsset(saved.asset.id,group.companyId);if(reread?.asset?.id!==saved.asset.id||reread?.asset?.company_id!==group.companyId||reread?.bytes?.length!==group.size||await hash(reread.bytes)!==group.sha256)fail('PROTECTION_PRIVATE_COPY_UNVERIFIED');
 await verifySources(group);
 await onAssetVerified(reread.asset,group);
 const payload={company_id:group.companyId,reference_digest:group.referenceDigest,asset_id:saved.asset.id,protection_job_id:protectionJobId,sha256:group.sha256,size:group.size,plan_id:planDigest,status:'verified',source_references:group.sources,linked_by:user.id,linked_at:new Date().toISOString()};
 let recovered=false;
 try{await entity.create(payload);}catch(error){const reconciled=await entity.filter(query,'id',2);if(reconciled.length!==1||reconciled[0].asset_id!==saved.asset.id||reconciled[0].sha256!==group.sha256||reconciled[0].status!=='verified')throw error;recovered=true;}
 const linked=await entity.filter(query,'id',2);if(linked.length!==1||linked[0].company_id!==group.companyId||linked[0].reference_digest!==group.referenceDigest||linked[0].asset_id!==saved.asset.id||linked[0].sha256!==group.sha256||linked[0].size!==group.size||linked[0].status!=='verified')fail('PROTECTION_ALIAS_UNVERIFIED');
 return{ok:true,assetId:saved.asset.id,alreadyProtected:false,recoveredAcknowledgement:recovered,verifiedSources,sourceRecordsWritten:0,originalsDeleted:0};
}
export async function disableProtectionAlias({service,user,companyId,referenceDigest,planDigest}){
 if(!protectionAdmin(user))fail('PROTECTION_ADMIN_ONLY');
 const rows=await service.entities.DocumentLegacyReference.filter({company_id:companyId,reference_digest:referenceDigest},'id',2);
 if(rows.length!==1||rows[0].plan_id!==planDigest)fail('PROTECTION_ALIAS_CONFLICT');const row=rows[0];if(row.status==='disabled')return{ok:true,alreadyDisabled:true,documentsDeleted:0,financialWrites:0};
 const result=await service.entities.DocumentLegacyReference.updateMany({id:row.id,status:'verified',plan_id:planDigest},{$set:{status:'disabled',disabled_at:new Date().toISOString()}});if(Number(result?.updated)!==1)fail('PROTECTION_ALIAS_CHANGED');return{ok:true,alreadyDisabled:false,documentsDeleted:0,financialWrites:0};
}

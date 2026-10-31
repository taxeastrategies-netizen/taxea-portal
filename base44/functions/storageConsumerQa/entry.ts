import {storageAccountEnabled,readPrivateAssetBytes,savePrivateAsset,storageTransport,assetReference} from './storageRuntime.generated.mjs';
import {createClientFromRequest} from 'npm:@base44/sdk@0.8.48';
const COMPANY='6ac4c79bbe3474810a3d0e06';
Deno.serve(async req=>{
 let phase='authorization';
 try{
  if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
  const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'Unauthorized'},{status:401});
  if(!['admin','super_admin'].includes(user.role)||!storageAccountEnabled(user))return Response.json({error:'Admin only'},{status:403});
  const body=await req.json().catch(()=>({})),svc=client.asServiceRole;
  const company=await svc.entities.Company.get(COMPANY);
  phase='verify-qa-scope';
  if(company.owner_email!=='taxeastrategies+qa-recc-2026@gmail.com'||![company.razon_social,company.nombre_comercial].some(x=>String(x||'').includes('QA RECC'))||(company.private_document_storage_enabled!==true&&!['restore_qa_private_flag','inspect_global_ocr'].includes(body.action)))throw Error('QA_SCOPE_NOT_VERIFIED');
  const unwrap=response=>response?.data??response;
  const recoveryOwner='taxeastrategies+qa-c1-recovery-20261031@gmail.com';
  const recoveryText='TAXEA QA PRIVATE ASSET RECOVERY 20261031\n';
  const recoveryFixture=async()=>{
   const matches=await svc.entities.Company.filter({owner_email:recoveryOwner},'-created_date',2);
   if(matches.length>1)throw Error('QA_AMBIGUOUS');
   let testCompany=matches[0];
   if(testCompany&&(!String(testCompany.razon_social||'').includes('QA C1 RECOVERY')||!String(testCompany.razon_social||'').includes('DATOS FICTICIOS')||testCompany.private_document_storage_enabled!==true))throw Error('QA_SCOPE_NOT_VERIFIED');
   testCompany ||= await svc.entities.Company.create({razon_social:'TAXEA QA C1 RECOVERY 20261031 - DATOS FICTICIOS',nombre_comercial:'TAXEA QA C1 RECOVERY 20261031 - DATOS FICTICIOS',nif_cif:'QA-C1-RECOVERY',owner_email:recoveryOwner,activa:true,private_document_storage_enabled:true});
   const existing=await svc.entities.DocumentAsset.filter({company_id:testCompany.id,purpose:'qa-c1-ledger-restore-20261031',status:'ready'},'-created_date',2);
   if(existing.length>1)throw Error('QA_AMBIGUOUS');
   let asset=existing[0];
   if(!asset){const saved=await savePrivateAsset(svc,user,testCompany,new File([recoveryText],'QA-C1-RESTORE-LEDGER-20261031.txt',{type:'text/plain'}),Deno.env);asset=await svc.entities.DocumentAsset.update(saved.asset.id,{purpose:'qa-c1-ledger-restore-20261031'});}
   if(asset.company_id!==testCompany.id||asset.original_name!=='QA-C1-RESTORE-LEDGER-20261031.txt')throw Error('QA_SCOPE_NOT_VERIFIED');
   return{testCompany,asset};
  };
  if(body.action==='simulate_backup_required'){
   phase='qa-drive-backup-loss';if(body.confirmation!=='QA_SYNTHETIC_DRIVE_RESTORE_TEST')throw Error('QA_CONFIRMATION_REQUIRED');
   const {testCompany,asset}=await recoveryFixture();
   if(asset.object_name.includes('-backup-recovery-qa')&&asset.restored_at)return Response.json({ok:true,alreadyRestored:true,repeatedLossPrevented:true,syntheticOnly:true});
   const backup=unwrap(await client.functions.invoke('documentStorage',{action:'asset_backup_recovery_plan',assetId:asset.id}));if(!backup.backupAvailable)throw Error('QA_BACKUP_NOT_READY');
   if(!asset.object_name.includes('-backup-recovery-qa')){
    const source=await readPrivateAssetBytes(svc,user,assetReference(asset.id),Deno.env,testCompany.id);if(new TextDecoder().decode(source.bytes)!==recoveryText)throw Error('QA_SCOPE_NOT_VERIFIED');
    const newPath=asset.object_name.replace(/(\.[A-Za-z0-9]+)$/,'-backup-recovery-qa$1');if(newPath===asset.object_name)throw Error('QA_SCOPE_NOT_VERIFIED');
    await svc.entities.DocumentAsset.update(asset.id,{object_name:newPath,restored_at:'',restored_by:'',restore_source_generation:''});
   }
   const plan=unwrap(await client.functions.invoke('documentStorage',{action:'asset_recovery_plan',assetId:asset.id}));
   return Response.json({ok:plan.mode==='backup_required',syntheticOnly:true,assetId:asset.id,expectedGeneration:plan.expectedGeneration,expectedSha256:plan.sha256,mode:plan.mode,originalCloudObjectRetained:true,realCustomerWrites:0});
  }
  if(body.action==='recover_fixture_from_backup'){
   phase='qa-drive-restore';const {testCompany,asset}=await recoveryFixture();
   const result=unwrap(await client.functions.invoke('documentStorage',{action:'restore_asset_backup',assetId:asset.id,expectedGeneration:body.expectedGeneration,expectedSha256:body.expectedSha256}));
   const current=await readPrivateAssetBytes(svc,user,assetReference(asset.id),Deno.env,testCompany.id),transport=await storageTransport(Deno.env),unsigned=await transport.unsignedStatus(current.asset.object_name);
   return Response.json({ok:result.ok===true&&new TextDecoder().decode(current.bytes)===recoveryText&&[401,403,404].includes(unsigned),syntheticOnly:true,backupVerified:result.backupVerified===true,alreadyRestored:result.alreadyRestored===true,bytes:current.bytes.length,hashVerified:current.asset.sha256===body.expectedSha256,referenceUnchanged:result.file_url===assetReference(asset.id),publicAccessDenied:[401,403,404].includes(unsigned),realCustomerWrites:0,accountingWrites:0});
  }
  if(body.action==='prepare_global_ocr_fixture'){
   if(Deno.env.get('TAXEA_PRIVATE_STORAGE_ENFORCED')!=='true')throw Error('QA_GLOBAL_FLAG_NOT_ACTIVE');
   await svc.entities.Company.update(COMPANY,{private_document_storage_enabled:false});
   return Response.json({ok:true,syntheticOnly:true,companySpecificFlag:false,globalPrivateOcrEnabled:true,accountingWrites:0,realCustomerWrites:0});
  }
  if(body.action==='restore_qa_private_flag'){
   await svc.entities.Company.update(COMPANY,{private_document_storage_enabled:true});
   return Response.json({ok:true,syntheticOnly:true,companySpecificFlagRestored:true,globalPrivateOcrEnabled:Deno.env.get('TAXEA_PRIVATE_STORAGE_ENFORCED')==='true',accountingWrites:0,realCustomerWrites:0});
  }
  if(body.action==='inspect_global_ocr'){
   const records=await svc.entities.OcrInvoiceDocument.filter({company_id:COMPANY,originalFileName:{$in:['QA-C1-GLOBAL-OCR-20261031.pdf','QA-C1-GLOBAL-OCR-PROD-20261031.pdf']}},'-created_date',5);
   return Response.json({ok:true,syntheticOnly:true,globalPrivateOcrEnabled:Deno.env.get('TAXEA_PRIVATE_STORAGE_ENFORCED')==='true',companySpecificFlag:company.private_document_storage_enabled===true,documents:records.map(row=>({id:row.id,name:row.originalFileName,status:row.status,privateReference:String(row.fileStorageUrl||'').startsWith('https://taxeaportal.com/private-document/'),hasExtraction:Boolean(row.extractedData),linkedInvoice:Boolean(row.linkedInvoiceId),linkedJournal:Boolean(row.linkedJournalEntryId)})),accountingWrites:0,realCustomerWrites:0});
  }
  if(body.action==='catalog_probe'){
   const cutoff=new Date().toISOString(),query={company_id:COMPANY,created_date:{$lte:cutoff},status:'ready'};
   const first=await svc.entities.DocumentAsset.filter(query,'id',2);
   const last=first.at(-1)?.id;
   const second=last?await svc.entities.DocumentAsset.filter({...query,id:{$gt:last}},'id',2):[];
   const ordered=first.every((row,i)=>!i||row.id>first[i-1].id)&&second.every(row=>row.id>last);
   return Response.json({ok:first.length===2&&second.length>0&&ordered,syntheticOnly:true,keysetQuerySupported:ordered&&second.length>0,firstCount:first.length,nextCount:second.length,globalPrivateOcrEnabled:Deno.env.get('TAXEA_PRIVATE_STORAGE_ENFORCED')==='true',dmsPrivateEnabled:Deno.env.get('TAXEA_PRIVATE_DMS_ENFORCED')==='true',realCustomerWrites:0});
  }
  if(body.action==='identity_inventory'){
   const users=[];
   for(const email of ['taxeastrategies+qa-recc-2026@gmail.com','taxeastrategies+qa-security-b-20261023@gmail.com']){
    const rows=await svc.entities.User.filter({email},'-created_date',2);
    users.push({label:email.includes('qa-recc')?'A':'B',registered:rows.length===1,ambiguous:rows.length>1,role:rows[0]?.role||null,companyLinked:Boolean(rows[0]?.company_id||rows[0]?.data?.company_id)});
   }
   return Response.json({ok:true,syntheticOnly:true,users,realCustomerWrites:0});
  }
  if(body.action==='stage_private_qa'){
   phase='qa-staging-upload';
   const source=await readPrivateAssetBytes(svc,user,assetReference('6ae5e7066914df82b5243183'),Deno.env,COMPANY);
   const file=new File([source.bytes],'QA-C1-ADMIN-STAGING-20261031.pdf',{type:'application/pdf'});
   const uploaded=unwrap(await client.functions.invoke('documentStorage',{action:'upload_staging',file}));
   if(!uploaded.ok||!uploaded.assetId)throw Error('QA_STAGING_FAILED');
   const staged=await svc.entities.DocumentAsset.get(uploaded.assetId);
   if(staged.company_id!=='__admin_staging__'||staged.sha256!==source.asset.sha256||staged.status!=='ready')throw Error('QA_STAGING_FAILED');
   phase='qa-staging-extraction';
   const extracted=unwrap(await client.functions.invoke('invokeLimitedLLM',{prompt:'Este es un documento sintético de prueba. Devuelve is_synthetic=true si contiene PRUEBA INTERNA o DATOS FICTICIOS. No contabilices nada.',file_urls:[uploaded.file_url],response_json_schema:{type:'object',properties:{is_synthetic:{type:'boolean'}}}}));
   phase='qa-staging-assignment';
   const assigned=unwrap(await client.functions.invoke('documentStorage',{action:'assign_staged_asset',assetId:uploaded.assetId,companyId:COMPANY}));
   const target=await svc.entities.DocumentAsset.get(assigned.assetId),retained=await svc.entities.DocumentAsset.get(staged.id);
   return Response.json({ok:assigned.ok===true&&target.company_id===COMPANY&&target.sha256===source.asset.sha256&&retained.status==='ready',syntheticOnly:true,stagingPrivate:staged.company_id==='__admin_staging__',aiResolvedPrivateDocument:extracted?.result?.is_synthetic===true,assignedToQa:target.company_id===COMPANY,sourceRetained:retained.status==='ready',hashVerified:target.sha256===source.asset.sha256,accountingWrites:0,realCustomerWrites:0});
  }
  if(body.action==='prepare_recovery_fixture'){
   phase='qa-recovery-prepare';const {testCompany,asset}=await recoveryFixture();
   return Response.json({ok:true,syntheticOnly:true,companyId:testCompany.id,assetId:asset.id,file_url:assetReference(asset.id),bytes:asset.size,sha256:asset.sha256,expectedGeneration:asset.generation,accountingWrites:0,realCustomerWrites:0});
  }
  if(body.action==='simulate_recovery_loss'){
   phase='qa-recovery-loss';
   if(body.confirmation!=='QA_SYNTHETIC_SOFT_DELETE_RESTORE_TEST')throw Error('QA_CONFIRMATION_REQUIRED');
   const {testCompany,asset}=await recoveryFixture();
   if(asset.restored_at)return Response.json({ok:true,syntheticOnly:true,alreadyRestored:true,repeatedDeletionPrevented:true});
   const transport=await storageTransport(Deno.env);
   try{const original=await readPrivateAssetBytes(svc,user,assetReference(asset.id),Deno.env,testCompany.id);if(new TextDecoder().decode(original.bytes)!==recoveryText)throw Error('QA_SCOPE_NOT_VERIFIED');await transport.remove(asset.object_name,asset.generation);}
   catch(error){if(error?.message!=='STORAGE_DOWNLOAD_FAILED_404')throw error;}
   const plan=unwrap(await client.functions.invoke('documentStorage',{action:'asset_recovery_plan',assetId:asset.id}));
   return Response.json({ok:plan.ok===true&&plan.mode==='soft_delete',syntheticOnly:true,assetId:asset.id,file_url:assetReference(asset.id),planMode:plan.mode,expectedGeneration:plan.expectedGeneration,expectedSha256:plan.sha256,bytes:asset.size,accountingWrites:0,realCustomerWrites:0});
  }
  if(body.action==='recover_fixture'){
   phase='qa-recovery-apply';const {testCompany,asset}=await recoveryFixture();
   const result=unwrap(await client.functions.invoke('documentStorage',{action:'restore_asset',assetId:asset.id,expectedGeneration:body.expectedGeneration,expectedSha256:body.expectedSha256}));
   const reread=await readPrivateAssetBytes(svc,user,assetReference(asset.id),Deno.env,testCompany.id),after=await svc.entities.DocumentAsset.get(asset.id),transport=await storageTransport(Deno.env),unsignedStatus=await transport.unsignedStatus(after.object_name);
   return Response.json({ok:result.ok===true&&new TextDecoder().decode(reread.bytes)===recoveryText&&[401,403,404].includes(unsignedStatus),syntheticOnly:true,assetId:asset.id,file_url:assetReference(asset.id),bytes:reread.bytes.length,hashVerified:after.sha256===asset.sha256,generationChanged:after.generation!==body.expectedGeneration,referenceUnchanged:result.file_url===assetReference(asset.id),publicAccessDenied:[401,403,404].includes(unsignedStatus),alreadyRestored:result.alreadyRestored===true,accountingWrites:0,realCustomerWrites:0});
  }
  if(body.action==='prepare'){
   phase='prepare-audit';
   let cases=await svc.entities.TaxeaAuditCase.filter({title:'QA C1 PRIVATE DOCUMENTS 20261031'},'-created_date',10);
   if(cases.length>1||cases.some(x=>x.clientId!==COMPANY))throw Error('QA_AMBIGUOUS');
   const audit=cases[0]||await svc.entities.TaxeaAuditCase.create({title:'QA C1 PRIVATE DOCUMENTS 20261031',clientId:COMPANY,clientName:'EMPRESA FICTICIA QA C1',status:'borrador',taxYear:2026,notes:'Datos ficticios. Sin documentos ni operaciones de clientes.'});
   phase='prepare-mercantil';
   let societies=await svc.entities.MercantilSociedad.filter({nombreFiscal:'QA C1 MERCANTIL PRIVATE 20261031'},'-created_date',10);
   if(societies.length>1||societies.some(x=>x.clienteAccountId!==COMPANY))throw Error('QA_AMBIGUOUS');
   const society=societies[0]||await svc.entities.MercantilSociedad.create({nombreFiscal:'QA C1 MERCANTIL PRIVATE 20261031',nif:'QA-C1-FAKE',clienteAccountId:COMPANY,visibilidadCliente:true,observaciones:'Prueba sintética de privacidad. No presentar en registros.'});
   phase='prepare-expediente';
   let records=await svc.entities.MercantilExpediente.filter({sociedadId:society.id,ejercicio:'2026'},'-created_date',10);
   if(records.length>1)throw Error('QA_AMBIGUOUS');
   const record=records[0]||await svc.entities.MercantilExpediente.create({sociedadId:society.id,sociedadNombre:society.nombreFiscal,ejercicio:'2026',observaciones:'QA privacidad únicamente. Sin asientos ni presentaciones.'});
   return Response.json({ok:true,syntheticOnly:true,auditCaseId:audit.id,sociedadId:society.id,expedienteId:record.id,accountingWrites:0,realCustomerWrites:0});
  }
  if(body.action==='inspect'){
   const assets=await svc.entities.DocumentAsset.filter({company_id:COMPANY,status:'ready'},'-created_date',100);
   const docs=await svc.entities.LaborOcrDocument.filter({company_id:COMPANY},'-created_date',20);
   const utility=await svc.entities.UtilityDocument.filter({company_id:COMPANY},'-created_date',20);
   return Response.json({ok:true,syntheticOnly:true,assets:assets.map(x=>({id:x.id,name:x.original_name,bytes:x.size,sha256:x.sha256,ready:x.status==='ready',companyScoped:x.company_id===COMPANY})),labor:docs.map(x=>({id:x.id,name:x.original_file_name,private:String(x.file_url).startsWith('https://taxeaportal.com/private-document/'),status:x.ocr_status})),utility:utility.map(x=>({id:x.id,private:String(x.file_uri).startsWith('https://taxeaportal.com/private-document/')})),accountingWrites:0,realCustomerWrites:0});
  }
  return Response.json({error:'Unsupported action'},{status:400});
 }catch(error){return Response.json({error:/^QA_[A-Z_]+$/.test(error?.message||'')?error.message:'QA_OPERATION_FAILED',phase,qaVersion:3,providerStatus:Number(error?.status||error?.response?.status||0)},{status:500});}
});

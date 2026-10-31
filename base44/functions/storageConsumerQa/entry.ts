import {createClientFromRequest} from 'npm:@base44/sdk@0.8.48';
const COMPANY='6ac4c79bbe3474810a3d0e06';
Deno.serve(async req=>{
 try{
  if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
  const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'Unauthorized'},{status:401});
  if(!['admin','super_admin'].includes(user.role)||[user,user.data].filter(Boolean).some(x=>x.is_deleted||['disabled','deleted','blocked','suspended'].includes(x.accountAccessStatus)))return Response.json({error:'Admin only'},{status:403});
  const body=await req.json().catch(()=>({})),svc=client.asServiceRole;
  const company=await svc.entities.Company.get(COMPANY);
  if(company.owner_email!=='taxeastrategies+qa-recc-2026@gmail.com'||![company.razon_social,company.nombre_comercial].some(x=>String(x||'').includes('QA RECC'))||company.private_document_storage_enabled!==true)throw Error('QA_SCOPE_NOT_VERIFIED');
  if(body.action==='prepare'){
   let cases=await svc.entities.TaxeaAuditCase.filter({title:'QA C1 PRIVATE DOCUMENTS 20261031'},'-created_date',10);
   if(cases.length>1||cases.some(x=>x.clientId!==COMPANY))throw Error('QA_AMBIGUOUS');
   const audit=cases[0]||await svc.entities.TaxeaAuditCase.create({title:'QA C1 PRIVATE DOCUMENTS 20261031',clientId:COMPANY,clientName:'EMPRESA FICTICIA QA C1',status:'borrador',taxYear:2026,notes:'Datos ficticios. Sin documentos ni operaciones de clientes.'});
   let societies=await svc.entities.MercantilSociedad.filter({nombreFiscal:'QA C1 MERCANTIL PRIVATE 20261031'},'-created_date',10);
   if(societies.length>1||societies.some(x=>x.clienteAccountId!==COMPANY))throw Error('QA_AMBIGUOUS');
   const society=societies[0]||await svc.entities.MercantilSociedad.create({nombreFiscal:'QA C1 MERCANTIL PRIVATE 20261031',nif:'QA-C1-FAKE',clienteAccountId:COMPANY,visibilidadCliente:true,observaciones:'Prueba sintética de privacidad. No presentar en registros.'});
   let records=await svc.entities.MercantilExpediente.filter({sociedadId:society.id,ejercicio:2026},'-created_date',10);
   if(records.length>1)throw Error('QA_AMBIGUOUS');
   const record=records[0]||await svc.entities.MercantilExpediente.create({sociedadId:society.id,sociedadNombre:society.nombreFiscal,ejercicio:2026,observaciones:'QA privacidad únicamente. Sin asientos ni presentaciones.'});
   return Response.json({ok:true,syntheticOnly:true,auditCaseId:audit.id,sociedadId:society.id,expedienteId:record.id,accountingWrites:0,realCustomerWrites:0});
  }
  if(body.action==='inspect'){
   const assets=await svc.entities.DocumentAsset.filter({company_id:COMPANY,status:'ready'},'-created_date',100);
   const docs=await svc.entities.LaborOcrDocument.filter({company_id:COMPANY},'-created_date',20);
   const utility=await svc.entities.UtilityDocument.filter({company_id:COMPANY},'-created_date',20);
   return Response.json({ok:true,syntheticOnly:true,assets:assets.map(x=>({id:x.id,name:x.original_name,bytes:x.size,sha256:x.sha256,ready:x.status==='ready',companyScoped:x.company_id===COMPANY})),labor:docs.map(x=>({id:x.id,name:x.original_file_name,private:String(x.file_url).startsWith('https://taxeaportal.com/private-document/'),status:x.ocr_status})),utility:utility.map(x=>({id:x.id,private:String(x.file_uri).startsWith('https://taxeaportal.com/private-document/')})),accountingWrites:0,realCustomerWrites:0});
  }
  return Response.json({error:'Unsupported action'},{status:400});
 }catch(error){return Response.json({error:/^QA_[A-Z_]+$/.test(error?.message||'')?error.message:'QA_OPERATION_FAILED'},{status:500});}
});

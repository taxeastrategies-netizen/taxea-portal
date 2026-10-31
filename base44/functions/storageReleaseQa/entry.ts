import {createClientFromRequest} from 'npm:@base44/sdk@0.8.48';
const COMPANY='6ae5d55f7767984317bc85f3',ASSET='6ae5d8ba4d572ed7bfc00322',NUMBER='QA-PRIVATE-PDF-C1-20261031';
Deno.serve(async req=>{
 try{
  if(req.method!=='POST')return Response.json({error:'Método no permitido.'},{status:405});
  const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'Inicia sesión.'},{status:401});
  if([user,user.data].filter(Boolean).some(x=>x.is_deleted===true||['disabled','suspended','blocked','deleted'].includes(String(x.accountAccessStatus||'').toLowerCase())||['eliminado','bloqueado','suspendido'].includes(String(x.status||'').toLowerCase())))return Response.json({error:'Acceso suspendido.'},{status:403});
  if(!['admin','super_admin'].includes(user.role))return Response.json({error:'Solo administración.'},{status:403});
  const body=await req.json().catch(()=>({}));if(!['prepare','revoke'].includes(body.action))return Response.json({error:'Acción no válida.'},{status:400});
  const svc=client.asServiceRole,company=await svc.entities.Company.get(COMPANY);
  if(company.id!==COMPANY||company.owner_email!=='taxeastrategies+qa-security-b-20261023@gmail.com'||!String(company.razon_social).includes('DATOS FICTICIOS')||company.private_document_storage_enabled!==true)throw new Error('QA_COMPANY_NOT_VERIFIED');
  const asset=await svc.entities.DocumentAsset.get(ASSET);if(asset.company_id!==COMPANY||asset.status!=='ready'||!String(asset.original_name).includes('synthetic'))throw new Error('QA_ASSET_NOT_VERIFIED');
  const rows=await svc.entities.Invoice.filter({company_id:COMPANY,numero_factura:NUMBER},'-created_date',2);
  if(rows.length>1)throw new Error('QA_DUPLICATE_FIXTURE');let invoice=rows[0];
  if(body.action==='revoke'){
   if(!invoice||invoice.creation_idempotency_key!=='QA-C1-PRIVATE-PDF-20261031')throw new Error('QA_FIXTURE_NOT_VERIFIED');
   await svc.entities.Invoice.update(invoice.id,{public_token_revoked_at:new Date().toISOString()});
   return Response.json({ok:true,syntheticOnly:true,revoked:true,invoiceId:invoice.id,financialWrites:0,customerWrites:0});
  }
  if(!invoice){
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
   invoice=await svc.entities.Invoice.create({company_id:COMPANY,numero_factura:NUMBER,fecha_emision:'2026-10-31',fecha_recepcion:'2026-10-31',tipo:'recibida',proveedor_nombre:'PROVEEDOR FICTICIO QA',cliente_nombre:'CLIENTE FICTICIO QA',concepto:'Prueba de almacenamiento privado, sin efectos contables',base_imponible:100,tipo_iva:21,cuota_iva:21,total_factura:121,estado_contable:'pendiente',estado_cobro:'pendiente',archivo_url:'https://taxeaportal.com/private-document/'+ASSET,public_token:token,public_token_expires_at:new Date(Date.now()+30*60*1000).toISOString(),creation_idempotency_key:'QA-C1-PRIVATE-PDF-20261031',accounting_migration_hold:true,accounting_migration_hold_reason:'SOURCE_CHECK_PENDING',fiscal_review_status:'pendiente_revision'});
  }
  if(invoice.company_id!==COMPANY||invoice.numero_factura!==NUMBER||invoice.creation_idempotency_key!=='QA-C1-PRIVATE-PDF-20261031')throw new Error('QA_FIXTURE_NOT_VERIFIED');
  return Response.json({ok:true,syntheticOnly:true,invoiceId:invoice.id,token:invoice.public_token,expiresAt:invoice.public_token_expires_at,revoked:!!invoice.public_token_revoked_at,expectedSha256:asset.sha256,expectedBytes:asset.size,customerWrites:0,accountingWrites:0});
 }catch{ return Response.json({error:'No se pudo verificar la prueba aislada.'},{status:409}); }
});

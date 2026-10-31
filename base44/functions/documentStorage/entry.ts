import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { storageConfiguration, publicStorageCertificate, STORAGE_BUCKET, STORAGE_ACCOUNT } from './storageCredentials.mjs';
import { verifyStorageConnection, boundedBytes } from './storageTransport.mjs';
import { storageCompany, isStorageAdmin, savePrivateAsset, resolvePrivateAsset } from './storageAssets.mjs';
import { verifySignedStorageConnection } from './storageSigning.mjs';
import { prepareStorageQa } from './storageQaFixtures.mjs';

const disabled=(user:any)=>[user,user?.data].filter(Boolean).some(state=>state.is_deleted===true
 ||['eliminado','bloqueado','suspendido'].includes(String(state.status||'').trim().toLowerCase())
 ||['disabled','deleted','blocked','suspended'].includes(String(state.accountAccessStatus||'').trim().toLowerCase()));
const response=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});

Deno.serve(async req=>{
 let admin=false;
 try {
  if(req.method!=='POST')return response({error:'Método no permitido.'},405);
  const client=createClientFromRequest(req);
  const user=await client.auth.me().catch(()=>null);
  if(!user?.id)return response({error:'Inicia sesión.'},401);
  if(disabled(user))return response({error:'Acceso al portal suspendido.'},403);
  admin=isStorageAdmin(user);
  const multipart=(req.headers.get('content-type')||'').includes('multipart/form-data');
  let body:any;
  try{
   const bytes=await boundedBytes(req,multipart?20*1024*1024+32768:16384);
   body=multipart?Object.fromEntries((await new Response(bytes,{headers:{'content-type':req.headers.get('content-type')}}).formData()).entries()):JSON.parse(new TextDecoder().decode(bytes));
  }catch{return response({error:'Solicitud no válida o demasiado grande.'},400);}
  const action=body?.action;
  if(action==='prepare_storage_qa'){
   if(!admin)return response({error:'Acceso reservado a administración.'},403);
   return response({ok:true,...await prepareStorageQa(client.asServiceRole,user,Deno.env)});
  }
  if(['public_certificate','verify_connection','verify_signed_connection'].includes(action)){
   if(!admin)return response({error:'Acceso reservado a administración.'},403);
   if(action==='verify_connection')return response({ok:true,...await verifyStorageConnection(Deno.env)});
   if(action==='verify_signed_connection')return response({ok:true,...await verifySignedStorageConnection(Deno.env)});
   const config=storageConfiguration(Deno.env),certificate=await publicStorageCertificate(config);
   return response({ok:true,...certificate,account:STORAGE_ACCOUNT,bucket:STORAGE_BUCKET,privateKeyExposed:false});
  }
  if(!['capabilities','upload','resolve'].includes(action))return response({error:'Operación no admitida.'},400);
  const svc=client.asServiceRole;
  if(action==='resolve'){
   const result=await resolvePrivateAsset(svc,user,body.assetId,Deno.env);
   return result?response({ok:true,...result}):response({error:'Documento no disponible.'},404);
  }
  const company=await storageCompany(svc,user,body.companyId);
  if(!company)return response({error:'Empresa no disponible.'},403);
  if(action==='capabilities')return response({ok:true,privateStorageEnabled:company.private_document_storage_enabled===true,maxFileBytes:20*1024*1024});
  if(!multipart||!(body.file instanceof File))return response({error:'Archivo no válido.'},400);
  if(company.private_document_storage_enabled!==true)return response({error:'El almacenamiento privado aún no está activado para esta empresa.'},409);
  const saved=await savePrivateAsset(svc,user,company,body.file,Deno.env);
  return response({ok:true,file_url:saved.file_url,assetId:saved.asset.id,reused:saved.reused,sha256:saved.asset.sha256,size:saved.asset.size});
 }catch(error){
  const detail=String(error?.message||'');
  const safeCode=/^(STORAGE_AUTH_(NETWORK_(BINDING|TLS|DNS|TIMEOUT|BODY|CONNECT|TypeError|AbortError|OperationError|InvalidAccessError|ReferenceError|Error)|NOT_JSON_\d{3}|FAILED_\d{3}_(INVALID_GRANT|INVALID_CLIENT|INVALID_REQUEST|INVALID_SCOPE|UNAUTHORIZED_CLIENT|ACCESS_DENIED|UNEXPECTED))|STORAGE_STEP_AUTH_(TypeError|AbortError|OperationError|InvalidAccessError|ReferenceError|Error)|STORAGE_STEP_(AUTH|UPLOAD|READ|UNSIGNED|CLEANUP)|STORAGE_(AUTH|UPLOAD|DOWNLOAD)_FAILED_\d{3}|STORAGE_(PROBE|CLEANUP)_FAILED|PRIVATE_STORAGE_(NOT_CONFIGURED|INVALID_CONFIG)|STORAGE_(UNSUPPORTED_FILE|INVALID_SIZE|HASH_MISMATCH))$/.test(detail)?detail:'PRIVATE_STORAGE_UNAVAILABLE';
  const status=safeCode==='STORAGE_UNSUPPORTED_FILE'?415:safeCode==='STORAGE_INVALID_SIZE'?413:503;
  return response({error:'No se ha podido completar la operación de almacenamiento privado.',code:safeCode,...(admin&&Array.isArray(error?.storageHints)?{diagnosticHints:error.storageHints}:{})},status);
 }
});

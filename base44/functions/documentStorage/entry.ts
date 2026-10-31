import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { storageConfiguration, publicStorageCertificate, STORAGE_BUCKET, STORAGE_ACCOUNT } from './storageCredentials.mjs';

const disabled=(user:any)=>[user,user?.data].filter(Boolean).some(state=>state.is_deleted===true
 ||['eliminado','bloqueado','suspendido'].includes(String(state.status||'').trim().toLowerCase())
 ||['disabled','deleted','blocked','suspended'].includes(String(state.accountAccessStatus||'').trim().toLowerCase()));
const response=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

Deno.serve(async req=>{
 try {
  if(req.method!=='POST')return response({error:'Método no permitido.'},405);
  const client=createClientFromRequest(req);
  const user=await client.auth.me().catch(()=>null);
  if(!user)return response({error:'Inicia sesión.'},401);
  if(disabled(user))return response({error:'Acceso al portal suspendido.'},403);
  if(!['admin','super_admin'].includes(user.role))return response({error:'Acceso reservado a administración.'},403);
  const body=await req.json().catch(()=>({}));
  if(body.action!=='public_certificate')return response({error:'Operación no admitida.'},400);
  const config=storageConfiguration(Deno.env);
  const certificate=await publicStorageCertificate(config);
  return response({ok:true,...certificate,account:STORAGE_ACCOUNT,bucket:STORAGE_BUCKET,privateKeyExposed:false});
 } catch {
  return response({error:'No se ha podido validar la custodia del almacenamiento privado.',code:'PRIVATE_STORAGE_CUSTODY_UNVERIFIED'},503);
 }
});

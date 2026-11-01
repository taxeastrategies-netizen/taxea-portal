import {createClientFromRequest} from 'npm:@base44/sdk@0.8.25';
// Retired bootstrap route. User roles are managed through Base44's authorized user panel.
// Keep the endpoint inert so old URLs cannot invoke a surviving privilege mutation.
Deno.serve(async req=>{
 try{
  if(req.method!=='POST')return Response.json({error:'Método no permitido.'},{status:405});
  if(!/^Bearer [^\s]{1,16384}$/.test(req.headers.get('Authorization')||''))return Response.json({error:'No autenticado.'},{status:401});
  const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
  if(!user?.id)return Response.json({error:'No autenticado.'},{status:401});
  if([user,user.data].filter(Boolean).some(s=>s.is_deleted===true||['eliminado','bloqueado','suspendido'].includes(String(s.status||'').trim().toLowerCase())||['disabled','deleted','blocked','suspended'].includes(String(s.accountAccessStatus||'').trim().toLowerCase())))return Response.json({error:'Acceso suspendido.'},{status:403});
  if(!['admin','super_admin'].includes(user.role))return Response.json({error:'Acceso reservado a administración.'},{status:403});
  return Response.json({error:'Esta operación se ha retirado. Gestiona los permisos desde el panel de usuarios de Base44.',code:'ROLE_PROMOTION_RETIRED',rolesChanged:0},{status:410,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'No autenticado.'},{status:401});}
});

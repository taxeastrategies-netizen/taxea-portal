import {createClientFromRequest} from 'npm:@base44/sdk@0.8.57';

const ADMIN=['admin','super_admin'];
const text=(value:any,max=2000)=>String(value||'').trim().slice(0,max);
function dueDate(now:Date){
  const next=new Date(now);const day=next.getUTCDate();next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);
  const end=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();next.setUTCDate(Math.min(day,end));return next.toISOString();
}
function receipt(row:any){return row?{id:row.id,reference:row.reference,status:row.status,requestedAt:row.requested_at,dueAt:row.due_at,completedAt:row.completed_at||null}:null;}
async function all(entity:any,filter:any){
  const result=[];for(let skip=0;skip<10000;skip+=200){const page=await entity.filter(filter,'requested_at',200,skip);result.push(...(page||[]));if(!page||page.length<200)return result;}
  throw Object.assign(new Error('La consulta supera el límite seguro de solicitudes.'),{status:413});
}
Deno.serve(async(req)=>{
  try{
    if(req.method!=='POST')return Response.json({error:'Método no permitido'},{status:405,headers:{Allow:'POST'}});
    const base44=createClientFromRequest(req),user=await base44.auth.me().catch(()=>null);
    if(!user?.id||!user?.email)return Response.json({error:'Inicia sesión para gestionar tu cuenta.'},{status:401});
    const body=await req.json().catch(()=>({})),action=text(body.action,50);
    const admin=ADMIN.includes(user.role),svc=base44.asServiceRole;
    const requests=svc.entities.AccountDeletionRequest;
    if(action==='status'){
      const own=await all(requests,{user_id:user.id});
      return Response.json({request:receipt(own.find((row:any)=>row.status!=='completed')||own.at(-1)),policyVersion:'2026-10-22'});
    }
    if(action==='request'){
      if(body.confirmation!=='ELIMINAR')return Response.json({error:'Escribe ELIMINAR para confirmar la solicitud.'},{status:422});
      const existing=(await all(requests,{user_id:user.id})).find((row:any)=>row.status!=='completed');
      if(existing)return Response.json({success:true,alreadyRequested:true,request:receipt(existing)});
      const now=new Date();
      // The authenticated identity is authoritative. A body user/company id
      // cannot redirect a deletion request to someone else's account.
      const saved=await requests.create({user_id:user.id,email:user.email,status:'requested',reference:'BAJA-'+crypto.randomUUID(),requested_at:now.toISOString(),due_at:dueDate(now)});
      return Response.json({success:true,request:receipt(saved),message:'Solicitud registrada. La eliminación se completa y confirma tras separar los datos sujetos a conservación legal.'});
    }
    if(!admin)return Response.json({error:'Solo administración puede tramitar solicitudes de otras cuentas.'},{status:403});
    if(action==='admin_list'){
      const rows=await all(requests,{});
      return Response.json({requests:rows,automaticDeletion:false});
    }
    if(!['admin_review','admin_complete'].includes(action))return Response.json({error:'Acción no admitida'},{status:400});
    const id=text(body.requestId,120);
    if(!id)return Response.json({error:'Indica una solicitud válida.'},{status:422});
    let record;
    try{record=await requests.get(id);}catch(error){if(Number(error?.status||error?.response?.status)!==404)throw error;}
    if(!record)return Response.json({error:'Solicitud no encontrada'},{status:404});
    if(record.status==='completed')return Response.json({success:true,alreadyCompleted:true,request:receipt(record)});
    if(action==='admin_review'){
      const saved=await requests.update(record.id,{status:'reviewing',reviewed_by:user.email});
      return Response.json({success:true,request:receipt(saved)});
    }
    const confirmations=body.confirmations||{};
    if(body.confirmation!=='CERRAR ELIMINACIÓN'||!['dataCleanup','oauthCleanup','billingReview','confirmationSent'].every(key=>confirmations[key]===true))
      return Response.json({error:'Confirma eliminación de datos no retenibles, revocación de accesos, revisión de cobros y comunicación al titular.'},{status:422});
    const notes=text(body.retentionNotes),evidence=text(body.evidence);
    if(notes.length<20||evidence.length<20)return Response.json({error:'Documenta qué se conserva y por qué, y la evidencia de eliminación/comunicación.'},{status:422});
    let target;
    try{target=await svc.entities.User.get(record.user_id);}catch(error){if(Number(error?.status||error?.response?.status)!==404)throw error;}
    // A soft flag is NOT proof of account deletion. Completion is impossible
    // while the provider still holds the actual User record.
    if(target)return Response.json({error:'La cuenta sigue existiendo en Base44. El marcado como eliminada no basta: completa su eliminación real y vuelve a verificar.',code:'ACCOUNT_STILL_EXISTS'},{status:409});
    const saved=await requests.update(record.id,{status:'completed',completed_at:new Date().toISOString(),completed_by:user.email,retention_notes:notes,completion_evidence:evidence,data_cleanup_confirmed:true,oauth_cleanup_confirmed:true,billing_review_confirmed:true,confirmation_sent:true});
    return Response.json({success:true,request:receipt(saved)});
  }catch(error){
    const requestId=crypto.randomUUID();console.error('[accountDeletionOperations]',{requestId,name:String(error?.name||'Error')});
    return Response.json({error:'No se pudo completar la operación. Reintenta o facilita esta referencia a Taxea.',requestId},{status:Number(error?.status)===413?413:500});
  }
});


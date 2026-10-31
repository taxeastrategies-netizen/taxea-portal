import {createClientFromRequest} from 'npm:@base44/sdk@0.8.48';
Deno.serve(async req=>{
 if(req.method!=='POST')return Response.json({error:'Método no permitido'},{status:405});
 const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
 if(!user)return Response.json({error:'Inicia sesión'},{status:401});
 if(!['admin','super_admin'].includes(user.role)||[user,user.data].filter(Boolean).some(x=>x.is_deleted||['suspended','disabled','blocked','deleted'].includes(x.accountAccessStatus)))return Response.json({error:'No autorizado'},{status:403});
 return Response.json({ok:true,isolatedFunctionRegistrationVerified:true,syntheticOnly:true,dataReads:0,dataWrites:0});
});

import {createClientFromRequest} from 'npm:@base44/sdk@0.8.48';
import {storageAccountEnabled,isStorageAdmin} from '../documentStorage/storageAssets.mjs';
Deno.serve(async req=>{
 if(req.method!=='POST')return Response.json({error:'Método no permitido'},{status:405});
 const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
 if(!user)return Response.json({error:'Inicia sesión'},{status:401});
 if(!storageAccountEnabled(user)||!isStorageAdmin(user))return Response.json({error:'No autorizado'},{status:403});
 return Response.json({ok:true,sharedModuleImportVerified:true,syntheticOnly:true,dataReads:0,dataWrites:0});
});

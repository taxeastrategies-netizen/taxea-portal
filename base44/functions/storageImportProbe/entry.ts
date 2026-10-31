import {createClientFromRequest} from 'npm:@base44/sdk@0.8.48';
import {storageAccountEnabled,storageEnabled,assetIdFromReference} from './storageRuntime.generated.mjs';
Deno.serve(async req=>{
 if(req.method!=='POST')return Response.json({error:'Method'},{status:405});
 const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
 if(!user?.id)return Response.json({error:'Auth'},{status:401});
 if(!['admin','super_admin'].includes(user.role)||!storageAccountEnabled(user))return Response.json({error:'Forbidden'},{status:403});
 return Response.json({ok:true,ownFolderRuntimeVerified:true,privateGloballyEnabled:storageEnabled({},Deno.env),referenceParser:assetIdFromReference('https://taxeaportal.com/private-document/6ae5d8ba4d572ed7bfc00322')==='6ae5d8ba4d572ed7bfc00322'});
});

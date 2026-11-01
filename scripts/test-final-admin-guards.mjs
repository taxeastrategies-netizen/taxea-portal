import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import vm from'node:vm';import*as esbuild from'esbuild';let checks=0;
for(const name of ['saveCompanyAsAdmin','trackClientAccess']){
 const entry=path.resolve('base44/functions/'+name+'/entry.ts'),bundle=await esbuild.build({stdin:{contents:fs.readFileSync(entry,'utf8'),loader:'ts',resolveDir:path.dirname(entry)},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'sdk-mock',setup(b){b.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({loader:'js',contents:'export function createClientFromRequest(){return globalThis.__client;}'}));}}]});
 let handler,user=null,privileged=0,writes=0;const company={id:'qa-company',owner_email:'owner@example.test'},account={id:'qa-account',email:'owner@example.test',firstAccessCompleted:true};const service={entities:{Company:{get:async()=>company,filter:async()=>[company],update:async(id,p)=>{assert.equal(id,company.id);writes++;return{...company,...p};}},User:{list:async()=>[]},ClientAccount:{filter:async()=>[account],update:async(id)=>{assert.equal(id,account.id);writes++;}},ClientAccessAuditLog:{create:async()=>{writes++;}}}};
 const client={auth:{me:async()=>user},get asServiceRole(){privileged++;return service;}},ctx=vm.createContext({console,Request,Response,crypto,URL,TextEncoder,TextDecoder,__client:client,Deno:{serve(fn){handler=fn;},env:{get(){throw Error('Unexpected secret access');}}}});vm.runInContext(bundle.outputFiles[0].text,ctx);
 const invoke=async body=>{const r=await handler(new Request('https://qa.invalid/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})}));return{status:r.status,body:await r.json()};},eq=(a,b)=>{assert.deepEqual(a,b,name);checks++;};
 for(const actor of [null,{}, {role:'admin',email:'owner@example.test'}]){user=actor;eq((await invoke({role:'admin'})).status,401);}eq(privileged,0);eq(writes,0);
 for(const role of ['user','admin','super_admin'])for(const state of [{is_deleted:true},{status:'BLOQUEADO'},{data:{status:' suspendido '}},{accountAccessStatus:'disabled'},{data:{accountAccessStatus:'deleted'}}]){user={id:'qa',role,email:account.email,...state};eq((await invoke({role:'admin',status:'active'})).status,403);}eq(privileged,0);eq(writes,0);
 if(name==='saveCompanyAsAdmin'){
  user={id:'normal',role:'user',email:account.email,data:{role:'admin'}};eq((await invoke({role:'admin',companyData:{owner_email:account.email},clientEmail:account.email})).status,403);eq(privileged,0);eq(writes,0);
  user={id:'admin',role:'admin',email:'admin@example.test'};eq((await invoke()).status,400);eq(writes,0);eq((await invoke({companyData:{nombre:'SYNTHETIC'},clientEmail:account.email,companyId:company.id})).status,200);eq(writes,1);
 }else{
  user={id:'admin',role:'admin',email:'admin@example.test'};eq((await invoke()).status,200);eq(writes,0);
  user={id:'normal',role:'user',email:'foreign@example.test',data:{company_id:account.id}};eq((await invoke({accountId:account.id})).status,404);eq(writes,0);
  user={id:'normal',role:'user',email:account.email,data:{company_id:account.id}};eq((await invoke({accountId:'foreign',role:'admin'})).status,200);eq(writes,2);
 }
}
console.log(JSON.stringify({ok:true,checks,actualHandlers:true,realAccountChanges:0,realCompanyWrites:0,realFinancialWrites:0}));

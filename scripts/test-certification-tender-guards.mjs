import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import vm from'node:vm';import*as esbuild from'esbuild';let checks=0;
for(const name of ['searchTenders','taxAccountingCertification']){
 const entry=path.resolve('base44/functions/'+name+'/entry.ts'),bundle=await esbuild.build({stdin:{contents:fs.readFileSync(entry,'utf8'),loader:'ts',resolveDir:path.dirname(entry)},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'sdk-mock',setup(b){b.onResolve({filter:/^npm:fast-xml-parser/},()=>({path:'xml',namespace:'xml-qa'}));b.onLoad({filter:/.*/,namespace:'xml-qa'},()=>({loader:'js',contents:'export class XMLParser{parse(){throw Error("Unexpected XML parsing in authorization probe")}}'}));b.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({loader:'js',contents:'export function createClientFromRequest(){return globalThis.__client;}'}));}}]});
 let handler,user=null,privileged=0,financialReads=0,network=0;const company={id:'qa-company',activa:true,owner_email:'owner@example.test',usuarios_autorizados:['member@example.test']};const entities=new Proxy({Company:{get:async()=>company}},{get:(obj,key)=>key in obj?obj[key]:{filter:async()=>{financialReads++;return[];}}});
 const client={auth:{me:async()=>user},get asServiceRole(){privileged++;return{entities};}},ctx=vm.createContext({console,Request,Response,crypto,URL,URLSearchParams,TextEncoder,TextDecoder,Intl,structuredClone,setTimeout,clearTimeout,AbortController,AbortSignal,Uint8Array,__client:client,Deno:{serve(fn){handler=fn;},env:{get(){throw Error('Unexpected secret access');}}},fetch:async()=>{network++;throw Error('Unexpected network');}});vm.runInContext(bundle.outputFiles[0].text,ctx);
 const invoke=async body=>{const r=await handler(new Request('https://qa.invalid/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})}));return{status:r.status,body:await r.json()};},eq=(a,b)=>{assert.deepEqual(a,b,name);checks++;};
 for(const actor of [null,{}, {email:company.owner_email,role:'admin'}]){user=actor;eq((await invoke()).status,401);}eq(privileged,0);eq(network,0);eq(financialReads,0);
 for(const role of ['user','admin','super_admin'])for(const state of [{is_deleted:true},{status:'bloqueado'},{data:{accountAccessStatus:'disabled'}}]){user={id:'qa',email:company.owner_email,role,...state};eq((await invoke({action:'self_test'})).status,403);}eq(privileged,0);eq(network,0);eq(financialReads,0);
 if(name==='searchTenders'){
  user={id:'normal',email:company.owner_email,role:'user'};eq((await invoke({action:'refresh_source',source:'hosted',role:'admin'})).status,403);eq(network,0);eq((await invoke({kind:'invalid'})).status,400);
  user={id:'admin',role:'admin'};eq((await invoke({action:'refresh_source',source:'invalid'})).status,400);eq(network,0);
 }else{
  user={id:'forged',email:'foreign@example.test',role:'user',data:{company_id:company.id,role:'admin'}};eq((await invoke({companyId:company.id,role:'admin'})).status,403);eq(financialReads,0);
  for(const email of [company.owner_email,' MEMBER@example.test ']){user={id:'normal',email,role:'user'};eq((await invoke({companyId:company.id})).status,200);}
  company.activa=false;const before=financialReads;eq((await invoke({companyId:company.id})).status,403);eq(financialReads,before);company.activa=true;
  user={id:'admin',email:'admin@example.test',role:'admin'};eq((await invoke({companyId:company.id})).status,200);
 }
}
console.log(JSON.stringify({ok:true,checks,actualHandlers:true,realProviderCalls:0,realFinancialReads:0,realFinancialWrites:0}));

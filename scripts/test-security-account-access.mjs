import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as esbuild from 'esbuild';

const names=['companyContextOperations','getCompanyContacts','getCompanyFinancials','invoiceOperations','documentBackupToDrive','importClientAccounting','sendEmail','invokeLimitedLLM','limitedCoreOperations'];
const disabled=[{is_deleted:true},{status:'eliminado'},{status:'bloqueado'},{status:'suspendido'},{status:' SUSPENDIDO '},{accountAccessStatus:'suspended'},{accountAccessStatus:'blocked'},{accountAccessStatus:'disabled'},{accountAccessStatus:'deleted'}];
let checks=0;
function check(condition,label){assert.ok(condition,label);checks++;}
function buildClient(user,{companyOwner=user?.email,current=user}={}){
 const counts={serviceReads:0,entityReads:0,writes:0,network:0,coreCalls:0};
 const entities=new Proxy({}, {get(_,entity){return {
  async get(id){counts.entityReads++;if(entity==='User'&&id===user?.id)return current;if(entity==='Company'&&id==='qa-company')return {id,owner_email:companyOwner,activa:true,usuarios_autorizados:[]};return null;},
  async filter(){counts.entityReads++;return [];},
  async update(id,values){counts.writes++;return {id,...values};},
  async create(){counts.writes++;throw Error('Synthetic test forbids creation');},
  async delete(){counts.writes++;throw Error('Synthetic test forbids deletion');},
 };}});
 const service={entities,connectors:{getConnection(){counts.network++;throw Error('Synthetic test forbids connector access');}},integrations:{Core:new Proxy({}, {get(){return ()=>{counts.coreCalls++;throw Error('Synthetic test forbids provider access');};}})}};
 const client={auth:{async me(){return user;}},get asServiceRole(){counts.serviceReads++;return service;}};
 return {client,counts};
}
async function compile(name){
 const sourcePath=`base44/functions/${name}/entry.ts`;
 const source=globalThis.__taxeaSecurityCandidate?.[sourcePath]??fs.readFileSync(sourcePath,'utf8');
 const result=await esbuild.build({stdin:{contents:source,loader:'ts',resolveDir:path.resolve(path.dirname(sourcePath))},bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'synthetic-sdk-only',setup(build){
  build.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'qa'}));
  build.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export const createClientFromRequest=()=>globalThis.__client;',loader:'js'}));
 }}]});
 return result.outputFiles[0].text;
}
function instantiate(code,settings){
 let handler;
 const {client,counts}=buildClient(settings.user,settings);
 const module={exports:{}};
 const context=vm.createContext({__client:client,module,exports:module.exports,Request,Response,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,AbortSignal,ReadableStream,crypto:webcrypto,atob,btoa,setTimeout,clearTimeout,fetch(){counts.network++;throw Error('Synthetic test forbids fetch');},console:{log(){},warn(){},error(){}},Deno:{serve(fn){handler=fn;},env:{get(){return undefined;}}}});
 vm.runInContext(code,context);
 handler??=module.exports.default;
 if(typeof handler!=='function')throw Error('No request handler captured');
 return {counts,async invoke(body={},method='POST'){
  const response=await handler(new Request('https://qa.invalid.test/',{method,...(method==='GET'?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(body)})}));
  return {status:response.status,body:await response.json()};
 }};
}

for(const name of names){
 const code=await compile(name);
 for(const role of ['user','admin'])for(const blocked of disabled)for(const nested of [false,true]){
  const user={id:'qa-user',email:'qa@example.test',role,...(nested?{data:blocked}:blocked)};
  const run=instantiate(code,{user});const result=await run.invoke({action:'__synthetic_security_probe__'});
  check(result.status===403&&result.body.code==='ACCOUNT_DISABLED',`${name}: ${role} disabled ${JSON.stringify(blocked)} nested=${nested}`);
  check(run.counts.serviceReads===0&&run.counts.entityReads===0&&run.counts.writes===0,`${name}: denied before privileged data`);
  check(run.counts.network===0&&run.counts.coreCalls===0,`${name}: no external transmission`);
 }
 const wrongMethod=instantiate(code,{user:{id:'qa-user',email:'qa@example.test',role:'admin'}});
 check((await wrongMethod.invoke({},'GET')).status===405,`${name}: GET rejected`);
 check(wrongMethod.counts.serviceReads===0&&wrongMethod.counts.network===0,`${name}: GET has no side effects`);
 const anonymous=instantiate(code,{user:null});
 check((await anonymous.invoke()).status===401,`${name}: anonymous rejected`);
 check(anonymous.counts.serviceReads===0&&anonymous.counts.network===0,`${name}: anonymous cannot reach data`);
 const active=instantiate(code,{user:{id:'qa-user',email:'qa@example.test',role:'user',data:{status:'activo',accountAccessStatus:'active',is_deleted:false}}});
 check((await active.invoke({action:'__synthetic_security_probe__'})).body.code!=='ACCOUNT_DISABLED',`${name}: active users are not falsely suspended`);
}
const contextCode=await compile('companyContextOperations');
const normal={id:'qa-user',email:'qa@example.test',role:'user',data:{company_id:'qa-company',status:'activo'}};
const own=instantiate(contextCode,{user:normal});
check((await own.invoke({action:'set_active_company',companyId:'qa-company'})).status===200,'Active client retains own context');
check(own.counts.writes===0,'Already selected company is idempotent');
const foreign=instantiate(contextCode,{user:normal,companyOwner:'other-qa@example.test'});
check((await foreign.invoke({action:'set_active_company',companyId:'qa-company'})).status===403,'Foreign company remains forbidden');
check(foreign.counts.writes===0,'No assignment after foreign-company rejection');
const stale=instantiate(contextCode,{user:normal,current:{...normal,data:{...normal.data,status:'suspendido'}}});
check((await stale.invoke({action:'set_active_company',companyId:'qa-company'})).body.code==='ACCOUNT_DISABLED','Fresh stored suspension overrides an apparently active session');
check(stale.counts.writes===0,'Fresh disabled identity never updates context');
console.log(JSON.stringify({ok:true,checks,functions:names.length,vmSdkSimulated:true,networkCalls:0,customerWrites:0,globalNativeSessionRevocationProven:false}));

import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import * as esbuild from 'esbuild';
let checks=0;
for(const name of ['invokeLimitedLLM','limitedCoreOperations']){
 let sdkCalls=0,authCalls=0,reads=0,providerCalls=0,handler,user=null,authThrows=false,sdkThrows=false;
 const entry=path.resolve(`base44/functions/${name}/entry.ts`);
 const client={auth:{async me(){authCalls++;if(authThrows)throw Error('Synthetic invalid token');return user;}},asServiceRole:{entities:{
  Company:{async get(id){reads++;return{id,owner_email:'owner@example.test',activa:true};}},
  AIUsageEvent:{async filter(){reads++;return[];}}
 },integrations:{Core:{async InvokeLLM(){providerCalls++;throw Error('Forbidden in auth test');}}}}};
 const built=await esbuild.build({stdin:{contents:fs.readFileSync(entry,'utf8'),loader:'ts',resolveDir:path.dirname(entry),sourcefile:entry},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'sdk-stub',setup(b){b.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'test'}));b.onLoad({filter:/^sdk$/,namespace:'test'},()=>({loader:'js',contents:'export function createClientFromRequest(){return globalThis.__sdk();}'}));}}]});
 vm.runInContext(built.outputFiles[0].text,vm.createContext({TextEncoder,TextDecoder,Uint8Array,console,Request,Response,URL,crypto:globalThis.crypto,__sdk(){sdkCalls++;if(sdkThrows)throw Error('Invalid authorization header format. Expected Bearer token');return client;},Deno:{env:{get(){return undefined;}},serve(fn){handler=fn;}}}));
 async function invoke(authorization,body={},method='POST'){
  const headers={'content-type':'application/json','Base44-Service-Authorization':'Bearer SYNTHETIC-NOT-USER'};
  if(authorization!==undefined)headers.Authorization=authorization;
  const response=await handler(new Request('https://example.test/function',{method,headers,...(method==='POST'?{body:JSON.stringify(body)}:{})}));
  return{status:response.status,body:await response.json()};
 }
 for(const header of [undefined,'','Basic abc','Bearer','Bearer ','Bearer one two','bearer token','Bearer '+('x'.repeat(16385))]){
  assert.equal((await invoke(header)).status,401);checks++;
 }
 assert.equal(sdkCalls,0);assert.equal(authCalls,0);assert.equal(reads,0);checks+=3;
 assert.equal((await invoke('Bearer valid',{},'GET')).status,405);assert.equal(sdkCalls,0);checks+=2;
 for(const identity of [null,{}, {email:'owner@example.test'}]){user=identity;assert.equal((await invoke('Bearer synthetic')).status,401);checks++;}
 authThrows=true;assert.equal((await invoke('Bearer synthetic')).status,401);authThrows=false;checks++;
 for(const state of [{status:'bloqueado'},{data:{accountAccessStatus:'suspended'}}]){user={id:'qa',role:'user',...state};assert.equal((await invoke('Bearer synthetic')).status,403);checks++;}
 assert.equal(reads,0);checks++;
 user={id:'normal',email:'normal@example.test',role:'user'};
 const denied=await invoke('Bearer synthetic',name==='limitedCoreOperations'?{operation:'extract',companyId:'foreign'}:{action:'status'});
 assert.equal(denied.status,name==='limitedCoreOperations'?403:200);checks++;
 assert.equal(providerCalls,0);checks++;
 sdkThrows=true;assert.equal((await invoke('Bearer synthetic')).status,401);checks++;
}
console.log(JSON.stringify({ok:true,checks,realRequests:0,realCredentials:0,financialWrites:0,providerOperations:0}));

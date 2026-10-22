import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const roots=fs.readdirSync('base44/functions').filter(name=>fs.existsSync(`base44/functions/${name}/entry.ts`));
const publicFunctions=new Set(['getPublicInvoice','stripeWebhook','clientSetup']);
const guarded=roots.filter(name=>!publicFunctions.has(name));
const marker='QA_INTERNAL_SECRET_SHOULD_NOT_LEAK';
const failures=[],results=[];
const globals={Request,Response,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,AbortController,FormData,File,Blob,Buffer,crypto:webcrypto,Date,Math,Intl,atob,btoa,setTimeout,clearTimeout,setInterval,clearInterval,require};
const quiet={log(){},warn(){},error(){},info(){},debug(){}};

async function load(name){
  let handler,identity=null,authThrows=false,authCalls=0,effects=[];
  const forbidden=(kind)=>{effects.push(kind);throw new Error(marker);};
  const mock={auth:{me:async()=>{authCalls++;if(authThrows)throw new Error(marker);return identity;}}};
  for(const field of ['asServiceRole','entities','integrations','functions','agents','connectors','users'])
    Object.defineProperty(mock,field,{get:()=>forbidden(field)});
  const build=await esbuild.build({entryPoints:[`base44/functions/${name}/entry.ts`],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{
    name:'no-external-effects',setup(b){
      b.onResolve({filter:/^(npm:|https?:\/\/)/},args=>({path:args.path,namespace:'safe-stub',pluginData:{importer:args.importer}}));
      b.onLoad({filter:/.*/,namespace:'safe-stub'},args=>{
        if(args.path.includes('@base44/sdk')) return {loader:'js',contents:'export const createClientFromRequest=()=>globalThis.__client;export const createClient=()=>globalThis.__client;'};
        if(args.path.startsWith('npm:stripe')) return {loader:'js',contents:'export default class Stripe{webhooks={constructEventAsync:async()=>{throw new Error("Invalid QA signature");}}}'};
        if(args.path.startsWith('npm:xlsx')) return {loader:'js',contents:'export const read=()=>{throw new Error("No parsing before authentication");};export const utils={};'};
        const source=fs.readFileSync(args.pluginData.importer,'utf8');
        const escaped=args.path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const expression=new RegExp('import\\s+\\{([^}]+)\\}\\s+from\\s+[\'\"]'+escaped+'[\'\"]','g');
        const names=[...source.matchAll(expression)].flatMap(m=>m[1].split(',').map(s=>s.trim().split(/\s+as\s+/)[0]).filter(Boolean));
        return {loader:'js',contents:'export default function stub(){return {};};'+[...new Set(names)].map(key=>`export function ${key}(){return new Proxy({}, {get:()=>()=>{throw new Error("External stub must not run");}});}`).join('\n')};
      });
    },
  }]});
  const exported={},context=vm.createContext({...globals,console:quiet,__client:mock,exports:exported,module:{exports:exported},
    fetch:()=>forbidden('network'),Deno:{serve:fn=>{handler=fn;},env:{get:()=> 'qa-configured-not-a-real-secret'}}});
  vm.runInContext(build.outputFiles[0].text,context);
  handler ||= context.module.exports.default;
  assert.equal(typeof handler,'function',name+' must expose a request handler');
  return {async invoke(body={},options={}){
    identity=options.user || null;authThrows=options.authThrows || false;authCalls=0;effects=[];
    const request=new Request('https://qa.invalid/'+name,{method:'POST',headers:{'content-type':'application/json',...(options.headers || {})},body:JSON.stringify(body)});
    let response;try{response=await handler(request);}catch(error){return {thrown:error.message,effects,authCalls};}
    return {status:response.status,body:await response.text(),effects,authCalls};
  }};
}

for(const name of guarded){
  try {
    const runner=await load(name);
    const source=fs.readFileSync(`base44/functions/${name}/entry.ts`,'utf8');
    const actions=['security_probe',...new Set([...source.matchAll(/(?:body\.)?action\s*===?\s*['"]([^'"]+)['"]/g)].map(m=>m[1]))];
    let cases=0;
    for(const action of actions){
      const r=await runner.invoke({action,companyId:'foreign',company_id:'foreign',docId:'foreign-doc',email:'qa@invalid.test',token:'invalid',companyData:{},clientEmail:'qa@invalid.test'});
      assert.ok([401,403].includes(r.status),`${name}/${action}: expected auth rejection, got ${JSON.stringify(r)}`);
      assert.equal(r.effects.length,0,`${name}/${action}: no data/network/privileged side effects for anonymous caller`);cases++;
    }
    const invalidToken=await runner.invoke({action:'security_probe',companyId:'foreign',company_id:'foreign',email:'qa@invalid.test'},{authThrows:true});
    assert.ok([401,403].includes(invalidToken.status),`${name}: expired/invalid sessions must be denied, not become 500`);
    assert.equal(invalidToken.effects.length,0);assert.ok(!invalidToken.body.includes(marker));
    results.push({name,anonymousActions:cases,invalidSession:true});
  } catch(error){failures.push({name,error:error.message.slice(0,1400)});}
}
// Public endpoints are intentional capability/signature boundaries, not open
// data APIs. Missing/invalid credentials must never read/write client records.
for(const name of publicFunctions){
  try {
    const runner=await load(name);
    const r=await runner.invoke({action:name==='clientSetup'?'validate':'security_probe',token:'invalid'});
    if(name==='clientSetup'){assert.equal(r.status,200);assert.deepEqual(JSON.parse(r.body),{valid:false});}
    else assert.ok([400,401,403,404,503].includes(r.status));
    assert.equal(r.effects.length,0);
    if(name==='stripeWebhook'){
      const invalid=await runner.invoke({type:'invoice.paid'},{headers:{'stripe-signature':'invalid-qa-signature'}});
      assert.equal(invalid.status,400);assert.equal(invalid.effects.length,0);
    }
    if(name==='clientSetup'){
      const issue=await runner.invoke({action:'issue',clientAccountId:'foreign'});assert.equal(issue.status,403);assert.equal(issue.effects.length,0);
    }
    results.push({name,publicCredentialBoundary:true});
  }catch(error){failures.push({name,error:error.message.slice(0,1400)});}
}
console.log(JSON.stringify({ok:failures.length===0,functions:roots.length,protected:guarded.length,publicCapabilities:publicFunctions.size,
  passed:results.length,anonymousActions:results.reduce((sum,row)=>sum+(row.anonymousActions || 0),0),failures},null,2));
assert.equal(failures.length,0,'All backend entry points must enforce the intended security boundary');

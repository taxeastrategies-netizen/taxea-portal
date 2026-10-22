import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as esbuild from 'esbuild';
const marker='QA_PRIVATE_KEY_OR_PROVIDER_PAYLOAD_NEVER_PUBLIC';
const targets=['getCompanyContacts','syncStripe','saveCompanyAsAdmin','getBillingOverview','createStripeCheckout','createPlanUpgradeCheckout','stripeCustomerPortal','importClientAccounting'];
for(const name of targets){
  let handler,writes=0;
  const logs=[],user={id:'admin-qa',role:'admin',email:'admin@qa.invalid'};
  const entities=new Proxy({}, {get(){throw new Error(marker);}});
  const client={auth:{me:async()=>user},asServiceRole:{entities},entities};
  const built=await esbuild.build({entryPoints:[`base44/functions/${name}/entry.ts`],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'controlled-errors',setup(b){
    b.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'stub'}));
    b.onResolve({filter:/^npm:stripe/},()=>({path:'stripe',namespace:'stub'}));
    b.onLoad({filter:/.*/,namespace:'stub'},a=>({loader:'js',contents:a.path==='sdk'?'export const createClientFromRequest=()=>globalThis.__client;':'export default class Stripe {}'}));
  }}]});
  const exports={},context=vm.createContext({exports,module:{exports},__client:client,Request,Response,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,Buffer,ArrayBuffer,AbortController,Date,crypto:webcrypto,setTimeout,clearTimeout,
    fetch:async()=>{throw new Error(marker);},Deno:{serve:fn=>{handler=fn;},env:{get:()=> 'qa-not-a-real-secret'}},
    console:{log(){},warn(){},error:(...args)=>logs.push(JSON.stringify(args))}});
  vm.runInContext(built.outputFiles[0].text,context);handler ||= context.module.exports.default;
  const response=await handler(new Request('https://qa.invalid/'+name,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    companyId:'qa',companyData:{nombre:'QA ficticia'},clientEmail:'qa@invalid.test',subscriptionId:'qa-subscription',planCode:'qa-plan',toPlanCode:'qa-plan',
    file_url:'https://media.base44.com/files/public/6a00fec50cc522a74ddde4b2/qa.xlsx'})}));
  assert.equal(response.status,500,name+' controlled provider failure must be a generic server error');
  const body=await response.json();assert.equal(body.code,'INTERNAL_ERROR');assert.match(body.requestId,/^[a-f0-9-]{36}$/);
  assert.ok(!JSON.stringify(body).includes(marker),name+' leaked internal error');assert.equal(writes,0);
  assert.ok(logs.some(line=>line.includes(body.requestId)),name+' correlation id must reach safe logs');
  assert.ok(!logs.some(line=>line.includes(marker)),name+' must not log the private provider payload');
}
const catalog=JSON.parse(fs.readFileSync('base44/entities/PlanCatalog.jsonc','utf8'));
assert.equal(catalog.rls.read,null,'Keep public commercial catalog available');
for(const key of ['stripePriceId','stripeProductId']){
  const rls=catalog.properties[key].rls;
  for(const op of ['read','write']) assert.deepEqual(rls[op].$or.map(rule=>rule.user_condition.role).sort(),['admin','super_admin']);
}
const checkout=fs.readFileSync('base44/functions/createStripeCheckout/entry.ts','utf8');
assert.match(checkout,/asServiceRole\.entities\.PlanCatalog/,'Resolve private Stripe prices on backend only');
assert.match(checkout,/safePortalUrl\(successUrl/);assert.match(checkout,/safePortalUrl\(cancelUrl/);
console.log(JSON.stringify({ok:true,genericProviderErrors:targets.length,privateStripeFields:2,publicPricingPreserved:true,noExternalCalls:true}));


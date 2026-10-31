import assert from'node:assert/strict';import{build}from'esbuild';import vm from'node:vm';
let checks=0;const marker='SYNTHETIC-PRIVATE-EXCEPTION-MARKER';
async function fixture({configured=true,badSignature=false,sdkFailure=false,processed=false}={}){
 let handler,sdkCalls=0,signatures=0,writes=0;const logs=[];
 const client={asServiceRole:{entities:{StripeWebhookEvent:{filter:async()=>processed?[{id:'qa-log',processed:true,processingResult:'success'}]:[],create:async data=>{writes++;return{...data,id:'qa-log'};},update:async()=>{writes++;}}}}};
 const compiled=await build({entryPoints:['base44/functions/stripeWebhook/entry.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'providers',setup(b){b.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'stub'}));b.onResolve({filter:/^npm:stripe/},()=>({path:'stripe',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='sdk'?'export const createClientFromRequest=()=>globalThis.__sdk();':'export default class Stripe{constructor(){this.webhooks={constructEventAsync:globalThis.__signature};}}',loader:'js'}));}}]});
 vm.runInNewContext(compiled.outputFiles[0].text,{console:{error(...args){logs.push(args.join(' '));},log(){}},Request,Response,Date,__sdk(){sdkCalls++;if(sdkFailure)throw Error(marker);return client;},async __signature(){signatures++;if(badSignature)throw Error(marker);return{id:'evt-synthetic',type:'unknown.synthetic',data:{object:{}}};},Deno:{env:{get:()=>configured?'synthetic-test-only':undefined},serve(fn){handler=fn;}}});
 return{logs,get sdkCalls(){return sdkCalls;},get signatures(){return signatures;},get writes(){return writes;},async invoke({method='POST',signature=true}={}){const response=await handler(new Request('https://synthetic.test/webhook',{method,headers:signature?{'stripe-signature':'synthetic-signature'}:{},...(method==='POST'?{body:'{}'}:{})}));return{status:response.status,body:await response.json(),cacheControl:response.headers.get('Cache-Control')};}};
}
const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
let f=await fixture();equal((await f.invoke({method:'GET'})).status,405);equal(f.sdkCalls,0);equal((await f.invoke({signature:false})).status,400);equal(f.sdkCalls,0);equal(f.signatures,0);
f=await fixture({configured:false});equal((await f.invoke()).status,503);equal(f.signatures,0);equal(f.sdkCalls,0);
f=await fixture({badSignature:true});let result=await f.invoke();equal(result.status,400);equal(JSON.stringify(result.body).includes(marker),false);equal(f.logs.join('').includes(marker),false);equal(f.sdkCalls,0);equal(f.writes,0);
f=await fixture({sdkFailure:true});result=await f.invoke();equal(result.status,500);equal(result.body,{error:'No se pudo procesar el evento.',code:'WEBHOOK_PROCESSING_FAILED'});equal(result.cacheControl,'no-store');equal(f.logs.join('').includes(marker),false);equal(f.writes,0);
f=await fixture({processed:true});result=await f.invoke();equal(result.status,200);equal(result.body.idempotent,true);equal(f.writes,0);
f=await fixture();result=await f.invoke();equal(result.status,200);equal(result.body.received,true);equal(f.writes,2);
console.log(JSON.stringify({ok:true,checks,realStripeCalls:0,realPayments:0,realRecordsWritten:0,signatureAndRetrySemanticsPreserved:true}));

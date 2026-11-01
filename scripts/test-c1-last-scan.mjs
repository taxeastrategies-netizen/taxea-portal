import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import {taxDocumentNotice} from '../base44/functions/limitedCoreOperations/taxNoticeTemplate.mjs';
let checks=0;const ok=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const company={id:'qa',owner_email:'owner@example.test',email:'owner@example.test',razon_social:'<script>QA</script>',activa:true};
const doc={id:'doc-qa',company_id:'qa',fiscal_document_kind:'justificante_presentacion',fiscal_model_code:'303',fiscal_period:'3T',fiscal_year:2026,nombre:'<img src=x onerror=bad()>.pdf',archivo_url:'https://evil.example/never-use'};
const prepared=taxDocumentNotice(company,doc);ok(prepared.to,'owner@example.test');ok(prepared.subject,'Documentación fiscal disponible · Modelo 303 · 3T · 2026');ok(prepared.body.includes('<script>'),false);ok(prepared.body.includes('<img '),false);ok(prepared.body.includes('&lt;script&gt;'),true);ok(prepared.body.includes('https://evil.example'),false);ok(prepared.body.includes('https://taxeaportal.com/documentos'),true);
for(const email of ['owner@example.test\r\nBcc: other@example.test','one@example.test,two@example.test','one@example.test;two@example.test','<owner@example.test>']){assert.throws(()=>taxDocumentNotice({...company,email},doc),/RECIPIENT/);checks++;}
for(const patch of [{company_id:'foreign'},{fiscal_document_kind:'borrador_modelo'}]){assert.throws(()=>taxDocumentNotice(company,{...doc,...patch}),/DOCUMENT/);checks++;}
ok(taxDocumentNotice(company,{...doc,fiscal_model_code:'303\r\nBcc: x',fiscal_period:'<bad>',fiscal_year:'x'}).subject,'Documentación fiscal disponible en Taxea Portal');
async function load(name,client){let handler;const bundled=await build({entryPoints:['base44/functions/'+name+'/entry.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'sdk',setup(b){b.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const createClientFromRequest=()=>globalThis.__client;',loader:'js'}));}}]});
 vm.runInNewContext(bundled.outputFiles[0].text,{Request,Response,URL,TextEncoder,TextDecoder,Uint8Array,crypto:globalThis.crypto,setTimeout,clearTimeout,console:{log(){},warn(){},error(){}},__client:client,Deno:{env:{get(){throw Error('NO SECRETS IN TEST');}},serve(fn){handler=fn;}}});return handler;}
let user=null,reads=0,writes=0;const retired=await load('promoteAdmin',{auth:{me:async()=>user},asServiceRole:{entities:new Proxy({},{get(){reads++;throw Error('NO USER DATA ACCESS');}})}});
const invoke=async(handler,payload={},method='POST',authorization='Bearer synthetic-qa')=>{const response=await handler(new Request('https://synthetic.test/function',{method,headers:{'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},...(method==='POST'?{body:JSON.stringify(payload)}:{})}));return{status:response.status,body:await response.json()};};
ok((await invoke(retired,{},'GET')).status,405);ok((await invoke(retired,{},'POST','')).status,401);ok((await invoke(retired)).status,401);
for(const actor of [{id:'qa',role:'user'},{id:'qa',role:'admin',status:'bloqueado'},{id:'qa',role:'super_admin',data:{accountAccessStatus:'disabled'}}]){user=actor;ok((await invoke(retired,{email:'target@example.test'})).status,403);}
for(const role of ['admin','super_admin']){user={id:'qa',role};const result=await invoke(retired,{email:'target@example.test'});ok(result.status,410);ok(result.body.rolesChanged,0);ok(result.body.code,'ROLE_PROMOTION_RETIRED');}
ok(reads,0);ok(writes,0);
const events=[],mail=[];user={id:'admin-qa',role:'admin'};
const client={auth:{me:async()=>user},asServiceRole:{entities:{Company:{get:async()=>company},Document:{get:async()=>doc},CoreIntegrationUsage:{filter:async()=>events,create:async data=>{const row={id:'event-qa',...data};events.push(row);return row;},update:async(_id,patch)=>Object.assign(events[0],patch)}},integrations:{Core:{SendEmail:async params=>{mail.push(params);return{ok:true};}}}}};
const limited=await load('limitedCoreOperations',client),body={operation:'tax_notice',companyId:'qa',documentId:'doc-qa',to:'attacker@example.test',subject:'CLIENT-SUBJECT',body:'<script>CLIENT-BODY</script>'};
let result=await invoke(limited,body);ok(result.status,200);ok(mail.length,1);ok(mail[0].to,'owner@example.test');ok(mail[0].subject.includes('CLIENT-SUBJECT'),false);ok(mail[0].body.includes('CLIENT-BODY'),false);ok(mail[0].body.includes('https://evil.example'),false);ok(mail[0].body.includes('<img '),false);
ok((await invoke(limited,body)).status,409);ok(mail.length,1);user={id:'normal-qa',role:'user',email:company.owner_email};ok((await invoke(limited,body)).status,403);ok(mail.length,1);ok(writes,0);
console.log(JSON.stringify({ok:true,checks,actualHandlers:true,rolesChanged:0,realEmailsSent:0,financialWrites:0,providerCallsSimulated:true}));

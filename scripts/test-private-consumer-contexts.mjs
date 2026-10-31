import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as esbuild from 'esbuild';
import {contextStorageCompany,linkedStorageCompany} from '../base44/functions/documentStorage/documentContexts.mjs';
import {privateFileFormat} from '../base44/functions/documentStorage/storageAssets.mjs';
import {createDocumentClient} from '../src/lib/documentClient.mjs';
let checks=0;const check=(condition,label)=>{assert.ok(condition,label);checks++;};
const a={id:'company-a',owner_email:'a@example.test',nif_cif:'QA-A',activa:true},b={id:'company-b',owner_email:'b@example.test',nif_cif:'QA-B',activa:true};
const owner={id:'user-a',email:a.owner_email,role:'user'},admin={id:'admin',email:'admin@example.test',role:'admin'};
function service({duplicate=false,reference='account-a'}={}){let writes=0,reads=0;return{get writes(){return writes;},get reads(){return reads;},entities:{
 Company:{get:async id=>{reads++;return id===a.id?a:id===b.id?b:null;},filter:async()=>duplicate?[a,{...a,id:'duplicate-company'}]:[a],update:async()=>{writes++;throw Error('NO PROFILE WRITES');}},
 ClientAccount:{get:async id=>{reads++;return id==='account-a'?{id,email:'a@example.test',taxId:'QA-A'}:null;}},
  MercantilSociedad:{get:async id=>{reads++;return id==='sociedad-a'?{id,clienteAccountId:reference,visibilidadCliente:true}:null;}},
 TaxeaAuditCase:{get:async id=>{reads++;return id==='audit-a'?{id,clientId:reference}:null;}}
}};}
let svc=service();check((await contextStorageCompany(svc,owner,'mercantil','sociedad-a')).id===a.id,'society maps account email and exact tax ID, not sociedad ID');check((await linkedStorageCompany(svc,owner,a.id)).id===a.id,'explicit Company link supported');
await assert.rejects(()=>linkedStorageCompany(svc,owner,b.id),/FORBIDDEN/);checks++;check((await linkedStorageCompany(svc,admin,b.id)).id===b.id,'admin keeps access');
await assert.rejects(()=>contextStorageCompany(svc,owner,'audit','audit-a'),/FORBIDDEN/);checks++;check((await contextStorageCompany(svc,admin,'audit','audit-a')).id===a.id,'audit uses stored context');
await assert.rejects(()=>contextStorageCompany(svc,owner,'mercantil','missing'),/NOT_FOUND/);checks++;
await assert.rejects(()=>contextStorageCompany(svc,owner,'Invoice','sociedad-a'),/INVALID/);checks++;
await assert.rejects(()=>contextStorageCompany(svc,owner,'mercantil','../sociedad-a'),/INVALID/);checks++;
await assert.rejects(()=>linkedStorageCompany(service({duplicate:true}),admin,'account-a'),/AMBIGUOUS/);checks++;
check((await linkedStorageCompany(svc,admin,'unlinked')).id==='__admin_staging__','unlinked admin stays in private staging');
await assert.rejects(()=>linkedStorageCompany(svc,owner,'unlinked'),/UNLINKED/);checks++;check(svc.writes===0,'context resolution never rewrites profiles or subaccounts');
svc=service();svc.entities.ClientAccount.get=async()=>({email:'a@example.test',taxId:'OTHER-TAX-ID'});check((await linkedStorageCompany(svc,admin,'account-a')).id==='__admin_staging__','same email with wrong tax ID not linked');await assert.rejects(()=>linkedStorageCompany(svc,owner,'account-a'),/UNLINKED/);checks++;
const bytes=new TextEncoder().encode('TAXEA SYNTHETIC FIXED FORMAT ONLY\n');
for(const ext of ['111','115','123','130','131','180','190','193','200','202','216','232','296','303','347','349','390','415','417','420','421','425']){const value=privateFileFormat({name:'ficticio.'+ext},bytes);check(value.ext===ext&&value.mime==='application/octet-stream','official filing extension '+ext+' keeps exact downloadable bytes');}
assert.throws(()=>privateFileFormat({name:'evil.html'},bytes),/UNSUPPORTED/);checks++;assert.throws(()=>privateFileFormat({name:'fake.pdf'},bytes),/UNSUPPORTED/);checks++;
let invocations=[];const api={functions:{invoke:async(name,body)=>{invocations.push({name,body});return{data:{ok:true,file_url:'https://taxeaportal.com/private-document/asset-a',assetId:'asset-a'}};}},integrations:{Core:new Proxy({},{get(){throw Error('NO NATIVE FALLBACK FOR RELATED DOCUMENTS');}})}};
const documents=createDocumentClient(api);const saved=await documents.uploadContext({file:new File(['QA'],'qa.txt'),contextKind:'mercantil',contextId:'sociedad-a'});check(saved.assetId==='asset-a'&&invocations.length===1,'related upload uses one authenticated BFF call');check(invocations[0].body.action==='upload_related'&&invocations[0].body.companyId===undefined,'caller cannot infer company through UI');
await assert.rejects(()=>documents.uploadContext({file:new File(['QA'],'qa.txt'),contextKind:'Invoice',contextId:'sociedad-a'}));checks++;
api.functions.invoke=async()=>{throw Error('private unavailable');};await assert.rejects(()=>documents.uploadContext({file:new File(['QA'],'qa.txt'),contextKind:'audit',contextId:'audit-a'}),/private unavailable/);checks++;
// Real request handler with a mocked signing/LLM provider; real scope guards run.
async function laborFixture(options={}){
 let handler,providerCalls=0,resolveCalls=0,documentUpdates=0,lastProvider;
 const user=options.user??owner,doc={id:'doc-a',company_id:a.id,file_url:options.reference??'https://taxeaportal.com/private-document/asset-a',document_type:'desconocido'};
 const runtime={storageAccountEnabled:u=>!!u?.id&&u.data?.accountAccessStatus!=='disabled',storageCompany:async(s,u,id)=>u.id&&u.email===a.owner_email&&id===a.id?a:null,assetIdFromReference:r=>r==='https://taxeaportal.com/private-document/asset-a'?'asset-a':r==='https://taxeaportal.com/private-document/asset-b'?'asset-b':'',authorizedAsset:async(s,u,id)=>({id,company_id:id==='asset-a'?a.id:b.id}),resolvePrivateAsset:async()=>{resolveCalls++;return{url:'https://synthetic-provider.test/signed-for-120-seconds'};}};
 const client={auth:{me:async()=>user},asServiceRole:{entities:{LaborOcrDocument:{filter:async()=>[doc],update:async()=>{documentUpdates++;}}},integrations:{Core:{InvokeLLM:async params=>{providerCalls++;lastProvider=params;return{confidence:30,document_type:'desconocido'};}}}}};
 const built=await esbuild.build({stdin:{contents:fs.readFileSync('base44/functions/processLaborOcr/entry.ts','utf8'),loader:'ts',resolveDir:process.cwd()+'/base44/functions/processLaborOcr'},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'qa-providers',setup(build){build.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'qa'}));build.onResolve({filter:/storageRuntime\.generated\.mjs$/},()=>({path:'runtime',namespace:'qa'}));build.onLoad({filter:/.*/,namespace:'qa'},args=>({contents:args.path==='sdk'?'export const createClientFromRequest=()=>globalThis.__client;':'export const {storageAccountEnabled,storageCompany,assetIdFromReference,authorizedAsset,resolvePrivateAsset}=globalThis.__runtime;',loader:'js'}));}}]});
 vm.runInContext(built.outputFiles[0].text,vm.createContext({__client:client,__runtime:runtime,Request,Response,URL,console,Deno:{env:{get:()=>undefined},serve(fn){handler=fn;}}}));
 return{get calls(){return{providerCalls,resolveCalls,documentUpdates,lastProvider};},invoke:async(method='POST')=>handler(new Request('https://qa.invalid/labor',{method,...(method==='POST'?{headers:{'content-type':'application/json'},body:JSON.stringify({document_id:doc.id})}:{})}))};
}
let f=await laborFixture(),r=await f.invoke();check(r.status===200&&f.calls.providerCalls===1,'labor private OCR processes own company');check(f.calls.lastProvider.file_urls[0]==='https://synthetic-provider.test/signed-for-120-seconds','AI receives resolved short-lived URL server-side');check((await r.json()).ocr_status==='requiere_revision','low-confidence OCR keeps review');
f=await laborFixture({reference:'https://taxeaportal.com/private-document/asset-b'});r=await f.invoke();check(r.status===404&&f.calls.resolveCalls===0&&f.calls.documentUpdates===0&&f.calls.providerCalls===0,'foreign asset rejected before sign, update or AI');
f=await laborFixture({reference:'https://evil.example.test/doc.pdf'});check((await f.invoke()).status===400&&f.calls.providerCalls===0,'arbitrary provider URL denied');
f=await laborFixture({user:{...owner,email:'foreign@example.test',data:{company_id:a.id}}});check((await f.invoke()).status===403&&f.calls.documentUpdates===0,'forged active company does not authorize OCR');
f=await laborFixture({user:{...owner,data:{accountAccessStatus:'disabled'}}});check((await f.invoke()).status===403&&f.calls.providerCalls===0,'disabled account denied');
f=await laborFixture();check((await f.invoke('GET')).status===405&&f.calls.documentUpdates===0,'GET cannot trigger OCR');
console.log(JSON.stringify({ok:true,checks,liveWrites:0,scope:'company/account distinction, admin staging, fiscal extensions, no fallback, authenticated labor OCR guards'}));

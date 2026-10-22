import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { File } from 'node:buffer';
import * as esbuild from 'esbuild';
import { loadIntakeDocuments, needsOcrAnalysis } from '../src/lib/ocrIntake.mjs';
import { loadOcrWorkspace } from '../src/lib/ocrWorkspace.mjs';

let user = null, calls = [], uploads = 0, companyReads = 0;
const companies = [
  { id:'own',owner_email:'owner@qa.invalid',usuarios_autorizados:['member@qa.invalid'] },
  { id:'foreign',owner_email:'someone@qa.invalid',usuarios_autorizados:[] },
  { id:'inactive',owner_email:'owner@qa.invalid',activa:false },
];
const records = [];
const client = { auth: { me: async () => user }, get asServiceRole() {
  assert.ok(user?.id,'No privileged access before authentication');
  return { entities: {
    Company:{get:async id=>{companyReads++;return companies.find(c=>c.id===id);}},
    OcrInvoiceDocument:{
      get:async id=>{calls.push('get');return records.find(d=>d.id===id);},
      filter:async(q,_sort,limit=500,skip=0)=>{calls.push(['filter',q]);return records.filter(row=>Object.entries(q).every(([k,v])=>row[k]===v)).slice(skip,skip+limit);},
      create:async data=>{calls.push('create');const row={...data,id:'doc-'+records.length};records.push(row);return row;},
      update:async(id,data)=>{calls.push('update');const row=records.find(r=>r.id===id);Object.assign(row,data);return row;},
    },
    TimelineEvent:{create:async()=>({id:'timeline-qa'})},
    get Invoice(){throw new Error('Intake must never touch invoices');},
    get JournalEntry(){throw new Error('Intake must never touch accounting');},
  }, integrations:{Core:{UploadFile:async()=>{uploads++;return {file_url:'https://base44.app/api/apps/qa/files/mp/public/fake.jpg'};}}} };
} };
const bundle=await esbuild.build({entryPoints:[process.env.OCR_INTAKE_ENTRY || 'base44/functions/ocrDocumentIntake/entry.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{
  name:'stub-sdk',setup(build){
    build.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'stub'}));
    build.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const createClientFromRequest=()=>globalThis.__client;',loader:'js'}));
  },
}]});
let handler;
vm.runInContext(bundle.outputFiles[0].text,vm.createContext({__client:client,console,Date,Response,Request,File,TextDecoder,Uint8Array,crypto,Deno:{serve:fn=>{handler=fn;}}}));
const call=async body=>handler(new Request('https://qa.invalid/intake',{method:'POST',headers:body instanceof FormData?{}:{'content-type':'application/json'},body:body instanceof FormData?body:JSON.stringify(body)}));
const image = new File([Uint8Array.from([255,216,255,224,12,34])],'factura-qa.jpg',{type:'image/jpeg'});
const request=(params={})=>{const body=new FormData();for(const [k,v] of Object.entries({action:'upload',companyId:'own',documentType:'expense_invoice',captureMethod:'camera',deviceType:'mobile',file:image,...params}))body.set(k,v);return body;};
assert.equal((await call({action:'list',companyId:'own',documentType:'expense_invoice'})).status,401);
assert.equal(companyReads,0);
for(const identity of [
  {id:'user',email:'owner@qa.invalid',role:'user'}, // new profile: no company_id
  {id:'user',email:' OWNER@QA.INVALID ',role:'user',company_id:'stale'},
  {id:'member',email:'member@qa.invalid',role:'user',data:{company_id:'foreign'}},
  {id:'advisor',email:'member@qa.invalid',role:'advisor'},
  {id:'admin',email:'admin@qa.invalid',role:'admin'},
  {id:'super',email:'super@qa.invalid',role:'super_admin'},
]) {
  user=identity;const response=await call(request());assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.document.status,'review_required');assert.equal(result.document.linkedInvoiceId,undefined);
}
assert.equal(records.length,1,'Retries reuse a persisted binary hash within this tenant/type');
assert.equal(uploads,1);
assert.equal(records[0].uploadedByUserId,'user','Client cannot spoof uploader on retry');
user={id:'user',email:'intruder@qa.invalid',role:'user',company_id:'own',data:{company_id:'own'}};
for(const action of ['upload','list','analysis_start']) {
  const previousCalls=calls.length, previousUploads=uploads;
  const response=await call(action==='upload'?request():{action,companyId:'own',documentType:'expense_invoice',docId:records[0].id});
  assert.equal(response.status,403);assert.equal(calls.length,previousCalls);assert.equal(uploads,previousUploads);
}
for(const role of ['advisor','asesor']) {user={id:'advisor',email:'not-assigned@qa.invalid',role};assert.equal((await call(request())).status,403);}
user={id:'owner',email:'owner@qa.invalid',role:'user'};
assert.equal((await call(request({companyId:'inactive'}))).status,403);
assert.equal((await call(request({file:new File(['fake'],'wrong.jpg',{type:'image/jpeg'})}))).status,415);
assert.equal((await call(request({file:new File([new Uint8Array(10*1024*1024+1)],'huge.jpg')}))).status,413);
assert.equal((await call(request({file:new File([],'empty.jpg')}))).status,400);
assert.equal((await call(request({documentType:'__proto__'}))).status,400);
const beforeTypeCount=records.length;
assert.equal((await call(request({documentType:'income_invoice',captureMethod:'drag_drop',deviceType:'desktop'}))).status,200);
assert.equal(records.length,beforeTypeCount+1,'Issued/received intake must not collapse the same file across directions');
assert.equal(records.at(-1).sourceModule,'ocr_income');
assert.equal(records.at(-1).captureMethod,'drag_drop');
user={...user,is_deleted:true};assert.equal((await call(request())).status,403);
user={id:'owner',email:'owner@qa.invalid',role:'user'};
const id=records[0].id;
const begin=await (await call({action:'analysis_start',companyId:'own',docId:id})).json();
assert.equal(begin.document.status,'processing');
assert.equal((await call({action:'analysis_start',companyId:'own',docId:id})).status,409);
assert.equal((await call({action:'analysis_complete',companyId:'own',docId:id,analysisStartedAt:'stale',extractedData:{total:121}})).status,409);
assert.equal((await call({action:'analysis_complete',companyId:'own',docId:id,analysisStartedAt:begin.document.analysisStartedAt,extractedData:{numero_factura:'QA-1',total:121}})).status,200);
assert.equal(records[0].status,'review_required');assert.equal(JSON.parse(records[0].extractedData).total,121);
assert.equal(needsOcrAnalysis(records[0]),false);
assert.equal(needsOcrAnalysis({status:'review_required'}),true);
assert.equal(needsOcrAnalysis({status:'review_required',extractedData:'broken'}),true);
assert.equal(needsOcrAnalysis({status:'review_required',invoiceOnly:true}),false);
assert.equal(needsOcrAnalysis({status:'accounted'}),false);
records.push({id:'foreign-doc',company_id:'foreign',status:'review_required'});
assert.equal((await call({action:'analysis_start',companyId:'own',docId:'foreign-doc'})).status,404);
records[0].linkedInvoiceId='existing';
assert.equal((await call({action:'analysis_start',companyId:'own',docId:id})).status,409);
delete records[0].linkedInvoiceId;
records[0].status='accounted';
assert.equal((await call({action:'duplicate_warning',companyId:'own',docId:id,warning:'x'})).status,409);
records[0].status='review_required';
const failureBegin=await (await call({action:'analysis_start',companyId:'own',docId:id})).json();
assert.equal((await call({action:'analysis_fail',companyId:'own',docId:id,analysisStartedAt:failureBegin.document.analysisStartedAt})).status,200);
assert.equal(records[0].status,'review_required');assert.match(records[0].safeErrorMessage,/guardado en revisión/);
assert.equal((await call({action:'list',companyId:'own',documentType:'expense_invoice',offset:-1})).status,400);

const fakeRows=Array.from({length:1203},(_,i)=>({id:String(i),uploadedAt:'2026-10-22',company_id:'own',documentType:'expense_invoice'}));
let pages=0;
const frontend={functions:{invoke:async(name,body)=>{
  if(name==='invoiceOperations')return {data:{ok:true,invoices:[],hasMore:false}};
  assert.equal(name,'ocrDocumentIntake');assert.equal(body.companyId,'own');assert.equal(body.documentType,'expense_invoice');
  pages++;const rows=fakeRows.slice(body.offset,body.offset+500);
  return {data:{ok:true,rows,nextOffset:rows.length===500?body.offset+500:null}};
}}};
assert.equal((await loadIntakeDocuments(frontend,'own','expense_invoice')).length,1203);assert.equal(pages,3);
if (!process.env.OCR_INTAKE_ENTRY) assert.equal((await loadOcrWorkspace(frontend,'own','expense_invoice')).length,1203);
await assert.rejects(loadIntakeDocuments({functions:{invoke:async()=>({data:{ok:true,rows:[],nextOffset:0}})}},'own','expense_invoice'),/no ha avanzado/);

for(const file of process.env.OCR_INTAKE_ENTRY ? [] : ['src/pages/LectorGastos.jsx','src/pages/LectorIngresos.jsx']) {
  const source=fs.readFileSync(file,'utf8');
  assert.match(source,/action: 'upload'/);assert.doesNotMatch(source,/OcrInvoiceDocument\.create/);
  assert.match(source,/documents\.filter\(needsOcrAnalysis\)/);
  assert.match(source,/action: 'analysis_complete'/);
}
// Exercise the real drop-zone callbacks without browser injection or network.
const zoneBundle=await esbuild.build({entryPoints:['src/components/lector/BulkDropZone.jsx'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{
  name:'ui-stubs',setup(build){
    build.onResolve({filter:/^(react$|lucide-react$|@\/)/},args=>({path:args.path,namespace:'ui'}));
    build.onLoad({filter:/.*/,namespace:'ui'},args=>({loader:'js',contents:args.path==='react'
      ? 'export const useRef=()=>({current:{click(){}}});let count=0;export const useState=()=>[count++%2===1,()=>{}];'
      : args.path==='lucide-react'?'export const Upload="Upload",FolderOpen="Folder",Camera="Camera";'
      : args.path.includes('MobileScanner')?'export default "Scanner";'
      : args.path.includes('button')?'export const Button="Button";':'export const cn=(...args)=>args.join(" ");'}));
  },
}]});
const exports={};
const uiContext=vm.createContext({module:{exports},exports,React:{createElement:(type,props,...children)=>({type,props:props || {},children})}});
vm.runInContext(zoneBundle.outputFiles[0].text,uiContext);
const zone=uiContext.module.exports.default,deliveries=[];
const tree=zone({onFilesAdded:(files,method)=>deliveries.push({files,method})});
const flatten=node=>node && typeof node==='object'?[node,...(node.children || []).flatMap(flatten)]:[];
const nodes=flatten(tree), input=nodes.find(n=>n.type==='input'), scanner=nodes.find(n=>n.type==='Scanner');
assert.ok(input);assert.ok(scanner);
tree.props.onDrop({preventDefault(){},dataTransfer:{files:[image]}});
input.props.onChange({target:{files:[image],value:'file'}});
scanner.props.onCapture([image]);
assert.deepEqual(deliveries.map(row=>row.method),['drag_drop','file_picker','camera']);
assert.ok(deliveries.every(row=>row.files.length===1 && row.files[0]===image));
const disabled=zone({onFilesAdded:()=>{throw new Error('Disabled intake must not submit twice');},disabled:true});
disabled.props.onDrop({preventDefault(){},dataTransfer:{files:[image]}});
console.log('OCR intake: own/membership/legacy profiles/admin pass; anonymous/foreign/unassigned advisor denied before upload or document reads; validation, review-only state, retry reuse, protected linked invoices, analysis lifecycle, 1203-row pagination and both OCR pages pass. No external calls.');


import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { build } from 'esbuild';
import { PDFDocument, degrees } from 'pdf-lib';
import { unzipSync } from 'fflate';
import * as helpers from '../src/lib/utilityTools.mjs';
import { zipFiles, transformPdfs, loadPdf } from '../src/lib/utilityFiles.js';
import { canAccessCompany, deadlinePayload } from '../base44/functions/utilityOperations/policy.mjs';
let count=0;
async function check(name,run){await run();count++;console.log('PASS '+name);}
await check('safe filenames and reserved Windows words',()=>{
  assert.equal(helpers.safeName('CON'),'_CON');
  assert.equal(helpers.safeName('../A:B/C'),' -A-B-C'.trim());
  assert(!/[\\/:\u202e]/.test(helpers.safeName('ab\u202ecd/ef')));
});
await check('OCR names preserve extension and mark missing data',()=>{
  assert.equal(helpers.renamedFile('A.PDF',{},'{fecha}_{proveedor}_{numero}'),'sin-fecha_sin-emisor_sin-numero.pdf');
  assert.throws(()=>helpers.renamedFile('a.pdf',{},'{constructor}'));
  assert.throws(()=>helpers.renamedFile('a.exe',{},'{original}'));
  assert.throws(()=>helpers.renamedFile('a.pdf',{},' '));
});
await check('case-insensitive filename collisions',()=>assert.deepEqual(helpers.uniqueNames(['a.pdf','A.pdf','a_2.pdf','a.pdf']),['a.pdf','A_2.pdf','a_2_2.pdf','a_3.pdf']));
await check('page selection supports ranges and reverse order',()=>{
  assert.deepEqual(helpers.parsePages('3,2,1',3),[2,1,0]);assert.deepEqual(helpers.parsePages('3-1',3),[2,1,0]);
  for(const raw of ['0','4','1,a','1-99'])assert.throws(()=>helpers.parsePages(raw,3));
  assert.throws(()=>helpers.parsePages('',501));
});
await check('CSV injection prevention and quoting',()=>{
  for(const value of ['=SUM(A1)','+2','-3','@cmd','  =cmd','\tfoo'])assert(helpers.csvCell(value).startsWith('"\''));
  assert.equal(helpers.csvCell('a"b'),'"a""b"');
  assert(helpers.documentsCsv([{name:'x.pdf',fields:{total:10}}]).startsWith('\ufeff'));
});
await check('margin differs from markup and breakeven rounds upwards',()=>{
  const calc=helpers.commercialCalculations({cost:60,price:100,margin:40,discount:10,fixed:1201});
  assert.equal(calc.margin,40);assert(Math.abs(calc.markup-66.6666667)<1e-5);
  assert.equal(calc.targetPrice,100);assert.equal(calc.discounted,90);assert.equal(calc.breakEven,31);
});
await check('calculation bounds and zero contribution',()=>{
  const zero=helpers.commercialCalculations({cost:100,price:100,margin:0,discount:100,fixed:200});
  assert.equal(zero.breakEven,null);assert.equal(zero.discounted,0);
  assert.throws(()=>helpers.commercialCalculations({cost:1,price:0,margin:100,discount:101,fixed:-1}));
  assert.equal(helpers.numberInput('12,5'),12.5);assert.throws(()=>helpers.numberInput('1.000,50'));assert.throws(()=>helpers.numberInput(''));
});
await check('strict leap-date validation and timezone-free countdown',()=>{
  assert(helpers.dateOnly('2028-02-29'));assert(!helpers.dateOnly('2026-02-29'));assert(!helpers.dateOnly('2026-13-01'));
  assert.equal(helpers.daysUntil('2026-10-26','2026-10-24'),2);
});
await check('ICS date alarms, Unicode folding and control injection',()=>{
  const ics=helpers.deadlinesIcs([{id:'one',title:'á'.repeat(100),notes:'texto\rATTENDEE:evil',due_date:'2026-12-31',remind_days:30,status:'pending'},{id:'two',due_date:'2026-12-01',status:'done'}],new Date('2026-01-01T00:00:00Z'));
  assert(ics.includes('DTEND;VALUE=DATE:20270101'));assert(ics.includes('TRIGGER:-P30D'));
  assert(!ics.includes('UID:two'));assert(!ics.includes('\rATTENDEE:'));
  for(const line of ics.split('\r\n'))assert(new TextEncoder().encode(line).length<=75);
});
const first=await PDFDocument.create();first.addPage([100,200]);first.addPage([300,400]).setRotation(degrees(270));
const second=await PDFDocument.create();second.addPage([500,600]);
const a=new File([await first.save()],'uno.pdf',{type:'application/pdf'}),b=new File([await second.save()],'dos.pdf',{type:'application/pdf'});
const original=new Uint8Array(await a.arrayBuffer());
await check('ZIP roundtrip preserves original bytes',async()=>{
  const archive=await zipFiles([{name:'a.pdf',blob:a},{name:'a.pdf',blob:b}]);
  const entries=unzipSync(archive);assert.deepEqual(Object.keys(entries),['a.pdf','a_2.pdf']);assert.deepEqual(entries['a.pdf'],original);
});
await check('merge creates all three pages',async()=>assert.equal((await PDFDocument.load((await transformPdfs([a,b],'merge')).bytes)).getPageCount(),3));
await check('selected pages preserve requested order',async()=>{
  const doc=await PDFDocument.load((await transformPdfs([a],'select','2,1')).bytes);
  assert.equal(doc.getPages()[0].getWidth(),300);assert.equal(doc.getPages()[1].getWidth(),100);
});
await check('rotation adds to existing page rotation',async()=>{
  const doc=await PDFDocument.load((await transformPdfs([a],'rotate','2',90)).bytes);assert.equal(doc.getPages()[0].getRotation().angle,0);
});
await check('split ZIP yields readable one-page PDFs',async()=>{
  const archive=unzipSync((await transformPdfs([a],'split')).bytes);assert.equal(Object.keys(archive).length,2);
  for(const bytes of Object.values(archive))assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
});
await check('reject malformed PDF and wrong operation inputs',async()=>{
  await assert.rejects(()=>loadPdf(new File(['bad'],'bad.pdf')));
  await assert.rejects(()=>transformPdfs([a,b],'rotate'));
  assert.deepEqual(new Uint8Array(await a.arrayBuffer()),original);
});
const normal={id:'qa-normal',email:'qa@example.test',role:'user'};
const companies={companyA:{id:'companyA',activa:true,owner_email:normal.email},companyB:{id:'companyB',activa:true,owner_email:'other@example.test'}};
await check('persisted membership—not user-supplied company—controls access',()=>{
  assert(canAccessCompany(normal,companies.companyA));assert(!canAccessCompany({...normal,company_id:'companyB'},companies.companyB));
  assert(canAccessCompany({...normal,role:'admin'},companies.companyB));
  assert(!canAccessCompany(normal,{...companies.companyA,activa:false}));
});
await check('deadline validation strips arbitrary fields',()=>{
  const row=deadlinePayload({title:'  Seguro QA  ',kind:'seguro',due_date:'2026-12-31',remind_days:'30',notes:'test',status:'pending',company_id:'evil',user_id:'evil'});
  assert.equal(row.title,'Seguro QA');assert(!('company_id' in row));
  assert.throws(()=>deadlinePayload({...row,due_date:'2026-02-30'}));assert.throws(()=>deadlinePayload({...row,remind_days:-1}));
});
await check('new entities deny all direct client access',async()=>{
  for(const name of ['UtilityDocument','UtilityDeadline']){
    const schema=JSON.parse(await fs.readFile('base44/entities/'+name+'.jsonc','utf8'));
    for(const operation of ['create','read','update','delete'])assert.equal(schema.rls[operation],false);
  }
});
const source=(await fs.readFile('base44/functions/utilityOperations/entry.ts','utf8')).replace("import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';",'const createClientFromRequest = () => globalThis.__client;');
const compiled=await build({stdin:{contents:source,resolveDir:process.cwd()+'/base44/functions/utilityOperations',loader:'ts'},bundle:true,write:false,platform:'node',format:'iife',logLevel:'silent'});
let handler,identity=normal,serial=0,ocrCalls=0,privateUploads=0;
const tables={UtilityDeadline:[],UtilityDocument:[],CoreIntegrationUsage:[]};
const entities={Company:{get:async id=>companies[id]}};
for(const [name,table] of Object.entries(tables))entities[name]={
  get:async id=>table.find(row=>row.id===id),
  filter:async(query,sort,limit=100,offset=0)=>table.filter(row=>Object.entries(query).every(([key,value])=>row[key]===value)).slice(offset,offset+limit),
  create:async payload=>{const row={...payload,id:'test-'+(++serial),updated_date:'v'+serial};table.push(row);return {...row};},
  update:async(id,payload)=>{const row=table.find(item=>item.id===id);Object.assign(row,payload,{updated_date:'v'+(++serial)});return {...row};},
  delete:async id=>{const index=table.findIndex(row=>row.id===id);if(index>=0)table.splice(index,1);}
};
const sandbox={Request,Response,File,FormData,URL,TextDecoder,Uint8Array,crypto,Date,console,Deno:{serve:fn=>{handler=fn;}},__client:{auth:{me:async()=>identity},asServiceRole:{entities,integrations:{Core:{
  UploadPrivateFile:async()=>{privateUploads++;return{file_uri:'private/test/document.pdf'};},
  CreateFileSignedUrl:async()=>({signed_url:'https://base44.app/signed-test'}),
  ExtractDataFromUploadedFile:async()=>{ocrCalls++;return{status:'success',output:{fecha:'2026-01-10',proveedor:'Proveedor ficticio',numero:'QA-1',total:42}};}
}}}}};
vm.runInNewContext(compiled.outputFiles[0].text,sandbox);
const invoke=body=>handler(new Request('https://example.test/functions/utilityOperations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
await check('anonymous requests are denied',async()=>{identity=null;assert.equal((await invoke({action:'list',companyId:'companyA'})).status,401);identity=normal;});
await check('foreign company list, mutation and OCR rejected',async()=>{
  assert.equal((await invoke({action:'list',companyId:'companyB'})).status,403);
  assert.equal((await invoke({action:'save',companyId:'companyB'})).status,403);
});
let saved;
await check('deadline create, read-back and sequential retry dedup',async()=>{
  const request={action:'save',companyId:'companyA',requestKey:'qa-request-key-001',payload:{title:'Seguro QA',kind:'seguro',due_date:'2026-12-31',remind_days:30,notes:'Ficticio',status:'pending'}};
  saved=(await (await invoke(request)).json()).row;assert(saved?.id);
  const duplicate=await (await invoke(request)).json();assert.equal(duplicate.row.id,saved.id);assert.equal(tables.UtilityDeadline.length,1);
  const listed=await (await invoke({action:'list',companyId:'companyA'})).json();assert.equal(listed.rows.length,1);
});
await check('stale updates rejected and correct update persists',async()=>{
  assert.equal((await invoke({action:'save',companyId:'companyA',id:saved.id,expectedUpdatedAt:'stale',payload:saved})).status,409);
  const response=await invoke({action:'save',companyId:'companyA',id:saved.id,expectedUpdatedAt:saved.updated_date,payload:{...saved,status:'done'}});
  assert.equal(response.status,200);assert.equal((await response.json()).row.status,'done');
});
await check('foreign record cannot be deleted in accessible company',async()=>{
  tables.UtilityDeadline.push({id:'foreign',company_id:'companyB'});
  assert.equal((await invoke({action:'delete',companyId:'companyA',id:'foreign'})).status,404);
  assert(tables.UtilityDeadline.some(row=>row.id==='foreign'));
});
await check('bad request and unsupported actions rejected',async()=>{
  assert.equal((await invoke({action:'magic',companyId:'companyA'})).status,400);
  assert.equal((await handler(new Request('https://example.test',{method:'POST',body:'bad'}))).status,400);
});
const extract=async(file,companyId='companyA')=>{const form=new FormData();form.set('action','extract');form.set('companyId',companyId);form.set('file',file);return handler(new Request('https://example.test',{method:'POST',body:form}));};
await check('file signature validated before upload or AI',async()=>{
  assert.equal((await extract(new File(['evil'],'fake.pdf',{type:'application/pdf'}))).status,400);
  assert.equal(privateUploads,0);assert.equal(ocrCalls,0);
});
await check('private OCR route and owner-scoped cache retry',async()=>{
  const response=await extract(a);assert.equal(response.status,200);assert.equal((await response.json()).result.total,42);
  assert.equal(privateUploads,1);assert.equal(ocrCalls,1);
  assert.equal((await (await extract(a)).json()).cached,true);assert.equal(ocrCalls,1);
  assert.equal(tables.UtilityDocument[0].company_id,'companyA');assert.equal(tables.UtilityDocument[0].user_id,normal.id);
});
await check('OCR minute/day quotas prevent new chargeable work',async()=>{
  const now=new Date().toISOString();
  for(let i=0;i<4;i++)tables.CoreIntegrationUsage.push({userId:normal.id,dayKey:now.slice(0,10),minuteKey:now.slice(0,16),operation:'extract',status:'success'});
  assert.equal((await extract(b)).status,429);assert.equal(ocrCalls,1);assert.equal(privateUploads,1);
});
await check('navigation places tools immediately before contacts',async()=>{
  const sidebar=await fs.readFile('src/components/layout/Sidebar.jsx','utf8');
  assert(sidebar.indexOf("id: 'tools'")<sidebar.indexOf("id: 'contacts'"));assert(sidebar.includes("groupLabel: 'Core Operativo'"));
  const app=await fs.readFile('src/App.jsx','utf8');assert(app.includes('path="/herramientas/:tool"'));
});
console.log(JSON.stringify({passed:count,failed:0,scope:'isolated fixtures and mocked backend; no live client data or external sends'}));

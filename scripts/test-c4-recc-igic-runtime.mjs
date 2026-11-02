import {readFileSync} from 'node:fs';
const schemaEnums=Object.fromEntries(['Invoice','InvoicePayment','JournalEntry','JournalEntryLine','AccountingAccount','AccountingPostingOperation','AccountingAuditLog'].map(name=>[name,JSON.parse(readFileSync('base44/entities/'+name+'.jsonc','utf8')).properties]));
function validateEnumWrite(name,payload){for(const[key,value]of Object.entries(payload)){const field=schemaEnums[name]?.[key];if(value!=null&&field?.enum)assert.ok(field.enum.includes(value),'Schema enum '+name+'.'+key+'='+value);if(typeof value==='number')assert.ok(Number.isFinite(value),'Finite '+name+'.'+key);}}
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as esbuild from 'esbuild';
const records={
  Company:[{id:'qa',owner_email:'qa@test.invalid',usuarios_autorizados:[],tipo_impuesto:'igic',nif_cif:'B12345674',nombre:'Empresa ficticia QA',razon_social:'Empresa ficticia QA',ocr_approval_lock_token:''},
    {id:'foreign',owner_email:'other@test.invalid',usuarios_autorizados:[]}],
  FiscalProfile:[{id:'fp',company_id:'qa',active:true,profileStatus:'validado_asesor',mainTerritory:'canarias',indirectTaxDefault:'igic',defaultIgicRate:7,defaultVatRate:21,effectiveFrom:'2026-01-01'}],
  FiscalActivity:[{id:'fa',company_id:'qa',active:true,name:'Farmacia ficticia',indirectTax:'igic',indirectTaxRegime:'comerciante_minorista_igic',
    incomeDefaultTreatment:'exempt_limited',expenseDefaultTreatment:'exempt_limited',deductionRight:'sin_derecho',
    exemptionKey:'IGIC_COMERCIANTE_MINORISTA',exemptionLegalBasis:'Art. 27 TR IGIC: entregas comerciales minoristas',automationLevel:'automatico'}],
  AccountingConfiguration:[{id:'cfg',companyId:'qa',accountingFramework:'pgc_pymes',annualAccountsModel:'pyme'}],
  AccountingFiscalYear:[{id:'fy',companyId:'qa',year:2026,startDate:'2026-01-01',endDate:'2026-12-31',status:'abierto'}],
  AccountingAccount:[{id:'expense-history',companyId:'qa',code:'60000008',name:'Compra histórica QA',type:'gasto',status:'activa'}],
  Invoice:[],InvoiceTaxLine:[],OcrInvoiceDocument:[],ClientAccount:[],SupplierAccount:[],JournalEntry:[],JournalEntryLine:[]};
let user={id:'qa-user',role:'user',email:'qa@test.invalid',data:{company_id:'qa'}},seq=0,failEntity='',calls=0;
const matches=(row,q)=>Object.entries(q || {}).every(([key,v])=>{
  if(key==='$or')return v.some(part=>matches(row,part));
  if(key==='$and')return v.every(part=>matches(row,part));
  if(v && typeof v==='object' && !Array.isArray(v))return Object.entries(v).every(([op,n])=>{
    const actual=row[key];
    if(op==='$in')return n.includes(actual) || actual===undefined && n.includes(null);
    if(op==='$ne')return actual!==n;
    if(op==='$exists')return (actual!==undefined)===n;
    if(op==='$gte')return actual>=n;if(op==='$lte')return actual<=n;
    if(op==='$gt')return actual>n;if(op==='$lt')return actual<n;
    return actual===v;});
  return row[key]===v;});
const entity=name=>({
  async get(id){calls++;return (records[name] || []).find(row=>row.id===id) || null;},
  async filter(q={},sort='created_date',limit=5000,skip=0){calls++;const key=sort.replace(/^-/,'');return (records[name] || []).filter(row=>matches(row,q)).slice().sort((a,b)=>String(a[key] || '').localeCompare(String(b[key] || ''))*(sort.startsWith('-')?-1:1)).slice(skip,skip+limit);},
  async create(payload){validateEnumWrite(name,payload);calls++;if(failEntity===name){failEntity='';throw new Error('Fallo QA '+name);}const row={id:name+'-'+(++seq),created_date:new Date(Date.UTC(2026,9,12,0,0,seq)).toISOString(),...payload};(records[name] ||= []).push(row);return row;},
  async update(id,patch){validateEnumWrite(name,patch);calls++;const index=(records[name] || []).findIndex(row=>row.id===id);if(index<0)throw new Error('Missing '+name+':'+id);return records[name][index]={...records[name][index],...patch};},
  async updateMany(q,ops){const rows=(records[name] || []).filter(row=>matches(row,q));for(const row of rows){Object.assign(row,ops.$set || {});for(const [key,n] of Object.entries(ops.$inc || {}))row[key]=Number(row[key] || 0)+Number(n);}return {updated:rows.length};},
  async delete(id){records[name]=(records[name] || []).filter(row=>row.id!==id);},
  async bulkCreate(rows){const created=[];for(const row of rows)created.push(await entity(name).create(row));return created;},
  async bulkUpdate(rows){return Promise.all(rows.map(({id,...patch})=>entity(name).update(id,patch)));}
});
const entities=new Proxy({}, {get:(_,name)=>entity(String(name))}),handlers={};
const client={auth:{me:async()=>user},asServiceRole:{entities},functions:{invoke:async(name,body)=>{
  if(!handlers[name])return {data:{success:true,ok:true}};
  const response=await api(name,body),data=await response.json();
  if(response.status>=400)throw Object.assign(new Error(data.error),{response:{status:response.status,data}});
  return {data};}}};
client.asServiceRole.functions=client.functions;
client.entities=entities;
for(const name of ['fiscalOperations','invoiceOperations','approveOcrDocument','ocrDocumentIntake']){
  const build=await esbuild.build({entryPoints:['base44/functions/'+name+'/entry.ts'],bundle:true,write:false,platform:'node',format:'cjs',
    plugins:[{name:'stub',setup(b){b.onResolve({filter:/^npm:@base44/},()=>({path:'sdk',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const createClientFromRequest=()=>globalThis.__client;',loader:'js'}));}}]});
  vm.runInContext(build.outputFiles[0].text,vm.createContext({Response,Request,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,console,Date,
    setTimeout:fn=>{fn();return 0;},clearTimeout(){},__client:client,Deno:{serve:fn=>{handlers[name]=fn;}}}));
}
async function api(name,body){return handlers[name](new Request('https://qa.invalid/'+name,{method:'POST',body:JSON.stringify(body)}));}
async function call(name,body,status=200){const response=await api(name,body),data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
Object.assign(records.FiscalProfile[0],{mainTerritory:'canarias',defaultIgicRate:7,indirectTaxDefault:'igic'});
Object.assign(records.FiscalActivity[0],{indirectTax:'igic',indirectTaxRegime:'criterio_caja',deductionRight:'pleno',incomeDefaultTreatment:'subject_taxed',expenseDefaultTreatment:'subject_taxed',defaultTaxRate:7,exemptionKey:'',exemptionLegalBasis:''});
const eligibility={confirmed:true,censusOptionConfirmed:true,newActivity:true,year:2026,effectiveFrom:'2026-01-01'};
const qaInvoices=[];
for(const type of ['emitida','recibida']){
 user={...user,role:'admin'};
 const result=await call('invoiceOperations',{action:'create_invoice',company_id:'qa',idempotency_key:'c4-igic-'+type,
  invoice:{tipo:type,numero_factura:'C4-IGIC-'+type,fecha_emision:'2026-01-15',fecha_operacion:'2026-01-15',fecha_recepcion:'2026-01-16',
   cliente_nombre:'CLIENTE FICTICIO NO ENVIAR',cliente_nif:'B12345674',proveedor_nombre:'PROVEEDOR FICTICIO NO ENVIAR',proveedor_nif:'B98765432',
   base_imponible:100,tipo_iva:7,cuota_iva:7,total_factura:107,importe_retencion:0,retencion_irpf:0,moneda:'EUR',fiscal_activity_id:'fa'},
  fiscal_criteria:{taxKind:'igic',regime:'criterio_caja',activityId:'fa',operationType:'subject_taxed',deductiblePercent:100,recc:{eligibility}}});
 const inv=await entity('Invoice').get(result.invoice.id);qaInvoices.push(inv);
 assert.equal(inv.estado_contable,'contabilizada');assert.equal(inv.indirect_tax_kind,'igic');
 const tax=records.JournalEntryLine.find(r=>r.journalEntryId===inv.linked_journal_entry_id&&r.accountCode===(type==='emitida'?'47770000':'47270000'));
 assert.ok(tax,'IGIC must use its existing PGC tax account');assert.equal(type==='emitida'?tax.credit:tax.debit,7);
 user={...user,role:'user'};
 const key='c4-payment-'+type,body={action:'add_payment',company_id:'qa',invoice_id:inv.id,amount:53.5,payment_date:'2026-03-31',method:'transferencia',idempotency_key:key};
 const p=await call('invoiceOperations',body);assert.equal(p.outstanding,53.5);
 const count=records.InvoicePayment.length,journals=records.JournalEntry.length;
 await call('invoiceOperations',body);assert.equal(records.InvoicePayment.length,count);assert.equal(records.JournalEntry.length,journals);
}
const reccBook=await call('fiscalOperations',{action:'recc_book',companyId:'qa',year:2026});
assert.equal(reccBook.invoices.length,2);assert.ok(reccBook.invoices.every(r=>r.taxKind==='igic'));assert.equal(reccBook.issues.length,0,JSON.stringify(reccBook.issues));
const fs=await import('node:fs');
const modelSource=fs.readFileSync('base44/functions/taxModelOperations/entry.ts','utf8')+'\nexport {calculateIndirectTax,cashTaxLineForPeriod,bounds,exportAtcHandoff};';
const modelBuild=await esbuild.build({stdin:{contents:modelSource,loader:'ts',resolveDir:process.cwd()+'/base44/functions/taxModelOperations'},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'stub',setup(b){b.onResolve({filter:/^npm:@base44/},()=>({path:'sdk',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const createClientFromRequest=()=>({});',loader:'js'}));}}]});
const modelContext={module:{exports:{}},exports:{},Deno:{serve(){}},console,Request,Response,URL,TextEncoder,TextDecoder,Date};vm.runInNewContext(modelBuild.outputFiles[0].text,modelContext);
const {calculateIndirectTax:calculate,bounds,exportAtcHandoff}=modelContext.module.exports;
function modelData(){return {invoices:records.Invoice,taxLines:records.InvoiceTaxLine.map(l=>({...l,sourceId:'InvoiceTaxLine:'+l.id,date:l.operationDate,invoice:records.Invoice.find(i=>i.id===l.invoiceId)})),invoicePayments:records.InvoicePayment,rawInvoicePayments:records.InvoicePayment,profile:records.FiscalProfile[0],activities:records.FiscalActivity,filings:[],declarables:[],warnings:[],blockers:[],year:2026,period:'1T'};}
const q1=calculate(modelData(),bounds(2026,'1T'),'igic',false,{previousCompensationBalance:0});
assert.equal(q1.operations.outputQuota,3.5);assert.equal(q1.operations.deductibleQuota,3.5);assert.equal(q1.result,0);
const fields=Object.fromEntries(q1.fields.map(f=>[f.code,f.value]));assert.equal(fields['48'],100);assert.equal(fields['49'],7);assert.equal(fields['50'],100);assert.equal(fields['51'],7);
const annual=calculate({...modelData(),period:'Anual'},bounds(2026,'Anual'),'igic',true,{});
assert.equal(annual.operations.outputQuota,3.5);assert.equal(annual.operations.criterionCash,100);assert.equal(annual.fields.find(f=>f.code==='138').value,100);assert.equal(annual.fields.find(f=>f.code==='141').value,7);
const forced=calculate({...modelData(),year:2027,period:'4T'},bounds(2027,'4T'),'igic',false,{previousCompensationBalance:0});assert.equal(forced.operations.outputQuota,3.5);assert.equal(forced.operations.deductibleQuota,3.5);
const handoff=exportAtcHandoff('420',records.Company[0],2026,'1T',q1,{warnings:[]},'synthetic');assert.match(handoff,/"CASILLA";"420";"2026";"1T";"48";/);assert.match(handoff,/Este CSV no es presentable/);
assert.ok(records.JournalEntry.every(j=>Math.abs(j.totalDebit-j.totalCredit)<0.01));
console.log(JSON.stringify({ok:true,igicEndToEnd:true,issuedAndReceived:true,normalUserPayments:true,retryIdempotent:true,ledgerBalanced:true,bookIncludesIgic:true,model420And425:true,forcedDeadline:true,officialAtcInformativeBoxes:true,externalCalls:0,realWrites:0,calls}));

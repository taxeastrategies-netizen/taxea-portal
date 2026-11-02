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
Object.assign(records.FiscalProfile[0],{mainTerritory:'peninsula',defaultVatRate:21,indirectTaxDefault:'iva'});
Object.assign(records.FiscalActivity[0],{indirectTax:'iva',indirectTaxRegime:'criterio_caja',deductionRight:'pleno',incomeDefaultTreatment:'subject_taxed',expenseDefaultTreatment:'subject_taxed',defaultTaxRate:21,exemptionKey:'',exemptionLegalBasis:''});
for(const year of [2027,2028])await entity('AccountingFiscalYear').create({companyId:'qa',year,startDate:year+'-01-01',endDate:year+'-12-31',status:'abierto'});
const eligibility={confirmed:true,censusOptionConfirmed:true,newActivity:true,year:2026,effectiveFrom:'2026-01-01'};
const quotes=[{date:'2026-01-15',rate:0.9,source:'Banco de España · prueba sintética'},{date:'2026-03-31',rate:0.95,source:'Banco de España · prueba sintética'},{date:'2026-06-30',rate:1.05,source:'Banco de España · prueba sintética'},{date:'2027-12-31',rate:0.8,source:'Banco de España · prueba sintética'},{date:'2028-02-01',rate:1.1,source:'Banco de España · prueba sintética'}];
const made=[];
for(const type of ['emitida','recibida']){
 user={...user,role:'admin'};
 const result=await call('invoiceOperations',{action:'create_invoice',company_id:'qa',idempotency_key:'c4-fx-'+type,
  invoice:{tipo:type,numero_factura:'C4-USD-'+type,fecha_emision:'2026-01-15',fecha_operacion:'2026-01-15',fecha_recepcion:'2026-01-16',cliente_nombre:'QA NO ENVIAR',cliente_nif:'B12345674',proveedor_nombre:'QA NO ENVIAR',proveedor_nif:'B98765432',base_imponible:1000,tipo_iva:21,cuota_iva:210,total_factura:1210,importe_retencion:0,retencion_irpf:0,moneda:'USD',exchange_rate:0.9,fiscal_activity_id:'fa'},
  fiscal_criteria:{taxKind:'iva',regime:'criterio_caja',activityId:'fa',operationType:'subject_taxed',deductiblePercent:100,recc:{eligibility,fxQuotes:quotes}}});
 const inv=await entity('Invoice').get(result.invoice.id);made.push(inv);
 assert.equal(inv.estado_contable,'contabilizada');const entry=records.JournalEntry.find(r=>r.id===inv.linked_journal_entry_id);assert.equal(entry.totalDebit,1089);
 user={...user,role:'user'};
 const denied=await call('fiscalOperations',{action:'confirm_recc_fx_quote',companyId:'qa',invoiceId:inv.id,quote:quotes[0]},403);assert.match(denied.error,/asesor/);
 for(const [date,fx,key]of [['2026-03-31',0.95,'first'],['2026-06-30',1.1,'second']]){
  const request={action:'add_payment',company_id:'qa',invoice_id:inv.id,amount:605,payment_date:date,exchange_rate:fx,method:'transferencia',idempotency_key:key};
  const paid=await call('invoiceOperations',request);assert.equal(paid.payment.amount_eur,Math.round(605*fx*100)/100);assert.equal(paid.payment.carrying_amount_eur,544.5);
  const count=records.JournalEntry.length,payments=records.InvoicePayment.length;
  await call('invoiceOperations',{...request,exchange_rate:8,amount:1});assert.equal(records.JournalEntry.length,count);assert.equal(records.InvoicePayment.length,payments);
 }
 const lines=records.JournalEntryLine.filter(r=>records.JournalEntry.some(j=>j.id===r.journalEntryId&&j.documentId===inv.id));
 const third=lines.filter(r=>r.sourceLineType==='tercero').reduce((s,r)=>s+r.debit-r.credit,0);assert.ok(Math.abs(third)<0.001);
 const tax=lines.filter(r=>r.accountCode===(type==='emitida'?'47700000':'47200000')).reduce((s,r)=>s+(type==='emitida'?r.credit-r.debit:r.debit-r.credit),0);assert.equal(tax,210);
 assert.ok(lines.some(r=>r.accountCode===(type==='emitida'?'76800000':'66800000')));
}
const fs=await import('node:fs'),modelSource=fs.readFileSync('base44/functions/taxModelOperations/entry.ts','utf8')+'\nexport {calculateIndirectTax,cashTaxLineForPeriod,bounds};';
const modelBuild=await esbuild.build({stdin:{contents:modelSource,loader:'ts',resolveDir:process.cwd()+'/base44/functions/taxModelOperations'},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'stub',setup(b){b.onResolve({filter:/^npm:@base44/},()=>({path:'sdk',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const createClientFromRequest=()=>({});',loader:'js'}));}}]});
const mc={module:{exports:{}},exports:{},Deno:{serve(){}},console,Request,Response,URL,TextEncoder,TextDecoder,Date};vm.runInNewContext(modelBuild.outputFiles[0].text,mc);const {calculateIndirectTax:calc,bounds}=mc.module.exports;
function data(){return {invoices:records.Invoice,taxLines:records.InvoiceTaxLine.map(l=>({...l,sourceId:'InvoiceTaxLine:'+l.id,date:l.operationDate,invoice:records.Invoice.find(i=>i.id===l.invoiceId)})),invoicePayments:records.InvoicePayment,rawInvoicePayments:records.InvoicePayment,profile:records.FiscalProfile[0],activities:records.FiscalActivity,filings:[],declarables:[],warnings:[],blockers:[],year:2026,period:'1T'};}
const q1=calc(data(),bounds(2026,'1T'),'iva',false,{});assert.equal(q1.operations.outputQuota,99.75);assert.equal(q1.operations.deductibleQuota,99.75);assert.equal(q1.operations.criterionCash,900);
const q2=calc(data(),bounds(2026,'2T'),'iva',false,{});assert.equal(q2.operations.outputQuota,110.25);assert.equal(q2.operations.deductibleQuota,110.25);
const book=await call('fiscalOperations',{action:'recc_book',companyId:'qa',year:2026});assert.equal(book.issues.length,0,JSON.stringify(book.issues));assert.ok(book.payments.every(p=>p.currency==='USD'&&p.amountEur>0));
// A future legal deadline has no official FX quote yet; do not display a fabricated zero EUR.
const third=made[0];records.InvoicePayment=records.InvoicePayment.filter(p=>p.invoice_id!==third.id||p.payment_date==='2026-03-31');
const partialBook=await call('fiscalOperations',{action:'recc_book',companyId:'qa',year:2026});
const future=partialBook.invoices.find(i=>i.id===third.id);assert.equal(future.forcedAmount,605);assert.equal(future.forcedAmountEur,null);
user={...user,role:'admin'};
const fourRates=[0,4,10,21].map(rate=>({base:100,rate,quota:rate}));
const four=await call('invoiceOperations',{action:'create_invoice',company_id:'qa',idempotency_key:'c4-four-rates',invoice:{tipo:'emitida',numero_factura:'C4-FOUR-RATES',fecha_emision:'2026-01-15',fecha_operacion:'2026-01-15',cliente_nombre:'QA FOUR NO ENVIAR',cliente_nif:'B12345674',base_imponible:400,tipo_iva:21,cuota_iva:35,total_factura:435,moneda:'USD',exchange_rate:0.9,fiscal_activity_id:'fa'},fiscal_criteria:{taxKind:'iva',regime:'criterio_caja',activityId:'fa',operationType:'subject_taxed',deductiblePercent:100,taxBreakdown:fourRates,recc:{eligibility,fxQuotes:quotes}}});
assert.equal(records.InvoiceTaxLine.filter(l=>l.invoiceId===four.invoice.id).length,4);
assert.equal(records.JournalEntry.find(j=>j.id===four.journalEntryId).totalDebit,391.5);
assert.ok(records.JournalEntry.every(j=>Math.abs(j.totalDebit-j.totalCredit)<0.001));
console.log(JSON.stringify({ok:true,foreignIssuedAndReceived:true,bookCurrency:true,fiscalVsBankFx:true,immutableRetry:true,thirdPartiesSettled:true,taxModelEUR:true,externalCalls:0,realWrites:0,calls}));

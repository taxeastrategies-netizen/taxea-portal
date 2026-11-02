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
  async updateMany(q,ops){const rows=(records[name] || []).filter(row=>matches(row,q));for(const row of rows){Object.assign(row,ops.$set || {});for(const [key,n] of Object.entries(ops.$inc || {}))row[key]=Number(row[key] || 0)+Number(n);}return {success:true,updated:rows.length};},
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
const eligibility={confirmed:true,censusOptionConfirmed:true,newActivity:true,year:2026,effectiveFrom:'2026-01-01'};
const quotes=[['2026-01-15',0.9],['2026-02-01',0.95],['2026-03-01',0.95],['2026-04-01',1.1]].map(([date,rate])=>({date,rate,source:'Banco de España · prueba sintética'}));
let key=0;
async function create(type,{base=1000,date='2026-01-15',fx=0.9,recc={},rect=false,deduction=100}={}){
 Object.assign(records.FiscalActivity[0],{deductionRight:deduction===100?'pleno':deduction===0?'sin_derecho':'prorrata_general',proRataPercent:deduction});
 user={...user,role:'admin'};const quota=Math.round(base*21)/100;
 const result=await call('invoiceOperations',{action:'create_invoice',company_id:'qa',idempotency_key:'fx-advance-'+(++key),invoice:{tipo:type,numero_factura:'C4-FXA-'+key,fecha_emision:date,fecha_operacion:date,fecha_recepcion:date,cliente_nombre:'QA NO ENVIAR',cliente_nif:'B12345674',proveedor_nombre:'QA NO ENVIAR',proveedor_nif:'B98765432',base_imponible:base,tipo_iva:21,cuota_iva:quota,total_factura:Math.round((base+quota)*100)/100,moneda:'USD',exchange_rate:fx,fiscal_activity_id:'fa',es_rectificativa:rect,factura_rectificada:rect?'QA-ORIGINAL':''},fiscal_criteria:{taxKind:'iva',regime:'criterio_caja',activityId:'fa',operationType:'subject_taxed',deductiblePercent:deduction,recc:{eligibility,fxQuotes:quotes,...recc}}});
 return entity('Invoice').get(result.invoice.id);
}
async function pay(inv,amount,date,fx,id){user={...user,role:'user'};return call('invoiceOperations',{action:'add_payment',company_id:'qa',invoice_id:inv.id,amount,payment_date:date,exchange_rate:fx,method:'transferencia',idempotency_key:id});}
for(const type of ['emitida','recibida']){
 const advance=await create(type,{recc:{documentKind:'advance'}});
 const profileCount=records.CounterpartyFiscalProfile.length;
 await pay(advance,605,'2026-02-01',0.95,'advance-half');
 const credit=await create(type,{base:-200,date:'2026-03-01',fx:0.95,rect:true,recc:{documentKind:'advance',originalInvoiceId:advance.id,adjustmentDate:'2026-03-01',adjustmentMode:'price_change',reason:'Devolución parcial de anticipo ficticio',refundCashAmount:242}});
 const metadata=JSON.parse(credit.recc_metadata);assert.equal(metadata.advanceCreditBook.costEur,190);assert.equal(metadata.advanceCreditBook.taxEur,39.9);assert.equal(metadata.advanceCreditBook.totalEur,229.9);
 const refund=await pay(credit,242,'2026-03-01',1,'credit-refund');assert.equal(refund.payment.carrying_amount_eur,229.9);
 const refundLines=records.JournalEntryLine.filter(l=>l.journalEntryId===refund.journal_entry.id);assert.equal(refundLines.filter(l=>/^47[27]/.test(l.accountCode)).length,0,'refund must not repeat tax');
 const final=await create(type,{base:200,date:'2026-04-01',fx:1.1,recc:{documentKind:'final',finalOperationBase:500,advanceAllocations:[{invoiceId:advance.id,base:300}]}});
 const saved=JSON.parse(final.recc_metadata).advanceBookAllocations;assert.equal(saved[0].amountEur,285);
 const lines=records.JournalEntryLine.filter(l=>l.journalEntryId===final.linked_journal_entry_id),advanceLine=lines.find(l=>l.accountCode===(type==='emitida'?'43800000':'40700000'));
 assert.equal(type==='emitida'?advanceLine.debit:advanceLine.credit,285,'must release funded historic EUR, not final spot FX');
 assert.equal(lines.filter(l=>l.sourceLineType==='diferencia_cambio').length,0,'no currency gain on application of a nonmonetary advance');
 assert.ok(records.JournalEntry.every(j=>Math.abs(j.totalDebit-j.totalCredit)<0.001));
 assert.equal(records.CounterpartyFiscalProfile.length,profileCount,'existing third party reused for advance, credit and final');
}
for(const [deduction,expectedCost]of [[50,314.92],[0,344.85]]){
 const advance=await create('recibida',{deduction,recc:{documentKind:'advance'}});await pay(advance,605,'2026-02-01',0.95,'nondeduct-half');
 const credit=await create('recibida',{deduction,base:-200,date:'2026-03-01',fx:0.95,rect:true,recc:{documentKind:'advance',originalInvoiceId:advance.id,adjustmentDate:'2026-03-01',adjustmentMode:'price_change',reason:'Devolución ficticia con impuesto no deducible',refundCashAmount:242}});
 await pay(credit,242,'2026-03-01',1,'nondeduct-refund');
 const final=await create('recibida',{deduction,base:200,date:'2026-04-01',fx:1.1,recc:{documentKind:'final',finalOperationBase:500,advanceAllocations:[{invoiceId:advance.id,base:300}]}});
 assert.equal(JSON.parse(final.recc_metadata).advanceBookAllocations[0].amountEur,expectedCost,'historic cost includes only the exact non-deductible tax cents');
}
// Abono mixto: devuelve solo la parte cobrada y cancela el resto de deuda.
for(const type of ['emitida','recibida']){
 const advance=await create(type,{recc:{documentKind:'advance'}});await pay(advance,605,'2026-02-01',0.95,'mixed-half');
 const credit=await create(type,{base:-200,date:'2026-03-01',fx:0.95,rect:true,recc:{documentKind:'advance',originalInvoiceId:advance.id,adjustmentDate:'2026-03-01',adjustmentMode:'price_change',reason:'Abono ficticio con cancelación de deuda y devolución',refundCashAmount:121}});
 const metadata=JSON.parse(credit.recc_metadata);assert.equal(metadata.advanceCreditBook.costEur,185);assert.equal(metadata.advanceCreditBook.taxEur,38.85);assert.equal(metadata.advanceCreditBook.paidTotalEur,114.95);
 const refund=await pay(credit,121,'2026-03-01',1,'mixed-refund');assert.equal(refund.payment.carrying_amount_eur,114.95);assert.equal(refund.outstanding,0);
 const state=await call('invoiceOperations',{action:'list_payments',company_id:'qa',invoice_id:advance.id});assert.equal(state.outstanding,484);assert.equal(state.credit_offset,121);
 const final=await create(type,{base:100,date:'2026-04-01',fx:1.1,recc:{documentKind:'final',finalOperationBase:500,advanceAllocations:[{invoiceId:advance.id,base:400}]}});
 assert.equal(JSON.parse(final.recc_metadata).advanceBookAllocations[0].amountEur,380);
}
console.log(JSON.stringify({ok:true,foreignAdvances:true,partialFunding:true,partialCreditRefund:true,historicNonMonetaryValuation:true,noRepeatedTaxOnRefund:true,noCurrencyGainOnApplication:true,preservedSubaccounts:true,externalCalls:0,realWrites:0,calls}));

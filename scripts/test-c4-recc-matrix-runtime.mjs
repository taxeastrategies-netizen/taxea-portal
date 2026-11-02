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
for(const year of [2027,2028])await entity('AccountingFiscalYear').create({companyId:'qa',year,startDate:year+'-01-01',endDate:year+'-12-31',status:'abierto'});
const eligibility={confirmed:true,censusOptionConfirmed:true,newActivity:true,year:2026,effectiveFrom:'2026-01-01'};
const official=(date,rate)=>({date,rate,source:'Banco de España · prueba sintética'});
let serial=0;
async function make({kind='iva',type='emitida',general=false,currency='USD',fx=0.9,deduction=100,insolvency=false,multiple=false,withholding=false}={}){
 Object.assign(records.FiscalProfile[0],{mainTerritory:kind==='igic'?'canarias':'peninsula',indirectTaxDefault:kind});
 Object.assign(records.FiscalActivity[0],{indirectTax:kind,indirectTaxRegime:general?'general':'criterio_caja',deductionRight:deduction===100?'pleno':'prorrata_general',proRataPercent:deduction,incomeDefaultTreatment:'subject_taxed',expenseDefaultTreatment:'subject_taxed',defaultTaxRate:kind==='iva'?21:7,exemptionKey:'',exemptionLegalBasis:''});
 user={...user,role:'admin'};
 const rates=kind==='iva'?[21,10]:[7,3],parts=(multiple?rates:[rates[0]]).map(rate=>({base:100,rate,quota:rate}));
 const base=parts.reduce((s,r)=>s+r.base,0),quota=parts.reduce((s,r)=>s+r.quota,0),retention=withholding?base*0.15:0;
 const forced=insolvency?'2026-05-01':'2027-12-31',late=insolvency?'2026-06-01':'2028-02-01';
 const recc={eligibility,fxQuotes:[official('2026-01-15',fx),official('2026-03-31',0.95),official(forced,0.8),official(late,1.05)],...(insolvency?{insolvencyDate:forced,reason:'Auto de concurso ficticio revisado'}:{})};
 const result=await call('invoiceOperations',{action:'create_invoice',company_id:'qa',idempotency_key:'matrix-'+(++serial),invoice:{tipo:type,numero_factura:'C4-MATRIX-'+serial,fecha_emision:'2026-01-15',fecha_operacion:'2026-01-15',fecha_recepcion:'2026-01-16',cliente_nombre:'QA NO ENVIAR',cliente_nif:'B12345674',proveedor_nombre:'QA NO ENVIAR',proveedor_nif:'B98765432',base_imponible:base,tipo_iva:rates[0],cuota_iva:quota,total_factura:base+quota-retention,importe_retencion:retention,retencion_irpf:withholding?15:0,categoria_gasto:withholding?'servicios_profesionales':'otros',moneda:currency,exchange_rate:fx,fiscal_activity_id:'fa',...(multiple?{tax_breakdown:JSON.stringify(parts)}:{})},fiscal_criteria:{taxKind:kind,regime:'criterio_caja',activityId:'fa',operationType:'subject_taxed',deductiblePercent:deduction,manualOverride:general,manualOverrideReason:general?'Factura recibida de proveedor en RECC, destinatario en régimen general':'',...(multiple?{taxBreakdown:parts}:{}),recc}});
 return {invoice:await entity('Invoice').get(result.invoice.id),parts,forced,late,kind,type,general,deduction,currency};
}
async function pay(inv,amount,date,fx,key,status=200){user={...user,role:'user'};return call('invoiceOperations',{action:'add_payment',company_id:'qa',invoice_id:inv.id,amount,payment_date:date,exchange_rate:fx,method:'transferencia',idempotency_key:key},status);}
const fs=await import('node:fs'),source=fs.readFileSync('base44/functions/taxModelOperations/entry.ts','utf8')+'\nexport {calculateIndirectTax,calculate111,bounds};';
const built=await esbuild.build({stdin:{contents:source,loader:'ts',resolveDir:process.cwd()+'/base44/functions/taxModelOperations'},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'stub',setup(b){b.onResolve({filter:/^npm:@base44/},()=>({path:'sdk',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const createClientFromRequest=()=>({});',loader:'js'}));}}]});
const mc={module:{exports:{}},exports:{},Deno:{serve(){}},console,Request,Response,URL,TextEncoder,TextDecoder,Date};vm.runInNewContext(built.outputFiles[0].text,mc);const {calculateIndirectTax:calc,calculate111,bounds}=mc.module.exports;
function data(invoice){return {invoices:[invoice],taxLines:records.InvoiceTaxLine.filter(l=>l.invoiceId===invoice.id).map(l=>({...l,sourceId:'InvoiceTaxLine:'+l.id,date:l.operationDate,invoice})),invoicePayments:(records.InvoicePayment||[]).filter(p=>p.invoice_id===invoice.id&&p.operation_status==='committed'),rawInvoicePayments:(records.InvoicePayment||[]).filter(p=>p.invoice_id===invoice.id),profile:records.FiscalProfile[0],activities:records.FiscalActivity,payrolls:[],filings:[],declarables:[],warnings:[],blockers:[],year:2026,period:'1T'};}
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
for(const config of [{multiple:true,withholding:true},{type:'recibida',general:true,deduction:50,multiple:true,withholding:true,insolvency:true},{kind:'igic',type:'recibida',general:true,multiple:true,currency:'EUR',fx:1}]){
 const c=await make(config),i=c.invoice,half=round(i.total_factura/2),foreign=c.currency!=='EUR';
 await pay(i,half,'2026-03-31',0.95,'first-'+i.id);
 const first=calc(data(i),bounds(2026,'1T'),c.kind,false,{}),expected=c.parts.reduce((s,p)=>s+round(p.quota*0.5*(foreign?0.95:1)),0);
 assert.equal(c.type==='emitida'?first.operations.outputQuota:first.operations.deductibleQuota,c.type==='emitida'?round(expected):round(c.parts.reduce((s,p)=>s+round(round(p.quota*c.deduction/100)*0.5*(foreign?0.95:1)),0)));
 if(c.general)assert.equal(records.FiscalActivity[0].indirectTaxRegime,'general','recipient must keep general regime');
 if(config.withholding&&c.type==='recibida'){const withholding=calculate111(data(i),bounds(2026,'1T'));assert.equal(withholding.result,round(i.importe_retencion*0.5*(foreign?0.95:1)));}
 await pay(i,round(i.total_factura-half),c.late,1.1,'late-'+i.id);
 const forcedYear=Number(c.forced.slice(0,4)),quarter=c.forced.endsWith('12-31')?'4T':'2T',forced=calc({...data(i),year:forcedYear,period:quarter},bounds(forcedYear,quarter),c.kind,false,{});
 const forcedExpected=round(c.parts.reduce((s,p)=>s+round(round(p.quota*(c.type==='recibida'?c.deduction/100:1))*0.5*(foreign?0.8:1)),0));
 assert.equal(c.type==='emitida'?forced.operations.outputQuota:forced.operations.deductibleQuota,forcedExpected);
 const late=calc({...data(i),year:Number(c.late.slice(0,4))},bounds(Number(c.late.slice(0,4)),c.forced==='2026-05-01'?'3T':'1T'),c.kind,false,{});assert.equal(c.type==='emitida'?late.operations.outputQuota:late.operations.deductibleQuota,0);
 const all=records.JournalEntryLine.filter(l=>records.JournalEntry.some(j=>j.id===l.journalEntryId&&j.documentId===i.id));
 const taxCode=c.kind==='igic'?(c.type==='emitida'?'47770000':'47270000'):(c.type==='emitida'?'47700000':'47200000');
 const bookTax=round(all.filter(l=>l.accountCode===taxCode).reduce((s,l)=>s+(c.type==='emitida'?l.credit-l.debit:l.debit-l.credit),0));
 assert.equal(bookTax,round((c.type==='emitida'?first.operations.outputQuota:first.operations.deductibleQuota)+forcedExpected),'EUR accounting tax must match RECC model recognition after forcing');
 const count=records.JournalEntry.length;await pay(i,1,c.late,8,'late-'+i.id);assert.equal(records.JournalEntry.length,count,'late retry must not duplicate forced adjustment');
}
// Interrupción después de reservar el cambio, antes de completar las líneas.
const interrupted=(await make()).invoice;failEntity='JournalEntryLine';await pay(interrupted,60.5,'2026-03-31',0.95,'interrupted',500);
const recovered=await pay(interrupted,60.5,'2026-03-31',9,'interrupted');assert.equal(recovered.payment.exchange_rate,0.95);assert.equal(recovered.payment.operation_status,'committed');assert.equal(records.InvoicePayment.filter(p=>p.invoice_id===interrupted.id).length,1);
// Conciliar un banco EUR con factura USD, reutilizando su 555 sin volver a contabilizar banco.
for(const pending of [false,true]){
 const i=(await make()).invoice,amount=round(i.total_factura/2),cash=round(amount*0.95),ledger=await entity('AccountingAccount').create({companyId:'qa',code:pending?'57200092':'57200091',name:'Banco ficticio EUR',type:'banco',status:'activa'}),bank=await entity('BankAccount').create({company_id:'qa',nombre_banco:'QA NO CONECTAR',moneda:'EUR',accounting_account_id:ledger.id,accounting_account_code:ledger.code}),tx=await entity('BankTransaction').create({company_id:'qa',bank_account_id:bank.id,fecha_operacion:'2026-03-31',importe:cash,moneda:'EUR',tipo:'entrada',estado_proveedor:'booked',estado_conciliacion:'sin_conciliar',es_demo:false});
 let originalSnapshot='';
 if(pending){const clearing=await entity('AccountingAccount').create({companyId:'qa',code:'55500092',name:'Partidas pendientes ficticias',type:'pasivo',status:'activa'}),j=await entity('JournalEntry').create({companyId:'qa',postingKey:'bank:'+tx.id+':pgc8-v1',documentId:tx.id,status:'confirmado',totalDebit:cash,totalCredit:cash,date:tx.fecha_operacion});await entity('JournalEntryLine').create({companyId:'qa',journalEntryId:j.id,lineNumber:1,accountId:ledger.id,accountCode:ledger.code,debit:cash,credit:0});await entity('JournalEntryLine').create({companyId:'qa',journalEntryId:j.id,lineNumber:2,accountId:clearing.id,accountCode:clearing.code,debit:0,credit:cash});originalSnapshot=JSON.stringify(records.JournalEntryLine.filter(l=>l.journalEntryId===j.id));}
 user={...user,role:'user'};
 const body={action:'reconcile',company_id:'qa',invoice_id:i.id,bank_transaction_id:tx.id,bank_accounting_account_id:ledger.id,invoice_amount:amount};
 const result=await call('invoiceOperations',body);assert.equal(result.payment.amount,amount);assert.equal(result.payment.amount_eur,cash);
 const count=records.JournalEntry.length;await call('invoiceOperations',body);assert.equal(records.JournalEntry.length,count);
 const bankLines=records.JournalEntryLine.filter(l=>l.accountId===ledger.id);assert.equal(bankLines.length,1,'bank must be posted only once');
 if(pending){const original=records.JournalEntry.find(j=>j.postingKey==='bank:'+tx.id+':pgc8-v1');assert.equal(JSON.stringify(records.JournalEntryLine.filter(l=>l.journalEntryId===original.id)),originalSnapshot,'original bank journal unchanged');assert.equal(round(records.JournalEntryLine.filter(l=>l.accountCode==='55500092').reduce((s,l)=>s+l.debit-l.credit,0)),0);}
}
assert.ok(records.JournalEntry.filter(j=>j.status==='confirmado').every(j=>Math.abs(j.totalDebit-j.totalCredit)<0.001));
console.log(JSON.stringify({ok:true,multipleRates:true,retentions:true,recipientGeneralRegimePreserved:true,insolvency:true,latePaymentNoDoubleTax:true,accountingEqualsFiscalEUR:true,interruptionRecovery:true,fxFrozenOnRetry:true,bankEURtoUSD:true,clearing555WithoutSecondBank:true,originalBankJournalPreserved:true,externalCalls:0,realWrites:0,calls}));

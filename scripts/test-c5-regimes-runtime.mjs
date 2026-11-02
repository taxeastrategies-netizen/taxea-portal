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
for(const name of ['fiscalOperations','invoiceOperations','approveOcrDocument','ocrDocumentIntake','accountingOperations']){
  const build=await esbuild.build({entryPoints:['base44/functions/'+name+'/entry.ts'],bundle:true,write:false,platform:'node',format:'cjs',
    plugins:[{name:'stub',setup(b){b.onResolve({filter:/^npm:@base44/},()=>({path:'sdk',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const createClientFromRequest=()=>globalThis.__client;',loader:'js'}));}}]});
  vm.runInContext(build.outputFiles[0].text,vm.createContext({Response,Request,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,console,Date,
    setTimeout:fn=>{fn();return 0;},clearTimeout(){},__client:client,Deno:{serve:fn=>{handlers[name]=fn;}}}));
}
async function api(name,body){return handlers[name](new Request('https://qa.invalid/'+name,{method:'POST',body:JSON.stringify(body)}));}
async function call(name,body,status=200){const response=await api(name,body),data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
// Synthetic fixtures only; the handlers and posting engine are the actual application code.
Object.assign(records.FiscalProfile[0],{entityType:'autonomo',effectiveFrom:'2025-01-01',repepStatus:'no_aplica'});
records.FiscalActivity=[];records.FiscalDeductionAdjustment=[];records.AccountingAsset=[];
const activity=(id,kind,regime,right='pleno',extra={})=>{
 const a={id,company_id:'qa',active:true,name:'Actividad ficticia '+id,activityType:'empresarial',indirectTax:kind,indirectTaxRegime:regime,deductionRight:right,proRataPercent:100,automationLevel:'proponer_revisar',defaultTaxRate:kind==='igic'?7:21,startDate:'2025-01-01',incomeDefaultTreatment:'subject_taxed',expenseDefaultTreatment:'subject_taxed',...extra};records.FiscalActivity.push(a);return a;
};
let invoiceSeq=0;
async function make(type,a,base,taxRate,quota,criteria={},extra={}){
 const number='QA-C5-'+(++invoiceSeq),date=extra.fecha_emision||'2026-08-15',surcharge=Number(extra.cuota_recargo||0);
 const result=await call('invoiceOperations',{action:'create_invoice',company_id:'qa',idempotency_key:number,
 invoice:{tipo:type,numero_factura:number,fecha_emision:date,fecha_operacion:date,fecha_recepcion:date,cliente_nombre:'CLIENTE FICTICIO',cliente_nif:'B12345674',proveedor_nombre:'PROVEEDOR FICTICIO',proveedor_nif:'B98765432',base_imponible:base,tipo_iva:taxRate,cuota_iva:quota,total_factura:Math.round((base+quota+surcharge)*100)/100,importe_retencion:0,retencion_irpf:0,moneda:'EUR',fiscal_activity_id:a.id,revenue_expense_account_code:type==='emitida'?'70500000':'60000008',...extra},
 fiscal_criteria:{activityId:a.id,taxKind:a.indirectTax,regime:a.indirectTaxRegime,operationType:type==='recibida'&&quota===0?'subject_zero':'subject_taxed',...criteria}});
 const inv=await entity('Invoice').get(result.invoice.id);
 assert.equal(inv.estado_contable,'contabilizada',JSON.stringify(result));
 return inv;
}
const journalLines=invoice=>records.JournalEntryLine.filter(l=>l.journalEntryId===invoice.linked_journal_entry_id);
const cost=invoice=>journalLines(invoice).filter(l=>/^[26]/.test(l.accountCode)).reduce((sum,l)=>sum+Number(l.debit)-Number(l.credit),0);
user={...user,role:'admin'};
const re=activity('repep','igic','pequeno_empresario_igic','sin_derecho');
Object.assign(records.FiscalProfile[0],{mainTerritory:'canarias',indirectTaxDefault:'igic',repepStatus:'incluido',repepEffectiveFrom:'2026-01-01',repepPreviousTurnover:30000,repepCensusConfirmed:true});
const reSale=await make('emitida',re,100,0,0,{operationType:'exempt_limited',exemptionKey:'IGIC_REPEP',legalBasis:'Art. 90 TR IGIC'});
const rePurchase=await make('recibida',re,100,7,7);
assert.equal(rePurchase.deductible_tax_amount,0);assert.equal(cost(rePurchase),107);assert.ok(!journalLines(rePurchase).some(l=>l.accountCode==='47270000'));assert.ok(!journalLines(reSale).some(l=>l.accountCode==='47770000'));
Object.assign(records.FiscalProfile[0],{repepStatus:'no_aplica'});
const retail=activity('retail','igic','comerciante_minorista_igic','sin_derecho',{activityType:'comercial_minorista'});
const retailSale=await make('emitida',retail,100,0,0,{operationType:'exempt_limited',exemptionKey:'IGIC_COMERCIANTE_MINORISTA',legalBasis:'Art. 27 TR IGIC'});
const retailPurchase=await make('recibida',retail,100,7,7);assert.equal(cost(retailPurchase),107);assert.equal(retailSale.fiscal_exemption_key,'IGIC_COMERCIANTE_MINORISTA');
const dua=await make('recibida',retail,100,7,7,{operationType:'import',c5:{kind:'minorista_import',importTaxBase:100,aiem:5,forResale:true,customsDocumentConfirmed:true,customsReference:'DUA-FICTICIO'}},{cuota_recargo:.74,tipo_recargo:.7});
assert.equal(cost(dua),107.74);assert.ok(!journalLines(dua).some(l=>l.accountCode==='47270000'));
const igic=activity('igic-general','igic','general');
const implicit=await make('recibida',igic,100,0,0,{operationType:'exempt_limited',exemptionKey:'IGIC_COMERCIANTE_MINORISTA',legalBasis:'Art. 29.3 Ley 20/1991',deductiblePercent:100,c5:{kind:'implicit_igic',underlyingRate:7,supplierRetailLegendConfirmed:true}});
assert.equal(implicit.cuota_iva,0);assert.equal(implicit.total_factura,100);assert.equal(implicit.deductible_tax_amount,4.9);assert.equal(cost(implicit),95.1);assert.equal(journalLines(implicit).find(l=>l.accountCode==='47270000').debit,4.9);
const limited=activity('health','iva','exenta_limitada','sin_derecho',{activityType:'sanitaria'});
Object.assign(records.FiscalProfile[0],{mainTerritory:'peninsula_baleares',indirectTaxDefault:'iva'});
const health=await make('recibida',limited,100,21,21);assert.equal(cost(health),121);assert.ok(!journalLines(health).some(l=>l.accountCode==='47200000'));
const full=activity('export','iva','exenta_plena');
const exportPurchase=await make('recibida',full,100,21,21);assert.equal(exportPurchase.deductible_tax_amount,21);assert.equal(cost(exportPurchase),100);
const prorata=activity('prorata','iva','general','prorrata_general',{proRataPercent:50});
const pSale=await make('emitida',prorata,2000,21,420,{}, {fecha_emision:'2025-11-01'});
const pExempt=await make('emitida',prorata,1000,0,0,{operationType:'exempt_limited',exemptionKey:'IVA_ART_20_SANITARIA',legalBasis:'Art.20.Uno.3 LIVA'},{fecha_emision:'2025-11-02'});
const pExpense=await make('recibida',prorata,100,21,21,{deductionUse:'shared'},{fecha_emision:'2025-11-03'});
assert.equal(pExpense.deductible_tax_amount,10.5);assert.equal(cost(pExpense),110.5);
const oldInvoiceProof=JSON.stringify(records.Invoice),oldLinesProof=JSON.stringify(records.InvoiceTaxLine);
const pBody={companyId:'qa',year:2025,activityId:prorata.id,kind:'prorata'};
const preview=await call('accountingOperations',{...pBody,action:'c5_deduction_preview'});
assert.equal(preview.calculation.percent,67);assert.equal(preview.delta,3.57);assert.equal(preview.calculation.mandatorySpecial,false);
user={...user,role:'user'};
await call('accountingOperations',{...pBody,action:'c5_deduction_post',expectedFingerprint:preview.fingerprint,confirmReviewed:true,reason:'QA ficticia'},403);
await call('accountingOperations',{...pBody,companyId:'foreign',action:'c5_deduction_preview'},403);
user={...user,role:'admin'};
const postBody={...pBody,action:'c5_deduction_post',expectedFingerprint:preview.fingerprint,confirmReviewed:true,reason:'Cierre ficticio para QA; sin presentación tributaria'};
const posted=await call('accountingOperations',postBody),entryCount=records.JournalEntry.length;
assert.ok(posted.journalEntryId);const adjustmentLines=records.JournalEntryLine.filter(l=>l.journalEntryId===posted.journalEntryId);assert.equal(adjustmentLines.find(l=>l.accountCode==='47200000').debit,3.57);assert.equal(adjustmentLines.find(l=>l.accountCode==='63910000').credit,3.57);
await call('accountingOperations',postBody);assert.equal(records.JournalEntry.length,entryCount);assert.equal(records.FiscalDeductionAdjustment.length,1);
const again=await call('accountingOperations',{...pBody,action:'c5_deduction_preview'});assert.equal(again.delta,0);assert.equal(again.postedAmount,3.57);
assert.equal(JSON.stringify(records.Invoice),oldInvoiceProof);assert.equal(JSON.stringify(records.InvoiceTaxLine),oldLinesProof);
// The annual regularization may be simulated during the year, but cannot be posted prematurely.
const pCurrent=await make('emitida',prorata,100,21,21,{},{fecha_emision:'2026-08-15'});
await make('recibida',prorata,100,21,21,{deductionUse:'shared'},{fecha_emision:'2026-08-16'});
const premature=await call('accountingOperations',{...pBody,year:2099,action:'c5_deduction_preview'},422);
assert.ok(premature.error);
// Compile the actual model functions, then inspect official export boxes and full traceability.
const fs=await import('node:fs');
const modelSource=fs.readFileSync('base44/functions/taxModelOperations/entry.ts','utf8')+'\nexport {calculateIndirectTax,bounds,export303,export390,selectIndirectTaxLines,applyModelValidation};';
const build=await esbuild.build({stdin:{contents:modelSource,loader:'ts',resolveDir:process.cwd()+'/base44/functions/taxModelOperations'},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'stub',setup(b){b.onResolve({filter:/^npm:@base44/},()=>({path:'sdk',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const createClientFromRequest=()=>({});',loader:'js'}));}}]});
const context={module:{exports:{}},exports:{},Deno:{serve(){}},console,Request,Response,URL,TextEncoder,TextDecoder,Date};vm.runInNewContext(build.outputFiles[0].text,context);
const {calculateIndirectTax:calculate,bounds,export303,export390}=context.module.exports;
function modelData(year,period,ids=null){return {company:records.Company[0],invoices:records.Invoice,taxLines:records.InvoiceTaxLine.filter(l=>!ids||ids.includes(l.invoiceId)).map(l=>({...l,sourceId:'InvoiceTaxLine:'+l.id,date:l.operationDate,invoice:records.Invoice.find(i=>i.id===l.invoiceId)})),invoicePayments:[],profile:records.FiscalProfile[0],activities:records.FiscalActivity,filings:[],declarables:[],entries:records.JournalEntry,fiscalAdjustments:records.FiscalDeductionAdjustment,warnings:[],blockers:[],year,period};}
const onlyProrata=[pSale.id,pExempt.id,pExpense.id];
const q4=calculate(modelData(2025,'4T',onlyProrata),bounds(2025,'4T'),'iva',false,{previousCompensationBalance:0});
assert.equal(q4.operations.deductibleQuota,14.07);assert.equal(q4.operations.prorataAdjustment,3.57);assert.equal(q4.fields.find(f=>f.code==='44').value,3.57);
const exported=export303({nif_cif:'B12345674',razon_social:'FICTICIA'},records.FiscalProfile[0],2025,'4T',q4);
assert.equal(Number(exported.slice(984,1001))/100,3.57);
const annual=calculate(modelData(2025,'Anual',onlyProrata),bounds(2025,'Anual'),'iva',true,{});
assert.equal(annual.fields.find(f=>f.code==='522').value,3.57);assert.equal(annual.operations.deductibleQuota,14.07);
const repepAnnual=calculate(modelData(2026,'Anual',[reSale.id,rePurchase.id,retailSale.id,retailPurchase.id,dua.id]),bounds(2026,'Anual'),'igic',true,{});
assert.equal(repepAnnual.fields.find(f=>f.code==='147').value,100);assert.equal(repepAnnual.operations.outputQuota,0);assert.equal(repepAnnual.operations.deductibleQuota,0);assert.equal(repepAnnual.carryforward.excludedSpecial.length,0);
const implicitPeriod=calculate(modelData(2026,'3T',[implicit.id]),bounds(2026,'3T'),'igic',false,{previousCompensationBalance:0});assert.equal(implicitPeriod.operations.deductibleQuota,4.9);
assert.ok(records.JournalEntry.every(j=>j.isBalanced&&Math.abs(j.totalDebit-j.totalCredit)<.01));

// Cross-year RECC: fiscal provisional 67%, original carrying deduction 50%, definitive 60%.
const cashProrata=activity('cash-prorata','iva','general','prorrata_general',{proRataPercent:50,startDate:'2024-01-01'});
await make('emitida',cashProrata,600,21,126,{}, {fecha_emision:'2025-06-01'});
await make('emitida',cashProrata,400,0,0,{operationType:'exempt_limited',exemptionKey:'IVA_ART_20_SANITARIA',legalBasis:'Art.20.Uno.3 LIVA'}, {fecha_emision:'2025-06-02'});
cashProrata.indirectTaxRegime='criterio_caja';
const cashExpense=await make('recibida',cashProrata,100,21,21,{deductionUse:'shared',recc:{eligibility:{confirmed:true,censusOptionConfirmed:true,newActivity:true,year:2024,effectiveFrom:'2024-01-01'}}},{fecha_emision:'2024-10-01'});
records.FiscalDeductionAdjustment.push({id:'prior-cash-pro-rata',companyId:'qa',year:2024,kind:'prorata',scopeKey:'activity:'+cashProrata.id,taxKind:'iva',status:'confirmed',delta:0,fiscalDelta:0,noJournalRequired:true,details:{calculation:{percent:67,method:'general'}},reviewedAt:'2024-12-31T12:00:00Z'});
await call('invoiceOperations',{action:'add_payment',company_id:'qa',invoice_id:cashExpense.id,amount:60.5,payment_date:'2025-02-01',method:'transferencia',idempotency_key:'c5-cash-prorata-payment'});
const cashPreview=await call('accountingOperations',{action:'c5_deduction_preview',companyId:'qa',year:2025,kind:'prorata',activityId:cashProrata.id});
assert.equal(cashPreview.calculation.percent,60);assert.equal(cashPreview.delta,2.1);assert.equal(cashPreview.fiscalDelta,-1.47);assert.equal(cashPreview.sourceRows.find(row=>row.invoiceId===cashExpense.id).fiscalProvisionalQuota,14.07);
const cashPost=await call('accountingOperations',{action:'c5_deduction_post',companyId:'qa',year:2025,kind:'prorata',activityId:cashProrata.id,confirmReviewed:true,reason:'Prueba ficticia RECC y cambio de prorrata',expectedFingerprint:cashPreview.fingerprint});
assert.ok(cashPost.journalEntryId);
const cashModel=modelData(2025,'4T',[cashExpense.id]);cashModel.invoicePayments=records.InvoicePayment;cashModel.rawInvoicePayments=records.InvoicePayment;
const crossYear=calculate(cashModel,bounds(2025,'Anual'),'iva',true,{});
assert.equal(crossYear.operations.prorataAdjustment,2.10); // original +3.57 and new -1.47; scope filter below checks per source
const onlyCash={...cashModel,fiscalAdjustments:records.FiscalDeductionAdjustment.filter(row=>row.scopeKey==='activity:'+cashProrata.id)};
const cashAnnual=calculate(onlyCash,bounds(2025,'Anual'),'iva',true,{});
assert.equal(cashAnnual.operations.deductibleQuota,12.60);assert.equal(cashAnnual.operations.prorataAdjustment,-1.47);
const cashQuarter=calculate({...onlyCash,period:'1T'},bounds(2025,'1T'),'iva',false,{previousCompensationBalance:0});assert.equal(cashQuarter.operations.deductibleQuota,7.04);
const cashEntryCount=records.JournalEntry.length;await call('accountingOperations',{action:'c5_deduction_post',companyId:'qa',year:2025,kind:'prorata',activityId:cashProrata.id,confirmReviewed:true,reason:'Reintento ficticio',expectedFingerprint:cashPreview.fingerprint});assert.equal(records.JournalEntry.length,cashEntryCount);
assert.match(reSale.coletilla_fiscal||'',/franquicia fiscal/i);assert.match(retailSale.coletilla_fiscal||'',/comerciante minorista/i);


// Special prorrata is mandatory at a relative 10% excess, including zero special deduction.
const mandatory=activity('mandatory-special','iva','general','prorrata_general',{proRataPercent:50});
await make('emitida',mandatory,100,21,21,{}, {fecha_emision:'2025-03-01'});
await make('emitida',mandatory,100,0,0,{operationType:'exempt_limited',exemptionKey:'IVA_ART_20_SANITARIA',legalBasis:'Art.20.Uno.3 LIVA'},{fecha_emision:'2025-03-02'});
const noRight=await make('recibida',mandatory,100,21,21,{deductionUse:'exclusive_no_right'},{fecha_emision:'2025-03-03'});
const mandatoryBody={companyId:'qa',year:2025,activityId:mandatory.id,kind:'prorata'};
const mandatoryPreview=await call('accountingOperations',{...mandatoryBody,action:'c5_deduction_preview'});
assert.equal(mandatoryPreview.calculation.mandatorySpecial,true);assert.equal(mandatoryPreview.delta,-10.5);
const negative=await call('accountingOperations',{...mandatoryBody,action:'c5_deduction_post',expectedFingerprint:mandatoryPreview.fingerprint,confirmReviewed:true,reason:'Gasto exclusivo sin derecho; general excede especial'});
assert.equal(records.JournalEntryLine.find(row=>row.journalEntryId===negative.journalEntryId&&row.accountCode==='63410000').debit,10.5);
// Explicit sector: direct full right and shared provisional deduction survive the single invoice check.
const sector=activity('sector','iva','general','sector_diferenciado',{proRataPercent:50,sectorId:'QA-C5-S1'});
const direct=await make('recibida',sector,100,21,21,{deductionUse:'exclusive_right'});
const shared=await make('recibida',sector,100,21,21,{deductionUse:'shared'});
assert.equal(direct.deductible_tax_amount,21);assert.equal(shared.deductible_tax_amount,10.5);
// Annual investment: preserve the asset's capitalized non-deductible VAT and original journal.
const investment=activity('investment','iva','general','prorrata_general',{proRataPercent:50,startDate:'2024-01-01'});
const assetInvoice=await make('recibida',investment,10000,21,2100,{deductionUse:'shared'},{fecha_emision:'2024-02-01',revenue_expense_account_code:'21700000'});
const assetId='QA-C5-ASSET';records.AccountingAsset.push({id:assetId,companyId:'qa',name:'Equipo FICTICIO',sourceInvoiceId:assetInvoice.id,acquisitionDate:'2024-02-01',inServiceDate:'2024-02-01'});
const assetBody={companyId:'qa',year:2025,activityId:investment.id,kind:'investment',assetId,initialPercent:50,definitivePercent:70,investmentQualificationConfirmed:true,reason:'Porcentajes definitivos de ensayo contrastados'};
const assetBefore=JSON.stringify(assetInvoice),assetPreview=await call('accountingOperations',{...assetBody,action:'c5_deduction_preview'});
assert.equal(assetPreview.delta,84);
const investmentPost=await call('accountingOperations',{...assetBody,action:'c5_deduction_post',confirmReviewed:true,expectedFingerprint:assetPreview.fingerprint});assert.ok(investmentPost.journalEntryId);assert.equal(JSON.stringify(assetInvoice),assetBefore);
// Concurrent confirmation produces one regularization; stale source changes are rejected.
const originalCount=records.JournalEntry.length;
const concurrent=await Promise.allSettled([call('accountingOperations',{...assetBody,action:'c5_deduction_post',confirmReviewed:true,expectedFingerprint:assetPreview.fingerprint}),call('accountingOperations',{...assetBody,action:'c5_deduction_post',confirmReviewed:true,expectedFingerprint:assetPreview.fingerprint},409)]);
assert.ok(concurrent.some(row=>row.status==='fulfilled'));assert.equal(records.JournalEntry.length,originalCount);
user={...user,status:'suspendido'};await call('accountingOperations',{...assetBody,action:'c5_deduction_preview'},403);delete user.status;
assert.ok(records.JournalEntry.every(j=>j.isBalanced&&Math.abs(j.totalDebit-j.totalCredit)<.01));


const beforeContext=calls;await call('accountingOperations',{action:'c5_deduction_context',companyId:'qa',year:2025});assert.ok(calls-beforeContext<=6,'The asset picker must not load all invoices and journal history');
const origin=records.JournalEntry.find(row=>row.id===pExpense.linked_journal_entry_id),originStatus=origin.status;origin.status='borrador';
await call('accountingOperations',{...pBody,action:'c5_deduction_preview'},422);origin.status=originStatus;
const investmentOrigin=records.JournalEntry.find(row=>row.id===assetInvoice.linked_journal_entry_id),originValidation=investmentOrigin.validationStatus;investmentOrigin.validationStatus='PENDIENTE';
await call('accountingOperations',{...assetBody,action:'c5_deduction_preview'},422);investmentOrigin.validationStatus=originValidation;


// A zero annual adjustment must still persist the definitive percentage for next year's RECC deductions.
const zero=activity('zero-annual','iva','general','prorrata_general',{proRataPercent:50,startDate:'2024-01-01'});
await make('emitida',zero,2000,21,420,{}, {fecha_emision:'2024-06-01'});
await make('emitida',zero,1000,0,0,{operationType:'exempt_limited',exemptionKey:'IVA_ART_20_SANITARIA',legalBasis:'Art.20.Uno.3 LIVA'}, {fecha_emision:'2024-06-02'});
zero.indirectTaxRegime='criterio_caja';
const zeroExpense=await make('recibida',zero,100,21,21,{deductionUse:'shared',recc:{eligibility:{confirmed:true,censusOptionConfirmed:true,newActivity:true,year:2024,effectiveFrom:'2024-01-01'}}},{fecha_emision:'2024-06-03'});
const zeroBody={companyId:'qa',year:2024,activityId:zero.id,kind:'prorata'};
const zeroPreview=await call('accountingOperations',{...zeroBody,action:'c5_deduction_preview'});assert.equal(zeroPreview.delta,0);assert.equal(zeroPreview.calculation.percent,67);assert.equal(zeroPreview.needsPercentageConfirmation,true);
const journalsBeforeZero=records.JournalEntry.length;
const zeroPost=await call('accountingOperations',{...zeroBody,action:'c5_deduction_post',expectedFingerprint:zeroPreview.fingerprint,confirmReviewed:true,reason:'Confirmación anual sin cuotas reconocidas'});assert.equal(zeroPost.noJournalRequired,true);assert.equal(records.JournalEntry.length,journalsBeforeZero);
assert.equal((await call('accountingOperations',{...zeroBody,action:'c5_deduction_preview'})).needsPercentageConfirmation,false);
zero.indirectTaxRegime='general';
const zeroSale=await make('emitida',zero,1000,21,210,{}, {fecha_emision:'2025-06-01'});
const zeroExempt=await make('emitida',zero,1000,0,0,{operationType:'exempt_limited',exemptionKey:'IVA_ART_20_SANITARIA',legalBasis:'Art.20.Uno.3 LIVA'}, {fecha_emision:'2025-06-02'});
const nextZero=await call('accountingOperations',{...zeroBody,year:2025,action:'c5_deduction_preview'});assert.equal(nextZero.delta,0);assert.equal(nextZero.fiscalDelta,-3.57);assert.equal(nextZero.calculation.fiscalCurrent,14.07);
const noExtraJournal=records.JournalEntry.length;
const nextZeroBody={...zeroBody,year:2025,action:'c5_deduction_post',expectedFingerprint:nextZero.fingerprint,confirmReviewed:true,reason:'Ajuste fiscal RECC sin cambio del saldo contable'};
const zeroFiscal=await call('accountingOperations',nextZeroBody);assert.equal(zeroFiscal.noJournalRequired,true);assert.equal(records.JournalEntry.length,noExtraJournal);
const zeroRecords=records.FiscalDeductionAdjustment.length;await call('accountingOperations',nextZeroBody);assert.equal(records.FiscalDeductionAdjustment.length,zeroRecords);
const zeroData={...modelData(2025,'4T',[zeroExpense.id,zeroSale.id,zeroExempt.id]),fiscalAdjustments:records.FiscalDeductionAdjustment.filter(row=>row.scopeKey==='activity:'+zero.id)};
const zeroModel=calculate(zeroData,bounds(2025,'4T'),'iva',false,{previousCompensationBalance:0});assert.equal(zeroModel.operations.prorataAdjustment,-3.57);assert.equal(zeroModel.operations.deductibleQuota,10.5);


const companyLock=records.Company[0];companyLock.fiscal_adjustment_lock_token='QA-C5-LOCK';companyLock.fiscal_adjustment_lock_started_at=new Date().toISOString();
user={...user,role:'user'};assert.equal((await call('accountingOperations',{action:'c5_deduction_context',companyId:'qa',year:2025})).lock,undefined);
await call('accountingOperations',{action:'c5_deduction_recover_lock',companyId:'qa',expectedToken:'QA-C5-LOCK',processStopped:true,reason:'Ensayo'},403);
user={...user,role:'admin'};await call('accountingOperations',{action:'c5_deduction_recover_lock',companyId:'qa',expectedToken:'QA-C5-LOCK',processStopped:true,reason:'Ensayo'},422);
companyLock.fiscal_adjustment_lock_started_at=new Date(Date.now()-660000).toISOString();const lockContext=await call('accountingOperations',{action:'c5_deduction_context',companyId:'qa',year:2025});assert.equal(lockContext.lock.recoverable,true);
await call('accountingOperations',{action:'c5_deduction_recover_lock',companyId:'qa',expectedToken:'stale-token',processStopped:true,reason:'Ensayo'},422);
const beforeRecover=records.JournalEntry.length;const recovered=await call('accountingOperations',{action:'c5_deduction_recover_lock',companyId:'qa',expectedToken:lockContext.lock.token,processStopped:true,reason:'Proceso ficticio detenido comprobado'});assert.equal(recovered.success,true);assert.equal(companyLock.fiscal_adjustment_lock_token,'');assert.equal(records.JournalEntry.length,beforeRecover);

console.log(JSON.stringify({ok:true,sourceToLedgerAndModels:true,REPEP:true,retail:true,exemptions:true,implicitIgic:true,dua:true,prorata:true,annualAdjustmentIdempotent:true,originalInvoicesAndTaxLinesUnchanged:true,normalUserCannotPost:true,foreignTenantDenied:true,official303And390Boxes:true,entries:records.JournalEntry.length,externalCalls:0,realWrites:0,calls}));


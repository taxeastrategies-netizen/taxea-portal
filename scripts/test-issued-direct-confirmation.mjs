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
  async create(payload){calls++;if(failEntity===name){failEntity='';throw new Error('Fallo QA '+name);}const row={id:name+'-'+(++seq),created_date:new Date(Date.UTC(2026,9,12,0,0,seq)).toISOString(),...payload};(records[name] ||= []).push(row);return row;},
  async update(id,patch){calls++;const index=(records[name] || []).findIndex(row=>row.id===id);if(index<0)throw new Error('Missing '+name+':'+id);return records[name][index]={...records[name][index],...patch};},
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

Object.assign(records.FiscalProfile[0],{entityType:'autonomo',mainTerritory:'canarias',indirectTaxDefault:'igic',repepStatus:'incluido',repepEffectiveFrom:'2026-01-01',repepPreviousTurnover:12000,repepCensusConfirmed:true});
Object.assign(records.FiscalActivity[0],{name:'Servicios ficticios',indirectTax:'igic',indirectTaxRegime:'pequeno_empresario_igic',deductionRight:'sin_derecho',incomeDefaultTreatment:'exempt_limited',exemptionKey:'IGIC_REPEP',exemptionLegalBasis:'',automationLevel:'asistido'});
const invoice={tipo:'emitida',numero_factura:'QA-DIRECT-REPEP-1',fecha_emision:'2026-11-02',cliente_nombre:'CLIENTE FICTICIO',cliente_nif:'B12345674',base_imponible:69.99,tipo_iva:0,cuota_iva:0,total_factura:69.99,retencion_irpf:0,importe_retencion:0,fiscal_activity_id:'fa'};
const request={action:'create_invoice',company_id:'qa',idempotency_key:'qa-repep-direct-1',invoice};
const first=await call('invoiceOperations',request);
assert.equal(first.invoice.estado_contable,'contabilizada');assert.equal(first.review_required,false);assert.equal(first.invoice.fiscal_review_status,'validado');
assert.match(first.invoice.fiscal_legal_basis,/90/);assert.match(first.invoice.coletilla_fiscal,/exención franquicia fiscal/i);
assert.match(first.invoice.qr_integrity_hash,/^[A-F0-9]{64}$/);assert.match(first.invoice.qr_url,/ValidarQRNoVerifactu/);
assert.equal(first.invoice.fiscal_advisor_decision.approvalOrigin,'issuer');assert.equal(first.invoice.fiscal_reviewed_by,user.email);
const count=records.JournalEntry.length,amounts=JSON.stringify([first.invoice.numero_factura,first.invoice.fecha_emision,first.invoice.base_imponible,first.invoice.cuota_iva,first.invoice.total_factura]);
const again=await call('invoiceOperations',request);assert.equal(again.invoice.id,first.invoice.id);assert.equal(records.JournalEntry.length,count);assert.equal(again.invoice.qr_integrity_hash,first.invoice.qr_integrity_hash);
const second=await call('invoiceOperations',{...request,idempotency_key:'qa-repep-direct-2',invoice:{...invoice,numero_factura:'QA-DIRECT-REPEP-2'}});
assert.notEqual(second.invoice.qr_integrity_hash,first.invoice.qr_integrity_hash);
// Resumen censal nuevo sin REPEP y actividad REPEP histórica: no reescribir el perfil.
Object.assign(records.FiscalProfile[0],{ruleSetVersion:'taxea-fiscal-es-2026.11.02-c5',repepStatus:'no_aplica',repepEffectiveFrom:null,repepPreviousTurnover:null,repepCensusConfirmed:false});
records.FiscalActivity[0].ruleSetVersion='taxea-fiscal-es-2026.09.09-v1';
const censusBefore=JSON.stringify(records.FiscalProfile[0]);
const legacyOwn=await call('invoiceOperations',{...request,idempotency_key:'qa-legacy-census',invoice:{...invoice,numero_factura:'QA-LEGACY-CENSUS'}});
assert.equal(legacyOwn.invoice.estado_contable,'contabilizada');assert.equal(JSON.stringify(records.FiscalProfile[0]),censusBefore);
assert.equal(JSON.parse(legacyOwn.invoice.fiscal_c5_data).repepActive,true);
assert.equal(JSON.parse(legacyOwn.invoice.fiscal_c5_data).censusStatus,'issuer_choice_pending_census');
records.FiscalProfile[0].repepStatus='excluido';const entriesBeforeExclusion=records.JournalEntry.length;
await call('invoiceOperations',{...request,idempotency_key:'qa-excluded-repep',invoice:{...invoice,numero_factura:'QA-EXCLUDED'}},422);
assert.equal(records.JournalEntry.length,entriesBeforeExclusion);records.FiscalProfile[0].repepStatus='no_aplica';
// No se exige aprobación profesional del perfil para la responsabilidad del emisor.
records.FiscalProfile[0].profileStatus='pendiente_revision';
await call('invoiceOperations',{...request,idempotency_key:'qa-repep-pending-profile',invoice:{...invoice,numero_factura:'QA-PROFILE-OWN'}});
assert.equal(records.FiscalProfile[0].profileStatus,'pendiente_revision');
const rejectedExpense=await call('invoiceOperations',{...request,idempotency_key:'qa-received-pending',invoice:{...invoice,tipo:'recibida',numero_factura:'QA-EXPENSE-PENDING',fecha_recepcion:'2026-11-02'}},422);
assert.match(rejectedExpense.error,/asesor/);
records.FiscalProfile[0].profileStatus='validado_asesor';
// Recuperación por el botón contable: mismo ID, importes y un asiento, sin segunda revisión.
const orphan=await entity('Invoice').create({...invoice,id:'qa-orphan-issued',company_id:'qa',numero_factura:'QA-ORPHAN',fiscal_review_status:'pendiente_revision',estado_contable:'pendiente',accounting_migration_hold:true,accounting_migration_hold_reason:'SOURCE_CHECK_PENDING'});
const recovered=await call('accountingOperations',{action:'post_invoice',companyId:'qa',invoiceId:orphan.id});assert.equal(recovered.success,true);assert(recovered.entryId);
assert.equal((await entity('Invoice').get(orphan.id)).estado_contable,'contabilizada');
await call('invoiceOperations',{action:'mark_accounting_review',company_id:'qa',invoice_id:first.invoice.id},409);
const financialBefore=records.JournalEntry.length;
user={id:'alien',email:'alien@test.invalid',role:'user',data:{company_id:'foreign'}};
await call('invoiceOperations',{action:'confirm_source_invoice',company_id:'qa',invoice_id:first.invoice.id},403);assert.equal(records.JournalEntry.length,financialBefore);
assert.equal(JSON.stringify([first.invoice.numero_factura,first.invoice.fecha_emision,first.invoice.base_imponible,first.invoice.cuota_iva,first.invoice.total_factura]),amounts);
assert.equal(records.AccountingAccount.find(x=>x.id==='expense-history').code,'60000008');
for(const entry of records.JournalEntry.filter(x=>x.status==='confirmado'))assert(Math.abs(records.JournalEntryLine.filter(x=>x.journalEntryId===entry.id).reduce((sum,x)=>sum+Number(x.debit||0)-Number(x.credit||0),0))<0.011);
console.log(JSON.stringify({ok:true,normalUser:true,repepMissingLegalRecovered:true,directOwnConfirmation:true,profileNotPromoted:true,receivedAdvisorRulePreserved:true,retryNoDuplicate:true,uniqueHash:true,accountingButtonRecovered:true,crossTenantDenied:true,realDataWrites:0,externalCalls:0}));

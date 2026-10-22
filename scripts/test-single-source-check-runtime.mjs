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
for(const name of ['fiscalOperations','invoiceOperations','approveOcrDocument','ocrDocumentIntake']){
  const entry=name==='ocrDocumentIntake' ? process.env.OCR_INTAKE_ENTRY : name==='approveOcrDocument' ? process.env.OCR_APPROVE_ENTRY : '';
  const build=await esbuild.build({entryPoints:[entry || 'base44/functions/'+name+'/entry.ts'],bundle:true,write:false,platform:'node',format:'cjs',
    plugins:[{name:'stub',setup(b){b.onResolve({filter:/^npm:@base44/},()=>({path:'sdk',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const createClientFromRequest=()=>globalThis.__client;',loader:'js'}));}}]});
  vm.runInContext(build.outputFiles[0].text,vm.createContext({Response,Request,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,console,Date,
    setTimeout:fn=>{fn();return 0;},clearTimeout(){},__client:client,Deno:{serve:fn=>{handlers[name]=fn;}}}));
}
async function api(name,body){return handlers[name](new Request('https://qa.invalid/'+name,{method:'POST',body:JSON.stringify(body)}));}
async function call(name,body,status=200){const response=await api(name,body),data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
const {sourceDecision}=await import('../base44/functions/fiscalOperations/sourceCheck.mjs');
assert.throws(()=>sourceDecision({tipo:'recibida',base_imponible:100,fecha_emision:'2026-07-12',cuota_iva:7,retencion_irpf:0,tipo_iva:7},
  {taxKind:'iva',regime:'general'},records.FiscalActivity[0],records.FiscalProfile[0],false),/asesor/);
const makeDoc=async(id,{base=100,rate=7,quota=7,total=107,company='qa',type='expense_invoice',rect=false}={})=>{
  const ex={numero_factura:id,fecha:'2026-07-12',base_imponible:base,tipo_impuesto:rate,cuota_impuesto:quota,total,
    proveedor:'Proveedor QA',nif_proveedor:'B98765432',es_rectificativa:rect};
  return await entity('OcrInvoiceDocument').create({id,company_id:company,documentType:type,status:'review_required',extractedData:JSON.stringify(ex),auditTrail:[]});
};
const form=doc=>{const ex=JSON.parse(doc.extractedData);return {numero_factura:ex.numero_factura,fecha:ex.fecha,fecha_recepcion:'2026-07-13',
  proveedor_cliente:ex.proveedor,nif_proveedor:ex.nif_proveedor,base_imponible:ex.base_imponible,tipo_impuesto:ex.tipo_impuesto,
  cuota_impuesto:ex.cuota_impuesto,total:ex.total,retencion_irpf:0,importe_retencion:0,es_rectificativa:ex.es_rectificativa,
  fiscal_activity_id:'fa',cuenta_contable_manual:'60000008'};};
const approve=doc=>call('approveOcrDocument',{docId:doc.id,invoiceType:'recibida',form:form(doc),extractedData:JSON.parse(doc.extractedData)});
// Reset/reject and approval share the real company lease. A stale review form
// must not create an invoice after its document returned to pending/rejected.
const lifecycle=await makeDoc('lifecycle-qa'), savedForm=form(lifecycle), savedData=JSON.parse(lifecycle.extractedData);
const stateAction=action=>call('ocrDocumentIntake',{action,companyId:'qa',docId:lifecycle.id});
const staleApproval=()=>call('approveOcrDocument',{docId:lifecycle.id,invoiceType:'recibida',form:savedForm,extractedData:savedData},409);
const beforeLifecycle={invoices:records.Invoice.length,journals:records.JournalEntry.length};
await stateAction('return_to_pending');assert.equal((await entity('OcrInvoiceDocument').get(lifecycle.id)).status,'pending');
await staleApproval();
const lifecycleRetry=await stateAction('analysis_start');
await staleApproval();
await call('ocrDocumentIntake',{action:'analysis_complete',companyId:'qa',docId:lifecycle.id,
  analysisStartedAt:lifecycleRetry.document.analysisStartedAt,extractedData:savedData});
await stateAction('reject');await staleApproval();
assert.equal(records.Invoice.length,beforeLifecycle.invoices);assert.equal(records.JournalEntry.length,beforeLifecycle.journals);
const positive=await approve(await makeDoc('positive'));
assert.equal(positive.success,true);let invoice=await entity('Invoice').get(positive.invoiceId);
assert.equal(invoice.estado_contable,'contabilizada');assert.equal(invoice.deductible_tax_amount,0);
assert.equal(invoice.non_deductible_tax_amount,7);assert.equal(invoice.total_factura,107);
assert.equal(records.InvoiceTaxLine.filter(row=>row.invoiceId===invoice.id).length,1);
assert.equal(records.JournalEntryLine.find(row=>row.journalEntryId===positive.journalEntryId&&row.accountCode==='60000008').debit,107);
const snapshot=JSON.stringify([records.Invoice.length,records.InvoiceTaxLine.length,records.JournalEntry.length,records.JournalEntryLine.length]);
await approve(await entity('OcrInvoiceDocument').get('positive'));
assert.equal(JSON.stringify([records.Invoice.length,records.InvoiceTaxLine.length,records.JournalEntry.length,records.JournalEntryLine.length]),snapshot);
const credit=await approve(await makeDoc('credit',{base:-45.28,rate:7,quota:-3.17,total:-48.45,rect:true}));
assert.equal((await entity('Invoice').get(credit.invoiceId)).non_deductible_tax_amount,-3.17);
const zero=await approve(await makeDoc('zero',{base:128.23,rate:0,quota:0,total:128.23}));
assert.equal((await entity('Invoice').get(zero.invoiceId)).estado_contable,'contabilizada');
// Venta minorista de prueba: exención propia y QR/hash al aprobar en OCR de emitidas.
const issuedDoc=await makeDoc('minorista-sale',{base:200,rate:0,quota:0,total:200,type:'income_invoice'});
const issuedForm={numero_factura:'minorista-sale',fecha_emision:'2026-07-12',cliente_nombre:'Cliente QA',
  cliente_nif:'B12345674',base_imponible:200,tipo_iva:0,cuota_iva:0,total_factura:200,
  retencion_irpf:0,importe_retencion:0,fiscal_activity_id:'fa'};
const issued=await call('approveOcrDocument',{docId:issuedDoc.id,invoiceType:'emitida',form:issuedForm});
const issuedInv=await entity('Invoice').get(issued.invoiceId);
assert.equal(issuedInv.fiscal_treatment,'exempt_limited');assert.equal(issuedInv.fiscal_exemption_key,'IGIC_COMERCIANTE_MINORISTA');
assert.equal(issuedInv.estado_contable,'contabilizada');assert.match(issuedInv.qr_integrity_hash,/^[a-f0-9]{64}$/i);
const issuedHash=issuedInv.qr_integrity_hash;
await call('approveOcrDocument',{docId:issuedDoc.id,invoiceType:'emitida',form:issuedForm});
assert.equal((await entity('Invoice').get(issuedInv.id)).qr_integrity_hash,issuedHash);
// Ya existe factura del doble check anterior: reutilizar exactamente ese ID.
const legacy=await makeDoc('legacy');
const saved=await entity('Invoice').create({company_id:'qa',tipo:'recibida',numero_factura:'legacy',fecha_emision:'2026-07-12',fecha_recepcion:'2026-07-13',
  base_imponible:100,tipo_iva:7,cuota_iva:7,total_factura:107,retencion_irpf:0,importe_retencion:0,proveedor_nombre:'Proveedor QA',proveedor_nif:'B98765432',
  fiscal_activity_id:'fa',ocr_document_id:legacy.id,fiscal_review_status:'pendiente_revision',accounting_migration_hold:true,accounting_migration_hold_reason:'FISCAL_ADVISOR_REVIEW_PHASE1'});
await entity('OcrInvoiceDocument').update(legacy.id,{linkedInvoiceId:saved.id});
const before=records.Invoice.length;
const recovered=await approve(legacy);
assert.equal(recovered.invoiceId,saved.id);assert.equal(records.Invoice.length,before);
assert.equal((await entity('OcrInvoiceDocument').get(legacy.id)).status,'accounted');
// Fallo parcial de línea fiscal: siguiente check completa sin otra factura.
const failed=await makeDoc('taxline-retry');failEntity='InvoiceTaxLine';
await call('approveOcrDocument',{docId:failed.id,invoiceType:'recibida',form:form(failed)},500);
const failedId=(await entity('OcrInvoiceDocument').get(failed.id)).linkedInvoiceId, count=records.Invoice.length;
const retry=await approve(failed);assert.equal(retry.invoiceId,failedId);assert.equal(records.Invoice.length,count);
assert.equal(records.InvoiceTaxLine.filter(row=>row.invoiceId===failedId).length,1);
// El límite entre empresas sigue siendo una prohibición real.
const foreign=await makeDoc('foreign',{company:'foreign'});const guarded=records.Invoice.length;
await call('approveOcrDocument',{docId:foreign.id,invoiceType:'recibida',form:form(foreign)},403);
assert.equal(records.Invoice.length,guarded);
// Manual sin confirm_fiscal_review: emisión directa y hash estable.
Object.assign(records.FiscalActivity[0],{indirectTax:'iva',indirectTaxRegime:'general',deductionRight:'pleno',incomeDefaultTreatment:'subject_taxed',expenseDefaultTreatment:'subject_taxed'});
const manualBody={action:'create_invoice',company_id:'qa',idempotency_key:'qa-manual-one',invoice:{tipo:'emitida',numero_factura:'QA-MANUAL',fecha_emision:'2026-07-14',
  cliente_nombre:'Cliente QA',cliente_nif:'B12345674',base_imponible:100,tipo_iva:21,cuota_iva:21,total_factura:121,retencion_irpf:0,importe_retencion:0,fiscal_activity_id:'fa'}};
const manual=await call('invoiceOperations',manualBody);assert.equal(manual.invoice.estado_contable,'contabilizada');assert.equal(manual.review_required,false);
assert.match(manual.invoice.qr_integrity_hash,/^[a-f0-9]{64}$/i);const hash=manual.invoice.qr_integrity_hash;
const manualRetry=await call('invoiceOperations',manualBody);assert.equal(manualRetry.invoice.id,manual.invoice.id);assert.equal(manualRetry.invoice.qr_integrity_hash,hash);
// Servicios UE: autorrepercusión separada y deuda del proveedor inalterada.
const intra=await makeDoc('intra',{base:100,rate:0,quota:0,total:100});
const intraForm={...form(intra),fiscal_criteria:{taxKind:'iva',regime:'general',deductionCategory:'intra_services',selfAssessmentRate:21}};
const intraResult=await call('approveOcrDocument',{docId:intra.id,invoiceType:'recibida',form:intraForm});
const intraInv=await entity('Invoice').get(intraResult.invoiceId);
assert.equal(intraInv.total_factura,100);assert.equal(intraInv.cuota_iva,0);assert.equal(intraInv.self_assessed_tax_amount,21);
assert.equal(records.InvoiceTaxLine.find(row=>row.invoiceId===intraInv.id).deductionCategory,'intra_services');
// Prorrata sin otra bandeja.
records.FiscalActivity[0].deductionRight='prorrata_especial';records.FiscalActivity[0].proRataPercent=40;
const pro=await makeDoc('prorrata',{rate:21,quota:21,total:121});
const proResult=await call('approveOcrDocument',{docId:pro.id,invoiceType:'recibida',form:{...form(pro),fiscal_criteria:{deductionUse:'shared'}}});
assert.equal((await entity('Invoice').get(proResult.invoiceId)).deductible_tax_amount,8.4);
// Borradores manuales heredados, sin OCR asociado, se completan en el mismo módulo OCR.
records.FiscalActivity[0].deductionRight='pleno';
const orphan=await entity('Invoice').create({company_id:'qa',tipo:'recibida',numero_factura:'orphan',
  fecha_emision:'2026-07-15',fecha_recepcion:'2026-07-16',proveedor_nombre:'Proveedor QA',
  proveedor_nif:'B98765432',base_imponible:100,tipo_iva:21,cuota_iva:21,total_factura:121,
  retencion_irpf:0,importe_retencion:0,fiscal_review_status:'pendiente_revision',
  fiscal_activity_id:'fa',accounting_migration_hold:true,accounting_migration_hold_reason:'FISCAL_ADVISOR_REVIEW_PHASE1'});
const {loadOcrWorkspace,approveWorkspaceDocument,invoiceSourceData}=await import('../src/lib/ocrWorkspace.mjs');
const workspace=await loadOcrWorkspace(client,'qa','expense_invoice');
const virtual=workspace.find(row=>row.invoiceOnly && row.invoiceSource.id===orphan.id);
assert.ok(virtual);assert.equal(virtual.status,'review_required');
const original=invoiceSourceData(orphan),invoiceCountBefore=records.Invoice.length;
const orphanResult=await approveWorkspaceDocument(client,'qa',virtual,{numero_factura:original.numero_factura,
  fecha:original.fecha,fecha_recepcion:original.fecha_recepcion,base_imponible:original.base_imponible,
  tipo_impuesto:original.tipo_impuesto,cuota_impuesto:original.cuota_impuesto,total:original.total,
  fiscal_activity_id:'fa',fiscal_criteria:{taxKind:'iva',regime:'general',operationType:'subject_taxed'}},'recibida');
assert.equal(orphanResult.invoiceId,orphan.id);assert.equal(records.Invoice.length,invoiceCountBefore);
assert.equal((await entity('Invoice').get(orphan.id)).estado_contable,'contabilizada');
for(const entry of records.JournalEntry.filter(row=>row.status==='confirmado')){
  const lines=records.JournalEntryLine.filter(row=>row.journalEntryId===entry.id);
  assert.ok(Math.abs(lines.reduce((sum,row)=>sum+Number(row.debit || 0)-Number(row.credit || 0),0))<0.011);
}
assert.equal(records.AccountingAccount.find(row=>row.id==='expense-history').code,'60000008');
console.log(JSON.stringify({ok:true,workflow:'single-source-check',normalUser:true,invoiceCount:records.Invoice.length,confirmedEntries:records.JournalEntry.filter(row=>row.status==='confirmado').length,
  checks:['minorista taxed/zero/credit','source amounts preserved','existing subaccount preserved','idempotent retry','legacy same invoice recovered','tax-line failure recovered',
  'tenant denied','manual direct with stable QR hash','minorista issued OCR QR/hash','orphan invoice appears in OCR and recovers','intra services self-assessment','special prorrata','all journals balanced'],apiCalls:calls},null,2));



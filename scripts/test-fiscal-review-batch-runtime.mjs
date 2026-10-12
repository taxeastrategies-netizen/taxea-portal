import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';
import { fiscalReviewBatch } from '../base44/functions/fiscalOperations/fiscalReviewBatch.mjs';
import { commonReviewCriteria } from '../base44/functions/fiscalOperations/advisorReview.mjs';
assert.equal(fs.readFileSync('base44/functions/fiscalOperations/advisorReview.mjs','utf8'),fs.readFileSync('base44/functions/invoiceOperations/advisorReview.mjs','utf8'),'Review filter copies must remain identical');
const clone=value=>JSON.parse(JSON.stringify(value));
const match=(row,query)=>Object.entries(query||{}).every(([key,val])=>{
  if(key==='$or') return val.some(q=>match(row,q));
  if(val&&typeof val==='object') return Object.entries(val).every(([op,v])=>op==='$in'?v.includes(row[key]):op==='$ne'?row[key]!==v:op==='$exists'?(row[key]!==undefined)===v:op==='$gte'?row[key]>=v:op==='$lte'?row[key]<=v:row[key]===val);
  return row[key]===val;
});
let seq=0,writes=0,user={role:'admin',email:'advisor@test.invalid',data:{company_id:'a'}};
const records={Company:[{id:'a',owner_email:'owner@test.invalid'},{id:'b',owner_email:'other@test.invalid'}],
  FiscalProfile:[{id:'p',company_id:'a',active:true,profileStatus:'validado_asesor',defaultVatRate:21,effectiveFrom:'2026-01-01'}],
  FiscalActivity:[{id:'act',company_id:'a',active:true,indirectTax:'iva',indirectTaxRegime:'general',defaultTaxRate:21,deductionRight:'pleno',expenseDefaultTreatment:'subject_taxed',automationLevel:'automatico'}]};
let failChunkAck=false,failJobAck=false;
const entities=new Proxy({}, {get:(_,name)=>({
  async get(id){return clone((records[name]||[]).find(row=>row.id===id)||null);},
  async filter(query,sort,limit=5000,skip=0){
    let rows=(records[name]||[]).filter(row=>match(row,query));
    if(sort){const desc=sort.startsWith('-'),key=sort.replace(/^-/,'');rows=[...rows].sort((a,b)=>String(a[key]??'').localeCompare(String(b[key]??''))*(desc?-1:1));}
    return clone(rows.slice(skip,skip+limit));
  },
  async create(data){writes++;const row={id:name+'-'+(++seq),created_date:'v'+seq,updated_date:'v'+seq,...clone(data)};(records[name]||=[]).push(row);return clone(row);},
  async bulkCreate(data){const rows=[];for(const item of data) rows.push(await entities[name].create(item));return rows;},
  async update(id,data){
    if(name==='FiscalReviewBatch'&&data.processed&&failJobAck){failJobAck=false;throw new Error('Synthetic job acknowledgement lost');}
    writes++;const row=(records[name]||[]).find(row=>row.id===id);if(!row) throw new Error('Missing '+name);
    Object.assign(row,clone(data),{updated_date:'v'+(++seq)});
    if(name==='FiscalReviewBatchChunk'&&failChunkAck){failChunkAck=false;throw new Error('Synthetic chunk acknowledgement lost');}
    return clone(row);
  },
  async updateMany(query,ops){const rows=(records[name]||[]).filter(row=>match(row,query));for(const row of rows){writes++;Object.assign(row,clone(ops.$set),{updated_date:'v'+(++seq)});}return {updated:rows.length};}
})});
const svc={entities},client={auth:{me:async()=>user},asServiceRole:svc,functions:{}};
async function bundle(file,extra={}) {
  const built=await esbuild.build({entryPoints:[path.resolve(file)],bundle:true,write:false,platform:'node',format:'cjs',
    plugins:[{name:'sdk-test',setup(b){b.onResolve({filter:/^npm:@base44/},()=>({path:'sdk',namespace:'test'}));
      b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const createClientFromRequest=()=>globalThis.__client',loader:'js'}));}}]});
  let handler;const mod={exports:{}};
  const ctx=vm.createContext({console,Request,Response,URL,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,Date,
    setTimeout:fn=>{fn();return 0;},clearTimeout(){},__client:client,module:mod,exports:mod.exports,
    Deno:{serve:fn=>{handler=fn;},env:{get:()=>''}},...extra});
  vm.runInContext(built.outputFiles[0].text,ctx);
  return {handler,exports:mod.exports};
}
const fiscal=(await bundle('base44/functions/fiscalOperations/entry.ts')).handler;
async function call(body){const response=await fiscal(new Request('https://test.invalid/fiscal',{method:'POST',body:JSON.stringify({companyId:'a',...body})}));return {status:response.status,...await response.json()};}
const inv=(id,base=100)=>({id,company_id:'a',tipo:'recibida',numero_factura:id,fecha_emision:'2026-04-01',fecha_recepcion:'2026-04-02',created_date:'2026-'+id,updated_date:'initial',
  accounting_migration_hold:true,accounting_migration_hold_reason:'FISCAL_ADVISOR_REVIEW_PHASE1',fiscal_review_status:'pendiente_revision',
  base_imponible:base,tipo_iva:0,cuota_iva:0,total_factura:base,importe_retencion:0,
  proveedor_nombre:'Proveedor ficticio',proveedor_nif:'DE-TEST',revenue_expense_account_code:'62910007',qr_integrity_hash:'UNCHANGED'});
records.Invoice=[inv('intra')];
const criteria={activityId:'act',taxKind:'iva',regime:'general',operationType:'subject_taxed',deductionCategory:'intra_services',taxRate:21,deductiblePercent:100};
const before=writes;
const preview=await call({action:'save_invoice_tax_line',invoiceId:'intra',...criteria,confirmReviewed:false});
assert.equal(preview.mode,'preview');assert.equal(writes,before,'Analysis must be read-only');
const saved=await call({action:'save_invoice_tax_line',invoiceId:'intra',...criteria,confirmReviewed:true});
assert.equal(saved.mode,'saved',JSON.stringify(saved));assert.equal(saved.evaluation.operationType,'intra_eu_acquisition');
assert.equal(saved.evaluation.taxAmount,21);assert.equal(records.Invoice[0].total_factura,100);assert.equal(records.Invoice[0].cuota_iva,0);
assert.equal(records.Invoice[0].self_assessed_tax_amount,21);assert.equal(records.InvoiceTaxLine[0].quota,21);
assert.equal(records.InvoiceTaxLine[0].deductionCategory,'intra_services');assert.equal(records.Invoice[0].qr_integrity_hash,'UNCHANGED');
assert(records.InvoiceTaxLine[0].manualOverrideReason.includes('advisor@test.invalid'));
assert.deepEqual(saved.evaluation.modelImpact,['349','303']);
records.AccountingAccount=[{id:'historical',companyId:'a',code:'41000077',name:'Proveedor ficticio',nif:'DETEST',status:'activa'}];
records.CounterpartyFiscalProfile=[{id:'cp',company_id:'a',taxId:'DETEST',accountingRole:'acreedor',accountingAccountId:'historical',accountingAccountCode:'41000077'}];
const engine=(await bundle('base44/functions/accountingOperations/accountingEngine.ts')).exports;
const proposal=await engine.buildInvoicePosting(svc,'a',clone(records.Invoice[0]));
assert.equal(proposal.counterparty.account.id,'historical');
records.AccountingAccount.push({id:'collision',companyId:'a',code:'41000077',name:'Otro proveedor',nif:'OTHER',status:'activa',created_date:'z'});
const collisionProposal=await engine.buildInvoicePosting(svc,'a',clone(records.Invoice[0]));
assert.equal(collisionProposal.counterparty.account.id,'historical','El código antiguo de otro NIF no puede sustituir al vínculo del perfil.');
records.CounterpartyFiscalProfile[0].accountingAccountId='collision';
const recoveredProposal=await engine.buildInvoicePosting(svc,'a',clone(records.Invoice[0]));
assert.equal(recoveredProposal.counterparty.account.id,'historical','El vínculo inválido debe recuperarse solo por NIF inequívoco.');
records.AccountingAccount[0].nif='OTHER-TWO';
await assert.rejects(()=>engine.buildInvoicePosting(svc,'a',clone(records.Invoice[0])),/ambigua|otro NIF/);
records.AccountingAccount[0].nif='DETEST';
const amount=(code,side)=>proposal.lines.filter(row=>row.accountCode===code).reduce((s,row)=>s+row[side],0);
assert.equal(amount('41000077','credit'),100);assert.equal(amount('62910007','debit'),100);
assert.equal(amount('47200000','debit'),21);assert.equal(amount('47700000','credit'),21);
const partial={...records.Invoice[0],deductible_tax_amount:10.5,non_deductible_tax_amount:10.5};
const partialProposal=await engine.buildInvoicePosting(svc,'a',partial);
assert.equal(partialProposal.lines.find(row=>row.accountCode==='62910007').debit,110.5);
assert.equal(partialProposal.lines.find(row=>row.accountCode==='47200000').debit,10.5);
assert.equal(partialProposal.lines.reduce((s,row)=>s+row.debit-row.credit,0),0);
user={role:'user',email:'owner@test.invalid',data:{company_id:'a'}};
const userBefore=writes;
assert.equal((await call({action:'save_invoice_tax_line',invoiceId:'intra',...criteria,confirmReviewed:true})).status,403);
assert.equal((await call({action:'create_review_batch',allFiltered:true,criteria,requestId:'user',confirmReviewed:true})).status,403);
assert.equal(writes,userBefore);
user={role:'advisor',email:'not-assigned@test.invalid'};
assert.equal((await call({action:'review_context'})).status,403);
user={role:'admin',email:'advisor@test.invalid'};
assert.equal((await call({action:'save_invoice_tax_line',companyId:'b',invoiceId:'intra',...criteria,confirmReviewed:true})).status,422);
assert.equal(writes,userBefore);
const selection=commonReviewCriteria({...criteria,base:999,total:999,recc:{originalInvoiceId:'do-not-copy'},specialInputs:{payments:['do-not-copy']},applyTaxRate:true});
assert(!('base'in selection)&&!('recc'in selection)&&!('specialInputs'in selection));
records.Invoice=Array.from({length:1203},(_,i)=>inv('bulk-'+String(i).padStart(5,'0'),100+i));
records.Invoice.push({...inv('foreign'),company_id:'b'}, {...inv('annulled'),anulada:true});
const journals=new Map();let journalCount=0,saveCount=0,failOne=true;
client.functions.invoke=async(name,body)=>{
  assert.equal(name,'invoiceOperations');
  if(body.invoice_id==='bulk-00002'&&failOne){failOne=false;throw new Error('Synthetic posting failure');}
  if(!journals.has(body.invoice_id)){journals.set(body.invoice_id,'journal-'+(++journalCount));}
  await entities.Invoice.update(body.invoice_id,{linked_journal_entry_id:journals.get(body.invoice_id),accounting_migration_hold_reason:'',accounting_migration_hold:false});
  return {data:{ok:true,invoice:await entities.Invoice.get(body.invoice_id)}};
};
const context={svc,base44:client,companyId:'a',user,save:async(input,batchId)=>{
  saveCount++;const invoice=await entities.Invoice.get(input.invoiceId);
  await entities.Invoice.update(invoice.id,{fiscal_review_status:'validado',fiscal_review_batch_id:batchId});
  return Response.json({success:true,mode:'saved'});
}};
const job=(await fiscalReviewBatch(context,{action:'create_review_batch',allFiltered:true,criteria:{...criteria,applyTaxRate:true},requestId:'1203',confirmReviewed:true})).batch;
assert.equal(job.total,1203);assert.equal(records.FiscalReviewBatchChunk.length,7);
assert.equal((await fiscalReviewBatch(context,{action:'create_review_batch',allFiltered:true,criteria,requestId:'1203',confirmReviewed:true})).batch.id,job.id);
failChunkAck=true;
await assert.rejects(()=>fiscalReviewBatch(context,{action:'process_review_batch',batchId:job.id}),/acknowledgement/);
failJobAck=true;
await assert.rejects(()=>fiscalReviewBatch(context,{action:'process_review_batch',batchId:job.id}),/acknowledgement/);
let result;
for(let i=0;i<1210;i++){
  result=await fiscalReviewBatch(context,{action:'process_review_batch',batchId:job.id});
  if(result.batch.status==='completed') break;
}
assert.equal(result.batch.processed,1203);assert.equal(result.batch.succeeded,1202);assert.equal(result.batch.failed,1);
assert.equal(journalCount,1202);assert.equal(saveCount,1203);assert.equal(journals.has('foreign'),false);
const doneSaves=saveCount;
await fiscalReviewBatch(context,{action:'process_review_batch',batchId:job.id});assert.equal(saveCount,doneSaves);
const results=(await fiscalReviewBatch(context,{action:'get_review_batch',batchId:job.id})).results;
assert(results.some(row=>row.invoice_id==='bulk-00002'&&row.status==='failed'));
const retry=(await fiscalReviewBatch(context,{action:'create_review_batch',invoiceIds:['bulk-00002'],criteria,requestId:'retry',confirmReviewed:true})).batch;
await fiscalReviewBatch(context,{action:'process_review_batch',batchId:retry.id});
assert.equal(journalCount,1203);assert.equal(saveCount,1204);
const changed=inv('changed');records.Invoice.push(changed);
const changedJob=(await fiscalReviewBatch(context,{action:'create_review_batch',invoiceIds:['changed'],criteria,requestId:'changed',confirmReviewed:true})).batch;
await entities.Invoice.update('changed',{concepto:'Edited after snapshot'});
const changedResult=await fiscalReviewBatch(context,{action:'process_review_batch',batchId:changedJob.id});
assert.equal(changedResult.batch.failed,1);assert.equal(journals.has('changed'),false);
await assert.rejects(()=>fiscalReviewBatch({...context,companyId:'b'},{action:'get_review_batch',batchId:job.id}),/no accesible/);
records.Invoice.push(inv('locked'));
const lockedJob=(await fiscalReviewBatch(context,{action:'create_review_batch',invoiceIds:['locked'],criteria,requestId:'lock',confirmReviewed:true})).batch;
await entities.FiscalReviewBatch.update(lockedJob.id,{lock_token:'other-worker',lock_started_at:new Date().toISOString()});
await assert.rejects(()=>fiscalReviewBatch(context,{action:'process_review_batch',batchId:lockedJob.id}),/otra pestaña/);
console.log(JSON.stringify({ok:true,syntheticInvoices:1203,cases:['advisor_over_profile','intra_services_normalized','preview_no_writes','supplier_total_unchanged','472_477_balanced','partial_deduction_expense','historical_subaccount','normal_user_denied','unassigned_advisor_denied','cross_tenant_denied','no_source_fields_copied','selection_beyond_500','durable_chunk_ack_lost','durable_job_ack_lost','partial_failure_continues','retry_failed_only','no_duplicate_journals','changed_invoice_not_overwritten','concurrent_worker_denied']},null,2));

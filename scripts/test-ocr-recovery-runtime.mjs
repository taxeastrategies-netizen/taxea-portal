import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
const built = await esbuild.build({stdin:{contents:"import * as recovery from './base44/functions/approveOcrDocument/ocrRecovery.ts';globalThis.recovery=recovery;",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs'});
const ctx=vm.createContext({console,Date,crypto:globalThis.crypto});
vm.runInContext(built.outputFiles[0].text,ctx);
const {acquireApprovalLease,resumeExistingOcr,findFinancialDuplicates}=ctx.recovery;
let rows, writes, postings;
const matches=(row,q)=>Object.entries(q).every(([k,v])=>v?.$in?v.$in.includes(row[k]??null):row[k]===v);
const svc={entities:new Proxy({},{get:(_t,name)=>({
  get:async id=>(rows[name]||[]).find(r=>r.id===id)||null,
  filter:async q=>(rows[name]||[]).filter(r=>matches(r,q)),
  update:async(id,data)=>{writes.push({name,id,data});const row=(rows[name]||[]).find(r=>r.id===id);assert.ok(row);Object.assign(row,data);return row;},
  updateMany:async(q,ops)=>{const found=(rows[name]||[]).filter(r=>matches(r,q));found.forEach(r=>Object.assign(r,ops.$set));return {updated:found.length};},
  create:async()=>{throw new Error('Recovery must never create financial entities');},
})})};
const admin={id:'admin-test',email:'admin@example.test',role:'admin'};
const normal={...admin,role:'user'};
const baseDoc={id:'ocr-test',company_id:'tenant-test',documentType:'expense_invoice',status:'review_required',extractedData:JSON.stringify({total:107}),auditTrail:[]};
const baseInv={id:'invoice-test',company_id:'tenant-test',ocr_document_id:'ocr-test',tipo:'recibida',total_factura:107,estado_contable:'requiere_correccion',fiscal_review_status:'validado',numero_factura:'TEST-1',fecha_emision:'2026-07-02',proveedor_nif:'TEST-VENDOR'};
function reset(){rows={Company:[{id:'tenant-test'}],OcrInvoiceDocument:[structuredClone(baseDoc)],Invoice:[structuredClone(baseInv)],InvoiceTaxLine:[{id:'tax-test',companyId:'tenant-test',invoiceId:'invoice-test',reviewStatus:'validado'}]};writes=[];postings=0;}
const post=async(_svc,company,inv)=>{assert.equal(company,inv.company_id);if(inv.estado_contable!=='contabilizada'){postings++;inv.estado_contable='contabilizada';inv.linked_journal_entry_id='journal-existing';}return{entry:{id:'journal-existing'}};};
const resume=(user=admin,confirm=true,doc=rows.OcrInvoiceDocument[0],type='recibida')=>resumeExistingOcr(svc,user,doc,type,confirm,post,'pgc8-v1');
reset();
const lease=await acquireApprovalLease(svc,'tenant-test');
await assert.rejects(acquireApprovalLease(svc,'tenant-test'),e=>e.status===409);
await lease();const second=await acquireApprovalLease(svc,'tenant-test');await second();
assert.equal(rows.Company[0].ocr_approval_lock_token,'');
reset();assert.equal((await resume()).json.recovered,true);assert.equal(postings,1);assert.equal(rows.Invoice.length,1);assert.equal(rows.OcrInvoiceDocument[0].status,'accounted');assert.equal(rows.OcrInvoiceDocument[0].linkedInvoiceId,'invoice-test');
assert.equal((await resume()).json.recovered,true);assert.equal(postings,1);assert.equal(rows.InvoiceTaxLine.length,1);
reset();assert.equal((await resume(normal)).json.review_required,true);assert.equal(postings,0);
reset();assert.equal((await resume(admin,false)).json.review_required,true);assert.equal(postings,0);
reset();rows.Invoice[0].accounting_migration_hold=true;assert.equal((await resume()).json.review_required,true);assert.equal(postings,0);
reset();rows.Invoice[0].total_factura=100;assert.equal((await resume()).status,409);assert.equal(postings,0);assert.match(rows.OcrInvoiceDocument[0].safeErrorMessage,/total/);
reset();rows.Invoice.push({...baseInv,id:'invoice-duplicate'});assert.equal((await resume()).status,409);assert.equal(writes.length,0);
reset();rows.OcrInvoiceDocument[0].linkedInvoiceId='foreign-invoice';rows.Invoice=[{...baseInv,id:'foreign-invoice',company_id:'other-tenant'}];assert.equal((await resume()).status,409);
reset();rows.Invoice[0].anulada=true;assert.equal((await resume()).status,409);
reset();assert.equal((await resume(admin,true,rows.OcrInvoiceDocument[0],'emitida')).status,422);
reset();rows.InvoiceTaxLine=[];assert.equal((await resume()).status,409);assert.equal(postings,0);
reset();rows.Invoice=[];assert.equal(await resume(),null);
reset();rows.OcrInvoiceDocument[0].linkedInvoiceId='missing';assert.equal((await resume()).status,409);
reset();rows.Invoice[0].ocr_document_id='other-ocr';assert.equal((await findFinancialDuplicates(svc,baseDoc,baseInv)).length,1);
assert.equal((await findFinancialDuplicates(svc,baseDoc,{...baseInv,proveedor_nif:'OTHER'})).length,0);
assert.equal((await findFinancialDuplicates(svc,baseDoc,{...baseInv,fecha_emision:'2026-07-03'})).length,0);
rows.Invoice[0].anulada=true;assert.equal((await findFinancialDuplicates(svc,baseDoc,baseInv)).length,0);
console.log('OCR recovery: 18 scenarios passed; lease, lost links, retries, fiscal holds, totals, tenant, duplicates; no financial creates.');

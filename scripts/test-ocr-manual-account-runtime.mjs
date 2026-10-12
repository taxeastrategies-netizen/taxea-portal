import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/approveOcrDocument/entry.ts');
const build = await esbuild.build({
  stdin: { contents: fs.readFileSync(entry, 'utf8'), loader: 'ts', resolveDir: path.dirname(entry), sourcefile: entry },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{
    name: 'ocr-runtime-stubs',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'test' }));
      builder.onResolve({ filter: /^\.\/accountingEngine\.ts$/ }, () => ({ path: 'accounting', namespace: 'test' }));
      builder.onResolve({ filter: /^\.\/invoiceQr\.ts$/ }, () => ({ path: 'qr', namespace: 'test' }));
      builder.onLoad({ filter: /^sdk$/, namespace: 'test' }, () => ({
        loader: 'js', contents: 'export const createClientFromRequest = () => globalThis.__testClient',
      }));
      builder.onLoad({ filter: /^accounting$/, namespace: 'test' }, () => ({
        loader: 'js', contents: "export const SCHEMA_VERSION = 'pgc8-v1'; export const canonical8 = v => String(v).padEnd(8, '0'); export const postInvoice = (...args) => globalThis.__postInvoice(...args);",
      }));
      builder.onLoad({ filter: /^qr$/, namespace: 'test' }, () => ({
        loader: 'js', contents: "export const buildAeatQrUrl = () => 'https://example.test/qr';",
      }));
    },
  }],
});
const records = {
  OcrInvoiceDocument: [
    { id: 'expense-a', company_id: 'company-a', documentType: 'expense_invoice', status: 'review_required', uploadedAt: '2026-10-03', auditTrail: [] },
    { id: 'income-a', company_id: 'company-a', documentType: 'income_invoice', status: 'review_required', uploadedAt: '2026-10-03', auditTrail: [] },
    { id: 'expense-b', company_id: 'company-b', documentType: 'expense_invoice', status: 'review_required', uploadedAt: '2026-10-03', auditTrail: [] },
    { id: 'expense-default', company_id: 'company-a', documentType: 'expense_invoice', status: 'review_required', uploadedAt: '2026-10-03', auditTrail: [] },
  ],
  AccountingAccount: [
    { id: 'a-629', companyId: 'company-a', code: '62900000', type: 'gasto', status: 'activa' },
    { id: 'a-705', companyId: 'company-a', code: '70500000', type: 'ingreso', status: 'activa' },
    { id: 'a-625', companyId: 'company-a', code: '62500000', type: 'gasto', status: 'inactiva' },
    { id: 'b-629', companyId: 'company-b', code: '62900000', type: 'gasto', status: 'activa' },
  ],
  FiscalProfile: [], Invoice: [], TimelineEvent: [],
  Company: [{ id: 'company-a', nif_cif: 'B12345678', owner_email: 'user@a.test' }],
};
const match = (row, query) => Object.entries(query || {}).every(([key, value]) => value?.$in ? value.$in.includes(row?.[key] ?? null) : row?.[key] === value);
const entity = name => ({
  async updateMany(query, data) { const rows = (records[name] || []).filter(row => match(row, query)); rows.forEach(row => Object.assign(row, data.$set)); return { updated: rows.length }; },
  async get(id) { return records[name]?.find(row => row.id === id) || null; },
  async filter(query) { return (records[name] || []).filter(row => match(row, query)); },
  async create(payload) {
    const row = { id: `${name}-${(records[name] || []).length + 1}`, ...payload };
    (records[name] ||= []).push(row);
    return row;
  },
  async update(id, payload) {
    const row = records[name]?.find(item => item.id === id);
    if (!row) throw new Error(`Missing ${name} ${id}`);
    Object.assign(row, payload);
    return row;
  },
});
const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });
let user = { id: 'user-a', email: 'user@a.test', role: 'user', data: { company_id: 'company-a' } };
let postingCount = 0;
const client = {
  auth: { me: async () => user },
  asServiceRole: { entities, functions: { invoke: async () => ({}) } },
  functions: { invoke: async (name, body) => {
    assert.equal(name,'invoiceOperations');assert.equal(body.action,'confirm_source_invoice');
    let inv=await entities.Invoice.get(body.invoice_id);
    inv=await entities.Invoice.update(inv.id,{fiscal_review_status:'validado',fiscal_reviewed_by:user.email,
      ...(inv.tipo==='emitida'?{qr_url:'https://example.test/qr',qr_mode:'no_verifactu'}:{})});
    const posting=await context.__postInvoice(entities,inv.company_id,inv);
    
    // El helper real de huella se ejecuta al reintentar; este test aísla las cuentas PGC.
    await entities.OcrInvoiceDocument.update(inv.ocr_document_id,{status:'accounted',linkedJournalEntryId:posting.entry.id});
    return {data:{success:true,invoice:await entities.Invoice.get(inv.id),journalEntryId:posting.entry.id}};

  } },
};
let handler;
const context = vm.createContext({
  console, Request, Response, URL, Date, TextEncoder, Uint8Array, crypto: globalThis.crypto,
  __testClient: client,
  __postInvoice: async (_svc, companyId, invoice) => {
    assert.equal(companyId, invoice.company_id);
    if (invoice.linked_journal_entry_id) return { alreadyPosted: true, entry: { id: invoice.linked_journal_entry_id } };
    postingCount += 1;
    await entities.Invoice.update(invoice.id, { estado_contable: 'contabilizada', linked_journal_entry_id: `entry-${postingCount}` });
    return { entry: { id: `entry-${postingCount}` }, proposal: { counterparty: { account: { code: '40000000' } } } };
  },
  Deno: { serve(fn) { handler = fn; } },
});
vm.runInContext(build.outputFiles[0].text + '\n globalThis.__bulkForm = buildBulkCorrectedForm;', context);
const preserved = context.__bulkForm({ base_imponible: 100, tipo_impuesto: 7, cuota_impuesto: 7, total: 89, retencion_irpf: 15, importe_retencion: 18 });
assert.equal(preserved.total, 89);
assert.equal(preserved.cuota_impuesto, 7);
assert.equal(preserved.importe_retencion, 18);
async function invoke(docId, invoiceType, account, confirm = false, suggested = '', invoiceNumber = 'G-1') {
  const form = invoiceType === 'emitida'
    ? { numero_factura: invoiceNumber === 'G-1' ? 'F-1' : invoiceNumber, fecha_emision: '2026-10-02', base_imponible: 100, tipo_iva: 0, cuota_iva: 0, total_factura: 100 }
    : { numero_factura: invoiceNumber, fecha: '2026-10-02', fecha_recepcion: '2026-10-03', base_imponible: 100, tipo_impuesto: 0, cuota_impuesto: 0, total: 100 };
  if (account !== undefined) form.cuenta_contable_manual = account;
  if (suggested) form.cuenta_pgc = suggested;
  const response = await handler(new Request('https://taxea.test/approveOcrDocument', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId, form, invoiceType, extractedData: {}, confirm_fiscal_review: confirm }),
  }));
  return { status: response.status, payload: await response.json() };
}
for (const account of ['62900001', '625', '705', '629XX']) {
  const result = await invoke('expense-a', 'recibida', account);
  assert.equal(result.status, 422, account);
  assert.equal(records.Invoice.length, 0);
  assert.equal(postingCount, 0);
}
assert.equal((await invoke('expense-a', 'emitida', '705')).status, 422);
assert.equal((await invoke('expense-b', 'recibida', '629')).status, 403);
assert.equal(records.Invoice.length, 0);
const expense = await invoke('expense-a', 'recibida', '629');
assert.equal(expense.status, 200);
assert.equal(records.Invoice[0].revenue_expense_account_code, '62900000');
assert.equal(records.Invoice[0].revenue_expense_account_id, 'a-629');
assert.equal(records.Invoice[0].tipo_iva, 0);
assert.equal(records.InvoiceTaxLine?.length || 0, 0);
assert.equal(records.Invoice[0].fiscal_review_status, 'validado');
assert.equal(records.Invoice[0].qr_url, undefined);
assert.equal(records.OcrInvoiceDocument[0].linkedInvoiceId, records.Invoice[0].id);
assert.equal(records.OcrInvoiceDocument[0].status,'accounted');
assert.equal((await invoke('expense-a', 'recibida', '629')).payload.alreadyProcessed, true);
assert.equal(records.Invoice.length, 1);
const income = await invoke('income-a', 'emitida', '705');
assert.equal(income.status, 200);
assert.equal(records.Invoice[1].revenue_expense_account_code, '70500000');
assert.equal(records.Invoice[1].revenue_expense_account_id, 'a-705');
assert.equal(postingCount, 2);
assert.ok(records.OcrInvoiceDocument[1].linkedJournalEntryId);
const defaultExpense = await invoke('expense-default', 'recibida');
assert.equal(defaultExpense.status, 200);
assert.equal(records.Invoice[2].revenue_expense_account_code, undefined);
assert.equal(postingCount, 3);
records.OcrInvoiceDocument.push(
  {id:'expense-ai-a',company_id:'company-a',documentType:'expense_invoice',status:'review_required',uploadedAt:'2026-10-03',auditTrail:[]},
  {id:'expense-ai-b',company_id:'company-a',documentType:'expense_invoice',status:'review_required',uploadedAt:'2026-10-03',auditTrail:[]},
  {id:'expense-ai-invalid',company_id:'company-a',documentType:'expense_invoice',status:'review_required',uploadedAt:'2026-10-03',auditTrail:[]},
);
records.AccountingAccount.push({id:'a-602',companyId:'company-a',code:'60200000',type:'gasto',status:'activa'});
assert.equal((await invoke('expense-ai-a','recibida',undefined,false,'602','G-AI-1')).status,200);
assert.equal((await invoke('expense-ai-b','recibida',undefined,false,'629','G-AI-2')).status,200);
assert.equal(records.Invoice.find(row=>row.numero_factura==='G-AI-1').revenue_expense_account_code,'60200000');
assert.equal(records.Invoice.find(row=>row.numero_factura==='G-AI-2').revenue_expense_account_code,'62900000');
assert.equal((await invoke('expense-ai-invalid','recibida',undefined,false,'705','G-AI-3')).status,422);
assert.equal(records.Invoice.some(row=>row.numero_factura==='G-AI-3'),false);

user = {id:'advisor-a',email:'advisor@test.invalid',role:'admin',data:{company_id:'company-a'}};
records.OcrInvoiceDocument.push({id:'income-approved',company_id:'company-a',documentType:'income_invoice',status:'review_required',uploadedAt:'2026-10-03',auditTrail:[]});
// Distinct numbering avoids deliberately triggering the duplicate financial guard.
records.Invoice[1].numero_factura = 'F-PROPOSAL';
const issued = await invoke('income-approved', 'emitida', '705', true);
assert.equal(issued.status, 200);
const issuedInvoice = records.Invoice.find(row=>row.id===issued.payload.invoiceId);
const ensureBuild=await esbuild.build({stdin:{contents:"export {ensureInvoiceQrHash} from './base44/functions/approveOcrDocument/invoiceQrHash.ts';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs'});
const ensureModule={exports:{}};vm.runInNewContext(ensureBuild.outputFiles[0].text,{module:ensureModule,exports:ensureModule.exports,TextEncoder,crypto:globalThis.crypto});
await ensureModule.exports.ensureInvoiceQrHash(entities.Invoice,issuedInvoice);
Object.assign(issuedInvoice,await entities.Invoice.get(issuedInvoice.id));
assert.match(issuedInvoice.qr_integrity_hash,/^[A-F0-9]{64}$/);
const stableHash = issuedInvoice.qr_integrity_hash;
const issuedRetry = await invoke('income-approved', 'emitida', '705', true);
assert.equal(issuedRetry.status, 200);
assert.equal(issuedInvoice.qr_integrity_hash, stableHash);
assert.equal(records.Invoice.length, 6);
assert.equal(postingCount, 6);

// Use the real accounting engine to verify the selected account reaches Debe/Haber.
const engineEntry = path.resolve('base44/functions/approveOcrDocument/accountingEngine.ts');
const engineBuild = await esbuild.build({
  stdin: {
    contents: "import { buildInvoicePosting } from './base44/functions/approveOcrDocument/accountingEngine.ts'; globalThis.__buildInvoicePosting = buildInvoicePosting;",
    loader: 'ts', resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{
    name: 'accounting-sdk-stub',
    setup(builder) {
      builder.onResolve({ filter: new RegExp('^npm:@base44/sdk') }, () => ({ path: 'sdk', namespace: 'engine-test' }));
      builder.onLoad({ filter: /^sdk$/, namespace: 'engine-test' }, () => ({ loader: 'js', contents: 'export const createClientFromRequest = () => ({})' }));
    },
  }],
});
const engineContext = vm.createContext({ console, TextEncoder, crypto: globalThis.crypto, __buildInvoicePosting: null });
vm.runInContext(engineBuild.outputFiles[0].text, engineContext, { filename: engineEntry });
const expensePosting = await engineContext.__buildInvoicePosting({ entities }, 'company-a', records.Invoice[0]);
const incomePosting = await engineContext.__buildInvoicePosting({ entities }, 'company-a', records.Invoice[1]);
assert.ok(expensePosting.lines.some(line => line.accountCode === '62900000' && line.debit === 100 && line.sourceLineType === 'gasto'));
assert.ok(incomePosting.lines.some(line => line.accountCode === '70500000' && line.credit === 100 && line.sourceLineType === 'ingreso'));
console.log('OCR manual account: tenant, direction, active account, idempotency and real accounting lines OK');
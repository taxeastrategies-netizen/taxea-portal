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
  ],
  AccountingAccount: [
    { id: 'a-629', companyId: 'company-a', code: '62900000', type: 'gasto', status: 'activa' },
    { id: 'a-705', companyId: 'company-a', code: '70500000', type: 'ingreso', status: 'activa' },
    { id: 'a-625', companyId: 'company-a', code: '62500000', type: 'gasto', status: 'inactiva' },
    { id: 'b-629', companyId: 'company-b', code: '62900000', type: 'gasto', status: 'activa' },
  ],
  FiscalProfile: [], Invoice: [], TimelineEvent: [],
  Company: [{ id: 'company-a', nif_cif: 'B12345678' }],
};
const match = (row, query) => Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
const entity = name => ({
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
  functions: { invoke: async () => ({ data: {} }) },
};
let handler;
const context = vm.createContext({
  console, Request, Response, URL, Date,
  __testClient: client,
  __postInvoice: async (_svc, companyId, invoice) => {
    assert.equal(companyId, invoice.company_id);
    postingCount += 1;
    return { entry: { id: `entry-${postingCount}` }, proposal: { counterparty: { account: { code: '40000000' } } } };
  },
  Deno: { serve(fn) { handler = fn; } },
});
vm.runInContext(build.outputFiles[0].text, context);
async function invoke(docId, invoiceType, account) {
  const form = invoiceType === 'emitida'
    ? { numero_factura: 'F-1', fecha_emision: '2026-10-02', base_imponible: 100, total_factura: 100 }
    : { numero_factura: 'G-1', fecha: '2026-10-02', fecha_recepcion: '2026-10-03', base_imponible: 100, total: 100 };
  if (account !== undefined) form.cuenta_contable_manual = account;
  const response = await handler(new Request('https://taxea.test/approveOcrDocument', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docId, form, invoiceType, extractedData: {} }),
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
assert.equal(records.OcrInvoiceDocument[0].linkedInvoiceId, records.Invoice[0].id);
assert.match(records.OcrInvoiceDocument[0].auditTrail[0], /manualAccount=62900000/);
assert.equal((await invoke('expense-a', 'recibida', '629')).payload.alreadyProcessed, true);
assert.equal(records.Invoice.length, 1);
const income = await invoke('income-a', 'emitida', '705');
assert.equal(income.status, 200);
assert.equal(records.Invoice[1].revenue_expense_account_code, '70500000');
assert.equal(records.Invoice[1].revenue_expense_account_id, 'a-705');
assert.equal(postingCount, 2);
assert.equal(records.OcrInvoiceDocument[1].linkedJournalEntryId, 'entry-2');

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
      builder.onResolve({ filter: /^npm:@base44\\/sdk/ }, () => ({ path: 'sdk', namespace: 'engine-test' }));
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

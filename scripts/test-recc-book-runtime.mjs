import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const compiled = await esbuild.build({ entryPoints: [path.resolve('base44/functions/fiscalOperations/entry.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'sdk-stub', setup(builder) {
    builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'stub' }));
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ loader: 'js', contents: 'export const createClientFromRequest=()=>globalThis.__client;' }));
  } }],
});
const records = {
  Company: [{ id: 'company-a', owner_email: 'owner@test.invalid', usuarios_autorizados: ['advisor@test.invalid'] },
    { id: 'company-b', owner_email: 'other@test.invalid', usuarios_autorizados: [] }],
  FiscalProfile: [], FiscalProfileVersion: [], FiscalActivity: [], TaxModel: [],
  Invoice: [{ id: 'recc-a', company_id: 'company-a', tipo: 'emitida', numero_factura: 'TEST-RECC',
    fecha_emision: '2025-06-10', fecha_operacion: '2025-06-10', fiscal_regime: 'criterio_caja', indirect_tax_kind: 'iva',
    fiscal_review_status: 'validado', cliente_nombre: 'Cliente sintético', cliente_nif: 'B12345678',
    base_imponible: 100, cuota_iva: 21, total_factura: 121, estado_cobro: 'parcial' }],
  InvoiceTaxLine: [{ id: 'line-a', companyId: 'company-a', invoiceId: 'recc-a', lineNumber: 1, taxKind: 'iva',
    regime: 'criterio_caja', reviewStatus: 'validado' }],
  InvoicePayment: [{ id: 'payment-a', company_id: 'company-a', invoice_id: 'recc-a', amount: 60.5,
    payment_date: '2026-03-31', method: 'transferencia', origin: 'bank_reconciliation', reference: 'Cobro 1',
    bank_transaction_id: 'bank-tx-a', operation_status: 'committed', accounting_operation_id: 'op-a' }],
  AccountingPostingOperation: [{ id: 'op-a', companyId: 'company-a', status: 'committed' }],
  BankTransaction: [{ id: 'bank-tx-a', company_id: 'company-a', bank_account_id: 'bank-a' }],
  BankAccount: [{ id: 'bank-a', company_id: 'company-a', iban: 'ES0000000000000000000000' }],
};
let writes = 0;
const entities = new Proxy({}, { get: (_target, name) => ({
  async filter(query, _sort, limit = 50, skip = 0) {
    return (records[name] || []).filter(row => Object.entries(query || {}).every(([key, value]) => row[key] === value)).slice(skip, skip + limit);
  },
  async get(id) { return (records[name] || []).find(row => row.id === id) || null; },
  async create() { writes++; throw new Error('Unexpected write'); },
  async update() { writes++; throw new Error('Unexpected write'); },
}) });
let user = { email: 'owner@test.invalid', role: 'user', data: { company_id: 'company-a' } };
const client = { auth: { me: async () => user }, asServiceRole: { entities } };
let handler;
vm.runInContext(compiled.outputFiles[0].text, vm.createContext({ Response, Request, URL, TextEncoder,
  TextDecoder, crypto: webcrypto, Date, console, __client: client, Deno: { serve: fn => { handler = fn; } } }));
async function call(companyId = 'company-a') {
  const response = await handler(new Request('https://test.invalid', { method: 'POST',
    body: JSON.stringify({ action: 'recc_book', companyId, year: 2026 }) }));
  return { status: response.status, data: await response.json() };
}
const own = await call();
assert.equal(own.status, 200);
assert.equal(own.data.invoices.length, 1);
assert.equal(own.data.invoices[0].forcedRecognitionDate, '2026-12-31');
assert.equal(own.data.payments.length, 1);
assert.equal(own.data.payments[0].bankAccount, 'ES0000000000000000000000');
assert.equal(own.data.payments[0].confirmed, true);
assert.equal(own.data.issues.length, 0);
const crossCompany = await call('company-b');
assert.equal(crossCompany.status, 403);
user = { email: 'advisor@test.invalid', role: 'advisor', data: {} };
const advisor = await call();
assert.equal(advisor.status, 200);
records.InvoicePayment.push({ id: 'payment-b', company_id: 'company-a', invoice_id: 'recc-a', amount: 60.5,
  payment_date: '2026-04-01', method: 'transferencia', origin: 'manual', operation_status: 'preparing' });
const pending = await call();
assert.ok(pending.data.issues.some(issue => issue.paymentId === 'payment-b'));
assert.equal(writes, 0);
console.log(JSON.stringify({ ok: true, checks: ['own-company-book', 'previous-year-invoice', 'bank-account-source',
  'cross-company-denied', 'advisor-authorized', 'pending-payment-flagged', 'read-only'] }, null, 2));

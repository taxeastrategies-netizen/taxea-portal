import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['base44/functions/invoiceOperations/groupReconciliation.ts'],
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  plugins: [{
    name: 'accounting-stub',
    setup(builder) {
      builder.onResolve({ filter: /^\.\/accountingEngine\.ts$/ }, () => ({ path: 'engine', namespace: 'test' }));
      builder.onLoad({ filter: /^engine$/, namespace: 'test' }, () => ({ loader: 'js', contents: `
        export const SCHEMA_VERSION = 'pgc8-v1';
        export const postInvoice = (...args) => globalThis.__groupTest.postInvoice(...args);
        export const createJournalEntry = (...args) => globalThis.__groupTest.createJournalEntry(...args);
        export const commitJournalEntry = (...args) => globalThis.__groupTest.commitJournalEntry(...args);
        export const updatePostingOperation = (...args) => globalThis.__groupTest.updatePostingOperation(...args);
      ` }));
    },
  }],
});
const { normalizeGroupAllocations, reconcileInvoiceGroup } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const companyId = 'company-a';
const now = '2026-10-04T16:00:00.000Z';
const records = {
  BankTransaction: [
    { id: 'tx-ok', company_id: companyId, bank_account_id: 'bank-physical', fecha_operacion: '2026-10-04', importe: 100, tipo: 'entrada', moneda: 'EUR', estado_conciliacion: 'sin_conciliar', estado_proveedor: 'booked' },
    { id: 'tx-retry', company_id: companyId, bank_account_id: 'bank-physical', fecha_operacion: '2026-10-04', importe: 50, tipo: 'entrada', moneda: 'EUR', estado_conciliacion: 'sin_conciliar', estado_proveedor: 'booked' },
    { id: 'tx-555', company_id: companyId, bank_account_id: 'bank-physical', fecha_operacion: '2026-10-04', importe: 30, tipo: 'entrada', moneda: 'EUR', estado_conciliacion: 'revisar', estado_proveedor: 'booked', entidad_tipo: 'accounting_account', entidad_id: 'pending-555', journal_entry_id: 'old-555', accounting_operation_id: 'old-op' },
    { id: 'tx-other', company_id: 'company-b', bank_account_id: 'bank-physical', importe: 100, tipo: 'entrada', moneda: 'EUR', estado_conciliacion: 'sin_conciliar' },
    { id: 'tx-fx', company_id: companyId, bank_account_id: 'bank-physical', importe: 100, tipo: 'entrada', moneda: 'USD', estado_conciliacion: 'sin_conciliar' },
  ],
  BankAccount: [{ id: 'bank-physical', company_id: companyId, nombre_banco: 'Banco prueba', accounting_account_id: 'bank-ledger' }],
  AccountingAccount: [
    { id: 'bank-ledger', companyId, code: '57200001', name: 'Banco', type: 'banco', status: 'activa' },
    { id: 'customer-a', companyId, code: '43000001', name: 'Cliente A', status: 'activa' },
    { id: 'customer-b', companyId, code: '43000002', name: 'Cliente B', status: 'activa' },
    { id: 'pending-555', companyId, code: '55500000', name: 'Pendiente', status: 'activa' },
  ],
  Invoice: [
    { id: 'a', company_id: companyId, tipo: 'emitida', total_factura: 60, numero_factura: 'A', moneda: 'EUR', counterparty_account_id: 'customer-a' },
    { id: 'b', company_id: companyId, tipo: 'emitida', total_factura: 40, numero_factura: 'B', moneda: 'EUR', counterparty_account_id: 'customer-b' },
    { id: 'c', company_id: companyId, tipo: 'emitida', total_factura: 30, numero_factura: 'C', moneda: 'EUR', counterparty_account_id: 'customer-a' },
    { id: 'd', company_id: companyId, tipo: 'emitida', total_factura: 20, numero_factura: 'D', moneda: 'EUR', counterparty_account_id: 'customer-b' },
    { id: 'e', company_id: companyId, tipo: 'emitida', total_factura: 20, numero_factura: 'E', moneda: 'EUR', counterparty_account_id: 'customer-a' },
    { id: 'f', company_id: companyId, tipo: 'emitida', total_factura: 10, numero_factura: 'F', moneda: 'EUR', counterparty_account_id: 'customer-b' },
    { id: 'foreign', company_id: 'company-b', tipo: 'emitida', total_factura: 50, numero_factura: 'X', moneda: 'EUR' },
  ],
  InvoicePayment: [], JournalEntry: [
    { id: 'old-555', companyId, postingKey: 'bank:tx-555:pgc8-v1', accountingOperationId: 'old-op', status: 'confirmado' },
  ],
  AccountingPostingOperation: [{ id: 'old-op', companyId, operationType: 'bank_reconciliation', status: 'committed' }],
  JournalEntryLine: [
    { id: 'old-bank', companyId, journalEntryId: 'old-555', accountId: 'bank-ledger', accountCode: '57200001', debit: 30, credit: 0 },
    { id: 'old-pending', companyId, journalEntryId: 'old-555', accountId: 'pending-555', accountCode: '55500000', debit: 0, credit: 30 },
  ],
  InvoiceTimelineEvent: [],
};
let sequence = 0;
let failBankLink = false;
const matches = (row, query) => Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
const entity = name => ({
  async get(id) { return records[name].find(row => row.id === id) || null; },
  async filter(query) { return records[name].filter(row => matches(row, query)); },
  async create(payload) { const row = { id: name + '-' + (++sequence), created_date: now, ...payload }; records[name].push(row); return row; },
  async update(id, patch) {
    if (name === 'BankTransaction' && failBankLink && patch.estado_conciliacion === 'conciliada_manual') { failBankLink = false; throw new Error('Fallo sintético enlazando banco'); }
    const index = records[name].findIndex(row => row.id === id);
    assert.ok(index >= 0);
    records[name][index] = { ...records[name][index], ...patch };
    return records[name][index];
  },
  async delete(id) { records[name].splice(records[name].findIndex(row => row.id === id), 1); },
});
const entities = new Proxy({}, { get: (_target, key) => entity(String(key)) });
const svc = { entities };
const base44 = { asServiceRole: svc };
const user = { email: 'owner@a.test', full_name: 'Test' };
globalThis.__groupTest = {
  async postInvoice() { return { entry: { id: 'existing' } }; },
  async createJournalEntry(_svc, company, payload) {
    let operation = records.AccountingPostingOperation.find(row => row.operationKey === payload.postingKey);
    let entry = records.JournalEntry.find(row => row.postingKey === payload.postingKey);
    if (!operation) operation = await entities.AccountingPostingOperation.create({ companyId: company, operationKey: payload.postingKey, operationType: payload.operationType, status: 'preparing' });
    else operation = await entities.AccountingPostingOperation.update(operation.id, { status: 'preparing' });
    if (!entry) entry = await entities.JournalEntry.create({ companyId: company, postingKey: payload.postingKey, accountingOperationId: operation.id, status: 'borrador', lines: payload.lines });
    return { operation, entry };
  },
  async commitJournalEntry(_svc, company, entry) {
    assert.equal(entry.companyId, company);
    const debit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
    assert.equal(Math.round(debit * 100), Math.round(credit * 100));
    assert.equal(entry.lines.filter(line => line.sourceLineType === 'banco').length, entry.postingKey.startsWith('bank-group-reclass:') ? 0 : 1);
    return { entry: await entities.JournalEntry.update(entry.id, { status: 'confirmado' }) };
  },
  async updatePostingOperation(_svc, operation, patch) { return entities.AccountingPostingOperation.update(operation.id, patch); },
};
const helpers = {
  async refreshInvoicePaymentState(_sdk, invoice, company) {
    const payments = records.InvoicePayment.filter(row => row.company_id === company && row.invoice_id === invoice.id);
    const visible = payments.filter(row => row.operation_status === 'committed' && records.AccountingPostingOperation.find(op => op.id === row.accounting_operation_id)?.status === 'committed');
    const paid = visible.reduce((sum, row) => sum + row.amount, 0);
    const outstanding = Math.max(0, invoice.total_factura - paid);
    await entities.Invoice.update(invoice.id, { importe_pagado: paid, importe_pendiente: outstanding });
    return { payments: visible, outstanding };
  },
  async reserveInvoicePayment(_sdk, company, invoice, payload) {
    const existing = records.InvoicePayment.find(row => row.company_id === company && row.invoice_id === invoice.id && row.idempotency_key === payload.idempotency_key);
    return { payment: existing || await entities.InvoicePayment.create(payload) };
  },
  async recordTimeline(_sdk, payload) { await entities.InvoiceTimelineEvent.create(payload); },
};
const request = (tx, allocations) => ({ bank_transaction_id: tx, bank_accounting_account_id: 'bank-ledger', allocations });
const group = [ { invoice_id: 'a', amount: 60 }, { invoice_id: 'b', amount: 40 } ];
assert.equal(normalizeGroupAllocations(group, 100).length, 2);
assert.throws(() => normalizeGroupAllocations(group, 99), /suma repartida/);
assert.throws(() => normalizeGroupAllocations([{ invoice_id: 'a', amount: 60 }, { invoice_id: 'a', amount: 40 }], 100), /repetidas/);
await assert.rejects(() => reconcileInvoiceGroup(base44, user, companyId, request('tx-other', group), helpers), /Movimiento no encontrado/);
await assert.rejects(() => reconcileInvoiceGroup(base44, user, companyId, request('tx-fx', group), helpers), /requiere EUR/);

await assert.rejects(() => reconcileInvoiceGroup(base44, user, companyId, request('tx-ok', [{ invoice_id: 'a', amount: 70 }, { invoice_id: 'b', amount: 30 }]), helpers), /supera el pendiente/);
const first = await reconcileInvoiceGroup(base44, user, companyId, request('tx-ok', group), helpers);
assert.equal(first.ok, true);
assert.equal(first.duplicate, false);
assert.equal(records.JournalEntry.filter(row => row.postingKey === 'bank:tx-ok:pgc8-v1').length, 1);
assert.equal(records.InvoicePayment.filter(row => row.bank_transaction_id === 'tx-ok').length, 2);
assert.equal(records.Invoice.find(row => row.id === 'a').importe_pendiente, 0);
assert.equal(records.Invoice.find(row => row.id === 'b').importe_pendiente, 0);
const repeated = await reconcileInvoiceGroup(base44, user, companyId, request('tx-ok', group), helpers);
assert.equal(repeated.duplicate, true);
assert.equal(records.JournalEntry.filter(row => row.postingKey === 'bank:tx-ok:pgc8-v1').length, 1);
failBankLink = true;
await assert.rejects(() => reconcileInvoiceGroup(base44, user, companyId, request('tx-retry', [{ invoice_id: 'c', amount: 30 }, { invoice_id: 'd', amount: 20 }]), helpers), /Fallo sintético/);
assert.equal(records.AccountingPostingOperation.find(row => row.operationKey === 'bank:tx-retry:pgc8-v1').status, 'recovery_required');
assert.equal(records.Invoice.find(row => row.id === 'c').importe_pagado || 0, 0);
const recovered = await reconcileInvoiceGroup(base44, user, companyId, request('tx-retry', [{ invoice_id: 'c', amount: 30 }, { invoice_id: 'd', amount: 20 }]), helpers);
assert.equal(recovered.ok, true);
assert.equal(records.JournalEntry.filter(row => row.postingKey === 'bank:tx-retry:pgc8-v1').length, 1);
assert.equal(records.InvoicePayment.filter(row => row.bank_transaction_id === 'tx-retry').length, 2);
const reclassified = await reconcileInvoiceGroup(base44, user, companyId, request('tx-555', [{ invoice_id: 'e', amount: 20 }, { invoice_id: 'f', amount: 10 }]), helpers);
assert.equal(reclassified.reclassified_555, true);
assert.equal(records.JournalEntry.filter(row => row.postingKey === 'bank:tx-555:pgc8-v1').length, 1);
assert.equal(records.JournalEntry.filter(row => row.postingKey === 'bank-group-reclass:tx-555:pgc8-v1').length, 1);
assert.equal(records.BankTransaction.find(row => row.id === 'tx-555').journal_entry_id, 'old-555');
assert.equal((await reconcileInvoiceGroup(base44, user, companyId, request('tx-555', [{ invoice_id: 'e', amount: 20 }, { invoice_id: 'f', amount: 10 }]), helpers)).duplicate, true);
assert.equal(records.InvoiceTimelineEvent.length, 6);
console.log('Conciliación agrupada: validación, asiento único, 555, permisos, reintento e idempotencia OK');

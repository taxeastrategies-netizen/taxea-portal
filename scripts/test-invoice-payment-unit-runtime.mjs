import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const entryPath = path.resolve('base44/functions/invoiceOperations/entry.ts');
const build = await esbuild.build({
  stdin: { contents: fs.readFileSync(entryPath, 'utf8'), loader: 'ts', resolveDir: path.dirname(entryPath), sourcefile: entryPath },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  plugins: [{
    name: 'invoice-payment-unit-runtime-stubs',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'base44-sdk', namespace: 'taxea-test' }));
      builder.onResolve({ filter: /^\.\/accountingEngine\.ts$/ }, () => ({ path: 'accounting-engine', namespace: 'taxea-test' }));
      builder.onLoad({ filter: /^base44-sdk$/, namespace: 'taxea-test' }, () => ({ loader: 'js', contents: 'export function createClientFromRequest(){return globalThis.__base44TestClient}' }));
      builder.onLoad({ filter: /^accounting-engine$/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: `
          export const SCHEMA_VERSION = 'pgc8-v1';
          export const buildInvoicePosting = (...args) => globalThis.__buildInvoicePosting(...args);
          export const commitJournalEntry = (...args) => globalThis.__commitJournalEntry(...args);
          export const createJournalEntry = (...args) => globalThis.__createJournalEntry(...args);
          export const postBankReconciliation = (...args) => globalThis.__postBankReconciliation(...args);
          export const postInvoice = (...args) => globalThis.__postInvoice(...args);
          export const seedOperationalPgc = async () => ({ created: 0 });
          export const ensureAccount = async () => { throw new Error('No se crea otra cuenta de banco ni de tercero en este test'); };
          export const updatePostingOperation = (...args) => globalThis.__updatePostingOperation(...args);
        `,
      }));
    },
  }],
});

const now = '2026-09-13T10:00:00.000Z';
const records = {
  Company: [{ id: 'company-a', owner_email: 'owner@a.test', usuarios_autorizados: [] }],
  Invoice: [
    { id: 'invoice-manual', company_id: 'company-a', tipo: 'emitida', numero_factura: 'F-1', fecha_emision: '2026-09-01', total_factura: 121, moneda: 'EUR', estado_cobro: 'pendiente', linked_journal_entry_id: 'invoice-entry-1', counterparty_account_id: 'account-customer', counterparty_account_code: '43000000' },
    { id: 'invoice-bank', company_id: 'company-a', tipo: 'emitida', numero_factura: 'F-2', fecha_emision: '2026-09-02', total_factura: 50, moneda: 'EUR', estado_cobro: 'pendiente', linked_journal_entry_id: 'invoice-entry-2', counterparty_account_id: 'account-customer', counterparty_account_code: '43000000' },
  ],
  InvoicePayment: [],
  InvoiceTimelineEvent: [],
  AccountingPostingOperation: [],
  JournalEntry: [],
  JournalEntryLine: [{id:'original-third',journalEntryId:'invoice-entry-1',companyId:'company-a',accountId:'account-historical',accountCode:'43000001',sourceLineType:'tercero',debit:121,credit:0}],
  AccountingAccount: [
    { id: 'account-bank-generic', companyId: 'company-a', code: '57200000', name: 'Bancos', type: 'banco', status: 'activa' },
    { id: 'account-bank-real', companyId: 'company-a', code: '57200001', name: 'Banco prueba', type: 'banco', status: 'activa' },
    { id: 'account-customer', companyId: 'company-a', code: '43000000', name: 'Cliente', type: 'cliente', status: 'activa' },
    { id: 'account-historical', companyId: 'company-a', code: '43000001', name: 'Cliente histórico; conservar', type: 'cliente', status: 'activa' },
  ],
  BankAccount: [{ id: 'bank-account-1', company_id: 'company-a', nombre_banco: 'Banco prueba', moneda: 'EUR', activa: true }],
  BankTransaction: [{ id: 'bank-tx-1', company_id: 'company-a', bank_account_id: 'bank-account-1', fecha_operacion: '2026-09-10', concepto: 'Cobro F-2', referencia: 'F-2', importe: 50, moneda: 'EUR', tipo: 'entrada', estado_conciliacion: 'sin_conciliar', estado_proveedor: 'booked', es_demo: false }],
};
const counters = {};
const matches = (row, query) => Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
let failNextCommit = false;
let failNextBankLink = false;
let failNextSummary = false;
let failSummaryRemaining = 0;
let failNextOperationRead = false;
const entity = name => ({
  async get(id) {
    if (name === 'AccountingPostingOperation' && failNextOperationRead) {
      failNextOperationRead = false;
      throw Object.assign(new Error('Rate limit exceeded'), { status: 429 });
    }
    return (records[name] || []).find(item => item.id === id) || null;
  },
  async filter(query) { return (records[name] || []).filter(row => matches(row, query)); },
  async create(payload) {
    counters[name] = (counters[name] || 0) + 1;
    const row = { id: `${name.toLowerCase()}-${counters[name]}`, created_date: now, ...payload };
    (records[name] ||= []).push(row);
    return row;
  },
  async update(id, payload) {
    if (name === 'Invoice' && Number(payload.importe_pagado) > 0 && (failNextSummary || failSummaryRemaining > 0)) {
      failNextSummary = false;
      if (failSummaryRemaining > 0) failSummaryRemaining--;
      throw Object.assign(new Error('Rate limit exceeded'), { status: 429 });
    }
    if (name === 'BankTransaction' && failNextBankLink && payload.estado_conciliacion === 'conciliada_manual') {
      failNextBankLink = false;
      throw new Error('Fallo simulado enlazando el banco');
    }
    const index = (records[name] || []).findIndex(item => item.id === id);
    if (index < 0) throw new Error(`${name} ${id} no existe`);
    records[name][index] = { ...records[name][index], ...payload };
    return records[name][index];
  },
  async delete(id) {
    const index = (records[name] || []).findIndex(item => item.id === id);
    if (index >= 0) records[name].splice(index, 1);
    return { id };
  },
});
const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });

async function createJournalEntry(_svc, companyId, payload) {
  let operation = records.AccountingPostingOperation.find(item => item.operationKey === payload.postingKey);
  let entry = records.JournalEntry.find(item => item.postingKey === payload.postingKey);
  if (operation && operation.status !== 'committed') operation = await entities.AccountingPostingOperation.update(operation.id, { status: 'preparing', stage: 'retry' });
  if (!operation) operation = await entities.AccountingPostingOperation.create({ companyId, operationKey: payload.postingKey, operationType: payload.operationType, payloadHash: payload.postingKey, status: 'preparing', stage: 'reserved' });
  if (!entry) entry = await entities.JournalEntry.create({ companyId, postingKey: payload.postingKey, status: 'borrador', date: payload.date, lines: payload.lines, accountingOperationId: operation.id });
  return { alreadyPosted: Boolean(entry.confirmedAt), entry, lines: payload.lines, operation };
}

async function commitJournalEntry(_svc, companyId, entry) {
  assert.equal(entry.companyId, companyId);
  if (failNextCommit) {
    failNextCommit = false;
    throw new Error('Fallo simulado confirmando el asiento');
  }
  const saved = await entities.JournalEntry.update(entry.id, { status: 'confirmado', confirmedAt: now });
  return { entry: saved, lines: saved.lines || [] };
}

async function updatePostingOperation(_svc, operation, payload) {
  return await entities.AccountingPostingOperation.update(operation.id, payload);
}

async function postBankReconciliation(svc, companyId, transaction, bank, counterparty, _userEmail, options) {
  return await createJournalEntry(svc, companyId, {
    date: transaction.fecha_operacion,
    postingKey: `bank:${transaction.id}:pgc8-v1`,
    operationType: 'bank_reconciliation',
    deferCommit: options.deferCommit,
    lines: [{ accountCode: bank.code, debit: transaction.importe, credit: 0 }, { accountCode: counterparty.code, debit: 0, credit: transaction.importe }],
  });
}

const testClient = { auth: { me: async () => ({ id: 'user-a', email: 'owner@a.test', role: 'user', data: { company_id: 'company-a' } }) }, asServiceRole: { entities } };
let handler;
const context = vm.createContext({
  console, Request, Response, URL, TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto, atob, btoa, setTimeout, clearTimeout,
  __base44TestClient: testClient,
  __buildInvoicePosting: async () => ({ counterparty: { account: records.AccountingAccount.find(item => item.id === 'account-customer') } }),
  __commitJournalEntry: commitJournalEntry,
  __createJournalEntry: createJournalEntry,
  __postBankReconciliation: postBankReconciliation,
  __postInvoice: async (_svc, _companyId, invoice) => ({ alreadyPosted: true, entry: { id: invoice.linked_journal_entry_id, companyId: invoice.company_id, status: 'confirmado' } }),
  __updatePostingOperation: updatePostingOperation,
  Deno: { serve(fn) { handler = fn; }, env: { get() { return ''; } } },
});
vm.runInContext(build.outputFiles[0].text, context, { filename: 'invoiceOperations.payment-unit.bundle.cjs' });

async function invoke(body) {
  const response = await handler(new Request('https://taxea.test/functions/invoiceOperations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  return { response, payload: await response.json() };
}

failNextCommit = true;
const manualFailed = await invoke({ action: 'add_payment', company_id: 'company-a', invoice_id: 'invoice-manual', amount: 121, payment_date: '2026-09-10', method: 'transferencia', idempotency_key: 'manual-unit-1' });
assert.equal(manualFailed.response.status, 500);
assert.equal(records.InvoicePayment.length, 1);
assert.equal(records.InvoicePayment[0].operation_status, 'recovery_required');
assert.equal(records.AccountingPostingOperation[0].status, 'recovery_required');
assert.equal(records.Invoice.find(item => item.id === 'invoice-manual').importe_pagado, 0);

const manualRecovered = await invoke({ action: 'add_payment', company_id: 'company-a', invoice_id: 'invoice-manual', amount: 121, payment_date: '2026-09-10', method: 'transferencia', idempotency_key: 'manual-unit-1' });
assert.equal(manualRecovered.response.status, 200);
assert.equal(manualRecovered.payload.duplicate, true);
assert.equal(records.InvoicePayment.length, 1);
assert.equal(records.InvoicePayment[0].operation_status, 'committed');
assert.equal(records.AccountingPostingOperation[0].status, 'committed');
assert.equal(records.Invoice.find(item => item.id === 'invoice-manual').importe_pendiente, 0);

const manualRepeated = await invoke({ action: 'add_payment', company_id: 'company-a', invoice_id: 'invoice-manual', amount: 121, payment_date: '2026-09-10', method: 'transferencia', idempotency_key: 'manual-unit-1' });
assert.equal(manualRepeated.response.status, 200);
assert.equal(records.InvoicePayment.length, 1);
assert.equal(records.JournalEntry.filter(item => item.postingKey?.startsWith('payment:invoice-manual')).length, 1);

const manualEntry = records.JournalEntry.find(row=>row.postingKey?.startsWith('payment:invoice-manual'));
assert.equal(manualEntry.lines.find(row=>row.sourceLineType==='tercero').accountCode,'43000001','Debe cancelar la subcuenta histórica del asiento, no inferir otra');
assert.equal(records.AccountingAccount.filter(row=>row.type==='cliente').length,2);

failNextBankLink = true;
const bankFailed = await invoke({ action: 'reconcile', company_id: 'company-a', invoice_id: 'invoice-bank', bank_transaction_id: 'bank-tx-1', bank_accounting_account_id: 'account-bank-real' });
assert.equal(bankFailed.response.status, 500);
const bankPayment = records.InvoicePayment.find(item => item.bank_transaction_id === 'bank-tx-1');
assert.equal(bankPayment.operation_status, 'recovery_required');
assert.equal(records.AccountingPostingOperation.find(item => item.operationKey === 'bank:bank-tx-1:pgc8-v1').status, 'recovery_required');
assert.equal(records.BankTransaction[0].estado_conciliacion, 'sin_conciliar');

const bankRecovered = await invoke({ action: 'reconcile', company_id: 'company-a', invoice_id: 'invoice-bank', bank_transaction_id: 'bank-tx-1', bank_accounting_account_id: 'account-bank-real' });
assert.equal(bankRecovered.response.status, 200);
assert.equal(bankRecovered.payload.duplicate, true);
assert.equal(records.InvoicePayment.filter(item => item.bank_transaction_id === 'bank-tx-1').length, 1);
assert.equal(records.JournalEntry.filter(item => item.postingKey === 'bank:bank-tx-1:pgc8-v1').length, 1);
assert.equal(records.BankTransaction[0].estado_conciliacion, 'conciliada_manual');
assert.equal(records.Invoice.find(item => item.id === 'invoice-bank').importe_pendiente, 0);
assert.equal(records.InvoiceTimelineEvent.filter(item => item.invoice_id === 'invoice-bank' && item.event_type === 'conciliacion_bancaria').length, 1);

records.Invoice.push({ id:'invoice-summary', company_id:'company-a', tipo:'emitida', numero_factura:'F-SUMMARY', fecha_emision:'2026-09-01', total_factura:121, moneda:'EUR', estado_cobro:'pendiente', linked_journal_entry_id:'invoice-entry-summary' });
records.JournalEntryLine.push({id:'original-summary-third',journalEntryId:'invoice-entry-summary',companyId:'company-a',accountId:'account-historical',accountCode:'43000001',sourceLineType:'tercero',debit:121,credit:0});
failSummaryRemaining = 2;
const summaryRequest = { action:'add_payment', company_id:'company-a', invoice_id:'invoice-summary', amount:121, payment_date:'2026-09-10', method:'transferencia', idempotency_key:'summary-commit-once' };
const summaryPending = await invoke(summaryRequest);
assert.equal(summaryPending.response.status,200);
assert.equal(summaryPending.payload.ok,true);
assert.equal(summaryPending.payload.paid,121);
assert.equal(summaryPending.payload.outstanding,0);
assert.match(summaryPending.payload.summary_warning,/pagos confirmados/);
assert.equal(records.InvoicePayment.filter(item=>item.invoice_id==='invoice-summary').length,1);
assert.equal(records.InvoicePayment.find(item=>item.invoice_id==='invoice-summary').operation_status,'committed');
const summaryRecovered = await invoke(summaryRequest);
assert.equal(summaryRecovered.response.status,200);
assert.equal(records.InvoicePayment.filter(item=>item.invoice_id==='invoice-summary').length,1);
assert.equal(records.JournalEntry.filter(item=>item.postingKey?.startsWith('payment:invoice-summary')).length,1);
const staleSummaryInvoice = records.Invoice.find(item=>item.id==='invoice-summary');
staleSummaryInvoice.importe_pagado=0; staleSummaryInvoice.importe_pendiente=121; staleSummaryInvoice.estado_cobro='pendiente';
failNextSummary=true;
const repairedProjection=await invoke({action:'list_payments',company_id:'company-a',invoice_id:'invoice-summary'});
assert.equal(repairedProjection.response.status,200);
assert.equal(repairedProjection.payload.summary_warning,undefined);
assert.equal(staleSummaryInvoice.id,'invoice-summary');
assert.equal(records.Invoice.find(item=>item.id==='invoice-summary').importe_pagado,121);
assert.equal(records.InvoicePayment.filter(item=>item.invoice_id==='invoice-summary').length,1);
failNextOperationRead = true;
const temporaryRead = await invoke({action:'list_payments',company_id:'company-a',invoice_id:'invoice-summary'});
assert.equal(temporaryRead.response.status,429);
assert.equal(records.Invoice.find(item=>item.id==='invoice-summary').importe_pagado,121,'Un 429 no borra el estado de un cobro confirmado');

await entities.JournalEntry.create({id:'invoice-entry-1',companyId:'company-a',entryNumber:'QA-1',date:'2026-09-01',status:'confirmado'});
// La línea de tercero procede del asiento original y ya existía antes del cobro.
await entities.JournalEntryLine.create({journalEntryId:'invoice-entry-1',companyId:'company-a',accountCode:'70500000',debit:0,credit:100});
await entities.JournalEntryLine.create({journalEntryId:'invoice-entry-1',companyId:'company-a',accountCode:'47700000',debit:0,credit:21});
const entryRead=await invoke({action:'get_accounting_entry',company_id:'company-a',invoice_id:'invoice-manual'});
assert.equal(entryRead.response.status,200);
assert.equal(entryRead.payload.entry.balanced,true);
assert.equal(entryRead.payload.entry.totalDebit,121);
assert.equal(entryRead.payload.lines[0].accountCode,'43000001');
records.JournalEntry.find(row=>row.id==='invoice-entry-1').companyId='company-foreign';
const foreignEntryRead=await invoke({action:'get_accounting_entry',company_id:'company-a',invoice_id:'invoice-manual'});
assert.equal(foreignEntryRead.response.status,409);
assert.equal(foreignEntryRead.payload.lines,undefined);
console.log(JSON.stringify({
  ok: true,
  assertions: {
    interruptedManualPaymentIsHidden: true,
    manualPaymentRetryRecoversWithoutDuplicates: true,
    interruptedBankLinkReturnsUnitToRecovery: true,
    bankReconciliationRetryCommitsOnce: true,
    successfulRecoveryLeavesOneAuditEvent: true,
    summaryFailureNeverReportsCommittedPaymentAsFailed: true,
    summaryRecoveryDoesNotDuplicatePayment: true,
    transientOperationReadNeverHidesCommittedCash: true,
    realPostedJournalReadIsBalancedAndCompanyScoped: true,
    paymentUsesHistoricalPostedSubaccountWithoutReinferringOrCreatingAccounts: true,
  },
  counts: { payments: records.InvoicePayment.length, journalEntries: records.JournalEntry.length, operations: records.AccountingPostingOperation.length },
}, null, 2));

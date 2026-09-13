import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/accountingOperations/entry.ts');
const build = await esbuild.build({
  stdin: { contents: fs.readFileSync(entry, 'utf8'), loader: 'ts', resolveDir: path.dirname(entry), sourcefile: entry },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  plugins: [{
    name: 'manual-financial-runtime-stubs',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'base44-sdk', namespace: 'taxea-test' }));
      builder.onResolve({ filter: /^\.\/accountingEngine\.ts$/ }, () => ({ path: 'accounting-engine', namespace: 'taxea-test' }));
      builder.onResolve({ filter: /^\.\/accountingReportEngine\.ts$/ }, () => ({ path: 'accounting-report', namespace: 'taxea-test' }));
      builder.onResolve({ filter: /^\.\/accountingPeriodEngine\.ts$/ }, () => ({ path: 'accounting-period', namespace: 'taxea-test' }));
      builder.onLoad({ filter: /^base44-sdk$/, namespace: 'taxea-test' }, () => ({
        loader: 'js', contents: 'export function createClientFromRequest(){return globalThis.__base44TestClient}',
      }));
      builder.onLoad({ filter: /^accounting-engine$/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: `
          export const SCHEMA_VERSION = 'pgc8-v1';
          export const canonical8 = value => { const digits=String(value||'').replace(/\\D/g,''); if(!digits||digits.length>8) throw new Error('Cuenta no válida'); return digits.padEnd(8,'0'); };
          export const isCanonical8 = value => /^\\d{8}$/.test(String(value||''));
          export const assertAccountingDateOpen = async () => ({ year: 2026 });
          export const buildInvoicePosting = async () => ({});
          export const createJournalEntry = (...args) => globalThis.__createJournalEntry(...args);
          export const ensureAccount = (...args) => globalThis.__ensureAccount(...args);
          export const postBankReconciliation = async () => ({});
          export const postInvoice = async () => ({});
          export const seedOperationalPgc = async () => ({ created: 0 });
        `,
      }));
      builder.onLoad({ filter: /^accounting-report$/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: `
          export const accountingData = async () => ({ entries: [], lines: [], linesByEntry: new Map() });
          export const accountingQuality = () => ({});
          export const buildJournal = () => ({});
          export const buildLedger = () => ({});
          export const buildReports = () => ({});
          export const fetchAll = async entity => entity.filter({}, '-created_date', 100000);
        `,
      }));
      builder.onLoad({ filter: /^accounting-period$/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: `
          export const closingPreview = async () => ({});
          export const executeClosing = async () => ({});
          export const listFiscalYears = async () => [];
          export const saveFiscalYear = async () => ({});
          export const setPeriodLock = async () => ({});
        `,
      }));
    },
  }],
});

const records = {
  Company: [
    { id: 'company-a', tipo_impuesto: 'iva', owner_email: 'owner@a.test', usuarios_autorizados: [] },
    { id: 'company-b', tipo_impuesto: 'iva', owner_email: 'owner@b.test', usuarios_autorizados: [] },
  ],
  Expense: [],
  JournalEntry: [],
  JournalEntryLine: [],
  AccountingConfiguration: [],
};
const counters = { Expense: 0, JournalEntry: 0, JournalEntryLine: 0 };
const matches = (row, query) => Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
const entity = name => ({
  async get(id) { return (records[name] || []).find(item => item.id === id) || null; },
  async filter(query) { return (records[name] || []).filter(row => matches(row, query)); },
  async create(payload) {
    counters[name] = (counters[name] || 0) + 1;
    const row = { id: `${name.toLowerCase()}-${counters[name]}`, created_date: new Date().toISOString(), ...payload };
    (records[name] ||= []).push(row);
    return row;
  },
  async update(id, payload) {
    const index = (records[name] || []).findIndex(item => item.id === id);
    if (index < 0) throw new Error(`${name} ${id} no existe`);
    records[name][index] = { ...records[name][index], ...payload };
    return records[name][index];
  },
  async bulkCreate(payloads) { return await Promise.all(payloads.map(payload => entity(name).create(payload))); },
});
const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });
let currentUser = { id: 'user-a', email: 'user@a.test', role: 'user', data: { company_id: 'company-a' } };
const testClient = { auth: { me: async () => currentUser }, asServiceRole: { entities } };
let handler;
const context = vm.createContext({
  console,
  Request,
  Response,
  URL,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  crypto: webcrypto,
  atob,
  btoa,
  setTimeout,
  clearTimeout,
  __base44TestClient: testClient,
  __ensureAccount: async (_svc, companyId, code, name, type) => ({ id: `account-${companyId}-${code}`, companyId, code, name, type, status: 'activa' }),
  __createJournalEntry: async (_svc, companyId, payload) => {
    counters.JournalEntry += 1;
    const entryRow = {
      id: `journalentry-${counters.JournalEntry}`,
      companyId,
      entryNumber: `2026-${String(counters.JournalEntry).padStart(6, '0')}`,
      status: payload.status || 'confirmado',
      ...payload,
    };
    records.JournalEntry.push(entryRow);
    const lines = payload.lines.map((line, index) => {
      counters.JournalEntryLine += 1;
      const row = { id: `journalline-${counters.JournalEntryLine}`, journalEntryId: entryRow.id, companyId, lineNumber: index + 1, entryStatus: entryRow.status, ...line };
      records.JournalEntryLine.push(row);
      return row;
    });
    const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    assert.ok(Math.abs(debit - credit) <= 0.01, 'El asiento simulado debe cuadrar.');
    return { entry: entryRow, lines };
  },
  Deno: { serve(fn) { handler = fn; }, env: { get() { return ''; } } },
});
vm.runInContext(build.outputFiles[0].text, context, { filename: 'accountingOperations.manual.bundle.cjs' });
assert.equal(typeof handler, 'function');

async function invoke(body) {
  const response = await handler(new Request('https://taxea.test/functions/accountingOperations', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { response, payload: await response.json() };
}

const validRecord = {
  tipo: 'gasto', fecha: '2026-04-10', proveedor_cliente: 'Proveedor manual', concepto: 'Material menor',
  categoria: 'compras', base_imponible: 100, tipo_impuesto: 21, cuota_impuesto: 21,
  retencion_irpf: 0, importe_retencion: 0, total: 121, treasury_account_code: '57000000',
};

const created = await invoke({ action: 'create_manual_financial_record', companyId: 'company-a', idempotencyKey: 'manual-1', record: validRecord });
assert.equal(created.response.status, 200);
assert.equal(created.payload.success, true);
assert.equal(records.Expense.length, 1);
assert.equal(records.JournalEntry.length, 1);
assert.equal(created.payload.record.estado, 'contabilizado');

const repeated = await invoke({ action: 'create_manual_financial_record', companyId: 'company-a', idempotencyKey: 'manual-1', record: validRecord });
assert.equal(repeated.response.status, 200);
assert.equal(repeated.payload.idempotent, true);
assert.equal(records.Expense.length, 1);
assert.equal(records.JournalEntry.length, 1);

const reusedWithDifferentData = await invoke({
  action: 'create_manual_financial_record', companyId: 'company-a', idempotencyKey: 'manual-1',
  record: { ...validRecord, concepto: 'Otro concepto' },
});
assert.equal(reusedWithDifferentData.response.status, 409);

const postedUpdate = await invoke({
  action: 'update_manual_financial_record', companyId: 'company-a', expenseId: created.payload.record.id,
  record: { ...validRecord, concepto: 'Intento de edición' },
});
assert.equal(postedUpdate.response.status, 409);

const voided = await invoke({
  action: 'void_manual_financial_record', companyId: 'company-a', expenseId: created.payload.record.id,
  reason: 'Corrección de prueba', date: '2026-04-11',
});
assert.equal(voided.response.status, 200);
assert.equal(voided.payload.record.anulada, true);
assert.equal(records.JournalEntry.length, 2);
const reversal = records.JournalEntry[1];
assert.equal(reversal.sourceEvent, 'manual_financial_record_reversal');

const repeatedVoid = await invoke({
  action: 'void_manual_financial_record_record', companyId: 'company-a', expenseId: created.payload.record.id,
  reason: 'Corrección de prueba', date: '2026-04-11',
});
assert.equal(repeatedVoid.response.status, 400);

const idempotentVoid = await invoke({
  action: 'void_manual_financial_record', companyId: 'company-a', expenseId: created.payload.record.id,
  reason: 'Corrección de prueba', date: '2026-04-11',
});
assert.equal(idempotentVoid.response.status, 200);
assert.equal(idempotentVoid.payload.alreadyAnnulled, true);
assert.equal(records.JournalEntry.length, 2);

currentUser = { id: 'foreign', email: 'foreign@test.test', role: 'user', data: { company_id: 'company-b' } };
const crossTenant = await invoke({ action: 'create_manual_financial_record', companyId: 'company-a', idempotencyKey: 'foreign', record: validRecord });
assert.equal(crossTenant.response.status, 403);
assert.equal(records.Expense.length, 1);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    manualRecordAndBalancedPostingCreatedOnce: true,
    retryIsIdempotent: true,
    changedPayloadCannotReuseKey: true,
    postedRecordCannotBeMut: true,
    voidCreatesTraceableReversalOnce: true,
    crossTenantCreateBlocked: true,
  },
}, null, 2));

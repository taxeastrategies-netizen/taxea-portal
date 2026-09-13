import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/invoiceOperations/entry.ts');
const build = await esbuild.build({
  stdin: { contents: fs.readFileSync(entry, 'utf8'), loader: 'ts', resolveDir: path.dirname(entry), sourcefile: entry },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  plugins: [{
    name: 'invoice-create-runtime-stubs',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'base44-sdk', namespace: 'taxea-test' }));
      builder.onResolve({ filter: /^\.\/accountingEngine\.ts$/ }, () => ({ path: 'accounting-engine', namespace: 'taxea-test' }));
      builder.onLoad({ filter: /^base44-sdk$/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: 'export function createClientFromRequest(){return globalThis.__base44TestClient}',
      }));
      builder.onLoad({ filter: /^accounting-engine$/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: `
          export const SCHEMA_VERSION = 'pgc8-v1';
          export const buildInvoicePosting = (...args) => globalThis.__buildInvoicePosting(...args);
          export const createJournalEntry = (...args) => globalThis.__createJournalEntry(...args);
          export const postBankReconciliation = (...args) => globalThis.__postBankReconciliation(...args);
          export const postInvoice = (...args) => globalThis.__postInvoice(...args);
          export const seedOperationalPgc = (...args) => globalThis.__seedOperationalPgc(...args);
        `,
      }));
    },
  }],
});

const records = {
  Company: [
    { id: 'company-a', owner_email: 'owner@a.test', usuarios_autorizados: [] },
    { id: 'company-b', owner_email: 'owner@b.test', usuarios_autorizados: [] },
  ],
  Invoice: [],
  InvoiceTimelineEvent: [],
};
const counters = { Invoice: 0, InvoiceTimelineEvent: 0, accountingEntries: 0 };
const matches = (row, query) => Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
const entity = name => ({
  async get(id) { return records[name]?.find(item => item.id === id) || null; },
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
  __buildInvoicePosting: async () => ({ counterparty: { account: {} } }),
  __createJournalEntry: async () => ({ entry: { id: 'unused' } }),
  __postBankReconciliation: async () => ({ entry: { id: 'unused' } }),
  __seedOperationalPgc: async () => ({ created: 0 }),
  __postInvoice: async (_svc, companyId, invoice) => {
    if (invoice.linked_journal_entry_id) return { alreadyPosted: true, entry: { id: invoice.linked_journal_entry_id } };
    counters.accountingEntries += 1;
    const entryRow = { id: `entry-${counters.accountingEntries}`, companyId, status: 'confirmado' };
    await entities.Invoice.update(invoice.id, {
      linked_journal_entry_id: entryRow.id,
      estado_contable: 'contabilizada',
      accounting_review_status: 'validada_contabilizada',
    });
    return { alreadyPosted: false, entry: entryRow };
  },
  Deno: { serve(fn) { handler = fn; }, env: { get() { return ''; } } },
});
vm.runInContext(build.outputFiles[0].text, context, { filename: 'invoiceOperations.bundle.cjs' });
assert.equal(typeof handler, 'function');

async function invoke(body) {
  const response = await handler(new Request('https://taxea.test/functions/invoiceOperations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { response, payload: await response.json() };
}

const validInvoice = {
  tipo: 'emitida', numero_factura: 'F-2026-001', fecha_emision: '2026-04-10',
  cliente_nombre: 'Cliente Uno', cliente_nif: 'B11111111', concepto: 'Servicio',
  base_imponible: 100, tipo_iva: 21, cuota_iva: 21, retencion_irpf: 0,
  importe_retencion: 0, total_factura: 121,
};

const created = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'create-1', invoice: validInvoice });
assert.equal(created.response.status, 200);
assert.equal(created.payload.ok, true);
assert.equal(records.Invoice.length, 1);
assert.equal(counters.accountingEntries, 1);

const repeated = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'create-1', invoice: validInvoice });
assert.equal(repeated.response.status, 200);
assert.equal(repeated.payload.duplicate, true);
assert.equal(records.Invoice.length, 1);
assert.equal(counters.accountingEntries, 1);

const reusedWithDifferentData = await invoke({
  action: 'create_invoice', company_id: 'company-a', idempotency_key: 'create-1',
  invoice: { ...validInvoice, numero_factura: 'F-2026-009' },
});
assert.equal(reusedWithDifferentData.response.status, 409);

const duplicateNumber = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'create-2', invoice: validInvoice });
assert.equal(duplicateNumber.response.status, 409);

const invalidTotal = await invoke({
  action: 'create_invoice', company_id: 'company-a', idempotency_key: 'invalid-total',
  invoice: { ...validInvoice, numero_factura: 'F-2026-002', total_factura: 120 },
});
assert.equal(invalidTotal.response.status, 400);

currentUser = { id: 'foreign', email: 'foreign@test.test', role: 'user', data: { company_id: 'company-b' } };
const crossTenant = await invoke({
  action: 'create_invoice', company_id: 'company-a', idempotency_key: 'foreign',
  invoice: { ...validInvoice, numero_factura: 'F-2026-003' },
});
assert.equal(crossTenant.response.status, 403);
assert.equal(records.Invoice.length, 1);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    invoiceCreatedAndPostedOnce: true,
    retryIsIdempotent: true,
    changedPayloadCannotReuseKey: true,
    duplicateActiveNumberBlocked: true,
    inconsistentTotalBlocked: true,
    crossTenantCreateBlocked: true,
  },
}, null, 2));

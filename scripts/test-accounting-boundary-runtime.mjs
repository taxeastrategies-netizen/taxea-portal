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
    name: 'base44-accounting-test-stub',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'base44-sdk', namespace: 'taxea-test' }));
      builder.onLoad({ filter: /.*/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: 'export function createClientFromRequest(){return globalThis.__base44TestClient}',
      }));
    },
  }],
});

const records = {
  Company: [
    { id: 'company-a', owner_email: 'owner@a.test', usuarios_autorizados: ['advisor@taxea.test'] },
    { id: 'company-b', owner_email: 'owner@b.test', usuarios_autorizados: [] },
  ],
  Invoice: [
    { id: 'invoice-open', company_id: 'company-a', estado_contable: 'pendiente', anulada: false },
    { id: 'invoice-posted', company_id: 'company-a', estado_contable: 'contabilizada', anulada: false, linked_journal_entry_id: 'entry-active' },
    { id: 'invoice-foreign', company_id: 'company-b', estado_contable: 'pendiente', anulada: false },
  ],
  JournalEntry: [{ id: 'entry-active', companyId: 'company-a', status: 'confirmado' }],
};

const entity = name => ({
  async get(id) { return records[name]?.find(item => item.id === id) || null; },
  async update(id, payload) {
    const index = records[name]?.findIndex(item => item.id === id) ?? -1;
    if (index < 0) throw new Error(`${name} ${id} no existe`);
    records[name][index] = { ...records[name][index], ...payload };
    return records[name][index];
  },
  async filter() { return []; },
  async create(payload) { return { id: `${name}-created`, ...payload }; },
});
const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });
let currentUser = { id: 'user-a', email: 'user@a.test', role: 'user', data: { company_id: 'company-a' } };
const testClient = { auth: { me: async () => currentUser }, asServiceRole: { entities } };
let handler;
const context = vm.createContext({
  console,
  Request,
  Response,
  TextEncoder,
  TextDecoder,
  crypto: webcrypto,
  atob,
  btoa,
  setTimeout,
  clearTimeout,
  __base44TestClient: testClient,
  Deno: { serve(fn) { handler = fn; }, env: { get() { return ''; } } },
});
vm.runInContext(build.outputFiles[0].text, context, { filename: 'accountingOperations.bundle.cjs' });
assert.equal(typeof handler, 'function');

async function invoke(body) {
  const response = await handler(new Request('https://taxea.test/functions/accountingOperations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { response, payload: await response.json() };
}

const rejected = await invoke({ action: 'reject_invoice_accounting', companyId: 'company-a', invoiceId: 'invoice-open' });
assert.equal(rejected.response.status, 200);
assert.equal(rejected.payload.success, true);
assert.equal(rejected.payload.invoice.estado_contable, 'rechazada');
assert.equal(rejected.payload.invoice.accounting_migration_hold, true);
assert.equal(rejected.payload.invoice.accounting_review_status, 'requiere_correccion');

const repeated = await invoke({ action: 'reject_invoice_accounting', companyId: 'company-a', invoiceId: 'invoice-open' });
assert.equal(repeated.payload.idempotent, true);

const posted = await invoke({ action: 'reject_invoice_accounting', companyId: 'company-a', invoiceId: 'invoice-posted' });
assert.equal(posted.response.status, 409);
assert.equal(records.Invoice.find(item => item.id === 'invoice-posted').estado_contable, 'contabilizada');

const foreignInvoice = await invoke({ action: 'reject_invoice_accounting', companyId: 'company-a', invoiceId: 'invoice-foreign' });
assert.equal(foreignInvoice.response.status, 404);

currentUser = { id: 'advisor', email: 'advisor@taxea.test', role: 'advisor', data: {} };
const advisorAccess = await invoke({ action: 'reject_invoice_accounting', companyId: 'company-a', invoiceId: 'invoice-open' });
assert.equal(advisorAccess.response.status, 200);

currentUser = { id: 'advisor-other', email: 'advisor@taxea.test', role: 'advisor', data: {} };
const unrelatedCompany = await invoke({ action: 'reject_invoice_accounting', companyId: 'company-b', invoiceId: 'invoice-foreign' });
assert.equal(unrelatedCompany.response.status, 403);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    rejectionIsBackendOnlyAndHeld: true,
    rejectionIsIdempotent: true,
    postedInvoiceCannotBeRejected: true,
    invoiceTenantIsChecked: true,
    explicitlyAuthorizedAdvisorAllowed: true,
    unrelatedAdvisorDenied: true,
  },
}, null, 2));

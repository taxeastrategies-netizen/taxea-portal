import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/taxAccountingCertification/entry.ts');
const build = await esbuild.build({
  stdin: { contents: fs.readFileSync(entry, 'utf8'), loader: 'ts', resolveDir: path.dirname(entry), sourcefile: entry },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  plugins: [{
    name: 'base44-certification-test-stub',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'base44-sdk', namespace: 'taxea-test' }));
      builder.onLoad({ filter: /.*/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: 'export function createClientFromRequest(){return globalThis.__base44TestClient}',
      }));
    },
  }],
});

const company = { id: 'company-a', razon_social: 'Empresa QA', owner_email: 'owner@a.test', usuarios_autorizados: ['advisor@taxea.test'] };
const records = {
  Invoice: [{ id: 'invoice-1', company_id: 'company-a', estado_contable: 'contabilizada', linked_journal_entry_id: 'entry-1' }],
  Expense: [],
  JournalEntry: [{ id: 'entry-1', companyId: 'company-a', entryNumber: '1', ejercicio: 2026, date: '2026-01-01', status: 'confirmado', postingKey: 'invoice:invoice-1' }],
  JournalEntryLine: [
    { id: 'line-1', companyId: 'company-a', journalEntryId: 'entry-1', accountCode: '43000001', debit: 121, credit: 0 },
    { id: 'line-2', companyId: 'company-a', journalEntryId: 'entry-1', accountCode: '70500000', debit: 0, credit: 100 },
    { id: 'line-3', companyId: 'company-a', journalEntryId: 'entry-1', accountCode: '47700000', debit: 0, credit: 21 },
  ],
  InvoiceTaxLine: [{ id: 'tax-1', companyId: 'company-a', invoiceId: 'invoice-1', reviewStatus: 'validado' }],
  InvoicePayment: [], BankAccount: [], BankTransaction: [], AccountingAccount: [], TaxDraft: [], TaxFiling: [], TaxOfficialFile: [], TaxPeriod: [], TaxModel: [], FiscalProfile: [],
};
let writeAttempts = 0;
const filters = [];
const entity = name => ({
  async get(id) { return name === 'Company' && id === company.id ? company : records[name]?.find(item => item.id === id) || null; },
  async filter(query = {}, _sort = '', limit = 5000, skip = 0) {
    filters.push({ name, query });
    return (records[name] || []).filter(item => Object.entries(query).every(([key, value]) => item[key] === value)).slice(skip, skip + limit);
  },
  async create() { writeAttempts += 1; throw new Error('read_only_violation'); },
  async update() { writeAttempts += 1; throw new Error('read_only_violation'); },
  async delete() { writeAttempts += 1; throw new Error('read_only_violation'); },
});
const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });
let currentUser = { id: 'user-a', email: 'user@a.test', role: 'user', data: { company_id: 'company-a' } };
const client = { auth: { me: async () => currentUser }, asServiceRole: { entities } };
let handler;
const context = vm.createContext({
  console, Request, Response, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  __base44TestClient: client,
  Deno: { serve(fn) { handler = fn; } },
});
vm.runInContext(build.outputFiles[0].text, context, { filename: 'taxAccountingCertification.bundle.cjs' });

async function invoke(body) {
  const response = await handler(new Request('https://taxea.test/functions/taxAccountingCertification', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { response, payload: await response.json() };
}

const overview = await invoke({ action: 'overview', companyId: 'company-a' });
assert.equal(overview.response.status, 200);
assert.equal(overview.payload.success, true);
assert.equal(overview.payload.certification.status, 'certified');
assert.equal(overview.payload.certification.guarantees.readOnly, true);
assert.equal(writeAttempts, 0);
assert.ok(filters.length >= 10);
assert.ok(filters.every(item => Object.values(item.query).includes('company-a')));

currentUser = { id: 'advisor', email: 'advisor@taxea.test', role: 'advisor', data: {} };
const authorizedAdvisor = await invoke({ action: 'overview', companyId: 'company-a' });
assert.equal(authorizedAdvisor.response.status, 200);

currentUser = { id: 'other', email: 'other@taxea.test', role: 'advisor', data: {} };
const denied = await invoke({ action: 'overview', companyId: 'company-a' });
assert.equal(denied.response.status, 403);
assert.equal(writeAttempts, 0);

console.log(JSON.stringify({ ok: true, assertions: { overviewIsReadOnly: true, allSourcesScoped: true, assignedUserAllowed: true, explicitAdvisorAllowed: true, unrelatedAdvisorDenied: true } }, null, 2));

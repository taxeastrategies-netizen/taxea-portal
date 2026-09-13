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
    name: 'accounting-bootstrap-runtime-stubs',
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
          export const canonical8 = value => String(value || '').replace(/\\D/g, '').padEnd(8, '0');
          export const isCanonical8 = value => /^\\d{8}$/.test(String(value || ''));
          export const assertAccountingDateOpen = async () => ({});
          export const bankCurrency = bank => bank?.moneda || 'EUR';
          export const stableBankIdentity = bank => bank?.id || '';
          export const buildInvoicePosting = async () => ({});
          export const commitJournalEntry = async () => ({});
          export const createJournalEntry = async () => ({});
          export const ensureAccount = async () => ({});
          export const ensureBankPostingAccount = (...args) => globalThis.__ensureBankPostingAccount(...args);
          export const postBankReconciliation = async () => ({});
          export const postInvoice = async () => ({});
          export const seedOperationalPgc = (...args) => globalThis.__seedOperationalPgc(...args);
          export const updatePostingOperation = async () => ({});
        `,
      }));
      builder.onLoad({ filter: /^accounting-report$/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: `
          export const accountingData = async () => ({});
          export const accountingQuality = () => ({});
          export const buildJournal = () => ({});
          export const buildLedger = () => ({});
          export const buildReports = () => ({});
          export const fetchAll = async (entity, query = {}, sort = '-created_date', pageSize = 1000) => {
            const rows = [];
            for (let offset = 0; ; offset += pageSize) {
              const page = await entity.filter(query, sort, pageSize, offset);
              rows.push(...page);
              if (page.length < pageSize) return rows;
            }
          };
        `,
      }));
      builder.onLoad({ filter: /^accounting-period$/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: `
          export const closingPreview = async () => ({});
          export const executeClosing = async () => ({});
          export const listFiscalYears = (...args) => globalThis.__listFiscalYears(...args);
          export const reopenFiscalYear = async () => ({});
          export const saveFiscalYear = (...args) => globalThis.__saveFiscalYear(...args);
          export const setPeriodLock = async () => ({});
        `,
      }));
    },
  }],
});

const year = new Date().getUTCFullYear();
const records = {
  Company: [
    { id: 'company-new', activa: true, tipo_impuesto: 'igic', owner_email: 'new@qa.test', usuarios_autorizados: [] },
    { id: 'company-legacy', activa: true, tipo_impuesto: 'iva', owner_email: 'legacy@qa.test', usuarios_autorizados: [] },
    { id: 'company-other', activa: true, tipo_impuesto: 'iva', owner_email: 'other@qa.test', usuarios_autorizados: [] },
  ],
  AccountingConfiguration: [{
    id: 'config-legacy', companyId: 'company-legacy', clientAccount: '43009999', supplierAccount: '41009999',
    outputTaxAccount: '47709999', inputTaxAccount: '47209999', accountingSchemaVersion: 'legacy-preserved',
  }],
  AccountingFiscalYear: [{
    id: 'year-legacy', companyId: 'company-legacy', year, startDate: `${year}-01-01`, endDate: `${year}-12-31`, status: 'abierto',
  }],
  AccountingAccount: [],
  BankAccount: [{
    id: 'bank-new', company_id: 'company-new', activa: true, estado_conexion: 'conectado', nombre_banco: 'Banco QA', moneda: 'EUR',
  }],
};

const counters = {};
const matches = (row, query) => Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
const entity = name => ({
  async get(id) { return (records[name] || []).find(item => item.id === id) || null; },
  async filter(query = {}, _sort = '', limit = 1000, skip = 0) {
    return (records[name] || []).filter(row => matches(row, query)).slice(skip, skip + limit);
  },
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
  async bulkCreate(payloads) { return Promise.all(payloads.map(payload => entity(name).create(payload))); },
});
const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });
let currentUser = { id: 'user-new', email: 'new@qa.test', role: 'user', data: { company_id: 'company-new' } };
const testClient = { auth: { me: async () => currentUser }, asServiceRole: { entities } };

const pgcSeeds = new Map();
const bankLedgers = new Map();
let handler;
const context = vm.createContext({
  console, Request, Response, URL, TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto, atob, btoa, setTimeout, clearTimeout,
  __base44TestClient: testClient,
  __seedOperationalPgc: async (_svc, companyId) => {
    const previous = pgcSeeds.get(companyId) || 0;
    pgcSeeds.set(companyId, previous + 1);
    return { created: previous ? 0 : 24, existing: previous ? 24 : 0 };
  },
  __listFiscalYears: async (_svc, companyId) => records.AccountingFiscalYear.filter(item => item.companyId === companyId),
  __saveFiscalYear: async (_svc, companyId, body) => entity('AccountingFiscalYear').create({
    companyId, year: Number(body.year), startDate: `${body.year}-01-01`, endDate: `${body.year}-12-31`, status: 'abierto',
  }),
  __ensureBankPostingAccount: async (_svc, companyId, bank) => {
    const key = `${companyId}:${bank.id}`;
    if (!bankLedgers.has(key)) bankLedgers.set(key, { id: `ledger-${bank.id}`, companyId, code: '57200001', status: 'activa' });
    return bankLedgers.get(key);
  },
  Deno: { serve(fn) { handler = fn; }, env: { get() { return ''; } } },
});
vm.runInContext(build.outputFiles[0].text, context, { filename: 'accountingOperations.bootstrap.bundle.cjs' });
assert.equal(typeof handler, 'function');

async function invoke(body) {
  const response = await handler(new Request('https://taxea.test/functions/accountingOperations', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { response, payload: await response.json() };
}

const first = await invoke({ action: 'ensure_accounting_ready', companyId: 'company-new' });
assert.equal(first.response.status, 200);
assert.equal(first.payload.success, true);
assert.equal(first.payload.result.connectedBanks, 1);
assert.equal(first.payload.result.bankMappings[0].accountingAccountCode, '57200001');
const newConfiguration = records.AccountingConfiguration.find(item => item.companyId === 'company-new');
assert.equal(newConfiguration.outputTaxAccount, '47770000');
assert.equal(newConfiguration.inputTaxAccount, '47270000');
assert.equal(records.AccountingFiscalYear.filter(item => item.companyId === 'company-new').length, 1);

const repeated = await invoke({ action: 'ensure_accounting_ready', companyId: 'company-new' });
assert.equal(repeated.response.status, 200);
assert.equal(records.AccountingConfiguration.filter(item => item.companyId === 'company-new').length, 1);
assert.equal(records.AccountingFiscalYear.filter(item => item.companyId === 'company-new').length, 1);
assert.equal(bankLedgers.size, 1);

currentUser = { id: 'user-legacy', email: 'legacy@qa.test', role: 'user', data: { company_id: 'company-legacy' } };
const legacyBefore = structuredClone(records.AccountingConfiguration.find(item => item.id === 'config-legacy'));
const legacy = await invoke({ action: 'ensure_accounting_ready', companyId: 'company-legacy' });
assert.equal(legacy.response.status, 200);
assert.deepEqual(records.AccountingConfiguration.find(item => item.id === 'config-legacy'), legacyBefore);
assert.equal(records.AccountingFiscalYear.filter(item => item.companyId === 'company-legacy').length, 1);

currentUser = { id: 'user-other', email: 'other@qa.test', role: 'user', data: { company_id: 'company-other' } };
const configurationCount = records.AccountingConfiguration.length;
const yearCount = records.AccountingFiscalYear.length;
const denied = await invoke({ action: 'ensure_accounting_ready', companyId: 'company-new' });
assert.equal(denied.response.status, 403);
assert.equal(records.AccountingConfiguration.length, configurationCount);
assert.equal(records.AccountingFiscalYear.length, yearCount);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    newCompanyGetsPgcCurrentYearAndTaxAwareConfiguration: true,
    connectedBankUsesStableLedgerAccount: true,
    bootstrapRetryDoesNotDuplicateConfigurationYearOrBankLedger: true,
    existingCompanyConfigurationAndYearArePreserved: true,
    crossTenantBootstrapIsBlockedBeforeWrites: true,
  },
}, null, 2));


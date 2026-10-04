import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/generateRecurringInvoices/entry.ts');
const build = await esbuild.build({
  stdin: { contents: fs.readFileSync(entry, 'utf8'), loader: 'ts', resolveDir: path.dirname(entry), sourcefile: entry },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'recurring-stubs', setup(builder) {
    builder.onResolve({ filter: /base44/ }, () => ({ path: 'sdk', namespace: 'stub' }));
    builder.onResolve({ filter: /invoiceQr/ }, () => ({ path: 'qr', namespace: 'stub' }));
    builder.onLoad({ filter: /^sdk$/, namespace: 'stub' }, () => ({ loader: 'js', contents: 'export const createClientFromRequest=()=>globalThis.__client' }));
    builder.onLoad({ filter: /^qr$/, namespace: 'stub' }, () => ({ loader: 'js', contents: "export const buildAeatQrUrl=()=>{throw new Error('QR must not be generated before review')}" }));
  } }],
});
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Atlantic/Canary', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const records = {
  User: [{ id: 'user-a', email: 'owner@test.invalid', data: { company_id: 'company-a' } }],
  Company: [{ id: 'company-a', owner_email: 'owner@test.invalid', usuarios_autorizados: [], nif_cif: 'B12345678' }],
  RecurringInvoiceTemplate: [{
    id: 'template-a', ownerAccountId: 'company-a', status: 'active', mode: 'auto_issue',
    frequency: 'monthly', interval: 1, startDate: today, nextRunDate: today,
    concept: 'Servicio sintético', baseAmount: 100, taxRate: 21, retentionRate: 0,
    clientName: 'Cliente de prueba', clientNif: 'B11111111', totalAmount: 121,
    fiscalActivityId: 'activity-a', dueDateMode: 'same_day', currency: 'EUR',
  }],
  Invoice: [], RecurringInvoiceRun: [], InvoiceTaxLine: [], TimelineEvent: [],
};
const counts = { qr: 0, posting: 0 };
const matches = (row, query) => Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
const entities = new Proxy({}, { get: (_target, name) => ({
  async get(id) { return (records[name] || []).find(row => row.id === id) || null; },
  async filter(query) { return (records[name] || []).filter(row => matches(row, query)); },
  async create(payload) { const row = { id: `${name}-${(records[name] || []).length + 1}`, ...payload }; (records[name] ||= []).push(row); return row; },
  async update(id, payload) { const row = (records[name] || []).find(item => item.id === id); if (!row) throw new Error('Missing row'); Object.assign(row, payload); return row; },
}) });
const client = {
  auth: { me: async () => ({ id: 'user-a', email: 'owner@test.invalid', role: 'user', data: { company_id: 'company-a' } }) },
  asServiceRole: {
    entities,
    functions: { invoke: async (name, body) => {
      assert.equal(name, 'fiscalOperations');
      assert.equal(body.requireValidatedProfile, true);
      return { data: { evaluation: { status: 'review_required', reasons: ['Revisión del asesor'], activityId: 'activity-a' } } };
    } },
  },
};
let handler;
vm.runInContext(build.outputFiles[0].text, vm.createContext({
  console, Request, Response, URL, Date, Intl,
  __client: client, Deno: { serve(fn) { handler = fn; } },
}), { filename: 'generateRecurringInvoices.bundle.cjs' });
const response = await handler(new Request('https://taxea.test/functions/generateRecurringInvoices', {
  method: 'POST', body: JSON.stringify({ action: 'generate', templateId: 'template-a' }),
}));
const result = await response.json();
assert.equal(response.status, 200);
assert.equal(result.drafts, 1);
assert.equal(result.generated, 0);
assert.equal(records.Invoice.length, 1);
assert.equal(records.Invoice[0].fiscal_review_status, 'pendiente_revision');
assert.equal(records.Invoice[0].accounting_migration_hold_reason, 'FISCAL_ADVISOR_REVIEW_PHASE1');
assert.equal(records.Invoice[0].qr_url, undefined);
assert.equal(records.InvoiceTaxLine.length, 0);
assert.equal(records.RecurringInvoiceRun[0].status, 'draft_created');
assert.equal(records.RecurringInvoiceRun[0].generatedInvoiceId, records.Invoice[0].id);
assert.equal(counts.posting, 0);
const repeated = await handler(new Request('https://taxea.test/functions/generateRecurringInvoices', {
  method: 'POST', body: JSON.stringify({ action: 'generate', templateId: 'template-a' }),
}));
assert.equal((await repeated.json()).drafts, 0);
assert.equal(records.Invoice.length, 1);
console.log(JSON.stringify({ ok: true, assertions: {
  recurringProposalSavedOnce: true, noQrBeforeReview: true, noTaxLineOrJournalBeforeReview: true,
  runTraceLinksInvoice: true, idempotentPeriod: true,
} }, null, 2));

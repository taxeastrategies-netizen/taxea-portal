import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/taxModelOperations/entry.ts');
const source = fs.readFileSync(entry, 'utf8').replaceAll('intervalMs:150,readRetries:3', 'intervalMs:0,readRetries:3');
const build = await esbuild.build({ stdin: { contents: source, loader: 'ts', resolveDir: path.dirname(entry) }, bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'sdk-stub', setup(builder) {
  builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'qa' }));
  builder.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: 'export function createClientFromRequest(){return globalThis.__client}', loader: 'js' }));
} }] });
let handler, records, user, writes = 0, checks = 0;
const company = { id: 'company-a', owner_email: 'a@qa.test', activa: true };
const match = (row, query) => Object.entries(query).every(([key, value]) => row[key] === value);
const entities = new Proxy({}, { get: (_, name) => ({
  get: async id => (records[name] || []).find(row => row.id === id) || null,
  filter: async (query = {}, _sort, limit = 500, skip = 0) => (records[name] || []).filter(row => match(row, query)).slice(skip, skip + limit),
  create: async () => { writes++; throw Error('No writes allowed'); }, update: async () => { writes++; throw Error('No writes allowed'); }, delete: async () => { writes++; throw Error('No writes allowed'); },
}) });
const context = vm.createContext({ console, Request, Response, TextEncoder, TextDecoder, crypto: webcrypto, atob, btoa, setTimeout, clearTimeout, __client: { auth: { me: async () => user }, asServiceRole: { entities } }, Deno: { serve(fn) { handler = fn; }, env: { get() { return ''; } } } });
vm.runInContext(build.outputFiles[0].text, context);
function fixture() {
  user = { id: 'a', email: 'a@qa.test', role: 'user' };
  records = { Company: [structuredClone(company)], User: [structuredClone(user)], FiscalProfile: [{ id: 'p', company_id: company.id, active: true, profileStatus: 'validado_asesor', entityType: 'autonomo', subjectToIRPF: true, irpfEstimation: 'directa_normal' }], FiscalActivity: [], TaxModel: [{ id: 'm', companyId: company.id, codigo: '130', activo: true }], TaxDraft: [], TaxFiling: [], AccountingPostingOperation: [], InvoicePayment: [{ id: 'pay', company_id: company.id, invoice_id: 'i', payment_date: '2025-02-01', amount: 4250 }], Invoice: [{ id: 'i', company_id: company.id, tipo: 'emitida', fecha_emision: '2025-01-10', estado: 'emitida', base_imponible: 10000, cuota_iva: 0, importe_retencion: 1500, total_factura: 8500 }], JournalEntry: [{ id: 'j', companyId: company.id, ejercicio: 2025, date: '2025-01-10', status: 'confirmado' }, { id: 'e', companyId: company.id, ejercicio: 2025, date: '2025-01-11', status: 'confirmado' }], JournalEntryLine: [{ id: 'l1', companyId: company.id, ejercicio: 2025, journalEntryId: 'j', accountCode: '70500000', debit: 0, credit: 10000 }, { id: 'l2', companyId: company.id, ejercicio: 2025, journalEntryId: 'j', accountCode: '43000000', debit: 10000, credit: 0 }, { id: 'l3', companyId: company.id, ejercicio: 2025, journalEntryId: 'e', accountCode: '62900000', debit: 2000, credit: 0 }, { id: 'l4', companyId: company.id, ejercicio: 2025, journalEntryId: 'e', accountCode: '41000000', debit: 0, credit: 2000 }] };
}
async function invoke(patch = {}, status = 200) {
  const before = JSON.stringify(records);
  const response = await handler(new Request('https://qa.test', { method: 'POST', body: JSON.stringify({ action: 'dashboard_irpf', companyId: company.id, ejercicio: 2025, cutoff: '2025-03-31', windowStart: '2025-01-01', ...patch }) }));
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  assert.equal(JSON.stringify(records), before, 'No source mutations');
  if (status === 200) { assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.ok(!JSON.stringify(data).includes('a@qa.test')); }
  checks++;
  return data;
}
fixture(); let data = await invoke(); assert.equal(data.estimate, 850); assert.equal(data.retentions.issued, 1500); assert.equal(data.retentions.recognizedByCollections, 750); assert.equal(data.basis.deductibleWithholdings, 750);
fixture(); records.InvoicePayment = []; data = await invoke(); assert.equal(data.estimate, 1600); assert.equal(data.retentions.issued, 1500); assert.equal(data.retentions.recognizedByCollections, 0);
fixture(); records.Invoice[0].importe_retencion = 0; data = await invoke(); assert.equal(data.retentions.issued, 0); assert.equal(data.estimate, 1600);
fixture(); delete records.Invoice[0].importe_retencion; records.Invoice[0].retencion_irpf = 15; data = await invoke(); assert.equal(data.retentions.issued, 1500);
fixture(); records.Invoice.push({ ...records.Invoice[0], id: 'supplier', tipo: 'recibida', importe_retencion: 200 }); data = await invoke(); assert.equal(data.retentions.received, 200); assert.equal(data.estimate, 850);
fixture(); records.Invoice[0].anulada = true; data = await invoke(); assert.equal(data.retentions.issued, 0); assert.equal(data.estimate, 1600);
fixture(); records.Invoice[0].estado = 'borrador'; data = await invoke(); assert.equal(data.retentions.issued, 0);
fixture(); records.Invoice.push({ ...records.Invoice[0], id: 'credit', importe_retencion: -150 }); data = await invoke(); assert.equal(data.retentions.issued, 1350);
fixture(); records.Invoice[0].fecha_emision = '2024-12-01'; data = await invoke(); assert.equal(data.retentions.issued, 0); assert.equal(data.retentions.recognizedByCollections, 750);
fixture(); data = await invoke({ cutoff: '2025-01-31', windowStart: '2025-01-01' }); assert.equal(data.estimate, 1600); assert.equal(data.partialQuarter, true);
fixture(); data = await invoke({ windowStart: '2025-03-01' }); assert.equal(data.retentions.issuedPeriod, 0); assert.equal(data.basis.revenue, 10000); assert.equal(data.retentions.issued, 1500);
fixture(); records.TaxFiling.push({ id: 'f', companyId: company.id, modeloCodigo: '130', ejercicio: 2025, periodo: '1T', estadoPresentacion: 'presentado', revisionImportacion: 'validado_estructura', snapshotHash: 'qa', fechaPresentacion: '2025-04-20', casillasPresentadas: [{ code: '07', value: 300 }, { code: '16', value: 20 }, { code: '19', value: 280 }] }); data = await invoke({ cutoff: '2025-06-30', windowStart: '2025-04-01' }); assert.equal(data.basis.priorPayments, 280); assert.equal(data.estimate, 570);
fixture(); data = await invoke({ cutoff: '2025-06-30', windowStart: '2025-04-01' }); assert.equal(data.carryforward.previousPaymentsSource, 'missing'); assert.equal(data.provisional, true);
fixture(); records.TaxDraft.push({ id: 'd', companyId: company.id, modeloCodigo: '130', ejercicio: 2025, periodo: '1T', version: 1, ajustesManuales: [{ field: 'withholdings', value: 500 }, { field: 'additionalDeductibleExpenses', value: 1000 }, { field: 'previousYearNetIncome', value: 9000 }] }); data = await invoke(); assert.equal(data.estimate, 800); assert.equal(data.basis.deductibleWithholdings, 500); data = await invoke({ cutoff: '2025-02-28' }); assert.equal(data.estimate, 750); assert.equal(data.basis.deductibleWithholdings, 750); assert.ok(data.warnings.some(s => s.includes('trimestre completo')));
fixture(); records.FiscalProfile[0].irpfImputationMethod = 'cash'; records.FiscalProfile[0].irpfImputationMethodConfirmed = true; records.FiscalProfile[0].irpfCashMethodEffectiveFrom = '2025-01-01'; data = await invoke(); assert.equal(data.basis.revenue, 5000); assert.equal(data.basis.expenses, 0); assert.equal(data.estimate, 250);
fixture(); records.JournalEntry[0].importKey = 'alias'; records.JournalEntryLine[0].journalEntryId = 'alias'; records.JournalEntryLine[0].credit = 0; records.JournalEntryLine[0].haberE = 10000; data = await invoke(); assert.equal(data.basis.revenue, 10000);
fixture(); records.JournalEntryLine[0].credit = 9999; data = await invoke(); assert.equal(data.coverage.excludedEntries, 1); assert.equal(data.basis.revenue, 0);
fixture(); records.JournalEntry[0].accountingOperationId = 'pending'; data = await invoke(); assert.equal(data.coverage.excludedEntries, 1);
fixture(); records.JournalEntry[0].type = 'regularizacion'; data = await invoke(); assert.equal(data.basis.revenue, 0);
fixture(); records.JournalEntry = []; records.JournalEntryLine = []; data = await invoke(); assert.equal(data.estimate, null); assert.equal(data.retentions.issued, 1500);
for (const [patch, expected] of [[{ entityType: 'sociedad' }, 'not_applicable'], [{ irpfEstimation: 'objetiva_modulos' }, 'model131'], [{ subjectToIRPF: false }, 'unconfigured']]) { fixture(); Object.assign(records.FiscalProfile[0], patch); data = await invoke(); assert.equal(data.applicability.state, expected); assert.equal(data.estimate, null); }
fixture(); records.TaxModel = []; records.FiscalProfile[0].model130ExemptionConfirmed = true; data = await invoke(); assert.equal(data.applicability.state, 'exempt'); assert.equal(data.estimate, null); assert.equal(data.retentions.issued, 1500);
fixture(); records.FiscalProfile[0].model130ExemptionConfirmed = true; data = await invoke(); assert.equal(data.applicability.state, 'conflicting');
fixture(); records.FiscalActivity.push({ company_id: company.id, activityType: 'agricola_ganadera' }); data = await invoke(); assert.equal(data.applicability.state, 'special_activity'); assert.equal(data.estimate, null);
fixture(); records.TaxModel = []; data = await invoke(); assert.equal(data.applicability.state, 'unconfirmed'); assert.equal(data.estimate, 850);
fixture(); records.FiscalProfile = []; data = await invoke(); assert.equal(data.estimate, null);
fixture(); records.Invoice.push({ ...records.Invoice[0], company_id: 'company-b', id: 'foreign', importe_retencion: 999999 }); data = await invoke(); assert.equal(data.retentions.issued, 1500);
fixture(); user = { id: 'b', email: 'b@qa.test', role: 'user', company_id: company.id }; await invoke({}, 403);
fixture(); user.accountAccessStatus = 'disabled'; await invoke({}, 403);
fixture(); records.Company[0].activa = false; await invoke({}, 403);
fixture(); user = { id: 'legacy', email: 'legacy@qa.test', role: 'user' }; records.User.push({ ...user, company_id: company.id }); data = await invoke(); assert.equal(data.estimate, 850);
fixture(); user = { id: 'admin', email: 'admin@qa.test', role: 'admin' }; data = await invoke(); assert.equal(data.estimate, 850);
fixture(); user = null; await invoke({}, 401);
for (const patch of [{ cutoff: '2025-02-30' }, { ejercicio: 2024 }, { windowStart: '2025-04-01' }, { cutoff: '2099-01-01', ejercicio: 2099 }]) { fixture(); await invoke(patch, 400); }
assert.equal(writes, 0);
for (const file of ['financialSourceTruth.js', 'verifiedCompanyAssignment.mjs']) assert.equal(fs.readFileSync('base44/functions/taxModelOperations/' + file, 'utf8'), fs.readFileSync('base44/functions/getCompanyFinancials/' + file, 'utf8'), 'Canonical helper parity');
console.log(JSON.stringify({ ok: true, checks, writes, actualTaxEngine: true, tenantIsolation: true }));

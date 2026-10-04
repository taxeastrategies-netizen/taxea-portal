import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/fiscalOperations/entry.ts');
const build = await esbuild.build({
  entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'sdk-stub', setup(builder) {
    builder.onResolve({ filter: /^npm:@base44/, }, () => ({ path: 'sdk', namespace: 'stub' }));
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      loader: 'js', contents: 'export const createClientFromRequest=()=>globalThis.__client;',
    }));
  } }],
});
const records = {
  Company: [{ id: 'company-a', owner_email: 'owner@test.invalid', usuarios_autorizados: [] }],
  FiscalProfile: [{ id: 'profile-a', company_id: 'company-a', active: true, profileStatus: 'validado_asesor', effectiveFrom: '2026-01-01', defaultVatRate: 21, defaultIgicRate: 7 }],
  FiscalActivity: [{ id: 'activity-a', company_id: 'company-a', active: true, startDate: '2026-01-01', indirectTax: 'iva', indirectTaxRegime: 'exenta_limitada', deductionRight: 'sin_derecho', incomeDefaultTreatment: 'subject_taxed', expenseDefaultTreatment: 'subject_taxed', exemptionKey: 'IVA_SANITARIA', exemptionLegalBasis: 'Exención sanitaria validada por asesor', automationLevel: 'automatico' }],
  FiscalProfileVersion: [], TaxModel: [], InvoiceTaxLine: [], Invoice: [],
  AccountingAccount: [{ id: 'account-a', companyId: 'company-a', code: '43000007', name: 'Cliente histórico' }],
  ClientAccount: [{ id: 'client-a', company_id: 'company-a', account_code: '43000007' }],
};
const accountSnapshot = JSON.stringify([records.AccountingAccount, records.ClientAccount]);
let writes = 0;
let allowWrites = false;
const entities = new Proxy({}, { get: (_target, name) => ({
  async get(id) { return (records[name] || []).find(item => item.id === id) || null; },
  async filter(query) { return (records[name] || []).filter(row => Object.entries(query || {}).every(([key, value]) => row[key] === value)); },
  async create(payload) { writes++; if (!allowWrites) throw new Error('Unexpected write'); const row = { id: `${name}-${writes}`, ...payload }; (records[name] ||= []).push(row); return row; },
  async update(id, payload) { writes++; if (!allowWrites) throw new Error('Unexpected write'); const row = (records[name] || []).find(item => item.id === id); if (!row) throw new Error('Missing record'); Object.assign(row, payload); return row; },
}) });
let currentUser = { id: 'user-a', email: 'owner@test.invalid', role: 'user', data: { company_id: 'company-a' } };
const client = { auth: { me: async () => currentUser }, asServiceRole: { entities } };
let handler;
vm.runInContext(build.outputFiles[0].text, vm.createContext({
  Response, Request, URL, TextEncoder, TextDecoder, crypto: webcrypto, Date, console,
  __client: client, Deno: { serve: fn => { handler = fn; } },
}), { filename: 'fiscalOperations.bundle.cjs' });
async function evaluate(body) {
  const response = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
    method: 'POST', body: JSON.stringify({
      action: 'evaluate', companyId: 'company-a', requireValidatedProfile: true,
      requireExactActivity: true, activityId: 'activity-a', operationDate: '2026-04-10',
      base: 100, withholdingRate: 0, ...body,
    }),
  }));
  assert.equal(response.status, 200);
  return (await response.json()).evaluation;
}

const expense = await evaluate({ direction: 'gasto', taxRate: 21, taxAmount: 21 });
assert.equal(expense.taxAmount, 21);
assert.equal(expense.deductibleTax, 0);
assert.equal(expense.nonDeductibleTax, 21);
assert.equal(expense.operationType, 'subject_taxed');
const income = await evaluate({ direction: 'ingreso', taxRate: 0, taxAmount: 0 });
assert.equal(income.operationType, 'exempt_limited');
assert.equal(income.taxAmount, 0);

records.FiscalActivity[0].indirectTaxRegime = 'general';
records.FiscalActivity[0].defaultTaxRate = 21;
const wrongIncomeRate = await evaluate({ direction: 'ingreso', taxRate: 10, taxAmount: 10 });
assert.equal(wrongIncomeRate.taxRate, 21);
assert.equal(wrongIncomeRate.taxAmount, 21);
const wrongExpenseQuota = await evaluate({ direction: 'gasto', taxRate: 21, taxAmount: 18 });
assert.equal(wrongExpenseQuota.taxAmount, 21);
records.FiscalActivity[0].automationLevel = 'proponer_revisar';
assert.equal((await evaluate({ direction: 'ingreso', taxRate: 21, taxAmount: 21 })).status, 'review_required');
records.FiscalActivity[0].automationLevel = 'automatico';

records.FiscalActivity[0].indirectTax = 'igic';
records.FiscalActivity[0].indirectTaxRegime = 'pequeno_empresario_igic';
const repepExpense = await evaluate({ direction: 'gasto', taxRate: 7, taxAmount: 7 });
assert.equal(repepExpense.taxAmount, 7);
assert.equal(repepExpense.deductibleTax, 0);
assert.equal(repepExpense.nonDeductibleTax, 7);
const repepIncome = await evaluate({ direction: 'ingreso', taxRate: 0, taxAmount: 0 });
assert.equal(repepIncome.operationType, 'exempt_limited');
assert.equal(repepIncome.taxAmount, 0);

records.FiscalActivity.push({ ...records.FiscalActivity[0], id: 'activity-b' });
const ambiguous = await evaluate({ direction: 'gasto', activityId: undefined, taxRate: 7, taxAmount: 7 });
assert.equal(ambiguous.status, 'blocked');
records.FiscalActivity.pop();
records.FiscalProfile[0].profileStatus = 'pendiente_revision';
const unvalidated = await evaluate({ direction: 'gasto', taxRate: 7, taxAmount: 7 });
assert.equal(unvalidated.status, 'blocked');
records.FiscalProfile[0].profileStatus = 'validado_asesor';
records.FiscalActivity[0].indirectTax = 'iva';
records.FiscalActivity[0].indirectTaxRegime = 'exenta_limitada';
records.Invoice.push({ id: 'invoice-old', company_id: 'company-a', tipo: 'recibida', fecha_emision: '2026-04-10', fecha_recepcion: '2026-04-11', base_imponible: 100, tipo_iva: 21, cuota_iva: 21, deductible_tax_amount: 21, importe_retencion: 0, indirect_tax_kind: 'iva', linked_journal_entry_id: 'journal-old' });
const postedResponse = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_invoice_tax_line', companyId: 'company-a', invoiceId: 'invoice-old', activityId: 'activity-a', base: 100, taxRate: 21, taxAmount: 21, confirmReviewed: true }),
}));
assert.equal(postedResponse.status, 403);
currentUser = { id: 'advisor-a', email: 'advisor@taxea.test', role: 'admin', data: { company_id: 'company-a' } };
const professionalResponse = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_invoice_tax_line', companyId: 'company-a', invoiceId: 'invoice-old', activityId: 'activity-a', base: 100, taxRate: 21, taxAmount: 21, confirmReviewed: true }),
}));
assert.equal(professionalResponse.status, 409);
assert.equal(records.Invoice[0].deductible_tax_amount, 21);
assert.equal(writes, 0);
assert.equal(JSON.stringify([records.AccountingAccount, records.ClientAccount]), accountSnapshot);
records.Invoice.push({ id: 'invoice-pending', company_id: 'company-a', tipo: 'recibida',
  fecha_emision: '2026-04-10', fecha_recepcion: '2026-04-11',
  fiscal_activity_id: 'activity-a', accounting_migration_hold_reason: 'FISCAL_ADVISOR_REVIEW_PHASE1',
  base_imponible: 100, tipo_iva: 21, cuota_iva: 21, total_factura: 121 });
const untracedOverride = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_invoice_tax_line', companyId: 'company-a',
    invoiceId: 'invoice-pending', activityId: 'activity-a', taxKind: 'iva',
    regime: 'exenta_limitada', operationType: 'exempt_full', base: 100,
    taxRate: 21, taxAmount: 21, confirmReviewed: true }),
}));
assert.equal(untracedOverride.status, 422);
assert.equal(writes, 0);
console.log(JSON.stringify({ ok: true, cases: ['exenta_gasto_con_cuota_no_deducible', 'exenta_ingreso_sin_cuota', 'repep_gasto_no_deducible', 'repep_ingreso_exento', 'actividad_ambigua_bloqueada', 'perfil_no_validado_bloqueado', 'tipo_y_cuota_contrastados', 'actividad_no_automatica_requiere_revision', 'asiento_historico_no_se_modifica', 'subcuentas_historicas_intactas'] }, null, 2));

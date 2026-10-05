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

records.FiscalActivity[0].indirectTax = 'iva';
records.FiscalActivity[0].indirectTaxRegime = 'rebu';
const rebu = await evaluate({ direction: 'ingreso', taxRate: 21, taxAmount: 21 });
assert.equal(rebu.postingBlocked, true);
assert.equal(rebu.status, 'review_required');
records.FiscalActivity[0].indirectTaxRegime = 'recargo_equivalencia';
records.FiscalActivity[0].deductionRight = 'pleno';
const recargoExpense = await evaluate({ direction: 'gasto', taxRate: 21, taxAmount: 21 });
assert.equal(recargoExpense.deductibleTax, 0);
assert.equal(recargoExpense.nonDeductibleTax, 21);
assert.equal(recargoExpense.postingBlocked, true);
records.FiscalActivity[0].indirectTaxRegime = 'agricultura_ganaderia_pesca';
const agriculturalExpense = await evaluate({ direction: 'gasto', taxRate: 21, taxAmount: 21 });
assert.equal(agriculturalExpense.deductibleTax, 0);
assert.equal(agriculturalExpense.nonDeductibleTax, 21);
assert.equal(agriculturalExpense.postingBlocked, true);
records.FiscalActivity[0].indirectTaxRegime = 'rebu';
const invalidRegime = await evaluate({ direction: 'ingreso', regime: 'pequeno_empresario_igic' });
assert.equal(invalidRegime.status, 'blocked');
records.FiscalActivity[0].indirectTaxRegime = 'general';
records.FiscalActivity[0].deductionRight = 'prorrata_especial';
records.FiscalActivity[0].proRataPercent = 40;
assert.equal((await evaluate({ direction: 'gasto', taxRate: 21, taxAmount: 21 })).status, 'blocked');
assert.equal((await evaluate({ direction: 'gasto', taxRate: 21, taxAmount: 21, deductionUse: 'exclusive_right' })).deductibleTax, 21);
assert.equal((await evaluate({ direction: 'gasto', taxRate: 21, taxAmount: 21, deductionUse: 'exclusive_no_right' })).deductibleTax, 0);
assert.equal((await evaluate({ direction: 'gasto', taxRate: 21, taxAmount: 21, deductionUse: 'shared' })).deductibleTax, 8.4);
records.FiscalActivity[0].deductionRight = 'sin_derecho';
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
records.FiscalActivity[0].indirectTaxRegime = 'rebu';
const blockedPosting = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_invoice_tax_line', companyId: 'company-a',
    invoiceId: 'invoice-pending', activityId: 'activity-a', base: 100, taxRate: 21,
    taxAmount: 21, confirmReviewed: true }),
}));
assert.equal(blockedPosting.status, 422);
assert.equal(writes, 0);
records.FiscalActivity[0].indirectTaxRegime = 'general';
records.Invoice.push({ id: 'invoice-surcharge', company_id: 'company-a', tipo: 'recibida', fecha_emision: '2026-04-10', fiscal_activity_id: 'activity-a', base_imponible: 100, tipo_iva: 21, cuota_iva: 21, tipo_recargo: 5.2, cuota_recargo: 5.2, total_factura: 126.2 });
const surchargePosting = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_invoice_tax_line', companyId: 'company-a', invoiceId: 'invoice-surcharge', activityId: 'activity-a', regime: 'general', taxKind: 'iva', base: 100, taxRate: 21, taxAmount: 21, confirmReviewed: true }),
}));
assert.equal(surchargePosting.status, 422);
assert.equal(writes, 0);
records.FiscalActivity[0].indirectTaxRegime = 'exenta_limitada';
const untracedOverride = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_invoice_tax_line', companyId: 'company-a',
    invoiceId: 'invoice-pending', activityId: 'activity-a', taxKind: 'iva',
    regime: 'exenta_limitada', operationType: 'exempt_full', base: 100,
    taxRate: 21, taxAmount: 21, confirmReviewed: true }),
}));
assert.equal(untracedOverride.status, 422);
assert.equal(writes, 0);
const invalidActivityResponse = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_activity', companyId: 'company-a', activity: { id: 'activity-a', name: 'Actividad de prueba', activityType: 'empresarial', indirectTax: 'igic', indirectTaxRegime: 'recargo_equivalencia' } }),
}));
assert.equal(invalidActivityResponse.status, 422);
assert.equal(writes, 0);
allowWrites = true;
const approvedExpense = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_invoice_tax_line', companyId: 'company-a',
    invoiceId: 'invoice-pending', activityId: 'activity-a', taxKind: 'iva',
    regime: 'exenta_limitada', operationType: 'subject_taxed', base: 100,
    taxRate: 21, taxAmount: 21, deductiblePercent: 0, confirmReviewed: true }),
}));
assert.equal(approvedExpense.status, 200);
assert.equal(records.InvoiceTaxLine.length, 1);
assert.equal(records.InvoiceTaxLine[0].deductibleQuota, 0);
assert.equal(records.InvoiceTaxLine[0].nonDeductibleQuota, 21);
assert.equal(records.Invoice[1].fiscal_review_status, 'validado');
assert.equal(records.Invoice[1].total_factura, 121);
assert.equal(JSON.stringify([records.AccountingAccount, records.ClientAccount]), accountSnapshot);
records.FiscalActivity[0].indirectTaxRegime = 'recargo_equivalencia';
records.FiscalActivity[0].deductionRight = 'sin_derecho';
records.Invoice.push({ id: 'invoice-recargo-valid', company_id: 'company-a', tipo: 'recibida', fecha_emision: '2026-04-10', fiscal_activity_id: 'activity-a', accounting_migration_hold_reason: 'FISCAL_ADVISOR_REVIEW_PHASE1', base_imponible: 100, tipo_iva: 21, cuota_iva: 21, tipo_recargo: 5.2, cuota_recargo: 5.2, total_factura: 126.2, importe_retencion: 0 });
const approvedRecargo = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_invoice_tax_line', companyId: 'company-a', invoiceId: 'invoice-recargo-valid', activityId: 'activity-a', regime: 'recargo_equivalencia', taxKind: 'iva', base: 100, taxRate: 21, taxAmount: 21, confirmReviewed: true }),
}));
assert.equal(approvedRecargo.status, 200);
const recargoLine = records.InvoiceTaxLine.find(item => item.invoiceId === 'invoice-recargo-valid');
assert.equal(recargoLine.surchargeQuota, 5.2);
assert.equal(recargoLine.deductibleQuota, 0);
assert.equal(recargoLine.nonDeductibleQuota, 21);
assert.equal(records.Invoice.find(item => item.id === 'invoice-recargo-valid').total_factura, 126.2);
assert.equal(JSON.stringify([records.AccountingAccount, records.ClientAccount]), accountSnapshot);
records.FiscalActivity[0].activityType = 'comercial_minorista';
records.Invoice.push({ id: 'invoice-recargo-sale', company_id: 'company-a', tipo: 'emitida', fecha_emision: '2026-04-10', fiscal_activity_id: 'activity-a', accounting_migration_hold_reason: 'FISCAL_ADVISOR_REVIEW_PHASE1', base_imponible: 100, tipo_iva: 21, cuota_iva: 21, tipo_recargo: 0, cuota_recargo: 0, total_factura: 121, importe_retencion: 0 });
const approvedRecargoSale = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_invoice_tax_line', companyId: 'company-a', invoiceId: 'invoice-recargo-sale', activityId: 'activity-a', regime: 'recargo_equivalencia', taxKind: 'iva', base: 100, taxRate: 21, taxAmount: 21, confirmReviewed: true }),
}));
assert.equal(approvedRecargoSale.status, 200);
const recargoSaleLine = records.InvoiceTaxLine.find(item => item.invoiceId === 'invoice-recargo-sale');
assert.equal(recargoSaleLine.regime, 'recargo_equivalencia');
assert.equal(recargoSaleLine.surchargeQuota, 0);
assert.equal(records.Invoice.find(item => item.id === 'invoice-recargo-sale').total_factura, 121);
records.Invoice.push({ id: 'invoice-recargo-sale-invalid', company_id: 'company-a', tipo: 'emitida', fecha_emision: '2026-04-10', fiscal_activity_id: 'activity-a', accounting_migration_hold_reason: 'FISCAL_ADVISOR_REVIEW_PHASE1', base_imponible: 100, tipo_iva: 21, cuota_iva: 21, tipo_recargo: 5.2, cuota_recargo: 5.2, total_factura: 126.2, importe_retencion: 0 });
const invalidRecargoSale = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_invoice_tax_line', companyId: 'company-a', invoiceId: 'invoice-recargo-sale-invalid', activityId: 'activity-a', regime: 'recargo_equivalencia', taxKind: 'iva', base: 100, taxRate: 21, taxAmount: 21, confirmReviewed: true }),
}));
assert.equal(invalidRecargoSale.status, 422);
assert.equal(records.InvoiceTaxLine.some(item => item.invoiceId === 'invoice-recargo-sale-invalid'), false);
assert.equal(JSON.stringify([records.AccountingAccount, records.ClientAccount]), accountSnapshot);
records.FiscalActivity[0].indirectTaxRegime = 'general';
async function recommendedCodes(activities) {
  const before = records.FiscalActivity;
  records.FiscalActivity = activities;
  const response = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
    method: 'POST', body: JSON.stringify({ action: 'bundle', companyId: 'company-a' }),
  }));
  assert.equal(response.status, 200);
  const codes = (await response.json()).recommendations.map(item => item.code);
  records.FiscalActivity = before;
  return codes;
}
const generalActivity = { ...records.FiscalActivity[0], id: 'general-activity', indirectTax: 'iva', indirectTaxRegime: 'general' };
const ossActivity = { ...generalActivity, id: 'oss-activity', indirectTaxRegime: 'oss_union' };
const mixedOssCodes = await recommendedCodes([generalActivity, ossActivity]);
assert(mixedOssCodes.includes('303') && mixedOssCodes.includes('369'));
const onlyOssCodes = await recommendedCodes([ossActivity]);
assert(onlyOssCodes.includes('369') && !onlyOssCodes.includes('303') && !onlyOssCodes.includes('390'));
const groupCodesWithoutRole = await recommendedCodes([{ ...generalActivity, indirectTaxRegime: 'grupo_entidades' }]);
assert(groupCodesWithoutRole.includes('322') && !groupCodesWithoutRole.includes('353') && !groupCodesWithoutRole.includes('303'));
records.FiscalProfile[0].taxGroupId = 'grupo-ficticio';
records.FiscalProfile[0].taxGroupRole = 'dependiente';
const dependentCodes = await recommendedCodes([{ ...generalActivity, indirectTaxRegime: 'grupo_entidades' }]);
assert(dependentCodes.includes('322') && !dependentCodes.includes('353'));
records.FiscalProfile[0].taxGroupRole = 'dominante';
const dominantCodes = await recommendedCodes([{ ...generalActivity, indirectTaxRegime: 'grupo_entidades' }]);
assert(dominantCodes.includes('322') && dominantCodes.includes('353'));
const igicDominantCodes = await recommendedCodes([{ ...generalActivity, indirectTax: 'igic', indirectTaxRegime: 'grupo_entidades' }]);
assert(igicDominantCodes.includes('418') && igicDominantCodes.includes('419'));
records.FiscalProfile[0].taxGroupRole = 'sin_grupo';
const igicMixedCodes = await recommendedCodes([
  { ...generalActivity, indirectTax: 'igic', indirectTaxRegime: 'simplificado' },
  { ...ossActivity, indirectTax: 'igic', indirectTaxRegime: 'general' },
]);
assert(igicMixedCodes.includes('421') && igicMixedCodes.includes('420'));
records.TaxModel.push({ id: 'model-390-advisor', companyId: 'company-a', codigo: '390', activo: true, fuenteValidacion: 'criterio_asesor', observaciones: 'Confirmación previa del asesor' });
const existingModelSnapshot = JSON.stringify(records.TaxModel[0]);
currentUser = { id: 'user-a', email: 'owner@test.invalid', role: 'user', data: { company_id: 'company-a' } };
const proposedModelsResponse = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'sync_obligations', companyId: 'company-a', apply: true }),
}));
assert.equal(proposedModelsResponse.status, 200);
assert.equal(JSON.stringify(records.TaxModel.find(item => item.id === 'model-390-advisor')), existingModelSnapshot);
const proposed303 = records.TaxModel.find(item => item.codigo === '303');
assert.equal(proposed303.activo, false);
assert.equal(proposed303.fuenteValidacion, 'pendiente_confirmar');
const userConfirmation = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_manual_obligation', companyId: 'company-a', code: '303', active: true, reason: 'Prueba' }),
}));
assert.equal(userConfirmation.status, 403);
assert.equal(proposed303.activo, false);
currentUser = { id: 'advisor-a', email: 'advisor@taxea.test', role: 'admin', data: { company_id: 'company-a' } };
const untracedConfirmation = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_manual_obligation', companyId: 'company-a', code: '303', active: true }),
}));
assert.equal(untracedConfirmation.status, 422);
const advisorConfirmation = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
  method: 'POST', body: JSON.stringify({ action: 'save_manual_obligation', companyId: 'company-a', code: '303', active: true, reason: 'Alta censal contrastada en empresa ficticia' }),
}));
assert.equal(advisorConfirmation.status, 200);
assert.equal(proposed303.activo, true);
assert.equal(proposed303.fuenteValidacion, 'criterio_asesor');
console.log(JSON.stringify({ ok: true, cases: ['exenta_gasto_con_cuota_no_deducible', 'exenta_ingreso_sin_cuota', 'repep_gasto_no_deducible', 'repep_ingreso_exento', 'actividad_ambigua_bloqueada', 'perfil_no_validado_bloqueado', 'tipo_y_cuota_contrastados', 'actividad_no_automatica_requiere_revision', 'asiento_historico_no_se_modifica', 'subcuentas_historicas_intactas', 'rebu_bloqueado', 'rebu_no_acepta_confirmacion_ni_escribe', 'regimen_incompatible_bloqueado', 'prorrata_especial_0_40_100', 'recargo_equivalencia_iva_soportado_no_deducible', 'recargo_venta_minorista_revisada', 'agricultura_iva_soportado_no_deducible', 'obligaciones_propuestas_inactivas_y_confirmacion_asesor', 'actividad_regimen_incompatible_no_se_guarda', 'oss_y_nacional_303_mas_369', 'oss_solo_369', 'grupo_322_y_353', 'igic_mixto_421_mas_420'] }, null, 2));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildFinancialSummary,
  compareLegacyExpenseToInvoice,
  reconcileFinancialSources,
} from '../src/lib/financialSourceTruth.js';

const sourceFiles = [
  path.resolve('src/lib/financialSourceTruth.js'),
  path.resolve('base44/functions/getCompanyFinancials/financialSourceTruth.js'),
  path.resolve('base44/functions/businessDashboardOperations/financialSourceTruth.js'),
];
const canonicalSource = fs.readFileSync(sourceFiles[0], 'utf8');
for (const file of sourceFiles.slice(1)) {
  assert.equal(fs.readFileSync(file, 'utf8'), canonicalSource, `${file} se ha desviado del motor financiero canónico.`);
}

const invoice = {
  id: 'invoice-1', company_id: 'company-a', tipo: 'recibida', fecha_emision: '2026-04-10',
  numero_factura: 'FAC-100', proveedor_nombre: 'Proveedor Uno SL', proveedor_nif: 'B12345678',
  base_imponible: 100, cuota_iva: 21, total_factura: 121,
};
const exact = {
  id: 'expense-exact', company_id: 'company-a', tipo: 'gasto', fecha: '2026-04-08',
  canonical_invoice_id: 'invoice-1', proveedor_cliente: 'Texto legado', total: 121,
};
const high = {
  id: 'expense-high', company_id: 'company-a', tipo: 'gasto', fecha: '2026-04-10',
  proveedor_cliente: 'Proveedor Uno, S.L.', base_imponible: 100, cuota_impuesto: 21, total: 121,
};
const differentParty = {
  id: 'expense-different', company_id: 'company-a', tipo: 'gasto', fecha: '2026-04-10',
  proveedor_cliente: 'Proveedor Dos SL', base_imponible: 100, cuota_impuesto: 21, total: 121,
};
const review = {
  id: 'expense-review', company_id: 'company-a', tipo: 'gasto', fecha: '2026-04-12',
  tax_id: 'B12345678', proveedor_cliente: 'Proveedor Uno SL', base_imponible: 100,
  cuota_impuesto: 21, total: 121,
};
const foreign = {
  id: 'expense-foreign', company_id: 'company-b', tipo: 'gasto', fecha: '2026-04-10',
  proveedor_cliente: 'Proveedor Uno SL', total: 121,
};
const manualIncome = {
  id: 'income-1', company_id: 'company-a', tipo: 'ingreso', fecha: '2026-04-15',
  proveedor_cliente: 'Cliente caja', base_imponible: 50, cuota_impuesto: 10.5, total: 60.5,
};

assert.equal(compareLegacyExpenseToInvoice(exact, invoice)?.confidence, 'exact');
assert.equal(compareLegacyExpenseToInvoice(high, invoice)?.confidence, 'high');
assert.equal(compareLegacyExpenseToInvoice(differentParty, invoice), null);
assert.equal(compareLegacyExpenseToInvoice(review, invoice)?.confidence, 'review');
assert.equal(compareLegacyExpenseToInvoice(foreign, invoice), null);

const reconciled = reconcileFinancialSources([invoice], [exact, high, differentParty, review, manualIncome]);
assert.deepEqual(reconciled.expenses.map(row => row.id), ['expense-different', 'expense-review', 'income-1']);
assert.equal(reconciled.sourceTruth.suppressedDuplicateCount, 2);
assert.equal(reconciled.sourceTruth.reviewCandidateCount, 1);

const summary = buildFinancialSummary([invoice], [exact, high, differentParty, review, manualIncome]);
assert.equal(summary.total_ingresos, 60.5);
assert.equal(summary.total_gastos, 363);
assert.equal(summary.resultado, -302.5);
assert.equal(summary.registros_manuales, 3);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    identicalEngines: true,
    exactAndHighConfidenceDuplicatesSuppressed: true,
    ambiguousCandidateRetainedForReview: true,
    differentCounterpartyRetained: true,
    crossTenantNeverMatched: true,
    manualIncomeIncludedOnce: true,
  },
}, null, 2));

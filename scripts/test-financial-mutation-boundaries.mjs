import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function filesUnder(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const frontendFiles = filesUnder(path.resolve('src')).filter(file => /\.(?:js|jsx|ts|tsx)$/.test(file));
const protectedEntities = [
  'Invoice', 'Expense', 'InvoicePayment', 'BankAccount', 'BankTransaction', 'TreasuryEvent',
  'JournalEntry', 'JournalEntryLine', 'InvoiceTaxLine', 'AccountingAccount', 'AccountingConfiguration', 'AccountingFiscalYear',
  'AccountingAsset', 'AmortizationScheduleLine',
  'TaxDraft', 'TaxFiling', 'TaxOfficialFile', 'TaxPeriod', 'TaxDeclarableRecord', 'TaxSubmission', 'TaxModel',
];
const protectedPattern = protectedEntities.join('|');
const directMutation = new RegExp(`entities(?:\\.(?:${protectedPattern})|\\[['"](?:${protectedPattern})['"]\\])\\.(?:create|update|delete|bulkCreate|bulkUpdate|bulkDelete)\\s*\\(`, 'g');
const violations = [];
for (const file of frontendFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(directMutation)) {
    violations.push(`${path.relative(process.cwd(), file)}:${source.slice(0, match.index).split('\n').length}:${match[0]}`);
  }
}
assert.deepEqual(violations, [], `Persisten escrituras financieras o fiscales directas desde la interfaz:\n${violations.join('\n')}`);

function parseJsonc(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
}

function isPrivilegedWriteRule(rule) {
  if (rule?.user_condition?.role === 'admin') return true;
  if (!Array.isArray(rule?.$or) || rule.$or.length === 0) return false;
  return rule.$or.every(branch => ['admin', 'super_admin'].includes(branch?.user_condition?.role));
}

for (const entity of protectedEntities) {
  const schema = parseJsonc(path.resolve(`base44/entities/${entity}.jsonc`));
  for (const operation of ['create', 'update', 'delete']) {
    assert.equal(isPrivilegedWriteRule(schema.rls?.[operation]), true, `${entity}.${operation} debe quedar cerrado al backend.`);
  }
  assert.notEqual(schema.rls?.read, true, `${entity}.read no puede ser público.`);
  assert.equal(JSON.stringify(schema.rls || {}).includes('"user.role"'), false, `${entity} usa una condición RLS de rol no soportada.`);
}

const invoiceBackend = fs.readFileSync(path.resolve('base44/functions/invoiceOperations/entry.ts'), 'utf8');
assert.match(invoiceBackend, /action === 'create_invoice'/);
assert.match(invoiceBackend, /creation_idempotency_key/);
assert.match(invoiceBackend, /source_hash/);
assert.match(invoiceBackend, /action === 'set_primary_pdf'/);

const dashboardBackend = fs.readFileSync(path.resolve('base44/functions/businessDashboardOperations/entry.ts'), 'utf8');
assert.doesNotMatch(dashboardBackend, /function authorize\([^)]*user[^)]*companyId[^)]*\)\s*\{\s*if \(privileged\(user\)\) return/);
assert.match(dashboardBackend, /await authorize\(svc, user, companyId\)/);

const accountingBackend = fs.readFileSync(path.resolve('base44/functions/accountingOperations/entry.ts'), 'utf8');
for (const action of ['create_manual_financial_record', 'update_manual_financial_record', 'void_manual_financial_record']) {
  assert.match(accountingBackend, new RegExp(`action === '${action}'`));
}
assert.match(accountingBackend, /manual-financial:\$\{record\.id\}/);
assert.match(accountingBackend, /manual_financial_record_reversal/);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    noDirectFrontendFinancialOrTaxMutations: protectedEntities.length,
    rlsWritesRestrictedToBackend: true,
    invoiceCreationIsIdempotent: true,
    pdfLinkUsesBackendBoundary: true,
    manualFinancialLifecycleUsesBackend: true,
    manualAnnulmentCreatesTraceableReversal: true,
    dashboardRequiresExplicitCompanyAccess: true,
  },
}, null, 2));

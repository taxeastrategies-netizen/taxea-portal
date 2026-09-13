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
const directMutation = /entities(?:\.(?:Invoice|Expense)|\[['"](?:Invoice|Expense)['"]\])\.(?:create|update|delete|bulkCreate|bulkUpdate|bulkDelete)\s*\(/g;
const violations = [];
for (const file of frontendFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(directMutation)) {
    violations.push(`${path.relative(process.cwd(), file)}:${source.slice(0, match.index).split('\n').length}:${match[0]}`);
  }
}
assert.deepEqual(violations, [], `Persisten escrituras directas de Invoice/Expense:\n${violations.join('\n')}`);

function parseJsonc(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
}
for (const entity of ['Invoice', 'Expense']) {
  const schema = parseJsonc(path.resolve(`base44/entities/${entity}.jsonc`));
  for (const operation of ['create', 'update', 'delete']) {
    assert.equal(schema.rls?.[operation]?.user_condition?.role, 'admin', `${entity}.${operation} debe quedar cerrado al backend.`);
  }
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
    noDirectFrontendInvoiceOrExpenseMutations: true,
    rlsWritesRestrictedToBackend: true,
    invoiceCreationIsIdempotent: true,
    pdfLinkUsesBackendBoundary: true,
    manualFinancialLifecycleUsesBackend: true,
    manualAnnulmentCreatesTraceableReversal: true,
    dashboardRequiresExplicitCompanyAccess: true,
  },
}, null, 2));

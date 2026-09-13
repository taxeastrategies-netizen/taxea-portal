import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  accounting,
  pendingInvoices,
  accountingModule,
  fiscalOperations,
  taxModelOperations,
  activeTaxModule,
  certificationConfig,
] = await Promise.all([
  read('base44/functions/accountingOperations/entry.ts'),
  read('src/components/tax/contabilidad/FacturasPendientes.jsx'),
  read('src/components/tax/contabilidad/ContabilidadModule.jsx'),
  read('base44/functions/fiscalOperations/entry.ts'),
  read('base44/functions/taxModelOperations/entry.ts'),
  read('src/components/tax/impuestos/ImpuestosModule.jsx'),
  read('base44/functions/taxAccountingCertification/function.jsonc'),
]);

assert.match(accounting, /action === 'reject_invoice_accounting'/);
assert.match(accounting, /accounting_migration_hold:\s*true/);
assert.doesNotMatch(pendingInvoices, /base44\.entities\.Invoice\.update/);
assert.match(pendingInvoices, /reject_invoice_accounting/);
assert.match(accountingModule, /AccountingCertification/);
assert.match(accountingModule, /id: 'certificacion'/);
assert.match(fiscalOperations, /\['232', 'Operaciones vinculadas/);
assert.doesNotMatch(fiscalOperations, /\['admin', 'super_admin', 'advisor', 'asesor'\]/);
assert.doesNotMatch(taxModelOperations, /\['admin', 'super_admin', 'advisor', 'asesor'\]\.includes\(role\)/);
assert.doesNotMatch(activeTaxModule, /PresentarModeloFlow|ModeloPeriodsTable|ImpuestosPanel/);
assert.match(certificationConfig, /"entry":\s*"entry\.ts"/);

const immutableEntities = ['TaxDraft', 'TaxFiling', 'TaxOfficialFile', 'TaxPeriod', 'TaxDeclarableRecord'];
for (const name of immutableEntities) {
  const entity = await read(`base44/entities/${name}.jsonc`);
  for (const operation of ['create', 'update', 'delete']) {
    const section = new RegExp(`"${operation}"\\s*:\\s*\\{[\\s\\S]{0,120}?"role"\\s*:\\s*"admin"`);
    assert.match(entity, section, `${name}.${operation} debe quedar reservado al backend/service role`);
  }
  assert.match(entity, /"read"\s*:\s*\{[\s\S]{0,500}?"data\.companyId"\s*:\s*"\{\{user\.data\.company_id\}\}"/, `${name}.read debe aislar por empresa`);
}

console.log(JSON.stringify({
  ok: true,
  checks: {
    invoiceRejectionUsesBackend: true,
    rejectedInvoicesRemainOutsideAutomaticPosting: true,
    certificationVisibleInAccounting: true,
    fiscalCatalogIncludes232: true,
    globalAdvisorBypassRemoved: true,
    activeTaxUiAvoidsLegacyDirectWriters: true,
    fiscalSnapshotsWriteProtected: immutableEntities.length,
  },
}, null, 2));

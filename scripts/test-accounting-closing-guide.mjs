import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guideSource = readFileSync('src/components/tax/contabilidad/PeriodosContables.jsx', 'utf8');
const moduleSource = readFileSync('src/components/tax/contabilidad/ContabilidadModule.jsx', 'utf8');
const match = guideSource.match(/const CLOSING_CHECKS = (\[[\s\S]*?\n\]);/);
assert.ok(match, 'La guía de cierre debe existir en la pantalla.');
// El código evaluado procede del checkout que se está certificando, nunca de datos del usuario.
const checks = Function('return ' + match[1])();
assert.equal(checks.length, 12);
assert.equal(new Set(checks.map(check => check.id)).size, checks.length);
const tabs = new Set(['diario', 'facturas', 'conciliacion', 'fiscal', 'iva']);
assert.ok(checks.every(check => check.tab === null || tabs.has(check.tab)));
assert.ok(moduleSource.includes('<PeriodosContables companyId={companyId} onNavigate={setActiveTab} />'));

const clean = {
  period: { endDate: '2025-12-31' },
  closeDateReached: true,
  pendingEntries: 0,
  unbalancedEntries: 0,
  unresolvedLines: 0,
  pendingInvoices: 0,
  pending555Balance: 0,
  unreconciledBankTransactions: 0,
  fiscalProfileValidated: true,
  fiscalActivities: 1,
  legacyFiscalInvoices: 0,
  pendingFiscalLines: 0,
  currencyIssues: 0,
};
assert.ok(checks.every(check => check.passed(clean)), 'Un ejercicio limpio debe pasar todos los controles.');

const broken = {
  ...clean,
  closeDateReached: false,
  pendingEntries: 2,
  pending555Balance: -42.5,
  unreconciledBankTransactions: 3,
  fiscalProfileValidated: false,
  legacyFiscalInvoices: 5,
};
assert.deepEqual(
  checks.filter(check => !check.passed(broken)).map(check => check.id),
  ['fecha', 'asientos', '555', 'banco', 'perfil', 'desglose'],
);
assert.equal(checks.find(check => check.id === '555').tab, 'conciliacion');
assert.equal(checks.find(check => check.id === 'facturas').tab, 'facturas');
for (const absent of [undefined, null, Number.NaN]) {
  assert.equal(checks.find(check => check.id === '555').passed({ ...clean, pending555Balance: absent }), false);
}
assert.ok(guideSource.includes("setPreview(variables.action === 'closing_preview' ? data.preview || null : null)"));
console.log(JSON.stringify({ ok: true, checks: checks.length, clean: true, broken: true, missing555: true, navigation: true, stalePreview: true }));

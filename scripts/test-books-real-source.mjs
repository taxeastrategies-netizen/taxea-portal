import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entry = path.resolve('src/components/libros/ExportExcel.jsx');
const build = await esbuild.build({
  entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'base44-client-stub', setup(builder) {
    builder.onResolve({ filter: new RegExp('^@/api/base44Client$') }, () => ({ path: 'client', namespace: 'stub' }));
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      loader: 'js', contents: 'export const base44=globalThis.__base44;',
    }));
  } }],
});
const entryRow = {
  id: 'entry-a', date: '2026-04-10', entryNumber: '42', status: 'confirmado',
  isBalanced: true, description: 'Venta probada', documentId: 'invoice-a',
  lines: [
    { accountCode: '43000007', accountName: 'Cliente histórico', debit: 121, credit: 0 },
    { accountCode: '70500000', accountName: 'Servicios', debit: 0, credit: 100 },
    { accountCode: '47700000', accountName: 'IVA repercutido', debit: 0, credit: 21 },
  ],
};
const accounts = [
  { code: '43000007', name: 'Cliente histórico', debit: 121, credit: 0, balance: 121 },
  { code: '70500000', name: 'Servicios', debit: 0, credit: 100, balance: -100 },
  { code: '47700000', name: 'IVA repercutido', debit: 0, credit: 21, balance: -21 },
];
const calls = [];
const base44 = { functions: { async invoke(name, payload) {
  assert.ok(['accountingOperations', 'fiscalOperations'].includes(name));
  assert.equal(payload.companyId, 'company-a');
  calls.push(`${name}:${payload.action}`);
  if (name === 'fiscalOperations' && payload.action === 'recc_book') return { data: { success: true, year: 2026, invoices: [], payments: [], issues: [] } };
  if (payload.action === 'reports') return { data: { success: true, report: { accounts, includedEntries: 1, excludedEntries: 0 } } };
  if (payload.action === 'journal') return { data: { success: true, journal: { total: 1, entries: [entryRow] } } };
  throw new Error('Unexpected action');
} } };
let savedBlob;
const objectUrl = {
  createObjectURL(blob) { savedBlob = blob; return 'blob:test'; },
  revokeObjectURL() {},
};
const fakeDocument = {
  body: { appendChild() {}, removeChild() {} },
  createElement() { return { click() {}, set href(value) { this._href = value; }, set download(value) { this._download = value; } }; },
};
const module = { exports: {} };
const context = vm.createContext({
  console, Blob, URL: objectUrl, document: fakeDocument,
  setTimeout, clearTimeout, __base44: base44, module, exports: module.exports,
});
vm.runInContext(build.outputFiles[0].text, context, { filename: 'ExportExcel.bundle.cjs' });
const exported = context.exports?.exportarLibros || context.module?.exports?.exportarLibros;
assert.equal(typeof exported, 'function');

await exported({
  companyId: 'company-a', companyName: 'Empresa sintética', year: 2026,
  invoices: [
    { id: 'invoice-a', company_id: 'company-a', tipo: 'emitida', numero_factura: 'F-42', fecha_emision: '2026-04-10', base_imponible: 100, tipo_iva: 21, cuota_iva: 21, total_factura: 121, cliente_nombre: 'Cliente histórico', counterparty_account_code: '43000007', revenue_expense_account_code: '70500000', fiscal_regime: 'general', fiscal_treatment: 'subject_taxed' },
    { id: 'invoice-b', company_id: 'company-a', tipo: 'recibida', numero_factura: 'G-1', fecha_emision: '2026-04-10', base_imponible: 100, tipo_iva: 21, cuota_iva: 21, deductible_tax_amount: 0, non_deductible_tax_amount: 21, total_factura: 121, proveedor_nombre: 'Proveedor histórico', counterparty_account_code: '40000009', revenue_expense_account_code: '62900000', fiscal_regime: 'exenta_limitada', fiscal_treatment: 'subject_taxed' },
  ],
  expenses: [],
});
const xml = await savedBlob.text();
assert.deepEqual([...calls].sort(), ['accountingOperations:reports', 'accountingOperations:journal', 'fiscalOperations:recc_book'].sort());
assert.match(xml, /43000007/);
assert.match(xml, /40000009/);
assert.match(xml, /exenta_limitada/);
assert.match(xml, /Libro Diario/);
assert.doesNotMatch(xml, /4300000000|4000000000|4100000000/);
assert.match(xml, /Cuota No Deducible/);
console.log(JSON.stringify({ ok: true, realJournal: true, historicalSubaccountsPreservedInExport: true, nonDeductibleQuotaVisible: true }));

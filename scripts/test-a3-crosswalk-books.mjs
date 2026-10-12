import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

let xml = '';
let failLookup = false;
const profiles = [
  { name: 'Cliente A', taxId: 'TEST-A', accountingRole: 'cliente', accountingAccountCode: '43000007', externalAccountCode: '43000007', externalAccountYear: 2026, externalAccountStatus: 'verificado_nombre_unico' },
  { name: 'Proveedor B', taxId: 'TEST-B', accountingRole: 'proveedor', accountingAccountCode: '40001035', externalAccountCode: '41000008', externalAccountYear: 2026, externalAccountStatus: 'verificado_nombre_unico' },
  { name: 'Proveedor C', taxId: 'TEST-C', accountingRole: 'proveedor', accountingAccountCode: '40001036', externalAccountCode: '', externalAccountYear: 2026, externalAccountStatus: 'pendiente_ambiguedad' },
];
const mockBase44 = { functions: { async invoke(name, body) {
  assert.equal(name, 'getAccountingCrosswalk');
  assert.equal(body.company_id, 'company-a');
  if (failLookup) throw new Error('Consulta no disponible');
  return { data: { profiles } };
} } };
const built = await esbuild.build({
  entryPoints: [path.resolve('src/components/libros/ExportExcel.jsx')],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'mock-base44', setup(build) {
    build.onResolve({ filter: new RegExp('^@/api/base44Client$') }, () => ({ path: 'mock', namespace: 'test' }));
    build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const base44 = globalThis.__mockBase44;', loader: 'js' }));
  } }],
});
const module = { exports: {} };
const fakeDocument = {
  body: { appendChild() {}, removeChild() {} },
  createElement() { return { click() {}, set href(value) {}, set download(value) {} }; },
};
class FakeBlob { constructor(parts) { this.parts = parts; } }
const fakeUrl = { createObjectURL(blob) { xml = blob.parts.join(''); return 'blob:test'; }, revokeObjectURL() {} };
const context = vm.createContext({ module, exports: module.exports, globalThis: null, __mockBase44: mockBase44,
  console, Date, Set, Map, Blob: FakeBlob, URL: fakeUrl, document: fakeDocument });
context.globalThis = context;
vm.runInContext(built.outputFiles[0].text, context);
const invoices = [
  { id: 'i1', tipo: 'emitida', numero_factura: 'E-1', fecha_emision: '2026-09-01', cliente_nombre: 'Cliente A', cliente_nif: 'TEST-A', counterparty_account_code: '43000007', base_imponible: 100, total_factura: 100, estado_contable: 'contabilizada' },
  { id: 'i2', tipo: 'recibida', numero_factura: 'R-1', fecha_emision: '2026-09-02', proveedor_nombre: 'Proveedor B', proveedor_nif: 'TEST-B', counterparty_account_code: '40001035', base_imponible: 50, total_factura: 50, estado_contable: 'contabilizada' },
  { id: 'i3', tipo: 'recibida', numero_factura: 'R-2', fecha_emision: '2026-09-03', proveedor_nombre: 'Proveedor C', proveedor_nif: 'TEST-C', counterparty_account_code: '40001036', base_imponible: 60, total_factura: 60, estado_contable: 'requiere_correccion' },
];
const args = { invoices, expenses: [], companyId: 'company-a', year: 2026, companyName: 'Prueba', onlyInvoiceBooks: true };
await module.exports.exportarLibros(args);
assert(xml.includes('Worksheet ss:Name="Equivalencias A3"'));
assert(xml.includes('43000007'));
assert(xml.includes('40001035'));
assert(xml.includes('41000008'));
assert(xml.includes('Varios códigos A3 para el mismo nombre: revisar'));
assert(xml.includes('No incluye Diario, Mayor ni Caja/Bancos') === false);
failLookup = true;
const result = await module.exports.exportarLibros(args);
assert(result.warning.includes('No se pudo consultar la equivalencia A3'));
assert(xml.includes('Worksheet ss:Name="Facturas Emitidas"'));
console.log('A3 export: internal and external codes separated, ambiguous cases marked, lookup failure non-blocking');

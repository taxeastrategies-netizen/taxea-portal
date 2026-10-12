import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import { sameInvoiceIdentity } from '../base44/functions/checkDuplicates/duplicateIdentity.mjs';
import { reviewableDocuments, nextReviewId, previousReviewId, nextAfterConfirmation } from '../src/lib/ocrReviewQueue.mjs';

const base = { companyId: 'qa', direction: 'recibida', number: 'F-001', date: '2025-07-12', taxId: 'B 12345678', name: 'Proveedor QA' };
assert.equal(sameInvoiceIdentity(base, { ...base, taxId: 'B12345678', date: '12/07/2025' }), true);
for (const candidate of [
  { ...base, number: 'F-002' }, { ...base, date: '2025-07-13' },
  { ...base, taxId: 'B99999999' }, { ...base, companyId: 'other' },
  { ...base, direction: 'emitida' }, { ...base, number: '' }, { ...base, date: '' },
  { ...base, number: 'F-1' },
]) assert.equal(sameInvoiceIdentity(base, candidate), false, JSON.stringify(candidate));
assert.equal(sameInvoiceIdentity({ ...base, taxId: '' }, { ...base, taxId: '', name: 'Proveedor QA' }), true);
assert.equal(sameInvoiceIdentity({ ...base, taxId: '' }, { ...base, taxId: '', name: 'Otro' }), false);
const queue = [{ id: 'a', status: 'review_required' }, { id: 'b', status: 'accounted' }, { id: 'c', status: 'validated' }];
assert.deepEqual(reviewableDocuments(queue).map(row => row.id), ['a', 'c']);
assert.equal(nextReviewId(queue, 'a'), 'c');
assert.equal(previousReviewId(queue, 'c'), 'a');
assert.equal(nextAfterConfirmation(queue, 'c'), 'a');
assert.equal(nextAfterConfirmation([{ id: 'a', status: 'review_required' }], 'a'), null);

const records = {
  Company: [{ id: 'qa', owner_email: 'qa@test.invalid', usuarios_autorizados: [] }, { id: 'other', owner_email: 'other@test.invalid' }],
  Invoice: [
    { id: 'historical', company_id: 'qa', tipo: 'recibida', numero_factura: 'F-001', fecha_emision: '2025-07-12',
      proveedor_nif: 'B12345678', proveedor_nombre: 'Proveedor QA', total_factura: 107, estado_contable: 'contabilizada' },
    { id: 'other-date', company_id: 'qa', tipo: 'recibida', numero_factura: 'F-001', fecha_emision: '2025-07-13',
      proveedor_nif: 'B12345678', proveedor_nombre: 'Proveedor QA', total_factura: 107 },
    { id: 'other-tax-id', company_id: 'qa', tipo: 'recibida', numero_factura: 'F-001', fecha_emision: '2025-07-12',
      proveedor_nif: 'B99999999', proveedor_nombre: 'Proveedor QA', total_factura: 107 },
    { id: 'self-linked', company_id: 'qa', tipo: 'recibida', numero_factura: 'F-030', fecha_emision: '2025-07-12',
      proveedor_nif: 'B12345678', proveedor_nombre: 'Proveedor QA', total_factura: 25 },
  ],
  OcrInvoiceDocument: [
    { id: 'pending-match', company_id: 'qa', documentType: 'expense_invoice', status: 'review_required',
      extractedData: JSON.stringify({ numero_factura: 'F-001', fecha: '2025-07-12', nif_proveedor: 'B12345678',
        proveedor: 'Proveedor QA', total: 999 }) },
    { id: 'linked-same', company_id: 'qa', documentType: 'expense_invoice', status: 'accounted',
      linkedInvoiceId: 'self-linked', extractedData: JSON.stringify({ numero_factura: 'F-030', fecha: '2025-07-12',
        nif_proveedor: 'B12345678', proveedor: 'Proveedor QA', total: 25 }) },
    { id: 'no-number', company_id: 'qa', documentType: 'expense_invoice', status: 'review_required',
      extractedData: JSON.stringify({ fecha: '2025-07-12', nif_proveedor: 'B12345678',
        proveedor: 'Proveedor QA', total: 107 }) },
    ...Array.from({ length: 205 }, (_, i) => ({ id: 'filler-' + i, company_id: 'qa',
      documentType: 'expense_invoice', status: 'review_required',
      extractedData: JSON.stringify({ numero_factura: 'U-' + i, fecha: '2025-07-12',
        nif_proveedor: 'B12345678', proveedor: 'Proveedor QA', total: 1 }) })),
    { id: 'last-page', company_id: 'qa', documentType: 'expense_invoice', status: 'review_required',
      extractedData: JSON.stringify({ numero_factura: 'F-001', fecha: '2025-07-12',
        nif_proveedor: 'B12345678', proveedor: 'Proveedor QA', total: 12 }) },
  ],
};
let currentUser = { id: 'qa-user', role: 'user', email: 'qa@test.invalid' };
let writes = 0;
const entity = name => ({
  get: async id => records[name].find(row => row.id === id) || null,
  filter: async (query, _sort, limit, skip) => records[name].filter(row =>
    Object.entries(query).every(([key, value]) => row[key] === value)).slice(skip, skip + limit),
  update: async () => { writes++; throw new Error('Unexpected write'); },
  delete: async () => { writes++; throw new Error('Unexpected delete'); },
});
const entities = new Proxy({}, { get: (_, name) => entity(name) });
const client = { auth: { me: async () => currentUser }, asServiceRole: { entities } };
const build = await esbuild.build({ entryPoints: ['base44/functions/checkDuplicates/entry.ts'], bundle: true,
  write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'stub-sdk', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const createClientFromRequest=()=>globalThis.__client;', loader: 'js' }));
  } }] });
let handler;
vm.runInContext(build.outputFiles[0].text, vm.createContext({ Response, Request, console, Date,
  __client: client, Deno: { serve: fn => { handler = fn; } } }));
const call = async body => {
  const response = await handler(new Request('https://qa.invalid/checkDuplicates', { method: 'POST', body: JSON.stringify(body) }));
  return { status: response.status, data: await response.json() };
};
const query = { company_id: 'qa', scope: 'ocr_expense', period_type: 'all' };
const all = await call(query);
assert.equal(all.status, 200);
assert.equal(all.data.totalRecordsAnalyzed, 213);
assert.equal(all.data.duplicateGroupsCount, 3); // historical + two unlinked OCR documents.
assert.equal(all.data.totalToDelete, 0);
assert.ok(all.data.duplicateGroups.every(group => group.toDelete.length === 0));
assert.ok(all.data.duplicateGroups.every(group => !group.allItems.some(item => item.id === 'linked-same')));
assert.ok(all.data.duplicateGroups.every(group => !group.allItems.some(item => item.id === 'other-date' || item.id === 'other-tax-id')));
const one = await call({ ...query, action: 'check_one', docId: 'pending-match' });
assert.equal(one.data.duplicateGroupsCount, 2);
const scoped = await call({ ...query, period_type: 'quarter', year: 2025, period_value: 'T3' });
assert.equal(scoped.data.duplicateGroupsCount, 3);
const noPeriod = await call({ ...query, period_type: 'quarter', year: 2026, period_value: 'T3' });
assert.equal(noPeriod.data.duplicateGroupsCount, 0);
currentUser = { id: 'outsider', role: 'user', email: 'stranger@test.invalid' };
assert.equal((await call(query)).status, 403);
assert.equal(writes, 0);
const modal = readFileSync('src/components/shared/DuplicateCheckModal.jsx', 'utf8');
assert.doesNotMatch(modal, /OcrInvoiceDocument\.delete|anularFacturas|Eliminar \$\{/);
console.log(JSON.stringify({ ok: true, checks: ['strict triple', 'historical+OCR cross-check', 'linked source ignored', 'pagination', 'tenant denied', 'read-only review', 'next/previous queue'], records: all.data.totalRecordsAnalyzed }));

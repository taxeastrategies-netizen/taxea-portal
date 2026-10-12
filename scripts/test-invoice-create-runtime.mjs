import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/invoiceOperations/entry.ts');
const build = await esbuild.build({
  stdin: { contents: fs.readFileSync(entry, 'utf8'), loader: 'ts', resolveDir: path.dirname(entry), sourcefile: entry },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  plugins: [{
    name: 'invoice-create-runtime-stubs',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'base44-sdk', namespace: 'taxea-test' }));
      builder.onResolve({ filter: /^\.\/accountingEngine\.ts$/ }, () => ({ path: 'accounting-engine', namespace: 'taxea-test' }));
      builder.onLoad({ filter: /^base44-sdk$/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: 'export function createClientFromRequest(){return globalThis.__base44TestClient}',
      }));
      builder.onLoad({ filter: /^accounting-engine$/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: `
          export const SCHEMA_VERSION = 'pgc8-v1';
          export const buildInvoicePosting = (...args) => globalThis.__buildInvoicePosting(...args);
          export const commitJournalEntry = (...args) => globalThis.__commitJournalEntry(...args);
          export const createJournalEntry = (...args) => globalThis.__createJournalEntry(...args);
          export const postBankReconciliation = (...args) => globalThis.__postBankReconciliation(...args);
          export const postInvoice = (...args) => globalThis.__postInvoice(...args);
          export const seedOperationalPgc = (...args) => globalThis.__seedOperationalPgc(...args);
          export const ensureAccount = async () => { throw new Error('La creación de factura no debe crear cuentas de pago'); };
          export const updatePostingOperation = (...args) => globalThis.__updatePostingOperation(...args);
        `,
      }));
    },
  }],
});

const records = {
  Company: [
    { id: 'company-a', nif_cif: 'B12345678', owner_email: 'owner@a.test', usuarios_autorizados: [] },
    { id: 'company-b', nif_cif: 'B87654321', owner_email: 'owner@b.test', usuarios_autorizados: [] },
  ],
  Invoice: [],
  InvoiceTaxLine: [],
  InvoiceTimelineEvent: [],
};
const counters = { Invoice: 0, InvoiceTaxLine: 0, InvoiceTimelineEvent: 0, accountingEntries: 0 };
const matches = (row, query) => Object.entries(query || {}).every(([key, value]) => value?.$in ? value.$in.includes(row?.[key] ?? null) : row?.[key] === value);
const entity = name => ({
  async updateMany(query, ops) {
    const found = (records[name] || []).filter(row => matches(row, query));
    found.forEach(row => Object.assign(row, ops.$set));
    return { updated: found.length };
  },
  async get(id) { return records[name]?.find(item => item.id === id) || null; },
  async filter(query) { return (records[name] || []).filter(row => matches(row, query)); },
  async create(payload) {
    counters[name] = (counters[name] || 0) + 1;
    const row = { id: `${name.toLowerCase()}-${counters[name]}`, created_date: new Date().toISOString(), ...payload };
    (records[name] ||= []).push(row);
    return row;
  },
  async update(id, payload) {
    const index = (records[name] || []).findIndex(item => item.id === id);
    if (index < 0) throw new Error(`${name} ${id} no existe`);
    records[name][index] = { ...records[name][index], ...payload };
    return records[name][index];
  },
});
const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });
let currentUser = { id: 'advisor-a', email: 'advisor@taxea.test', role: 'admin', data: { company_id: 'company-a' } };
let fiscalStatus = 'ready';
let failPostingOnce = false;
const testClient = {
  auth: { me: async () => currentUser }, asServiceRole: { entities },
  functions: { async invoke(name, body) {
    assert.equal(name,'fiscalOperations');
    assert.equal(body.action,'confirm_invoice_source');
    const inv=await entities.Invoice.get(body.invoiceId);
    if(fiscalStatus==='blocked') return {data:{success:false,error:'Perfil pendiente de asesor.'}};
    const existing=await entities.InvoiceTaxLine.filter({companyId:body.companyId,invoiceId:inv.id,lineNumber:1});
    const line={companyId:body.companyId,invoiceId:inv.id,lineNumber:1,reviewStatus:'validado',regime:'general',taxKind:'iva',
      operationType:'subject_taxed',base:inv.base_imponible,quota:inv.cuota_iva,deductibleQuota:inv.tipo==='recibida'?inv.cuota_iva:0};
    existing.length?await entities.InvoiceTaxLine.update(existing[0].id,line):await entities.InvoiceTaxLine.create(line);
    await entities.Invoice.update(inv.id,{fiscal_review_status:'validado',fiscal_reviewed_by:currentUser.email,fiscal_activity_id:'activity-a'});
    return {data:{success:true,mode:'saved'}};
  } },
};
let handler;
const context = vm.createContext({
  console,
  Request,
  Response,
  URL,
  URLSearchParams,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  crypto: webcrypto,
  atob,
  btoa,
  setTimeout,
  clearTimeout,
  __base44TestClient: testClient,
  __buildInvoicePosting: async () => ({ counterparty: { account: {} } }),
  __createJournalEntry: async () => ({ entry: { id: 'unused' } }),
  __commitJournalEntry: async (_svc, _companyId, entryRow) => ({ entry: entryRow, lines: [] }),
  __updatePostingOperation: async (_svc, operation) => operation,
  __postBankReconciliation: async () => ({ entry: { id: 'unused' } }),
  __seedOperationalPgc: async () => ({ created: 0 }),
  __postInvoice: async (_svc, companyId, invoice) => {
    if (failPostingOnce) { failPostingOnce = false; throw new Error('Fallo contable sintético'); }
    if (invoice.linked_journal_entry_id) return { alreadyPosted: true, entry: { id: invoice.linked_journal_entry_id } };
    counters.accountingEntries += 1;
    const entryRow = { id: `entry-${counters.accountingEntries}`, companyId, status: 'confirmado' };
    await entities.Invoice.update(invoice.id, {
      linked_journal_entry_id: entryRow.id,
      estado_contable: 'contabilizada',
      accounting_review_status: 'validada_contabilizada',
    });
    return { alreadyPosted: false, entry: entryRow };
  },
  Deno: { serve(fn) { handler = fn; }, env: { get() { return ''; } } },
});
vm.runInContext(build.outputFiles[0].text, context, { filename: 'invoiceOperations.bundle.cjs' });
assert.equal(typeof handler, 'function');

async function invoke(body) {
  const response = await handler(new Request('https://taxea.test/functions/invoiceOperations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { response, payload: await response.json() };
}

const validInvoice = {
  tipo: 'emitida', numero_factura: 'F-2026-001', fecha_emision: '2026-04-10',
  cliente_nombre: 'Cliente Uno', cliente_nif: 'B11111111', concepto: 'Servicio',
  base_imponible: 100, tipo_iva: 21, cuota_iva: 21, retencion_irpf: 0,
  importe_retencion: 0, total_factura: 121,
};

const created = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'create-1', confirm_fiscal_review: true, invoice: validInvoice });
assert.equal(created.response.status, 200);
assert.equal(created.payload.ok, true);
assert.equal(records.Invoice.length, 1);
assert.equal(records.InvoiceTaxLine.length, 1);
assert.equal(records.InvoiceTaxLine[0].regime, 'general');
assert.equal(records.Invoice[0].fiscal_activity_id, 'activity-a');
assert.equal(counters.accountingEntries, 1);
assert.equal(new URL(records.Invoice[0].qr_url).searchParams.get('importe'), '121.00');
assert.equal(records.Invoice[0].qr_mode, 'no_verifactu');
assert.match(records.Invoice[0].qr_integrity_hash, /^[A-F0-9]{64}$/);
assert.equal(records.Invoice[0].qr_integrity_version, 'taxea-qr-identity-v1');
const originalQrHash = records.Invoice[0].qr_integrity_hash;
const qrPdfUrl = 'https://base44.app/api/apps/6a00fec50cc522a74ddde4b2/files/mp/public/test-qr.pdf';
const foreignPdf = await invoke({
  action: 'set_qr_pdf', company_id: 'company-a', invoice_id: records.Invoice[0].id,
  file_url: 'https://external.example.org/invoice.pdf', mime_type: 'application/pdf', size_bytes: 4096,
});
assert.equal(foreignPdf.response.status, 400);
assert.equal(records.Invoice[0].qr_pdf_url, undefined);
const linkedQrPdf = await invoke({
  action: 'set_qr_pdf', company_id: 'company-a', invoice_id: records.Invoice[0].id,
  file_url: qrPdfUrl, mime_type: 'application/pdf', size_bytes: 4096,
});
assert.equal(linkedQrPdf.response.status, 200);
assert.equal(records.Invoice[0].qr_pdf_url, qrPdfUrl);
assert.equal(records.Invoice[0].archivo_url, qrPdfUrl);
const repeatedQrPdf = await invoke({
  action: 'set_qr_pdf', company_id: 'company-a', invoice_id: records.Invoice[0].id,
  file_url: 'https://base44.app/api/apps/6a00fec50cc522a74ddde4b2/files/mp/public/other.pdf', mime_type: 'application/pdf', size_bytes: 4096,
});
assert.equal(repeatedQrPdf.payload.duplicate, true);
assert.equal(records.Invoice[0].qr_pdf_url, qrPdfUrl);

const repeated = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'create-1', confirm_fiscal_review: true, invoice: validInvoice });
assert.equal(repeated.response.status, 200);
assert.equal(repeated.payload.duplicate, true);
assert.equal(records.Invoice[0].qr_integrity_hash, originalQrHash);
assert.equal(records.Invoice.length, 1);
assert.equal(counters.accountingEntries, 1);

const reusedWithDifferentData = await invoke({
  action: 'create_invoice', company_id: 'company-a', idempotency_key: 'create-1',
  invoice: { ...validInvoice, numero_factura: 'F-2026-009' },
});
assert.equal(reusedWithDifferentData.response.status, 409);

const duplicateNumber = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'create-2', invoice: validInvoice });
assert.equal(duplicateNumber.response.status, 409);

const invalidTotal = await invoke({
  action: 'create_invoice', company_id: 'company-a', idempotency_key: 'invalid-total',
  invoice: { ...validInvoice, numero_factura: 'F-2026-002', total_factura: 120 },
});
assert.equal(invalidTotal.response.status, 400);

// El fallo fiscal no es una segunda cola: permanece recuperable en su documento.
fiscalStatus='blocked';
const unvalidated=await invoke({action:'create_invoice',company_id:'company-a',idempotency_key:'unvalidated',invoice:{...validInvoice,numero_factura:'F-BLOCKED'}});
assert.equal(unvalidated.response.status,422);
assert.equal(unvalidated.payload.recover_in_ocr,true);
const heldId=unvalidated.payload.invoice_id;
assert.equal((await entities.Invoice.get(heldId)).qr_url,undefined);
const deniedEarly=await invoke({action:'finalize_fiscal_review',company_id:'company-a',invoice_id:heldId});
assert.equal(deniedEarly.response.status,409);
fiscalStatus='review_required';
const recommendation=await invoke({action:'create_invoice',company_id:'company-a',idempotency_key:'recommendation',invoice:{...validInvoice,numero_factura:'F-ADVICE'}});
assert.equal(recommendation.response.status,200);
assert.equal(recommendation.payload.review_required,false);
assert.equal(recommendation.payload.invoice.estado_contable,'contabilizada');
fiscalStatus='ready';
currentUser={id:'owner',email:'owner@a.test',role:'user',data:{company_id:'company-a'}};
const normal=await invoke({action:'create_invoice',company_id:'company-a',idempotency_key:'normal',invoice:{...validInvoice,numero_factura:'F-NORMAL'}});
assert.equal(normal.response.status,200);assert.equal(normal.payload.review_required,false);
const legacyRoleGuard=await invoke({action:'finalize_fiscal_review',company_id:'company-a',invoice_id:heldId});
assert.equal(legacyRoleGuard.response.status,403);
const countBefore=records.Invoice.length;
currentUser={id:'foreign',email:'foreign@test.invalid',role:'user',data:{company_id:'company-a'}};
assert.equal((await invoke({action:'create_invoice',company_id:'company-a',idempotency_key:'foreign',invoice:{...validInvoice,numero_factura:'F-FOREIGN'}})).response.status,403);
assert.equal(records.Invoice.length,countBefore);
currentUser={id:'advisor-a',email:'advisor@taxea.test',role:'admin',data:{company_id:'company-a'}};
failPostingOnce=true;
const failed=await invoke({action:'confirm_source_invoice',company_id:'company-a',invoice_id:heldId});
assert.equal(failed.response.status,422);
assert.equal((await entities.Invoice.get(heldId)).accounting_migration_hold_reason,'FISCAL_POSTING_ERROR');
const recovered=await invoke({action:'confirm_source_invoice',company_id:'company-a',invoice_id:heldId});
assert.equal(recovered.response.status,200);assert.equal(recovered.payload.invoice.accounting_migration_hold,false);
const accountingBefore=counters.accountingEntries;
assert.equal((await invoke({action:'confirm_source_invoice',company_id:'company-a',invoice_id:heldId})).payload.duplicate,true);
assert.equal(counters.accountingEntries,accountingBefore);
// Normalización heredada del tercero en recibidas se mantiene.
const legacyReceived=await invoke({action:'create_invoice',company_id:'company-a',idempotency_key:'legacy-received-counterparty',
  invoice:{...validInvoice,tipo:'recibida',numero_factura:'R-LEGACY',fecha_recepcion:'2026-04-11',
    cliente_nombre:'Proveedor en formulario legado',cliente_nif:'B00000000'}});
assert.equal(legacyReceived.response.status,200);
assert.equal(legacyReceived.payload.invoice.proveedor_nombre,'Proveedor en formulario legado');
assert.equal(legacyReceived.payload.invoice.proveedor_nif,'B00000000');
console.log(JSON.stringify({
  ok: true,
  assertions: {
    invoiceCreatedAndPostedOnce: true,
    retryIsIdempotent: true,
    changedPayloadCannotReuseKey: true,
    duplicateActiveNumberBlocked: true,
    inconsistentTotalBlocked: true,
    singleSourceCheckPostsForOwnerAndAdvisor: true,
    crossTenantCreateBlocked: true,
    failedPostingResumesSameInvoice: true,
    legacyFinalizerRoleGuardsPreserved: true,
    legacyReceivedCounterpartyNormalized: true,
  },
}, null, 2));
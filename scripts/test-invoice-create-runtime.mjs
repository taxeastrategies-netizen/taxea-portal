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
const matches = (row, query) => Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
const entity = name => ({
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
    assert.equal(name, 'fiscalOperations');
    assert.equal(body.requireValidatedProfile, true);
    if (fiscalStatus !== 'ready') return { data: { evaluation: { status: fiscalStatus, reasons: ['Perfil pendiente de asesor.'] } } };
    const taxAmount = Math.round(body.base * body.taxRate) / 100;
    const withholdingAmount = Math.round(body.base * body.withholdingRate) / 100;
    return { data: { evaluation: {
      status: 'ready', taxKind: 'iva', regime: 'general', operationType: 'subject_taxed',
      activityId: 'activity-a', ruleSetVersion: 'synthetic-v1',
      base: body.base, taxRate: body.taxRate, taxAmount,
      withholdingRate: body.withholdingRate, withholdingAmount,
      total: body.base + taxAmount - withholdingAmount,
      deductibleTax: body.direction === 'gasto' ? taxAmount : 0,
      nonDeductibleTax: 0, deductiblePercent: 100,
      exemptionKey: '', legalBasis: '', accounting: { reverseCharge: false },
    } } };
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

fiscalStatus = 'blocked';
const unvalidated = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'unvalidated', invoice: { ...validInvoice, numero_factura: 'F-2026-004' } });
assert.equal(unvalidated.response.status, 200);
assert.equal(unvalidated.payload.review_required, true);
assert.equal(records.Invoice.length, 2);
assert.equal(records.Invoice[1].qr_url, undefined);
assert.equal(records.Invoice[1].linked_journal_entry_id, undefined);
assert.equal(records.InvoiceTaxLine.length, 1);
fiscalStatus = 'review_required';
const pendingReview = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'pending-review', invoice: { ...validInvoice, numero_factura: 'F-2026-005' } });
assert.equal(pendingReview.response.status, 200);
assert.equal(pendingReview.payload.review_required, true);
assert.equal(records.Invoice.length, 3);
assert.equal(records.InvoiceTaxLine.length, 1);
fiscalStatus = 'ready';
const earlyFinalize = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: pendingReview.payload.invoice.id });
assert.equal(earlyFinalize.response.status, 409);
assert.equal(counters.accountingEntries, 1);
await entities.Invoice.update(pendingReview.payload.invoice.id, { fiscal_review_status: 'validado', fiscal_reviewed_by: 'advisor@taxea.test' });
await entities.InvoiceTaxLine.create({
  companyId: 'company-a', invoiceId: pendingReview.payload.invoice.id, lineNumber: 1,
  reviewStatus: 'validado', regime: 'general', taxKind: 'iva', operationType: 'subject_taxed',
  base: 100, quota: 21, deductibleQuota: 0,
});
const finalized = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: pendingReview.payload.invoice.id });
assert.equal(finalized.response.status, 200);
assert.equal(finalized.payload.ok, true);
assert.equal(counters.accountingEntries, 2);
assert.equal(records.Invoice[2].accounting_migration_hold, false);
assert.equal(new URL(records.Invoice[2].qr_url).searchParams.get('importe'), '121.00');
const finalizedAgain = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: pendingReview.payload.invoice.id });
assert.equal(finalizedAgain.payload.duplicate, true);
assert.equal(counters.accountingEntries, 2);
currentUser = { id: 'user-a', email: 'owner@a.test', role: 'user', data: { company_id: 'company-a' } };
const clientDraft = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'client-draft', invoice: { ...validInvoice, numero_factura: 'F-2026-006' } });
assert.equal(clientDraft.payload.review_required, true);
assert.equal(records.Invoice.length, 4);
assert.equal(counters.accountingEntries, 2);
const clientFinalize = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: clientDraft.payload.invoice.id });
assert.equal(clientFinalize.response.status, 403);
currentUser = { id: 'advisor-a', email: 'advisor@taxea.test', role: 'admin', data: { company_id: 'company-a' } };
await entities.Invoice.update(unvalidated.payload.invoice.id, { fiscal_review_status: 'validado', fiscal_reviewed_by: 'advisor@taxea.test' });
await entities.InvoiceTaxLine.create({
  companyId: 'company-a', invoiceId: unvalidated.payload.invoice.id, lineNumber: 1,
  reviewStatus: 'validado', regime: 'general', taxKind: 'iva', operationType: 'subject_taxed',
  base: 100, quota: 21, deductibleQuota: 0,
});
failPostingOnce = true;
const postingFailed = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: unvalidated.payload.invoice.id });
assert.equal(postingFailed.response.status, 503);
assert.equal(records.Invoice[1].accounting_migration_hold_reason, 'FISCAL_POSTING_ERROR');
assert.equal(records.Invoice[1].qr_url, undefined);
const recovered = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: unvalidated.payload.invoice.id });
assert.equal(recovered.response.status, 200);
assert.equal(records.Invoice[1].accounting_migration_hold, false);
assert.equal(counters.accountingEntries, 3);

currentUser = { id: 'foreign', email: 'foreign@test.test', role: 'user', data: { company_id: 'company-a' } };
const crossTenant = await invoke({
  action: 'create_invoice', company_id: 'company-a', idempotency_key: 'foreign',
  invoice: { ...validInvoice, numero_factura: 'F-2026-003' },
});
assert.equal(crossTenant.response.status, 403);
assert.equal(records.Invoice.length, 4);

currentUser = { id: 'advisor-a', email: 'advisor@taxea.test', role: 'admin', data: { company_id: 'company-a' } };
const surchargeInvoice = { ...validInvoice, tipo: 'recibida', numero_factura: 'R-2026-RECARGO', fecha_recepcion: '2026-04-11', proveedor_nombre: 'Proveedor ficticio', tipo_recargo: 5.2, cuota_recargo: 5.2, total_factura: 126.2 };
const invalidSurcharge = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'recargo-mal', confirm_fiscal_review: true, invoice: { ...surchargeInvoice, cuota_recargo: 7 } });
assert.equal(invalidSurcharge.response.status, 400);
const surchargeDraft = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'recargo-ok', confirm_fiscal_review: true, invoice: surchargeInvoice });
assert.equal(surchargeDraft.response.status, 200);
assert.equal(surchargeDraft.payload.review_required, true);
assert.equal(surchargeDraft.payload.invoice.cuota_recargo, 5.2);
assert.equal(surchargeDraft.payload.invoice.total_factura, 126.2);
assert.equal(surchargeDraft.payload.invoice.linked_journal_entry_id, undefined);
assert.equal(counters.accountingEntries, 3);
const prematureSurcharge = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: surchargeDraft.payload.invoice.id });
assert.equal(prematureSurcharge.response.status, 409);
assert.equal(counters.accountingEntries, 3);
await entities.Invoice.update(surchargeDraft.payload.invoice.id, { fiscal_review_status: 'validado', fiscal_reviewed_by: 'advisor@taxea.test', fiscal_regime: 'recargo_equivalencia', fiscal_treatment: 'subject_taxed', indirect_tax_kind: 'iva', deductible_tax_amount: 0, non_deductible_tax_amount: 21 });
await entities.InvoiceTaxLine.create({ companyId: 'company-a', invoiceId: surchargeDraft.payload.invoice.id, lineNumber: 1, reviewStatus: 'validado', regime: 'recargo_equivalencia', taxKind: 'iva', operationType: 'subject_taxed', base: 100, quota: 21, deductibleQuota: 0, nonDeductibleQuota: 21, surchargeRate: 5.2, surchargeQuota: 5.2 });
const completedSurcharge = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: surchargeDraft.payload.invoice.id });
assert.equal(completedSurcharge.response.status, 200);
assert.equal(counters.accountingEntries, 4);
assert.equal(completedSurcharge.payload.invoice.qr_url || '', '');
const repeatedSurcharge = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: surchargeDraft.payload.invoice.id });
assert.equal(repeatedSurcharge.payload.duplicate, true);
assert.equal(counters.accountingEntries, 4);
const recargoSaleDraft = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'recargo-sale-ok', invoice: { ...validInvoice, numero_factura: 'E-2026-RECARGO-VENTA', tipo_recargo: 0, cuota_recargo: 0 } });
assert.equal(recargoSaleDraft.response.status, 200);
assert.equal(recargoSaleDraft.payload.review_required, true);
assert.equal(recargoSaleDraft.payload.invoice.qr_url || '', '');
await entities.Invoice.update(recargoSaleDraft.payload.invoice.id, { fiscal_review_status: 'validado', fiscal_reviewed_by: 'advisor@taxea.test', fiscal_regime: 'recargo_equivalencia', fiscal_treatment: 'subject_taxed', indirect_tax_kind: 'iva' });
await entities.InvoiceTaxLine.create({ companyId: 'company-a', invoiceId: recargoSaleDraft.payload.invoice.id, lineNumber: 1, reviewStatus: 'validado', regime: 'recargo_equivalencia', taxKind: 'iva', operationType: 'subject_taxed', base: 100, quota: 21, surchargeQuota: 0 });
const completedRecargoSale = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: recargoSaleDraft.payload.invoice.id });
assert.equal(completedRecargoSale.response.status, 200);
assert.equal(counters.accountingEntries, 5);
assert.equal(new URL(completedRecargoSale.payload.invoice.qr_url).searchParams.get('importe'), '121.00');
const repeatedRecargoSale = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: recargoSaleDraft.payload.invoice.id });
assert.equal(repeatedRecargoSale.payload.duplicate, true);
assert.equal(counters.accountingEntries, 5);

const reccDraft = await invoke({ action: 'create_invoice', company_id: 'company-a', idempotency_key: 'recc-sale-ok', invoice: { ...validInvoice, numero_factura: 'E-2026-RECC' } });
assert.equal(reccDraft.response.status, 200);
assert.equal(reccDraft.payload.review_required, true);
await entities.Invoice.update(reccDraft.payload.invoice.id, { fiscal_review_status: 'validado', fiscal_reviewed_by: 'advisor@taxea.test', fiscal_regime: 'criterio_caja', fiscal_treatment: 'subject_taxed', indirect_tax_kind: 'iva', deductible_tax_amount: 0, fiscal_activity_id: 'activity-a' });
await entities.InvoiceTaxLine.create({ companyId: 'company-a', invoiceId: reccDraft.payload.invoice.id, lineNumber: 1, reviewStatus: 'validado', reviewedBy: 'advisor@taxea.test', activityId: 'activity-a', regime: 'criterio_caja', taxKind: 'iva', operationType: 'subject_taxed', base: 100, quota: 21, deductibleQuota: 0 });
const completedRecc = await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: reccDraft.payload.invoice.id });
assert.equal(completedRecc.response.status, 200);
assert.equal(counters.accountingEntries, 6);
assert.equal(new URL(completedRecc.payload.invoice.qr_url).searchParams.get('importe'), '121.00');
assert.match(completedRecc.payload.invoice.coletilla_fiscal, /Régimen especial del criterio de caja/);
assert.equal((await invoke({ action: 'finalize_fiscal_review', company_id: 'company-a', invoice_id: reccDraft.payload.invoice.id })).payload.duplicate, true);
assert.equal(counters.accountingEntries, 6);

const legacyReceived = await invoke({
  action: 'create_invoice', company_id: 'company-a', idempotency_key: 'legacy-received-counterparty',
  invoice: { ...validInvoice, tipo: 'recibida', numero_factura: 'R-2026-LEGACY-THIRD-PARTY',
    fecha_recepcion: '2026-04-11', cliente_nombre: 'Proveedor en formulario legado', cliente_nif: 'B00000000' },
});
assert.equal(legacyReceived.response.status, 200);
assert.equal(legacyReceived.payload.review_required, true);
assert.equal(legacyReceived.payload.invoice.proveedor_nombre, 'Proveedor en formulario legado');
assert.equal(legacyReceived.payload.invoice.proveedor_nif, 'B00000000');
assert.equal(legacyReceived.payload.invoice.cliente_nombre, 'Proveedor en formulario legado');
assert.equal(counters.accountingEntries, 6);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    invoiceCreatedAndPostedOnce: true,
    retryIsIdempotent: true,
    changedPayloadCannotReuseKey: true,
    duplicateActiveNumberBlocked: true,
    inconsistentTotalBlocked: true,
    advisorReviewRequiredBeforePosting: true,
    crossTenantCreateBlocked: true,
    reviewedRecargoRetailSaleQrAndPostingOnce: true,
    reccLegalLegendPersistsOnIssue: true,
    legacyReceivedCounterpartyNormalized: true,
  },
}, null, 2));

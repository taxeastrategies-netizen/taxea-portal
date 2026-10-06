import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const root = process.cwd();
const source = `
  import { createJournalEntry, postInvoice } from './base44/functions/accountingOperations/accountingEngine.ts';
  import { executeClosing, reopenFiscalYear } from './base44/functions/accountingOperations/accountingPeriodEngine.ts';
  globalThis.__phase1Exports = { createJournalEntry, postInvoice, executeClosing, reopenFiscalYear };
`;
const build = await esbuild.build({
  stdin: { contents: source, loader: 'ts', resolveDir: root },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  plugins: [{
    name: 'base44-core-stub',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'base44-sdk', namespace: 'phase1-test' }));
      builder.onLoad({ filter: /.*/, namespace: 'phase1-test' }, () => ({ loader: 'js', contents: 'export function createClientFromRequest(){ return {}; }' }));
    },
  }],
});

const context = vm.createContext({
  console,
  crypto: webcrypto,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  setTimeout,
  clearTimeout,
  __phase1Exports: null,
});
vm.runInContext(build.outputFiles[0].text, context, { filename: 'accounting-core-phase1.bundle.cjs' });
const { createJournalEntry, postInvoice, executeClosing, reopenFiscalYear } = context.__phase1Exports;

const records = {
  AccountingAccount: [
    { id: 'a572', companyId: 'company-a', code: '57200000', name: 'Banco', type: 'banco', status: 'activa' },
    { id: 'a705', companyId: 'company-a', code: '70500000', name: 'Servicios', type: 'ingreso', status: 'activa' },
    { id: 'a129', companyId: 'company-a', code: '12900000', name: 'Resultado', type: 'patrimonio', status: 'activa' },
  ],
  AccountingConfiguration: [{ id: 'cfg', companyId: 'company-a', accountingFramework: 'pgc_pymes', annualAccountsModel: 'pyme' }],
  Company: [{ id: 'company-a', tipo_impuesto: 'iva' }],
  AccountingFiscalYear: [{ id: 'fy-2024', companyId: 'company-a', year: 2024, startDate: '2024-01-01', endDate: '2024-12-31', status: 'abierto', closeSequence: 0 }],
  AccountingEntryNumberReservation: [],
  AccountingPostingOperation: [],
  AccountingAuditLog: [],
  JournalEntry: [],
  JournalEntryLine: [],
  Invoice: [],
  InvoiceTaxLine: [],
  CounterpartyFiscalProfile: [],
  DocumentAccountingSource: [],
  BankTransaction: [],
  FiscalProfile: [{ id: 'fp', company_id: 'company-a', active: true, profileStatus: 'validado_asesor', reviewedAt: '2024-01-01' }],
  FiscalActivity: [{ id: 'fa', company_id: 'company-a', active: true, name: 'Comercio minorista sintético', activityType: 'comercial_minorista', indirectTax: 'iva', indirectTaxRegime: 'recargo_equivalencia' }],
};
const counters = {};
let failBulkCreateAfter = 0;
let failCreateEntity = '';
const matches = (row, query) => Object.entries(query || {}).every(([key, value]) => row?.[key] === value);
const sortRows = (rows, sort) => {
  const desc = String(sort || '').startsWith('-');
  const key = String(sort || 'created_date').replace(/^-/, '');
  return rows.slice().sort((a, b) => String(a?.[key] ?? '').localeCompare(String(b?.[key] ?? '')) * (desc ? -1 : 1));
};
const entity = name => ({
  async get(id) { return (records[name] || []).find(item => item.id === id) || null; },
  async filter(query = {}, sort = 'created_date', limit = 5000, skip = 0) { return sortRows((records[name] || []).filter(row => matches(row, query)), sort).slice(skip, skip + limit); },
  async create(payload) {
    if (failCreateEntity === name) {
      failCreateEntity = '';
      throw new Error(`fallo simulado creando ${name}`);
    }
    counters[name] = (counters[name] || 0) + 1;
    const row = { id: `${name}-${counters[name]}`, created_date: new Date(Date.UTC(2020, 0, 1, 0, 0, counters[name])).toISOString(), ...payload };
    (records[name] ||= []).push(row);
    return row;
  },
  async update(id, payload) {
    const index = (records[name] || []).findIndex(item => item.id === id);
    if (index < 0) throw new Error(`${name} ${id} no existe`);
    records[name][index] = { ...records[name][index], ...payload };
    return records[name][index];
  },
  async delete(id) {
    const index = (records[name] || []).findIndex(item => item.id === id);
    if (index >= 0) records[name].splice(index, 1);
  },
  async bulkCreate(payloads) {
    const created = [];
    for (const payload of payloads) {
      created.push(await entity(name).create(payload));
      if (name === 'JournalEntryLine' && failBulkCreateAfter > 0 && created.length >= failBulkCreateAfter) {
        failBulkCreateAfter = 0;
        throw new Error('fallo simulado creando líneas');
      }
    }
    return created;
  },
  async bulkUpdate(payloads) { return await Promise.all(payloads.map(({ id, ...payload }) => entity(name).update(id, payload))); },
});
const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });
const svc = { entities };

const basePosting = {
  date: '2024-06-30',
  description: 'Venta de prueba',
  type: 'ingreso',
  source: 'sistema',
  sourceEvent: 'phase1_runtime',
  postingKey: 'runtime:atomic:1',
  status: 'confirmado',
  lines: [
    { accountCode: '57200000', debit: 100, credit: 0 },
    { accountCode: '70500000', debit: 0, credit: 100 },
  ],
};
const first = await createJournalEntry(svc, 'company-a', basePosting, 'tester@taxea.test');
assert.equal(first.entry.status, 'confirmado');
assert.equal(records.JournalEntry.length, 1);
assert.equal(records.JournalEntryLine.length, 2);
assert.ok(records.JournalEntryLine.every(line => line.entryStatus === 'confirmado'));
assert.equal(records.AccountingPostingOperation[0].status, 'committed');

const duplicate = await createJournalEntry(svc, 'company-a', basePosting, 'tester@taxea.test');
assert.equal(duplicate.alreadyPosted, true);
assert.equal(records.JournalEntry.length, 1);
await assert.rejects(
  () => createJournalEntry(svc, 'company-a', { ...basePosting, lines: [{ accountCode: '57200000', debit: 101, credit: 0 }, { accountCode: '70500000', debit: 0, credit: 101 }] }, 'tester@taxea.test'),
  /contenido diferente|datos diferentes/,
);

failBulkCreateAfter = 1;
await assert.rejects(
  () => createJournalEntry(svc, 'company-a', { ...basePosting, postingKey: 'runtime:atomic:failure' }, 'tester@taxea.test'),
  /fallo simulado/,
);
assert.equal(records.JournalEntry.filter(entry => entry.postingKey === 'runtime:atomic:failure').length, 0);
assert.equal(records.JournalEntryLine.filter(line => line.accountingOperationId === records.AccountingPostingOperation.find(op => op.operationKey === 'runtime:atomic:failure')?.id).length, 0);

const invoiceOne = await entity('Invoice').create({
  company_id: 'company-a', tipo: 'emitida', numero_factura: 'F-001', fecha_emision: '2024-07-01',
  cliente_nombre: 'Cliente Uno', cliente_nif: 'B11111111', concepto: 'Servicio', base_imponible: 100,
  tipo_iva: 21, cuota_iva: 21, importe_retencion: 0, total_factura: 121, moneda: 'EUR', estado_contable: 'pendiente',
});
const invoicePosting = await postInvoice(svc, 'company-a', invoiceOne, 'tester@taxea.test', { status: 'confirmado' });
assert.equal(invoicePosting.entry.status, 'confirmado');
assert.equal(records.Invoice.find(item => item.id === invoiceOne.id).estado_contable, 'contabilizada');
assert.equal(records.InvoiceTaxLine.filter(item => item.invoiceId === invoiceOne.id).length, 1);
assert.equal(records.DocumentAccountingSource.filter(item => item.invoiceId === invoiceOne.id).length, 1);
assert.equal(records.AccountingPostingOperation.find(op => op.operationKey.includes(invoiceOne.id)).status, 'committed');

const invoiceTwo = await entity('Invoice').create({
  company_id: 'company-a', tipo: 'emitida', numero_factura: 'F-002', fecha_emision: '2024-07-02',
  cliente_nombre: 'Cliente Dos', cliente_nif: 'B22222222', concepto: 'Servicio', base_imponible: 200,
  tipo_iva: 21, cuota_iva: 42, importe_retencion: 0, total_factura: 242, moneda: 'EUR', estado_contable: 'pendiente',
});
failCreateEntity = 'InvoiceTaxLine';
await assert.rejects(() => postInvoice(svc, 'company-a', invoiceTwo, 'tester@taxea.test', { status: 'confirmado' }), /fallo simulado/);
const failedInvoiceEntry = records.JournalEntry.find(entry => entry.documentId === invoiceTwo.id);
assert.equal(failedInvoiceEntry.status, 'borrador');
assert.equal(records.AccountingPostingOperation.find(op => op.operationKey.includes(invoiceTwo.id)).status, 'recovery_required');
const recoveredInvoicePosting = await postInvoice(svc, 'company-a', records.Invoice.find(item => item.id === invoiceTwo.id), 'tester@taxea.test', { status: 'confirmado' });
assert.equal(recoveredInvoicePosting.entry.id, failedInvoiceEntry.id);
assert.equal(recoveredInvoicePosting.entry.status, 'confirmado');
assert.equal(records.InvoiceTaxLine.filter(item => item.invoiceId === invoiceTwo.id).length, 1);
assert.equal(records.DocumentAccountingSource.filter(item => item.invoiceId === invoiceTwo.id).length, 1);

const postingCountBeforeFiscalGuard = records.JournalEntry.length;
const pendingFiscalInvoice = await entity('Invoice').create({
  company_id: 'company-a', tipo: 'recibida', numero_factura: 'F-REVIEW', fecha_emision: '2024-07-03',
  base_imponible: 100, cuota_iva: 21, total_factura: 121,
  fiscal_review_status: 'pendiente_revision', accounting_migration_hold: true,
});
await assert.rejects(() => postInvoice(svc, 'company-a', pendingFiscalInvoice, 'tester@taxea.test'), /pendiente de revisión fiscal/);
const specialRegimeInvoice = await entity('Invoice').create({
  company_id: 'company-a', tipo: 'emitida', numero_factura: 'F-REBU', fecha_emision: '2024-07-04',
  base_imponible: 100, cuota_iva: 21, total_factura: 121,
  fiscal_review_status: 'validado', fiscal_regime: 'rebu',
});
await assert.rejects(() => postInvoice(svc, 'company-a', specialRegimeInvoice, 'tester@taxea.test'), /Régimen especial sin circuito contable completo/);
const reverseChargeInvoice = await entity('Invoice').create({ company_id: 'company-a', tipo: 'recibida', numero_factura: 'F-ISP', fiscal_treatment: 'reverse_charge' });
await assert.rejects(() => postInvoice(svc, 'company-a', reverseChargeInvoice, 'tester@taxea.test'), /asientos fiscales específicos/);
const surchargeInvoice = await entity('Invoice').create({ company_id: 'company-a', tipo: 'recibida', numero_factura: 'F-RECARGO', cuota_recargo: 5.2 });
await assert.rejects(() => postInvoice(svc, 'company-a', surchargeInvoice, 'tester@taxea.test'), /asientos fiscales específicos/);
assert.equal(records.JournalEntry.length, postingCountBeforeFiscalGuard, 'Los casos fiscales bloqueados no deben crear asientos.');
const recargoPurchase = await entity('Invoice').create({
  company_id: 'company-a', tipo: 'recibida', numero_factura: 'F-RECARGO-VALIDO', fecha_emision: '2024-07-05',
  proveedor_nombre: 'Proveedor ficticio', proveedor_nif: 'B33333333', concepto: 'Mercancía de prueba',
  categoria_gasto: 'compras_mercaderias', base_imponible: 100, tipo_iva: 21, cuota_iva: 21,
  tipo_recargo: 5.2, cuota_recargo: 5.2, total_factura: 126.2, importe_retencion: 0,
  deductible_tax_amount: 0, non_deductible_tax_amount: 21, indirect_tax_kind: 'iva',
  fiscal_regime: 'recargo_equivalencia', fiscal_treatment: 'subject_taxed',
  fiscal_review_status: 'validado', fiscal_reviewed_by: 'advisor@taxea.test', fiscal_activity_id: 'fa', moneda: 'EUR',
});
await assert.rejects(() => postInvoice(svc, 'company-a', recargoPurchase, 'advisor@taxea.test'), /línea fiscal validados/);
await entity('InvoiceTaxLine').create({ companyId: 'company-a', invoiceId: recargoPurchase.id, lineNumber: 1, regime: 'recargo_equivalencia', taxKind: 'iva', operationType: 'subject_taxed', reviewStatus: 'validado', reviewedBy: 'advisor@taxea.test', activityId: 'fa', base: 100, quota: 21, deductibleQuota: 0, nonDeductibleQuota: 21, surchargeRate: 5.2, surchargeQuota: 5.2 });
const recargoPosting = await postInvoice(svc, 'company-a', recargoPurchase, 'advisor@taxea.test', { status: 'confirmado' });
assert.equal(recargoPosting.entry.status, 'confirmado');
const recargoLines = records.JournalEntryLine.filter(item => item.journalEntryId === recargoPosting.entry.id);
assert.equal(recargoLines.reduce((sum, item) => sum + Number(item.debit || 0), 0), 126.2);
assert.equal(recargoLines.reduce((sum, item) => sum + Number(item.credit || 0), 0), 126.2);
assert.equal(recargoLines.some(item => item.accountCode.startsWith('472')), false);
assert.equal(recargoLines.find(item => item.sourceLineType === 'gasto')?.debit, 126.2);
assert.equal(records.InvoiceTaxLine.find(item => item.invoiceId === recargoPurchase.id)?.surchargeQuota, 5.2);
assert.equal(records.InvoiceTaxLine.find(item => item.invoiceId === recargoPurchase.id)?.deductibleQuota, 0);
assert.equal(records.InvoiceTaxLine.find(item => item.invoiceId === recargoPurchase.id)?.regime, 'recargo_equivalencia');
const recargoRetry = await postInvoice(svc, 'company-a', records.Invoice.find(item => item.id === recargoPurchase.id), 'advisor@taxea.test');
assert.equal(recargoRetry.alreadyPosted, true);
assert.equal(records.JournalEntry.filter(item => item.documentId === recargoPurchase.id).length, 1);
const recargoRetailSale = await entity('Invoice').create({
  company_id: 'company-a', tipo: 'emitida', numero_factura: 'E-RECARGO-VALIDA', fecha_emision: '2024-07-06',
  cliente_nombre: 'Cliente ficticio', cliente_nif: 'B44444444', concepto: 'Venta minorista de prueba',
  categoria_gasto: 'ventas_servicios', base_imponible: 100, tipo_iva: 21, cuota_iva: 21,
  tipo_recargo: 0, cuota_recargo: 0, total_factura: 121, importe_retencion: 0,
  indirect_tax_kind: 'iva', fiscal_regime: 'recargo_equivalencia', fiscal_treatment: 'subject_taxed',
  fiscal_review_status: 'validado', fiscal_reviewed_by: 'advisor@taxea.test', fiscal_activity_id: 'fa', moneda: 'EUR',
});
await entity('InvoiceTaxLine').create({ companyId: 'company-a', invoiceId: recargoRetailSale.id, lineNumber: 1, regime: 'recargo_equivalencia', taxKind: 'iva', operationType: 'subject_taxed', reviewStatus: 'validado', reviewedBy: 'advisor@taxea.test', activityId: 'fa', base: 100, quota: 21, surchargeRate: 0, surchargeQuota: 0 });
const recargoSalePosting = await postInvoice(svc, 'company-a', recargoRetailSale, 'advisor@taxea.test', { status: 'confirmado' });
const recargoSaleLines = records.JournalEntryLine.filter(item => item.journalEntryId === recargoSalePosting.entry.id);
assert.equal(recargoSaleLines.reduce((sum, item) => sum + Number(item.debit || 0), 0), 121);
assert.equal(recargoSaleLines.reduce((sum, item) => sum + Number(item.credit || 0), 0), 121);
assert.equal(recargoSaleLines.some(item => item.accountCode.startsWith('477')), false);
assert.equal(recargoSaleLines.find(item => item.sourceLineType === 'ingreso')?.credit, 121);
assert.equal(records.InvoiceTaxLine.find(item => item.invoiceId === recargoRetailSale.id)?.quota, 21);
const recargoSaleRetry = await postInvoice(svc, 'company-a', records.Invoice.find(item => item.id === recargoRetailSale.id), 'advisor@taxea.test');
assert.equal(recargoSaleRetry.alreadyPosted, true);
assert.equal(records.JournalEntry.filter(item => item.documentId === recargoRetailSale.id).length, 1);

records.FiscalActivity[0].indirectTaxRegime = 'criterio_caja';
const reccSale = await entity('Invoice').create({ company_id: 'company-a', tipo: 'emitida', numero_factura: 'E-RECC-VALIDA', fecha_emision: '2024-07-07', cliente_nombre: 'Cliente RECC sintético', cliente_nif: 'B55555555', concepto: 'Servicio RECC', base_imponible: 100, tipo_iva: 21, cuota_iva: 21, total_factura: 121, importe_retencion: 0, deductible_tax_amount: 0, indirect_tax_kind: 'iva', fiscal_regime: 'criterio_caja', fiscal_treatment: 'subject_taxed', fiscal_review_status: 'validado', fiscal_reviewed_by: 'advisor@taxea.test', fiscal_activity_id: 'fa', moneda: 'EUR' });
await assert.rejects(() => postInvoice(svc, 'company-a', reccSale, 'advisor@taxea.test'), /línea fiscal validados/);
await entity('InvoiceTaxLine').create({ companyId: 'company-a', invoiceId: reccSale.id, lineNumber: 1, rate: 21, regime: 'criterio_caja', taxKind: 'iva', operationType: 'subject_taxed', reviewStatus: 'validado', reviewedBy: 'advisor@taxea.test', activityId: 'fa', base: 100, quota: 21, deductibleQuota: 0 });
const reccSalePosting = await postInvoice(svc, 'company-a', reccSale, 'advisor@taxea.test', { status: 'confirmado' });
const reccSaleLines = records.JournalEntryLine.filter(item => item.journalEntryId === reccSalePosting.entry.id);
assert.equal(reccSaleLines.find(item => item.accountCode === '47700000')?.credit, 21);
assert.equal(reccSaleLines.find(item => item.sourceLineType === 'ingreso')?.credit, 100);
assert.equal(reccSaleLines.reduce((sum, item) => sum + Number(item.debit || 0), 0), 121);
assert.equal((await postInvoice(svc, 'company-a', records.Invoice.find(item => item.id === reccSale.id), 'advisor@taxea.test')).alreadyPosted, true);
assert.equal(records.JournalEntry.filter(item => item.documentId === reccSale.id).length, 1);
const reccPurchase = await entity('Invoice').create({ company_id: 'company-a', tipo: 'recibida', numero_factura: 'R-RECC-VALIDA', fecha_emision: '2024-07-07', proveedor_nombre: 'Proveedor RECC sintético', proveedor_nif: 'B66666666', concepto: 'Compra RECC', base_imponible: 100, tipo_iva: 21, cuota_iva: 21, total_factura: 121, importe_retencion: 0, deductible_tax_amount: 21, non_deductible_tax_amount: 0, indirect_tax_kind: 'iva', fiscal_regime: 'criterio_caja', fiscal_treatment: 'subject_taxed', fiscal_review_status: 'validado', fiscal_reviewed_by: 'advisor@taxea.test', fiscal_activity_id: 'fa', moneda: 'EUR' });
await entity('InvoiceTaxLine').create({ companyId: 'company-a', invoiceId: reccPurchase.id, lineNumber: 1, rate: 21, regime: 'criterio_caja', taxKind: 'iva', operationType: 'subject_taxed', reviewStatus: 'validado', reviewedBy: 'advisor@taxea.test', activityId: 'fa', base: 100, quota: 21, deductibleQuota: 21 });
const reccPurchasePosting = await postInvoice(svc, 'company-a', reccPurchase, 'advisor@taxea.test', { status: 'confirmado' });
const reccPurchaseLines = records.JournalEntryLine.filter(item => item.journalEntryId === reccPurchasePosting.entry.id);
assert.equal(reccPurchaseLines.find(item => item.accountCode === '47200000')?.debit, 21);
assert.equal(reccPurchaseLines.find(item => item.sourceLineType === 'gasto')?.debit, 100);
assert.equal(reccPurchaseLines.reduce((sum, item) => sum + Number(item.credit || 0), 0), 121);
records.FiscalActivity[0].indirectTaxRegime = 'recargo_equivalencia';

const close = await executeClosing(svc, 'company-a', { year: 2024, confirmation: 'CERRAR 2024', reason: 'Prueba de cierre' }, 'tester@taxea.test');
assert.equal(close.cycle, 1);
assert.equal(records.AccountingFiscalYear.find(item => item.year === 2024).status, 'cerrado');
assert.ok(close.regularizationEntryId && close.closingEntryId && close.openingEntryId);
const immutableSnapshot = records.JournalEntry
  .filter(entry => [close.regularizationEntryId, close.closingEntryId, close.openingEntryId].includes(entry.id))
  .map(entry => ({ id: entry.id, status: entry.status, totalDebit: entry.totalDebit, totalCredit: entry.totalCredit }));

const reopened = await reopenFiscalYear(svc, 'company-a', { year: 2024, confirmation: 'REABRIR 2024', reason: 'Documento posterior', apply: true }, 'tester@taxea.test');
assert.equal(records.AccountingFiscalYear.find(item => item.year === 2024).status, 'abierto');
assert.equal(reopened.reversalEntryIds.length, 3);
for (const snapshot of immutableSnapshot) {
  const current = records.JournalEntry.find(entry => entry.id === snapshot.id);
  assert.deepEqual({ id: current.id, status: current.status, totalDebit: current.totalDebit, totalCredit: current.totalCredit }, snapshot);
}
assert.ok(reopened.reversalEntryIds.every(id => records.JournalEntry.find(entry => entry.id === id)?.reversalOfEntryId));
assert.equal(records.AccountingAuditLog.filter(log => log.eventType === 'fiscal_year_closed').length, 1);
assert.equal(records.AccountingAuditLog.filter(log => log.eventType === 'fiscal_year_reopened').length, 1);

const secondClose = await executeClosing(svc, 'company-a', { year: 2024, confirmation: 'CERRAR 2024', reason: 'Segundo cierre' }, 'tester@taxea.test');
assert.equal(secondClose.cycle, 2);
assert.notEqual(secondClose.closingEntryId, close.closingEntryId);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    journalAndLinesCommitTogether: true,
    postingKeyIsIdempotent: true,
    postingKeyRejectsChangedPayload: true,
    partialLineFailureIsCompensated: true,
    invoiceEntryTaxDetailAndEvidenceCommitAsRecoverableUnit: true,
    interruptedInvoicePostingResumesWithoutDuplicate: true,
    pendingFiscalInvoiceCannotPostThroughSharedEngine: true,
    specialRegimeCannotUseGeneralPosting: true,
    reverseChargeAndSurchargeRequireDedicatedPosting: true,
    closeCreatesRegularizationClosingAndOpening: true,
    reopenUsesThreeImmutableReversals: true,
    closeAndReopenAreAudited: true,
    secondCloseUsesNewCycle: true,
  },
  counts: {
    entries: records.JournalEntry.length,
    lines: records.JournalEntryLine.length,
    operations: records.AccountingPostingOperation.length,
    auditLogs: records.AccountingAuditLog.length,
  },
}, null, 2));

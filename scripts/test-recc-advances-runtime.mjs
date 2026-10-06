import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

import { reccAdvanceMetadata, validateReccAdvanceLinks, assertReccAdvanceCanReverse } from '../base44/functions/accountingOperations/reccAdvances.mjs';
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
  InvoicePayment: [],
  InvoiceTaxLine: [],
  CounterpartyFiscalProfile: [],
  DocumentAccountingSource: [],
  BankTransaction: [],
  FiscalProfile: [{ id: 'fp', company_id: 'company-a', active: true, profileStatus: 'validado_asesor', reviewedAt: '2024-01-01' }],
  FiscalActivity: [{ id: 'fa', company_id: 'company-a', active: true, name: 'Comercio minorista sintético', activityType: 'comercial_minorista', indirectTax: 'iva', indirectTaxRegime: 'criterio_caja' }],
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


assert.throws(() => reccAdvanceMetadata({ documentKind: 'final', advanceAllocations: [] }), /final/);
assert.throws(() => reccAdvanceMetadata({ documentKind: 'final', advanceAllocations: [{invoiceId:'a',base:1},{invoiceId:'a',base:2}] }), /repetirse/);
async function invoice(type, number, base, meta, nonDeductible = 0) {
 const doc=await entity('Invoice').create({company_id:'company-a',tipo:type,numero_factura:number,fecha_emision:'2024-08-01',fecha_operacion:'2024-08-01',cliente_nombre:'QA',cliente_nif:'B00000000',proveedor_nombre:'QA',proveedor_nif:'B00000000',base_imponible:base,tipo_iva:21,cuota_iva:Math.round(base*21)/100,total_factura:Math.round(base*121)/100,importe_retencion:0,moneda:'EUR',fiscal_review_status:'validado',fiscal_reviewed_by:'advisor@test',fiscal_activity_id:'fa',fiscal_regime:'criterio_caja',fiscal_treatment:'subject_taxed',indirect_tax_kind:'iva',recc_metadata:JSON.stringify(meta),deductible_tax_amount:type==='recibida'?Math.round(base*21)/100-nonDeductible:0,non_deductible_tax_amount:nonDeductible});
 await entity('InvoiceTaxLine').create({companyId:'company-a',invoiceId:doc.id,lineNumber:1,activityId:'fa',regime:'criterio_caja',taxKind:'iva',operationType:'subject_taxed',reviewStatus:'validado',reviewedBy:'advisor@test',rate:21,base,quota:doc.cuota_iva,deductibleQuota:doc.deductible_tax_amount,surchargeQuota:0});
 return doc;
}
async function paidAdvance(doc, amount) {
 const persisted=records.Invoice.find(row=>row.id===doc.id);
 const entry=await createJournalEntry(svc,'company-a',{date:'2024-08-01',documentId:doc.id,type:doc.tipo==='emitida'?'cobro':'pago',postingKey:'cash:'+doc.id,status:'confirmado',lines:doc.tipo==='emitida'?[{accountCode:'57200000',debit:amount,credit:0},{accountCode:persisted.counterparty_account_code,debit:0,credit:amount}]:[{accountCode:persisted.counterparty_account_code,debit:amount,credit:0},{accountCode:'57200000',debit:0,credit:amount}]},'advisor@test');
 await entity('InvoicePayment').create({company_id:'company-a',invoice_id:doc.id,payment_date:'2024-08-01',amount,operation_status:'committed',journal_entry_id:entry.entry.id,accounting_operation_id:entry.operation.id});
}
const advance=await invoice('emitida','ADV',100,{documentKind:'advance'});
const posting=await postInvoice(svc,'company-a',advance,'advisor@test');
assert.equal(posting.entry.status,'confirmado');
const postedLines=records.JournalEntryLine.filter(row=>row.journalEntryId===posting.entry.id);
assert.equal(postedLines.find(row=>row.accountCode==='43800000').credit,100);
assert.ok(!postedLines.some(row=>row.accountCode.startsWith('70')));
await paidAdvance(advance,121);
const final=await invoice('emitida','FINAL',900,{documentKind:'final',advanceAllocations:[{invoiceId:advance.id,base:100}]});
const finalPosting=await postInvoice(svc,'company-a',final,'advisor@test');
const finalLines=records.JournalEntryLine.filter(row=>row.journalEntryId===finalPosting.entry.id);
assert.equal(finalLines.find(row=>row.accountCode==='43800000').debit,100);
assert.equal(finalLines.filter(row=>row.accountCode.startsWith('70')).reduce((sum,row)=>sum+row.credit,0),1000);
assert.equal(finalLines.find(row=>row.accountCode==='47700000').credit,189);
assert.equal(records.InvoiceTaxLine.find(row=>row.invoiceId===final.id).base,900);
assert.equal((await postInvoice(svc,'company-a',records.Invoice.find(row=>row.id===final.id),'advisor@test')).alreadyPosted,true);
assert.equal(records.JournalEntry.filter(row=>row.documentId===final.id).length,1);
const doubled=await invoice('emitida','DOUBLE',10,{documentKind:'final',advanceAllocations:[{invoiceId:advance.id,base:1}]});
await assert.rejects(()=>postInvoice(svc,'company-a',doubled,'advisor@test'),/aplicado|disponible/);
assert.ok(!records.JournalEntry.some(row=>row.documentId===doubled.id));
const supplier=await invoice('recibida','ADV-G',100,{documentKind:'advance'},10.5);
const supplierPosting=await postInvoice(svc,'company-a',supplier,'advisor@test');
assert.equal(records.JournalEntryLine.find(row=>row.journalEntryId===supplierPosting.entry.id&&row.accountCode==='40700000').debit,110.5);
await paidAdvance(supplier,60.5);
const partial=await invoice('recibida','FINAL-G-1',200,{documentKind:'final',advanceAllocations:[{invoiceId:supplier.id,base:50}]});
const partialPosting=await postInvoice(svc,'company-a',partial,'advisor@test');
assert.equal(records.JournalEntryLine.find(row=>row.journalEntryId===partialPosting.entry.id&&row.accountCode==='40700000').credit,55.25);
const excessive=await invoice('recibida','FINAL-G-EXCESS',100,{documentKind:'final',advanceAllocations:[{invoiceId:supplier.id,base:0.01}]});
await assert.rejects(()=>postInvoice(svc,'company-a',excessive,'advisor@test'),/disponible/);
await assert.rejects(()=>validateReccAdvanceLinks(svc,'company-b',final),/empresa/);
const foreign={...final,cliente_nif:'B11111111'};
await assert.rejects(()=>validateReccAdvanceLinks(svc,'company-a',foreign),/contraparte/);
await assert.rejects(()=>assertReccAdvanceCanReverse(svc,'company-a',records.Invoice.find(row=>row.id===advance.id)),/aplicaciones activas/);
records.Invoice.find(row=>row.id===final.id).anulada=true;
const released=await validateReccAdvanceLinks(svc,'company-a',doubled);
assert.equal(released.applications[0].accountingAmount,1);
console.log(JSON.stringify({ok:true,cases:['advance-438-no-income','final-release-no-extra-vat','invoice-and-entry-idempotent','same-advance-cannot-reapply','supplier-407-nondeductible-cost','partial-paid-capacity','tenant-and-counterparty-isolated','annulled-final-releases-reservation','cannot-annul-consumed-advance' ],realWrites:0},null,2));

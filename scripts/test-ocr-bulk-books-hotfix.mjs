import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { approveStoredOcrBatch } from '../src/lib/ocrWorkspace.mjs';

const calls=[];
const client={functions:{invoke:async(name,body)=>{
  assert.equal(name,'approveOcrDocument');
  calls.push(body);
  return {data:{success:true,invoiceId:'invoice-'+body.docId}};
}}};
const documents=[
  {id:'a',company_id:'qa',status:'review_required',extractedData:JSON.stringify({
    numero_factura:'A-1',cuenta_pgc:'602',fiscal_criteria:{operationType:'subject_taxed'}})},
  {id:'b',company_id:'qa',status:'review_required',extractedData:JSON.stringify({
    numero_factura:'B-1',cuenta_pgc:'629',fiscal_criteria:{operationType:'intra_eu_acquisition'}})},
  {id:'outside',company_id:'other',status:'review_required',extractedData:JSON.stringify({numero_factura:'C-1'})},
];
const mapForm=source=>({...source,cuenta_contable_manual:source.cuenta_contable_manual||'',fiscal_activity_id:source.fiscal_activity_id||''});
const progress=[];
const result=await approveStoredOcrBatch(client,'qa',documents,['a','b','outside'],mapForm,'recibida',{
  activities:[{id:'activity-qa',active:true}],onProgress:item=>progress.push(item),
});
assert.deepEqual({done:result.done,failed:result.failed,remaining:result.remaining},{done:2,failed:1,remaining:0});
assert.equal(calls.length,2);
assert.deepEqual(calls.map(row=>row.form.cuenta_pgc),['602','629']);
assert.deepEqual(calls.map(row=>row.form.fiscal_criteria.operationType),['subject_taxed','intra_eu_acquisition']);
assert.ok(calls.every(row=>row.form.fiscal_activity_id==='activity-qa'));
assert.equal(progress.at(-1).failed,1);
const multi=await approveStoredOcrBatch(client,'qa',documents,['a'],mapForm,'recibida',{activities:[{id:'x'},{id:'y'}]});
assert.equal(multi.failed,1);
assert.equal(calls.length,2);

let clicks=0,blob=null;
class TestBlob { constructor(parts){this.parts=parts;} }
const document={
  createElement:()=>({click(){clicks++;}}),
  body:{appendChild(){},removeChild(){}},
};
const source=readFileSync('src/components/libros/ExportExcel.jsx','utf8')
  .replace('export async function exportarLibros','async function exportarLibros')
  .replaceAll("const { base44 } = await import('@/api/base44Client');",'const base44 = globalThis.__fakeBase44;');
const context=vm.createContext({Blob:TestBlob,URL:{createObjectURL(value){blob=value;return 'blob:test';},revokeObjectURL(){}},document,Date,console});
vm.runInContext(source+'\n globalThis.exportarLibros=exportarLibros;',context);
const invoices=[
  {id:'issued',tipo:'emitida',numero_factura:'QA-1',fecha_emision:'2026-09-30',cliente_nombre:'Cliente QA',base_imponible:100,tipo_iva:0,cuota_iva:0,total_factura:100},
  {id:'received',tipo:'recibida',numero_factura:'QA-2',fecha_emision:'2026-09-29',proveedor_nombre:'Proveedor QA',base_imponible:50,tipo_iva:0,cuota_iva:0,total_factura:50},
];
const exported=await context.exportarLibros({invoices,expenses:[],companyId:'qa',year:2026,companyName:'QA',onlyInvoiceBooks:true});
assert.match(exported.warning,/solo los libros de facturas/i);
assert.equal(clicks,1);
const xml=blob.parts.join('');
assert.match(xml,/Facturas Emitidas/);
assert.match(xml,/Facturas Recibidas/);
assert.match(xml,/Libro Ventas/);
assert.match(xml,/Libro Compras/);
assert.match(xml,/QA-1/);
assert.match(xml,/QA-2/);
assert.doesNotMatch(xml,/Libro Mayor|Libro Diario|Caja y Bancos/);
context.__fakeBase44={functions:{invoke:async(name,body)=>{
  if(name==='accountingOperations') {
    assert.equal(body.action,'reports');
    return {data:{success:true,report:{excludedEntries:2,includedEntries:0,accounts:[]}}};
  }
  if(name==='fiscalOperations') return {data:{success:true,invoices:[],payments:[],issues:[]}};
  throw new Error('Unexpected service '+name);
}}};
const partial=await context.exportarLibros({invoices,expenses:[],companyId:'qa',year:2026,companyName:'QA'});
assert.match(partial.warning,/2 asiento/);
assert.equal(clicks,2);
const partialXml=blob.parts.join('');
assert.match(partialXml,/Facturas Emitidas|Facturas Recibidas/);
assert.match(partialXml,/Incidencias contables/);
assert.doesNotMatch(partialXml,/ss:Name="7\\. Libro Diario"|ss:Name="8\\. Libro Mayor"|ss:Name="11\\. Caja y Bancos"/);
console.log(JSON.stringify({ok:true,bulkConfirmed:result.done,bulkFailures:result.failed,bookSheets:4,partialAccountingWarning:true}));

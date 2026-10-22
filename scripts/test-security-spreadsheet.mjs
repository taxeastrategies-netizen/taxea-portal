import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as XLSX from 'xlsx';
import * as backend from '../base44/functions/importClientAccounting/xlsx.mjs';

const root='base44/functions/importClientAccounting/';
const manifest=JSON.parse(fs.readFileSync(root+'SHEETJS-PROVENANCE.json','utf8'));
assert.equal(createHash('sha256').update(fs.readFileSync(root+'xlsx.mjs')).digest('hex'),manifest.sha256);
assert.equal(XLSX.version,'0.20.3');assert.equal(backend.version,'0.20.3');
assert.ok(fs.readFileSync(root+'LICENSE.sheetjs','utf8').includes('Apache'));
assert.match(fs.readFileSync(root+'entry.ts','utf8'),/from ['"]\.\/xlsx\.mjs['"]/);
const fixture=[['Fecha','Factura','Cuenta','Base','Cuota','Total','Cliente/Proveedor'],
  ['2026-09-30','QA-00001','43000001',100,7,107,'Empresa ficticia ÁÉÑ'],
  ['2026-09-30','QA-00002','40000009',-45.28,-3.62,-48.9,'Proveedor ficticio'],
  ['2026-10-01','000012','00000001',0,0,0,'Sin importe']];
for(const writer of [XLSX,backend])for(const bookType of ['xlsx','xls']){
  const book=writer.utils.book_new();writer.utils.book_append_sheet(book,writer.utils.aoa_to_sheet(fixture),'QA — facturas');
  const bytes=writer.write(book,{bookType,type:'buffer'});
  for(const reader of [XLSX,backend]){
    const roundtrip=reader.read(bytes,{type:'buffer'});
    assert.deepEqual(reader.utils.sheet_to_json(roundtrip.Sheets[roundtrip.SheetNames[0]],{header:1,defval:''}),fixture);
    assert.equal(Object.getPrototypeOf({}),Object.prototype);
  }
}
assert.throws(()=>backend.read(new Uint8Array([0x50,0x4b,0x03,0x04]),{type:'array'}),'Malformed archive must fail safely');
console.log(JSON.stringify({ok:true,version:XLSX.version,parserHashVerified:true,spreadsheetRoundtrips:8,preservesSubaccounts:true,realAccountingModified:false}));

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getInvoiceQrUrl, invoiceQrPng } from '../src/lib/aeatInvoiceQr.js';

const helperSource = await readFile(new URL('../base44/functions/invoiceOperations/invoiceQr.ts', import.meta.url), 'utf8');
const { buildAeatQrUrl } = await import(`data:text/javascript,${encodeURIComponent(helperSource)}`);
const company = { nif_cif: 'B12345678' };
const invoice = {
  tipo: 'emitida',
  numero_factura: 'F 26/001-Á',
  fecha_emision: '2026-10-02',
  total_factura: 121.5,
  moneda: 'EUR',
};
const url = buildAeatQrUrl(company, invoice);
const parsed = new URL(url);
assert.equal(parsed.hostname, 'www2.agenciatributaria.gob.es');
assert.equal(parsed.pathname, '/wlpl/TIKE-CONT/ValidarQRNoVerifactu');
assert.deepEqual([...parsed.searchParams.keys()], ['nif', 'numserie', 'fecha', 'importe']);
assert.equal(parsed.searchParams.get('nif'), company.nif_cif);
assert.equal(parsed.searchParams.get('numserie'), invoice.numero_factura);
assert.equal(parsed.searchParams.get('fecha'), '02-10-2026');
assert.equal(parsed.searchParams.get('importe'), '121.50');
assert.equal(getInvoiceQrUrl({ ...invoice, qr_url: url }), url);
assert.equal(getInvoiceQrUrl({ ...invoice, tipo: 'recibida', qr_url: url }), '');
assert.equal(getInvoiceQrUrl({ ...invoice, qr_url: 'https://evil.example/qr' }), '');
assert.throws(() => buildAeatQrUrl({ nif_cif: '' }, invoice), /NIF\/CIF/);
assert.throws(() => buildAeatQrUrl(company, { ...invoice, fecha_emision: '2026-02-30' }), /fecha/);
assert.throws(() => buildAeatQrUrl(company, { ...invoice, moneda: 'USD' }), /euros/);
const png = await invoiceQrPng({ ...invoice, qr_url: url });
assert.match(png, /^data:image\/png;base64,/);
const decodePng = Buffer.from(png.slice(png.indexOf(',') + 1), 'base64');
assert.equal(decodePng.toString('ascii', 1, 4), 'PNG');

for (const path of [
  '../base44/functions/invoiceOperations/entry.ts',
  '../base44/functions/generateRecurringInvoices/entry.ts',
  '../base44/functions/approveOcrDocument/entry.ts',
]) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  assert.match(source, /buildAeatQrUrl/);
  assert.match(source, /qr_mode/);
}
for (const path of [
  '../src/components/facturas/InvoiceTemplate.jsx',
  '../src/components/facturas/invoicePdfExport.js',
  '../src/components/facturas/invoicePremiumEmail.jsx',
]) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  assert.match(source, /QR tributario:/);
}
console.log('VERI*FACTU fase 5: URL AEAT, validaciones, imagen QR y rutas de emisión/PDF OK');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getInvoiceQrUrl, invoiceQrPng } from '../src/lib/aeatInvoiceQr.js';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

const helperSource = await readFile(new URL('../base44/functions/invoiceOperations/invoiceQr.ts', import.meta.url), 'utf8');
const { buildAeatQrUrl } = await import(`data:text/javascript,${encodeURIComponent(helperSource)}`);
for (const copy of [
  '../base44/functions/generateRecurringInvoices/invoiceQr.ts',
  '../base44/functions/approveOcrDocument/invoiceQr.ts',
]) {
  assert.equal(await readFile(new URL(copy, import.meta.url), 'utf8'), helperSource, 'Las tres rutas de emisión deben usar la misma regla QR.');
}
const company = { nif_cif: 'B12345678' };
const invoice = {
  tipo: 'emitida',
  numero_factura: 'F 26/001-Á',
  fecha_emision: '2026-10-02',
  base_imponible: 100,
  cuota_iva: 21,
  importe_retencion: 15.5,
  total_factura: 105.5,
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
assert.equal(parsed.searchParams.get('importe'), '121.00');
assert.notEqual(parsed.searchParams.get('importe'), invoice.total_factura.toFixed(2), 'El QR no debe restar la retención del importe fiscal.');
assert.equal(getInvoiceQrUrl({ ...invoice, qr_url: url }), url);
assert.equal(getInvoiceQrUrl({ ...invoice, tipo: 'recibida', qr_url: url }), '');
assert.equal(getInvoiceQrUrl({ ...invoice, qr_url: 'https://evil.example/qr' }), '');
assert.throws(() => buildAeatQrUrl({ nif_cif: '' }, invoice), /NIF\/CIF/);
assert.throws(() => buildAeatQrUrl(company, { ...invoice, fecha_emision: '2026-02-30' }), /fecha/);
assert.throws(() => buildAeatQrUrl(company, { ...invoice, moneda: 'USD' }), /euros/);
assert.throws(() => buildAeatQrUrl(company, { ...invoice, total_factura: 99 }), /no cuadran/);
const png = await invoiceQrPng({ ...invoice, qr_url: url });
assert.match(png, /^data:image\/png;base64,/);
const decodePng = Buffer.from(png.slice(png.indexOf(',') + 1), 'base64');
assert.equal(decodePng.toString('ascii', 1, 4), 'PNG');
const image = PNG.sync.read(decodePng);
const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
assert.equal(decoded?.data, url, 'El QR debe poder leerse y devolver la URL AEAT exacta.');

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
  '../src/components/facturas/InvoiceDocumentWorkspace.jsx',
  '../src/pages/PublicInvoiceViewer.jsx',
]) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  assert.match(source, /QR tributario:/);
}
const emailSource = await readFile(new URL('../base44/functions/sendEmail/entry.ts', import.meta.url), 'utf8');
assert.match(emailSource, /allowedInvoicePdfUrl = invoice\?\.qr_url/);
assert.match(emailSource, /loadAttachments\(body.attachments, allowedInvoicePdfUrl/);
const publicSource = await readFile(new URL('../base44/functions/getPublicInvoice/entry.ts', import.meta.url), 'utf8');
assert.match(publicSource, /'qr_url', 'qr_mode', 'qr_pdf_url'/);
console.log('QR tributario: URL AEAT, lectura real, validaciones y rutas de emisión/PDF/email/público OK');

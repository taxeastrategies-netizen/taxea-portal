import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/sendEmail/entry.ts');
const bundle = await esbuild.build({
  stdin: { contents: fs.readFileSync(entry, 'utf8'), loader: 'ts', resolveDir: path.dirname(entry), sourcefile: entry },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{
    name: 'sdk-stub',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'test' }));
      builder.onLoad({ filter: /^sdk$/, namespace: 'test' }, () => ({
        loader: 'js', contents: 'export function createClientFromRequest(){ return globalThis.__client; }',
      }));
    },
  }],
});
const originalUrl = 'https://media.base44.com/test/original.pdf';
const qrPdfUrl = 'https://media.base44.com/test/with-qr.pdf';
const invoice = {
  id: 'invoice-1', company_id: 'company-a', tipo: 'emitida',
  archivo_url: originalUrl, qr_url: 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=B12345678',
  qr_pdf_url: qrPdfUrl, public_token: 'test-token',
};
const logs = [];
const requestedFiles = [];
let gmailCalls = 0;
const entities = {
  Invoice: {
    async get(id) { return id === invoice.id ? invoice : null; },
    async update(id, patch) { Object.assign(invoice, patch); return invoice; },
  },
  InvoiceEmailLog: {
    async filter() { return []; },
    async create(row) { logs.push(row); return row; },
  },
  InvoiceTimelineEvent: { async create(row) { return row; } },
};
const client = {
  auth: { async me() { return { id: 'user-a', email: 'sender@example.test', role: 'user', data: { company_id: 'company-a' } }; } },
  asServiceRole: {
    entities,
    connectors: { async getCurrentAppUserConnection() {
      return { accessToken: 'synthetic-token', connectionConfig: { email: 'sender@example.test' } };
    } },
  },
};
const fakeFetch = async url => {
  if (url === originalUrl || url === qrPdfUrl) {
    requestedFiles.push(url);
    return new Response('%PDF-1.7 synthetic', { status: 200, headers: { 'content-type': 'application/pdf' } });
  }
  if (url === 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send') {
    gmailCalls++;
    return Response.json({ id: 'synthetic-gmail-id', threadId: 'synthetic-thread' });
  }
  throw new Error(`Unexpected URL: ${url}`);
};
let handler;
const ctx = vm.createContext({
  console, Request, Response, URL, TextEncoder, Uint8Array, btoa, fetch: fakeFetch,
  __client: client, Deno: { serve(fn) { handler = fn; } },
});
vm.runInContext(bundle.outputFiles[0].text, ctx, { filename: 'sendEmail.bundle.cjs' });

const request = pdfUrl => new Request('https://taxea.test/functions/sendEmail', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    invoice_id: invoice.id, company_id: invoice.company_id,
    public_invoice_url: 'https://taxeaportal.com/public/invoice/test-token',
    idempotency_key: `test-${pdfUrl}`,
    to: ['client@example.test'], subject: 'Factura sintética', html: '<p>Prueba</p>',
    attachments: [{ url: pdfUrl, name: 'Factura.pdf', mimeType: 'application/pdf' }],
  }),
});
const rejected = await handler(request(originalUrl));
assert.equal(rejected.status, 400, 'El PDF original sin QR no puede enviarse.');
assert.equal(gmailCalls, 0);
assert.deepEqual(requestedFiles, []);

const accepted = await handler(request(qrPdfUrl));
assert.equal(accepted.status, 200);
assert.equal((await accepted.json()).ok, true);
assert.deepEqual(requestedFiles, [qrPdfUrl]);
assert.equal(gmailCalls, 1);
assert.equal(logs.find(row => row.delivery_status === 'enviada')?.attachments?.[0], qrPdfUrl);
console.log('Envío sintético: original sin QR rechazado; PDF con QR adjuntado y trazado tras aceptación Gmail.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/limitedCoreOperations/entry.ts');
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
let handler;
let user = null;
let events = [];
let providerCalls = [];
const own = { id: 'own', owner_email: 'owner@example.test', email: 'owner@example.test', activa: true };
const other = { id: 'other', owner_email: 'other@example.test', email: 'other@example.test', activa: true };
const client = {
  auth: { async me() { return user; } },
  asServiceRole: {
    entities: {
      Company: { async get(id) { return id === 'own' ? own : id === 'other' ? other : null; } },
      Invoice: { async get(id) { return { id, company_id: 'own', tipo: 'emitida', estado_cobro: 'pendiente', cliente_email: 'client@example.test', numero_factura: 'TEST-001' }; } },
      Document: { async get(id) { return { id, company_id: 'own', fiscal_document_kind: 'justificante_presentacion' }; } },
      CoreIntegrationUsage: {
        async filter(q) { return events.filter(e => e.userId === q.userId && e.dayKey === q.dayKey && e.operation === q.operation); },
        async create(data) { const event = { ...data, id: 'event-' + events.length }; events.push(event); return event; },
        async update(id, data) { Object.assign(events.find(e => e.id === id), data); },
      },
    },
    integrations: { Core: {
      async ExtractDataFromUploadedFile(params) { providerCalls.push({ op: 'extract', params }); return { status: 'success', output: { filas: [] } }; },
      async SendEmail(params) { providerCalls.push({ op: 'send', params }); return { status: 'success' }; },
    } },
  },
};
vm.runInContext(bundle.outputFiles[0].text, vm.createContext({ console, Request, Response, URL, __client: client, Deno: { serve(fn) { handler = fn; } } }));
async function invoke(body) {
  const response = await handler(new Request('https://taxea.test/limited', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}
const appFile = 'https://base44.app/api/apps/6a00fec50cc522a74ddde4b2/files/mp/fixture.pdf';
const extract = { operation: 'extract', companyId: 'own', file_url: appFile, json_schema: { type: 'object' } };
assert.equal((await invoke(extract)).status, 401);
user = { id: 'u1', email: 'owner@example.test', role: 'user' };
assert.equal((await invoke({ ...extract, companyId: 'other' })).status, 403);
assert.equal((await invoke({ ...extract, file_url: 'https://evil.example.test/file' })).status, 400);
assert.equal((await invoke({ operation: 'tax_notice', companyId: 'own', documentId: 'd1', subject: 'x', body: 'x' })).status, 403);
assert.equal(providerCalls.length, 0);
assert.equal((await invoke(extract)).status, 200);
assert.equal(providerCalls.length, 1);
assert.equal((await invoke({ operation: 'reminder', companyId: 'own', invoiceId: 'i1' })).status, 200);
assert.equal(providerCalls.length, 2);
assert.equal(providerCalls[1].params.to, 'client@example.test');
assert.equal((await invoke({ operation: 'reminder', companyId: 'own', invoiceId: 'i1' })).status, 409);
assert.equal(providerCalls.length, 2);
user = { id: 'a1', email: 'admin@example.test', role: 'admin' };
assert.equal((await invoke({ operation: 'tax_notice', companyId: 'own', documentId: 'd1', subject: 'Test', body: 'Contenido' })).status, 200);
assert.equal(providerCalls.length, 3);
assert.equal(providerCalls[2].params.to, 'owner@example.test');
console.log('Core operations: auth, tenancy, URL, admin, duplicate and server-side recipient passed with simulated provider only.');

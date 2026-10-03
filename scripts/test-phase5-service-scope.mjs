import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

async function loadHandler(relativePath, client) {
  const entry = path.resolve(relativePath);
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
  const context = vm.createContext({ console, Request, Response, __client: client, Deno: { serve(fn) { handler = fn; } } });
  vm.runInContext(bundle.outputFiles[0].text, context);
  return handler;
}

const hostile = { id: 'user-evil', role: 'user', is_service: true, email: 'evil@example.test', data: { company_id: 'other' } };
const owner = { id: 'user-owner', role: 'user', is_service: false, email: 'owner@example.test', data: { company_id: 'own' } };
const internal = { id: 'service-test', role: 'user', is_service: true, email: 'service+91fdd8e1-117c-4772-87e0-f6fcd3f30ea3@no-reply.base44.com', data: {} };
let user = hostile;
let writes = 0;
let globalTemplateQueries = 0;
const companyFor = id => ({ id, owner_email: id === 'own' ? owner.email : 'another@example.test', usuarios_autorizados: [] });
const noWrite = () => { writes++; throw new Error('Unexpected write'); };
const client = {
  auth: { async me() { return user; } },
  asServiceRole: {
    entities: {
      User: { async get(id) { return { id, data: user.data }; } },
      Company: {
        async get(id) { return companyFor(id); },
        async filter(query) { return [companyFor(query.id)]; },
      },
      RecurringInvoiceTemplate: {
        async filter(query) { if (!query.ownerAccountId) globalTemplateQueries++; return []; },
        create: noWrite, update: noWrite,
      },
      RecurringInvoiceRun: { async filter() { return []; }, create: noWrite },
      Invoice: { async get() { return { id: 'invoice-other', company_id: 'other', tipo: 'emitida', cliente_nombre: 'Prueba' }; }, async filter() { return []; }, create: noWrite, list: async () => [] },
      OcrInvoiceDocument: { list: async () => [], filter: async () => [] },
      Contact: { create: noWrite, update: noWrite, filter: async () => [] },
    },
  },
};
const invoke = async (handler, body) => {
  const res = await handler(new Request('https://taxea.test/functions/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
const recurring = await loadHandler('base44/functions/generateRecurringInvoices/entry.ts', client);
assert.equal((await invoke(recurring, { action: 'preview' })).status, 403, 'forged service cannot scan all companies');
user = owner;
assert.equal((await invoke(recurring, { action: 'list_templates', companyId: 'other' })).status, 403, 'owner cannot list another company');
assert.equal((await invoke(recurring, { action: 'list_templates', companyId: 'own' })).status, 200, 'owner can list own templates');
user = internal;
assert.equal((await invoke(recurring, { action: 'preview' })).status, 200, 'internal service can preview global scan');
assert.equal(globalTemplateQueries, 1);
const contacts = await loadHandler('base44/functions/syncInvoiceContacts/entry.ts', client);
user = hostile;
assert.equal((await invoke(contacts, { action: 'backfill_all' })).status, 403, 'forged service cannot backfill');
assert.equal((await invoke(contacts, { action: 'sync_invoice', invoiceId: 'invoice-other' })).status, 403, 'forged service cannot sync cross-company invoice');
user = owner;
assert.equal((await invoke(contacts, { action: 'sync_company', companyId: 'other' })).status, 403, 'owner cannot sync another company');
assert.equal((await invoke(contacts, { action: 'sync_company', companyId: 'own' })).status, 200, 'owner can sync own company');
user = internal;
assert.equal((await invoke(contacts, { action: 'backfill_all' })).status, 200, 'internal service can backfill');
assert.equal(writes, 0, 'test must not create or mutate invoices, contacts or templates');
console.log('Authorization scenarios passed: forged service denied; owner scoped; internal service allowed; no writes.');
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/clientSetup/entry.ts');
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
const account = {
  id: 'synthetic-account',
  email: 'synthetic@example.test',
  legalName: 'Empresa Ficticia',
  setupToken: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  setupTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};
const audit = [];
let currentUser = null;
const client = {
  auth: { async me() { return currentUser; } },
  asServiceRole: { entities: {
    ClientAccount: {
      async get(id) { return id === account.id ? account : null; },
      async filter(query) { return account.setupToken === query.setupToken ? [account] : []; },
      async update(id, patch) { assert.equal(id, account.id); Object.assign(account, patch); return account; },
    },
    ClientAccessAuditLog: { async create(row) { audit.push(row); return row; } },
  } },
};
let handler;
const context = vm.createContext({
  console, Request, Response, crypto: webcrypto, Uint8Array,
  __client: client, Deno: { serve(fn) { handler = fn; } },
});
vm.runInContext(bundle.outputFiles[0].text, context, { filename: 'clientSetup.bundle.cjs' });
const invoke = async body => {
  const response = await handler(new Request('https://taxea.test/functions/clientSetup', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
};

assert.deepEqual(await invoke({ action: 'validate', token: account.setupToken }), {
  status: 200, body: { valid: true, email: account.email, legalName: account.legalName },
});
assert.equal((await invoke({ action: 'issue', clientAccountId: account.id })).status, 403);
currentUser = { id: 'ordinary-user', role: 'user' };
assert.equal((await invoke({ action: 'issue', clientAccountId: account.id })).status, 403);
currentUser = { id: 'admin-user', role: 'admin' };
const issued = await invoke({ action: 'issue', clientAccountId: account.id });
assert.equal(issued.status, 200);
assert.equal(issued.body.valid, true);
assert.match(issued.body.setupUrl, /^https:\/\/taxeaportal\.com\/setup-password#token=[a-f0-9]{64}$/);
assert.equal(issued.body.setupUrl.includes('?'), false);
const token = issued.body.setupUrl.split('#token=')[1];
assert.equal(account.setupToken, token);
assert.equal((await invoke({ action: 'validate', token })).body.valid, true);
assert.deepEqual(await invoke({ action: 'consume', token }), { status: 200, body: { valid: true, consumed: true } });
assert.equal((await invoke({ action: 'validate', token })).body.valid, false);
assert.equal(audit.length, 1);
console.log('Alta sintética: token de 256 bits emitido solo por admin, enlace sin query, uso único y compatibilidad legacy OK.');

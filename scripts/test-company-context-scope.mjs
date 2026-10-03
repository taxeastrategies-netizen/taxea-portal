import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/companyContextOperations/entry.ts');
const result = await esbuild.build({
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
let writes = [];
let stored = { id: 'u1', email: 'owner@example.test', data: { company_id: 'own' } };
const client = {
  auth: { async me() { return user; } },
  asServiceRole: { entities: {
    User: {
      async get() { return stored; },
      async update(id, payload) { writes.push({ id, payload }); stored = { ...stored, data: { ...stored.data, ...payload } }; },
    },
    Company: {
      async get(id) {
        return {
          id, activa: true,
          owner_email: id === 'own' ? 'owner@example.test' : 'other@example.test',
          usuarios_autorizados: id === 'authorized' ? ['owner@example.test'] : [],
        };
      },
    },
  } },
};
vm.runInContext(result.outputFiles[0].text, vm.createContext({ console, Request, Response, __client: client, Deno: { serve(fn) { handler = fn; } } }));
async function call(companyId) {
  const response = await handler(new Request('https://taxea.test/context', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'set_active_company', companyId }) }));
  return { status: response.status, body: await response.json() };
}
assert.equal((await call('other')).status, 401);
user = { id: 'u1', email: 'owner@example.test', role: 'user' };
assert.equal((await call('other')).status, 403);
assert.equal((await call(null)).status, 403);
assert.equal(writes.length, 0);
assert.equal((await call('own')).status, 200);
assert.equal(writes.length, 0, 'same company should not be rewritten');
assert.equal((await call('authorized')).status, 200);
assert.equal(writes.length, 1);
assert.equal(writes[0].payload.company_id, 'authorized');
stored.email = 'another@example.test';
assert.equal((await call('own')).status, 403, 'authenticated identity must match stored user');
stored.email = 'owner@example.test';
user = { id: 'u1', email: 'owner@example.test', role: 'admin' };
assert.equal((await call('other')).status, 200);
assert.equal((await call(null)).status, 200);
assert.equal(writes.length, 3);
console.log('Company context: unauthenticated/foreign denied; owner/authorized/admin scoped; no external calls.');
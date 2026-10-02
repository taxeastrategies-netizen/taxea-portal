import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entry = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../base44/functions/fiscalCalendarOperations/entry.ts');
const build = await esbuild.build({
  entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'sdk-stub', setup(builder) {
    builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'stub' }));
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      loader: 'js', contents: 'export const createClientFromRequest=()=>globalThis.__client;',
    }));
  } }],
});
const companies = [
  { id: 'company-a', owner_email: 'owner-a@test.invalid', usuarios_autorizados: ['advisor-a@test.invalid'] },
  { id: 'company-b', owner_email: 'owner-b@test.invalid', usuarios_autorizados: ['advisor-b@test.invalid'] },
];
const entities = new Proxy({}, { get: (_target, name) => ({
  get: async id => String(name) === 'Company' ? companies.find(row => row.id === id) || null : null,
  filter: async () => [],
  create: async () => { throw new Error('No se permiten escrituras en esta prueba.'); },
  update: async () => { throw new Error('No se permiten escrituras en esta prueba.'); },
}) });
let user = { email: 'advisor-a@test.invalid', role: 'advisor', data: {} };
const client = { auth: { me: async () => user }, asServiceRole: { entities } };
let handler;
vm.runInContext(build.outputFiles[0].text, vm.createContext({
  console, Request, Response, URL, Date, module: { exports: {} }, exports: {}, __client: client, Deno: { serve: fn => { handler = fn; } },
}), { filename: entry });
const call = async (action, companyId) => {
  const response = await handler(new Request('https://test.invalid', {
    method: 'POST', body: JSON.stringify({ action, companyId, fiscalYear: 2026 }),
  }));
  return { status: response.status, body: await response.json() };
};
for (const action of ['bundle', 'synchronize', 'save_obligation', 'create_obligation', 'link_document']) {
  assert.equal((await call(action, 'company-b')).status, 403, action + ' debe bloquear asesor no asignado');
}
assert.equal((await call('bundle', 'company-a')).status, 200);
user = { email: 'owner-b@test.invalid', role: 'user', data: { company_id: 'company-b' } };
assert.equal((await call('bundle', 'company-a')).status, 403);
assert.equal((await call('bundle', 'company-b')).status, 200);
user = { email: 'admin@test.invalid', role: 'admin', data: {} };
assert.equal((await call('bundle', 'company-b')).status, 200);
console.log('Calendario fiscal: asesor no asignado bloqueado en lectura/escritura; propietario y admin permitidos.');

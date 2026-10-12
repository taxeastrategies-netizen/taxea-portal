import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

let user = null;
const company = { id: 'company-a', owner_email: 'owner@test.invalid', usuarios_autorizados: [] };
const profiles = [{ id: 'profile-a', company_id: 'company-a', name: 'Tercero A', taxId: 'TEST-A',
  accountingRole: 'cliente', accountingAccountCode: '43000007', externalAccountCode: '43000007',
  externalAccountYear: 2026, externalAccountStatus: 'verificado_nombre_unico', notes: 'private-note' }];
const svc = { entities: {
  Company: { async get(id) { return id === company.id ? company : null; } },
  CounterpartyFiscalProfile: { async filter(query) { return query.company_id === company.id ? profiles : []; } },
} };
const client = { auth: { async me() { return user; } }, asServiceRole: svc };
const built = await esbuild.build({
  entryPoints: [path.resolve('base44/functions/getAccountingCrosswalk/entry.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'mock-sdk', setup(build) {
    build.onResolve({ filter: new RegExp('^npm:@base44/sdk') }, () => ({ path: 'sdk', namespace: 'test' }));
    build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClientFromRequest = () => globalThis.__client;', loader: 'js' }));
  } }],
});
let handler;
const context = vm.createContext({ console, Request, Response, Date, __client: client,
  Deno: { serve(fn) { handler = fn; } } });
context.globalThis = context;
vm.runInContext(built.outputFiles[0].text, context);
const call = async body => {
  const response = await handler(new Request('https://test.invalid/crosswalk', { method: 'POST', body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json() };
};
assert.equal((await call({ company_id: 'company-a' })).status, 401);
user = { role: 'user', email: 'other@test.invalid', data: { company_id: 'company-b' } };
assert.equal((await call({ company_id: 'company-a' })).status, 403);
user = { role: 'user', email: 'owner@test.invalid', data: {} };
const owner = await call({ company_id: 'company-a' });
assert.equal(owner.status, 200);
assert.equal(owner.body.profiles[0].externalAccountCode, '43000007');
assert(!('notes' in owner.body.profiles[0]));
user = { role: 'admin', email: 'admin@test.invalid', data: {} };
assert.equal((await call({ company_id: 'company-a' })).status, 200);
console.log('Crosswalk endpoint: unauthorized denied, owner/admin allowed, fiscal notes omitted');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/fiscalOperations/entry.ts');
const build = await esbuild.build({
  stdin: { contents: fs.readFileSync(entry, 'utf8'), loader: 'ts', resolveDir: path.dirname(entry), sourcefile: entry },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{
    name: 'base44-test-client',
    setup(builder) {
      builder.onResolve({ filter: /^npm:/ }, () => ({ path: 'sdk', namespace: 'taxea-test' }));
      builder.onLoad({ filter: /^sdk$/, namespace: 'taxea-test' }, () => ({
        loader: 'js', contents: 'export function createClientFromRequest(){return globalThis.__base44TestClient}',
      }));
    },
  }],
});
const rows = {
  Company: [{ id: 'company-a', owner_email: 'owner@a.test' }, { id: 'company-b', owner_email: 'owner@b.test' }],
  FiscalProfile: [], FiscalActivity: [], TaxModel: [], FiscalProfileVersion: [], VerifactuIssuerSetup: [],
};
const entity = name => ({
  async get(id) { return rows[name]?.find(item => item.id === id) || null; },
  async filter(query) { return (rows[name] || []).filter(item => Object.entries(query).every(([key, value]) => item[key] === value)); },
  async create(data) {
    const row = { id: name + '-' + ((rows[name]?.length || 0) + 1), ...data };
    (rows[name] ||= []).push(row);
    return row;
  },
});
const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });
let currentUser = { email: 'owner@a.test', role: 'user', data: { company_id: 'company-a' } };
const testClient = { auth: { me: async () => currentUser }, asServiceRole: { entities } };
let handler;
const context = vm.createContext({
  console, Request, Response, URL, TextEncoder, Uint8Array, crypto: globalThis.crypto,
  __base44TestClient: testClient, Deno: { serve(fn) { handler = fn; } },
});
vm.runInContext(build.outputFiles[0].text, context, { filename: 'fiscalOperations.bundle.cjs' });
async function invoke(data) {
  const response = await handler(new Request('https://taxea.test/functions/fiscalOperations', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
  }));
  return { status: response.status, body: await response.json() };
}
const resource = 'projects/plasma-minutia-510419-c4/locations/europe-southwest1/secrets/test-issuer-a';
const normal = await invoke({ action: 'bundle', companyId: 'company-a' });
assert.equal(normal.status, 200);
assert.equal(normal.body.verifactuReadiness.certificateStatus, 'sin_certificado_verificado');
assert.equal(normal.body.verifactuReadiness.activationAllowed, false);
assert.equal(normal.body.verifactuReadiness.secretResource, undefined);
const denied = await invoke({ action: 'register_verifactu_vault_reference', companyId: 'company-a', secretResource: resource });
assert.equal(denied.status, 403);
currentUser = { email: 'admin@taxea.test', role: 'admin', data: {} };
for (const bad of ['-----BEGIN PRIVATE KEY-----', 'password=secret', 'projects/other/locations/europe-southwest1/secrets/test']) {
  const result = await invoke({ action: 'register_verifactu_vault_reference', companyId: 'company-a', secretResource: bad });
  assert.equal(result.status, 400);
}
assert.equal(rows.VerifactuIssuerSetup.length, 0);
const first = await invoke({ action: 'register_verifactu_vault_reference', companyId: 'company-a', secretResource: resource });
assert.equal(first.status, 200);
assert.equal(first.body.activationAllowed, false);
assert.equal(rows.VerifactuIssuerSetup.length, 1);
assert.equal(rows.VerifactuIssuerSetup[0].custody_status, 'referencia_registrada_sin_verificar');
const duplicate = await invoke({ action: 'register_verifactu_vault_reference', companyId: 'company-a', secretResource: resource });
assert.equal(duplicate.body.duplicate, true);
assert.equal(rows.VerifactuIssuerSetup.length, 1);
const adminView = await invoke({ action: 'bundle', companyId: 'company-a' });
assert.equal(adminView.body.verifactuReadiness.secretResource, resource);
assert.equal(adminView.body.verifactuReadiness.transmissionStatus, 'desactivada');
currentUser = { email: 'owner@a.test', role: 'user', data: { company_id: 'company-a' } };
const ownerView = await invoke({ action: 'bundle', companyId: 'company-a' });
assert.equal(ownerView.body.verifactuReadiness.certificateStatus, 'referencia_registrada_sin_verificar');
assert.equal(ownerView.body.verifactuReadiness.secretResource, undefined);
const crossTenant = await invoke({ action: 'bundle', companyId: 'company-b' });
assert.equal(crossTenant.status, 403);
console.log('Custodia VERI*FACTU: aislamiento, permisos, entradas, idempotencia y activación cerrada OK');

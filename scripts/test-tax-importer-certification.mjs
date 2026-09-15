import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/taxImporterCertification/entry.ts');
const build = await esbuild.build({
  entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'sdk-stub', setup(builder) {
    builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'stub' }));
    builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ loader: 'js', contents: 'export const createClientFromRequest=()=>globalThis.__client;' }));
  } }],
});
const payload = '2296-PRUEBA-SINTETICA';
const sha = createHash('sha256').update(payload).digest('hex');
const records = {
  Company: [{ id: 'company-qa', owner_email: 'owner@test.invalid', usuarios_autorizados: ['advisor@test.invalid'] }],
  TaxOfficialFile: [
    { id: 'file-qa', companyId: 'company-qa', modeloCodigo: '296', ejercicio: 2025, periodo: 'Anual', administracion: 'AEAT', nombreFichero: 'synthetic.296', versionDiseno: '2024', formato: 'Diseño de registro AEAT', immutable: true, contentBase64: Buffer.from(payload).toString('base64'), hash: sha },
    { id: 'guided-qa', companyId: 'company-qa', modeloCodigo: '417', ejercicio: 2025, periodo: '01', formato: 'Paquete de traspaso revisable ATC', immutable: true, contentBase64: Buffer.from(payload).toString('base64'), hash: sha },
    { id: 'bad-qa', companyId: 'company-qa', modeloCodigo: '296', ejercicio: 2025, periodo: 'Anual', formato: 'Diseño de registro AEAT', immutable: true, contentBase64: Buffer.from(payload).toString('base64'), hash: 'a'.repeat(64) },
  ],
  TaxImporterEvidence: [],
};
let handler;
let writes = 0;
let user = { email: 'owner@test.invalid', role: 'user', data: { company_id: 'company-qa' } };
let serial = 0;
const entity = name => ({
  get: async id => records[name].find(row => row.id === id) || null,
  filter: async (filter, _sort, limit, skip) => records[name].filter(row => Object.entries(filter).every(([key, value]) => row[key] === value)).slice(skip, skip + limit),
  create: async row => { writes++; const saved = { id: 'evidence-' + ++serial, ...row }; records[name].push(saved); return saved; },
  update: async (id, patch) => { writes++; const row = records[name].find(item => item.id === id); Object.assign(row, patch); return row; },
});
const client = { auth: { me: async () => user }, asServiceRole: { entities: Object.fromEntries(Object.keys(records).map(name => [name, entity(name)])) } };
const context = vm.createContext({ Buffer, Response, crypto: webcrypto, atob, Date, console, __client: client, Deno: { serve: fn => { handler = fn; } } });
vm.runInContext(build.outputFiles[0].text, context, { filename: entry });
const call = async body => {
  const response = await handler(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify(body) }));
  return { status: response.status, data: await response.json() };
};
const checks = [];
const suite = await call({ action: 'self_test' });
checks.push(suite.data.ok && Object.values(suite.data.checks).every(Boolean));
const denied = await call({ action: 'record', companyId: 'other-company', fileId: 'file-qa' });
checks.push(denied.status === 404 || denied.status === 403);
const base = { action: 'record', companyId: 'company-qa', fileId: 'file-qa', resultado: 'aceptado', fechaPrueba: '2025-02-02T12:00:00Z', respuestaImportador: 'Fichero aceptado por importador sintético', evidenceUrl: 'https://test.invalid/proof.pdf', confirmation: true };
checks.push((await call({ ...base, evidenceUrl: '' })).status === 400);
checks.push((await call({ ...base, fileId: 'guided-qa' })).status === 409);
checks.push((await call({ ...base, fileId: 'bad-qa' })).status === 409);
const accepted = await call(base);
checks.push(accepted.status === 200 && accepted.data.record.fileHashSha256 === sha && writes === 1);
const duplicate = await call(base);
checks.push(duplicate.data.alreadyExisted === true && writes === 1);
checks.push((await call({ action: 'review', companyId: 'company-qa', recordId: accepted.data.record.id, confirmation: true })).status === 403);
user = { email: 'advisor@test.invalid', role: 'asesor', data: {} };
const reviewed = await call({ action: 'review', companyId: 'company-qa', recordId: accepted.data.record.id, confirmation: true });
checks.push(reviewed.status === 200 && reviewed.data.record.revisionAsesor === 'revisada' && writes === 2);
const list = await call({ action: 'list', companyId: 'company-qa', ejercicio: 2025 });
checks.push(list.data.rows.length === 1 && list.data.rows[0].resultado === 'aceptado' && list.data.rows[0].revisionAsesor === 'revisada');
console.log(JSON.stringify({ ok: checks.every(Boolean), checks, writes, records: records.TaxImporterEvidence.length }, null, 2));
if (!checks.every(Boolean)) process.exitCode = 1;

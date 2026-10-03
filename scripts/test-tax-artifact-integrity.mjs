import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = fs.readFileSync('base44/functions/taxModelOperations/entry.ts', 'utf8');
const start = source.indexOf("    if(action==='download_official_file') {");
const end = source.indexOf("    if(action==='open_draft') {", start);
assert.ok(start > 0 && end > start);
const branch = source.slice(start, end).replace('let contentBytes: Uint8Array;', 'let contentBytes;').replace('(char:string)', '(char)');
const bytes = new TextEncoder().encode('MODELO FICTICIO');
const hash = async data => Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', data))).map(n => n.toString(16).padStart(2, '0')).join('');
const valid = { id: 'file-1', companyId: 'company-1', contentBase64: Buffer.from(bytes).toString('base64'),
  contentSize: bytes.length, hash: await hash(bytes), immutable: true };
async function download(file) {
  const svc = { entities: { TaxOfficialFile: { get: async () => file } } };
  const context = { action: 'download_official_file', body: { fileId: 'file-1' }, svc, companyId: 'company-1',
    clean: value => String(value || '').trim(), sha256Bytes: hash, Response, Uint8Array, atob, Number };
  const execute = vm.runInNewContext('(async () => {' + branch + '})', context);
  const response = await execute();
  return { status: response.status, payload: await response.json() };
}
assert.equal((await download(valid)).status, 200);
assert.equal((await download({ ...valid, contentBase64: '' })).status, 410);
assert.equal((await download({ ...valid, immutable: false })).status, 410);
assert.equal((await download({ ...valid, contentSize: 1 })).status, 409);
assert.equal((await download({ ...valid, hash: 'wrong' })).status, 409);
assert.equal((await download({ ...valid, companyId: 'other' })).status, 404);
console.log(JSON.stringify({ ok: true, checks: ['valid_artifact', 'legacy_missing_content', 'mutable_rejected', 'size_mismatch', 'hash_mismatch', 'tenant_scope'] }));

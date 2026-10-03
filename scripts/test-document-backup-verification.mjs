import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = fs.readFileSync('base44/functions/documentBackupToDrive/entry.ts', 'utf8');
const start = source.indexOf('    // ── VERIFY action:');
const end = source.indexOf('    // ── BACKUP action ──', start);
assert.ok(start > 0 && end > start);
const branch = source.slice(start, end);
const hash = async bytes => Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('');

async function scenario({ missingIndex = -1, corruptIndex = -1, manifestCorrupt = false } = {}) {
  const contents = Array.from({ length: 27 }, (_, index) => new Uint8Array([index]));
  const entries = await Promise.all(contents.map(async (bytes, index) => ({
    driveFileId: 'file-' + index,
    checksum: await hash(bytes),
    size: bytes.length,
    status: 'backed_up',
  })));
  const manifestBytes = new TextEncoder().encode(JSON.stringify({ totalDocuments: entries.length, documents: entries }));
  const job = {
    id: 'job-1', status: 'completed', manifestDriveFileId: 'manifest-1',
    manifestChecksum: manifestCorrupt ? 'wrong' : await hash(manifestBytes),
    documentsScanned: entries.length,
  };
  let calls = 0;
  const driveGet = async url => {
    calls++;
    if (url.includes('manifest-1')) return new Response(manifestBytes);
    const match = url.match(/file-([0-9]+)/);
    assert.ok(match, url);
    const index = Number(match[1]);
    if (index === missingIndex) return new Response(null, { status: 404 });
    if (url.includes('alt=media')) return new Response(index === corruptIndex ? new Uint8Array([255]) : contents[index]);
    return new Response(JSON.stringify({ id: 'file-' + index, size: 1, trashed: false }), {
      headers: { 'content-type': 'application/json' },
    });
  };
  const base44 = {
    asServiceRole: { entities: { BackupJob: {
      list: async () => [job],
      update: async (_id, data) => Object.assign(job, data),
    } } },
  };
  const context = { action: 'verify', body: {}, base44, accessToken: 'synthetic',
    driveGet, computeChecksum: hash, DRIVE_API: 'https://drive.example/files',
    Response, TextDecoder, Uint8Array, encodeURIComponent, Date, Number, Set, JSON };
  const execute = vm.runInNewContext('(async () => {' + branch + '})', context);
  const first = await execute();
  const firstData = await first.json();
  assert.equal(firstData.status, manifestCorrupt ? 'incidents' : 'partial');
  if (manifestCorrupt) {
    assert.equal(first.status, 409);
    assert.equal(job.verificationStatus, 'incidents');
    return;
  }
  assert.equal(firstData.checked, 25);
  assert.equal(firstData.remaining, 2);
  const second = await execute();
  const secondData = await second.json();
  assert.equal(secondData.checked, 27);
  assert.equal(secondData.remaining, 0);
  assert.equal(secondData.status, missingIndex >= 0 || corruptIndex >= 0 ? 'incidents' : 'ok');
  assert.equal(secondData.missing, missingIndex >= 0 || corruptIndex >= 0 ? 1 : 0);
  if (missingIndex < 0 && corruptIndex < 0) assert.equal(secondData.checksumChecked, 3);
  const beforeRepeat = calls;
  const cached = await execute();
  assert.equal((await cached.json()).status, secondData.status);
  assert.equal(calls, beforeRepeat, 'finished verification must not repeat Drive reads');
}

await scenario();
await scenario({ missingIndex: 26 });
await scenario({ corruptIndex: 0 });
await scenario({ manifestCorrupt: true });
console.log(JSON.stringify({ ok: true, checks: ['resumable_full_manifest', 'missing_file', 'content_hash_mismatch', 'manifest_hash_mismatch', 'idempotent_result'] }));

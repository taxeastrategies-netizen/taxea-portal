import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('base44/functions/documentBackupToDrive/entry.ts'), 'utf8');

assert.match(source, /const BACKUP_APP_ID = '6a00fec50cc522a74ddde4b2'/);
assert.match(source, /url\.protocol !== 'https:'/);
assert.match(source, /url\.hostname\.toLowerCase\(\) !== BACKUP_MEDIA_HOST/);
assert.match(source, /url\.pathname\.startsWith\(BACKUP_FILE_PREFIX\)/);
assert.match(source, /fetch\(fileUrl, \{ redirect: 'error', signal: controller\.signal \}\)/);
assert.match(source, /MAX_BACKUP_FILE_BYTES = 50 \* 1024 \* 1024/);
assert.match(source, /declaredLength > MAX_BACKUP_FILE_BYTES/);
assert.match(source, /arrayBuffer\.byteLength > MAX_BACKUP_FILE_BYTES/);
assert.doesNotMatch(source, /fetch\(fileUrl\)/);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    fixedHttpsMediaOrigin: true,
    appScopedStoragePath: true,
    redirectsDisabled: true,
    downloadTimeoutEnabled: true,
    declaredAndActualSizeLimited: true,
    rawDocumentUrlNeverFetched: true,
  },
}, null, 2));


import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('base44/functions/importClientAccounting/entry.ts'), 'utf8');

assert.match(source, /url\.protocol !== 'https:'/);
assert.match(source, /url\.hostname\.toLowerCase\(\) !== IMPORT_MEDIA_HOST/);
assert.match(source, /url\.pathname\.startsWith\(IMPORT_FILE_PREFIX\)/);
assert.match(source, /url\.pathname\.toLowerCase\(\)\.endsWith\('\.xlsx'\)/);
assert.match(source, /fetch\(importFileUrl, \{ redirect: 'error', signal: controller\.signal \}\)/);
assert.match(source, /MAX_IMPORT_BYTES = 30 \* 1024 \* 1024/);
assert.match(source, /declaredLength > MAX_IMPORT_BYTES/);
assert.match(source, /arrayBuffer\.byteLength > MAX_IMPORT_BYTES/);
assert.doesNotMatch(source, /fetch\(file_url\)/);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    fixedHttpsMediaOrigin: true,
    appScopedXlsxPath: true,
    redirectsDisabled: true,
    downloadTimeoutEnabled: true,
    declaredAndActualSizeLimited: true,
    rawClientUrlNeverFetched: true,
  },
}, null, 2));

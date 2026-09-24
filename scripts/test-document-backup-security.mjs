import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve('base44/functions/documentBackupToDrive/entry.ts'), 'utf8');

assert.match(source, /const BACKUP_APP_ID = '6a00fec50cc522a74ddde4b2'/);
assert.match(source, /url\.protocol !== 'https:'/);
assert.match(source, /hostname: 'media\.base44\.com'/);
assert.match(source, /hostname: 'base44\.app'/);
assert.match(source, /\/api\/apps\/\$\{BACKUP_APP_ID\}\/files\/mp\/public\/\$\{BACKUP_APP_ID\}\//);
assert.match(source, /AUTHORIZED_BACKUP_LOCATIONS\.some/);
assert.match(source, /hostname === location\.hostname && url\.pathname\.startsWith\(location\.pathPrefix\)/);
assert.match(source, /fetch\(fileUrl, \{ redirect: 'error', signal: controller\.signal \}\)/);
assert.match(source, /MAX_BACKUP_FILE_BYTES = 50 \* 1024 \* 1024/);
assert.match(source, /declaredLength > MAX_BACKUP_FILE_BYTES/);
assert.match(source, /arrayBuffer\.byteLength > MAX_BACKUP_FILE_BYTES/);
assert.doesNotMatch(source, /fetch\(fileUrl\)/);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    fixedHttpsMediaOrigins: true,
    currentAndLegacyAppScopedStoragePaths: true,
    redirectsDisabled: true,
    downloadTimeoutEnabled: true,
    declaredAndActualSizeLimited: true,
    rawDocumentUrlNeverFetched: true,
  },
}, null, 2));


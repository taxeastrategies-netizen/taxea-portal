import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const groups = [
  [
    'base44/functions/accountingOperations/accountingEngine.ts',
    'base44/functions/anularFacturas/accountingEngine.ts',
    'base44/functions/approveOcrDocument/accountingEngine.ts',
    'base44/functions/invoiceOperations/accountingEngine.ts',
    'base44/functions/migrateAccountingToPgc8/accountingEngine.ts',
    'base44/functions/openBanking/accountingEngine.ts',
  ],
  [
    'base44/functions/accountingOperations/accountingReportEngine.ts',
    'base44/functions/businessDashboardOperations/accountingReportEngine.ts',
  ],
];
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex');
const checked = groups.map(files => {
  const hashes = files.map(file => ({ file, sha256: digest(file) }));
  assert.equal(new Set(hashes.map(item => item.sha256)).size, 1, `Las copias autocontenidas derivadas de ${files[0]} no son idénticas. Ejecuta npm run sync:accounting-engine.`);
  return { canonical: files[0], canonicalHash: hashes[0].sha256, copiesVerified: files.length - 1 };
});

console.log(JSON.stringify({ ok: true, groups: checked, copiesVerified: checked.reduce((sum, group) => sum + group.copiesVerified, 0) }, null, 2));

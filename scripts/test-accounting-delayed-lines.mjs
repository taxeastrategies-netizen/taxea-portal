import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entryPath = path.resolve('base44/functions/accountingOperations/accountingEngine.ts');
const build = await esbuild.build({
  stdin: { contents: fs.readFileSync(entryPath, 'utf8'), loader: 'ts', resolveDir: path.dirname(entryPath), sourcefile: entryPath },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{
    name: 'base44-sdk-stub',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'test' }));
      builder.onLoad({ filter: /^sdk$/, namespace: 'test' }, () => ({ loader: 'js', contents: 'export const createClientFromRequest = () => null;' }));
    },
  }],
});
const module = { exports: {} };
vm.runInNewContext(build.outputFiles[0].text, { module, exports: module.exports, setTimeout, TextEncoder, crypto: globalThis.crypto });
const { commitJournalEntry } = module.exports;
const companyId = 'qa-company';
const entry = { id: 'entry-1', companyId, status: 'borrador', totalDebit: 1210, totalCredit: 1210 };
const persisted = [
  { id: 'line-1', companyId, journalEntryId: entry.id, accountCode: '43000001', debit: 1210, credit: 0 },
  { id: 'line-2', companyId, journalEntryId: entry.id, accountCode: '70500000', debit: 0, credit: 1000 },
  { id: 'line-3', companyId, journalEntryId: entry.id, accountCode: '47700000', debit: 0, credit: 210 },
];
let reads = 0;
let lineUpdates = 0;
let entryUpdates = 0;
const svc = { entities: {
  JournalEntryLine: {
    async filter() { reads += 1; return reads === 1 ? persisted.slice(0, 1) : persisted; },
    async bulkUpdate(rows) { lineUpdates += 1; assert.equal(rows.length, 3); return rows; },
  },
  JournalEntry: {
    async update(id, patch) { entryUpdates += 1; assert.equal(id, entry.id); return { ...entry, ...patch }; },
  },
}};
const result = await commitJournalEntry(svc, companyId, entry, 'advisor@qa.test');
assert.equal(reads, 2);
assert.equal(lineUpdates, 1);
assert.equal(entryUpdates, 1);
assert.equal(result.entry.status, 'confirmado');
assert.equal(result.entry.totalDebit, 1210);
assert.equal(result.entry.totalCredit, 1210);
console.log(JSON.stringify({ ok: true, checks: ['eventual-line-read-retried', 'balanced-entry-confirmed-once'] }));

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';

const build = await esbuild.build({ entryPoints: ['base44/functions/finalizeOcrCredits/entry.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'sdk-stub', setup(b) {
  b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'qa' }));
  b.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: 'export function createClientFromRequest(){return globalThis.__client}', loader: 'js' }));
} }] });
let handler, user, rows, reads, writes, checks = 0;
const entities = new Proxy({}, { get: (_, name) => ({
  filter: async (query = {}) => { reads++; return (rows[name] || []).filter(row => Object.entries(query).every(([k, v]) => row[k] === v)); },
  get: async id => { reads++; return (rows[name] || []).find(row => row.id === id); },
  update: async (id, patch) => { writes++; const row = rows[name].find(row => row.id === id); assert.ok(row); Object.assign(row, patch); return row; },
}) });
const ctx = vm.createContext({ console: { log() {}, error() {} }, Request, Response, __client: { auth: { me: async () => user }, asServiceRole: { entities } }, Deno: { serve(fn) { handler = fn; }, env: { get() { return ''; } } } });
vm.runInContext(build.outputFiles[0].text, ctx);
function reset(role = 'user') {
  user = { id: 'qa', email: 'qa@invalid.test', role }; reads = 0; writes = 0;
  rows = { OcrCreditReservation: [{ id: 'r', billingAccountId: 'a', quotaPeriodId: 'p', idempotencyKey: 'same', creditsReserved: 1, status: 'reserved' }], OcrQuotaPeriod: [{ id: 'p', billingAccountId: 'a', reservedCredits: 1, consumedCredits: 0, currentPlanLimit: 10, manualCredits: 0 }], OcrUsageEvent: [{ id: 'event-a', billingAccountId: 'a', quotaPeriodId: 'p', idempotencyKey: 'same' }, { id: 'event-b', billingAccountId: 'b', quotaPeriodId: 'b', idempotencyKey: 'same' }] };
}
async function invoke(success, status, method = 'POST') {
  const response = await handler(new Request('https://qa.invalid', { method, ...(method === 'POST' ? { body: JSON.stringify({ reservationId: 'r', success }) } : {}) }));
  assert.equal(response.status, status, await response.clone().text()); checks++;
  return response.json();
}
for (const role of ['user', 'asesor', 'advisor', 'owner']) for (const outcome of [false, true]) { reset(role); await invoke(outcome, 403); assert.equal(reads, 0); assert.equal(writes, 0); }
reset(); user = null; await invoke(false, 401); assert.equal(writes, 0);
for (const patch of [{ accountAccessStatus: 'disabled' }, { is_deleted: true }, { data: { status: 'bloqueado' } }]) { reset('admin'); Object.assign(user, patch); await invoke(false, 403); assert.equal(reads, 0); assert.equal(writes, 0); }
reset('admin'); await invoke(false, 200); assert.equal(rows.OcrCreditReservation[0].status, 'released'); assert.equal(rows.OcrQuotaPeriod[0].reservedCredits, 0); assert.equal(rows.OcrUsageEvent[0].status, 'failed'); assert.equal(rows.OcrUsageEvent[1].status, undefined);
reset('super_admin'); await invoke(true, 200); assert.equal(rows.OcrQuotaPeriod[0].consumedCredits, 1); assert.equal(rows.OcrQuotaPeriod[0].reservedCredits, 0); assert.equal(rows.OcrUsageEvent[1].status, undefined); const previousWrites = writes; await invoke(true, 200); assert.equal(writes, previousWrites);
reset('admin'); rows.OcrQuotaPeriod[0].billingAccountId = 'b'; await invoke(true, 409); assert.equal(writes, 0);
reset('admin'); rows.OcrCreditReservation[0].creditsReserved = -1; await invoke(true, 409); assert.equal(writes, 0);
reset('admin'); await invoke('false', 400); assert.equal(writes, 0);
reset('admin'); await invoke(false, 405, 'GET'); assert.equal(reads, 0);
const frontendFiles = [];
function walk(dir) { for (const row of fs.readdirSync(dir, { withFileTypes: true })) { const path = dir + '/' + row.name; if (row.isDirectory()) walk(path); else if (/\.(jsx?|tsx?|mjs)$/.test(path)) frontendFiles.push(path); } }
walk('src'); assert.ok(frontendFiles.every(path => !/finalizeOcrCredits|reserveOcrCredits/.test(fs.readFileSync(path, 'utf8'))), 'Legacy endpoints have no frontend callers');
console.log(JSON.stringify({ ok: true, checks, actualHandler: true, nonAdminWrites: 0, noFrontendCallers: true, productionDataWrites: 0 }));

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
const entry=path.resolve('base44/functions/anularFacturas/entry.ts');
const build=await esbuild.build({stdin:{contents:fs.readFileSync(entry,'utf8'),loader:'ts',resolveDir:path.dirname(entry)},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'qa-stubs',setup(b){
 b.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'qa'}));
 b.onLoad({filter:/^sdk$/,namespace:'qa'},()=>({loader:'js',contents:'export const createClientFromRequest=()=>globalThis.__client;'}));
 b.onResolve({filter:/^\.\/accountingEngine\.ts$/},()=>({path:'engine',namespace:'qa'}));
 b.onLoad({filter:/^engine$/,namespace:'qa'},()=>({loader:'js',contents:"export const SCHEMA_VERSION='pgc8-v1'; export const canonical8=x=>x; export const assertAccountingDateOpen=()=>globalThis.__dateOpen(); export const commitJournalEntry=(...args)=>globalThis.__commit(...args); export const createJournalEntry=()=>globalThis.__create();"}));
}}]});
const invoice = { id: 'I', company_id: 'QA', linked_journal_entry_id: 'J', anulada: false };
const otherInvoice = { id: 'I2', company_id: 'QA', anulada: false };
const foreignInvoice = { id: 'FOREIGN', company_id: 'OTHER', anulada: false };
const original = { id: 'J', companyId: 'QA', status: 'confirmado', date: '2026-10-06' };
const reversal = { id: 'R', companyId: 'QA', status: 'borrador', date: '2026-10-06', postingKey: 'reversal:J:pgc8-v1' };
let failCommit = true;
let closed = false;
let creates = 0;
let commits = 0;
let handler;
let withPayments = false;
const entries = [original, reversal];
const invoices = [invoice, otherInvoice, foreignInvoice];
const match = (row, query) => Object.entries(query).every(([key, value]) => {
  if (value?.$in) return value.$in.includes(row[key] ?? null);
  if (value?.$ne !== undefined) return row[key] !== value.$ne;
  return row[key] === value;
});
const entities = {
  Company: { get: async () => ({ id: 'QA', owner_email: 'qa@taxea.test', usuarios_autorizados: [] }) },
  Invoice: {
    filter: async query => {
      assert.equal(query.company_id, 'QA');
      assert(Array.isArray(query.id.$in), 'Only requested IDs should be queried');
      return invoices.filter(row => match(row, query));
    },
    get: async id => invoices.find(row => row.id === id),
    update: async (id, patch) => Object.assign(invoices.find(row => row.id === id), patch),
    updateMany: async (query, update) => {
      const found = invoices.filter(row => match(row, query));
      for (const row of found) Object.assign(row, update.$set);
      return { updated: found.length };
    },
  },
  InvoicePayment: { filter: async () => withPayments ? [{ id: 'P' }] : [] },
  JournalEntry: {
    get: async id => entries.find(entry => entry.id === id),
    filter: async query => entries.filter(entry => match(entry, query)),
    update: async (id, patch) => Object.assign(entries.find(entry => entry.id === id), patch),
  },
};
const context = vm.createContext({
  console, Request, Response, Date, Promise, crypto, setTimeout: fn => setTimeout(fn, 0),
  __client: {
    auth: { me: async () => ({ id: 'user-qa', role: 'user', company_id: 'QA', email: 'qa@taxea.test' }) },
    asServiceRole: { entities },
  },
  __dateOpen: () => { if (closed) throw new Error('El ejercicio 2026 está cerrado.'); },
  __commit: async (_svc, companyId, entry) => {
    assert.equal(entry.companyId, companyId);
    commits++;
    if (failCommit) { failCommit = false; throw new Error('Fallo simulado confirmando contraasiento'); }
    entry.status = 'confirmado';
    return { entry };
  },
  __create: () => { creates++; throw new Error('No debe duplicarse el contraasiento'); },
  Deno: { serve: fn => { handler = fn; } },
});
vm.runInContext(build.outputFiles[0].text, context);
const call = (invoiceIds = ['I'], motivo = 'QA ficticia') => handler(new Request('https://taxea.test/annul', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ companyId: 'QA', invoiceIds, motivo }),
}));
assert.equal((await call(['I'], '')).status, 400);
const interrupted = await (await call()).json();
assert.equal(interrupted.results[0].status, 'failed');
assert.equal(invoice.anulada, false);
assert.equal(original.reversalEntryId, undefined);
closed = true;
assert.match((await (await call()).json()).results[0].error, /cerrado/);
assert.equal(invoice.anulada, false);
closed = false;
const batch = await (await call(['I', 'FOREIGN', 'I2', 'I2'])).json();
assert.deepEqual(batch.annulledIds, ['I', 'I2']);
assert.equal(batch.annulled, 2);
assert.equal(batch.success, false);
assert.equal(reversal.status, 'confirmado');
assert.equal(invoice.anulada, true);
assert.equal(otherInvoice.anulada, true);
assert.equal(foreignInvoice.anulada, false);
assert.equal(original.reversalEntryId, 'R');
assert.equal((await (await call()).json()).results[0].status, 'already_annulled');
assert.equal(creates, 0);
assert.equal(commits, 2);
invoice.anulada = false;
withPayments = true;
assert.match((await (await call()).json()).results[0].error, /cobros o pagos/);
withPayments = false;
invoice.linked_journal_entry_id = 'MISSING';
assert.equal((await (await call()).json()).results[0].status, 'failed');
assert.equal(invoice.anulada, false);
invoice.linked_journal_entry_id = 'J';
original.companyId = 'OTHER';
assert.equal((await (await call()).json()).results[0].status, 'failed');
assert.equal(invoice.anulada, false);
const concurrentInvoice = { id: 'PARALLEL', company_id: 'QA', anulada: false };
invoices.push(concurrentInvoice);
const parallel = await Promise.all([call(['PARALLEL']), call(['PARALLEL'])]);
const outcomes = await Promise.all(parallel.map(response => response.json()));
assert.equal(outcomes.reduce((count, result) => count + result.annulled, 0), 1);
assert.equal(concurrentInvoice.anulada, true);
console.log(JSON.stringify({ ok: true, exactSelection: true, partialBatch: true, blockedPayment: true, noDoubleAnnulment: true, closedPeriod: true, resumedReversal: true, realWrites: 0 }));

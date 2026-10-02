import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
const entry = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../base44/functions/stripeCustomerPortal/entry.ts');
const build = await esbuild.build({
  entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{ name: 'stubs', setup(builder) {
    builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'stub' }));
    builder.onResolve({ filter: /^npm:stripe/ }, () => ({ path: 'stripe', namespace: 'stub' }));
    builder.onLoad({ filter: /^sdk$/, namespace: 'stub' }, () => ({ loader: 'js', contents: 'export const createClientFromRequest=()=>globalThis.__client;' }));
    builder.onLoad({ filter: /^stripe$/, namespace: 'stub' }, () => ({ loader: 'js', contents: 'export default class Stripe { billingPortal={sessions={create: async p => { globalThis.__calls.push(p); return {url: \'https://billing.test.invalid/session\'}; }}} }' }));
  } }],
});
let user = { id: 'user-a', stripeCustomerId: 'cus_FORGED', role: 'user' };
let subscriptions = [];
const calls = [];
const client = {
  auth: { me: async () => user },
  asServiceRole: { entities: { Subscription: { filter: async query => subscriptions.filter(s => s.userId === query.userId) } } },
};
let handler;
vm.runInContext(build.outputFiles[0].text, vm.createContext({
  console, Request, Response, URL, module: { exports: {} }, exports: {},
  __client: client, __calls: calls, Deno: { env: { get: () => 'synthetic-secret-not-sent' }, serve: fn => { handler = fn; } },
}), { filename: entry });
const invoke = async () => {
  const response = await handler(new Request('https://test.invalid', { method: 'POST' }));
  return { status: response.status, body: await response.json() };
};
assert.equal((await invoke()).status, 404);
assert.equal(calls.length, 0);
subscriptions = [{ userId: 'user-b', stripeCustomerId: 'cus_VICTIM' }, { userId: 'user-a', stripeCustomerId: 'cus_OWN' }];
assert.equal((await invoke()).status, 200);
assert.equal(calls[0].customer, 'cus_OWN');
subscriptions.push({ userId: 'user-a', stripeCustomerId: 'cus_OTHER' });
assert.equal((await invoke()).status, 409);
assert.equal(calls.length, 1);
user = null;
assert.equal((await invoke()).status, 401);
console.log('Portal Stripe: ID editable ignorado, identidad protegida y duplicados bloqueados.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/enviarWhatsApp/entry.ts');
const bundle = await esbuild.build({
  stdin: { contents: fs.readFileSync(entry, 'utf8'), loader: 'ts', resolveDir: path.dirname(entry), sourcefile: entry },
  bundle: true, write: false, platform: 'node', format: 'cjs',
  plugins: [{
    name: 'sdk-stub',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'test' }));
      builder.onLoad({ filter: /^sdk$/, namespace: 'test' }, () => ({
        loader: 'js', contents: 'export function createClientFromRequest(){ return globalThis.__client; }',
      }));
    },
  }],
});
let currentUser = null;
let handler;
let externalCalls = 0;
const context = vm.createContext({
  console, Request, Response,
  __client: { auth: { async me() { return currentUser; } } },
  fetch() { externalCalls++; throw new Error('External send forbidden in this test'); },
  Deno: {
    serve(fn) { handler = fn; },
    env: { get() { throw new Error('Secrets must not be read while disabled'); } },
  },
});
vm.runInContext(bundle.outputFiles[0].text, context, { filename: 'enviarWhatsApp.bundle.cjs' });
const invoke = async () => {
  const response = await handler(new Request('https://taxea.test/functions/enviarWhatsApp', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to: '+34000000000', mensaje: 'Prueba sintética' }),
  }));
  return { status: response.status, body: await response.json() };
};
assert.equal((await invoke()).status, 403);
currentUser = { role: 'user' };
assert.equal((await invoke()).status, 403);
currentUser = { role: 'admin' };
const disabled = await invoke();
assert.equal(disabled.status, 200);
assert.equal(disabled.body.success, false);
assert.equal(disabled.body.status, 'disabled');
assert.equal(externalCalls, 0);
console.log('WhatsApp inactivo: ningún secreto leído ni envío externo, acceso admin y respuesta explícita OK.');

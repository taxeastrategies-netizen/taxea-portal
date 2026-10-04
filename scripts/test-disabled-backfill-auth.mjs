import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/backfillOcrContactDetails/entry.ts');
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
const client = { auth: { async me() { return currentUser; } } };
const context = vm.createContext({
  console, Request, Response, __client: client, Deno: { serve(fn) { handler = fn; } },
});
vm.runInContext(bundle.outputFiles[0].text, context, { filename: 'backfillOcrContactDetails.bundle.cjs' });

const request = new Request('https://taxea.test/functions/backfillOcrContactDetails', { method: 'POST' });
assert.equal((await handler(request)).status, 401);
currentUser = { id: 'synthetic-user', disabled: false };
assert.equal((await handler(request)).status, 410);
currentUser = { id: 'synthetic-disabled-user', disabled: true };
assert.equal((await handler(request)).status, 401);
console.log('Migración desactivada: anónimo/deshabilitado 401, autenticado 410; sin escrituras.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const protectedFunctions = [
  'anularFacturas',
  'invoiceOperations',
  'fiscalOperations',
  'documentBackupToDrive',
  'generateRecurringInvoices',
  'trackClientAccess',
  'bankSync',
  'sendClientInviteEmail',
];

for (const name of protectedFunctions) {
  const entry = path.resolve('base44/functions', name, 'entry.ts');
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
  let handler;
  let privilegedCalls = 0;
  const client = {
    auth: { async me() { return null; } },
    get asServiceRole() { privilegedCalls++; throw new Error('Privileged access before authentication'); },
  };
  const context = vm.createContext({
    console, Request, Response, URL, URLSearchParams, TextEncoder, TextDecoder, Intl, crypto,
    __client: client,
    Deno: { serve(fn) { handler = fn; }, env: { get() { privilegedCalls++; throw new Error('Secret read before authentication'); } } },
    fetch() { privilegedCalls++; throw new Error('Network access before authentication'); },
  });
  vm.runInContext(bundle.outputFiles[0].text, context, { filename: name + '.bundle.cjs' });
  assert.equal(typeof handler, 'function', name + ' must register a handler');
  const request = new Request('https://taxea.test/functions/' + name, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  const response = await handler(request);
  assert.equal(response.status, 401, name + ' must reject an anonymous caller');
  assert.equal(privilegedCalls, 0, name + ' must not access service role, network or secrets first');
}
console.log('Ocho funciones sensibles: anónimo 401 antes de datos, red o secretos.');

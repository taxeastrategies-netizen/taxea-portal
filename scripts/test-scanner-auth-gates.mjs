import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';

const protectedFunctions = [
  'anularFacturas',
  'checkDuplicates',
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
    console, Request, Response, URL, URLSearchParams, TextEncoder, TextDecoder, Intl, crypto, setTimeout: fn => setTimeout(fn, 0),
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
  if (name === 'checkDuplicates') {
    let documentReads = 0;
    context.__client = { auth:{me:async()=>({role:'user',email:'owner@qa.test',data:{company_id:'OTHER'}})}, asServiceRole:{entities:{
      Company:{get:async()=>({id:'OTHER',owner_email:'someoneelse@qa.test',usuarios_autorizados:[]})},
      Invoice:{filter:async()=>{documentReads++;return[];}}
    }}};
    const denied = await handler(new Request('https://taxea.test/functions/checkDuplicates',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({company_id:'OTHER',scope:'invoices_emitida'})}));
    assert.equal(denied.status,403,'Cambiar company_id en el perfil no concede acceso a facturas ajenas');
    assert.equal(documentReads,0);
  }
  if (name === 'anularFacturas') {
    for (const [identity, companyId, expectedStatus] of [
      [{role:'user',company_id:'QA'},'QA',200],
      [{role:'user',data:{company_id:'QA'}},'QA',200],
      [{role:'user',company_id:'QA'},'OTHER',403],
      [{role:'user'},'QA',403],
      [{role:'admin',company_id:'ADMIN'},'QA',200],
    ]) {
      let reads=0;
      context.__client={auth:{me:async()=>({...identity,email:'owner@qa.test'})},asServiceRole:{entities:{Company:{get:async()=>({id:'QA',owner_email:'owner@qa.test'})},Invoice:{filter:async query=>{
        reads++;assert.equal(query.company_id,'QA');return [];
      }}}}};
      const response=await handler(new Request('https://taxea.test/functions/anularFacturas',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({companyId,invoiceIds:['FAKE'],motivo:'Prueba ficticia sin escrituras'})
      }));
      assert.equal(response.status,expectedStatus,'Compatibilidad de perfil y aislamiento en anulación');
      assert.equal(reads,expectedStatus===200?1:0,'Sin lectura de empresas ajenas');
    }
  }
}
console.log('Nueve funciones sensibles: anónimo 401 antes de datos, red o secretos; company_id manipulable no concede acceso.');

import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {webcrypto} from 'node:crypto';import * as esbuild from 'esbuild';
let user=null,handler,envReads=0;
const source=fs.readFileSync(process.argv[2]||'base44/functions/documentStorage/entry.ts','utf8');
const dir=path.dirname(path.resolve(process.argv[2]||'base44/functions/documentStorage/entry.ts'));
const compiled=await esbuild.build({stdin:{contents:source,loader:'ts',resolveDir:dir},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'isolated-sdk',setup(b){b.onResolve({filter:/^npm:@base44/},()=>({path:'sdk',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({loader:'js',contents:'export const createClientFromRequest=()=>({auth:{me:async()=>globalThis.__user()}});'}));}}]});
vm.runInNewContext(compiled.outputFiles[0].text,{__user:()=>user,console:{log(){},error(){}},Request,Response,TextEncoder,TextDecoder,File,Blob,URL,AbortController,setTimeout,clearTimeout,crypto:webcrypto,Uint8Array,atob,btoa,Date,Deno:{serve:f=>handler=f,env:{get(){envReads++;return undefined;}}}});
for(const identity of [null,{id:'user',role:'user'},{id:'admin',role:'admin',is_deleted:true},{id:'admin',role:'admin',data:{accountAccessStatus:'suspended'}}])for(const action of ['public_certificate','verify_connection','verify_signed_connection','staging_capabilities','upload_staging','assign_staged_asset']){user=identity;const r=await handler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify({action})}));assert.equal(r.status,identity?403:401);assert.equal(envReads,0);}
user={id:'admin',role:'admin'};assert.equal((await handler(new Request('https://qa.invalid',{method:'GET'}))).status,405);assert.equal(envReads,0);
const r=await handler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify({action:'public_certificate'})}));assert.equal(r.status,503);assert.equal(JSON.stringify(await r.json()).includes('PRIVATE KEY'),false);
console.log(JSON.stringify({ok:true,anonymousDenied:true,normalUserDenied:true,disabledAdminDenied:true,secretReadAfterAuthOnly:true,missingConfigFailsClosed:true}));


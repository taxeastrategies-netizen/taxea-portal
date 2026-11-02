import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {hydrateTaxFile} from '../base44/functions/taxModelOperations/taxFileStorage.mjs';

const source=fs.readFileSync('base44/functions/taxModelOperations/entry.ts','utf8');
const start=source.indexOf("    if(action==='download_official_file') {"),end=source.indexOf("    if(action==='open_draft') {",start);
assert(start>0&&end>start);
const branch=source.slice(start,end).replace('let contentBytes: Uint8Array;','let contentBytes;').replace('(char:string)','(char)');
const bytes=new TextEncoder().encode('MODELO FICTICIO');
const hash=async data=>Buffer.from(await webcrypto.subtle.digest('SHA-256',data)).toString('hex');
const valid={id:'file-1',companyId:'company-1',contentBase64:Buffer.from(bytes).toString('base64'),contentSize:bytes.length,hash:await hash(bytes),immutable:true};
async function download(file,chunks=[]){
 const svc={entities:{TaxOfficialFile:{get:async()=>file},TaxOfficialFileChunk:{filter:async query=>chunks.filter(r=>r.companyId===query.companyId&&r.fileId===query.fileId)}}};
 const context={action:'download_official_file',body:{fileId:'file-1'},svc,companyId:'company-1',hydrateTaxFile,clean:value=>String(value||'').trim(),sha256Bytes:hash,Response,Uint8Array,atob,Number};
 const execute=vm.runInNewContext('(async () => {'+branch+'})',context),response=await execute();
 return {status:response.status,payload:await response.json()};
}
assert.equal((await download(valid)).status,200);
assert.equal((await download({...valid,contentBase64:''})).status,410);
assert.equal((await download({...valid,immutable:false})).status,410);
assert.equal((await download({...valid,contentSize:1})).status,409);
assert.equal((await download({...valid,hash:'wrong'})).status,409);
assert.equal((await download({...valid,companyId:'other'})).status,404);
const chunked={...valid,contentBase64:'',storageMode:'tax-private-chunks-v1',storageState:'ready',chunkCount:1};
const chunk={companyId:'company-1',fileId:'file-1',index:0,contentBase64:valid.contentBase64,hash:await hash(new TextEncoder().encode(valid.contentBase64))};
assert.equal((await download(chunked,[chunk])).status,200);
await assert.rejects(()=>download(chunked,[]));
console.log(JSON.stringify({ok:true,checks:['valid_artifact','legacy_missing_content','mutable_rejected','size_mismatch','hash_mismatch','tenant_scope','private_chunks_exact_download','missing_chunk_denied'],realDataWrites:0}));

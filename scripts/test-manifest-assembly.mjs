import assert from'node:assert/strict';import{createHash}from'node:crypto';import{advanceManifestAssembly,readAssembledManifest}from'../base44/functions/documentBackupToDrive/manifestAssembly.mjs';
const hash=async bytes=>createHash('sha256').update(bytes).digest('hex'),encode=v=>new TextEncoder().encode(typeof v==='string'?v:JSON.stringify(v));let checks=0;
async function fixture(count){
 const documents=Array.from({length:count},(_,i)=>({source:{entity:'Document',companyField:'company_id'},record:{id:'doc-'+i,company_id:'company-qa'}})),parts=[],stored=new Map(),writes=new Map();
 for(let start=0;start<count;start+=3){const entries=documents.slice(start,start+3).map(d=>({documentEntity:d.source.entity,documentId:d.record.id,clientAccountId:d.record.company_id,checksum:'a'.repeat(64),driveFileId:'copy-'+d.record.id})),bytes=encode({version:1,jobId:'qa-backup',start,entries}),id='part-'+start;stored.set(id,bytes);parts.push({start,count:entries.length,id,sha256:await hash(bytes)});}
 let state,reads=0,physicalWrites=0,persists=0,failPersist=false;
 const options={jobId:'qa-backup',sourceIndexChecksum:'b'.repeat(64),documents,sourceParts:parts,hash,deadline:Infinity,async readPart(id){reads++;return stored.get(id);},async writePart(name,text){let id=writes.get(name);if(id){assert.equal(Buffer.from(stored.get(id)).toString(),text);return{id};}id='compiled-'+physicalWrites++;stored.set(id,encode(text));writes.set(name,id);return{id};},async persist(next){persists++;if(failPersist){failPersist=false;throw Error('SYNTHETIC_LOST_ACK');}state=structuredClone(next);}};
 return{options,stored,get state(){return state;},get reads(){return reads;},get physicalWrites(){return physicalWrites;},get persists(){return persists;},loseNextPersist(){failPersist=true;}};
}
for(const count of [2154,12051]){
 const f=await fixture(count);let result,calls=0;
 while(!(result=await advanceManifestAssembly({...f.options,state:f.state})).ready){assert.ok(++calls<200);checks++;}
 const entries=await readAssembledManifest({...f.options,parts:result.parts});assert.equal(entries.length,count);assert.equal(entries[0].documentId,'doc-0');assert.equal(entries.at(-1).documentId,'doc-'+(count-1));assert.ok(result.parts.length<=24);assert.ok(f.reads<f.options.sourceParts.length*2);checks+=5;
 if(count===2154){assert.equal(f.options.sourceParts.length,718);assert.ok(calls>=18);checks+=2;}
}
const f=await fixture(90);f.loseNextPersist();await assert.rejects(()=>advanceManifestAssembly(f.options),/LOST_ACK/);checks++;assert.equal(f.state,undefined);checks++;const before=f.physicalWrites;await advanceManifestAssembly({...f.options,state:f.state});assert.equal(f.physicalWrites,before);checks++;assert.ok(f.state);checks++;
const state=structuredClone(f.state);await assert.rejects(()=>advanceManifestAssembly({...f.options,state,sourceIndexChecksum:'c'.repeat(64)}),/ASSEMBLY_INVALID/);checks++;
const gap=await fixture(90);gap.options.sourceParts[1].start++;await assert.rejects(()=>advanceManifestAssembly(gap.options),/PART_GAP/);checks++;
const short=await fixture(3),ready=await advanceManifestAssembly(short.options);assert.equal(ready.ready,true);assert.equal(short.physicalWrites,0);checks+=2;
await assert.rejects(()=>readAssembledManifest({...short.options,parts:ready.parts,readPart:async()=>encode('corrupt')}),/HASH_MISMATCH/);checks++;
const modified=JSON.parse(new TextDecoder().decode(short.stored.get('part-0')));modified.entries[0].clientAccountId='foreign';const changed=encode(modified),part={...ready.parts[0],sha256:await hash(changed)};await assert.rejects(()=>readAssembledManifest({...short.options,parts:[part],readPart:async()=>changed}),/SOURCE_MISMATCH/);checks++;
const timed=await fixture(90),pending=await advanceManifestAssembly({...timed.options,deadline:0});assert.equal(pending.ready,false);assert.equal(timed.physicalWrites,0);assert.equal(timed.reads,0);checks+=3;
await assert.rejects(()=>readAssembledManifest({...timed.options,parts:timed.options.sourceParts}),/NOT_READY/);checks++;
console.log(JSON.stringify({ok:true,checks,productionShape:{references:2154,fragments:718},largeCaseReferences:12051,resumableFinalization:true,lostAcknowledgementIdempotent:true,fullHashAndCompanyBinding:true,financialWrites:0,realCloudCalls:0}));

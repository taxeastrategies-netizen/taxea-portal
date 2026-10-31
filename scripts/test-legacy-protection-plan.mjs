import assert from'node:assert/strict';
import{buildLegacyProtectionPlan}from'../base44/functions/documentBackupToDrive/legacyProtectionPlan.mjs';
import{normalizeLegacyDocumentReference}from'../base44/functions/documentBackupToDrive/legacyNativeReference.mjs';
import{assetIdFromReference}from'../base44/functions/documentStorage/storageAssets.mjs';
const uri='https://media.base44.com/files/public/6a00fec50cc522a74ddde4b2/QA.pdf',source={entity:'Invoice',urlField:'archivo_url',companyField:'company_id'},sha='a'.repeat(64),hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
const input={backupJobId:'backup-qa',indexSha256:'b'.repeat(64),manifestSha256:'c'.repeat(64),sources:[source],normalizeReference:normalizeLegacyDocumentReference,privateId:assetIdFromReference,hash,index:{version:4,jobId:'backup-qa',cutoff:'2026-10-31T21:00:00Z',documents:[{source,record:{id:'qa-1',company_id:'company-a',archivo_url:uri}},{source,record:{id:'qa-2',company_id:'company-a',archivo_url:uri}},{source,record:{id:'qa-3',company_id:'company-a',archivo_url:'https://taxeaportal.com/private-document/asset-a'}}]},manifest:{totalDocuments:3,documents:[1,2,3].map(n=>({documentEntity:'Invoice',documentId:'qa-'+n,clientAccountId:'company-a',checksum:sha,size:10,driveFileId:'drive-qa-'+n,status:'skipped_existing',mimeType:'application/pdf',originalFileName:'QA.pdf'}))}};
let checks=0;const ok=(a,b)=>{assert.deepEqual(a,b);checks++;};const run=patch=>buildLegacyProtectionPlan({...input,...patch});
const first=await run();ok(first.summary.legacyFiles,1);ok(first.summary.privateReferences,1);ok(first.summary.eligibleFiles,1);ok(first.plan.groups[0].sources.length,2);ok(first.plan.groups[0].backupFileIds.length,2);ok(first.summary.financialWrites,0);ok((await run()).digest,first.digest);
const reordered=structuredClone(input.manifest);reordered.documents.reverse();ok((await run({manifest:reordered})).digest,first.digest);
for(const patch of [{index:{...input.index,version:2}},{index:{...input.index,jobId:'foreign'}},{manifest:{...input.manifest,totalDocuments:2}},{indexSha256:'bad'}]){await assert.rejects(()=>run(patch),/SNAPSHOT_INVALID/);checks++;}
const modified=structuredClone(input.manifest);modified.documents[0].clientAccountId='foreign';await assert.rejects(()=>run({manifest:modified}),/COMPANY_MISMATCH/);checks++;
const wrongHash=structuredClone(input.manifest);wrongHash.documents[0].checksum='d'.repeat(64);await assert.rejects(()=>run({manifest:wrongHash}),/SNAPSHOT_CONFLICT/);checks++;
const oversized=structuredClone(input.manifest);oversized.documents[0].size=oversized.documents[1].size=26*1024*1024;ok((await run({manifest:oversized})).summary.issues.FILE_OVER_25_MB,1);
const missing=structuredClone(input.manifest);missing.documents[0].driveFileId='';ok((await run({manifest:missing})).summary.blockedFiles,1);
const external=structuredClone(input.index);external.documents[0].record.archivo_url='https://evil.invalid/QA.pdf';await assert.rejects(()=>run({index:external}),/REFERENCE_INVALID/);checks++;
const unknown=structuredClone(input.index);unknown.documents[0].source.entity='User';await assert.rejects(()=>run({index:unknown}),/SOURCE_NOT_ALLOWED/);checks++;
const duplicate=structuredClone(input.manifest);duplicate.documents[1].documentId='qa-1';await assert.rejects(()=>run({manifest:duplicate}),/MANIFEST_DUPLICATE/);checks++;
const alteredBefore=JSON.stringify(input);await run();ok(JSON.stringify(input),alteredBefore);
console.log(JSON.stringify({ok:true,checks,externalCalls:0,sourceBytesCopied:0,financialWrites:0,productionInstalled:false}));

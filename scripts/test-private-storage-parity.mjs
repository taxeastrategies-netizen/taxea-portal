import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const names=['storageAssets.mjs','storageCredentials.mjs','storageTransport.mjs','storageSigning.mjs'];
const digest=createHash('sha256');
for(const name of names)digest.update(name+'\n'+await readFile('base44/functions/documentStorage/'+name));
const hash=digest.digest('hex');
const consumers=['ocrDocumentIntake','invokeLimitedLLM','limitedCoreOperations','documentBackupToDrive','sendEmail','invoiceOperations','getPublicInvoice','processLaborOcr','utilityOperations','runAuditAnalysis','mercantilDocumentOperations','storageConsumerQa','mercantilDocumentOperations','mercantilDocumentOperations'];
let canonical;
for(const name of consumers){
 const content=await readFile('base44/functions/'+name+'/storageRuntime.generated.mjs','utf8');
 assert.ok(content.startsWith('// GENERATED from documentStorage modules.'),name+': missing generated provenance');
 assert.ok(content.includes('// canonical-sha256: '+hash+'\n'),name+': stale private-storage runtime; regenerate before release');
 if(canonical)assert.equal(content,canonical,name+': runtime differs from other consumers');
 canonical=content;
}
console.log(JSON.stringify({ok:true,canonicalSha256:hash,consumers,byteParity:true,readOnly:true}));

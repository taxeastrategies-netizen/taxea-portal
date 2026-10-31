import assert from 'node:assert/strict';
import{snapshotPrivateAssetLedger}from'../base44/functions/documentBackupToDrive/assetLedgerSnapshot.mjs';
const user={id:'qa-admin',role:'admin'},asset={id:'asset-a',company_id:'company-a',object_name:'companies/company-a/file.pdf',generation:'123',sha256:'a'.repeat(64),size:10,mime_type:'application/pdf',original_name:'QA.pdf',status:'ready',storage_provider:'gcs',secret:'MUST_NOT_LEAK',private_key:'MUST_NOT_LEAK',base_imponible:100};
let reads=0;const svc={entities:{DocumentAsset:{async get(){reads++;return asset;}}}};
const doc={source:{entity:'Invoice',urlField:'archivo_url',companyField:'company_id'},record:{id:'invoice-qa',company_id:'company-a',archivo_url:'https://taxeaportal.com/private-document/asset-a',total:121}};
const copy={clientAccountId:'company-a',checksum:asset.sha256,size:10,driveFileId:'drive-qa',status:'copied'};
let checks=0;const ok=(a,b)=>{assert.deepEqual(a,b);checks++;};
for(const u of [null,{id:'qa',role:'user'},{...user,status:'bloqueado'},{...user,data:{accountAccessStatus:'suspended'}}]){await assert.rejects(()=>snapshotPrivateAssetLedger(svc,u,[doc],[copy]),/ADMIN_ONLY/);checks++;}
ok(reads,0);
const result=await snapshotPrivateAssetLedger(svc,user,[doc,{...doc,record:{...doc.record,id:'invoice-qa-2'}}],[copy]);
ok(reads,1);ok(result.assetCount,1);ok(result.referenceCount,2);ok(result.assets[0].backupReady,true);ok(result.assets[0].generation,'123');ok(result.assets[0].object_name,asset.object_name);ok(result.assets[0].secret,undefined);ok(result.assets[0].private_key,undefined);ok(result.assets[0].base_imponible,undefined);ok(result.references[0].total,undefined);ok(result.restoresExecuted,0);ok((await snapshotPrivateAssetLedger(svc,user,[doc],[{...copy,status:'backed_up'}])).assets[0].backupReady,true);
ok((await snapshotPrivateAssetLedger(svc,user,[doc],[{...copy,checksum:'b'.repeat(64)}])).assets[0].backupReady,false);
await assert.rejects(()=>snapshotPrivateAssetLedger(svc,user,[doc,{...doc,record:{...doc.record,company_id:'foreign'}}],[copy]),/COMPANY_MISMATCH/);checks++;
for(const patch of [{status:'failed'},{generation:''},{object_name:'companies/foreign/file.pdf'},{size:0},{sha256:'bad'},{company_id:'foreign'}]){await assert.rejects(()=>snapshotPrivateAssetLedger({entities:{DocumentAsset:{async get(){return{...asset,...patch};}}}},user,[doc],[copy]),/UNVERIFIED/);checks++;}
console.log(JSON.stringify({ok:true,checks,externalCalls:0,financialWrites:0,realDataRead:0}));

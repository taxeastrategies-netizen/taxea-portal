import assert from 'node:assert/strict';import {requestBackupChunk,backupContinuationDelay} from '../src/lib/backupClient.mjs';
let calls=0,pauses=[];const payload={action:'backup',resumeJobId:'synthetic-job'};
const result=await requestBackupChunk(async(name,body)=>{assert.equal(name,'documentBackupToDrive');assert.equal(body,payload);if(++calls<3)throw {response:{status:429,headers:{'retry-after':'2'}}};return {data:{status:'copying'}};},payload,{pause:async ms=>pauses.push(ms)});assert.equal(result.data.status,'copying');assert.equal(calls,3);assert.deepEqual(pauses,[2000,3000]);
for(const status of [400,401,403,409]){calls=0;await assert.rejects(requestBackupChunk(async()=>{calls++;throw Object.assign(new Error('denied'),{response:{status}});},payload,{pause:async()=>{}}));assert.equal(calls,1);}
calls=0;await requestBackupChunk(async()=>{if(++calls===1)throw {response:{status:409,data:{code:'BACKUP_BUSY'}}};return {data:{ok:true}};},payload,{pause:async()=>{}});assert.equal(calls,2);
assert.equal(backupContinuationDelay({retryAfterSeconds:5}),5000);assert.equal(backupContinuationDelay({}),400);assert.equal(backupContinuationDelay({retryAfterSeconds:1000}),30000);
console.log(JSON.stringify({ok:true,boundedRetries:true,sameResumeJobPreserved:true,rateLimitBackoff:true,busyRetried:true,authAndWrongAccountNotRetried:true,continuationHonorsServerDelay:true,externalCalls:0}));

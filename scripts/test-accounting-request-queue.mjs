import assert from 'node:assert/strict';
import { queuedAccountingClient } from '../base44/functions/invoiceOperations/accountingRequestQueue.mjs';
let clock=0, reads=0, creates=0, updates=0;
const waits=[], starts=[];
const limited=()=>Object.assign(new Error('Rate limit exceeded'),{status:429});
const svc={entities:{Invoice:{
 async get(){starts.push(clock);if(++reads<3)throw limited();return {id:'QA'};},
 async filter(){starts.push(clock);return [];},
 async create(){creates++;throw limited();},
 async update(){updates++;throw limited();}
}}};
const queued=queuedAccountingClient(svc,{now:()=>clock,sleep:async ms=>{waits.push(ms);clock+=ms;}});
assert.equal((await queued.entities.Invoice.get('QA')).id,'QA');
assert.equal(reads,3);
assert.ok(waits.includes(2000)&&waits.includes(4000));
await Promise.all([queued.entities.Invoice.filter({company_id:'QA'}),queued.entities.Invoice.filter({company_id:'QA'})]);
assert.ok(starts.slice(1).every((start,index)=>start-starts[index]>=350));
await assert.rejects(()=>queued.entities.Invoice.create({}),/Rate limit/);
await assert.rejects(()=>queued.entities.Invoice.update('QA',{}),/Rate limit/);
assert.equal(creates,1);assert.equal(updates,1);
let permanentReads=0;
const forbidden=queuedAccountingClient({entities:{Invoice:{get:async()=>{permanentReads++;throw Object.assign(new Error('Forbidden'),{status:403});}}}},{sleep:async()=>{}});
await assert.rejects(()=>forbidden.entities.Invoice.get('other'),/Forbidden/);
assert.equal(permanentReads,1);
let retryCalls=0,writeCalls=0;const delays=[];
const explicit=queuedAccountingClient({entities:{Invoice:{
 async get(){if(++retryCalls===1)throw Object.assign(new Error('entity_list. Retry after 9s.'),{status:429});return {id:'QA'};},
 async update(){writeCalls++;throw Object.assign(new Error('Retry after 9s.'),{status:429});}
}}},{intervalMs:0,sleep:async ms=>delays.push(ms)});
await explicit.entities.Invoice.get('QA');assert.equal(retryCalls,2);assert.deepEqual(delays,[9250]);
await assert.rejects(()=>explicit.entities.Invoice.update('QA',{}),/Retry/);assert.equal(writeCalls,1);
let headerCalls=0;const headerDelays=[];
const header=queuedAccountingClient({entities:{Invoice:{async get(){if(++headerCalls===1)throw {response:{status:429,headers:{'retry-after':'12'}}};return {};}}}},{intervalMs:0,sleep:async ms=>headerDelays.push(ms)});
await header.entities.Invoice.get('QA');assert.deepEqual(headerDelays,[12250]);
console.log(JSON.stringify({ok:true,readRetriesBounded:true,writesNeverReplayed:true,requestsSerialized:true,permanentErrorsNotRetried:true,realWrites:0}));

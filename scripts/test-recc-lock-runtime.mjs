import assert from 'node:assert/strict';
import { acquireReccAdvanceLocks, recoverReccAdvanceLock } from '../base44/functions/accountingOperations/reccAdvances.mjs';
const rows=[{id:'a',company_id:'qa',fecha_emision:'2026-01-01'},{id:'b',company_id:'qa'}], logs=[], operations=[];
const matches=(row,q)=>Object.entries(q).every(([key,value])=>{
 if(key==='$or') return value.some(part=>matches(row,part));
 if(value&&typeof value==='object'&&'$exists' in value) return (row[key]!==undefined)===value.$exists;
 return row[key]===value || (value===null&&row[key]===undefined);
});
const svc={entities:{
 Invoice:{
  async get(id){return rows.find(r=>r.id===id);},
  async updateMany(query,change){const selected=rows.filter(r=>matches(r,query));for(const row of selected) Object.assign(row,change.$set);return {success:true,updated:selected.length,has_more:false};}
 },
 AccountingPostingOperation:{async filter(q){return operations.filter(r=>matches(r,q));}},
 AccountingAuditLog:{async create(data){const row={id:String(logs.length+1),...data};logs.push(row);return row;},async update(id,data){Object.assign(logs.find(r=>r.id===id),data);}}
}};
const metadata={documentKind:'final',finalOperationBase:10,advanceAllocations:[{invoiceId:'a',base:10}]};
const parallel=await Promise.allSettled([acquireReccAdvanceLocks(svc,'qa',metadata,'one'),acquireReccAdvanceLocks(svc,'qa',metadata,'two')]);
assert.equal(parallel.filter(r=>r.status==='fulfilled').length,1);
assert.equal(parallel.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
await parallel.find(r=>r.status==='fulfilled').value();
assert.equal(rows[0].recc_application_lock_token,'');
await assert.rejects(()=>acquireReccAdvanceLocks(svc,'other',metadata,'x'),/empresa|proceso/);
const refundRelease=await acquireReccAdvanceLocks(svc,'qa',{documentKind:'advance',originalInvoiceId:'a'},'refund');
await assert.rejects(()=>acquireReccAdvanceLocks(svc,'qa',metadata,'competing-final'),/proceso/);
await refundRelease();
const releaseB=await acquireReccAdvanceLocks(svc,'qa',{...metadata,advanceAllocations:[{invoiceId:'b',base:10}]},'busy');
await assert.rejects(()=>acquireReccAdvanceLocks(svc,'qa',{...metadata,advanceAllocations:[{invoiceId:'b',base:5},{invoiceId:'a',base:5}]},'pair'),/proceso/);
assert.equal(rows[0].recc_application_lock_token,'');await releaseB();
const release=await acquireReccAdvanceLocks(svc,'qa',metadata,'interrupted');
const started=rows[0].recc_application_lock_started_at;
const input={expectedStartedAt:started,reason:'Revisión ficticia de proceso ya interrumpido',confirmProcessingStopped:true};
await assert.rejects(()=>recoverReccAdvanceLock(svc,'qa','a',input,'advisor'),/menos de una hora/);
await assert.rejects(()=>recoverReccAdvanceLock(svc,'other','a',input,'advisor'),/accesible/);
rows[0].recc_application_lock_started_at=new Date(Date.now()-7200000).toISOString();
const old={...input,expectedStartedAt:rows[0].recc_application_lock_started_at};
await assert.rejects(()=>recoverReccAdvanceLock(svc,'qa','a',{...old,reason:'no'},'advisor'),/motivo/);
operations.push({companyId:'qa',documentId:'interrupted',status:'preparing'});
await assert.rejects(()=>recoverReccAdvanceLock(svc,'qa','a',old,'advisor'),/unidad contable/);
operations.length=0;
assert.equal((await recoverReccAdvanceLock(svc,'qa','a',old,'advisor')).released,true);
assert.equal(rows[0].recc_application_lock_token,'');
assert.equal(JSON.parse(logs[0].afterJson).status,'released');
assert.ok(!logs[0].beforeJson.includes('lock_token'));
assert.equal((await recoverReccAdvanceLock(svc,'qa','a',old,'advisor')).alreadyReleased,true);
console.log(JSON.stringify({ok:true,realWrites:0,cases:['parallel-single-winner','refund-and-final-share-lock','partial-acquisition-rolled-back','company-isolation','no-auto-expiry','recent-lock-protected','active-posting-unit-protected','advisor-recovery-requires-reason','recovery-audited-and-idempotent']}));

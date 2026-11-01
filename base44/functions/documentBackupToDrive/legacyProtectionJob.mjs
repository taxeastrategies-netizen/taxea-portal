import{recoveryDrillSummary}from'./legacyRecoveryDrill.mjs';
import{protectionVerificationSummary}from'./legacyProtectionVerification.mjs';
import{protectionAdmin,disableProtectionAlias}from'./legacyProtectionExecutor.mjs';
const id=value=>/^[A-Za-z0-9_-]{1,128}$/.test(String(value||'')),hex=value=>/^[a-f0-9]{64}$/.test(String(value||'')),fail=code=>{throw Error(code);};
const key=g=>g.companyId+'|'+g.referenceDigest;
const canonical=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
// Intent flags are public UI confirmations, never credentials. Access requires an enabled admin and a server-verified plan.
export function protectionJobSummary(job){return{...recoveryDrillSummary(job),...protectionVerificationSummary(job),jobId:job.id,backupJobId:job.backupJobId,planDigest:job.planDigest,status:job.status,total:job.total,cursor:job.cursor,verified:job.verified,reused:job.reused,issueCount:job.issueCount,issues:job.issues||[],rollbackCursor:job.rollbackCursor||0,disabledAliases:job.disabledAliases||0,continueRequired:['processing','rolling_back'].includes(job.status),originalsDeleted:0,sourceRecordsWritten:0,financialWrites:0};}
async function readJob(entity,jobId,scope){if(!id(jobId))fail('PROTECTION_JOB_INVALID');const job=await entity.get(jobId).catch(e=>{if(Number(e?.status||e?.response?.status)===404)return null;throw e;});if(!job||String(job.scopeCompanyId||'')!==scope)fail('PROTECTION_JOB_UNAVAILABLE');return job;}
export async function runLegacyProtectionJob({service,user,body,scopeCompanyId='',leaseHeld=false,loadPlan,hash,protectGroup,now=Date.now,deadline=now()+40000}){
 if(!protectionAdmin(user))fail('PROTECTION_ADMIN_ONLY');if(!leaseHeld)fail('PROTECTION_LEASE_REQUIRED');
 const entity=service.entities.DocumentProtectionJob;
 if(body.action==='legacy_protection_status')return{ok:true,...protectionJobSummary(await readJob(entity,body.protectionJobId,scopeCompanyId))};
 if(body.confirmation!==undefined)fail('PROTECTION_CLIENT_UPDATE_REQUIRED');
 if(!hex(body.planDigest))fail('PROTECTION_CONFIRMATION_REQUIRED');
 if(body.action==='rollback_legacy_protection'&&body.confirmDisableLinks!==true)fail('PROTECTION_ROLLBACK_CONFIRMATION_REQUIRED');
 if(body.action==='protect_legacy_documents'&&body.confirmCopy!==true)fail('PROTECTION_CONFIRMATION_REQUIRED');
 if(!['protect_legacy_documents','rollback_legacy_protection'].includes(body.action))fail('PROTECTION_ACTION_INVALID');
 let job=body.protectionJobId?await readJob(entity,body.protectionJobId,scopeCompanyId):null;
 if(job&&job.planDigest!==body.planDigest)fail('PROTECTION_PLAN_CHANGED');
 const loaded=await loadPlan(job?.backupJobId||body.backupJobId);
 if(loaded.digest!==body.planDigest)fail('PROTECTION_PLAN_CHANGED');
 const all=loaded.plan.groups;
 if(!Array.isArray(all)||all.length>20000)fail('PROTECTION_PLAN_INVALID');
 let selection=job?.selectionKeys;
 if(!job){
  const requested=body.selection;
  if(requested!==undefined&&(!Array.isArray(requested)||requested.length<1||requested.length>128||requested.some(g=>!id(g?.companyId)||!hex(g?.referenceDigest))))fail('PROTECTION_SELECTION_INVALID');
  selection=requested?[...new Set(requested.map(key))].sort():[];
 }
 if(!Array.isArray(selection)||selection.some(k=>typeof k!=='string'||k.length>194))fail('PROTECTION_SELECTION_INVALID');
 const groups=selection.length?all.filter(g=>selection.includes(key(g))):all;
 if(!groups.length||selection.length&&groups.length!==selection.length)fail('PROTECTION_SELECTION_CHANGED');
 const selectionDigest=await hash(new TextEncoder().encode(canonical({planDigest:loaded.digest,scopeCompanyId,selection})));
 if(job&&(job.selectionDigest!==selectionDigest||job.total!==groups.length||!Number.isInteger(job.cursor)||job.cursor<0||job.cursor>groups.length))fail('PROTECTION_JOB_CHANGED');
 if(!job){
  const query={planDigest:loaded.digest,backupJobId:loaded.plan.backupJobId,scopeCompanyId,selectionDigest},existing=await entity.filter(query,'id',2);
  if(existing.length>1)fail('PROTECTION_JOB_AMBIGUOUS');job=existing[0];
  if(!job){const payload={...query,selectionKeys:selection,total:groups.length,cursor:0,verified:0,reused:0,issueCount:0,issues:[],status:'processing',startedBy:user.id,startedAt:new Date(now()).toISOString(),rollbackCursor:0,disabledAliases:0};
   try{job=await entity.create(payload);}catch(error){const found=await entity.filter(query,'id',2);if(found.length!==1)throw error;job=found[0];}
  }
  if(job.selectionDigest!==selectionDigest||job.total!==groups.length)fail('PROTECTION_JOB_CHANGED');
 }
 if(!Number.isInteger(job.cursor)||job.cursor<0||job.cursor>groups.length)fail('PROTECTION_JOB_CHANGED');
 if(body.action==='rollback_legacy_protection'){
  if(job.status==='rolled_back')return{ok:true,...protectionJobSummary(job)};
  if(job.status!=='rolling_back'){await entity.update(job.id,{status:'rolling_back',rollbackCursor:0,disabledAliases:0});job={...job,status:'rolling_back',rollbackCursor:0,disabledAliases:0};}
  const at=Number(job.rollbackCursor||0);
  if(at<groups.length&&now()<deadline-8000){const group=groups[at],rows=await service.entities.DocumentLegacyReference.filter({company_id:group.companyId,reference_digest:group.referenceDigest},'id',2);let disabled=0;
   if(rows.length>1)fail('PROTECTION_ALIAS_AMBIGUOUS');
   if(rows[0]?.protection_job_id===job.id){await disableProtectionAlias({service,user,companyId:group.companyId,referenceDigest:group.referenceDigest,planDigest:loaded.digest});disabled=1;}
   const patch={rollbackCursor:at+1,disabledAliases:Number(job.disabledAliases||0)+disabled};await entity.update(job.id,patch);job={...job,...patch};
  }
  if(job.rollbackCursor>=groups.length){await entity.update(job.id,{status:'rolled_back'});job={...job,status:'rolled_back'};}
  return{ok:true,...protectionJobSummary(job)};
 }
 if(body.action!=='protect_legacy_documents')fail('PROTECTION_ACTION_INVALID');
 if(job.status==='rolling_back')fail('PROTECTION_ROLLBACK_IN_PROGRESS');
 if(job.status==='rolled_back'&&!body.reactivateDisabled)fail('PROTECTION_REACTIVATION_REQUIRED');
 if(body.retryIncidents===true&&job.status==='processing')fail('PROTECTION_COPY_IN_PROGRESS');
 if(body.retryIncidents===true&&job.status==='completed')return{ok:true,...protectionJobSummary(job),alreadyCompleted:true};
 // Repair only the recorded failures, under the same verified plan and global lease.
 // Never reset successful totals or recopy the complete historical selection.
 if(body.retryIncidents===true&&job.status==='incidents'&&job.issueCount===(job.issues||[]).length){
  if(job.cursor!==groups.length||job.verified+job.issueCount!==groups.length)fail('PROTECTION_JOB_CHANGED');
  const originalIssues=job.issues||[],seenIssues=new Set();
  for(const issue of originalIssues){const group=groups[issue.index];if(!Number.isSafeInteger(issue.index)||!group||seenIssues.has(issue.index)||group.companyId!==issue.companyId||group.referenceDigest!==issue.referenceDigest)fail('PROTECTION_JOB_CHANGED');seenIssues.add(issue.index);}
  let remaining=[...originalIssues];
  for(const issue of originalIssues){
   if(now()>=deadline-20000)break;
   const group=groups[issue.index];let result,errorCode;
   try{result=await protectGroup(group,loaded.digest,job.id,body.reactivateDisabled===true,loaded.plan.backupJobId);if(!result?.ok)fail('PROTECTION_COPY_UNVERIFIED');}
   catch(error){errorCode=/^(PROTECTION|STORAGE)_[A-Z_0-9]+$/.test(error?.message||'')?error.message:'PROTECTION_COPY_INTERRUPTED';}
   remaining=remaining.filter(old=>old.index!==issue.index);if(errorCode)remaining.push({...issue,code:errorCode});remaining.sort((a,b)=>a.index-b.index);
   const patch={issues:remaining,issueCount:remaining.length,verified:Number(job.verified)+(result?.ok?1:0),reused:Number(job.reused||0)+(result?.alreadyProtected?1:0),previousIssues:originalIssues,status:remaining.length?'incidents':'completed',finishedAt:new Date(now()).toISOString()};
   await entity.update(job.id,patch);job={...job,...patch};
  }
  return{ok:true,...protectionJobSummary(job),targetedRetry:true};
 }
 if(body.retryIncidents===true||job.status==='rolled_back'&&body.reactivateDisabled===true){
  const patch={status:'processing',cursor:0,verified:0,reused:0,issueCount:0,previousIssues:job.issues||[],issues:[],attempt:Number(job.attempt||1)+1,rollbackCursor:0,disabledAliases:0};await entity.update(job.id,patch);job={...job,...patch};
 }
 if(['completed','incidents'].includes(job.status))return{ok:true,...protectionJobSummary(job),alreadyCompleted:true};
 if(job.status!=='processing')fail('PROTECTION_JOB_STATE_INVALID');
 // At most three independent copies. Equal company/content never runs concurrently.
 // The shared DB throttle and global lease remain active. Cursor commits stay ordered.
 const fileBudget=body.fileBudget===3?3:1;
 if(job.cursor<groups.length&&now()<deadline-20000){
  const batch=[],seen=new Set();
  for(let index=job.cursor;index<groups.length&&batch.length<fileBudget;index++){
   const group=groups[index],contentKey=group.companyId+'|'+(group.sha256||group.referenceDigest);
   if(seen.has(contentKey))break;seen.add(contentKey);batch.push({index,group});
  }
  const results=await Promise.all(batch.map(async({index,group})=>{
   try{const result=await protectGroup(group,loaded.digest,job.id,body.reactivateDisabled===true,loaded.plan.backupJobId);if(!result?.ok)fail('PROTECTION_COPY_UNVERIFIED');return{index,group,result};}
   catch(error){return{index,group,errorCode:/^(PROTECTION|STORAGE)_[A-Z_0-9]+$/.test(error?.message||'')?error.message:'PROTECTION_COPY_INTERRUPTED'};}
  }));
  for(const{index,group,result,errorCode}of results){
   const issue=errorCode?{index,companyId:group.companyId,referenceDigest:group.referenceDigest,code:errorCode}:null;
   const patch={cursor:index+1,verified:Number(job.verified||0)+(result?.ok?1:0),reused:Number(job.reused||0)+(result?.alreadyProtected?1:0),issueCount:Number(job.issueCount||0)+(issue?1:0),issues:issue?[...(job.issues||[]),issue].slice(0,100):job.issues||[]};
   await entity.update(job.id,patch);job={...job,...patch};
  }
 }
 if(job.cursor===groups.length){const status=job.issueCount?'incidents':'completed';await entity.update(job.id,{status,finishedAt:new Date(now()).toISOString()});job={...job,status};}
 return{ok:true,...protectionJobSummary(job)};
}

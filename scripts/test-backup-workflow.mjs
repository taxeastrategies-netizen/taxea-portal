import assert from'node:assert/strict';
import{withBackupWorkflow,assertVerifiedWorkflowJob}from'../base44/functions/documentBackupToDrive/backupWorkflow.mjs';
let checks=0;const ok=(a,b)=>{assert.deepEqual(a,b);checks++};
const base={id:'job-qa',scopeCompanyId:'qa-company',runVersion:'snapshot-v4',status:'completed',verificationStatus:'ok',sourceIndexCount:12,documentsScanned:12,documentsVerified:12,verificationChecked:12,verificationChecksumChecked:12,documentsFailed:0,verificationMissing:0,verificationIssues:[],sourceIndexDriveFileId:'index-qa',manifestDriveFileId:'manifest-qa',sourceIndexChecksum:'a'.repeat(64),manifestChecksum:'b'.repeat(64)};
ok(assertVerifiedWorkflowJob(base,'qa-company').documentsVerified,12);
for(const patch of [{scopeCompanyId:'foreign'},{status:'copying'},{status:'completed_with_errors'},{verificationStatus:'partial'},{sourceIndexCount:1},{documentsVerified:11},{verificationChecked:11},{verificationChecksumChecked:1},{documentsFailed:1},{verificationMissing:1},{verificationIssues:[{code:'DAMAGED'}]},{manifestDriveFileId:''},{manifestChecksum:''},{sourceIndexDriveFileId:'../escape'},{sourceIndexChecksum:''}]){assert.throws(()=>assertVerifiedWorkflowJob({...base,...patch},'qa-company'),/WORKFLOW_INCOMPLETE/);checks++;}
function fixture(options={}){
 const calls=[];let copies=0,verifications=0;
 const handler=async req=>{const b=await req.json();if(req.headers.get('X-QA-Actor')!=='admin')return Response.json({error:'Denied'},{status:401});calls.push(b);
  if(b.action==='backup'){copies++;if(options.copyFailed)return Response.json({jobId:'job-qa',status:'completed_with_errors',continueRequired:false});return Response.json(copies===1?{jobId:'job-qa',status:'copying',continueRequired:true}:{jobId:'job-qa',status:'completed',continueRequired:false});}
  if(b.action==='verify'){verifications++;if(options.verifyFailed)return Response.json({jobId:'job-qa',status:'incidents',remaining:0});return Response.json(verifications===1?{jobId:'job-qa',status:'partial',remaining:25}:{jobId:'job-qa',status:'ok',remaining:0});}
  if(b.action==='workflow_assert')return options.assertFailed?Response.json({code:'BACKUP_WORKFLOW_INCOMPLETE'},{status:409}):Response.json({ok:true,status:'verified',jobId:'job-qa',documentsVerified:25,checksumChecked:25});
  return Response.json({error:'Unknown action'},{status:400});
 };
 const wrapped=withBackupWorkflow(handler),invoke=async(body,actor='admin')=>{const r=await wrapped(new Request('https://synthetic.test/backup',{method:'POST',headers:{'Content-Type':'application/json','X-QA-Actor':actor},body:JSON.stringify(body)}));return{status:r.status,body:await r.json()}};
 return{calls,invoke,wrapped,handler};
}
let f=fixture(),r=await f.invoke({action:'workflow_step'},'normal');ok(r.status,401);ok(f.calls.length,0);
for(const b of [{action:'workflow_step',workflowPhase:'verify'},{action:'workflow_step',workflowPhase:'verify',workflowJobId:'../escape'},{action:'workflow_step',workflowPhase:'evil'}]){f=fixture();r=await f.invoke(b);ok(r.status,400);ok(f.calls[0].action,'invalid_workflow_request');}
f=fixture();r=await f.invoke({action:'workflow_step',resumeJobId:'unrelated',verifyJobId:'unrelated',assertJobId:'unrelated'});ok(r.status,202);ok(r.body.workflowPhase,'copy');ok(r.body.continueRequired,true);ok(f.calls[0].jobType,'scheduled');ok(f.calls[0].workflowChunk,true);ok(f.calls[0].resumeJobId,undefined);
r=await f.invoke({action:'workflow_step',workflowPhase:r.body.workflowPhase,workflowJobId:r.body.jobId});ok(r.status,202);ok(r.body.workflowPhase,'verify');ok(f.calls[1].resumeJobId,'job-qa');
r=await f.invoke({action:'workflow_step',workflowPhase:r.body.workflowPhase,workflowJobId:r.body.jobId});ok(r.status,202);ok(r.body.workflowPhase,'verify');ok(f.calls[2].verifyJobId,'job-qa');
r=await f.invoke({action:'workflow_step',workflowPhase:r.body.workflowPhase,workflowJobId:r.body.jobId});ok(r.status,200);ok(r.body.status,'verified');ok(r.body.workflowPhase,'completed');ok(r.body.continueRequired,false);ok(f.calls.at(-1).action,'workflow_assert');ok(f.calls.at(-1).assertJobId,'job-qa');
for(const options of [{copyFailed:true},{verifyFailed:true},{assertFailed:true}]){f=fixture(options);r=await f.invoke({action:'workflow_step'});if(!options.copyFailed){r=await f.invoke({action:'workflow_step',workflowJobId:r.body.jobId,workflowPhase:r.body.workflowPhase});r=await f.invoke({action:'workflow_step',workflowJobId:r.body.jobId,workflowPhase:r.body.workflowPhase});if(!options.verifyFailed)r=await f.invoke({action:'workflow_step',workflowJobId:r.body.jobId,workflowPhase:r.body.workflowPhase});}ok(r.status,409);ok(r.body.code,'BACKUP_WORKFLOW_INCOMPLETE');}
f=fixture();r=await f.invoke({action:'workflow_step',workflowPhase:'verify',workflowJobId:'job-qa'},'normal');ok(r.status,401);ok(f.calls.length,0);
let called=0;const bad=withBackupWorkflow(async()=>{called++;return Response.json({status:'completed'});});r=await bad(new Request('https://synthetic.test/',{method:'POST',body:JSON.stringify({action:'workflow_step'})}));ok(r.status,502);ok(called,1);
console.log(JSON.stringify({ok:true,checks,realCloudCalls:0,sourceWrites:0,coverage:'Same-job copy and verification phases, original auth gate, final stored proof, invalid inputs, partial results, errors and no false scheduler success'}));

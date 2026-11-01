const id=v=>/^[A-Za-z0-9_-]{1,128}$/.test(String(v||'')),hex=v=>/^[a-f0-9]{64}$/.test(String(v||''));
const failure=(code,status=409)=>Response.json({error:'La copia automática no está completamente verificada. Se conservan el progreso y los originales.',code},{status,headers:{'Cache-Control':'no-store'}});
export function assertVerifiedWorkflowJob(job,scopeCompanyId=''){
 if(!job||String(job.scopeCompanyId||'')!==scopeCompanyId||job.runVersion!=='snapshot-v4'||job.status!=='completed'||job.verificationStatus!=='ok')throw Error('BACKUP_WORKFLOW_INCOMPLETE');
 const total=job.documentsScanned;
 if(!Number.isSafeInteger(total)||total<0||job.sourceIndexCount!==total||job.documentsVerified!==total||job.verificationChecked!==total||job.verificationChecksumChecked!==total||Number(job.documentsFailed)!==0||Number(job.verificationMissing)!==0||(job.verificationIssues||[]).length||!id(job.sourceIndexDriveFileId)||!id(job.manifestDriveFileId)||!hex(job.sourceIndexChecksum)||!hex(job.manifestChecksum))throw Error('BACKUP_WORKFLOW_INCOMPLETE');
 return{ok:true,status:'verified',jobId:job.id,documentsVerified:total,checksumChecked:total,continueRequired:false};
}
export function withBackupWorkflow(handler){return async req=>{
 if(req.method!=='POST')return handler(req);
 const body=await req.clone().json().catch(()=>null);if(body?.action!=='workflow_step')return handler(req);
 const phase=body.workflowPhase||'copy',jobId=body.workflowJobId||'';
 // Invalid instructions still pass through the original authentication gate.
 if(!['copy','verify'].includes(phase)||jobId&&!id(jobId)||phase==='verify'&&!id(jobId))return handler(new Request(req,{body:JSON.stringify({...body,action:'invalid_workflow_request'})}));
 const invoke=payload=>handler(new Request(req,{body:JSON.stringify(payload)}));
 const base={...body,jobType:'scheduled',workflowChunk:true};for(const key of ['workflowPhase','workflowJobId','resumeJobId','verifyJobId','assertJobId'])delete base[key];
 const response=await invoke({...base,action:phase==='copy'?'backup':'verify',...(phase==='copy'&&jobId?{resumeJobId:jobId}:{}),...(phase==='verify'?{verifyJobId:jobId}: {})});
 if(!response.ok)return response;let data;try{data=await response.clone().json();}catch{return failure('BACKUP_WORKFLOW_RESPONSE_INVALID',502);}
 if(!id(data?.jobId))return failure('BACKUP_WORKFLOW_RESPONSE_INVALID',502);
 if(phase==='copy'&&data.continueRequired===true)return Response.json({...data,workflowPhase:'copy',continueRequired:true},{status:202,headers:{'Cache-Control':'no-store'}});
 if(phase==='copy'&&data.status==='completed')return Response.json({...data,workflowPhase:'verify',continueRequired:true},{status:202,headers:{'Cache-Control':'no-store'}});
 if(phase==='verify'&&Number.isSafeInteger(data.remaining)&&data.remaining>0)return Response.json({...data,workflowPhase:'verify',continueRequired:true},{status:202,headers:{'Cache-Control':'no-store'}});
 if(phase==='verify'&&data.status==='ok'&&data.remaining===0){
  const checked=await invoke({...base,action:'workflow_assert',assertJobId:data.jobId});if(!checked.ok)return checked;
  const proof=await checked.json();if(proof.ok!==true||proof.status!=='verified'||proof.jobId!==data.jobId)return failure('BACKUP_WORKFLOW_RESPONSE_INVALID',502);
  return Response.json({...proof,workflowPhase:'completed',continueRequired:false},{headers:{'Cache-Control':'no-store'}});
 }
 return failure('BACKUP_WORKFLOW_INCOMPLETE');
};}

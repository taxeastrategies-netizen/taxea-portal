export function isBackupTransientError(error){
 const status=Number(error?.status||error?.response?.status||0);if([408,429,502,503,504].includes(status))return true;
 if(['ECONNRESET','ECONNABORTED','ETIMEDOUT','ERR_NETWORK','EAI_AGAIN'].includes(error?.code))return true;
 const text=[error?.message,error?.data?.error,error?.response?.data?.error].map(value=>typeof value==='string'?value:'').join(' ').slice(0,6000);
 return /timed out \(configured timeouts|connectTimeoutMS|Mongo(?:Network|ServerSelection)|server selection timed out|ECONNRESET|ETIMEDOUT|fetch failed|network (?:error|timeout)|BACKUP_(?:DOWNLOAD|DRIVE)_HTTP_(?:408|429|502|503|504)|STORAGE_(?:AUTH|UPLOAD|DOWNLOAD)_FAILED_(?:408|429|502|503|504)|STORAGE_AUTH_NETWORK_(?:TIMEOUT|DNS|CONNECT)/i.test(text);
}
export function resumableSnapshotJob(job,scope=''){
 if(!job?.id||job.runVersion!=='snapshot-v4'||String(job.scopeCompanyId||'')!==scope)return false;
 if(['preparing','copying','verifying'].includes(job.status))return true;
 return job.status==='failed'&&(job.internalErrorCode==='BACKUP_TRANSIENT'||isBackupTransientError({message:job.safeErrorMessage}));
}
export function completedBackupResponse(job){
 if(!job?.manifestDriveFileId||!['completed','completed_with_errors'].includes(job.status))return null;
 return{status:job.status,jobId:job.id,continueRequired:false,alreadyCompleted:true,progressPercent:100,documentsScanned:Number(job.documentsScanned||0),documentsCopied:Number(job.documentsCopied||0),documentsSkipped:Number(job.documentsSkipped||0),documentsFailed:Number(job.documentsFailed||0),bytesCopied:Number(job.bytesCopied||0),durationSeconds:Number(job.durationSeconds||0)};
}

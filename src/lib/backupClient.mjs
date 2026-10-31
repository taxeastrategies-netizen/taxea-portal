const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function requestBackupChunk(invoke,payload,{pause=delay,maxAttempts=4}={}){
 for(let attempt=0;;attempt++)try{return await invoke('documentBackupToDrive',payload);}catch(error){
  const status=Number(error?.response?.status||error?.status||0),code=error?.response?.data?.code;
  const retry=[408,429,502,503,504].includes(status)||(status===409&&code==='BACKUP_BUSY')||['ECONNABORTED','ETIMEDOUT','ERR_NETWORK'].includes(error?.code);
  if(!retry||attempt+1>=maxAttempts)throw error;
  const retryAfter=Number(error?.response?.headers?.['retry-after']||0);await pause(Math.min(30000,Math.max(1500,retryAfter*1000,1500*2**attempt)));
 }
}
export const backupContinuationDelay=data=>{const seconds=Number(data?.retryAfterSeconds||0);return Number.isFinite(seconds)?Math.max(400,Math.min(30000,seconds*1000)):400;};

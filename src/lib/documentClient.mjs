export function privateDocumentId(value){
 if(typeof value!=='string')return '';
 try{const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='taxeaportal.com'||url.port||url.username||url.password||url.search||url.hash)return '';return url.pathname.match(/^\/private-document\/([A-Za-z0-9_-]{1,128})$/)?.[1]||'';}catch{return '';}
}
export function createDocumentClient(api,onSessionCleanup){
 const liveUrls=new Set();
 let sessionEpoch=0;
 const revoke=url=>{if(liveUrls.delete(url))URL.revokeObjectURL(url);};
 const clear=()=>{sessionEpoch++;for(const url of [...liveUrls])revoke(url);};
 onSessionCleanup?.(clear);
 const operation=async body=>{const response=await api.functions.invoke('documentStorage',body),data=response?.data??response;if(data?.ok!==true)throw new Error(data?.error||'No se pudo confirmar el archivo.');return data;};
 const upload=async({file,companyId,privateAttachment=false})=>{
  if(!file||!/^[A-Za-z0-9_-]{1,128}$/.test(companyId||''))throw new Error('Selecciona una empresa antes de subir el documento.');
  const caps=await operation({action:'capabilities',companyId});
  if(!caps.privateStorageEnabled)return privateAttachment?api.integrations.Core.UploadPrivateFile({file}):api.integrations.Core.UploadFile({file});
  if(file.size>caps.maxFileBytes)throw new Error('El documento supera el tamaño máximo permitido.');
  // Pass a File in a plain object: this SDK serializes it as multipart itself.
  const saved=await operation({action:'upload',companyId,file});
  if(!privateDocumentId(saved.file_url)||privateDocumentId(saved.file_url)!==saved.assetId)throw new Error('No se pudo verificar la referencia del archivo.');
  return {...saved,file_uri:saved.file_url};
 };
 const uploadStaging=async file=>{
  const caps=await operation({action:'staging_capabilities'});
  return caps.privateStorageEnabled?operation({action:'upload_staging',file}):api.integrations.Core.UploadPublicFile({file});
 };
 const assignStaged=async(reference,companyId)=>privateDocumentId(reference)?operation({action:'assign_staged_asset',assetId:privateDocumentId(reference),companyId}):{file_url:reference};
 /** @param {string} reference @param {{signal?: AbortSignal}} [options] */
 const download=async(reference,{signal}={})=>{
  const assetId=privateDocumentId(reference);if(!assetId)throw new Error('Referencia privada no válida.');
  const response=await api.functions.fetch('/documentStorage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'download',assetId}),signal});
  if(!response.ok){const data=await response.json().catch(()=>null);throw Object.assign(new Error(data?.error||'No se pudo abrir el documento privado.'),{status:response.status});}
  const hash=response.headers.get('X-Taxea-File-Sha256')||'',size=Number(response.headers.get('X-Taxea-File-Size'));
  if(!/^[a-f0-9]{64}$/.test(hash)||!Number.isInteger(size)||size<=0||size>25*1024*1024)throw new Error('No se pudo verificar el documento recibido.');
  const blob=await response.blob();if(blob.size!==size)throw new Error('La descarga está incompleta. Reintenta.');
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==hash)throw new Error('La descarga no coincide con el archivo original. Reintenta.');
  let name='documento';try{name=decodeURIComponent(response.headers.get('X-Taxea-File-Name')||'documento');}catch{}
  return {blob,name,mimeType:blob.type,sha256:hash};
 };
 const open=async(reference,options)=>{const epoch=sessionEpoch,file=await download(reference,options);if(epoch!==sessionEpoch)throw new Error('La sesión ha cambiado. Vuelve a abrir el documento.');const url=URL.createObjectURL(file.blob);liveUrls.add(url);return {...file,url,revoke:()=>revoke(url)};};
 return {upload,uploadStaging,assignStaged,download,open,clear};
}

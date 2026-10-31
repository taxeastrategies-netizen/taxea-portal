/** @param {any} api @param {{token:string,signal?:AbortSignal}} options */
export async function downloadPublicInvoiceDocument(api,{token,signal}){
 if(!/^[a-f0-9]{64}$/i.test(token||''))throw new Error('Enlace no válido.');
 const response=await api.functions.fetch('/getPublicInvoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,action:'download_pdf'}),signal});
 if(!response.ok){const data=await response.json().catch(()=>null);throw Object.assign(new Error(data?.error||'No se pudo descargar la factura.'),{status:response.status});}
 const hash=response.headers.get('X-Taxea-File-Sha256')||'',size=Number(response.headers.get('X-Taxea-File-Size'));
 if(!/^[a-f0-9]{64}$/.test(hash)||!Number.isSafeInteger(size)||size<=0||size>25*1024*1024)throw new Error('No se pudo verificar el PDF recibido.');
 const blob=await response.blob();if(blob.size!==size||blob.type.split(';')[0]!=='application/pdf')throw new Error('El PDF recibido está incompleto o tiene un formato inválido.');
 const bytes=await blob.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 if(digest!==hash||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('El PDF no coincide con el documento original.');
 return {blob,sha256:hash};
}

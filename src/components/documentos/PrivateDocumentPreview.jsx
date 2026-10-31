import {useEffect,useState} from 'react';
import {openPrivateDocument} from '@/lib/privateDocuments';
import PrivatePdfViewer from './PrivatePdfViewer';
import {Button} from '@/components/ui/button';
export default function PrivateDocumentPreview({reference,expanded=false}){
 const [file,setFile]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let disposed=false,opened;const controller=new AbortController();setFile(null);setError('');
  openPrivateDocument(reference,{signal:controller.signal}).then(value=>{opened=value;if(disposed)value.revoke();else setFile(value);}).catch(()=>{if(!disposed)setError('No se pudo abrir el documento privado. Reintenta.');});
  return()=>{disposed=true;controller.abort();opened?.revoke();};
 },[reference,retry]);
 return <div className="flex w-full min-w-0 min-h-0 flex-col" style={{height:expanded?'100%':'460px'}}>
  {error?<div role="alert" className="p-4 text-center text-sm"><p>{error}</p><Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Reintentar documento</Button></div>:!file?<p role="status" className="p-4 text-center text-sm">Abriendo documento privado...</p>:<>
   <a href={file.url} download={file.name} className="shrink-0 px-3 py-2 text-xs underline">Descargar original</a>
   {file.mimeType==='application/pdf'?<PrivatePdfViewer blob={file.blob} name={file.name}/>:file.mimeType.startsWith('image/')?<img src={file.url} alt={file.name} className="min-h-0 flex-1 object-contain"/>:<p className="p-4 text-sm">Descarga el original para consultar este formato.</p>}
  </>}
 </div>;
}

import {useEffect,useState} from 'react';
import {Loader2,Download,RefreshCw} from 'lucide-react';
import {openPrivateDocument,privateDocumentId} from '@/lib/privateDocuments';
import PrivatePdfViewer from '@/components/documentos/PrivatePdfViewer';
import {Button} from '@/components/ui/button';
const APP='6a00fec50cc522a74ddde4b2';
function legacyFrame(reference){try{const u=new URL(reference);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.hash&&((u.hostname==='base44.app'&&u.pathname.startsWith('/api/apps/'+APP+'/files/mp/'))||(u.hostname==='media.base44.com'&&['public','private'].some(kind=>u.pathname.startsWith('/files/'+kind+'/'+APP+'/'))));}catch{return false;}}

export default function ProtectedDocumentPreview({reference,title='Documento',className=''}){
 const privateId=privateDocumentId(reference),[file,setFile]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  setFile(null);setError('');if(!privateId)return;
  const controller=new AbortController();let disposed=false,opened;
  openPrivateDocument(reference,{signal:controller.signal}).then(value=>{opened=value;if(disposed)value.revoke();else setFile(value);}).catch(err=>{if(!disposed)setError(err?.status===404?'No tienes acceso a este documento o ya no está disponible.':err?.message||'No se pudo abrir el documento.');});
  return()=>{disposed=true;controller.abort();opened?.revoke();};
 },[reference,privateId,attempt]);
 if(!privateId)return legacyFrame(reference)?<iframe src={reference} className={className} title={title}/>:<p role="alert" className="p-4 text-sm text-muted-foreground">Referencia de documento no disponible.</p>;
 return <section aria-label={title} className={'flex min-w-0 flex-col '+className}>
  {error?<div role="alert" className="space-y-3 p-4 text-sm"><p>{error}</p><Button variant="outline" size="sm" onClick={()=>setAttempt(x=>x+1)}><RefreshCw className="mr-2 h-4 w-4"/>Reintentar</Button></div>:!file?<p role="status" className="flex items-center justify-center gap-2 p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none"/>Abriendo documento privado...</p>:<>
   <div className="flex items-center justify-between gap-2 border-b border-border p-2"><p className="min-w-0 truncate text-xs text-muted-foreground">{file.name}</p><Button asChild size="sm" variant="outline"><a href={file.url} download={file.name}><Download className="mr-1 h-3.5 w-3.5"/>Descargar</a></Button></div>
   {file.mimeType==='application/pdf'?<PrivatePdfViewer blob={file.blob} name={file.name}/>:file.mimeType?.startsWith('image/')?<img src={file.url} alt={file.name} className="h-auto max-w-full object-contain"/>:<p className="p-4 text-sm text-muted-foreground">Descarga el archivo para abrirlo en tu dispositivo.</p>}
  </>}
 </section>;
}

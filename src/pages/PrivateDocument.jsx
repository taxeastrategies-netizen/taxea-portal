import {useEffect,useState} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {ArrowLeft,Download,FileText,Loader2,LockKeyhole,RefreshCw} from 'lucide-react';
import {openPrivateDocument} from '@/lib/privateDocuments';
import {Button} from '@/components/ui/button';

export default function PrivateDocument(){
 const {assetId}=useParams(),navigate=useNavigate();
 const [file,setFile]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let disposed=false,opened;const controller=new AbortController();setFile(null);setError('');
  openPrivateDocument('https://taxeaportal.com/private-document/'+encodeURIComponent(assetId||''),{signal:controller.signal})
   .then(value=>{opened=value;if(disposed)value.revoke();else setFile(value);})
   .catch(err=>{if(!disposed)setError(err?.status===404?'No tienes acceso a este documento o ya no está disponible.':err?.message||'No se pudo abrir el documento.');});
  return()=>{disposed=true;controller.abort();opened?.revoke();};
 },[assetId,attempt]);
 return <main className="flex min-h-[100dvh] flex-col bg-background text-foreground" style={{paddingTop:'env(safe-area-inset-top)',paddingLeft:'env(safe-area-inset-left)',paddingRight:'env(safe-area-inset-right)',paddingBottom:'env(safe-area-inset-bottom)'}}>
  <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b border-border px-3 py-2 sm:px-5">
   <Button variant="outline" onClick={()=>window.history.length>1?navigate(-1):navigate('/documentos')} className="gap-2"><ArrowLeft className="h-4 w-4"/>Volver</Button>
   <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-semibold">{file?.name||'Documento privado'}</h1><p className="flex items-center gap-1 text-xs text-muted-foreground"><LockKeyhole className="h-3 w-3"/>Acceso verificado con tu cuenta</p></div>
   {file&&<Button asChild className="gap-2"><a href={file.url} download={file.name}><Download className="h-4 w-4"/>Descargar</a></Button>}
  </header>
  {!file&&!error&&<div role="status" className="flex flex-1 items-center justify-center gap-3 p-8"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none"/>Abriendo documento...</div>}
  {error&&<div role="alert" className="m-auto max-w-xl space-y-4 p-6 text-center"><p>{error}</p><Button variant="outline" className="gap-2" onClick={()=>setAttempt(n=>n+1)}><RefreshCw className="h-4 w-4"/>Reintentar</Button></div>}
  {file?.mimeType?.startsWith('image/')&&<div className="flex flex-1 items-start justify-center overflow-auto p-4"><img src={file.url} alt={file.name} className="max-h-none max-w-full rounded border border-border"/></div>}
  {file?.mimeType==='application/pdf'&&<iframe src={file.url} title={file.name} className="min-h-[calc(100dvh-5rem)] w-full flex-1 border-0"/>}
  {file&&!file.mimeType?.startsWith('image/')&&file.mimeType!=='application/pdf'&&<div className="m-auto max-w-lg space-y-3 p-6 text-center"><FileText className="mx-auto h-10 w-10 text-muted-foreground"/><p>El archivo está listo para descargar y abrir en tu dispositivo.</p></div>}
 </main>;
}

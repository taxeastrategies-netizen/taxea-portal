import{useEffect,useState}from'react';
import{Loader2,Download,RefreshCw}from'lucide-react';
import{openPrivateDocument,privateDocumentId}from'@/lib/privateDocuments';
import{useResolvedDocumentReference}from'@/hooks/useResolvedDocumentReference';
import{normalizeLegacyDocumentReference}from'@/lib/nativeDocumentReference.mjs';
import PrivatePdfViewer from'@/components/documentos/PrivatePdfViewer';
import ProtectedDocumentLink from'@/components/documentos/ProtectedDocumentLink';
import AdminDocumentRecovery from'@/components/documentos/AdminDocumentRecovery';
import{Button}from'@/components/ui/button';
export default function ProtectedDocumentPreview({reference:sourceReference,title='Documento',className='',style=undefined,companyId=undefined,contextKind=undefined,contextId=undefined,mimeType:hint=''}){
 const resolved=useResolvedDocumentReference(sourceReference,{companyId,contextKind,contextId}),reference=resolved.reference,privateId=privateDocumentId(reference),localBlob=reference?.startsWith('blob:'),[file,setFile]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{setFile(null);setError('');if(!privateId&&!localBlob)return;const controller=new AbortController();let disposed=false,opened;
  const load=async()=>{if(privateId)return openPrivateDocument(reference,{signal:controller.signal});const response=await fetch(reference,{signal:controller.signal});if(!response.ok)throw Error('No se pudo leer la vista previa local.');const blob=await response.blob();if(blob.size>25*1024*1024)throw Error('El documento supera 25 MB.');return{url:reference,blob,name:title,mimeType:blob.type||hint,revoke(){}};};
  load().then(value=>{opened=value;if(disposed)value.revoke();else setFile(value);}).catch(err=>{if(!disposed)setError(err?.status===404?'No tienes acceso a este documento o ya no está disponible.':'No se pudo abrir el documento. Reintenta.');});return()=>{disposed=true;controller.abort();opened?.revoke();};
 },[reference,privateId,localBlob,attempt,hint,title]);
 if(resolved.resolving)return <p role="status" className={'flex items-center justify-center gap-2 p-6 text-sm '+className} style={style}><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none"/>Comprobando acceso al documento…</p>;
 if(resolved.error)return <div role="alert" className="space-y-2 p-4 text-sm"><p>{resolved.error}</p><Button variant="outline" size="sm" onClick={resolved.retry}>Reintentar acceso</Button></div>;
 if(!privateId&&!localBlob){const native=normalizeLegacyDocumentReference(reference);if(!native)return <p role="alert" className="p-4 text-sm">Referencia de documento no disponible.</p>;const image=hint.startsWith('image/')||/\.(png|jpe?g|webp|gif|bmp)(?:[?#]|$)/i.test(native);if(image)return <img src={native} alt={title} className={className} style={style}/>;if(hint==='application/pdf'||/\.pdf(?:[?#]|$)/i.test(native))return <iframe src={native} className={className} style={style} title={title}/>;return <ProtectedDocumentLink href={sourceReference} companyId={companyId} contextKind={contextKind} contextId={contextId} target="_blank" rel="noopener noreferrer" className="p-4 text-sm underline">Descargar documento</ProtectedDocumentLink>;}
 return <section aria-label={title} className={'flex min-w-0 flex-col '+className} style={style}>
  {error?<div role="alert" className="space-y-3 p-4 text-sm"><p>{error}</p>{privateId&&<AdminDocumentRecovery key={privateId} assetId={privateId} onRestored={()=>setAttempt(x=>x+1)}/>}<Button variant="outline" size="sm" onClick={()=>setAttempt(x=>x+1)}><RefreshCw className="mr-2 h-4 w-4"/>Reintentar</Button></div>:!file?<p role="status" className="flex items-center justify-center gap-2 p-6 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none"/>Abriendo documento privado…</p>:<>
   <div className="flex items-center justify-between gap-2 border-b border-border p-2"><p className="min-w-0 truncate text-xs text-muted-foreground">{file.name}</p><Button asChild size="sm" variant="outline"><a href={file.url} download={file.name}><Download className="mr-1 h-3.5 w-3.5"/>Descargar</a></Button></div>
   {file.mimeType==='application/pdf'?<PrivatePdfViewer blob={file.blob} name={file.name}/>:file.mimeType?.startsWith('image/')?<img src={file.url} alt={file.name} className="h-auto max-w-full object-contain"/>:<p className="p-4 text-sm">Descarga el archivo para abrirlo en tu dispositivo.</p>}
  </>}
 </section>;
}

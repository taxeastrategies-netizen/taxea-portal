import{forwardRef,useState}from'react';
import{useResolvedDocumentReference}from'@/hooks/useResolvedDocumentReference';
import{openPrivateDocument,privateDocumentId}from'@/lib/privateDocuments';
export default forwardRef(function ProtectedDocumentLink({href,companyId,contextKind,contextId,children,onClick,...props},ref){
 const resolved=useResolvedDocumentReference(href,{companyId,contextKind,contextId});
 const[downloading,setDownloading]=useState(false),[downloadError,setDownloadError]=useState('');
 async function click(event){if(!resolved.reference||resolved.error||downloading){event.preventDefault();if(resolved.error)resolved.retry();return;}onClick?.(event);if(event.defaultPrevented)return;if(props.download!==undefined&&privateDocumentId(resolved.reference)){event.preventDefault();setDownloading(true);setDownloadError('');let opened;try{opened=await openPrivateDocument(resolved.reference);const link=document.createElement('a');link.href=opened.url;link.download=typeof props.download==='string'&&props.download?props.download:opened.name;document.body.appendChild(link);link.click();link.remove();setTimeout(opened.revoke,30000);}catch{opened?.revoke();setDownloadError('No se pudo descargar el documento. Reintenta.');}finally{setDownloading(false);}}}
 return <a {...props} ref={ref} role="link" href={resolved.reference||undefined} aria-disabled={resolved.resolving||!!resolved.error||downloading} aria-busy={resolved.resolving||downloading} title={resolved.error||downloadError||props.title} onClick={click}>{children}{(resolved.resolving||downloading)&&<span className="sr-only">Comprobando acceso al documento</span>}{(resolved.error||downloadError)&&<span className="sr-only">{resolved.error||downloadError}</span>}</a>;
});

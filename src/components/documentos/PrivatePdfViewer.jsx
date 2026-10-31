import {useEffect,useRef,useState} from 'react';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import {ChevronLeft,ChevronRight,Loader2,Minus,Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';

GlobalWorkerOptions.workerSrc=workerUrl;
const assets=import.meta.glob(['/node_modules/pdfjs-dist/cmaps/*.bcmap','/node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}','/node_modules/pdfjs-dist/wasm/*.{wasm,js}'],{query:'?url',import:'default',eager:true});
class LocalPdfAssets{
 async fetch({kind,filename}){
  const folder={cMapUrl:'cmaps',standardFontDataUrl:'standard_fonts',wasmUrl:'wasm'}[kind];
  if(!folder||!/^[A-Za-z0-9_.-]+$/.test(filename))throw new Error('Recurso PDF no admitido.');
  const url=assets['/node_modules/pdfjs-dist/'+folder+'/'+filename];
  if(typeof url!=='string'||!url)throw new Error('Recurso PDF no disponible.');
  if(url.startsWith('data:'))return Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0));
  if(new URL(url,location.href).origin!==location.origin)throw new Error('Origen de recurso PDF no admitido.');
  const response=await fetch(url,{credentials:'omit',cache:'force-cache'});
  if(!response.ok)throw new Error('No se pudo cargar el recurso PDF.');
  return new Uint8Array(await response.arrayBuffer());
 }
}

export default function PrivatePdfViewer({blob,name}){
 const container=useRef(null),canvas=useRef(null);
 const [pdf,setPdf]=useState(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(1),[width,setWidth]=useState(800),[error,setError]=useState(''),[busy,setBusy]=useState(true),[text,setText]=useState(''),[password,setPassword]=useState(''),[prompt,setPrompt]=useState(null);
 useEffect(()=>{
  if(!container.current)return;
  const observer=new ResizeObserver(entries=>setWidth(Math.max(240,Math.floor(entries[0].contentRect.width)-24)));
  observer.observe(container.current);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  let disposed=false,task,timer;setPdf(null);setPage(1);setError('');setBusy(true);setPrompt(null);setPassword('');
  const timeout=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!disposed){setError('El PDF está tardando demasiado. Puedes descargar el original.');setBusy(false);task?.destroy();}},30000);};
  (async()=>{
   const bytes=new Uint8Array(await blob.arrayBuffer());if(disposed)return;
   task=getDocument({data:bytes,useWorkerFetch:false,BinaryDataFactory:LocalPdfAssets,useSystemFonts:true,cMapPacked:true,enableXfa:false,maxImageSize:16000000,canvasMaxAreaInBytes:32000000});
   task.onPassword=(callback,reason)=>{clearTimeout(timer);if(!disposed){setBusy(false);setPrompt({incorrect:reason===2,submit:value=>{setBusy(true);setPrompt(null);setPassword('');timeout();callback(value);}});}};
   timeout();const document=await task.promise;clearTimeout(timer);
   if(!disposed)setPdf(document);
  })().catch(()=>{clearTimeout(timer);if(!disposed){setError('No se pudo representar este PDF. Puedes descargar el archivo original.');setBusy(false);}});
  return()=>{disposed=true;clearTimeout(timer);task?.destroy();};
 },[blob]);
 useEffect(()=>{
  if(!pdf||!canvas.current)return;
  let disposed=false,render,timer;setBusy(true);setError('');setText('');
  (async()=>{
   const current=await pdf.getPage(page);if(disposed)return;
   const unit=current.getViewport({scale:1});let scale=width/unit.width*zoom;
   scale=Math.min(scale,2400/unit.width,3000/unit.height);
   const viewport=current.getViewport({scale}),ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(12000000/(viewport.width*viewport.height)));
   const element=canvas.current;element.width=Math.ceil(viewport.width*ratio);element.height=Math.ceil(viewport.height*ratio);element.style.width=Math.ceil(viewport.width)+'px';element.style.height=Math.ceil(viewport.height)+'px';
   render=current.render({canvas:element,canvasContext:element.getContext('2d',{alpha:false}),viewport,transform:[ratio,0,0,ratio,0,0],background:'#ffffff'});
   timer=setTimeout(()=>{render.cancel();if(!disposed){setError('La página está tardando demasiado. Puedes descargar el original.');setBusy(false);}},25000);
   await render.promise;clearTimeout(timer);if(disposed)return;
   setBusy(false);const content=await current.getTextContent();if(!disposed)setText(content.items.filter(item=>'str' in item).map(item=>item.str).join(' ').slice(0,40000));
  })().catch(reason=>{clearTimeout(timer);if(!disposed&&reason?.name!=='RenderingCancelledException'){setBusy(false);setError('No se pudo representar esta página. Puedes descargar el original.');}});
  return()=>{disposed=true;clearTimeout(timer);render?.cancel();};
 },[pdf,page,zoom,width]);
 return <section ref={container} aria-label={'Vista de '+name} className="flex min-h-0 flex-1 flex-col">
  {pdf&&<nav aria-label="Páginas del documento" className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-border bg-card p-2">
   <Button size="icon" variant="outline" aria-label="Página anterior" disabled={page<=1} onClick={()=>setPage(n=>n-1)}><ChevronLeft className="h-4 w-4"/></Button><span aria-live="polite" className="min-w-24 text-center text-sm">{page} / {pdf.numPages}</span><Button size="icon" variant="outline" aria-label="Página siguiente" disabled={page>=pdf.numPages} onClick={()=>setPage(n=>n+1)}><ChevronRight className="h-4 w-4"/></Button>
   <Button size="icon" variant="outline" aria-label="Reducir documento" disabled={zoom<=0.5} onClick={()=>setZoom(n=>Math.max(.5,n-.25))}><Minus className="h-4 w-4"/></Button><span className="w-12 text-center text-xs">{Math.round(zoom*100)}%</span><Button size="icon" variant="outline" aria-label="Ampliar documento" disabled={zoom>=3} onClick={()=>setZoom(n=>Math.min(3,n+.25))}><Plus className="h-4 w-4"/></Button>
  </nav>}
  {prompt&&<form onSubmit={event=>{event.preventDefault();prompt.submit(password);}} className="mx-auto my-8 grid max-w-sm gap-3 p-4"><label htmlFor="private-pdf-password" className="text-sm font-medium">Contraseña del PDF</label><input id="private-pdf-password" type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} className="min-h-11 rounded border border-border bg-background px-3"/>{prompt.incorrect&&<p role="alert" className="text-sm text-destructive">La contraseña no es correcta.</p>}<Button disabled={!password}>Abrir PDF</Button></form>}
  {busy&&<p role="status" className="flex items-center justify-center gap-2 p-3 text-sm"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none"/>Preparando página...</p>}
  {error&&<p role="alert" className="mx-auto max-w-xl p-4 text-center text-sm text-destructive">{error}</p>}
  <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3"><canvas ref={canvas} role="img" aria-label={name+', página '+page} className="mx-auto bg-white shadow-sm" hidden={!pdf||!!prompt||!!error}/><p className="sr-only">{text}</p></div>
 </section>;
}

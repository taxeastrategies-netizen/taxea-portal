import { useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FILE_LIMIT } from '@/lib/utilityTools.mjs';
import { downloadBlob, transformPdfs, imagesPdf, jpegImage, zipFiles } from '@/lib/utilityFiles';
const OPERATIONS={merge:'Unir PDF',select:'Extraer / reordenar páginas PDF',split:'Separar PDF en páginas',rotate:'Girar PDF',images:'Fotos a PDF',compress:'Optimizar imágenes a JPEG'};
export default function PdfImageKit() {
  const [operation,setOperation]=useState('merge'),[files,setFiles]=useState([]),[selection,setSelection]=useState(''),[rotation,setRotation]=useState('90');
  const [quality,setQuality]=useState('0.85'),[maxSide,setMaxSide]=useState('2200'),[ack,setAck]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
  const imageMode=['images','compress'].includes(operation);
  const add=chosen=>{
    setError('');setResult(null);
    if(files.length+chosen.length>20 || [...files,...chosen].reduce((sum,f)=>sum+f.size,0)>100*1024*1024){setError('Máximo 20 archivos y 100 MB por lote.');return;}
    if(chosen.some(f=>!f.size || f.size>FILE_LIMIT || !(imageMode?/\.(png|jpe?g|webp)$/i:/\.pdf$/i).test(f.name))){setError(imageMode?'Usa PNG, JPEG o WebP de hasta 15 MB.':'Usa PDF de hasta 15 MB.');return;}
    setFiles(current=>[...current,...chosen]);
  };
  const move=(index,delta)=>setFiles(current=>{const next=[...current];[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});
  const process=async()=>{
    if(busy)return;
    setBusy(true);setError('');setResult(null);
    try {
      if(!files.length)throw new Error('Selecciona archivos.');
      if(files.some(f=>!(imageMode?/\.(png|jpe?g|webp)$/i:/\.pdf$/i).test(f.name)))throw new Error('El lote contiene archivos incompatibles con esta operación.');
      if(!imageMode && !ack)throw new Error('Confirma el aviso de firmas digitales.');
      let output;
      if(operation==='images')output=await imagesPdf(files,Number(quality),Number(maxSide));
      else if(operation==='compress'){
        const images=[];
        for(const file of files){const image=await jpegImage(file,Number(quality),Number(maxSide));images.push({name:file.name.replace(/\.[^.]+$/,'')+'.jpg',blob:image.blob});}
        output=images.length===1?{bytes:await images[0].blob.arrayBuffer(),name:images[0].name,type:'image/jpeg'}:{bytes:await zipFiles(images),name:'imagenes_optimizadas.zip',type:'application/zip'};
      } else output=await transformPdfs(files,operation,selection,Number(rotation));
      setResult(output);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const originalSize=files.reduce((sum,f)=>sum+f.size,0);
  const resultSize=result?.bytes?.byteLength || 0;
  return <section className="rounded-2xl border bg-card p-5 space-y-5">
    <p className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">Procesamiento local: estos archivos no se suben a Taxea. Se genera una copia descargable. Los PDF protegidos por contraseña no son compatibles. Máximo 20 archivos, 100 MB por lote y 500 páginas de salida.</p>
    <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm font-medium">Operación<select className="block w-full rounded-md border bg-background p-2.5 mt-2" value={operation} disabled={busy} onChange={e=>{setOperation(e.target.value);setResult(null);setError('');}}>{Object.entries(OPERATIONS).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
      <label className="text-sm font-medium">Archivos<input className="block w-full mt-2 text-sm" aria-label="Archivos para kit PDF e imágenes" type="file" multiple disabled={busy} accept={imageMode?'.png,.jpg,.jpeg,.webp':'.pdf'} onChange={e=>{add(Array.from(e.target.files || []));e.target.value='';}}/></label></div>
    {!imageMode && <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)} className="mt-1"/><span>Entiendo que transformar un PDF firmado invalida su firma y puede perder metadatos, marcadores o formularios. Conservaré el original firmado.</span></label>}
    {!imageMode && operation!=='merge' && <label className="block text-sm font-medium">Páginas, en el orden deseado<Input value={selection} disabled={busy} maxLength={2000} placeholder="Ejemplo: 1,3,5-7 o 3,2,1" onChange={e=>setSelection(e.target.value)} className="mt-2"/><span className="block text-xs text-muted-foreground mt-2">Vacío: todas. Una página separada por PDF en «Separar»; un único PDF ordenado en «Extraer». Estas operaciones requieren un solo archivo.</span></label>}
    {operation==='rotate' && <label className="block text-sm font-medium">Giro<select className="block border rounded-md p-2 mt-2 bg-background" value={rotation} disabled={busy} onChange={e=>setRotation(e.target.value)}><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>}
    {imageMode && <><div className="grid sm:grid-cols-2 gap-4"><label className="text-sm">Calidad JPEG<select className="block w-full rounded-md border bg-background p-2 mt-2" value={quality} disabled={busy} onChange={e=>setQuality(e.target.value)}><option value="0.95">Alta (95%)</option><option value="0.85">Equilibrada (85%)</option><option value="0.7">Compacta (70%)</option></select></label><label className="text-sm">Lado máximo<select className="block w-full rounded-md border bg-background p-2 mt-2" value={maxSide} disabled={busy} onChange={e=>setMaxSide(e.target.value)}><option value="3200">3200 píxeles</option><option value="2200">2200 píxeles</option><option value="1600">1600 píxeles</option></select></label></div><p className="text-xs text-muted-foreground">La conversión JPEG elimina metadatos y usa fondo blanco para transparencias. Comprueba legibilidad antes de usar la copia. El tamaño no siempre se reduce.</p></>}
    <div className="space-y-2">{files.map((file,index)=><div key={index+file.name} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"><span className="text-sm break-all flex-1 min-w-0">{index+1}. {file.name} · {(file.size/1024/1024).toFixed(2)} MB</span><Button variant="ghost" size="sm" aria-label={'Subir '+file.name} disabled={busy || index===0} onClick={()=>move(index,-1)}><ArrowUp className="h-4 w-4"/></Button><Button variant="ghost" size="sm" aria-label={'Bajar '+file.name} disabled={busy || index===files.length-1} onClick={()=>move(index,1)}><ArrowDown className="h-4 w-4"/></Button><Button variant="ghost" size="sm" aria-label={'Quitar '+file.name} disabled={busy} onClick={()=>{setFiles(current=>current.filter((_,i)=>i!==index));setResult(null);}}><Trash2 className="h-4 w-4"/></Button></div>)}</div>
    {error && <p role="alert" className="text-sm text-red-700 rounded-lg bg-red-50 p-3">{error}</p>}
    <Button onClick={process} disabled={busy || !files.length || !imageMode && !ack}>{busy?<><Loader2 className="h-4 w-4 animate-spin mr-2"/>Procesando…</>:'Generar copia'}</Button>
    {result && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3"><p className="text-sm text-emerald-800">Copia preparada: {result.name} · {(resultSize/1024/1024).toFixed(2)} MB{originalSize>resultSize?' · '+Math.round((1-resultSize/originalSize)*100)+'% menos que el lote original':''}</p><Button variant="outline" onClick={()=>downloadBlob(result.bytes,result.name,result.type)}>Descargar resultado</Button></div>}
  </section>;
}

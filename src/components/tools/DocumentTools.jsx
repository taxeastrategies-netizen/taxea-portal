import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Plus, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FILE_LIMIT, OCR_FIELDS, renamedFile, uniqueNames, documentsCsv } from '@/lib/utilityTools.mjs';
import { downloadBlob, zipFiles } from '@/lib/utilityFiles';

export async function callUtility(params) {
  try {
    const response=await base44.functions.invoke('utilityOperations',params);
    const data=response?.data ?? response;
    if(!data?.ok) throw new Error(data?.error || 'No se pudo completar la operación.');
    return data;
  } catch(error) {throw new Error(error?.response?.data?.error || error?.message || 'Operación no disponible.');}
}
export default function DocumentTools({mode,company}) {
  const [rows,setRows]=useState([]),[template,setTemplate]=useState('{fecha}_{proveedor}_{numero}');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[exporting,setExporting]=useState(false);
  const stop=useRef(false),running=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;stop.current=true;};},[]);
  const update=(id,patch)=>{if(alive.current)setRows(current=>current.map(row=>row.id===id?{...row,...patch}:row));};
  const addFiles=files=>{
    setError('');
    if(rows.length+files.length>15){setError('Máximo 15 documentos por lote.');return;}
    if([...rows.map(row=>row.file),...files].reduce((sum,file)=>sum+file.size,0)>100*1024*1024){setError('El lote no puede superar 100 MB.');return;}
    if(files.some(file=>!file.size || file.size>FILE_LIMIT || !/\.(pdf|png|jpe?g)$/i.test(file.name))){setError('Usa PDF, PNG o JPEG de hasta 15 MB por archivo.');return;}
    setRows(current=>[...current,...files.map(file=>({id:crypto.randomUUID(),file,status:'queued',fields:{},error:''}))]);
  };
  const analyze=async()=>{
    if(running.current || !company?.id)return;
    running.current=true;stop.current=false;setBusy(true);setError('');
    try {
      for(const row of rows.filter(item=>item.status!=='ready')){
        if(stop.current)break;
        update(row.id,{status:'processing',error:''});
        try {
          const data=await callUtility({action:'extract',companyId:company.id,file:row.file});
          update(row.id,{fields:data.result,status:'ready'});
        } catch(e) {
          update(row.id,{status:'error',error:e.message});
          if(/Límite OCR/.test(e.message))break;
        }
      }
    } finally {running.current=false;if(alive.current)setBusy(false);}
  };
  let names=[],nameError='';
  try {names=uniqueNames(rows.map(row=>renamedFile(row.file.name,row.fields,template)));}
  catch(e){nameError=e.message;}
  const fieldChange=(row,key,value)=>update(row.id,{fields:{...row.fields,[key]:value}});
  const exportedRows=rows.filter(row=>row.status==='ready').map(row=>({name:row.file.name,fields:row.fields}));
  const runExport=async(action)=>{
    if(exporting)return;
    setExporting(true);setError('');
    try {await action();}catch(e){setError(e.message);}finally{if(alive.current)setExporting(false);}
  };
  const xlsx=async()=>{
    const XLSX=await import('xlsx');
    const data=[['archivo',...OCR_FIELDS],...exportedRows.map(row=>[row.name,...OCR_FIELDS.map(key=>row.fields[key] ?? '')])];
    const sheet=XLSX.utils.aoa_to_sheet(data);
    // User-edited text is a literal string, never an Excel formula or hyperlink.
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,sheet,'Extracción');
    downloadBlob(XLSX.write(workbook,{bookType:'xlsx',type:'array'}),'documentos.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };
  return <section className="rounded-2xl border bg-card p-5 space-y-5">
    <div className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">
      El OCR sube una copia a almacenamiento privado de Taxea y utiliza IA. Revisa siempre el resultado. Se conserva una extracción privada para reutilizarla sin repetir el análisis.
      {!company?.id && <p className="text-amber-700 mt-2">Selecciona una empresa para analizar documentos. El renombrado manual no necesita OCR.</p>}
    </div>
    <div className="flex flex-wrap gap-3 items-center">
      <label className={'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium '+(busy?'opacity-50':'cursor-pointer hover:bg-secondary')}><Plus className="h-4 w-4"/>Añadir documentos
        <input aria-label="Añadir documentos OCR" type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="sr-only" disabled={busy || exporting} onChange={e=>{addFiles(Array.from(e.target.files || []));e.target.value='';}}/>
      </label>
      <Button onClick={analyze} disabled={busy || exporting || !company?.id || !rows.some(row=>row.status!=='ready')}>{busy?<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Analizando…</>:'Analizar con OCR'}</Button>
      {busy && <Button variant="outline" onClick={()=>{stop.current=true;}}>Detener después del documento actual</Button>}
      <span role="status" className="text-xs text-muted-foreground">{rows.filter(row=>row.status==='ready').length} de {rows.length} analizados · 4/min y 15/día compartidos con el OCR de facturas</span>
    </div>
    {mode==='rename' && <div className="space-y-2"><label className="text-sm font-medium" htmlFor="filename-template">Nomenclatura</label><Input id="filename-template" value={template} maxLength={200} onChange={e=>setTemplate(e.target.value)} disabled={busy || exporting}/><p className="text-xs text-muted-foreground">Campos: {'{fecha}, {proveedor}, {numero}, {tipo}, {original}'}. Si falta un dato se señala; los nombres repetidos reciben un sufijo.</p></div>}
    {(error || nameError && mode==='rename') && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error || nameError}</p>}
    {!rows.length?<div className="py-10 text-center text-muted-foreground text-sm">Añade documentos para empezar. No se modifican ni se registran como facturas.</div>:<div className="space-y-3">{rows.map((row,index)=><article key={row.id} className="rounded-xl border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold break-all">{row.file.name}</p><p className="text-xs text-muted-foreground mt-1">{(row.file.size/1024/1024).toFixed(2)} MB · {({queued:'Pendiente',processing:'Analizando',ready:'Analizado: revisa los datos',error:'Error: puedes reintentar'})[row.status]}</p></div><Button variant="ghost" size="sm" aria-label={'Quitar '+row.file.name} disabled={busy || exporting} onClick={()=>setRows(current=>current.filter(item=>item.id!==row.id))}><Trash2 className="h-4 w-4"/></Button></div>
      {row.error && <p role="alert" className="text-sm text-red-600">{row.error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{(mode==='rename'?['fecha','proveedor','numero','tipo']:OCR_FIELDS.filter(key=>key!=='resumen')).map(key=><label key={key} className="text-xs text-muted-foreground capitalize">{key}<Input className="mt-1" type="text" value={row.fields[key] ?? ''} maxLength={400} onChange={e=>fieldChange(row,key,e.target.value)} disabled={busy || exporting}/></label>)}</div>
      {mode==='extract' && <label className="block text-xs text-muted-foreground">Resumen<textarea className="w-full mt-1 rounded-md border bg-background p-3 text-sm text-foreground" value={row.fields.resumen || ''} maxLength={3000} onChange={e=>fieldChange(row,'resumen',e.target.value)} disabled={busy || exporting}/></label>}
      {mode==='rename' && <div className="flex flex-wrap gap-3 items-center"><p className="text-sm text-primary break-all flex-1">{names[index] || 'Corrige la nomenclatura'}</p><Button variant="outline" size="sm" disabled={!!nameError || busy || exporting} onClick={()=>downloadBlob(row.file,names[index])}><Download className="h-4 w-4 mr-2"/>Descargar copia</Button></div>}
    </article>)}</div>}
    <div className="flex flex-wrap gap-3">{mode==='rename'?<Button disabled={!rows.length || busy || exporting || !!nameError} onClick={()=>runExport(async()=>downloadBlob(await zipFiles(rows.map((row,index)=>({name:names[index],blob:row.file}))),'documentos_renombrados.zip','application/zip'))}>Descargar lote ZIP{exporting && <Loader2 className="h-4 w-4 ml-2 animate-spin"/>}</Button>:<><Button disabled={!exportedRows.length || busy || exporting} onClick={()=>runExport(xlsx)}>Exportar Excel</Button><Button variant="outline" disabled={!exportedRows.length || busy || exporting} onClick={()=>runExport(()=>downloadBlob(documentsCsv(exportedRows),'documentos.csv','text/csv;charset=utf-8'))}>Exportar CSV</Button></>}</div>
    {mode==='extract' && <p className="text-xs text-muted-foreground">Solo se exportan documentos analizados. Las correcciones son locales: no cambian el archivo ni los libros contables.</p>}
  </section>;
}

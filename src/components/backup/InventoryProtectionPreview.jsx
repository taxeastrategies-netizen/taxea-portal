import {useEffect,useRef,useState} from 'react';
import {base44} from '@/api/base44Client';
import {requestBackupChunk,backupContinuationDelay} from '@/lib/backupClient.mjs';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Loader2,ShieldCheck} from 'lucide-react';

export default function InventoryProtectionPreview({disabled=false}){
 const [busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState(''),active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const analyse=async(startNew=false)=>{
  if(busy||disabled)return;setBusy(true);setError('');let inventoryJobId=startNew?null:result?.inventoryJobId;
  try{
   for(let block=0;block<200&&active.current;block++){
    const response=await requestBackupChunk((name,payload)=>base44.functions.invoke(name,payload),{action:'inventory_preview',inventoryJobId,startNewInventory:startNew&&block===0});
    const data=response?.data??response;if(!active.current)return;
    setResult(data);inventoryJobId=data.inventoryJobId||inventoryJobId;
    if(!data.ok)throw Error('El análisis necesita revisión. Puedes retomarlo o iniciar un inventario nuevo; no se ha trasladado ningún documento.');
    if(!data.continueRequired)return;
    await new Promise(resolve=>setTimeout(resolve,backupContinuationDelay(data)));
   }
   if(active.current)setError('El inventario queda guardado. Pulsa Reanudar para continuar desde el último bloque.');
  }catch{if(active.current)setError('No se pudo finalizar el inventario. Puedes reanudarlo sin modificar los documentos originales.');}
  finally{if(active.current)setBusy(false);}
 };
 return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5"/>Protección del histórico documental</CardTitle></CardHeader><CardContent className="space-y-4">
  <p className="text-sm text-muted-foreground">Analiza las referencias de todas las empresas y los archivos que ya usan almacenamiento privado. Este análisis consulta metadatos: no migra ni elimina archivos y no cambia facturas, asientos o subcuentas.</p>
  <div className="flex flex-wrap gap-2"><Button disabled={disabled||busy} onClick={()=>analyse(result?.status==='completed')}>{busy?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Analizando...</>:result?.inventoryJobId&&result.status!=='completed'?'Reanudar inventario':'Analizar protección documental'}</Button>{result?.inventoryJobId&&result.status!=='completed'&&<Button variant="outline" disabled={disabled||busy} onClick={()=>analyse(true)}>Iniciar inventario nuevo</Button>}</div>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {result&&<div role="status" className="space-y-2 text-sm"><p>Referencias analizadas: <strong>{result.referencesScanned??0}</strong>{result.status!=='completed'&&result.sourcesCompleted!=null&&<> · Fuentes: {result.sourcesCompleted}/{result.totalSources}</>}</p>
   {result.status==='completed'&&<><div className="grid gap-3 sm:grid-cols-3"><p>En almacenamiento privado: <strong>{result.privateReferences}</strong></p><p>En almacenamiento anterior: <strong>{result.nativeReferences}</strong></p><p>Vinculación por revisar: <strong>{result.unassignedReferences}</strong></p></div><p className="text-xs text-muted-foreground">Las cifras cuentan referencias; un archivo puede aparecer en más de un módulo. Archivos del almacenamiento anterior por empresa: {result.nativeFilesByCompany}. No se ha copiado ni retirado ningún original.</p>{result.sharedNativeReferenceGroups>0&&<p className="text-amber-700">Hay {result.sharedNativeReferenceGroups} referencias compartidas entre empresas que necesitan revisión de pertenencia antes de una migración.</p>}<details><summary className="cursor-pointer">Desglose por fuente</summary><div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Fuente</th><th className="p-2 text-right">Referencias</th></tr></thead><tbody>{Object.entries(result.sourceCounts||{}).map(([name,count])=><tr key={name}><td className="p-2">{name}</td><td className="p-2 text-right">{count}</td></tr>)}</tbody></table></div></details></>}
  </div>}
 </CardContent></Card>;
}

import{useState,useRef,useEffect}from'react';
import{base44}from'@/api/base44Client';
import{requestBackupChunk}from'@/lib/backupClient.mjs';
import{Button}from'@/components/ui/button';
import{Card,CardContent}from'@/components/ui/card';
const labels={processing:'Protegiendo copias',completed:'Copias verificadas',incidents:'Revisión necesaria',rolling_back:'Desactivando vinculaciones',rolled_back:'Vinculaciones desactivadas'};
export default function LegacyProtectionPlanPreview({jobs=[],busy=false}){
 const[pending,setPending]=useState(false),[result,setResult]=useState(null),[progress,setProgress]=useState(null),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false),[pauseRequested,setPauseRequested]=useState(false);
 const stop=useRef(false);useEffect(()=>()=>{stop.current=true;},[]);
 const job=jobs.find(j=>j.runVersion==='snapshot-v4'&&j.status==='completed'&&j.verificationStatus==='ok'&&j.sourceIndexDriveFileId&&j.manifestDriveFileId);
 async function prepare(){if(!job||pending||busy)return;setPending(true);setError('');setConfirmed(false);try{const response=await base44.functions.invoke('documentBackupToDrive',{action:'legacy_protection_plan',backupJobId:job.id});setResult(response.data?.summary||null);setProgress(response.data?.protectionJob||null);}catch{setError('No se pudo preparar el plan. Necesita una copia completa verificada y acceso privado a su índice y manifiesto.');}finally{setPending(false);}}
 async function run({rollback=false,retry=false,reactivate=false,verification=false,archiveDrill=false}={}){
  if(!result||!confirmed||pending||busy)return;setPending(true);setError('');stop.current=false;setPauseRequested(false);let protectionJobId=progress?.jobId;
  try{
   for(let chunk=0;chunk<2000&&!stop.current;chunk++){
    const response=await requestBackupChunk((name,payload)=>base44.functions.invoke(name,payload),{action:archiveDrill?'drill_legacy_protection_recovery':verification?'verify_legacy_protection':rollback?'rollback_legacy_protection':'protect_legacy_documents',backupJobId:result.backupJobId,planDigest:result.planDigest,extendedManualRun:true,fileBudget:3,...(protectionJobId?{protectionJobId}:{}),...(rollback?{confirmDisableLinks:true}:{confirmCopy:true}),...(retry&&chunk===0?{retryIncidents:true}:{}),...(reactivate?{reactivateDisabled:true}:{})});
    const data=response.data;if(!data?.ok||!data.jobId)throw Error('Respuesta no verificada');protectionJobId=data.jobId;setProgress(previous=>verification||archiveDrill?{...previous,...data}:data);if(!data.continueRequired)break;
   }
  }catch(error){setError(error?.response?.data?.code==='PROTECTION_CLIENT_UPDATE_REQUIRED'?'Actualiza la página para continuar con la versión vigente. Se conserva el progreso.':'El proceso se ha interrumpido. Conserva el progreso y todos los originales. Puedes preparar el mismo plan y continuar sin duplicar archivos.');}finally{setPending(false);}
 }
 return <Card><CardContent className="pt-5 space-y-3">
  <div><h2 className="font-medium">Protección del histórico documental</h2><p className="text-sm text-muted-foreground">Prepara un plan desde una copia íntegra verificada. Después permite crear y comprobar copias privadas sin cambiar las referencias de facturas, asientos ni subcuentas.</p></div>
  <Button variant="outline" disabled={!job||busy||pending} onClick={prepare}>{pending&&!result?'Preparando plan…':'Preparar plan desde copia verificada'}</Button>
  {!job&&<p className="text-xs text-muted-foreground">Primero termina una copia completa y pulsa «Verificar última copia».</p>}
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {result&&<div className="space-y-3 text-sm">
   <div role="status"><p>{result.totalReferences} referencias · {result.legacyFiles} archivos del histórico · {result.privateReferences} referencias ya privadas.</p><p>{result.eligibleFiles} archivos con copia válida · {result.blockedFiles} requieren revisión.</p><p>Sin asignar: {result.unassignedReferences} · Enlaces externos excluidos: {result.excludedExternalReferences}.</p><p className="break-all text-xs text-muted-foreground">Plan: {result.planDigest}</p></div>
   <p className="text-xs text-muted-foreground">Los originales se conservan. Su retirada del almacenamiento anterior necesita una comprobación posterior y la intervención de Base44.</p>
   <label className="flex gap-2 items-start"><input type="checkbox" checked={confirmed} disabled={pending||busy} onChange={e=>setConfirmed(e.target.checked)}/><span>He revisado el plan y quiero proteger sus documentos. Se comprobará cada archivo antes de activar su acceso privado.</span></label>
   <div className="flex flex-wrap gap-2">
    {(!progress||progress.status==='processing')&&<Button disabled={!confirmed||busy||pending||!result.eligibleFiles} onClick={()=>run()}>{pending?'Comprobando archivo…':progress?'Continuar lote':'Crear copias privadas verificadas'}</Button>}
    {pending&&result&&<Button variant="outline" disabled={pauseRequested} onClick={()=>{stop.current=true;setPauseRequested(true);}}>{pauseRequested?'Pausa solicitada…':'Pausar al terminar este archivo'}</Button>}
    {progress?.status==='completed'&&<Button variant="outline" disabled={!confirmed||busy||pending} onClick={()=>run({verification:true})}>{progress?.verificationStatus==='ok'?'Verificación y recuperación guardadas':progress?.verificationStatus==='checking'?'Continuar verificación final':'Verificar copias y guardar recuperación'}</Button>}
    {progress?.recoveryManifestReady&&<Button variant="outline" disabled={!confirmed||busy||pending} onClick={()=>run({archiveDrill:true})}>{progress.recoveryDrillStatus==='ok'?'Recuperación documental comprobada':progress.recoveryDrillStatus==='checking'?'Continuar ensayo de recuperación':'Ensayar recuperación documental'}</Button>}
    {progress?.status==='incidents'&&<Button disabled={!confirmed||busy||pending} onClick={()=>run({retry:true})}>Revisar de nuevo las incidencias</Button>}
    {progress?.status==='rolled_back'&&<Button disabled={!confirmed||busy||pending} onClick={()=>run({reactivate:true})}>Reactivar copias verificadas</Button>}
   </div>
  </div>}
  {progress&&<div role="status" className="rounded-lg border p-3 space-y-2 text-sm">
   <p className="font-medium">{labels[progress.status]||'Proceso pendiente'}</p><p>Revisados {progress.cursor} de {progress.total} · Verificados {progress.verified} · Reutilizados {progress.reused} · Incidencias {progress.issueCount}.</p>
   {progress.status==='rolling_back'&&<p>Vinculaciones revisadas: {progress.rollbackCursor} de {progress.total}.</p>}
   <p>Originales eliminados: 0 · Registros contables modificados: 0.</p>
   {progress.verificationStatus&&<p>Comprobación final: {progress.verificationChecked||0} de {progress.total} · Incidencias: {progress.verificationIssueCount||0}. {progress.recoveryManifestReady?'Índice de recuperación privado guardado en Drive.':'Índice de recuperación aún sin finalizar.'}</p>}
   {progress.recoveryDrillStatus&&<p>Ensayo desde el índice privado: {progress.recoveryDrillVerified||0} de {progress.total} · Incidencias: {progress.recoveryDrillIssueCount||0}. Sin leer originales nativos ni restaurar registros contables.</p>}
   {!!progress.verificationIssues?.length&&<details><summary>Incidencias de verificación</summary><ul>{progress.verificationIssues.map(issue=><li key={issue.index}>Archivo {issue.index+1} · {issue.code}</li>)}</ul></details>}
   {!!progress.issues?.length&&<details><summary>Ver incidencias ({progress.issues.length} de {progress.issueCount})</summary><ul className="mt-2 space-y-1">{progress.issues.map(issue=><li key={issue.index}>Archivo {issue.index+1} · {issue.code}</li>)}</ul></details>}
   {!pending&&progress.status!=='rolled_back'&&<details><summary>Desactivar las vinculaciones de este trabajo</summary><p className="text-xs my-2">Los enlaces históricos dejarán de resolver estas copias hasta reactivar sus vinculaciones. Se conservan los archivos privados y los datos originales.</p><Button variant="outline" disabled={!confirmed||busy} onClick={()=>run({rollback:true})}>{progress.status==='rolling_back'?'Continuar desactivación':'Desactivar vinculaciones de este trabajo'}</Button></details>}
  </div>}
 </CardContent></Card>;
}

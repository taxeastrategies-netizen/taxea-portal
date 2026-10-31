import {useState} from 'react';
import {base44} from '@/api/base44Client';
import {useAuth} from '@/lib/AuthContext';
import {Button} from '@/components/ui/button';
import {Loader2,ShieldCheck} from 'lucide-react';

export default function AdminDocumentRecovery({assetId,onRestored}){
 const {user}=useAuth(),[busy,setBusy]=useState(false),[plan,setPlan]=useState(null),[message,setMessage]=useState('');
 if(!['admin','super_admin'].includes(user?.role)||!assetId)return null;
 const operate=async action=>{
  if(busy)return;setBusy(true);setMessage('');
  try{
   const response=await base44.functions.invoke('documentStorage',action==='asset_recovery_plan'?{action,assetId}:{action,assetId,expectedGeneration:plan.expectedGeneration,expectedSha256:plan.sha256});
   const data=response?.data??response;if(!data?.ok)throw new Error('No se pudo verificar la recuperación.');
   if(action==='asset_recovery_plan'){
    setPlan(data);
    if(data.mode==='available')setMessage('El archivo está íntegro. Puedes volver a abrirlo.');
    if(data.mode==='backup_required')setMessage('No hay una versión recuperable en el almacenamiento. Se necesita una copia de seguridad verificada; no se ha cambiado ningún documento.');
   }else{setPlan(null);setMessage('Documento recuperado y verificado. Se conserva su referencia original.');onRestored?.();}
  }catch(error){setPlan(null);setMessage(error?.response?.status===403||error?.status===403?'La recuperación requiere una sesión administradora activa.':'No se ha podido completar la recuperación. Reintenta el análisis; no se sustituirá ningún archivo sin verificar su integridad.');}
  finally{setBusy(false);}
 };
 return <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-left text-sm">
  <p className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4"/>Recuperación de documentos · Administración</p>
  <p className="text-xs text-muted-foreground">Comprueba la versión del archivo y su hash. La recuperación conserva la referencia y no modifica facturas, asientos ni subcuentas.</p>
  {message&&<p role="status">{message}</p>}
  {plan?.canRestore&&<div className="space-y-2 break-words text-xs"><p>{plan.name} · {plan.size} bytes</p><p>SHA-256: {plan.sha256}</p>{plan.expiresAt&&<p>Versión recuperable hasta: {new Date(plan.expiresAt).toLocaleString('es-ES')}</p>}<Button disabled={busy} onClick={()=>operate('restore_asset')}>{busy&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Restaurar y verificar este archivo</Button></div>}
  {!plan?.canRestore&&<Button variant="outline" disabled={busy} onClick={()=>operate('asset_recovery_plan')}>{busy&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Analizar recuperación</Button>}
 </div>;
}

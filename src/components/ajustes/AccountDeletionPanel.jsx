import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {Trash2} from 'lucide-react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
export default function AccountDeletionPanel({user}){
  const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[request,setRequest]=useState(null),[error,setError]=useState('');
  const call=async data=>(await base44.functions.invoke('accountDeletionOperations',data)).data;
  useEffect(()=>{let cancelled=false;if(user?.id)call({action:'status'}).then(data=>{if(!cancelled)setRequest(data.request);}).catch(()=>{if(!cancelled)setError('No se pudo consultar una solicitud previa. Puedes reintentar al enviar: no se duplicará si ya existe.');});return()=>{cancelled=true;};},[user?.id]);
  const submit=async()=>{
    if(busy||confirmation!=='ELIMINAR')return;setBusy(true);setError('');
    try{const data=await call({action:'request',confirmation});setRequest(data.request);setOpen(false);setConfirmation('');}
    catch(err){setError(err?.response?.data?.error||'No se pudo registrar la solicitud. Puedes reintentar.');}finally{setBusy(false);}
  };
  return <section className="bg-card border border-destructive/30 rounded-xl p-5 space-y-4">
    <h2 className="font-jakarta font-semibold flex items-center gap-2"><Trash2 className="w-5 h-5 text-destructive"/>Eliminar cuenta</h2>
    <p className="text-sm text-muted-foreground">Puedes iniciar aquí la eliminación definitiva de tu cuenta y de los datos personales que no debamos conservar. No es una simple desactivación.</p>
    <p className="text-xs text-muted-foreground">La tramitación es manual, con justificante y plazo inicial de un mes. Las facturas, libros y evidencias que deban conservarse se separan y restringen por su obligación legal; no se borran a ciegas. La baja no implica cancelar automáticamente un servicio profesional o una suscripción: también revisaremos ese punto y te informaremos.</p>
    {request&&<div role="status" className="rounded-lg border border-border bg-secondary/40 p-4 text-sm space-y-2"><p className="font-semibold">{request.status==='completed'?'Eliminación completada':'Solicitud de eliminación registrada'}</p><p className="break-all">Referencia: {request.reference}</p><p>Estado: {request.status==='reviewing'?'En tramitación':request.status==='completed'?'Completada':'Recibida'}</p><p>Fecha inicial de respuesta: {new Date(request.dueAt).toLocaleDateString('es-ES')}</p><p className="text-xs text-muted-foreground">No tienes que llamar ni enviar otro correo para iniciar el trámite. Te confirmaremos su finalización y cualquier conservación legal aplicable.</p></div>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {(!request||request.status==='completed')&&<Button variant="destructive" onClick={()=>{setOpen(true);setError('');setConfirmation('');}}>Eliminar mi cuenta</Button>}
    <p><Link to="/eliminar-cuenta" className="text-sm underline underline-offset-4">Información sobre eliminación y conservación</Link></p>
    <Dialog open={open} onOpenChange={next=>{if(!busy)setOpen(next);}}><DialogContent><DialogHeader><DialogTitle>Eliminar tu cuenta de Taxea Portal</DialogTitle><DialogDescription>Registrarás una solicitud real de eliminación. Recibirás un justificante. No se eliminarán indiscriminadamente documentos sujetos a conservación legal.</DialogDescription></DialogHeader>
      <p className="text-sm">Se elimina el acceso y perfil de la plataforma, se revisan sus conexiones y se suprimen los datos no retenibles. La documentación contable o fiscal que deba conservarse quedará restringida. El plazo inicial de respuesta es un mes; cualquier ampliación legal se comunicará.</p>
      <label className="text-sm" htmlFor="delete-account-confirmation">Escribe ELIMINAR para confirmar</label><Input id="delete-account-confirmation" autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} placeholder="ELIMINAR"/>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)} disabled={busy}>Cancelar</Button><Button variant="destructive" disabled={busy||confirmation!=='ELIMINAR'} onClick={submit}>{busy?'Registrando…':'Solicitar eliminación definitiva'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}

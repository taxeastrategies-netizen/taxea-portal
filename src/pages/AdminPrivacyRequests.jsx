import {useEffect,useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import PageHeader from '@/components/ui/PageHeader';
export default function AdminPrivacyRequests(){
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(null),[checks,setChecks]=useState({}),[notes,setNotes]=useState(''),[evidence,setEvidence]=useState(''),[confirmation,setConfirmation]=useState('');
  const call=async body=>(await base44.functions.invoke('accountDeletionOperations',body)).data;
  const load=async()=>{try{setRows((await call({action:'admin_list'})).requests||[]);}catch{setError('No se pudieron consultar las solicitudes.');}};
  useEffect(()=>{void load();},[]);
  const perform=async action=>{
    if(busy||!selected)return;setBusy(true);setError('');
    try{await call({action,requestId:selected.id,confirmation,confirmations:checks,retentionNotes:notes,evidence});setSelected(null);await load();}
    catch(err){setError(err?.response?.data?.error||'No se pudo completar el trámite.');}finally{setBusy(false);}
  };
  return <div className="space-y-5"><PageHeader title="Solicitudes de eliminación" subtitle="Tramitación de privacidad · Solo administración"/>
    <p className="text-sm text-muted-foreground">Iniciar una baja no borra automáticamente la contabilidad. Tramita los datos no retenibles y la cuenta real en Base44, revoca conexiones personales, revisa cobros y confirma al titular. Un marcado lógico no permite cerrar la solicitud.</p>
    <Button variant="outline" onClick={load}>Actualizar solicitudes</Button>
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-sm"><thead><tr className="bg-secondary"><th className="p-3 text-left">Cuenta</th><th className="p-3 text-left">Recibida</th><th className="p-3 text-left">Respuesta inicial</th><th className="p-3 text-left">Estado</th><th className="p-3">Revisar</th></tr></thead><tbody>{rows.map(row=><tr className="border-t border-border" key={row.id}><td className="p-3">{row.email}</td><td className="p-3">{new Date(row.requested_at).toLocaleDateString('es-ES')}</td><td className={`p-3 ${row.status!=='completed'&&row.due_at<new Date().toISOString()?'text-destructive':''}`}>{new Date(row.due_at).toLocaleDateString('es-ES')}</td><td className="p-3">{row.status}</td><td className="p-3"><Button variant="outline" onClick={()=>{setSelected(row);setChecks({});setNotes('');setEvidence('');setConfirmation('');setError('');}}>Abrir</Button></td></tr>)}</tbody></table>{rows.length===0&&<p className="p-5 text-muted-foreground">No hay solicitudes registradas.</p>}</div>
    {selected&&<section className="bg-card border border-border rounded-xl p-5 space-y-4"><h2 className="font-semibold break-all">{selected.reference}</h2><p>{selected.email}</p>
      {selected.status==='completed'?<p>Eliminación verificada el {new Date(selected.completed_at).toLocaleDateString('es-ES')}.</p>:<>
        <Button variant="outline" disabled={busy} onClick={()=>perform('admin_review')}>Marcar en tramitación</Button>
        <p className="text-sm">Antes de finalizar: elimina la cuenta real desde Usuarios de la app en Base44, no solo desde el marcado de baja del portal. No borres documentación contable/fiscal sin determinar su conservación. No elimines al único administrador sin transferir antes la responsabilidad.</p>
        <fieldset className="space-y-3"><legend className="font-medium mb-3">Comprobaciones de cierre</legend>{[['dataCleanup','Suprimidos o anonimizados los datos personales no sujetos a conservación.'],['oauthCleanup','Revocados accesos e integraciones personales; revisados los datos compartidos sin desconectar otras cuentas.'],['billingReview','Revisados suscripciones, contratos y cobros pendientes; comunicado su tratamiento.'],['confirmationSent','Enviada al titular la confirmación y el detalle de conservación por un canal seguro.']].map(([key,label])=><label key={key} className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={!!checks[key]} onChange={event=>setChecks(old=>({...old,[key]:event.target.checked}))}/><span>{label}</span></label>)}</fieldset>
        <label className="block text-sm">Datos conservados, fundamento y plazo aplicable<Textarea value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Indica categorías y motivos; si no se conserva nada, explícalo. No incluyas documentos ni credenciales."/></label>
        <label className="block text-sm">Evidencia de la eliminación y de la comunicación<Textarea value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder="Referencia del registro de eliminación y de la confirmación al titular, sin secretos."/></label>
        <label className="block text-sm">Escribe CERRAR ELIMINACIÓN<Input value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/></label>
        <Button disabled={busy||confirmation!=='CERRAR ELIMINACIÓN'||Object.values(checks).filter(Boolean).length!==4||notes.trim().length<20||evidence.trim().length<20} onClick={()=>perform('admin_complete')}>Verificar eliminación real y cerrar</Button>
      </>}
      <Button variant="outline" onClick={()=>setSelected(null)} disabled={busy}>Cerrar revisión</Button>
    </section>}
  </div>;
}

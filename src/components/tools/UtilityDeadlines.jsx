import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { callUtility } from './DocumentTools';
import { daysUntil, deadlinesIcs, todayLocal } from '@/lib/utilityTools.mjs';
import { downloadBlob } from '@/lib/utilityFiles';
const KINDS={certificado:'Certificado digital',seguro:'Seguro',contrato:'Contrato',renovacion:'Renovación',otro:'Otro'};
const fresh=()=>({title:'',kind:'certificado',due_date:'',remind_days:30,notes:'',status:'pending',requestKey:crypto.randomUUID()});
export default function UtilityDeadlines({company}) {
  const [rows,setRows]=useState([]),[form,setForm]=useState(fresh),[editing,setEditing]=useState(null),[showForm,setShowForm]=useState(false);
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[filter,setFilter]=useState('pending'),[date,setDate]=useState(todayLocal);
  const alive=useRef(true),lock=useRef(false),loadingRef=useRef(false);
  const load=useCallback(async()=>{
    if(!company?.id || loadingRef.current)return;
    loadingRef.current=true;if(alive.current)setLoading(true);
    try{
      const collected=[];let offset=0;
      do{
        const data=await callUtility({action:'list',companyId:company.id,offset});
        collected.push(...data.rows);offset=data.nextOffset;
        if(collected.length>=10000 && offset!=null)throw new Error('Hay más de 10.000 vencimientos. La lista no se ha cargado completa.');
      }while(offset!=null && alive.current);
      if(alive.current){setRows(collected);setError('');setDate(todayLocal());}
    }catch(e){if(alive.current)setError(e.message);}finally{loadingRef.current=false;if(alive.current)setLoading(false);}
  },[company?.id]);
  useEffect(()=>{
    alive.current=true;load();
    const timer=setInterval(load,60000);
    window.addEventListener('focus',load);
    return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('focus',load);};
  },[load]);
  const mutate=async(action)=>{
    if(lock.current)return;
    lock.current=true;setSaving(true);setError('');
    try{await action();await load();}catch(e){if(alive.current)setError(e.message);}finally{lock.current=false;if(alive.current)setSaving(false);}
  };
  const save=e=>{
    e.preventDefault();
    mutate(async()=>{
      await callUtility({action:'save',companyId:company.id,id:editing?.id || '',expectedUpdatedAt:editing?.updated_date,requestKey:form.requestKey,payload:form});
      if(alive.current){setShowForm(false);setEditing(null);setForm(fresh());}
    });
  };
  const open=row=>{setEditing(row || null);setForm(row?{...row,requestKey:crypto.randomUUID()}:fresh());setShowForm(true);};
  const pending=rows.filter(row=>row.status==='pending');
  const urgent=pending.filter(row=>daysUntil(row.due_date,date)<=row.remind_days);
  const visible=rows.filter(row=>filter==='all' || row.status===filter);
  if(!company?.id)return <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Selecciona una empresa para guardar y consultar sus vencimientos.</div>;
  return <section className="space-y-5">
    <div className="grid grid-cols-3 gap-3">{[['Pendientes',pending.length],['Vencidos',pending.filter(row=>daysUntil(row.due_date,date)<0).length],['En periodo de aviso',urgent.length]].map(([label,value])=><div className="rounded-xl border bg-card p-4" key={label}><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
    <p className="text-sm text-muted-foreground">Vencimientos compartidos solo con usuarios autorizados de {company.nombre || company.razon_social || 'esta empresa'}. Avisos en esta pantalla e importación a calendario con recordatorio; no se envían correos ni notificaciones push.</p>
    <div className="flex flex-wrap gap-3"><Button onClick={()=>open()} disabled={saving}>Nuevo vencimiento</Button><Button variant="outline" disabled={!pending.length || loading} onClick={()=>downloadBlob(deadlinesIcs(rows),'vencimientos_taxea.ics','text/calendar;charset=utf-8')}>Exportar calendario .ics</Button><Button variant="outline" onClick={load} disabled={loading}>Actualizar</Button><label className="sr-only" htmlFor="deadline-status">Estado</label><select id="deadline-status" className="rounded-md border p-2 bg-background text-sm" value={filter} onChange={e=>setFilter(e.target.value)}><option value="pending">Pendientes</option><option value="done">Completados</option><option value="all">Todos</option></select></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error} No se descarta la última lista disponible.</p>}
    {showForm && <form onSubmit={save} className="rounded-2xl border bg-card p-5 space-y-4"><h2 className="text-lg font-semibold">{editing?'Editar':'Nuevo'} vencimiento</h2><div className="grid sm:grid-cols-2 gap-4"><label className="text-sm">Título<Input required maxLength={160} value={form.title} disabled={saving} onChange={e=>setForm(current=>({...current,title:e.target.value}))} className="mt-2"/></label><label className="text-sm">Tipo<select className="block w-full rounded-md border p-2 bg-background mt-2" value={form.kind} disabled={saving} onChange={e=>setForm(current=>({...current,kind:e.target.value}))}>{Object.entries(KINDS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm">Fecha límite<Input type="date" required value={form.due_date} disabled={saving} onChange={e=>setForm(current=>({...current,due_date:e.target.value}))} className="mt-2"/></label><label className="text-sm">Avisar con días de antelación<Input type="number" required min={0} max={365} step={1} value={form.remind_days} disabled={saving} onChange={e=>setForm(current=>({...current,remind_days:e.target.value}))} className="mt-2"/></label></div><label className="block text-sm">Notas<textarea className="block w-full rounded-md border p-3 bg-background mt-2" maxLength={2000} value={form.notes} disabled={saving} onChange={e=>setForm(current=>({...current,notes:e.target.value}))}/></label><div className="flex gap-3"><Button disabled={saving || loading} type="submit">{saving?<><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Guardando…</>:'Guardar'}</Button><Button variant="outline" type="button" disabled={saving} onClick={()=>setShowForm(false)}>Cancelar</Button></div></form>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Actualizando vencimientos…</p>}
    {!loading && !visible.length && !error && <div className="rounded-2xl border bg-card p-10 text-center"><CalendarClock className="h-8 w-8 mx-auto text-muted-foreground mb-3"/><p className="text-sm text-muted-foreground">No hay vencimientos en este estado.</p></div>}
    <div className="space-y-3">{visible.map(row=>{
      const days=daysUntil(row.due_date,date),alert=row.status==='pending' && days<=row.remind_days;
      return <article key={row.id} className={'rounded-xl border bg-card p-4 '+(alert?'border-amber-300':'')}><div className="flex flex-wrap gap-3 items-center"><div className="flex-1 min-w-0"><h2 className="text-sm font-semibold break-words">{row.title}</h2><p className="text-xs text-muted-foreground mt-1">{KINDS[row.kind]} · {row.due_date} · {row.status==='done'?'Completado':days<0?'Vencido hace '+(-days)+' días':days===0?'Vence hoy':'Quedan '+days+' días'}</p>{row.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2 break-words">{row.notes}</p>}</div><Button size="sm" variant="outline" disabled={saving} aria-label={'Editar '+row.title} onClick={()=>open(row)}><Pencil className="h-4 w-4"/></Button><Button size="sm" variant="outline" disabled={saving} onClick={()=>mutate(()=>callUtility({action:'save',companyId:company.id,id:row.id,expectedUpdatedAt:row.updated_date,payload:{...row,status:row.status==='done'?'pending':'done'}}))}><Check className="h-4 w-4 mr-1"/>{row.status==='done'?'Reabrir':'Completar'}</Button><Button size="sm" variant="ghost" disabled={saving} aria-label={'Eliminar '+row.title} onClick={()=>{if(window.confirm('¿Eliminar el vencimiento «'+row.title+'»?'))mutate(()=>callUtility({action:'delete',companyId:company.id,id:row.id}));}}><Trash2 className="h-4 w-4"/></Button></div></article>;
    })}</div>
  </section>;
}

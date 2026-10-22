import { useState,useRef,useEffect } from 'react';
import { Bell, Mail, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import {savePreference} from '@/lib/optimisticPreference.mjs';

const PREFS_DEFAULT = {
  email_resumen: true,
  frecuencia_resumen: 'semanal',
  alerta_vencimientos: true,
  alerta_impuestos: true,
  alerta_duplicados: true,
  alerta_tareas: true,
  notif_push: true,
};

function Toggle({ label, desc, checked, onChange,disabled }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <button
        type="button" role="switch" aria-checked={!!checked} aria-label={label} disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative min-w-11 min-h-11 flex items-center justify-center rounded-lg flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <span aria-hidden="true" className={`relative block w-10 h-5 rounded-full transition-colors ${checked?'bg-teal':'bg-secondary'}`}><span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} /></span>
      </button>
    </div>
  );
}

export default function TabNotificaciones({ user }) {
  const initial=()=>({...PREFS_DEFAULT,...user?.notification_prefs});
  const [prefs, setPrefs] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [saving,setSaving]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(null);
  const confirmed=useRef(initial()),flight=useRef(false),identity=useRef(user?.id);
  useEffect(()=>{identity.current=user?.id;const value={...PREFS_DEFAULT,...user?.notification_prefs};confirmed.current=value;setPrefs(value);setRetry(null);setError('');setSaved(false);return()=>{identity.current=null;};},[user?.id]);

  const set = (k, v) => {if(flight.current)return;setSaved(false);setError('');setRetry(null);setPrefs(p => ({ ...p, [k]: v }));};

  const handleSave = async (next=prefs) => {
    if(flight.current||!user?.id)return;
    flight.current=true;setSaving(true);setError('');setSaved(false);
    const ownId=user.id;
    const result=await savePreference({previous:confirmed.current,next,
      optimistic:value=>setPrefs(value),
      persist:value=>base44.auth.updateMe({notification_prefs:value}),
      rollback:value=>{if(identity.current===ownId)setPrefs(value);},
    });
    flight.current=false;
    if(identity.current!==ownId)return;
    setSaving(false);
    if(result.ok){confirmed.current=result.value;setSaved(true);setRetry(null);}
    else{setRetry(next);setError('No se pudieron guardar las preferencias. Se ha restaurado la última configuración confirmada. Puedes reintentar el cambio.');}
  };

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-xl shadow-card p-6" aria-busy={saving}>
        <fieldset disabled={saving} className="min-w-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-teal-light rounded-lg flex items-center justify-center"><Bell className="w-4 h-4 text-teal" /></div>
          <div>
            <h2 className="font-jakarta font-semibold text-foreground">Preferencias de notificaciones</h2>
            <p className="text-xs text-muted-foreground">Controla qué avisos recibes y con qué frecuencia</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resumen por email</p>
          <Toggle label="Resumen periódico por email" desc="Recibe un resumen de tu actividad fiscal y contable" checked={prefs.email_resumen} onChange={v => set('email_resumen', v)} />
          {prefs.email_resumen && (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="notification-frequency" className="text-xs">Frecuencia</Label>
              <Select value={prefs.frecuencia_resumen} onValueChange={v => set('frecuencia_resumen', v)}>
                <SelectTrigger id="notification-frequency" aria-label="Frecuencia del resumen" className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diario</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensual">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Alertas fiscales</p>
          <Toggle label="Vencimientos de impuestos" desc="Aviso cuando se acerca una fecha límite" checked={prefs.alerta_vencimientos} onChange={v => set('alerta_vencimientos', v)} />
          <Toggle label="Impuestos estimados altos" desc="Cuando la cuota estimada supera umbrales" checked={prefs.alerta_impuestos} onChange={v => set('alerta_impuestos', v)} />
          <Toggle label="Detección de duplicados" desc="Si se detecta una factura o gasto duplicado" checked={prefs.alerta_duplicados} onChange={v => set('alerta_duplicados', v)} />
        </div>

        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Portal</p>
          <Toggle label="Notificaciones de tareas" desc="Nuevas tareas asignadas o vencimientos" checked={prefs.alerta_tareas} onChange={v => set('alerta_tareas', v)} />
          <Toggle label="Notificaciones en el portal" desc="Avisos internos de tu asesor y el sistema" checked={prefs.notif_push} onChange={v => set('notif_push', v)} />
        </div>

        </fieldset>
        <div role="status" aria-live="polite">{saving&&<p className="mb-3 text-sm text-muted-foreground">Guardando preferencias…</p>}{saved&&<p className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5"><CheckCircle2 className="w-4 h-4" />Preferencias guardadas.</p>}</div>
        {error&&<div role="alert" className="mb-3 text-sm text-destructive">{error}<Button variant="outline" disabled={saving} onClick={()=>handleSave(retry)}>Reintentar el cambio</Button></div>}

        <Button disabled={saving} onClick={()=>handleSave()} className="bg-teal hover:bg-teal-dark">{saving?'Guardando…':'Guardar preferencias'}</Button>
      </div>

      <div className="bg-secondary/30 border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Email de notificaciones</p>
        </div>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        <p className="text-xs text-muted-foreground mt-1">Los resúmenes y alertas se enviarán a este email.</p>
      </div>
    </div>
  );
}

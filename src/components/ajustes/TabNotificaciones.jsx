import { useState } from 'react';
import { Bell, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

const PREFS_DEFAULT = {
  email_resumen: true,
  frecuencia_resumen: 'semanal',
  alerta_vencimientos: true,
  alerta_impuestos: true,
  alerta_duplicados: true,
  alerta_tareas: true,
  notif_push: true,
};

function Toggle({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-teal' : 'bg-secondary'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

export default function TabNotificaciones({ user }) {
  const [prefs, setPrefs] = useState(PREFS_DEFAULT);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setPrefs(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    await base44.auth.updateMe({ notification_prefs: prefs });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-xl shadow-card p-6">
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
              <Label className="text-xs">Frecuencia</Label>
              <Select value={prefs.frecuencia_resumen} onValueChange={v => set('frecuencia_resumen', v)}>
                <SelectTrigger className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
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

        {saved && <div className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5"><CheckCircle2 className="w-4 h-4" />Preferencias guardadas.</div>}

        <Button onClick={handleSave} className="bg-teal hover:bg-teal-dark">Guardar preferencias</Button>
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
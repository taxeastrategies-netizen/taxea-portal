import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Clock, FileText, AlertTriangle, CheckCircle, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIPO_ICON = {
  cambio_estado:       { icon: Clock, color: 'text-blue-600 bg-blue-50' },
  documento_subido:    { icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
  documento_sustituido:{ icon: FileText, color: 'text-amber-600 bg-amber-50' },
  incidencia_creada:   { icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  incidencia_cerrada:  { icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
  expediente_creado:   { icon: Plus, color: 'text-emerald-600 bg-emerald-50' },
  expediente_cerrado:  { icon: CheckCircle, color: 'text-slate-600 bg-slate-50' },
  nota_interna:        { icon: FileText, color: 'text-slate-600 bg-slate-50' },
  presentacion_registrada: { icon: CheckCircle, color: 'text-indigo-600 bg-indigo-50' },
  legalizado:          { icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
};

const fmtDateTime = d => d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export default function MercantilHistorialTab({ expediente, user }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNota, setShowNota] = useState(false);
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.MercantilHistorial.filter({ expedienteId: expediente.id }, '-fecha', 100).catch(() => []);
    setHistorial(data || []);
    setLoading(false);
  };

  useEffect(() => { if (expediente) load(); }, [expediente.id]);

  const addNota = async () => {
    if (!nota.trim()) return;
    setSaving(true);
    await base44.entities.MercantilHistorial.create({
      expedienteId: expediente.id,
      sociedadId: expediente.sociedadId,
      fecha: new Date().toISOString(),
      usuario: user?.email || 'admin',
      accion: nota,
      tipoAccion: 'nota_interna',
    });
    setNota('');
    setShowNota(false);
    setSaving(false);
    load();
  };

  // Resumen automático del expediente
  const pendingDocs = historial.filter(h => h.accion?.toLowerCase().includes('pendiente')).length;
  const lastAction = historial[0];
  const hasIncidencia = expediente.incidenciaAbierta;

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Resumen del expediente</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-secondary/30 rounded-lg p-3">
            <p className="text-muted-foreground mb-1">Estado actual</p>
            <p className="font-semibold capitalize text-foreground">{expediente.estadoGlobal?.replace(/_/g, ' ') || 'No iniciado'}</p>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3">
            <p className="text-muted-foreground mb-1">Estado libros</p>
            <p className="font-semibold capitalize text-foreground">{expediente.estadoLibros?.replace(/_/g, ' ') || 'Pendiente'}</p>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3">
            <p className="text-muted-foreground mb-1">Estado cuentas anuales</p>
            <p className="font-semibold capitalize text-foreground">{expediente.estadoCuentas?.replace(/_/g, ' ') || 'Pendiente'}</p>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3">
            <p className="text-muted-foreground mb-1">Última acción</p>
            <p className="font-semibold text-foreground">{lastAction ? fmtDateTime(lastAction.fecha) : '—'}</p>
          </div>
          <div className={cn('col-span-2 rounded-lg p-3', hasIncidencia ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200')}>
            <p className={cn('text-xs font-medium', hasIncidencia ? 'text-red-700' : 'text-emerald-700')}>
              {hasIncidencia ? '⚠ Incidencia abierta — revisar expediente' : '✓ Sin incidencias abiertas'}
            </p>
          </div>
          {expediente.observaciones && (
            <div className="col-span-2 bg-secondary/30 rounded-lg p-3">
              <p className="text-muted-foreground mb-1">Observaciones</p>
              <p className="text-foreground">{expediente.observaciones}</p>
            </div>
          )}
        </div>
      </div>

      {/* Historial */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
          <h3 className="text-sm font-semibold text-foreground">Historial de acciones</h3>
          <Button size="sm" variant="outline" onClick={() => setShowNota(!showNota)} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" />Añadir nota
          </Button>
        </div>

        {showNota && (
          <div className="border-b border-border p-4 bg-secondary/10 space-y-2">
            <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
              className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder="Escribe una nota interna..." />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowNota(false)}>Cancelar</Button>
              <Button size="sm" onClick={addNota} disabled={saving || !nota.trim()}>{saving ? 'Guardando...' : 'Añadir nota'}</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : historial.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin actividad registrada aún.</p>
        ) : (
          <div className="divide-y divide-border">
            {historial.map((h, i) => {
              const cfg = TIPO_ICON[h.tipoAccion] || TIPO_ICON.nota_interna;
              const Icon = cfg.icon;
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', cfg.color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{h.accion}</p>
                    {h.comentario && <p className="text-xs text-muted-foreground mt-0.5 italic">{h.comentario}</p>}
                    <p className="text-[11px] text-muted-foreground mt-0.5">{h.usuario} · {fmtDateTime(h.fecha)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
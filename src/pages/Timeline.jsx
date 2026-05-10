import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Clock, FileText, CheckCircle, AlertTriangle, Info, MessageSquare, Plus, Lock } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPO_CONFIG = {
  documento_subido: { icon: FileText, color: 'bg-blue-100 text-blue-600', dot: 'bg-blue-400' },
  factura_leida_ia: { icon: Info, color: 'bg-purple-100 text-purple-600', dot: 'bg-purple-400' },
  factura_clasificada: { icon: CheckCircle, color: 'bg-teal-100 text-teal-600', dot: 'bg-teal-500' },
  documento_revisado: { icon: CheckCircle, color: 'bg-green-100 text-green-600', dot: 'bg-green-400' },
  documento_rechazado: { icon: AlertTriangle, color: 'bg-red-100 text-red-600', dot: 'bg-red-400' },
  tarea_creada: { icon: Clock, color: 'bg-amber-100 text-amber-600', dot: 'bg-amber-400' },
  tarea_completada: { icon: CheckCircle, color: 'bg-green-100 text-green-600', dot: 'bg-green-500' },
  error_detectado: { icon: AlertTriangle, color: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  error_resuelto: { icon: CheckCircle, color: 'bg-green-100 text-green-600', dot: 'bg-green-500' },
  estado_fiscal_cambiado: { icon: Info, color: 'bg-orange-100 text-orange-600', dot: 'bg-orange-400' },
  modelo_presentado: { icon: CheckCircle, color: 'bg-teal-100 text-teal-600', dot: 'bg-teal-500' },
  notificacion_enviada: { icon: MessageSquare, color: 'bg-blue-100 text-blue-600', dot: 'bg-blue-400' },
  comentario_anadido: { icon: MessageSquare, color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  health_score_actualizado: { icon: Info, color: 'bg-indigo-100 text-indigo-600', dot: 'bg-indigo-400' },
  nota_interna: { icon: MessageSquare, color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

const COLOR_DOT = {
  verde: 'bg-green-400',
  amarillo: 'bg-amber-400',
  rojo: 'bg-red-400',
  azul: 'bg-blue-400',
  gris: 'bg-slate-400',
};

export default function Timeline() {
  const { company, user, isAdmin } = useOutletContext() || {};
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: '', descripcion: '', tipo: 'nota_interna', color: 'gris', visibilidad: 'admin' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (company?.id) load(); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.TimelineEvent.filter({ company_id: company.id }, '-created_date', 100);
    setEvents(data || []);
    setLoading(false);
  };

  const addEvent = async () => {
    if (!form.titulo) return;
    setSaving(true);
    await base44.entities.TimelineEvent.create({
      ...form,
      company_id: company.id,
      usuario_email: user?.email,
      automatico: false,
    });
    setSaving(false);
    setShowForm(false);
    setForm({ titulo: '', descripcion: '', tipo: 'nota_interna', color: 'gris', visibilidad: 'admin' });
    load();
  };

  const filtered = events.filter(e => {
    const matchTipo = filterTipo === 'all' || e.tipo === filterTipo;
    const matchColor = filterColor === 'all' || e.color === filterColor;
    const matchVis = isAdmin || e.visibilidad !== 'admin';
    return matchTipo && matchColor && matchVis;
  });

  // Group by date
  const grouped = filtered.reduce((acc, ev) => {
    const date = ev.created_date ? format(new Date(ev.created_date), 'yyyy-MM-dd') : 'sin-fecha';
    if (!acc[date]) acc[date] = [];
    acc[date].push(ev);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Timeline Fiscal"
        subtitle="Historial completo de actividad y cambios en tu empresa"
      >
        {isAdmin && (
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Añadir nota
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={filterColor} onValueChange={setFilterColor}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Color" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="verde">Verde</SelectItem>
            <SelectItem value="amarillo">Amarillo</SelectItem>
            <SelectItem value="rojo">Rojo</SelectItem>
            <SelectItem value="azul">Azul</SelectItem>
            <SelectItem value="gris">Gris</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Modal nueva nota */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Añadir nota al timeline</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Resumen del evento..." />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} placeholder="Detalle adicional..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Color</Label>
                <Select value={form.color} onValueChange={v => setForm(f => ({ ...f, color: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verde">Verde</SelectItem>
                    <SelectItem value="amarillo">Amarillo</SelectItem>
                    <SelectItem value="rojo">Rojo</SelectItem>
                    <SelectItem value="azul">Azul</SelectItem>
                    <SelectItem value="gris">Gris</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Visibilidad</Label>
                <Select value={form.visibilidad} onValueChange={v => setForm(f => ({ ...f, visibilidad: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Solo admin</SelectItem>
                    <SelectItem value="ambos">Cliente y admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.visibilidad === 'admin' && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                <Lock className="w-3.5 h-3.5" />
                Esta nota solo será visible para Taxea, no para el cliente
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={addEvent} disabled={saving || !form.titulo}>{saving ? 'Guardando...' : 'Añadir nota'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-jakarta font-semibold text-foreground">Sin actividad registrada</p>
          <p className="text-sm text-muted-foreground mt-1">Los eventos aparecerán aquí conforme uses el portal</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, dayEvents]) => {
            const dateLabel = date === 'sin-fecha' ? 'Sin fecha' :
              format(new Date(date), "d 'de' MMMM, yyyy", { locale: es });
            return (
              <div key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground px-2">{dateLabel}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-3">
                  {dayEvents.map(ev => {
                    const cfg = TIPO_CONFIG[ev.tipo] || { icon: Info, color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
                    const Icon = cfg.icon;
                    const dotColor = COLOR_DOT[ev.color] || cfg.dot;
                    return (
                      <div key={ev.id} className="bg-card rounded-xl border border-border shadow-card p-4 flex items-start gap-4">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", cfg.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", dotColor)} />
                            <p className="font-medium text-sm text-foreground">{ev.titulo}</p>
                            {ev.visibilidad === 'admin' && isAdmin && (
                              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Interno</span>
                            )}
                          </div>
                          {ev.descripcion && <p className="text-xs text-muted-foreground mt-1 ml-4">{ev.descripcion}</p>}
                          {ev.usuario_email && (
                            <p className="text-xs text-muted-foreground mt-1 ml-4">Por: {ev.usuario_email}</p>
                          )}
                        </div>
                        {ev.created_date && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(ev.created_date), 'HH:mm')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
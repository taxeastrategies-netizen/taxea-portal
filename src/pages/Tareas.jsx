import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, CheckCircle, Clock, AlertTriangle, User, MoreVertical } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const ESTADOS = [
  { value: 'pendiente_cliente', label: 'Pendiente cliente', color: 'border-amber-300 bg-amber-50' },
  { value: 'pendiente_taxea', label: 'Pendiente Taxea', color: 'border-blue-300 bg-blue-50' },
  { value: 'en_revision', label: 'En revisión', color: 'border-indigo-300 bg-indigo-50' },
  { value: 'completada', label: 'Completada', color: 'border-green-300 bg-green-50' },
];

const PRIORIDAD_BADGE = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-amber-50 text-amber-700',
  alta: 'bg-orange-50 text-orange-700',
  urgente: 'bg-red-50 text-red-700',
};

const EMPTY_TAREA = {
  titulo: '',
  descripcion: '',
  fecha_limite: '',
  prioridad: 'media',
  estado: 'pendiente_cliente',
  responsable: 'cliente',
  interna: false,
};

export default function Tareas() {
  const { company, user, isAdmin } = useOutletContext() || {};
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(EMPTY_TAREA);
  const [filterEstado, setFilterEstado] = useState('all');

  useEffect(() => { if (company?.id) load(); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Task.filter({ company_id: company.id }, '-created_date');
    setTareas(data || []);
    setLoading(false);
  };

  const openNew = () => {
    setEditando(null);
    setForm({ ...EMPTY_TAREA });
    setShowDialog(true);
  };

  const openEdit = (t) => {
    setEditando(t);
    setForm({ ...t });
    setShowDialog(true);
  };

  const save = async () => {
    const data = { ...form, company_id: company.id, creada_por: user?.email };
    if (editando) {
      await base44.entities.Task.update(editando.id, data);
    } else {
      await base44.entities.Task.create(data);
      await base44.entities.TimelineEvent.create({
        company_id: company.id,
        tipo: 'tarea_creada',
        titulo: `Tarea creada: ${form.titulo}`,
        color: 'amarillo',
        usuario_email: user?.email,
        visibilidad: form.interna ? 'admin' : 'ambos',
      });
    }
    setShowDialog(false);
    load();
  };

  const cambiarEstado = async (id, estado) => {
    await base44.entities.Task.update(id, { estado });
    if (estado === 'completada') {
      const t = tareas.find(x => x.id === id);
      await base44.entities.TimelineEvent.create({
        company_id: company.id,
        tipo: 'tarea_completada',
        titulo: `Tarea completada: ${t?.titulo || ''}`,
        color: 'verde',
        usuario_email: user?.email,
        visibilidad: 'ambos',
      });
    }
    load();
  };

  const eliminar = async (id) => {
    await base44.entities.Task.delete(id);
    load();
  };

  const filtered = tareas.filter(t => {
    const matchEst = filterEstado === 'all' || t.estado === filterEstado;
    const matchVis = isAdmin || !t.interna;
    return matchEst && matchVis;
  });

  const grouped = ESTADOS.reduce((acc, est) => {
    acc[est.value] = filtered.filter(t => t.estado === est.value);
    return acc;
  }, {});

  const isVencida = (t) => t.fecha_limite && new Date(t.fecha_limite) < new Date() && t.estado !== 'completada';

  return (
    <div>
      <PageHeader
        title="Centro de Tareas"
        subtitle="Gestión de pendientes entre cliente y asesor"
        actions={
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Nueva tarea
          </Button>
        }
      />

      <div className="flex gap-3 mb-6 flex-wrap">
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {ESTADOS.map(est => (
            <div key={est.value} className={cn("rounded-xl border-2 p-4 min-h-[200px]", est.color)}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">{est.label}</p>
                <span className="text-xs bg-white/70 rounded-full px-2 py-0.5 font-medium text-muted-foreground">
                  {grouped[est.value]?.length || 0}
                </span>
              </div>
              <div className="space-y-2">
                {(grouped[est.value] || []).map(t => (
                  <div key={t.id} className={cn(
                    "bg-white rounded-lg border p-3 shadow-sm",
                    isVencida(t) ? "border-red-300" : "border-transparent"
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-snug">{t.titulo}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-0.5 rounded hover:bg-secondary text-muted-foreground flex-shrink-0">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(t)}>Editar</DropdownMenuItem>
                          {ESTADOS.filter(e => e.value !== t.estado).map(e => (
                            <DropdownMenuItem key={e.value} onClick={() => cambiarEstado(t.id, e.value)}>
                              → {e.label}
                            </DropdownMenuItem>
                          ))}
                          {isAdmin && <DropdownMenuItem className="text-destructive" onClick={() => eliminar(t.id)}>Eliminar</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {t.descripcion && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.descripcion}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", PRIORIDAD_BADGE[t.prioridad])}>
                        {t.prioridad}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" />{t.responsable === 'taxea' ? 'Taxea' : 'Cliente'}
                      </span>
                      {t.fecha_limite && (
                        <span className={cn("text-xs flex items-center gap-1", isVencida(t) ? "text-red-600 font-medium" : "text-muted-foreground")}>
                          <Clock className="w-3 h-3" />
                          {format(new Date(t.fecha_limite), 'dd/MM/yy')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Título *" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
            <Textarea placeholder="Descripción" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} className="h-20" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prioridad</label>
                <Select value={form.prioridad} onValueChange={v => setForm({ ...form, prioridad: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Responsable</label>
                <Select value={form.responsable} onValueChange={v => setForm({ ...form, responsable: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="taxea">Taxea</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fecha límite</label>
              <Input type="date" value={form.fecha_limite} onChange={e => setForm({ ...form, fecha_limite: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Estado</label>
              <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.interna} onChange={e => setForm({ ...form, interna: e.target.checked })} />
                Tarea interna (solo admin)
              </label>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button onClick={save} disabled={!form.titulo}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
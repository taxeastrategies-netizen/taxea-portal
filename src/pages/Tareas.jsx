import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, CheckCircle, Clock, AlertTriangle, MoreVertical } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const PRIORIDAD = {
  baja: { label: 'Baja', class: 'bg-slate-100 text-slate-600' },
  media: { label: 'Media', class: 'bg-amber-50 text-amber-700' },
  alta: { label: 'Alta', class: 'bg-orange-50 text-orange-700' },
  urgente: { label: 'Urgente', class: 'bg-red-50 text-red-700' },
};

const ESTADO = {
  pendiente_cliente: { label: 'Pdte. cliente', class: 'bg-amber-50 text-amber-700', icon: Clock },
  pendiente_taxea: { label: 'Pdte. Taxea', class: 'bg-blue-50 text-blue-700', icon: Clock },
  en_revision: { label: 'En revisión', class: 'bg-purple-50 text-purple-700', icon: Clock },
  bloqueada: { label: 'Bloqueada', class: 'bg-red-50 text-red-700', icon: AlertTriangle },
  completada: { label: 'Completada', class: 'bg-green-50 text-green-700', icon: CheckCircle },
  vencida: { label: 'Vencida', class: 'bg-red-100 text-red-800', icon: AlertTriangle },
  cancelada: { label: 'Cancelada', class: 'bg-slate-100 text-slate-500', icon: Clock },
};

const EMPTY = {
  titulo: '', descripcion: '', fecha_limite: '', prioridad: 'media',
  estado: 'pendiente_cliente', responsable: 'cliente', interna: false,
};

export default function Tareas() {
  const { company, user, isAdmin } = useOutletContext() || {};
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterResp, setFilterResp] = useState('all');

  useEffect(() => { if (company?.id) load(); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const query = { company_id: company.id };
    if (!isAdmin) query.interna = false;
    const data = await base44.entities.Task.filter(query, '-created_date');
    setTareas(data || []);
    setLoading(false);
  };

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (t) => { setEditing(t); setForm({ ...t }); setShowForm(true); };

  const save = async () => {
    const payload = { ...form, company_id: company.id, creada_por: user?.email };
    if (editing) {
      const prev = editing.estado;
      await base44.entities.Task.update(editing.id, payload);
      // Si cambia el estado, registrar en timeline
      if (prev !== form.estado) {
        await base44.entities.TimelineEvent.create({
          company_id: company.id,
          tipo: form.estado === 'completada' ? 'tarea_completada' : 'tarea_creada',
          titulo: `Tarea ${form.estado === 'completada' ? 'completada' : 'actualizada'}: ${form.titulo}`,
          color: form.estado === 'completada' ? 'verde' : 'azul',
          usuario_email: user?.email,
          automatico: true,
          visibilidad: form.interna ? 'admin' : 'ambos',
        });
      }
    } else {
      await base44.entities.Task.create(payload);
      // Notificar al responsable y registrar en timeline
      await base44.entities.TimelineEvent.create({
        company_id: company.id,
        tipo: 'tarea_creada',
        titulo: `Nueva tarea: ${form.titulo}`,
        descripcion: `Responsable: ${form.responsable} · Prioridad: ${form.prioridad}`,
        color: form.prioridad === 'urgente' ? 'rojo' : form.prioridad === 'alta' ? 'amarillo' : 'azul',
        usuario_email: user?.email,
        automatico: true,
        visibilidad: form.interna ? 'admin' : 'ambos',
      });
      // Crear notificación si hay responsable cliente
      if (form.responsable === 'cliente' && !form.interna) {
        await base44.entities.Notification.create({
          company_id: company.id,
          destinatario_email: company.owner_email || user?.email,
          titulo: `Nueva tarea asignada: ${form.titulo}`,
          mensaje: form.descripcion || `Prioridad: ${form.prioridad}`,
          tipo: 'tarea',
          leida: false,
        });
      }
    }
    setShowForm(false);
    load();
  };

  const updateEstado = async (id, estado) => {
    const tarea = tareas.find(t => t.id === id);
    await base44.entities.Task.update(id, { estado });
    if (estado === 'completada' && tarea) {
      await base44.entities.TimelineEvent.create({
        company_id: company.id,
        tipo: 'tarea_completada',
        titulo: `Tarea completada: ${tarea.titulo}`,
        color: 'verde',
        usuario_email: user?.email,
        automatico: true,
        visibilidad: tarea.interna ? 'admin' : 'ambos',
      });
    }
    load();
  };

  const deleteTarea = async (id) => {
    await base44.entities.Task.delete(id);
    load();
  };

  const filtered = tareas.filter(t => {
    const matchEst = filterEstado === 'all' || t.estado === filterEstado;
    const matchResp = filterResp === 'all' || t.responsable === filterResp;
    return matchEst && matchResp;
  });

  const pendientes = tareas.filter(t => !['completada', 'cancelada'].includes(t.estado)).length;
  const completadas = tareas.filter(t => t.estado === 'completada').length;
  const urgentes = tareas.filter(t => t.prioridad === 'urgente' && !['completada', 'cancelada'].includes(t.estado)).length;

  return (
    <div>
      <PageHeader
        title="Centro de Tareas"
        subtitle="Gestión de tareas y pendientes con tu asesoría"
        actions={
          <Button onClick={openNew} className="h-9 gap-2">
            <Plus className="w-4 h-4" /> Nueva tarea
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 mb-1">Pendientes</p>
          <p className="text-2xl font-jakarta font-bold text-amber-700">{pendientes}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-medium text-red-700 mb-1">Urgentes</p>
          <p className="text-2xl font-jakarta font-bold text-red-700">{urgentes}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-medium text-green-700 mb-1">Completadas</p>
          <p className="text-2xl font-jakarta font-bold text-green-700">{completadas}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(ESTADO).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterResp} onValueChange={setFilterResp}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Responsable" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="cliente">Cliente</SelectItem>
            <SelectItem value="taxea">Taxea</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="font-jakarta font-semibold text-foreground">Sin tareas pendientes</p>
          <p className="text-sm text-muted-foreground mt-1">Crea una nueva tarea para empezar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(tarea => {
            const est = ESTADO[tarea.estado] || ESTADO.pendiente_cliente;
            const pri = PRIORIDAD[tarea.prioridad] || PRIORIDAD.media;
            const EstIcon = est.icon;
            return (
              <div key={tarea.id} className="bg-card border border-border rounded-xl p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <EstIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", tarea.estado === 'completada' ? 'text-green-500' : 'text-muted-foreground')} />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={cn("font-semibold text-sm", tarea.estado === 'completada' && 'line-through text-muted-foreground')}>{tarea.titulo}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <span className={cn("text-xs px-2 py-0.5 rounded font-medium", est.class)}>{est.label}</span>
                          <span className={cn("text-xs px-2 py-0.5 rounded font-medium", pri.class)}>{pri.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">{tarea.responsable}</span>
                          {tarea.interna && isAdmin && (
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600">Interna</span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground flex-shrink-0">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(tarea)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateEstado(tarea.id, 'completada')}>Marcar completada</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateEstado(tarea.id, 'en_revision')}>En revisión</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteTarea(tarea.id)} className="text-destructive">Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {tarea.descripcion && (
                      <p className="text-sm text-muted-foreground mt-2">{tarea.descripcion}</p>
                    )}
                    {tarea.fecha_limite && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Límite: {format(new Date(tarea.fecha_limite), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Título de la tarea" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.descripcion || ''} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridad</Label>
                <Select value={form.prioridad} onValueChange={v => setForm({ ...form, prioridad: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsable</Label>
                <Select value={form.responsable} onValueChange={v => setForm({ ...form, responsable: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="taxea">Taxea</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ESTADO).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fecha límite</Label>
                <Input type="date" value={form.fecha_limite || ''} onChange={e => setForm({ ...form, fecha_limite: e.target.value })} />
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-3 py-1">
                <input type="checkbox" id="interna" checked={!!form.interna} onChange={e => setForm({ ...form, interna: e.target.checked })} className="rounded" />
                <Label htmlFor="interna" className="cursor-pointer text-sm">Tarea interna (solo visible para Taxea)</Label>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={save} disabled={!form.titulo}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
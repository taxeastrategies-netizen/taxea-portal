import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Edit2, Trash2, Loader2, X, Save, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NoCompanyState from '@/components/ui/NoCompanyState';

const STATUSES = ['backlog','pendiente_revisar','en_curso','bloqueado','pendiente_cliente','en_revision','finalizado'];
const STATUS_LABEL = { backlog: 'Backlog', pendiente_revisar: 'Por revisar', en_curso: 'En curso', bloqueado: 'Bloqueado', pendiente_cliente: 'Pdte. cliente', pendiente_tercero: 'Pdte. tercero', en_revision: 'En revisión', finalizado: 'Finalizado', archivado: 'Archivado' };
const STATUS_COLOR = { backlog: 'bg-slate-100 text-slate-600 border-slate-200', pendiente_revisar: 'bg-amber-50 text-amber-700 border-amber-200', en_curso: 'bg-blue-50 text-blue-700 border-blue-200', bloqueado: 'bg-red-50 text-red-700 border-red-200', pendiente_cliente: 'bg-purple-50 text-purple-700 border-purple-200', en_revision: 'bg-indigo-50 text-indigo-700 border-indigo-200', finalizado: 'bg-emerald-50 text-emerald-700 border-emerald-200', archivado: 'bg-slate-50 text-slate-400 border-slate-100' };
const PRIORITY_COLOR = { critica: 'text-red-600', alta: 'text-orange-500', media: 'text-amber-500', baja: 'text-slate-400' };
const PRIORITY_BG = { critica: 'bg-red-50 text-red-700 border-red-200', alta: 'bg-orange-50 text-orange-700 border-orange-200', media: 'bg-amber-50 text-amber-700 border-amber-200', baja: 'bg-slate-50 text-slate-600 border-slate-200' };

const EMPTY = { title: '', description: '', status: 'backlog', priority: 'media', assignee_name: '', assignee_email: '', department: '', due_date: '', estimated_hours: '', tags: [], impact_fiscal: false, impact_accounting: false, impact_financial: false, impact_legal: false, impact_notes: '', notes: '' };

export default function OperationsTaskManager() {
  const { company, user } = useOutletContext() || {};
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const t = await base44.entities.OpsTask.filter({ company_id: company.id }, '-created_date', 300);
    setTasks(t || []);
    setLoading(false);
  };

  const openCreate = (status = 'backlog') => { setForm({ ...EMPTY, status }); setEditing(null); setShowForm(true); };
  const openEdit = (t) => {
    setForm({ title: t.title || '', description: t.description || '', status: t.status || 'backlog', priority: t.priority || 'media', assignee_name: t.assignee_name || '', assignee_email: t.assignee_email || '', department: t.department || '', due_date: t.due_date || '', estimated_hours: t.estimated_hours ?? '', tags: t.tags || [], impact_fiscal: t.impact_fiscal || false, impact_accounting: t.impact_accounting || false, impact_financial: t.impact_financial || false, impact_legal: t.impact_legal || false, impact_notes: t.impact_notes || '', notes: t.notes || '' });
    setEditing(t.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('El título es obligatorio'); return; }
    setSaving(true);
    const data = { ...form, company_id: company.id, estimated_hours: parseFloat(form.estimated_hours) || 0 };
    if (editing) await base44.entities.OpsTask.update(editing, data);
    else await base44.entities.OpsTask.create(data);
    toast.success(editing ? 'Tarea actualizada' : 'Tarea creada');
    setSaving(false); setShowForm(false); load();
  };

  if (!company) return <NoCompanyState pageName="Tareas" />;

  const today = new Date().toISOString().split('T')[0];
  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (search && !t.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-jakarta">Gestor de tareas</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} tareas · {tasks.filter(t => t.status === 'en_curso').length} en curso</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden">
            {[{ id: 'kanban', icon: LayoutGrid }, { id: 'list', icon: List }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} className={cn('px-3 py-1.5 transition-colors', view === v.id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}>
                <v.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => openCreate()} className="bg-primary hover:bg-primary/90 gap-1.5">
            <Plus className="w-3.5 h-3.5" />Nueva tarea
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar tarea..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos los estados</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todas las prioridades</option>
          {['critica','alta','media','baja'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : view === 'kanban' ? (
        <KanbanView tasks={filtered} onEdit={openEdit} onAdd={openCreate} today={today} />
      ) : (
        <ListView tasks={filtered} onEdit={openEdit} onDelete={async (id) => { await base44.entities.OpsTask.delete(id); load(); }} today={today} />
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end">
          <div className="w-full max-w-lg h-full bg-card shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-sm">{editing ? 'Editar tarea' : 'Nueva tarea'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Título *</label><Input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} className="h-9 text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                {[['status','Estado', STATUSES.map(s => ({value:s,label:STATUS_LABEL[s]}))],['priority','Prioridad',['critica','alta','media','baja'].map(p=>({value:p,label:p}))]].map(([k, l, opts]) => (
                  <div key={k}><label className="text-xs font-medium text-muted-foreground block mb-1">{l}</label>
                    <select value={form[k]} onChange={e => setForm(p => ({...p, [k]: e.target.value}))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
                {[['assignee_name','Responsable'],['assignee_email','Email responsable'],['department','Departamento'],['due_date','Fecha límite'],['estimated_hours','Horas estimadas']].map(([k, l]) => (
                  <div key={k}><label className="text-xs font-medium text-muted-foreground block mb-1">{l}</label><Input type={k === 'due_date' ? 'date' : k === 'estimated_hours' ? 'number' : 'text'} value={form[k]} onChange={e => setForm(p => ({...p, [k]: e.target.value}))} className="h-9 text-sm" /></div>
                ))}
              </div>
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Notas</label><Input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="h-9 text-sm" /></div>
              <div className="border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Impacto Taxea</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['impact_fiscal','Fiscal'],['impact_accounting','Contable'],['impact_financial','Financiero'],['impact_legal','Legal']].map(([n, l]) => (
                    <label key={n} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={form[n]} onChange={e => setForm(p => ({...p, [n]: e.target.checked}))} className="rounded" />{l}
                    </label>
                  ))}
                </div>
                {(form.impact_fiscal || form.impact_accounting || form.impact_financial || form.impact_legal) && (
                  <Input placeholder="Describe el impacto..." value={form.impact_notes} onChange={e => setForm(p => ({...p, impact_notes: e.target.value}))} className="h-8 text-xs" />
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {editing ? 'Guardar' : 'Crear tarea'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanView({ tasks, onEdit, onAdd, today }) {
  const COLS = ['backlog','en_curso','bloqueado','en_revision','finalizado'];
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLS.map(status => {
        const col = tasks.filter(t => t.status === status);
        return (
          <div key={status} className="flex-shrink-0 w-64">
            <div className="flex items-center justify-between mb-2">
              <span className={cn('text-xs font-semibold px-2 py-1 rounded-full border', STATUS_COLOR[status])}>{STATUS_LABEL[status]} ({col.length})</span>
              <button onClick={() => onAdd(status)} className="text-muted-foreground hover:text-foreground"><Plus className="w-3.5 h-3.5" /></button>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {col.map(t => <TaskCard key={t.id} task={t} onEdit={onEdit} today={today} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task, onEdit, today }) {
  const isOverdue = task.due_date && task.due_date < today && task.status !== 'finalizado';
  const hasImpact = task.impact_fiscal || task.impact_accounting || task.impact_financial || task.impact_legal;
  return (
    <div onClick={() => onEdit(task)} className={cn('bg-card border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all', isOverdue ? 'border-red-200' : 'border-border')}>
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
        <span className={cn('text-[10px] font-bold flex-shrink-0', PRIORITY_COLOR[task.priority])}>{task.priority?.[0]?.toUpperCase()}</span>
      </div>
      {task.assignee_name && <p className="text-xs text-muted-foreground mb-1">{task.assignee_name}</p>}
      <div className="flex items-center gap-2 flex-wrap">
        {task.due_date && <span className={cn('text-[10px] font-medium', isOverdue ? 'text-red-600' : 'text-muted-foreground')}>{task.due_date}</span>}
        {hasImpact && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">⚡ impacto</span>}
        {task.status === 'bloqueado' && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">🔒 bloqueado</span>}
      </div>
    </div>
  );
}

function ListView({ tasks, onEdit, onDelete, today }) {
  if (!tasks.length) return <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">Sin tareas que mostrar</div>;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-secondary/30">
          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Tarea</th>
          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Estado</th>
          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Prioridad</th>
          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Responsable</th>
          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Vence</th>
          <th className="px-4 py-3"></th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {tasks.map(t => {
            const isOverdue = t.due_date && t.due_date < today && t.status !== 'finalizado';
            const hasImpact = t.impact_fiscal || t.impact_accounting || t.impact_financial || t.impact_legal;
            return (
              <tr key={t.id} className="hover:bg-secondary/20">
                <td className="px-4 py-2.5">
                  <p className="font-medium flex items-center gap-2">{t.title}{hasImpact && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">⚡</span>}</p>
                  {t.department && <p className="text-xs text-muted-foreground">{t.department}</p>}
                </td>
                <td className="px-4 py-2.5 hidden md:table-cell">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium border', STATUS_COLOR[t.status] || 'bg-slate-100 text-slate-600')}>{STATUS_LABEL[t.status] || t.status}</span>
                </td>
                <td className={cn('px-4 py-2.5 text-xs font-semibold hidden md:table-cell', PRIORITY_COLOR[t.priority])}>{t.priority}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">{t.assignee_name || '—'}</td>
                <td className={cn('px-4 py-2.5 text-xs hidden lg:table-cell', isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground')}>{t.due_date || '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => onEdit(t)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onDelete(t.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
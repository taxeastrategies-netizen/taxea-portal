import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Folder, Loader2, X, Save, Edit2, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NoCompanyState from '@/components/ui/NoCompanyState';

const STATUS_COLOR = { idea: 'bg-slate-100 text-slate-600', planificacion: 'bg-amber-100 text-amber-700', activo: 'bg-blue-100 text-blue-700', en_pausa: 'bg-orange-100 text-orange-700', finalizado: 'bg-emerald-100 text-emerald-700', cancelado: 'bg-red-100 text-red-700' };
const RISK_COLOR = { bajo: 'text-emerald-600', medio: 'text-amber-600', alto: 'text-red-600', critico: 'text-red-700 font-bold' };
const EMPTY = { name: '', description: '', status: 'planificacion', priority: 'media', owner_name: '', department: '', client_name: '', start_date: '', end_date: '', estimated_budget: '', revenue: '', progress: '0', risk_level: 'bajo', notes: '' };

export default function OperationsProjects() {
  const { company, user } = useOutletContext() || {};
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const [p, t] = await Promise.all([
      base44.entities.OpsProject.filter({ company_id: company.id }),
      base44.entities.OpsTask.filter({ company_id: company.id }),
    ]);
    setProjects(p || []);
    setTasks(t || []);
    setLoading(false);
  };

  const openEdit = (p) => {
    setForm({ name: p.name || '', description: p.description || '', status: p.status || 'planificacion', priority: p.priority || 'media', owner_name: p.owner_name || '', department: p.department || '', client_name: p.client_name || '', start_date: p.start_date || '', end_date: p.end_date || '', estimated_budget: p.estimated_budget ?? '', revenue: p.revenue ?? '', progress: p.progress ?? '0', risk_level: p.risk_level || 'bajo', notes: p.notes || '' });
    setEditing(p.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const data = { ...form, company_id: company.id, estimated_budget: parseFloat(form.estimated_budget) || 0, revenue: parseFloat(form.revenue) || 0, progress: parseInt(form.progress) || 0 };
    if (editing) await base44.entities.OpsProject.update(editing, data);
    else await base44.entities.OpsProject.create(data);
    toast.success(editing ? 'Proyecto actualizado' : 'Proyecto creado');
    setSaving(false); setShowForm(false); setEditing(null); load();
  };

  if (!company) return <NoCompanyState pageName="Proyectos" />;

  const filtered = projects.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client_name?.toLowerCase().includes(search.toLowerCase()));

  const F = ({ label, name, type = 'text', options }) => (
    <div><label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      {options ? (
        <select value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : <Input type={type} value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))} className="h-9 text-sm" />}
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold font-jakarta">Proyectos operativos</h1><p className="text-sm text-muted-foreground">{projects.length} proyectos · {projects.filter(p => p.status === 'activo').length} activos</p></div>
        <Button size="sm" onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90 gap-1.5"><Plus className="w-3.5 h-3.5" />Nuevo proyecto</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar proyecto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-3 bg-card border border-border rounded-xl p-10 text-center">
              <Folder className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="font-semibold">Sin proyectos</p>
              <p className="text-sm text-muted-foreground mt-1">Crea el primer proyecto operativo</p>
              <Button onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }} className="mt-4" size="sm"><Plus className="w-4 h-4 mr-1" />Nuevo proyecto</Button>
            </div>
          ) : filtered.map(p => {
            const projTasks = tasks.filter(t => t.project_id === p.id);
            const completedTasks = projTasks.filter(t => t.status === 'finalizado');
            const margin = p.revenue > 0 && p.actual_cost > 0 ? ((p.revenue - p.actual_cost) / p.revenue * 100) : null;
            return (
              <div key={p.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer" onClick={() => setSelected(selected?.id === p.id ? null : p)}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    {p.client_name && <p className="text-xs text-muted-foreground">{p.client_name}</p>}
                  </div>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', STATUS_COLOR[p.status] || 'bg-slate-100 text-slate-600')}>{p.status?.replace('_', ' ')}</span>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Progreso</span><span className="font-semibold">{p.progress || 0}%</span></div>
                  <div className="w-full h-1.5 bg-secondary rounded-full"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${p.progress || 0}%` }} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Responsable</p><p className="font-medium truncate">{p.owner_name || '—'}</p></div>
                  <div><p className="text-muted-foreground">Vence</p><p className={cn('font-medium', p.end_date && p.end_date < new Date().toISOString().split('T')[0] ? 'text-red-600' : '')}>{p.end_date || '—'}</p></div>
                  <div><p className="text-muted-foreground">Tareas</p><p className="font-medium">{completedTasks.length}/{projTasks.length}</p></div>
                  <div><p className="text-muted-foreground">Riesgo</p><p className={cn('font-semibold', RISK_COLOR[p.risk_level])}>{p.risk_level}</p></div>
                </div>
                {margin !== null && (
                  <div className={cn('mt-3 p-2 rounded-lg text-xs text-center font-medium', margin < 0 ? 'bg-red-50 text-red-700' : margin < 20 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
                    Margen: {margin.toFixed(1)}%
                  </div>
                )}
                <div className="flex gap-1 mt-3 pt-3 border-t border-border" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)} className="flex-1 h-7 text-xs gap-1"><Edit2 className="w-3 h-3" />Editar</Button>
                  <Button size="sm" variant="outline" onClick={async () => { await base44.entities.OpsProject.delete(p.id); load(); }} className="h-7 text-xs text-red-600 hover:bg-red-50"><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end">
          <div className="w-full max-w-lg h-full bg-card shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-sm">{editing ? 'Editar proyecto' : 'Nuevo proyecto'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-3">
              <F label="Nombre del proyecto *" name="name" />
              <div className="grid grid-cols-2 gap-3">
                <F label="Estado" name="status" options={['idea','planificacion','activo','en_pausa','finalizado','cancelado'].map(s => ({ value: s, label: s.replace('_', ' ') }))} />
                <F label="Prioridad" name="priority" options={['critica','alta','media','baja'].map(p => ({ value: p, label: p }))} />
                <F label="Responsable" name="owner_name" />
                <F label="Departamento" name="department" />
                <F label="Cliente / empresa" name="client_name" />
                <F label="Nivel de riesgo" name="risk_level" options={['bajo','medio','alto','critico'].map(r => ({ value: r, label: r }))} />
                <F label="Fecha inicio" name="start_date" type="date" />
                <F label="Fecha fin" name="end_date" type="date" />
                <F label="Presupuesto estimado (€)" name="estimated_budget" type="number" />
                <F label="Ingresos esperados (€)" name="revenue" type="number" />
                <F label="Progreso (%)" name="progress" type="number" />
              </div>
              <F label="Descripción / notas" name="notes" />
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{editing ? 'Guardar' : 'Crear proyecto'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
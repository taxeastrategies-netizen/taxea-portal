import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, TrendingUp, Loader2, X, Save, Sparkles, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NoCompanyState from '@/components/ui/NoCompanyState';

const STATUSES = ['idea','validacion','aprobado','en_desarrollo','en_pruebas','implementado','medicion','descartado'];
const STATUS_COLOR = { idea: 'bg-slate-100 text-slate-600', validacion: 'bg-amber-100 text-amber-700', aprobado: 'bg-blue-100 text-blue-700', en_desarrollo: 'bg-indigo-100 text-indigo-700', en_pruebas: 'bg-purple-100 text-purple-700', implementado: 'bg-emerald-100 text-emerald-700', medicion: 'bg-teal-100 text-teal-700', descartado: 'bg-red-100 text-red-700' };
const IMPACT_COLOR = { alto: 'text-emerald-600 bg-emerald-50', medio: 'text-amber-600 bg-amber-50', bajo: 'text-slate-500 bg-slate-50' };
const EFFORT_COLOR = { alto: 'text-red-600', medio: 'text-amber-600', bajo: 'text-emerald-600' };
const QUARTERS = ['Q1 2026','Q2 2026','Q3 2026','Q4 2026','Q1 2027','Q2 2027','Q3 2027','Q4 2027'];
const EMPTY = { title: '', description: '', status: 'idea', priority: 'media', department: '', target_quarter: 'Q3 2026', target_year: 2026, estimated_impact: 'medio', estimated_effort: 'medio', economic_impact: '', affected_clients: '', notes: '' };

export default function OperationsRoadmap() {
  const { company } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [prioritizing, setPrioritizing] = useState(false);
  const [groupBy, setGroupBy] = useState('status');

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);
  const load = async () => { setLoading(true); const data = await base44.entities.OpsRoadmapItem.filter({ company_id: company.id }, '-created_date'); setItems(data || []); setLoading(false); };

  const openEdit = (item) => {
    setForm({ title: item.title || '', description: item.description || '', status: item.status || 'idea', priority: item.priority || 'media', department: item.department || '', target_quarter: item.target_quarter || 'Q3 2026', target_year: item.target_year || 2026, estimated_impact: item.estimated_impact || 'medio', estimated_effort: item.estimated_effort || 'medio', economic_impact: item.economic_impact ?? '', affected_clients: item.affected_clients ?? '', notes: item.notes || '' });
    setEditing(item.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('El título es obligatorio'); return; }
    setSaving(true);
    const data = { ...form, company_id: company.id, economic_impact: parseFloat(form.economic_impact) || 0, affected_clients: parseInt(form.affected_clients) || 0, target_year: parseInt(form.target_year) || 2026 };
    if (editing) await base44.entities.OpsRoadmapItem.update(editing, data);
    else await base44.entities.OpsRoadmapItem.create(data);
    toast.success(editing ? 'Actualizado' : 'Iniciativa creada');
    setSaving(false); setShowForm(false); setEditing(null); load();
  };

  const prioritizeAI = async () => {
    setPrioritizing(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto en gestión de operaciones y roadmaps de producto. Analiza estas ${items.length} iniciativas del roadmap y proporciona una priorización comentada. Para cada una indica si debe subir, bajar o mantener prioridad y por qué. Sé muy concreto y accionable. Iniciativas: ${items.map(i => `- ${i.title}: impacto ${i.estimated_impact}, esfuerzo ${i.estimated_effort}, estado ${i.status}, clientes afectados ${i.affected_clients || 0}, impacto económico ${i.economic_impact || 0}€`).join('\n')}`,
    });
    toast.success('Análisis IA completado');
    // Show result in a simple way
    alert(typeof result === 'string' ? result : result?.response || 'Ver consola');
    setPrioritizing(false);
  };

  if (!company) return <NoCompanyState pageName="Roadmap" />;

  const grouped = groupBy === 'status'
    ? STATUSES.reduce((acc, s) => { acc[s] = items.filter(i => i.status === s); return acc; }, {})
    : QUARTERS.reduce((acc, q) => { acc[q] = items.filter(i => i.target_quarter === q); return acc; }, {});

  const F = ({ label, name, type = 'text', options }) => (
    <div><label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
      {options ? <select value={form[name]} onChange={e => setForm(p => ({...p, [name]: e.target.value}))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      : <Input type={type} value={form[name]} onChange={e => setForm(p => ({...p, [name]: e.target.value}))} className="h-9 text-sm" />}
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold font-jakarta">Roadmap operativo</h1><p className="text-sm text-muted-foreground">{items.length} iniciativas · {items.filter(i => ['aprobado','en_desarrollo'].includes(i.status)).length} en marcha</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={prioritizeAI} disabled={prioritizing || items.length === 0} className="gap-1.5">
            {prioritizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}IA priorizar
          </Button>
          <Button size="sm" onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90 gap-1.5"><Plus className="w-3.5 h-3.5" />Nueva iniciativa</Button>
        </div>
      </div>

      <div className="flex gap-2">
        {[{ id: 'status', label: 'Por estado' }, { id: 'quarter', label: 'Por trimestre' }].map(g => (
          <button key={g.id} onClick={() => setGroupBy(g.id)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', groupBy === g.id ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground')}>{g.label}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {Object.entries(grouped).filter(([, v]) => v.length > 0 || groupBy === 'status').map(([group, groupItems]) => (
            <div key={group} className="flex-shrink-0 w-64">
              <div className="flex items-center justify-between mb-2">
                <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', groupBy === 'status' ? (STATUS_COLOR[group] || 'bg-slate-100 text-slate-600') : 'bg-blue-50 text-blue-700')}>
                  {group.replace('_', ' ')} ({groupItems.length})
                </span>
                {groupBy === 'status' && <button onClick={() => { setForm({...EMPTY, status: group}); setEditing(null); setShowForm(true); }} className="text-muted-foreground hover:text-foreground"><Plus className="w-3.5 h-3.5" /></button>}
              </div>
              <div className="space-y-2">
                {groupItems.map(item => (
                  <div key={item.id} className="bg-card border border-border rounded-xl p-3 hover:shadow-sm transition-all">
                    <p className="text-sm font-medium mb-2 leading-snug">{item.title}</p>
                    <div className="flex gap-1 flex-wrap mb-2">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', IMPACT_COLOR[item.estimated_impact] || IMPACT_COLOR.medio)}>impacto {item.estimated_impact}</span>
                      <span className={cn('text-[10px] font-semibold', EFFORT_COLOR[item.estimated_effort])}>esfuerzo {item.estimated_effort}</span>
                    </div>
                    {item.affected_clients > 0 && <p className="text-[10px] text-muted-foreground mb-1">{item.affected_clients} clientes afectados</p>}
                    {item.target_quarter && <p className="text-[10px] text-muted-foreground">{item.target_quarter}</p>}
                    <div className="flex gap-1 mt-2 pt-2 border-t border-border">
                      <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={async () => { await base44.entities.OpsRoadmapItem.delete(item.id); load(); }} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                {groupItems.length === 0 && <div className="border border-dashed border-border rounded-xl p-4 text-center text-xs text-muted-foreground">Sin iniciativas</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end">
          <div className="w-full max-w-lg h-full bg-card shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-sm">{editing ? 'Editar iniciativa' : 'Nueva iniciativa'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-3">
              <F label="Título *" name="title" />
              <F label="Descripción" name="description" />
              <div className="grid grid-cols-2 gap-3">
                <F label="Estado" name="status" options={STATUSES.map(s => ({ value: s, label: s.replace('_', ' ') }))} />
                <F label="Prioridad" name="priority" options={['critica','alta','media','baja'].map(p => ({ value: p, label: p }))} />
                <F label="Impacto estimado" name="estimated_impact" options={[{value:'alto',label:'Alto'},{value:'medio',label:'Medio'},{value:'bajo',label:'Bajo'}]} />
                <F label="Esfuerzo estimado" name="estimated_effort" options={[{value:'alto',label:'Alto'},{value:'medio',label:'Medio'},{value:'bajo',label:'Bajo'}]} />
                <F label="Trimestre objetivo" name="target_quarter" options={QUARTERS.map(q => ({ value: q, label: q }))} />
                <F label="Departamento" name="department" />
                <F label="Impacto económico (€)" name="economic_impact" type="number" />
                <F label="Clientes afectados" name="affected_clients" type="number" />
              </div>
              <F label="Notas" name="notes" />
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{editing ? 'Guardar' : 'Crear iniciativa'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
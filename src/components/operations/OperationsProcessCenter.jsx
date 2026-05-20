import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Zap, Loader2, X, Save, Edit2, Trash2, Search, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NoCompanyState from '@/components/ui/NoCompanyState';

const CAT_COLOR = { cliente: 'bg-blue-100 text-blue-700', fiscal: 'bg-red-100 text-red-700', contable: 'bg-purple-100 text-purple-700', rrhh: 'bg-pink-100 text-pink-700', operativo: 'bg-emerald-100 text-emerald-700', comercial: 'bg-amber-100 text-amber-700', legal: 'bg-slate-100 text-slate-700', financiero: 'bg-indigo-100 text-indigo-700', otro: 'bg-gray-100 text-gray-700' };
const RISK_COLOR = { bajo: 'text-emerald-600', medio: 'text-amber-600', alto: 'text-red-600' };
const EMPTY = { name: '', description: '', category: 'operativo', status: 'activo', owner_email: '', estimated_duration_days: '', risk_level: 'bajo', notes: '' };

const PROCESS_TEMPLATES = [
  { name: 'Alta de cliente', category: 'cliente', description: 'Proceso completo de incorporación de un nuevo cliente', phases: ['Solicitud', 'Documentación', 'Verificación', 'Contrato', 'Onboarding', 'Activación'], risk_level: 'medio' },
  { name: 'Cierre mensual', category: 'contable', description: 'Revisión y cierre de contabilidad mensual', phases: ['Recopilación facturas', 'Revisión movimientos', 'Conciliación bancaria', 'Generación informes', 'Validación'], risk_level: 'alto' },
  { name: 'Preparación modelo fiscal', category: 'fiscal', description: 'Proceso de preparación y envío de modelos fiscales', phases: ['Recopilación datos', 'Cálculo impuesto', 'Revisión', 'Presentación', 'Justificante'], risk_level: 'alto' },
  { name: 'Revisión de facturas pendientes', category: 'contable', description: 'Control mensual de facturas pendientes de cobro', phases: ['Listado pendientes', 'Contacto cliente', 'Seguimiento', 'Cierre'], risk_level: 'medio' },
  { name: 'Incorporación empleado', category: 'rrhh', description: 'Proceso de onboarding de nuevo empleado', phases: ['Firma contrato', 'Alta SS', 'Accesos sistemas', 'Formación', 'Asignación tareas'], risk_level: 'medio' },
];

export default function OperationsProcessCenter() {
  const { company, user } = useOutletContext() || {};
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);
  const load = async () => { setLoading(true); const data = await base44.entities.OpsProcess.filter({ company_id: company.id }); setProcesses(data || []); setLoading(false); };

  const openEdit = (p) => { setForm({ name: p.name || '', description: p.description || '', category: p.category || 'operativo', status: p.status || 'activo', owner_email: p.owner_email || '', estimated_duration_days: p.estimated_duration_days ?? '', risk_level: p.risk_level || 'bajo', notes: p.notes || '' }); setEditing(p.id); setShowForm(true); };

  const applyTemplate = async (tpl) => {
    await base44.entities.OpsProcess.create({
      ...tpl,
      company_id: company.id,
      status: 'activo',
      phases: (tpl.phases || []).map((ph, i) => ({ id: i, name: ph, order: i + 1, completed: false })),
      estimated_duration_days: 5,
      execution_count: 0,
    });
    toast.success(`Proceso "${tpl.name}" creado desde plantilla`);
    setShowTemplates(false);
    load();
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const data = { ...form, company_id: company.id, estimated_duration_days: parseFloat(form.estimated_duration_days) || 1 };
    if (editing) await base44.entities.OpsProcess.update(editing, data);
    else await base44.entities.OpsProcess.create(data);
    toast.success(editing ? 'Proceso actualizado' : 'Proceso creado');
    setSaving(false); setShowForm(false); setEditing(null); load();
  };

  const executeProcess = async (p) => {
    await base44.entities.OpsProcess.update(p.id, { execution_count: (p.execution_count || 0) + 1, last_executed: new Date().toISOString().split('T')[0] });
    // Generate tasks from phases
    if (p.phases?.length) {
      for (const phase of p.phases) {
        await base44.entities.OpsTask.create({ company_id: company.id, title: `[${p.name}] ${phase.name || phase}`, status: 'backlog', priority: 'media', process_id: p.id });
      }
      toast.success(`Proceso ejecutado: ${p.phases.length} tareas generadas`);
    } else {
      toast.success('Proceso ejecutado');
    }
    load();
  };

  if (!company) return <NoCompanyState pageName="Procesos" />;

  const filtered = processes.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold font-jakarta">Centro de procesos</h1><p className="text-sm text-muted-foreground">{processes.length} procesos definidos</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(!showTemplates)}>Plantillas</Button>
          <Button size="sm" onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90 gap-1.5"><Plus className="w-3.5 h-3.5" />Nuevo proceso</Button>
        </div>
      </div>

      {showTemplates && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold">Plantillas de procesos</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PROCESS_TEMPLATES.map((t, i) => (
              <div key={i} className="border border-border rounded-xl p-3 hover:bg-secondary/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium">{t.name}</p>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', CAT_COLOR[t.category])}>{t.category}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{t.description}</p>
                <p className="text-xs text-muted-foreground mb-3">{t.phases?.length} fases</p>
                <Button size="sm" variant="outline" onClick={() => applyTemplate(t)} className="w-full h-7 text-xs gap-1"><Plus className="w-3 h-3" />Usar plantilla</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar proceso..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <Zap className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="font-semibold">Sin procesos definidos</p>
              <p className="text-sm text-muted-foreground mt-1">Crea procesos repetibles o usa una plantilla</p>
            </div>
          ) : filtered.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-secondary/20" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{p.name}</p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', CAT_COLOR[p.category] || 'bg-slate-100 text-slate-600')}>{p.category}</span>
                    {p.risk_level !== 'bajo' && <span className={cn('text-[10px] font-semibold', RISK_COLOR[p.risk_level])}>⚠ riesgo {p.risk_level}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.execution_count || 0} ejecuciones · {p.last_executed ? `Última: ${p.last_executed}` : 'Sin ejecutar'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); executeProcess(p); }} className="h-7 text-xs gap-1"><Play className="w-3 h-3" />Ejecutar</Button>
                  <button onClick={e => { e.stopPropagation(); openEdit(p); }} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={e => { e.stopPropagation(); base44.entities.OpsProcess.delete(p.id).then(load); }} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  {expanded === p.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
              {expanded === p.id && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                  {p.phases?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">FASES</p>
                      <div className="flex flex-wrap gap-2">
                        {p.phases.map((ph, i) => <span key={i} className="text-xs bg-secondary px-2 py-1 rounded-full">{i + 1}. {ph.name || ph}</span>)}
                      </div>
                    </div>
                  )}
                  {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-sm">{editing ? 'Editar proceso' : 'Nuevo proceso'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3 overflow-auto">
              {[['name','Nombre *'],['description','Descripción'],['owner_email','Responsable (email)'],['estimated_duration_days','Duración estimada (días)'],['notes','Notas']].map(([k, l]) => (
                <div key={k}><label className="text-xs font-medium text-muted-foreground block mb-1">{l}</label><Input value={form[k]} onChange={e => setForm(p => ({...p, [k]: e.target.value}))} className="h-9 text-sm" /></div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                {[['category','Categoría',[...Object.keys(CAT_COLOR).map(c => ({value:c,label:c}))]],['risk_level','Nivel riesgo',[{value:'bajo',label:'Bajo'},{value:'medio',label:'Medio'},{value:'alto',label:'Alto'}]]].map(([k, l, opts]) => (
                  <div key={k}><label className="text-xs font-medium text-muted-foreground block mb-1">{l}</label>
                    <select value={form[k]} onChange={e => setForm(p => ({...p, [k]: e.target.value}))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{editing ? 'Guardar' : 'Crear proceso'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
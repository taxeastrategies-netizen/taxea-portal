import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Shield, Loader2, X, Save, Edit2, Trash2, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NoCompanyState from '@/components/ui/NoCompanyState';

const SEVERITY_COLOR = { bajo: 'bg-emerald-100 text-emerald-700 border-emerald-200', medio: 'bg-amber-100 text-amber-700 border-amber-200', alto: 'bg-orange-100 text-orange-700 border-orange-200', critico: 'bg-red-100 text-red-700 border-red-200' };
const STATUS_COLOR = { identificado: 'bg-slate-100 text-slate-600', en_seguimiento: 'bg-blue-100 text-blue-700', mitigado: 'bg-emerald-100 text-emerald-700', aceptado: 'bg-amber-100 text-amber-700', cerrado: 'bg-slate-50 text-slate-400' };
const CAT_LABEL = { operativo:'Operativo', fiscal:'Fiscal', legal:'Legal', financiero:'Financiero', rrhh:'RRHH', tecnologico:'Tecnológico', reputacional:'Reputacional', cumplimiento:'Cumplimiento', otro:'Otro' };
const STATUSES = ['identificado','en_seguimiento','mitigado','aceptado','cerrado'];
const EMPTY = { title:'', description:'', category:'operativo', probability:'media', impact:'medio', severity:'medio', status:'identificado', owner_name:'', mitigation_plan:'', contingency_plan:'', review_date:'', economic_impact:'', notes:'' };

function calcSeverity(probability, impact) {
  const probMap = { muy_baja: 1, baja: 2, media: 3, alta: 4, muy_alta: 5 };
  const impMap = { muy_bajo: 1, bajo: 2, medio: 3, alto: 4, muy_alto: 5 };
  const score = (probMap[probability] || 3) * (impMap[impact] || 3);
  if (score >= 16) return 'critico';
  if (score >= 9) return 'alto';
  if (score >= 4) return 'medio';
  return 'bajo';
}

export default function OperationsRisks() {
  const { company } = useOutletContext() || {};
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);
  const load = async () => { setLoading(true); const d = await base44.entities.OpsRisk.filter({ company_id: company.id }, '-created_date'); setRisks(d || []); setLoading(false); };

  const openEdit = (r) => {
    setForm({ title:r.title||'', description:r.description||'', category:r.category||'operativo', probability:r.probability||'media', impact:r.impact||'medio', severity:r.severity||'medio', status:r.status||'identificado', owner_name:r.owner_name||'', mitigation_plan:r.mitigation_plan||'', contingency_plan:r.contingency_plan||'', review_date:r.review_date||'', economic_impact:r.economic_impact||'', notes:r.notes||'' });
    setEditing(r.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('El título es obligatorio'); return; }
    setSaving(true);
    const severity = calcSeverity(form.probability, form.impact);
    const data = { ...form, company_id: company.id, severity, economic_impact: parseFloat(form.economic_impact) || 0 };
    if (editing) await base44.entities.OpsRisk.update(editing, data);
    else await base44.entities.OpsRisk.create(data);
    toast.success(editing ? 'Riesgo actualizado' : 'Riesgo registrado');
    setSaving(false); setShowForm(false); setEditing(null); load();
  };

  const analyzeRisks = async () => {
    setAnalyzing(true);
    const active = risks.filter(r => r.status !== 'cerrado');
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza estos ${active.length} riesgos operativos activos y da recomendaciones de mitigación priorizadas. Riesgos: ${active.map(r => `[${r.severity}] ${r.title}: ${r.category}, prob ${r.probability}, impacto ${r.impact}${r.economic_impact ? ', impacto económico ' + r.economic_impact + '€' : ''}`).join('\n')}. Sé directo y accionable. Máximo 200 palabras.`,
    });
    setAiAnalysis(typeof res === 'string' ? res : res?.response || '');
    setAnalyzing(false);
  };

  if (!company) return <NoCompanyState pageName="Riesgos operativos" />;

  const filtered = risks.filter(r => {
    if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
    if (search && !r.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const byStatus = (s) => risks.filter(r => r.status === s).length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold font-jakarta">Riesgos operativos</h1><p className="text-sm text-muted-foreground">{risks.length} riesgos · {risks.filter(r => !['mitigado','cerrado'].includes(r.status)).length} activos</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={analyzeRisks} disabled={analyzing || risks.length === 0} className="gap-1.5">
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}Analizar IA
          </Button>
          <Button size="sm" onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90 gap-1.5"><Plus className="w-3.5 h-3.5" />Nuevo riesgo</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['Críticos', risks.filter(r=>r.severity==='critico'&&r.status!=='cerrado').length, 'border-red-200 bg-red-50 text-red-700'], ['Altos', risks.filter(r=>r.severity==='alto'&&r.status!=='cerrado').length, 'border-orange-200 bg-orange-50 text-orange-700'], ['Medios', risks.filter(r=>r.severity==='medio'&&r.status!=='cerrado').length, 'border-amber-200 bg-amber-50 text-amber-700'], ['Mitigados', risks.filter(r=>r.status==='mitigado').length, 'border-emerald-200 bg-emerald-50 text-emerald-700']].map(([l,v,c])=>(
          <div key={l} className={cn('border rounded-xl p-3 text-center', c)}><p className="text-2xl font-bold">{v}</p><p className="text-xs font-medium">{l}</p></div>
        ))}
      </div>

      {aiAnalysis && (
        <div className="bg-accent border border-border rounded-xl p-4 flex gap-3">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm">{aiAnalysis}</p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar riesgo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos</option>
          {['critico','alto','medio','bajo'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="font-semibold">Sin riesgos registrados</p>
            </div>
          ) : filtered.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                <div className={cn('w-3 h-3 rounded-full flex-shrink-0 mt-1', r.severity==='critico'?'bg-red-500':r.severity==='alto'?'bg-orange-400':r.severity==='medio'?'bg-amber-400':'bg-emerald-400')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-sm">{r.title}</p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold', SEVERITY_COLOR[r.severity])}>{r.severity}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', STATUS_COLOR[r.status] || 'bg-slate-100 text-slate-600')}>{r.status?.replace('_',' ')}</span>
                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{CAT_LABEL[r.category] || r.category}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                    <span>Prob: <strong>{r.probability}</strong></span>
                    <span>Impacto: <strong>{r.impact}</strong></span>
                    {r.owner_name && <span>Responsable: <strong>{r.owner_name}</strong></span>}
                    {r.economic_impact > 0 && <span className="text-red-600">Impacto económico: <strong>{r.economic_impact?.toLocaleString('es-ES')}€</strong></span>}
                  </div>
                  {r.mitigation_plan && <p className="text-xs text-muted-foreground"><span className="font-medium">Mitigación:</span> {r.mitigation_plan}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={async () => { await base44.entities.OpsRisk.delete(r.id); load(); }} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end">
          <div className="w-full max-w-lg h-full bg-card shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-sm">{editing ? 'Editar riesgo' : 'Registrar riesgo'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Título *</label><Input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} className="h-9 text-sm" /></div>
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Descripción</label><Input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} className="h-9 text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                {[['category','Categoría',Object.entries(CAT_LABEL).map(([k,v])=>({value:k,label:v}))],['probability','Probabilidad',['muy_baja','baja','media','alta','muy_alta'].map(s=>({value:s,label:s.replace('_',' ')}))],['impact','Impacto',['muy_bajo','bajo','medio','alto','muy_alto'].map(s=>({value:s,label:s.replace('_',' ')}))],['status','Estado',STATUSES.map(s=>({value:s,label:s.replace('_',' ')}))]].map(([k,l,opts])=>(
                  <div key={k}><label className="text-xs font-medium text-muted-foreground block mb-1">{l}</label>
                    <select value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      {opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
                <div><label className="text-xs font-medium text-muted-foreground block mb-1">Responsable</label><Input value={form.owner_name} onChange={e=>setForm(p=>({...p,owner_name:e.target.value}))} className="h-9 text-sm" /></div>
                <div><label className="text-xs font-medium text-muted-foreground block mb-1">Impacto económico (€)</label><Input type="number" value={form.economic_impact} onChange={e=>setForm(p=>({...p,economic_impact:e.target.value}))} className="h-9 text-sm" /></div>
                <div><label className="text-xs font-medium text-muted-foreground block mb-1">Fecha revisión</label><Input type="date" value={form.review_date} onChange={e=>setForm(p=>({...p,review_date:e.target.value}))} className="h-9 text-sm" /></div>
              </div>
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Plan de mitigación</label><Input value={form.mitigation_plan} onChange={e=>setForm(p=>({...p,mitigation_plan:e.target.value}))} className="h-9 text-sm" /></div>
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Plan de contingencia</label><Input value={form.contingency_plan} onChange={e=>setForm(p=>({...p,contingency_plan:e.target.value}))} className="h-9 text-sm" /></div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{editing ? 'Guardar' : 'Registrar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
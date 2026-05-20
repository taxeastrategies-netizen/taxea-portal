import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Edit2, Trash2, Loader2, X, Save, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import NoCompanyState from '@/components/ui/NoCompanyState';

const STATUS_COLOR = { abierto: 'bg-red-100 text-red-700', en_curso: 'bg-blue-100 text-blue-700', pendiente_respuesta: 'bg-amber-100 text-amber-700', resuelto: 'bg-emerald-100 text-emerald-700', cerrado: 'bg-slate-100 text-slate-500', archivado: 'bg-slate-50 text-slate-400' };
const PRIORITY_COLOR = { critica: 'text-red-600', alta: 'text-orange-500', media: 'text-amber-500', baja: 'text-slate-400' };
const TYPE_LABEL = { incidencia: '🔴 Incidencia', solicitud: '🔵 Solicitud', mejora: '🟢 Mejora', bloqueo: '🟠 Bloqueo', duda: '🟡 Duda', otro: '⚪ Otro' };
const STATUSES = ['abierto','en_curso','pendiente_respuesta','resuelto','cerrado'];
const EMPTY = { title: '', description: '', type: 'incidencia', status: 'abierto', priority: 'media', assignee_name: '', assignee_email: '', reporter_name: '', department: '', due_date: '', impact_fiscal: false, impact_accounting: false, impact_financial: false, notes: '' };

export default function OperationsTickets() {
  const { company } = useOutletContext() || {};
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => { if (company?.id) load(); else setLoading(false); }, [company?.id]);
  const load = async () => { setLoading(true); const d = await base44.entities.OpsTicket.filter({ company_id: company.id }, '-created_date', 200); setTickets(d || []); setLoading(false); };

  const openEdit = (t) => {
    setForm({ title: t.title||'', description: t.description||'', type: t.type||'incidencia', status: t.status||'abierto', priority: t.priority||'media', assignee_name: t.assignee_name||'', assignee_email: t.assignee_email||'', reporter_name: t.reporter_name||'', department: t.department||'', due_date: t.due_date||'', impact_fiscal: t.impact_fiscal||false, impact_accounting: t.impact_accounting||false, impact_financial: t.impact_financial||false, notes: t.notes||'' });
    setEditing(t.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('El título es obligatorio'); return; }
    setSaving(true);
    const data = { ...form, company_id: company.id };
    if (form.status === 'resuelto' && !editing?.resolved_at) data.resolved_at = new Date().toISOString().split('T')[0];
    if (editing) await base44.entities.OpsTicket.update(editing, data);
    else await base44.entities.OpsTicket.create(data);
    toast.success(editing ? 'Ticket actualizado' : 'Ticket creado');
    setSaving(false); setShowForm(false); setEditing(null); load();
  };

  if (!company) return <NoCompanyState pageName="Tickets" />;

  const open = tickets.filter(t => !['resuelto','cerrado','archivado'].includes(t.status));
  const filtered = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (search && !t.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold font-jakarta">Tickets internos</h1><p className="text-sm text-muted-foreground">{tickets.length} tickets · {open.length} abiertos</p></div>
        <Button size="sm" onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90 gap-1.5"><Plus className="w-3.5 h-3.5" />Nuevo ticket</Button>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['Abiertos', tickets.filter(t=>t.status==='abierto').length, 'bg-red-50 border-red-200 text-red-700'],['En curso', tickets.filter(t=>t.status==='en_curso').length, 'bg-blue-50 border-blue-200 text-blue-700'],['Pdte. resp.', tickets.filter(t=>t.status==='pendiente_respuesta').length, 'bg-amber-50 border-amber-200 text-amber-700'],['Resueltos', tickets.filter(t=>t.status==='resuelto').length, 'bg-emerald-50 border-emerald-200 text-emerald-700']].map(([l, v, c]) => (
          <div key={l} className={cn('border rounded-xl p-3 text-center', c)}><p className="text-2xl font-bold">{v}</p><p className="text-xs font-medium">{l}</p></div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar ticket..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos los estados</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos los tipos</option>
          {Object.keys(TYPE_LABEL).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center"><Ticket className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" /><p className="font-semibold">Sin tickets</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Ticket</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Prioridad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Asignado</th>
                <th className="px-4 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {filtered.map(t => {
                  const hasImpact = t.impact_fiscal || t.impact_accounting || t.impact_financial;
                  return (
                    <tr key={t.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-2.5"><p className="font-medium flex items-center gap-2">{t.title}{hasImpact && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">⚡</span>}</p>{t.reporter_name && <p className="text-xs text-muted-foreground">Reportado por: {t.reporter_name}</p>}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{TYPE_LABEL[t.type] || t.type}</td>
                      <td className="px-4 py-2.5 hidden md:table-cell"><span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATUS_COLOR[t.status] || 'bg-slate-100 text-slate-600')}>{t.status?.replace('_',' ')}</span></td>
                      <td className={cn('px-4 py-2.5 text-xs font-semibold hidden lg:table-cell', PRIORITY_COLOR[t.priority])}>{t.priority}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">{t.assignee_name || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={async () => { await base44.entities.OpsTicket.delete(t.id); load(); }} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end">
          <div className="w-full max-w-lg h-full bg-card shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-sm">{editing ? 'Editar ticket' : 'Nuevo ticket'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-auto p-5 space-y-3">
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Título *</label><Input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} className="h-9 text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                {[['type','Tipo',Object.keys(TYPE_LABEL).map(k=>({value:k,label:k}))],['status','Estado',STATUSES.map(s=>({value:s,label:s.replace('_',' ')}))],['priority','Prioridad',['critica','alta','media','baja'].map(p=>({value:p,label:p}))]].map(([k,l,opts])=>(
                  <div key={k}><label className="text-xs font-medium text-muted-foreground block mb-1">{l}</label>
                    <select value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                      {opts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
                {[['reporter_name','Reportado por'],['assignee_name','Asignado a'],['department','Departamento'],['due_date','Fecha límite']].map(([k,l])=>(
                  <div key={k}><label className="text-xs font-medium text-muted-foreground block mb-1">{l}</label><Input type={k==='due_date'?'date':'text'} value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} className="h-9 text-sm" /></div>
                ))}
              </div>
              <div><label className="text-xs font-medium text-muted-foreground block mb-1">Descripción / notas</label><Input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="h-9 text-sm" /></div>
              <div className="border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Impacto Taxea</p>
                <div className="grid grid-cols-3 gap-2">
                  {[['impact_fiscal','Fiscal'],['impact_accounting','Contable'],['impact_financial','Financiero']].map(([n,l])=>(
                    <label key={n} className="flex items-center gap-1.5 cursor-pointer text-xs"><input type="checkbox" checked={form[n]} onChange={e=>setForm(p=>({...p,[n]:e.target.checked}))} />{l}</label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}{editing ? 'Guardar' : 'Crear ticket'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
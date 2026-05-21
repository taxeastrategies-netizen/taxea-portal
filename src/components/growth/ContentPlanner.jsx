import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Calendar, Kanban, List, Search, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const STATUS_LIST = ['idea','guion','diseno','grabado','editado','revisado','programado','publicado','analizado','reutilizado'];
const STATUS_COLORS = {
  idea: 'bg-slate-100 text-slate-600', guion: 'bg-blue-100 text-blue-700', diseno: 'bg-indigo-100 text-indigo-700',
  grabado: 'bg-purple-100 text-purple-700', editado: 'bg-amber-100 text-amber-700', revisado: 'bg-orange-100 text-orange-700',
  programado: 'bg-cyan-100 text-cyan-700', publicado: 'bg-emerald-100 text-emerald-700',
  analizado: 'bg-teal-100 text-teal-700', reutilizado: 'bg-gray-100 text-gray-700',
};
const CHANNEL_EMOJI = { instagram:'📸', tiktok:'🎵', linkedin:'💼', facebook:'📘', youtube:'▶️', blog:'✍️', newsletter:'📧', email:'📩', whatsapp:'💬', google_business:'🏢', twitter:'🐦', threads:'🧵', otro:'📱' };
const FORMAT_EMOJI = { post:'📝', reel:'🎬', story:'⭕', carrusel:'📚', articulo:'✍️', newsletter:'📧', email:'📩', whatsapp:'💬', youtube:'▶️', shorts:'⚡', guia:'📖', infografia:'📊', video:'🎥', otro:'📄' };
const FUNNEL_LABELS = { tofu:'TOFU · Atracción', mofu:'MOFU · Consideración', bofu:'BOFU · Conversión' };
const FUNNEL_COLORS = { tofu:'bg-blue-100 text-blue-700', mofu:'bg-amber-100 text-amber-700', bofu:'bg-emerald-100 text-emerald-700' };

const DEMO = [
  { id: 'd1', title: '5 gastos deducibles que no conoces', format: 'carrusel', channel: 'instagram', status: 'publicado', funnel_stage: 'tofu', scheduled_date: '2026-05-03', owner: 'María', impressions: 4200, leads: 8 },
  { id: 'd2', title: 'Error fiscal más caro del autónomo', format: 'reel', channel: 'instagram', status: 'publicado', funnel_stage: 'tofu', scheduled_date: '2026-05-08', owner: 'María', impressions: 12400, leads: 22 },
  { id: 'd3', title: 'Guía IGIC para Canarias 2026', format: 'articulo', channel: 'blog', status: 'publicado', funnel_stage: 'tofu', scheduled_date: '2026-05-10', owner: 'Carlos', impressions: 890, leads: 14 },
  { id: 'd4', title: 'Cómo calculo mi cuota de autónomo', format: 'reel', channel: 'tiktok', status: 'programado', funnel_stage: 'tofu', scheduled_date: '2026-05-22', owner: 'María' },
  { id: 'd5', title: 'Diagnóstico fiscal: ¿qué incluye?', format: 'carrusel', channel: 'linkedin', status: 'diseño', funnel_stage: 'mofu', scheduled_date: '2026-05-24', owner: 'Carlos' },
  { id: 'd6', title: 'Newsletter mayo: cierre trimestral', format: 'newsletter', channel: 'newsletter', status: 'guion', funnel_stage: 'mofu', scheduled_date: '2026-05-28', owner: 'Ana' },
  { id: 'd7', title: 'Caso real: SL que ahorra 8.000€/año', format: 'post', channel: 'linkedin', status: 'idea', funnel_stage: 'bofu', owner: 'Carlos' },
  { id: 'd8', title: 'WhatsApp: seguimiento propuesta', format: 'whatsapp', channel: 'whatsapp', status: 'revisado', funnel_stage: 'bofu', owner: 'Ana' },
  { id: 'd9', title: 'Checklist declaración trimestral', format: 'carrusel', channel: 'instagram', status: 'editado', funnel_stage: 'tofu', scheduled_date: '2026-05-31', owner: 'María' },
  { id: 'd10', title: 'Constituir SL: guía paso a paso', format: 'articulo', channel: 'blog', status: 'guion', funnel_stage: 'tofu', owner: 'Carlos' },
  { id: 'd11', title: 'Errores al cambiar de gestoría', format: 'reel', channel: 'tiktok', status: 'idea', funnel_stage: 'mofu', owner: 'María' },
  { id: 'd12', title: 'Propuesta servicios Taxea [plantilla]', format: 'otro', channel: 'email', status: 'programado', funnel_stage: 'bofu', scheduled_date: '2026-06-02', owner: 'Ana' },
];

const KANBAN_STATUSES = ['idea','guion','diseno','editado','programado','publicado'];

function ContentForm({ item, onSave, onCancel }) {
  const [f, setF] = useState(item || { title: '', format: 'post', channel: 'instagram', status: 'idea', funnel_stage: 'tofu', owner: '', scheduled_date: '' });
  const up = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4">{item ? 'Editar contenido' : 'Nuevo contenido'}</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2"><label className="text-xs font-medium mb-1 block">Título *</label><Input value={f.title} onChange={e => up('title', e.target.value)} placeholder="Ej: 5 gastos deducibles que no conoces" /></div>
          <div><label className="text-xs font-medium mb-1 block">Formato</label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={f.format} onChange={e => up('format', e.target.value)}>
            {['post','reel','story','carrusel','articulo','newsletter','email','whatsapp','video','guia','otro'].map(v=><option key={v} value={v}>{FORMAT_EMOJI[v]} {v}</option>)}
          </select></div>
          <div><label className="text-xs font-medium mb-1 block">Canal</label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={f.channel} onChange={e => up('channel', e.target.value)}>
            {Object.entries(CHANNEL_EMOJI).map(([k,v])=><option key={k} value={k}>{v} {k}</option>)}
          </select></div>
          <div><label className="text-xs font-medium mb-1 block">Estado</label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={f.status} onChange={e => up('status', e.target.value)}>
            {STATUS_LIST.map(s=><option key={s} value={s}>{s}</option>)}
          </select></div>
          <div><label className="text-xs font-medium mb-1 block">Etapa</label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={f.funnel_stage} onChange={e => up('funnel_stage', e.target.value)}>
            {Object.entries(FUNNEL_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select></div>
          <div><label className="text-xs font-medium mb-1 block">Fecha prevista</label><Input type="date" value={f.scheduled_date} onChange={e => up('scheduled_date', e.target.value)} /></div>
          <div><label className="text-xs font-medium mb-1 block">Responsable</label><Input value={f.owner} onChange={e => up('owner', e.target.value)} placeholder="Nombre..." /></div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onSave(f)} disabled={!f.title}>Guardar</Button>
        </div>
      </div>
    </div>
  );
}

export default function ContentPlanner() {
  const { company } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban');
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { if (company?.id) load(); else { setItems(DEMO); setLoading(false); } }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.GrowthContentItem.filter({ company_id: company.id }, '-created_date', 100);
    setItems(data?.length ? data : DEMO);
    setLoading(false);
  };

  const handleSave = async (f) => {
    if (company?.id) {
      if (editing?.id && !editing.id.startsWith('d')) await base44.entities.GrowthContentItem.update(editing.id, { ...f, company_id: company.id });
      else await base44.entities.GrowthContentItem.create({ ...f, company_id: company.id });
      load();
    }
    setShowForm(false); setEditing(null);
  };

  const handleStatusChange = async (item, newStatus) => {
    if (company?.id && !item.id?.startsWith('d')) await base44.entities.GrowthContentItem.update(item.id, { status: newStatus });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
  };

  const filtered = items.filter(i => {
    const ms = i.title?.toLowerCase().includes(search.toLowerCase());
    const mc = filterChannel === 'all' || i.channel === filterChannel;
    return ms && mc;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-5">
      {showForm && <ContentForm item={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold font-jakarta">Planificador de Contenidos</h1><p className="text-sm text-muted-foreground">{items.length} contenidos · {items.filter(i=>i.status==='publicado').length} publicados · {items.filter(i=>i.status==='programado').length} programados</p></div>
        <div className="flex gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden">
            {[['kanban','Kanban',Kanban],['list','Lista',List]].map(([v,l,Icon])=>(
              <button key={v} onClick={() => setView(v)} className={cn('px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors', view===v?'bg-primary text-white':'text-muted-foreground hover:bg-secondary')}><Icon className="w-3.5 h-3.5" />{l}</button>
            ))}
          </div>
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5"><Plus className="w-4 h-4" />Nuevo</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><Input placeholder="Buscar contenido..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" /></div>
        <select className="h-8 text-sm rounded-md border border-input bg-transparent px-2" value={filterChannel} onChange={e => setFilterChannel(e.target.value)}>
          <option value="all">Todos los canales</option>
          {Object.entries(CHANNEL_EMOJI).map(([k,v])=><option key={k} value={k}>{v} {k}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {Object.entries(FUNNEL_LABELS).map(([stage, label]) => {
          const count = items.filter(i => i.funnel_stage === stage).length;
          return <div key={stage} className={cn('flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold', FUNNEL_COLORS[stage])}>{label}: {count}</div>;
        })}
      </div>

      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_STATUSES.map(status => {
            const col = filtered.filter(i => i.status === status);
            return (
              <div key={status} className="flex-shrink-0 w-52">
                <div className="flex items-center justify-between mb-2">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[status])}>{status}</span>
                  <span className="text-xs text-muted-foreground">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map(item => (
                    <div key={item.id} className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all" onClick={() => { setEditing(item); setShowForm(true); }}>
                      <div className="flex items-start gap-1.5 mb-2">
                        <span className="text-base flex-shrink-0">{CHANNEL_EMOJI[item.channel] || '📱'}</span>
                        <p className="text-xs font-semibold leading-snug">{item.title}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', FUNNEL_COLORS[item.funnel_stage])}>{item.funnel_stage?.toUpperCase()}</span>
                        <span className="text-[10px] text-muted-foreground">{FORMAT_EMOJI[item.format]} {item.format}</span>
                      </div>
                      {item.scheduled_date && <p className="text-[10px] text-muted-foreground mt-1">📅 {item.scheduled_date}</p>}
                      {item.impressions > 0 && <p className="text-[10px] text-emerald-600 mt-1">👁 {item.impressions.toLocaleString()}</p>}
                    </div>
                  ))}
                  <button onClick={() => { setEditing({ status }); setShowForm(true); }} className="w-full border-2 border-dashed border-border rounded-xl py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ Añadir</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="text-left p-3">Contenido</th>
              <th className="text-left p-3">Canal</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-left p-3">Etapa</th>
              <th className="text-left p-3">Fecha</th>
              <th className="text-left p-3">Responsable</th>
              <th className="text-right p-3">Impressiones</th>
            </tr></thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id || i} className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer" onClick={() => { setEditing(item); setShowForm(true); }}>
                  <td className="p-3"><div className="flex items-center gap-2"><span>{CHANNEL_EMOJI[item.channel] || '📱'}</span><span className="font-medium">{item.title}</span></div></td>
                  <td className="p-3 text-xs text-muted-foreground">{item.channel}</td>
                  <td className="p-3"><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[item.status] || STATUS_COLORS.idea)}>{item.status}</span></td>
                  <td className="p-3"><span className={cn('px-2 py-0.5 rounded text-xs font-medium', FUNNEL_COLORS[item.funnel_stage])}>{item.funnel_stage?.toUpperCase()}</span></td>
                  <td className="p-3 text-xs text-muted-foreground">{item.scheduled_date || '—'}</td>
                  <td className="p-3 text-xs">{item.owner || '—'}</td>
                  <td className="p-3 text-right text-xs">{item.impressions > 0 ? item.impressions.toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
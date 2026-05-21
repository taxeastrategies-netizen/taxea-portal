import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Filter, TrendingUp, TrendingDown, Loader2, Edit2, Trash2, ChevronRight, BarChart2, DollarSign, Target, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  idea: 'bg-slate-100 text-slate-600', planificada: 'bg-blue-100 text-blue-700',
  en_revision: 'bg-amber-100 text-amber-700', activa: 'bg-emerald-100 text-emerald-700',
  pausada: 'bg-orange-100 text-orange-700', finalizada: 'bg-purple-100 text-purple-700',
  escalada: 'bg-blue-100 text-blue-800', descartada: 'bg-red-100 text-red-600',
};

const CHANNEL_LABELS = {
  meta_ads: 'Meta Ads', google_ads: 'Google Ads', tiktok_ads: 'TikTok',
  linkedin_ads: 'LinkedIn', email: 'Email', whatsapp: 'WhatsApp',
  seo: 'SEO', blog: 'Blog', newsletter: 'Newsletter', referidos: 'Referidos',
  webinar: 'Webinar', lead_magnet: 'Lead Magnet', retargeting: 'Retargeting',
  local: 'Local', organico: 'Orgánico', otro: 'Otro',
};

const DEMO = [
  { id: 'd1', name: 'Gestoría Low Cost', channel: 'meta_ads', status: 'activa', budget: 600, spent: 380, leads_generated: 48, leads_qualified: 22, appointments: 14, proposals_sent: 9, sales_closed: 4, mrr_generated: 800, cac: 95, roas: 2.1, ai_recommendation: 'Escalar: buen CAC y conversión consistente. Probar audiencias similares.' },
  { id: 'd2', name: 'Diagnóstico Fiscal Gratis', channel: 'google_ads', status: 'activa', budget: 800, spent: 620, leads_generated: 62, leads_qualified: 38, appointments: 24, proposals_sent: 16, sales_closed: 7, mrr_generated: 1680, cac: 88, roas: 2.7, ai_recommendation: 'Canal más rentable. Aumentar presupuesto y replicar estructura en Canarias.' },
  { id: 'd3', name: 'Canarias IGIC', channel: 'meta_ads', status: 'activa', budget: 400, spent: 310, leads_generated: 31, leads_qualified: 12, appointments: 8, proposals_sent: 5, sales_closed: 2, mrr_generated: 490, cac: 155, roas: 1.6, ai_recommendation: 'CAC elevado para el segmento. Mejorar landing y cualificación inicial.' },
  { id: 'd4', name: 'Tu Negocio Crece', channel: 'seo', status: 'activa', budget: 0, spent: 0, leads_generated: 27, leads_qualified: 18, appointments: 9, proposals_sent: 6, sales_closed: 3, mrr_generated: 720, cac: 0, roas: 0, ai_recommendation: 'Canal orgánico de alta calidad. Invertir más en contenido para este cluster.' },
  { id: 'd5', name: 'Control Financiero SL', channel: 'email', status: 'pausada', budget: 200, spent: 180, leads_generated: 14, leads_qualified: 9, appointments: 5, proposals_sent: 4, sales_closed: 2, mrr_generated: 600, cac: 90, roas: 3.3, ai_recommendation: 'ROAS excelente pero volumen bajo. Ampliar la lista de contactos y reactivar.' },
  { id: 'd6', name: 'Vendes, Ganas Poco', channel: 'meta_ads', status: 'activa', budget: 350, spent: 290, leads_generated: 19, leads_qualified: 7, appointments: 4, proposals_sent: 2, sales_closed: 1, mrr_generated: 240, cac: 290, roas: 0.8, ai_recommendation: '⚠ ROAS negativo. Pausar o reformular oferta y creatividades urgente.' },
  { id: 'd7', name: 'Referidos Clientes', channel: 'referidos', status: 'activa', budget: 0, spent: 0, leads_generated: 11, leads_qualified: 10, appointments: 8, proposals_sent: 7, sales_closed: 5, mrr_generated: 1200, cac: 0, roas: 0, ai_recommendation: 'El canal de mayor calidad. Activar programa formal de referidos con incentivos.' },
  { id: 'd8', name: 'Ecommerce Margen Real', channel: 'google_ads', status: 'activa', budget: 500, spent: 450, leads_generated: 35, leads_qualified: 20, appointments: 12, proposals_sent: 8, sales_closed: 3, mrr_generated: 750, cac: 150, roas: 1.7, ai_recommendation: 'Conversión aceptable. Optimizar página de propuesta y seguimiento post-cita.' },
];

function CampaignForm({ item, onSave, onCancel }) {
  const [f, setF] = useState(item || { name: '', channel: 'meta_ads', status: 'idea', budget: '', objective: '' });
  const up = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4">{item ? 'Editar campaña' : 'Nueva campaña'}</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2"><label className="text-xs font-medium mb-1 block">Nombre *</label><Input value={f.name} onChange={e => up('name', e.target.value)} placeholder="Ej: Diagnóstico fiscal gratuito" /></div>
          <div><label className="text-xs font-medium mb-1 block">Canal</label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={f.channel} onChange={e => up('channel', e.target.value)}>{Object.entries(CHANNEL_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="text-xs font-medium mb-1 block">Estado</label><select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={f.status} onChange={e => up('status', e.target.value)}>{Object.keys(STATUS_COLORS).map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}</select></div>
          <div><label className="text-xs font-medium mb-1 block">Presupuesto (€)</label><Input type="number" value={f.budget} onChange={e => up('budget', e.target.value)} placeholder="0" /></div>
          <div><label className="text-xs font-medium mb-1 block">Objetivo</label><Input value={f.objective} onChange={e => up('objective', e.target.value)} placeholder="Captar leads..." /></div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onSave(f)} disabled={!f.name}>Guardar</Button>
        </div>
      </div>
    </div>
  );
}

function CampaignDetail({ c, onClose }) {
  const ltv = c.cac > 0 ? ((c.mrr_generated / Math.max(c.sales_closed, 1)) * 12).toFixed(0) : 0;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div><h3 className="font-bold">{c.name}</h3><p className="text-xs text-muted-foreground capitalize">{CHANNEL_LABELS[c.channel] || c.channel}</p></div>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="p-6 space-y-5">
          {/* Revenue trace */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Revenue Trace · Embudo de campaña</p>
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {[
                { label: 'Leads', value: c.leads_generated, color: 'bg-blue-100 text-blue-800' },
                { label: 'Cualificados', value: c.leads_qualified, color: 'bg-indigo-100 text-indigo-800' },
                { label: 'Citas', value: c.appointments, color: 'bg-purple-100 text-purple-800' },
                { label: 'Propuestas', value: c.proposals_sent, color: 'bg-amber-100 text-amber-800' },
                { label: 'Cierres', value: c.sales_closed, color: 'bg-emerald-100 text-emerald-800' },
                { label: 'MRR', value: `${(c.mrr_generated||0).toLocaleString('es-ES')}€`, color: 'bg-green-100 text-green-800' },
              ].map((s, i) => (
                <div key={s.label} className="flex items-center gap-1 flex-shrink-0">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                  <div className={cn('px-3 py-2 rounded-lg text-center', s.color)}><p className="text-xs font-medium">{s.label}</p><p className="font-bold">{s.value}</p></div>
                </div>
              ))}
            </div>
          </div>
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'CAC', value: `${c.cac || 0}€` },
              { label: 'ROAS', value: `${c.roas?.toFixed(1) || 0}x` },
              { label: 'LTV est.', value: `${ltv}€/año` },
              { label: 'Inversión', value: `${(c.spent||0).toLocaleString('es-ES')}€` },
              { label: 'CPL', value: `${c.leads_generated > 0 ? Math.round((c.spent||0)/c.leads_generated) : 0}€` },
              { label: 'Conv. %', value: `${c.leads_generated > 0 ? ((c.sales_closed||0)/c.leads_generated*100).toFixed(1) : 0}%` },
            ].map(m => (
              <div key={m.label} className="bg-secondary/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="font-bold text-lg">{m.value}</p>
              </div>
            ))}
          </div>
          {/* AI Rec */}
          {c.ai_recommendation && (
            <div className="bg-slate-900 text-white rounded-xl p-4 flex gap-2">
              <Zap className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div><p className="text-xs text-white/50 font-semibold mb-1">Recomendación IA</p><p className="text-sm">{c.ai_recommendation}</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CampaignCenter() {
  const { company } = useOutletContext() || {};
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => { if (company?.id) load(); else { setCampaigns(DEMO); setLoading(false); } }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.GrowthCampaign.filter({ company_id: company.id }, '-created_date', 100);
    setCampaigns(data?.length ? data : DEMO);
    setLoading(false);
  };

  const handleSave = async (f) => {
    if (company?.id) {
      if (editing?.id && !editing.id.startsWith('d')) await base44.entities.GrowthCampaign.update(editing.id, { ...f, company_id: company.id });
      else await base44.entities.GrowthCampaign.create({ ...f, company_id: company.id });
      load();
    }
    setShowForm(false); setEditing(null);
  };

  const filtered = campaigns.filter(c => {
    const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalLeads = campaigns.reduce((s, c) => s + (c.leads_generated || 0), 0);
  const totalMrr = campaigns.reduce((s, c) => s + (c.mrr_generated || 0), 0);
  const totalClosed = campaigns.reduce((s, c) => s + (c.sales_closed || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-5">
      {showForm && <CampaignForm item={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />}
      {detail && <CampaignDetail c={detail} onClose={() => setDetail(null)} />}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold font-jakarta">Centro de Campañas</h1><p className="text-sm text-muted-foreground">Gestión, análisis y trazabilidad de todas las campañas de captación</p></div>
        <Button onClick={() => setShowForm(true)} className="gap-1.5"><Plus className="w-4 h-4" />Nueva campaña</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Leads totales', value: totalLeads, color: 'text-blue-600' },
          { label: 'Clientes cerrados', value: totalClosed, color: 'text-emerald-600' },
          { label: 'MRR generado', value: `${totalMrr.toLocaleString('es-ES')}€`, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><Input placeholder="Buscar campaña..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" /></div>
        <select className="h-8 text-sm rounded-md border border-input bg-transparent px-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Todos los estados</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase tracking-wide">
            <th className="text-left p-3">Campaña</th>
            <th className="text-left p-3">Canal</th>
            <th className="text-left p-3">Estado</th>
            <th className="text-right p-3">Leads</th>
            <th className="text-right p-3">Cierres</th>
            <th className="text-right p-3">MRR €</th>
            <th className="text-right p-3">CAC €</th>
            <th className="text-right p-3">ROAS</th>
            <th className="p-3"></th>
          </tr></thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id || i} className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer transition-colors" onClick={() => setDetail(c)}>
                <td className="p-3">
                  <p className="font-medium">{c.name}</p>
                  {c.ai_recommendation && <p className="text-xs text-muted-foreground truncate max-w-48">{c.ai_recommendation}</p>}
                </td>
                <td className="p-3 text-xs text-muted-foreground">{CHANNEL_LABELS[c.channel] || c.channel}</td>
                <td className="p-3"><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[c.status] || STATUS_COLORS.idea)}>{c.status}</span></td>
                <td className="p-3 text-right font-medium">{c.leads_generated || 0}</td>
                <td className="p-3 text-right font-medium text-emerald-600">{c.sales_closed || 0}</td>
                <td className="p-3 text-right font-bold text-emerald-600">{(c.mrr_generated || 0).toLocaleString('es-ES')}€</td>
                <td className="p-3 text-right">{c.cac > 0 ? `${c.cac}€` : '—'}</td>
                <td className="p-3 text-right">
                  {c.roas > 0 ? (
                    <span className={cn('font-bold', c.roas >= 2 ? 'text-emerald-600' : c.roas >= 1.5 ? 'text-amber-600' : 'text-red-600')}>{c.roas.toFixed(1)}x</span>
                  ) : '—'}
                </td>
                <td className="p-3">
                  <button onClick={e => { e.stopPropagation(); setEditing(c); setShowForm(true); }} className="text-muted-foreground hover:text-foreground">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No hay campañas que coincidan con los filtros</div>}
      </div>
    </div>
  );
}
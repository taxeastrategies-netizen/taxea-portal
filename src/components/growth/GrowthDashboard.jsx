import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  TrendingUp, TrendingDown, Users, Target, DollarSign, AlertTriangle,
  Sparkles, RefreshCw, ArrowUp, ArrowDown, Minus, BarChart2, Zap,
  Activity, Loader2, Brain, ChevronRight, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import NoCompanyState from '@/components/ui/NoCompanyState';

const CHANNEL_COLORS = {
  meta_ads: '#1877f2', google_ads: '#ea4335', seo: '#10b981',
  email: '#8b5cf6', whatsapp: '#25d366', referidos: '#f59e0b',
  organico: '#06b6d4', otro: '#94a3b8',
};

const CHANNEL_LABELS = {
  meta_ads: 'Meta Ads', google_ads: 'Google Ads', seo: 'SEO',
  email: 'Email', whatsapp: 'WhatsApp', referidos: 'Referidos',
  organico: 'Orgánico', otro: 'Otro',
};

// Demo data
const DEMO_CAMPAIGNS = [
  { name: 'Gestoría Low Cost', channel: 'meta_ads', status: 'activa', leads_generated: 48, leads_qualified: 22, budget: 600, spent: 380, appointments: 14, proposals_sent: 9, sales_closed: 4, mrr_generated: 800, cac: 95, roas: 2.1 },
  { name: 'Diagnóstico Fiscal Gratis', channel: 'google_ads', status: 'activa', leads_generated: 62, leads_qualified: 38, budget: 800, spent: 620, appointments: 24, proposals_sent: 16, sales_closed: 7, mrr_generated: 1680, cac: 88, roas: 2.7 },
  { name: 'Canarias IGIC', channel: 'meta_ads', status: 'activa', leads_generated: 31, leads_qualified: 12, budget: 400, spent: 310, appointments: 8, proposals_sent: 5, sales_closed: 2, mrr_generated: 490, cac: 155, roas: 1.6 },
  { name: 'Tu Negocio Crece', channel: 'seo', status: 'activa', leads_generated: 27, leads_qualified: 18, budget: 0, spent: 0, appointments: 9, proposals_sent: 6, sales_closed: 3, mrr_generated: 720, cac: 0, roas: 0 },
  { name: 'Control Financiero SL', channel: 'email', status: 'pausada', leads_generated: 14, leads_qualified: 9, budget: 200, spent: 180, appointments: 5, proposals_sent: 4, sales_closed: 2, mrr_generated: 600, cac: 90, roas: 3.3 },
  { name: 'Vendes, Ganas Poco', channel: 'meta_ads', status: 'activa', leads_generated: 19, leads_qualified: 7, budget: 350, spent: 290, appointments: 4, proposals_sent: 2, sales_closed: 1, mrr_generated: 240, cac: 290, roas: 0.8 },
  { name: 'Referidos Clientes', channel: 'referidos', status: 'activa', leads_generated: 11, leads_qualified: 10, budget: 0, spent: 0, appointments: 8, proposals_sent: 7, sales_closed: 5, mrr_generated: 1200, cac: 0, roas: 0 },
  { name: 'Ecommerce Margen Real', channel: 'google_ads', status: 'activa', leads_generated: 35, leads_qualified: 20, budget: 500, spent: 450, appointments: 12, proposals_sent: 8, sales_closed: 3, mrr_generated: 750, cac: 150, roas: 1.7 },
];

const DEMO_MONTHLY = [
  { mes: 'Ene', leads: 95, cierres: 8, mrr: 1920 },
  { mes: 'Feb', leads: 112, cierres: 10, mrr: 2400 },
  { mes: 'Mar', leads: 148, cierres: 14, mrr: 3360 },
  { mes: 'Abr', leads: 134, cierres: 12, mrr: 2880 },
  { mes: 'May', leads: 247, cierres: 27, mrr: 6480 },
];

function HealthGauge({ score }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let s = 0; const step = score / 50;
    const t = setInterval(() => { s += step; if (s >= score) { setDisplayed(score); clearInterval(t); } else setDisplayed(Math.round(s)); }, 20);
    return () => clearInterval(t);
  }, [score]);
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
  const r = 54; const circ = 2 * Math.PI * r; const arc = circ * 0.75;
  const offset = arc - (arc * displayed / 100);
  return (
    <svg width="140" height="100" viewBox="0 0 140 100">
      <circle cx="70" cy="85" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" transform="rotate(-225 70 85)" />
      <circle cx="70" cy="85" r={r} fill="none" stroke={color} strokeWidth="10" strokeDasharray={`${arc - offset} ${circ}`} strokeLinecap="round" transform="rotate(-225 70 85)" style={{ transition: 'stroke-dasharray 0.04s linear' }} />
      <text x="70" y="78" textAnchor="middle" fontSize="26" fontWeight="bold" fill={color}>{displayed}</text>
      <text x="70" y="93" textAnchor="middle" fontSize="9" fill="#94a3b8">/100</text>
    </svg>
  );
}

function KpiCard({ label, value, sub, trend, color = 'text-foreground', icon: Icon, iconBg }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', iconBg || 'bg-primary/10')}><Icon className="w-3.5 h-3.5 text-primary" /></div>}
      </div>
      <p className={cn('text-2xl font-bold font-jakarta', color)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {trend !== undefined && <div className={cn('flex items-center gap-1 text-xs mt-1 font-medium', trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-muted-foreground')}>{trend > 0 ? <ArrowUp className="w-3 h-3" /> : trend < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}{Math.abs(trend)}% vs mes anterior</div>}
    </div>
  );
}

function AlertCard({ level, title, desc, action }) {
  const colors = { critical: 'border-red-200 bg-red-50 text-red-700', warning: 'border-amber-200 bg-amber-50 text-amber-700', info: 'border-blue-200 bg-blue-50 text-blue-700' };
  return (
    <div className={cn('border rounded-xl p-3 flex items-start gap-2.5', colors[level])}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0"><p className="text-xs font-bold">{title}</p><p className="text-xs opacity-80 mt-0.5">{desc}</p>{action && <p className="text-xs font-semibold mt-1">→ {action}</p>}</div>
    </div>
  );
}

export default function GrowthDashboard() {
  const { company } = useOutletContext() || {};
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiRec, setAiRec] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => { if (company?.id) load(); else { setCampaigns(DEMO_CAMPAIGNS); setLoading(false); } }, [company?.id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.GrowthCampaign.filter({ company_id: company.id });
    setCampaigns(data?.length ? data : DEMO_CAMPAIGNS);
    setLoading(false);
  };

  const totalLeads = campaigns.reduce((s, c) => s + (c.leads_generated || 0), 0);
  const totalQualified = campaigns.reduce((s, c) => s + (c.leads_qualified || 0), 0);
  const totalMrr = campaigns.reduce((s, c) => s + (c.mrr_generated || 0), 0);
  const totalClosed = campaigns.reduce((s, c) => s + (c.sales_closed || 0), 0);
  const totalBudget = campaigns.reduce((s, c) => s + (c.spent || 0), 0);
  const totalProposals = campaigns.reduce((s, c) => s + (c.proposals_sent || 0), 0);
  const avgCac = campaigns.filter(c => c.cac > 0).reduce((s, c, _, a) => s + c.cac / a.length, 0);
  const convRate = totalLeads > 0 ? ((totalClosed / totalLeads) * 100).toFixed(1) : 0;

  // Health Score
  let health = 100;
  if (convRate < 5) health -= 20;
  if (avgCac > 200) health -= 15;
  if (campaigns.some(c => c.roas < 1 && c.spent > 200)) health -= 10;
  if (totalProposals > 0 && totalClosed / totalProposals < 0.3) health -= 10;
  health = Math.max(0, Math.min(100, Math.round(health)));

  // Channel breakdown
  const channelData = Object.entries(campaigns.reduce((acc, c) => {
    const ch = c.channel || 'otro';
    if (!acc[ch]) acc[ch] = { leads: 0, mrr: 0, closed: 0 };
    acc[ch].leads += c.leads_generated || 0;
    acc[ch].mrr += c.mrr_generated || 0;
    acc[ch].closed += c.sales_closed || 0;
    return acc;
  }, {})).map(([ch, d]) => ({ name: CHANNEL_LABELS[ch] || ch, leads: d.leads, mrr: d.mrr, closed: d.closed, fill: CHANNEL_COLORS[ch] || '#94a3b8' })).sort((a, b) => b.mrr - a.mrr);

  const generateAiRec = async () => {
    setLoadingAi(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres el Director de Growth de una asesoría/pyme española. Analiza estos KPIs y da 3 recomendaciones concretas y accionables en máximo 120 palabras total:\n\n- Total leads: ${totalLeads}\n- Leads cualificados: ${totalQualified} (${totalLeads > 0 ? Math.round(totalQualified/totalLeads*100) : 0}%)\n- Clientes cerrados: ${totalClosed}\n- MRR generado: ${totalMrr}€\n- CAC medio: ${Math.round(avgCac)}€\n- Conversión lead→cliente: ${convRate}%\n- Inversión publicitaria: ${totalBudget}€\n- Campañas activas: ${campaigns.filter(c=>c.status==='activa').length}\n- Campañas en riesgo (ROAS<1.5): ${campaigns.filter(c=>c.roas>0&&c.roas<1.5).length}\n\nFormato: emoji + acción directa. Sin titulares. Sin explicaciones largas.`
    });
    setAiRec(typeof res === 'string' ? res : res?.response || '');
    setLoadingAi(false);
  };

  const risky = campaigns.filter(c => c.roas > 0 && c.roas < 1.5);
  const noFollowup = campaigns.filter(c => c.leads_generated > 5 && c.sales_closed === 0);

  if (!company) return <NoCompanyState pageName="Growth Command Center" />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Taxea Growth Command Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Panel de captación, conversión, rentabilidad y acciones de crecimiento</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Actualizar</Button>
          <Button size="sm" onClick={generateAiRec} disabled={loadingAi} className="gap-1.5">
            {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}Recomendación IA
          </Button>
        </div>
      </div>

      {/* AI Recommendation */}
      {aiRec && (
        <div className="bg-slate-900 text-white rounded-xl p-4 flex gap-3">
          <Brain className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div><p className="text-xs text-white/50 mb-1 font-semibold">IA Director de Growth</p><p className="text-sm leading-relaxed whitespace-pre-wrap">{aiRec}</p></div>
        </div>
      )}

      {/* Health Score + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center justify-center">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Growth Health Score</p>
          <HealthGauge score={health} />
          <p className={cn('text-xs font-semibold mt-1', health >= 70 ? 'text-emerald-600' : health >= 45 ? 'text-amber-600' : 'text-red-600')}>{health >= 70 ? '✓ Crecimiento sano' : health >= 45 ? '⚠ Atención necesaria' : '✕ Estado crítico'}</p>
        </div>
        <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Leads generados" value={totalLeads} sub={`${totalQualified} cualificados`} trend={12} icon={Users} iconBg="bg-blue-50" />
          <KpiCard label="Clientes cerrados" value={totalClosed} sub={`${convRate}% conversión`} trend={8} icon={Target} iconBg="bg-emerald-50" />
          <KpiCard label="MRR generado" value={`${totalMrr.toLocaleString('es-ES')}€`} sub={`${totalProposals} propuestas enviadas`} trend={15} color="text-emerald-600" icon={DollarSign} iconBg="bg-emerald-50" />
          <KpiCard label="CAC medio" value={`${Math.round(avgCac)}€`} sub={`Inversión: ${totalBudget.toLocaleString('es-ES')}€`} trend={-5} icon={Activity} iconBg="bg-purple-50" />
          <KpiCard label="Leads cualificados" value={`${totalLeads > 0 ? Math.round(totalQualified/totalLeads*100) : 0}%`} sub="ratio MQL/Lead" icon={BarChart2} iconBg="bg-blue-50" />
          <KpiCard label="Propuestas" value={totalProposals} sub={`${totalProposals > 0 ? Math.round(totalClosed/totalProposals*100) : 0}% aceptadas`} icon={Eye} iconBg="bg-amber-50" />
          <KpiCard label="Campañas activas" value={campaigns.filter(c=>c.status==='activa').length} sub={`${campaigns.length} en total`} icon={Zap} iconBg="bg-violet-50" />
          <KpiCard label="En riesgo" value={risky.length} sub="ROAS < 1.5x" color={risky.length > 0 ? 'text-red-600' : 'text-emerald-600'} icon={AlertTriangle} iconBg="bg-red-50" />
        </div>
      </div>

      {/* Charts + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-4">Tendencia de crecimiento</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={DEMO_MONTHLY}>
              <defs>
                <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area yAxisId="l" type="monotone" dataKey="leads" name="Leads" stroke="#6366f1" fill="url(#leadsGrad)" strokeWidth={2} />
              <Area yAxisId="r" type="monotone" dataKey="mrr" name="MRR €" stroke="#10b981" fill="url(#mrrGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Alertas Growth</p>
          {risky.map((c, i) => <AlertCard key={i} level="critical" title={`ROAS bajo: ${c.name}`} desc={`ROAS ${c.roas?.toFixed(1)}x — Está costando más de lo que genera.`} action="Revisar segmentación o pausar" />)}
          {noFollowup.slice(0, 2).map((c, i) => <AlertCard key={i} level="warning" title={`Sin cierres: ${c.name}`} desc={`${c.leads_generated} leads sin convertir. ¿Seguimiento activo?`} action="Activar secuencia de seguimiento" />)}
          {convRate < 5 && <AlertCard level="warning" title="Conversión lead→cliente baja" desc={`Solo el ${convRate}% de leads se convierten. El embudo puede tener fugas.`} action="Revisar proceso de propuestas" />}
          {risky.length === 0 && noFollowup.length === 0 && convRate >= 5 && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center text-emerald-700 text-sm font-medium">✓ Sin alertas críticas activas</div>}
        </div>
      </div>

      {/* Channel breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-4">Rendimiento por canal</p>
          <div className="space-y-2">
            {channelData.slice(0, 6).map(ch => (
              <div key={ch.name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ch.fill }} />
                <span className="text-sm flex-1">{ch.name}</span>
                <span className="text-xs text-muted-foreground">{ch.leads} leads</span>
                <span className="text-xs font-bold text-emerald-600">{ch.mrr.toLocaleString('es-ES')}€ MRR</span>
                <span className="text-xs font-semibold">{ch.closed} cierres</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top campaigns */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-4">Top campañas por MRR generado</p>
          <div className="space-y-2">
            {[...campaigns].sort((a, b) => (b.mrr_generated || 0) - (a.mrr_generated || 0)).slice(0, 6).map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-xs text-muted-foreground capitalize">{CHANNEL_LABELS[c.channel] || c.channel}</p></div>
                <div className="text-right"><p className="text-sm font-bold text-emerald-600">{(c.mrr_generated || 0).toLocaleString('es-ES')}€</p><p className="text-xs text-muted-foreground">{c.sales_closed} cierres</p></div>
                <div className={cn('w-2 h-2 rounded-full', c.status === 'activa' ? 'bg-emerald-500' : c.status === 'pausada' ? 'bg-amber-400' : 'bg-slate-300')} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHLY = [
  { mes: 'Ene', ads: 600,  tools: 120, freelance: 100, interno: 300, mrr: 1920, oneshot: 400 },
  { mes: 'Feb', ads: 700,  tools: 150, freelance: 200, interno: 350, mrr: 2400, oneshot: 200 },
  { mes: 'Mar', ads: 900,  tools: 150, freelance: 300, interno: 400, mrr: 3360, oneshot: 600 },
  { mes: 'Abr', ads: 850,  tools: 150, freelance: 200, interno: 380, mrr: 2880, oneshot: 300 },
  { mes: 'May', ads: 1800, tools: 150, freelance: 300, interno: 480, mrr: 6480, oneshot: 800 },
];

const BY_CHANNEL = [
  { canal: 'Google Ads',  leads: 97,  qualified: 58, citas: 32, propuestas: 22, cierres: 13, mrr: 3120, ads: 850, tools: 0, freelance: 0, interno: 180 },
  { canal: 'Meta Ads',    leads: 98,  qualified: 42, citas: 21, propuestas: 14, cierres: 7,  mrr: 1680, ads: 700, tools: 0, freelance: 200, interno: 120 },
  { canal: 'SEO',         leads: 27,  qualified: 18, citas: 10, propuestas: 7,  cierres: 4,  mrr:  960, ads: 0,   tools: 80, freelance: 300, interno: 80 },
  { canal: 'Referidos',   leads: 11,  qualified: 9,  citas: 7,  propuestas: 6,  cierres: 5,  mrr: 1200, ads: 0,   tools: 0,  freelance: 0,   interno: 40 },
  { canal: 'Email',       leads: 14,  qualified: 10, citas: 5,  propuestas: 4,  cierres: 2,  mrr:  480, ads: 0,   tools: 70, freelance: 0,   interno: 60 },
];

const VIEWS = ['Global', 'Por canal', 'Tendencia'];

export default function MarketingPnL() {
  const [view, setView] = useState('Global');

  const cur = MONTHLY[4];
  const totalCost = cur.ads + cur.tools + cur.freelance + cur.interno;
  const totalRevenue = cur.mrr + cur.oneshot;
  const netContrib = totalRevenue - totalCost;
  const roi = Math.round((netContrib / totalCost) * 100);
  const totalLeads = BY_CHANNEL.reduce((s, c) => s + c.leads, 0);
  const totalCierres = BY_CHANNEL.reduce((s, c) => s + c.cierres, 0);
  const cac = Math.round(totalCost / totalCierres);
  const roas = Math.round((totalRevenue / cur.ads) * 10) / 10;

  const channelData = BY_CHANNEL.map(c => {
    const cost = c.ads + c.tools + c.freelance + c.interno;
    const margin = cost > 0 ? Math.round(((c.mrr - cost) / c.mrr) * 100) : 100;
    const cac_ch = cost > 0 && c.cierres > 0 ? Math.round(cost / c.cierres) : 0;
    return { ...c, cost, margin, cac_ch };
  }).sort((a, b) => b.mrr - a.mrr);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold font-jakarta">Marketing P&amp;L</h1>
        <p className="text-sm text-muted-foreground">Cuenta de resultados de marketing — Mayo 2026 (datos demo estimados)</p>
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white">
        <p className="text-xs text-white/40 mb-4 uppercase tracking-widest">Cuenta de resultados — Marketing</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Inversion total', v: `${totalCost.toLocaleString('es-ES')}EUR`, sub: 'Ads + herramientas + equipo', good: null },
            { label: 'MRR generado', v: `${cur.mrr.toLocaleString('es-ES')}EUR`, sub: `${totalCierres} clientes + ${cur.oneshot}EUR one-shot`, good: true },
            { label: 'Contribucion neta', v: `${netContrib.toLocaleString('es-ES')}EUR`, sub: `ROI: ${roi}%`, good: netContrib > 0 },
            { label: 'CAC medio', v: `${cac}EUR`, sub: `ROAS: ${roas}x - Leads: ${totalLeads}`, good: cac < 200 },
          ].map(s => (
            <div key={s.label} className="bg-white/8 rounded-xl p-3">
              <p className={cn('text-xl font-bold', s.good === true ? 'text-emerald-400' : s.good === false ? 'text-red-400' : 'text-white')}>{s.v}</p>
              <p className="text-xs text-white/50 mt-0.5">{s.label}</p>
              <p className="text-xs text-white/30">{s.sub}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {[['Ads / Publicidad', `${cur.ads}EUR`], ['Herramientas', `${cur.tools}EUR`], ['Freelance / Agencia', `${cur.freelance}EUR`], ['Coste interno est.', `${cur.interno}EUR`]].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-white/10 pb-1.5"><span className="text-white/40">{k}</span><span className="text-white/80 font-medium">{v}</span></div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {VIEWS.map(v => (
          <button key={v} onClick={() => setView(v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', view === v ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground')}>{v}</button>
        ))}
      </div>

      {view === 'Por canal' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase">
              <th className="text-left p-3">Canal</th>
              <th className="text-right p-3">Leads</th>
              <th className="text-right p-3">Cierres</th>
              <th className="text-right p-3">MRR</th>
              <th className="text-right p-3">Coste</th>
              <th className="text-right p-3">CAC</th>
              <th className="text-right p-3">Margen</th>
              <th className="text-right p-3">Decision</th>
            </tr></thead>
            <tbody>
              {channelData.map(c => (
                <tr key={c.canal} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="p-3 font-medium">{c.canal}</td>
                  <td className="p-3 text-right text-muted-foreground">{c.leads}</td>
                  <td className="p-3 text-right">{c.cierres}</td>
                  <td className="p-3 text-right font-bold text-emerald-600">{c.mrr.toLocaleString('es-ES')}EUR</td>
                  <td className="p-3 text-right text-red-500">{c.cost.toLocaleString('es-ES')}EUR</td>
                  <td className="p-3 text-right">{c.cac_ch > 0 ? `${c.cac_ch}EUR` : 'Organico'}</td>
                  <td className="p-3 text-right"><span className={cn('font-bold', c.margin >= 50 ? 'text-emerald-600' : c.margin >= 20 ? 'text-amber-600' : 'text-red-600')}>{c.margin}%</span></td>
                  <td className="p-3 text-right text-xs">
                    {c.canal === 'Referidos' ? <span className="text-purple-600 font-semibold">Escalar</span> : c.margin >= 50 ? <span className="text-emerald-600 font-semibold">Mantener</span> : c.margin >= 20 ? <span className="text-amber-600 font-semibold">Optimizar</span> : <span className="text-red-600 font-semibold">Revisar</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'Global' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm font-semibold mb-3">Inversion vs MRR por canal</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={channelData}>
                <XAxis dataKey="canal" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => [`${v}EUR`]} />
                <Bar dataKey="cost" name="Coste" fill="#ef4444" opacity={0.6} radius={[4,4,0,0]} />
                <Bar dataKey="mrr" name="MRR" fill="#10b981" opacity={0.8} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm font-semibold mb-3">Ranking de rentabilidad</p>
            {channelData.map((c, i) => (
              <div key={c.canal} className="flex items-center gap-3 mb-3">
                <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">{i+1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5"><span className="font-medium">{c.canal}</span><span className={cn('font-bold', c.margin >= 50 ? 'text-emerald-600' : c.margin >= 20 ? 'text-amber-600' : 'text-red-600')}>{c.margin}% margen</span></div>
                  <div className="h-2 bg-secondary rounded-full"><div className={cn('h-2 rounded-full', c.margin >= 50 ? 'bg-emerald-500' : c.margin >= 20 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${Math.max(5, c.margin)}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'Tendencia' && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-4">Evolucion mensual — Ads vs MRR</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={MONTHLY}>
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [`${v}EUR`, n]} />
              <Line type="monotone" dataKey="mrr" name="MRR" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="ads" name="Ads" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
        <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        Datos demo estimados. Margenes aproximados basados en horas estimadas. Conecta tus datos reales para precision exacta.
      </div>
    </div>
  );
}
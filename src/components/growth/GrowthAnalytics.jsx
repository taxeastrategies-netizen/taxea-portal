import { useOutletContext } from 'react-router-dom';
import { BarChart2, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const CHANNEL_DATA = [
  { canal: 'Referidos', leads: 11, cac: 0, conv: 45, mrr: 1200, color: '#f59e0b' },
  { canal: 'Google Ads', leads: 97, cac: 119, conv: 10.3, mrr: 2430, color: '#ea4335' },
  { canal: 'SEO', leads: 27, cac: 0, conv: 11.1, mrr: 720, color: '#10b981' },
  { canal: 'Meta Ads', leads: 98, cac: 180, conv: 7.1, mrr: 1530, color: '#1877f2' },
  { canal: 'Email', leads: 14, cac: 90, conv: 14.3, mrr: 600, color: '#8b5cf6' },
];

const FUNNEL_DATA = [
  { etapa: 'Visitas', valor: 3240 },
  { etapa: 'Leads', valor: 247 },
  { etapa: 'Cualificados', valor: 118 },
  { etapa: 'Citas', valor: 62 },
  { etapa: 'Propuestas', valor: 37 },
  { etapa: 'Cierres', valor: 27 },
];

const MONTHLY = [
  { mes: 'Ene', inversion: 600, mrr: 1920 },
  { mes: 'Feb', inversion: 700, mrr: 2400 },
  { mes: 'Mar', inversion: 900, mrr: 3360 },
  { mes: 'Abr', inversion: 850, mrr: 2880 },
  { mes: 'May', inversion: 1800, mrr: 6480 },
];

const ADS = 1800; const TOOLS = 150; const CREATIVES = 300;
const TOTAL_INVEST = ADS + TOOLS + CREATIVES;
const MRR = 6480; const CLIENTS = 27; const LEADS = 247;
const CAC = Math.round(TOTAL_INVEST / CLIENTS);
const ROI = Math.round(((MRR - TOTAL_INVEST) / TOTAL_INVEST) * 100);
const PAYBACK = (TOTAL_INVEST / CLIENTS / (MRR / CLIENTS)).toFixed(1);
const MARGIN = Math.round(MRR * 0.6);

export default function GrowthAnalytics() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold font-jakarta">Analitica de Growth</h1>
        <p className="text-sm text-muted-foreground">Rendimiento por canal, Marketing P&amp;L y analisis de embudo</p>
      </div>

      {/* Marketing P&L */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="font-semibold text-sm mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />Marketing P&amp;L - Mayo 2026
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Inversion total', value: `${TOTAL_INVEST.toLocaleString('es-ES')}EUR`, sub: 'Ads + herramientas + creatividades', color: 'text-red-600' },
            { label: 'MRR generado', value: `${MRR.toLocaleString('es-ES')}EUR`, sub: `${CLIENTS} clientes cerrados`, color: 'text-emerald-600' },
            { label: 'ROI marketing', value: `${ROI}%`, sub: `CAC: ${CAC}EUR`, color: ROI > 100 ? 'text-emerald-600' : 'text-red-600' },
            { label: 'Payback CAC', value: `${PAYBACK} meses`, sub: `Margen est: ${MARGIN.toLocaleString('es-ES')}EUR/mes`, color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-secondary/50 rounded-xl p-3">
              <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[['Inversion Ads', `${ADS}EUR`], ['Herramientas', `${TOOLS}EUR`], ['Creatividades', `${CREATIVES}EUR`], ['Leads generados', LEADS], ['Clientes cerrados', CLIENTS], ['Contribucion neta', `${(MRR - TOTAL_INVEST).toLocaleString('es-ES')}EUR`]].map(([k,v])=>(
            <div key={k} className="flex justify-between border-b border-border pb-1"><span className="text-muted-foreground">{k}</span><span className="font-semibold">{v}</span></div>
          ))}
        </div>
      </div>

      {/* Channel Quality Score */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="font-semibold text-sm mb-4">Channel Quality Score - No gana quien trae mas leads, sino quien trae mejores clientes</p>
        <div className="space-y-3">
          {CHANNEL_DATA.sort((a,b) => b.conv - a.conv).map((ch, i) => (
            <div key={ch.canal} className="flex items-center gap-3">
              <span className="text-xs font-semibold w-4 text-muted-foreground">{i+1}</span>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ch.color }} />
              <span className="text-sm flex-1 font-medium">{ch.canal}</span>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">{ch.leads} leads</span>
                <span className={cn('font-bold', ch.conv >= 15 ? 'text-emerald-600' : ch.conv >= 8 ? 'text-amber-600' : 'text-red-600')}>{ch.conv}% conv.</span>
                <span className="text-muted-foreground">{ch.cac > 0 ? `CAC ${ch.cac}EUR` : 'CAC: 0EUR'}</span>
                <span className="font-bold text-emerald-600 w-20 text-right">{ch.mrr.toLocaleString('es-ES')}EUR MRR</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-4">Embudo de conversion</p>
          <div className="space-y-2">
            {FUNNEL_DATA.map((f, i) => {
              const pct = i === 0 ? 100 : Math.round(f.valor / FUNNEL_DATA[0].valor * 100);
              const conv = i > 0 ? Math.round(f.valor / FUNNEL_DATA[i-1].valor * 100) : 100;
              return (
                <div key={f.etapa}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{f.etapa}</span>
                    <span className="text-muted-foreground">
                      {f.valor.toLocaleString()}
                      {i > 0 && <span className={cn('font-semibold ml-1', conv < 30 ? 'text-red-500' : conv < 60 ? 'text-amber-500' : 'text-emerald-500')}> ({conv}%)</span>}
                    </span>
                  </div>
                  <div className="h-6 bg-secondary rounded-lg overflow-hidden">
                    <div className="h-full bg-primary/80 rounded-lg transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Conversion total: {Math.round(27/3240*100*10)/10}% visita -&gt; cliente</p>
        </div>

        {/* Trend */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-4">Inversion vs MRR generado</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MONTHLY}>
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [`${v}EUR`, n === 'mrr' ? 'MRR' : 'Inversion']} />
              <Bar dataKey="inversion" name="Inversion" fill="#ef4444" opacity={0.7} radius={[4,4,0,0]} />
              <Bar dataKey="mrr" name="MRR" fill="#10b981" opacity={0.8} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
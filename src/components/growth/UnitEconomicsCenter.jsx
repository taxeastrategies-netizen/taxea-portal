import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SCENARIOS = {
  conservador: { mrr_por_cliente: 165, churn_pct: 7, margen_pct: 45, cac: 130, name: 'Conservador' },
  base:         { mrr_por_cliente: 240, churn_pct: 4.2, margen_pct: 60, cac: 84, name: 'Base' },
  agresivo:     { mrr_por_cliente: 310, churn_pct: 3, margen_pct: 68, cac: 65, name: 'Agresivo' },
};

const BY_CHANNEL = [
  { canal: 'Referidos',   cac: 0,   ltv: 5760, payback: 0,   cierres: 5  },
  { canal: 'SEO',         cac: 115, ltv: 4320, payback: 1.9, cierres: 4  },
  { canal: 'Google Ads',  cac: 119, ltv: 3840, payback: 2.0, cierres: 13 },
  { canal: 'Email',       cac: 130, ltv: 3600, payback: 2.2, cierres: 2  },
  { canal: 'Meta Ads',    cac: 180, ltv: 2880, payback: 3.0, cierres: 7  },
];

const ALERTS = [
  { sev: 'warning', text: 'Meta Ads: ratio LTV/CAC de 16x aceptable pero payback superior a 3 meses. Optimizar creatividades.' },
  { sev: 'ok', text: 'Google Ads: ratio LTV/CAC de 32x excelente. Canal principal a mantener.' },
  { sev: 'ok', text: 'Referidos: LTV/CAC infinito (sin coste de adquisicion). Programa de referidos prioritario.' },
  { sev: 'critical', text: 'Churn actual: 4.2%. Si sube al 7% el LTV cae un 40% y compromete la rentabilidad del P&L.' },
];

const SEV = { ok: 'text-emerald-700 bg-emerald-50 border-emerald-200', warning: 'text-amber-700 bg-amber-50 border-amber-200', critical: 'text-red-700 bg-red-50 border-red-200' };

export default function UnitEconomicsCenter() {
  const [scenario, setScenario] = useState('base');
  const sc = SCENARIOS[scenario];

  const ltv = Math.round((sc.mrr_por_cliente * sc.margen_pct / 100) / (sc.churn_pct / 100));
  const ltv_cac = sc.cac > 0 ? Math.round(ltv / sc.cac * 10) / 10 : '∞';
  const payback = sc.cac > 0 ? Math.round(sc.cac / (sc.mrr_por_cliente * sc.margen_pct / 100) * 10) / 10 : 0;
  const mrr_neto = 6480;
  const expansion = 320;
  const contraccion = 95;

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-xl font-bold font-jakarta">Unit Economics — CAC · LTV · Payback</h1><p className="text-sm text-muted-foreground">Rentabilidad por cliente, canal y escenario — Datos demo, estimaciones marcadas</p></div>

      <div className="flex gap-2">
        {Object.entries(SCENARIOS).map(([k, s]) => (
          <button key={k} onClick={() => setScenario(k)} className={cn('px-4 py-2 rounded-xl text-sm font-semibold border transition-all', scenario===k ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground')}>{s.name}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'LTV estimado', v: `${ltv.toLocaleString('es-ES')}€`, ok: ltv > 3000, sub: `${sc.churn_pct}% churn · ${sc.margen_pct}% margen` },
          { label: 'CAC medio', v: `${sc.cac}€`, ok: sc.cac < 150, sub: `Payback: ${payback} meses` },
          { label: 'Ratio LTV/CAC', v: `${ltv_cac}x`, ok: ltv_cac === '∞' || ltv_cac >= 3, sub: `Minimo recomendado: 3x` },
          { label: 'MRR Neto', v: `${mrr_neto.toLocaleString('es-ES')}€`, ok: true, sub: `+${expansion}€ expansion · -${contraccion}€ baja` },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className={cn('text-2xl font-bold', s.ok ? 'text-emerald-600' : 'text-red-600')}>{s.v}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-4">LTV vs CAC por canal</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={BY_CHANNEL}>
              <XAxis dataKey="canal" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => [`${v}€`]} />
              <Bar dataKey="ltv" name="LTV" fill="#10b981" opacity={0.8} radius={[4,4,0,0]} />
              <Bar dataKey="cac" name="CAC" fill="#ef4444" opacity={0.6} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-semibold mb-4">Ranking por eficiencia (LTV/CAC)</p>
          {BY_CHANNEL.map((c, i) => {
            const ratio = c.cac > 0 ? Math.round(c.ltv / c.cac) : '∞';
            const isGood = ratio === '∞' || ratio >= 10;
            return (
              <div key={c.canal} className="flex items-center gap-3 mb-3">
                <span className="text-xs text-muted-foreground w-4">{i+1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium">{c.canal}</span>
                    <span className={cn('font-bold', isGood ? 'text-emerald-600' : 'text-amber-600')}>{ratio}x LTV/CAC</span>
                  </div>
                  <p className="text-xs text-muted-foreground">CAC: {c.cac > 0 ? `${c.cac}€` : 'Organico'} · LTV: {c.ltv.toLocaleString('es-ES')}€ · {c.cierres} clientes</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-3">Alertas de rentabilidad</p>
        <div className="space-y-2">
          {ALERTS.map((a, i) => (
            <div key={i} className={cn('border rounded-xl p-3 text-sm flex items-start gap-2', SEV[a.sev])}>
              {a.sev === 'ok' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {a.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
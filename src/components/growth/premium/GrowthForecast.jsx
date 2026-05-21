import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, Brain, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEFAULT = {
  objetivo_mrr: 10000, presupuesto: 2000, conv_landing: 7.8,
  conv_whatsapp: 18, conv_cita: 82, conv_propuesta: 73,
  cac: 84, ltv: 3840, churn: 4.2, ticket: 240, margen: 60,
  meses: 6,
};

const SCENARIOS = ['conservador', 'base', 'agresivo', 'conversion_mejorada'];
const SCENARIO_MULT = { conservador: 0.7, base: 1.0, agresivo: 1.4, conversion_mejorada: 1.2 };
const SCENARIO_LABELS = { conservador: 'Conservador (-30%)', base: 'Base', agresivo: 'Agresivo (+40%)', conversion_mejorada: 'Conversion mejorada (+20%)' };
const SCENARIO_COLORS = { conservador: '#94a3b8', base: '#3b82f6', agresivo: '#10b981', conversion_mejorada: '#f59e0b' };

function simulate(params, mult) {
  const cpl = Math.round(params.presupuesto / (params.presupuesto / 9 * mult));
  const leads_mes = Math.round((params.presupuesto / cpl) * mult);
  const qualified = Math.round(leads_mes * params.conv_landing / 100 * mult);
  const citas = Math.round(qualified * params.conv_whatsapp / 100);
  const propuestas = Math.round(citas * params.conv_cita / 100);
  const cierres = Math.round(propuestas * params.conv_propuesta / 100);
  const mrr_nuevo = Math.round(cierres * params.ticket);
  const payback = params.cac > 0 ? Math.round(params.cac / (params.ticket * params.margen / 100) * 10) / 10 : 0;
  return { leads_mes, qualified, citas, propuestas, cierres, mrr_nuevo, payback, cac: Math.round(params.cac / mult) };
}

export default function GrowthForecast() {
  const [params, setParams] = useState(DEFAULT);
  const [activeScenario, setActiveScenario] = useState('base');
  const [aiInsight, setAiInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setParams(p => ({ ...p, [k]: v }));

  const results = {};
  SCENARIOS.forEach(s => { results[s] = simulate(params, SCENARIO_MULT[s]); });

  // Build monthly projection for base
  const monthlyData = Array.from({ length: params.meses }, (_, i) => {
    const r = results[activeScenario];
    const churnLoss = Math.round(r.mrr_nuevo * i * params.churn / 100);
    return {
      mes: `M${i+1}`,
      mrr: Math.round(r.mrr_nuevo * (i+1) - churnLoss),
      objetivo: params.objetivo_mrr,
    };
  });

  const getInsight = async () => {
    setLoading(true);
    const r = results.base;
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza este forecast de growth y da 3 recomendaciones concretas para alcanzar el objetivo.\n\nObjetivo MRR: ${params.objetivo_mrr}EUR\nPresupuesto: ${params.presupuesto}EUR/mes\nLeads estimados (base): ${r.leads_mes}/mes\nCierres estimados: ${r.cierres}/mes\nMRR nuevo estimado: ${r.mrr_nuevo}EUR/mes\nCAC: ${r.cac}EUR\nChurn: ${params.churn}%\nPayback: ${r.payback} meses\n\nIdentifica el cuello de botella principal, calcula cuantos meses tardara en llegar al objetivo y recomienda la accion de mayor impacto. Borrador.`,
    });
    setAiInsight(typeof res === 'string' ? res : res?.response || '');
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Growth Forecast Simulator</h1><p className="text-sm text-muted-foreground">Simula escenarios de crecimiento — estimaciones demo, ajusta tus datos reales</p></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['objetivo_mrr', 'Objetivo MRR EUR'],
          ['presupuesto', 'Presupuesto EUR/mes'],
          ['ticket', 'Ticket medio EUR/mes'],
          ['meses', 'Meses a simular'],
          ['conv_landing', 'Conv. landing %'],
          ['conv_whatsapp', 'Conv. WA/email %'],
          ['cac', 'CAC actual EUR'],
          ['churn', 'Churn %/mes'],
        ].map(([k, label]) => (
          <div key={k}>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
            <input type="number" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={params[k]} onChange={e => set(k, +e.target.value)} />
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {SCENARIOS.map(s => (
          <button key={s} onClick={() => setActiveScenario(s)} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all', activeScenario===s ? 'text-white border-transparent' : 'bg-card border-border text-muted-foreground')} style={activeScenario===s ? { background: SCENARIO_COLORS[s] } : {}}>{SCENARIO_LABELS[s]}</button>
        ))}
      </div>

      {/* Comparison table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase">
            <th className="text-left p-3">Escenario</th>
            <th className="text-right p-3">Leads/mes</th>
            <th className="text-right p-3">Cierres/mes</th>
            <th className="text-right p-3">MRR nuevo</th>
            <th className="text-right p-3">CAC</th>
            <th className="text-right p-3">Payback</th>
          </tr></thead>
          <tbody>
            {SCENARIOS.map(s => {
              const r = results[s];
              const isActive = s === activeScenario;
              return (
                <tr key={s} className={cn('border-b border-border/50', isActive ? 'bg-primary/5' : 'hover:bg-secondary/20')}>
                  <td className="p-3"><span className="font-medium flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: SCENARIO_COLORS[s] }} />{SCENARIO_LABELS[s]}</span></td>
                  <td className="p-3 text-right">{r.leads_mes}</td>
                  <td className="p-3 text-right font-bold">{r.cierres}</td>
                  <td className="p-3 text-right font-bold text-emerald-600">{r.mrr_nuevo.toLocaleString('es-ES')}€</td>
                  <td className="p-3 text-right">{r.cac}€</td>
                  <td className="p-3 text-right">{r.payback}m</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Monthly chart */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold mb-3">Proyeccion MRR — Escenario: {SCENARIO_LABELS[activeScenario]}</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyData}>
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={v => [`${v.toLocaleString('es-ES')}€`]} />
            <ReferenceLine y={params.objetivo_mrr} stroke="#ef4444" strokeDasharray="6 4" label={{ value: 'Objetivo', fill: '#ef4444', fontSize: 11 }} />
            <Line type="monotone" dataKey="mrr" name="MRR" stroke={SCENARIO_COLORS[activeScenario]} strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <Button onClick={getInsight} disabled={loading} variant="outline" className="gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}Analizar cuello de botella
      </Button>

      {aiInsight && (
        <div className="bg-slate-900 text-white rounded-2xl p-5">
          <p className="text-xs text-white/40 mb-2">Analisis IA — Estimaciones, borrador</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
        </div>
      )}
    </div>
  );
}
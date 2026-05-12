import { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { TrendingUp, RefreshCw, Brain, DollarSign, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const fmtX = n => `${n?.toFixed(1) || '—'}x`;

export default function InvestorReport({ financials, company, invoices, expenses, debts }) {
  const [loading, setLoading] = useState(false);
  const [memo, setMemo] = useState('');
  const f = financials || {};

  // Valuation multiples
  const ebitdaMultiples = [5, 6, 7, 8, 10];
  const revMultiples = [1, 1.5, 2, 2.5, 3];

  const generateMemo = async () => {
    setLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un analista de M&A / VC preparando un investor memo en español (máx 200 palabras) estilo Goldman Sachs / McKinsey:

Empresa: ${company?.nombre_comercial || company?.razon_social || 'N/A'}
CIF: ${company?.nif_cif || '—'}
Fecha: ${format(new Date(), 'MMMM yyyy', { locale: es })}

MÉTRICAS:
- Ingresos: ${fmt(f.ingresos)}
- EBITDA: ${fmt(f.ebitda)} | Margen: ${f.margen?.toFixed(1)}%
- Caja: ${fmt(f.cashTotal)} | Burn: ${fmt(f.burnRate)}/mes
- Runway: ${f.runway ? f.runway.toFixed(1) + ' meses' : 'N/A'}
- Deuda neta: ${fmt(f.deudaTotal)}
- Working Capital: ${fmt(f.workingCapital)}
- DSO: ~${f.dso} días

Genera:
1. INVESTMENT HIGHLIGHTS (3 bullets clave)
2. FINANCIAL SNAPSHOT (2 líneas)
3. GROWTH & PROFITABILITY (análisis)
4. RISK FACTORS (2 bullets)
5. INVESTMENT THESIS (conclusión 2 líneas)

Estilo: sofisticado, directo, orientado a inversor institucional.`,
    });
    setMemo(typeof res === 'string' ? res : res?.result || res?.text || '');
    setLoading(false);
  };

  const metrics = [
    { label: 'ARR / Revenue', value: fmt(f.ingresos), note: 'Período actual' },
    { label: 'EBITDA', value: fmt(f.ebitda), note: `${f.margen?.toFixed(1)}% margen` },
    { label: 'Gross Burn / mes', value: fmt(f.burnRate), note: 'Gasto operativo' },
    { label: 'Cash Runway', value: f.runway ? `${f.runway.toFixed(1)} meses` : '—', note: `${fmt(f.cashTotal)} caja` },
    { label: 'Net Debt', value: fmt(f.deudaTotal), note: 'Pasivos financieros' },
    { label: 'Working Capital', value: fmt(f.workingCapital), note: 'AR - AP' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-emerald-300 uppercase mb-2">Investor Report — Confidential</p>
            <h3 className="text-2xl font-jakarta font-black">{company?.nombre_comercial || company?.razon_social || 'Empresa'}</h3>
            <p className="text-emerald-300 mt-1">{format(new Date(), "MMMM yyyy", { locale: es })} · Financial Overview</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-white/70" />
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">{m.label}</p>
            <p className="text-xl font-jakarta font-bold text-foreground">{m.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{m.note}</p>
          </motion.div>
        ))}
      </div>

      {/* Valuation table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-600" />
          <p className="text-sm font-semibold text-foreground">Rangos de valoración orientativos</p>
          <span className="ml-2 text-[10px] bg-amber-50 border border-amber-200 text-amber-600 px-2 py-0.5 rounded-full font-semibold">ORIENTATIVO</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* EBITDA multiples */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Múltiplos EBITDA</p>
              <div className="space-y-2">
                {ebitdaMultiples.map(m => (
                  <div key={m} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                    <span className="text-xs text-slate-500">{m}x EBITDA</span>
                    <span className="text-sm font-bold text-foreground">{fmt(f.ebitda * m)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Revenue multiples */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Múltiplos Revenue</p>
              <div className="space-y-2">
                {revMultiples.map(m => (
                  <div key={m} className="flex items-center justify-between py-1.5 border-b border-slate-50">
                    <span className="text-xs text-slate-500">{m}x Revenue</span>
                    <span className="text-sm font-bold text-foreground">{fmt(f.ingresos * m)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-4 bg-amber-50 border border-amber-100 rounded-lg p-2">
            ⚠ Valoraciones orientativas calculadas sobre datos del período. No constituyen tasación ni asesoramiento financiero regulado. Múltiplos varían según sector, fase y condiciones de mercado.
          </p>
        </div>
      </div>

      {/* Investor Memo AI */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-foreground">Investor Memo — AI</p>
          </div>
          <button onClick={generateMemo} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
            {loading ? 'Generando…' : 'Generar memo'}
          </button>
        </div>
        {memo ? (
          <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-5 whitespace-pre-line border border-slate-100">
            {memo}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-300 gap-2">
            <TrendingUp className="w-12 h-12" />
            <p className="text-sm text-slate-400">Genera el investor memo ejecutivo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
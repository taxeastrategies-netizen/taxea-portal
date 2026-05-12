import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BarChart2, TrendingUp, DollarSign, Calculator } from 'lucide-react';

export default function ValuationCenter() {
  const [ebitda, setEbitda] = useState('');
  const [multiplo, setMultiplo] = useState(8);
  const [deuda, setDeuda] = useState('');
  const [caja, setCaja] = useState('');

  const ebitdaNum = parseFloat(ebitda) || 0;
  const deudaNum = parseFloat(deuda) || 0;
  const cajaNum = parseFloat(caja) || 0;
  const ev = ebitdaNum * multiplo;
  const equity = ev - deudaNum + cajaNum;

  const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  const COMPARABLES = [
    { sector: 'SaaS B2B', multiplo_min: 6, multiplo_max: 14, multiplo_med: 9.5 },
    { sector: 'E-commerce', multiplo_min: 4, multiplo_max: 9, multiplo_med: 6.2 },
    { sector: 'Servicios profesionales', multiplo_min: 5, multiplo_max: 10, multiplo_med: 7.0 },
    { sector: 'Fintech', multiplo_min: 8, multiplo_max: 20, multiplo_med: 12.5 },
    { sector: 'Logística / Distribución', multiplo_min: 4, multiplo_max: 8, multiplo_med: 5.8 },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-jakarta font-bold text-foreground">Valuation Center</h2>
          <p className="text-sm text-slate-400">EV/EBITDA · Múltiplos · DCF · Comparables · Equity Value</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Calculator */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
          <p className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-500" /> Calculadora EV/EBITDA
          </p>
          <div className="space-y-4">
            {[
              { label: 'EBITDA (€)', value: ebitda, set: setEbitda, placeholder: 'Ej: 2000000' },
              { label: 'Deuda neta (€)', value: deuda, set: setDeuda, placeholder: 'Ej: 500000' },
              { label: 'Caja y equivalentes (€)', value: caja, set: setCaja, placeholder: 'Ej: 200000' },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs font-semibold text-slate-500 block mb-1">{f.label}</label>
                <input type="number" value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Múltiplo EV/EBITDA: {multiplo}x</label>
              <input type="range" min={3} max={25} step={0.5} value={multiplo} onChange={e => setMultiplo(parseFloat(e.target.value))}
                className="w-full accent-emerald-500" />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>3x</span><span>25x</span></div>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-xl">
            <p className="text-emerald-200 text-xs uppercase tracking-widest font-semibold mb-3">Valoración estimada</p>
            <div className="space-y-3">
              <div>
                <p className="text-emerald-200 text-xs">Enterprise Value (EV)</p>
                <p className="text-3xl font-jakarta font-bold">{ebitdaNum > 0 ? fmt(ev) : '—'}</p>
              </div>
              <div className="h-px bg-emerald-500/40" />
              <div>
                <p className="text-emerald-200 text-xs">Equity Value</p>
                <p className="text-2xl font-jakarta font-bold">{ebitdaNum > 0 ? fmt(equity) : '—'}</p>
              </div>
              <div className="text-xs text-emerald-200">
                EV = EBITDA × {multiplo}x{deudaNum > 0 || cajaNum > 0 ? ` − Deuda ${fmt(deudaNum)} + Caja ${fmt(cajaNum)}` : ''}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-foreground mb-3">Rango de valoración ({multiplo - 2}x — {multiplo + 2}x)</p>
            <div className="space-y-2">
              {[multiplo - 2, multiplo - 1, multiplo, multiplo + 1, multiplo + 2].map((m, i) => {
                const isCenter = i === 2;
                return (
                  <div key={m} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", isCenter ? "bg-emerald-50 border border-emerald-100" : "")}>
                    <span className={cn("text-xs font-bold w-6", isCenter ? "text-emerald-600" : "text-slate-400")}>{m}x</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", isCenter ? "bg-emerald-400" : "bg-slate-200")}
                        style={{ width: `${Math.min(100, (ebitdaNum * m) / (ebitdaNum * (multiplo + 2) || 1) * 100)}%` }} />
                    </div>
                    <span className={cn("text-xs font-bold text-right w-24", isCenter ? "text-emerald-700" : "text-slate-500")}>
                      {ebitdaNum > 0 ? fmt(ebitdaNum * m) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Comparables */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <p className="text-sm font-semibold text-foreground">Múltiplos de mercado — Comparables por sector</p>
        </div>
        <div className="divide-y divide-slate-50">
          {COMPARABLES.map((c, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4">
              <p className="text-sm font-medium text-foreground w-48">{c.sector}</p>
              <div className="flex-1 flex items-center gap-3">
                <span className="text-xs text-slate-400">{c.multiplo_min}x</span>
                <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative">
                  <div className="absolute h-full bg-emerald-100 rounded-full" style={{ left: `${(c.multiplo_min / 25) * 100}%`, width: `${((c.multiplo_max - c.multiplo_min) / 25) * 100}%` }} />
                  <div className="absolute h-full w-0.5 bg-emerald-500" style={{ left: `${(c.multiplo_med / 25) * 100}%` }} />
                </div>
                <span className="text-xs text-slate-400">{c.multiplo_max}x</span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-sm font-bold text-emerald-600">{c.multiplo_med}x</span>
                <p className="text-[10px] text-slate-400">mediana</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
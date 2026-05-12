import { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { FileText, RefreshCw, Brain, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

export default function MnAAnalytics({ financials, company, invoices, debts }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const f = financials || {};

  // M&A attractiveness score (0-100)
  const attractiveness = (() => {
    let pts = 0;
    if (f.margen > 20) pts += 25; else if (f.margen > 10) pts += 15; else if (f.margen > 0) pts += 7;
    if (f.ebitda > 0) pts += 20;
    if (f.runway > 12) pts += 20; else if (f.runway > 6) pts += 12; else if (f.runway > 3) pts += 6;
    const deudaEbitda = f.ebitda > 0 ? f.deudaTotal / f.ebitda : 99;
    if (deudaEbitda < 2) pts += 20; else if (deudaEbitda < 3.5) pts += 12; else if (deudaEbitda < 5) pts += 5;
    if (f.workingCapital > 0) pts += 15;
    return Math.min(100, pts);
  })();

  const deudaEbitda = f.ebitda > 0 ? (f.deudaTotal / f.ebitda).toFixed(1) : '—';
  const ebitdaMultiples = [4, 5, 6, 7, 8, 10, 12];

  const strengths = [
    f.margen > 15 && 'Margen EBITDA saludable (>' + f.margen?.toFixed(0) + '%)',
    f.cashTotal > f.burnRate * 6 && 'Posición de caja sólida (runway >' + f.runway?.toFixed(0) + ' meses)',
    f.workingCapital > 0 && 'Working capital positivo',
    f.deudaTotal < f.ebitda * 2 && 'Estructura de deuda conservadora',
    invoices.filter(i => i.tipo === 'emitida').length > 20 && 'Base de facturación diversificada',
  ].filter(Boolean);

  const weaknesses = [
    f.margen < 10 && 'Margen operativo por debajo del benchmark sector',
    f.runway < 6 && 'Runway ajustado (< 6 meses)',
    f.workingCapital < 0 && 'Working capital negativo',
    f.deudaTotal > f.ebitda * 4 && 'Apalancamiento elevado (Deuda/EBITDA > 4x)',
    f.dso > 60 && 'Periodo medio de cobro elevado (DSO > 60 días)',
  ].filter(Boolean);

  const generateAnalysis = async () => {
    setLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un analista de M&A de una firma de inversión. Prepara un análisis preliminar de atractivo para adquisición/inversión en español (máx 220 palabras) estilo PE/VC:

Target: ${company?.nombre_comercial || company?.razon_social || 'N/A'}
CIF: ${company?.nif_cif || '—'} | Sector: ${company?.actividad || '—'}
Fecha: ${format(new Date(), 'MMMM yyyy', { locale: es })}

Attractiveness Score: ${attractiveness}/100

FINANCIALS:
- Revenue: ${fmt(f.ingresos)} | EBITDA: ${fmt(f.ebitda)} (${f.margen?.toFixed(1)}% margen)
- Deuda/EBITDA: ${deudaEbitda}x | Cash: ${fmt(f.cashTotal)}
- Working Capital: ${fmt(f.workingCapital)} | DSO: ~${f.dso} días

Genera:
1. INVESTMENT THESIS (2 líneas)
2. FINANCIAL HIGHLIGHTS
3. KEY VALUE DRIVERS (bullets)
4. RISK FACTORS (bullets)
5. TRANSACTION CONSIDERATIONS
6. PRELIMINARY VERDICT (atractivo / condicionado / no recomendable)

Estilo: PE/VC, directo, orientado a decisión de inversión.`,
    });
    setAnalysis(typeof res === 'string' ? res : res?.result || res?.text || '');
    setLoading(false);
  };

  const scoreColor = attractiveness >= 65 ? 'from-emerald-600 to-emerald-800' : attractiveness >= 40 ? 'from-amber-500 to-amber-700' : 'from-red-600 to-red-800';
  const scoreLabel = attractiveness >= 65 ? 'Atractivo' : attractiveness >= 40 ? 'Condicionado' : 'No recomendable';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-2xl p-6 text-white">
        <p className="text-[10px] tracking-[0.25em] text-slate-400 uppercase mb-2">M&A Preliminary Analytics — Confidential</p>
        <h3 className="text-2xl font-jakarta font-black">{company?.nombre_comercial || company?.razon_social || 'Empresa'}</h3>
        <p className="text-slate-400 mt-1">Análisis preliminar para operaciones corporativas · {format(new Date(), "MMM yyyy", { locale: es })}</p>
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-4">
          <div>
            <p className="text-xs text-slate-400">Attractiveness Score</p>
            <p className="text-3xl font-jakarta font-black text-white">{attractiveness}<span className="text-sm text-slate-400">/100</span></p>
          </div>
          <div className={cn("px-4 py-2 rounded-xl bg-gradient-to-r text-white text-sm font-bold", scoreColor)}>
            {scoreLabel}
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800">Fortalezas detectadas</p>
          </div>
          {strengths.length > 0 ? (
            <ul className="space-y-2">
              {strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm text-emerald-700"><span className="text-emerald-400 mt-0.5">•</span>{s}</li>)}
            </ul>
          ) : <p className="text-sm text-emerald-600 opacity-60">Sin fortalezas destacables detectadas.</p>}
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-semibold text-red-800">Factores de riesgo</p>
          </div>
          {weaknesses.length > 0 ? (
            <ul className="space-y-2">
              {weaknesses.map((w, i) => <li key={i} className="flex items-start gap-2 text-sm text-red-700"><span className="text-red-400 mt-0.5">•</span>{w}</li>)}
            </ul>
          ) : <p className="text-sm text-red-600 opacity-60">Sin factores de riesgo críticos detectados.</p>}
        </div>
      </div>

      {/* EBITDA multiples */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-600" />
          <p className="text-sm font-semibold text-foreground">Rangos de valoración M&A (EBITDA)</p>
          <span className="ml-auto text-[10px] bg-amber-50 border border-amber-200 text-amber-600 px-2 py-0.5 rounded-full font-semibold">ORIENTATIVO</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-slate-100">
          {ebitdaMultiples.map(m => (
            <div key={m} className="p-4 text-center">
              <p className="text-xs text-slate-400 mb-1">{m}x EBITDA</p>
              <p className="text-sm font-bold text-foreground">{fmt(f.ebitda * m)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Analysis */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-slate-700" />
            <p className="text-sm font-semibold text-foreground">M&A Preliminary Analysis — IA</p>
          </div>
          <button onClick={generateAnalysis} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-all">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {loading ? 'Analizando…' : 'Generar análisis'}
          </button>
        </div>
        {analysis ? (
          <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-5 whitespace-pre-line border border-slate-100">
            {analysis}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-300 gap-2">
            <FileText className="w-12 h-12" />
            <p className="text-sm text-slate-400">Genera el análisis M&A preliminar.</p>
          </div>
        )}
        <p className="text-[10px] text-slate-400 mt-3">⚠ Análisis orientativo. No constituye asesoramiento de inversión regulado ni valoración oficial.</p>
      </div>
    </div>
  );
}
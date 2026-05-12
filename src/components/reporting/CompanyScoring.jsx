import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Award, RefreshCw, CheckCircle2, AlertTriangle, XCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

function ScoreGauge({ score }) {
  const color = score >= 70 ? '#16a34a' : score >= 45 ? '#d97706' : '#dc2626';
  const label = score >= 70 ? 'Saludable' : score >= 45 ? 'Vigilar' : 'Riesgo Elevado';
  const bg = score >= 70 ? 'bg-emerald-50 border-emerald-200' : score >= 45 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-jakarta font-black" style={{ color }}>{score}</span>
          <span className="text-[10px] text-slate-400 font-medium">/ 100</span>
        </div>
      </div>
      <span className={cn("px-4 py-1.5 rounded-full text-sm font-bold border", bg)} style={{ color }}>
        {label}
      </span>
    </div>
  );
}

function ScoreFactor({ label, score, weight, desc }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = score >= 70 ? 'text-emerald-600' : score >= 45 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-foreground">{label}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">{weight}%</span>
            <span className={cn("text-xs font-bold", textColor)}>{score}/100</span>
          </div>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1, delay: 0.3 }}
            className={cn("h-full rounded-full", color)} />
        </div>
        {desc && <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

export default function CompanyScoring({ financials, company, invoices, expenses, debts, bankAccounts }) {
  const [loading, setLoading] = useState(false);
  const [aiComment, setAiComment] = useState('');

  const scoring = useMemo(() => {
    const f = financials || {};
    const factors = [];

    // Liquidez (20%)
    const liquidezScore = f.cashTotal > 0
      ? f.burnRate > 0
        ? Math.min(100, (f.cashTotal / f.burnRate) * 8.33)
        : 80
      : 10;
    factors.push({ label: 'Liquidez & Runway', score: Math.round(liquidezScore), weight: 20, desc: `Caja: ${fmt(f.cashTotal)} · Runway: ${f.runway ? f.runway.toFixed(1) + ' meses' : '—'}` });

    // Rentabilidad EBITDA (20%)
    const ebitdaScore = f.margen > 25 ? 95 : f.margen > 15 ? 80 : f.margen > 5 ? 60 : f.margen > 0 ? 35 : 10;
    factors.push({ label: 'Rentabilidad (EBITDA)', score: Math.round(ebitdaScore), weight: 20, desc: `Margen: ${f.margen?.toFixed(1) || 0}% · EBITDA: ${fmt(f.ebitda)}` });

    // Endeudamiento (15%)
    const deudaEbitda = f.ebitda > 0 ? f.deudaTotal / f.ebitda : 99;
    const deudaScore = deudaEbitda < 1 ? 95 : deudaEbitda < 2 ? 80 : deudaEbitda < 3.5 ? 60 : deudaEbitda < 5 ? 35 : 10;
    factors.push({ label: 'Endeudamiento', score: Math.round(deudaScore), weight: 15, desc: `Deuda/EBITDA: ${deudaEbitda < 99 ? deudaEbitda.toFixed(1) + 'x' : 'N/A'}` });

    // Cashflow operativo (15%)
    const cfScore = f.beneficio > 0 ? Math.min(95, 50 + (f.margen / 40) * 45) : 15;
    factors.push({ label: 'Generación de Caja', score: Math.round(cfScore), weight: 15, desc: `Beneficio: ${fmt(f.beneficio)}` });

    // DSO/DPO (10%)
    const dsoScore = f.dso < 30 ? 95 : f.dso < 45 ? 80 : f.dso < 60 ? 60 : f.dso < 90 ? 40 : 20;
    factors.push({ label: 'Eficiencia Cobros (DSO)', score: Math.round(dsoScore), weight: 10, desc: `DSO estimado: ~${f.dso || 0} días` });

    // Working Capital (10%)
    const wcScore = f.workingCapital > 0 ? Math.min(90, 50 + (f.workingCapital / (f.ingresos || 1)) * 100) : 20;
    factors.push({ label: 'Capital Circulante', score: Math.round(wcScore), weight: 10, desc: `WC: ${fmt(f.workingCapital)}` });

    // Cobertura intereses (10%)
    const coberturaInt = f.ebitda > 0 && f.interesesAnuales > 0 ? f.ebitda / f.interesesAnuales : f.ebitda > 0 ? 10 : 0;
    const intScore = coberturaInt > 5 ? 95 : coberturaInt > 3 ? 80 : coberturaInt > 1.5 ? 55 : coberturaInt > 1 ? 30 : 10;
    factors.push({ label: 'Cobertura de Intereses', score: Math.round(intScore), weight: 10, desc: `Cobertura: ${coberturaInt > 0 ? coberturaInt.toFixed(1) + 'x' : '—'}` });

    const total = Math.round(factors.reduce((s, f) => s + (f.score * f.weight) / 100, 0));
    return { factors, total };
  }, [financials, invoices, expenses, debts, bankAccounts]);

  const generateAI = async () => {
    setLoading(true);
    const f = financials || {};
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un analista financiero senior de Big4 (Deloitte/KPMG). 
Analiza este perfil financiero empresarial y genera un comentario ejecutivo profesional en español (máximo 180 palabras), estilo consultoría estratégica:

Empresa: ${company?.nombre_comercial || company?.razon_social || 'N/A'}
Score financiero: ${scoring.total}/100
Ingresos: ${fmt(f.ingresos)}
EBITDA: ${fmt(f.ebitda)} (${f.margen?.toFixed(1)}% margen)
Caja: ${fmt(f.cashTotal)} (runway: ${f.runway ? f.runway.toFixed(1) + ' meses' : 'N/A'})
Deuda total: ${fmt(f.deudaTotal)}
DSO: ~${f.dso || 0} días
Working Capital: ${fmt(f.workingCapital)}

Factores de scoring:
${scoring.factors.map(fac => `- ${fac.label}: ${fac.score}/100`).join('\n')}

Genera: resumen ejecutivo + fortalezas clave + áreas de mejora + conclusión estratégica.
Usa lenguaje corporativo, preciso y sofisticado. Sé conciso pero profundo.`,
    });
    setAiComment(typeof res === 'string' ? res : res?.result || res?.text || '');
    setLoading(false);
  };

  const s = scoring.total;
  const colorClass = s >= 70 ? 'text-emerald-600' : s >= 45 ? 'text-amber-600' : 'text-red-600';
  const bgGrad = s >= 70
    ? 'from-emerald-600 to-emerald-800'
    : s >= 45
      ? 'from-amber-500 to-amber-700'
      : 'from-red-600 to-red-800';

  return (
    <div className="space-y-6">
      {/* Hero scoring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className={cn("bg-gradient-to-br text-white rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center gap-4", bgGrad)}>
          <ScoreGauge score={s} />
          <div className="text-center">
            <p className="text-sm font-bold opacity-90">{company?.nombre_comercial || company?.razon_social || 'Empresa'}</p>
            <p className="text-xs opacity-60 mt-0.5">Company Financial Score — {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-4">Factores de scoring</p>
          <div>
            {scoring.factors.map((f, i) => (
              <ScoreFactor key={i} {...f} />
            ))}
          </div>
        </div>
      </div>

      {/* Semáforo */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { range: '70-100', label: 'Saludable', desc: 'Empresa con fundamentos sólidos', icon: CheckCircle2, color: 'border-emerald-200 bg-emerald-50', iconColor: 'text-emerald-500', active: s >= 70 },
          { range: '45-69', label: 'Vigilar', desc: 'Situación aceptable con aspectos a mejorar', icon: AlertTriangle, color: 'border-amber-200 bg-amber-50', iconColor: 'text-amber-500', active: s >= 45 && s < 70 },
          { range: '0-44', label: 'Riesgo Elevado', desc: 'Requiere atención urgente', icon: XCircle, color: 'border-red-200 bg-red-50', iconColor: 'text-red-500', active: s < 45 },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className={cn("rounded-2xl p-4 border transition-all", item.color, item.active ? 'shadow-md ring-2 ring-offset-1' : 'opacity-50',
              item.active && (s >= 70 ? 'ring-emerald-300' : s >= 45 ? 'ring-amber-300' : 'ring-red-300'))}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("w-4 h-4", item.iconColor)} />
                <span className={cn("text-sm font-bold", item.iconColor)}>{item.label}</span>
                {item.active && <span className="ml-auto text-[9px] font-bold text-white px-2 py-0.5 rounded-full bg-current opacity-80">TU SCORE</span>}
              </div>
              <p className="text-xs text-slate-500">{item.desc}</p>
              <p className="text-[10px] text-slate-400 mt-1">Rango: {item.range}</p>
            </div>
          );
        })}
      </div>

      {/* AI Analysis */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-taxea-red" />
            <p className="text-sm font-semibold text-foreground">Análisis IA — Evaluación Ejecutiva</p>
          </div>
          <button onClick={generateAI} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all disabled:opacity-50">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5" />}
            {loading ? 'Analizando...' : 'Generar análisis'}
          </button>
        </div>
        {aiComment ? (
          <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 rounded-xl p-4 border border-slate-100">
            {aiComment}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <Award className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="text-sm">Genera el análisis ejecutivo con IA para obtener una evaluación profesional.</p>
          </div>
        )}
      </div>
    </div>
  );
}
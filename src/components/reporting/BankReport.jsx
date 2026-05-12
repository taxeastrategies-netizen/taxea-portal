import { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Building2, RefreshCw, Brain, Shield, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

function BankabilityScore({ score }) {
  const color = score >= 70 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  const label = score >= 70 ? 'Bankable' : score >= 50 ? 'Condicionado' : 'Difícil acceso';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="40" fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle cx="44" cy="44" r="40" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-jakarta font-black" style={{ color }}>{score}</span>
          <span className="text-[9px] text-slate-400">/100</span>
        </div>
      </div>
      <span className="text-xs font-bold px-3 py-1 rounded-full border" style={{ color, borderColor: color + '40', backgroundColor: color + '12' }}>
        {label}
      </span>
    </div>
  );
}

export default function BankReport({ financials, company, invoices, expenses, debts, bankAccounts }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const f = financials || {};

  // Bankability score
  const score = (() => {
    let pts = 0;
    // Liquidez (20)
    if (f.cashTotal > 0) pts += f.runway > 6 ? 20 : f.runway > 3 ? 13 : 6;
    // EBITDA positivo (20)
    if (f.ebitda > 0) pts += f.margen > 15 ? 20 : f.margen > 5 ? 13 : 6;
    // Ratio deuda (20)
    const deudaEbitda = f.ebitda > 0 ? f.deudaTotal / f.ebitda : 99;
    pts += deudaEbitda < 2 ? 20 : deudaEbitda < 3.5 ? 13 : deudaEbitda < 5 ? 6 : 0;
    // Cobertura intereses (15)
    const cob = f.ebitda > 0 && f.interesesAnuales > 0 ? f.ebitda / f.interesesAnuales : f.ebitda > 0 ? 5 : 0;
    pts += cob > 3 ? 15 : cob > 1.5 ? 9 : cob > 1 ? 4 : 0;
    // DSO (10)
    pts += f.dso < 45 ? 10 : f.dso < 60 ? 6 : 2;
    // Working Capital positivo (15)
    pts += f.workingCapital > 0 ? 15 : 0;
    return Math.min(100, pts);
  })();

  const ratios = [
    { label: 'Deuda / EBITDA', value: f.ebitda > 0 ? `${(f.deudaTotal / f.ebitda).toFixed(2)}x` : '—', ok: f.ebitda > 0 && f.deudaTotal / f.ebitda < 3.5, warn: f.ebitda > 0 && f.deudaTotal / f.ebitda < 5 },
    { label: 'Cobertura intereses', value: f.ebitda > 0 && f.interesesAnuales > 0 ? `${(f.ebitda / f.interesesAnuales).toFixed(2)}x` : '—', ok: f.ebitda > 0 && f.interesesAnuales > 0 && f.ebitda / f.interesesAnuales > 1.5, warn: true },
    { label: 'DSO (días cobro)', value: `~${f.dso || 0} días`, ok: f.dso < 45, warn: f.dso < 60 },
    { label: 'DPO (días pago)', value: `~${f.dpo || 0} días`, ok: true, warn: true },
    { label: 'Working Capital', value: fmt(f.workingCapital), ok: f.workingCapital > 0, warn: false },
    { label: 'Margen EBITDA', value: `${f.margen?.toFixed(1) || 0}%`, ok: f.margen > 10, warn: f.margen > 0 },
    { label: 'Liquidez inmediata', value: fmt(f.cashTotal), ok: f.cashTotal > f.burnRate * 3, warn: f.cashTotal > f.burnRate },
    { label: 'Cuotas mensuales', value: fmt(f.cuotasMensuales), ok: f.cuotasMensuales < f.burnRate * 0.2, warn: f.cuotasMensuales < f.burnRate * 0.35 },
  ];

  const generateAnalysis = async () => {
    setLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un analista de riesgos bancarios. Prepara un informe de bankability en español (máx 200 palabras) para presentar a una entidad financiera:

Empresa: ${company?.nombre_comercial || company?.razon_social || 'N/A'}
CIF: ${company?.nif_cif || '—'} | Actividad: ${company?.actividad || '—'}
Fecha: ${format(new Date(), 'MMMM yyyy', { locale: es })}

Bankability Score: ${score}/100

RATIOS FINANCIEROS:
- Ingresos: ${fmt(f.ingresos)} | EBITDA: ${fmt(f.ebitda)} (${f.margen?.toFixed(1)}% margen)
- Deuda/EBITDA: ${f.ebitda > 0 ? (f.deudaTotal / f.ebitda).toFixed(2) + 'x' : 'N/A'}
- Cobertura intereses: ${f.ebitda > 0 && f.interesesAnuales > 0 ? (f.ebitda / f.interesesAnuales).toFixed(2) + 'x' : 'N/A'}
- Liquidez/Runway: ${f.runway ? f.runway.toFixed(1) + ' meses' : 'N/A'}
- Working Capital: ${fmt(f.workingCapital)}
- DSO: ~${f.dso} días

Estructura:
1. CAPACIDAD DE PAGO
2. SOLVENCIA Y GARANTÍAS
3. CASHFLOW Y LIQUIDEZ
4. RIESGOS PARA EL PRESTAMISTA
5. CONCLUSIÓN CREDITICIA

Estilo: técnico, objetivo, bancario.`,
    });
    setAnalysis(typeof res === 'string' ? res : res?.result || res?.text || '');
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-900 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-indigo-300 uppercase mb-2">Bank Report — Financing</p>
            <h3 className="text-2xl font-jakarta font-black">{company?.nombre_comercial || company?.razon_social || 'Empresa'}</h3>
            <p className="text-indigo-300 mt-1">CIF: {company?.nif_cif || '—'} · {format(new Date(), "MMMM yyyy", { locale: es })}</p>
          </div>
          <BankabilityScore score={score} />
        </div>
      </div>

      {/* Key metrics for bank */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos', value: fmt(f.ingresos), sub: 'Base de ingresos' },
          { label: 'EBITDA', value: fmt(f.ebitda), sub: `${f.margen?.toFixed(1) || 0}% margen` },
          { label: 'Caja libre', value: fmt(f.cashTotal), sub: `${f.runway?.toFixed(1) || '—'} meses` },
          { label: 'Deuda total', value: fmt(f.deudaTotal), sub: `${fmt(f.cuotasMensuales)}/mes` },
        ].map((k, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">{k.label}</p>
            <p className="text-xl font-jakarta font-bold text-foreground">{k.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Ratios table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600" />
          <p className="text-sm font-semibold text-foreground">Ratios bancarios</p>
        </div>
        <div className="divide-y divide-slate-50">
          {ratios.map((r, i) => {
            const Icon = r.ok ? CheckCircle2 : !r.warn ? XCircle : AlertTriangle;
            const cls = r.ok ? 'text-emerald-500' : !r.warn ? 'text-red-500' : 'text-amber-500';
            return (
              <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-3.5 h-3.5", cls)} />
                  <span className="text-sm text-slate-600">{r.label}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">{r.value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Bank analysis */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-600" />
            <p className="text-sm font-semibold text-foreground">Informe crediticio — IA</p>
          </div>
          <button onClick={generateAnalysis} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
            {loading ? 'Analizando…' : 'Generar informe'}
          </button>
        </div>
        {analysis ? (
          <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-5 whitespace-pre-line border border-slate-100">
            {analysis}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-300 gap-2">
            <Building2 className="w-12 h-12" />
            <p className="text-sm text-slate-400">Genera el análisis crediticio para presentar al banco.</p>
          </div>
        )}
        <p className="text-[10px] text-slate-400 mt-3">⚠ Orientativo. No constituye informe bancario regulado.</p>
      </div>
    </div>
  );
}
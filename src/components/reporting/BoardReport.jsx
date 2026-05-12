import { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Users, Brain, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subMonths, parseISO, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

export default function BoardReport({ financials, company, invoices, expenses, debts, bankAccounts }) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState('');
  const f = financials || {};

  const trendData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const ingresos = invoices.filter(inv => {
      try { return inv.tipo === 'emitida' && isSameMonth(parseISO(inv.fecha_emision), month); } catch { return false; }
    }).reduce((s, inv) => s + (inv.total_factura || 0), 0);
    const gastos = expenses.filter(exp => {
      try { return exp.tipo === 'gasto' && isSameMonth(parseISO(exp.fecha), month); } catch { return false; }
    }).reduce((s, exp) => s + (exp.total || 0), 0);
    return { mes: format(month, 'MMM', { locale: es }), ingresos, ebitda: ingresos - gastos };
  });

  const deudaEbitda = f.ebitda > 0 ? (f.deudaTotal / f.ebitda).toFixed(1) : '—';
  const coberturaInt = f.ebitda > 0 && f.interesesAnuales > 0 ? (f.ebitda / f.interesesAnuales).toFixed(1) : '—';
  const margenPct = f.margen?.toFixed(1) || 0;

  const generateInsights = async () => {
    setLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres el CFO de la empresa presentando al Consejo de Administración. Genera "Board Insights" ejecutivos en español (máx 200 palabras):

Empresa: ${company?.nombre_comercial || company?.razon_social || 'N/A'}
Fecha: ${format(new Date(), 'MMMM yyyy', { locale: es })}

MÉTRICAS CLAVE:
- Ingresos: ${fmt(f.ingresos)} | Margen: ${margenPct}%
- EBITDA: ${fmt(f.ebitda)}
- Caja: ${fmt(f.cashTotal)} | Runway: ${f.runway ? f.runway.toFixed(1) + ' meses' : 'N/A'}
- Deuda: ${fmt(f.deudaTotal)} | Deuda/EBITDA: ${deudaEbitda}x
- DSO: ~${f.dso} días | Working Capital: ${fmt(f.workingCapital)}

Estructura: 
1. SITUACIÓN ACTUAL (2-3 líneas ejecutivas)
2. PUNTOS CLAVE PARA EL CONSEJO (3 bullets)
3. RIESGOS A VIGILAR (2 bullets)
4. DECISIONES RECOMENDADAS (2 bullets)

Estilo: preciso, ejecutivo, orientado a toma de decisiones estratégicas.`,
    });
    setInsights(typeof res === 'string' ? res : res?.result || res?.text || '');
    setLoading(false);
  };

  const strategicKpis = [
    { label: 'Revenue', value: fmt(f.ingresos), color: 'border-l-emerald-500' },
    { label: 'EBITDA Margin', value: `${margenPct}%`, color: 'border-l-blue-500' },
    { label: 'Cash Runway', value: f.runway ? `${f.runway.toFixed(1)}M` : '—', color: 'border-l-violet-500' },
    { label: 'Net Debt', value: fmt(f.deudaTotal), color: 'border-l-amber-500' },
    { label: 'Debt/EBITDA', value: `${deudaEbitda}x`, color: 'border-l-indigo-500' },
    { label: 'Int. Coverage', value: `${coberturaInt}x`, color: 'border-l-taxea-red' },
  ];

  return (
    <div className="space-y-6">
      {/* Board header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-slate-400 uppercase mb-2">Board Report — Confidential</p>
            <h3 className="text-2xl font-jakarta font-black">{company?.nombre_comercial || company?.razon_social || 'Empresa'}</h3>
            <p className="text-slate-400 mt-1">{format(new Date(), "MMMM yyyy — 'Consejo de Administración'", { locale: es })}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <Users className="w-7 h-7 text-white/70" />
          </div>
        </div>
        <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {strategicKpis.map((k, i) => (
            <div key={i} className={cn("border-l-2 pl-3", k.color)}>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">{k.label}</p>
              <p className="text-sm font-bold text-white mt-0.5">{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-4">Revenue & EBITDA trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0' }} />
              <Line type="monotone" dataKey="ingresos" name="Revenue" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-slate-700" />
              <p className="text-sm font-semibold text-foreground">Board Insights — IA</p>
            </div>
            <button onClick={generateInsights} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-all">
              {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
              {loading ? '…' : 'Generar'}
            </button>
          </div>
          {insights ? (
            <div className="text-sm text-slate-700 leading-relaxed flex-1 overflow-y-auto bg-slate-50 rounded-xl p-4 whitespace-pre-line">
              {insights}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-300">
              <Users className="w-12 h-12" />
              <p className="text-sm text-slate-400 text-center">Genera los Board Insights para el consejo.</p>
            </div>
          )}
        </div>
      </div>

      {/* Risk signals */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-4">Señales clave para el Consejo</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: 'Liquidez',
              status: f.runway > 6 ? 'ok' : f.runway > 3 ? 'warn' : 'risk',
              text: f.runway ? `Runway: ${f.runway.toFixed(1)} meses` : 'Sin datos',
            },
            {
              label: 'Endeudamiento',
              status: f.deudaTotal < f.ebitda * 2 ? 'ok' : f.deudaTotal < f.ebitda * 4 ? 'warn' : 'risk',
              text: `Deuda/EBITDA: ${deudaEbitda}x`,
            },
            {
              label: 'Rentabilidad',
              status: f.margen > 15 ? 'ok' : f.margen > 5 ? 'warn' : 'risk',
              text: `Margen: ${margenPct}%`,
            },
          ].map((item, i) => {
            const Icon = item.status === 'ok' ? CheckCircle2 : item.status === 'warn' ? AlertTriangle : AlertTriangle;
            const cls = item.status === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : item.status === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700';
            return (
              <div key={i} className={cn("rounded-xl p-4 border", cls)}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-bold">{item.label}</span>
                </div>
                <p className="text-xs">{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
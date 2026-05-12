import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Calendar, RefreshCw, FileText, TrendingUp, TrendingDown, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subMonths, parseISO, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

export default function MonthlyReport({ financials, company, invoices, expenses, obligations }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState('');

  const f = financials || {};

  // Monthly trend data (last 6 months)
  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(new Date(), 5 - i);
      const ingresos = invoices.filter(inv => {
        try { return inv.tipo === 'emitida' && isSameMonth(parseISO(inv.fecha_emision), month); } catch { return false; }
      }).reduce((s, inv) => s + (inv.total_factura || 0), 0);
      const gastos = expenses.filter(exp => {
        try { return exp.tipo === 'gasto' && isSameMonth(parseISO(exp.fecha), month); } catch { return false; }
      }).reduce((s, exp) => s + (exp.total || 0), 0);
      return {
        mes: format(month, 'MMM', { locale: es }),
        ingresos,
        gastos,
        beneficio: ingresos - gastos,
      };
    });
  }, [invoices, expenses]);

  const selectedData = monthlyData[monthlyData.length - 1] || {};

  const generateNarrative = async () => {
    setLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un analista financiero de Big4. Escribe un resumen ejecutivo mensual profesional en español (máx 150 palabras) estilo KPMG para:

Empresa: ${company?.nombre_comercial || company?.razon_social || 'N/A'}
Período: ${format(selectedMonth, 'MMMM yyyy', { locale: es })}

Datos del período:
- Ingresos: ${fmt(f.ingresos)}
- Gastos: ${fmt(f.gastoTotal)}
- EBITDA: ${fmt(f.ebitda)} (${f.margen?.toFixed(1)}% margen)
- Caja: ${fmt(f.cashTotal)}
- Cobros pendientes: ${fmt(f.cobrosPendientes)}
- Deuda: ${fmt(f.deudaTotal)}

Tendencia últimos meses:
${monthlyData.map(m => `${m.mes}: ingresos ${fmt(m.ingresos)} / gastos ${fmt(m.gastos)}`).join('\n')}

Genera: resumen ejecutivo + evolución + alertas + perspectivas. Estilo corporativo profesional.`,
    });
    setNarrative(typeof res === 'string' ? res : res?.result || res?.text || '');
    setLoading(false);
  };

  const kpis = [
    { label: 'Ingresos', value: fmt(f.ingresos), delta: null, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Gastos', value: fmt(f.gastoTotal), delta: null, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'EBITDA', value: fmt(f.ebitda), sub: `${f.margen?.toFixed(1)}%`, icon: BarChart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Caja', value: fmt(f.cashTotal), sub: f.runway ? `${f.runway.toFixed(1)}m runway` : '', icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Header report */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Taxea Business OS — Monthly Financial Report</p>
              <h3 className="text-xl font-jakarta font-bold text-white">{company?.nombre_comercial || company?.razon_social || 'Empresa'}</h3>
              <p className="text-slate-400 text-sm mt-0.5">{format(selectedMonth, 'MMMM yyyy', { locale: es })} · CIF: {company?.nif_cif || '—'}</p>
            </div>
            <div className="hidden sm:block text-right">
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-white/70" />
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y divide-slate-100">
          {kpis.map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i} className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", k.bg)}>
                    <Icon className={cn("w-3 h-3", k.color)} />
                  </div>
                  <p className="text-xs text-slate-400">{k.label}</p>
                </div>
                <p className={cn("text-lg font-jakarta font-bold", k.color)}>{k.value}</p>
                {k.sub && <p className="text-[11px] text-slate-400">{k.sub}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart + narrative */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-4">Evolución ingresos vs gastos (6 meses)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} labelStyle={{ fontWeight: 600 }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-taxea-red" />
              <p className="text-sm font-semibold text-foreground">Narrativa ejecutiva IA</p>
            </div>
            <button onClick={generateNarrative} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 disabled:opacity-50 transition-all">
              {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
              {loading ? 'Generando…' : 'Generar'}
            </button>
          </div>
          {narrative ? (
            <div className="text-sm text-slate-600 leading-relaxed flex-1 overflow-y-auto bg-slate-50 rounded-xl p-4">
              {narrative}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Brain className="w-10 h-10 text-slate-200" />
              <p className="text-sm text-center">Genera la narrativa ejecutiva del período.</p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-foreground">Resumen financiero detallado</p>
        </div>
        <div className="divide-y divide-slate-50">
          {[
            { label: 'Ingresos totales', value: fmt(f.ingresos), type: 'positive' },
            { label: 'Gastos totales', value: fmt(f.gastoTotal), type: 'negative' },
            { label: 'Beneficio neto', value: fmt(f.beneficio), type: f.beneficio >= 0 ? 'positive' : 'negative' },
            { label: 'Margen neto', value: `${f.margen?.toFixed(1) || 0}%`, type: f.margen >= 0 ? 'positive' : 'negative' },
            { label: 'EBITDA estimado', value: fmt(f.ebitda), type: 'neutral' },
            { label: 'Caja disponible', value: fmt(f.cashTotal), type: 'neutral' },
            { label: 'Burn rate mensual', value: fmt(f.burnRate), type: 'neutral' },
            { label: 'Runway estimado', value: f.runway ? `${f.runway.toFixed(1)} meses` : '—', type: 'neutral' },
            { label: 'Cobros pendientes (AR)', value: fmt(f.cobrosPendientes), type: 'neutral' },
            { label: 'Pagos pendientes (AP)', value: fmt(f.pagosPendientes), type: 'neutral' },
            { label: 'Working Capital', value: fmt(f.workingCapital), type: f.workingCapital >= 0 ? 'positive' : 'negative' },
            { label: 'Deuda activa', value: fmt(f.deudaTotal), type: 'neutral' },
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50">
              <span className="text-sm text-slate-600">{row.label}</span>
              <span className={cn("text-sm font-semibold",
                row.type === 'positive' ? 'text-emerald-600' : row.type === 'negative' ? 'text-red-500' : 'text-foreground')}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { addDays, format, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

function fmt(n) {
  if (!n && n !== 0) return '—';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k€`;
  return `${n.toFixed(0)}€`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1117] border border-white/10 rounded-xl p-3 shadow-2xl min-w-[160px]">
      <p className="text-xs text-white/40 mb-2 font-medium">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-white/60">{p.name}</span>
          </span>
          <span className="font-semibold" style={{ color: p.color }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

function buildForecastData(invoices, expenses, obligations, days) {
  const today = startOfDay(new Date());
  const data = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const dateStr = format(date, 'dd MMM', { locale: es });
    const isToday = i === 0;

    // Estimated daily inflow from pending invoices (spread evenly over 30 days)
    const pendingInvoices = invoices.filter(inv => inv.tipo === 'emitida' && inv.estado_cobro === 'pendiente');
    const dailyInflow = pendingInvoices.reduce((s, inv) => s + (inv.total_factura || 0), 0) / 30;

    // Estimated daily outflow from pending expenses
    const pendingExpenses = expenses.filter(e => e.tipo === 'gasto');
    const dailyOutflow = pendingExpenses.reduce((s, e) => s + (e.total || 0), 0) / 30;

    // Tax obligations due in next days
    const taxDue = obligations
      .filter(o => {
        try {
          const d = new Date(o.fecha_limite);
          return Math.abs(d - date) < 86400000 * 1.5 && o.estado !== 'finalizado';
        } catch { return false; }
      })
      .reduce((s, o) => s + (o.importe || 0), 0);

    // Cash balance (starting from cobradas invoices)
    const cashBase = invoices
      .filter(inv => inv.tipo === 'emitida' && inv.estado_cobro === 'cobrada')
      .reduce((s, inv) => s + (inv.total_factura || 0), 0);

    const runningCash = cashBase + dailyInflow * i - dailyOutflow * i - taxDue;

    data.push({
      day: dateStr,
      entradas: Math.max(0, Math.round(dailyInflow + (isToday ? 0 : dailyInflow * 0.1 * Math.sin(i / 3)))),
      salidas: Math.max(0, Math.round(dailyOutflow + taxDue)),
      cash: Math.round(runningCash),
    });
  }
  return data;
}

const VIEWS = [
  { id: '7d', label: '7 días', days: 7 },
  { id: '30d', label: '30 días', days: 30 },
  { id: '13w', label: '13 semanas', days: 91 },
  { id: '1y', label: '12 meses', days: 365 },
];

export default function CashflowForecastChart({ invoices, expenses, obligations }) {
  const [view, setView] = useState('30d');
  const [chartType, setChartType] = useState('area');

  const days = VIEWS.find(v => v.id === view)?.days || 30;

  const data = useMemo(() => buildForecastData(invoices, expenses, obligations, Math.min(days, 90)), [invoices, expenses, obligations, days]);

  const minCash = Math.min(...data.map(d => d.cash));
  const hasCritical = minCash < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-[#0d0d10] border border-white/8 p-5"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white">Forecast de Tesorería</h3>
          <p className="text-xs text-white/35 mt-0.5">Proyección de liquidez basada en cobros y pagos previstos</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View tabs */}
          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/8">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  view === v.id
                    ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
                    : "text-white/35 hover:text-white/60"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Critical warning */}
      {hasCritical && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <span className="text-red-400 text-xs">⚠</span>
          <span className="text-xs text-red-300">Se proyecta cash negativo en los próximos {days} días. Revisa cobros pendientes.</span>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={days <= 7 ? 0 : days <= 30 ? 4 : 12}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => fmt(v)}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#3b82f6" strokeWidth={1.5} fill="url(#inGrad)" dot={false} />
          <Area type="monotone" dataKey="salidas" name="Salidas" stroke="#f59e0b" strokeWidth={1.5} fill="url(#outGrad)" dot={false} />
          <Area type="monotone" dataKey="cash" name="Cash neto" stroke="#10b981" strokeWidth={2} fill="url(#cashGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-center">
        {[
          { color: '#10b981', label: 'Cash neto' },
          { color: '#3b82f6', label: 'Entradas' },
          { color: '#f59e0b', label: 'Salidas' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 rounded-full" style={{ background: color }} />
            <span className="text-xs text-white/35">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
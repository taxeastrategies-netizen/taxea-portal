import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { addDays, format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

function fmt(n) {
  if (!n && n !== 0) return '—';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k€`;
  return `${n.toFixed(0)}€`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg min-w-[160px]">
      <p className="text-xs text-slate-500 mb-2 font-medium">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-xs mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-600">{p.name}</span>
          </span>
          <span className="font-semibold text-slate-800">{fmt(p.value)}</span>
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
    const pendingInvoices = invoices.filter(inv => inv.tipo === 'emitida' && inv.estado_cobro === 'pendiente');
    const dailyInflow = pendingInvoices.reduce((s, inv) => s + (inv.total_factura || 0), 0) / 30;
    const pendingExpenses = expenses.filter(e => e.tipo === 'gasto');
    const dailyOutflow = pendingExpenses.reduce((s, e) => s + (e.total || 0), 0) / 30;
    const taxDue = obligations.filter(o => {
      try { return Math.abs(new Date(o.fecha_limite) - date) < 86400000 * 1.5 && o.estado !== 'finalizado'; }
      catch { return false; }
    }).reduce((s, o) => s + (o.importe || 0), 0);
    const cashBase = invoices.filter(inv => inv.tipo === 'emitida' && inv.estado_cobro === 'cobrada')
      .reduce((s, inv) => s + (inv.total_factura || 0), 0);
    const runningCash = cashBase + dailyInflow * i - dailyOutflow * i - taxDue;
    data.push({
      day: dateStr,
      entradas: Math.max(0, Math.round(dailyInflow)),
      salidas: Math.max(0, Math.round(dailyOutflow + taxDue)),
      cash: Math.round(runningCash),
    });
  }
  return data;
}

const VIEWS = [
  { id: '7d', label: '7 días', days: 7 },
  { id: '30d', label: '30 días', days: 30 },
  { id: '13w', label: '13 sem.', days: 91 },
  { id: '1y', label: '12 meses', days: 365 },
];

export default function CashflowForecastChart({ invoices, expenses, obligations }) {
  const [view, setView] = useState('30d');
  const days = VIEWS.find(v => v.id === view)?.days || 30;
  const data = useMemo(() => buildForecastData(invoices, expenses, obligations, Math.min(days, 90)), [invoices, expenses, obligations, days]);
  const minCash = Math.min(...data.map(d => d.cash));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Forecast de Tesorería</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Proyección de liquidez basada en cobros y pagos previstos</p>
        </div>
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                view === v.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {minCash < 0 && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
          <span className="text-red-500 text-xs">⚠</span>
          <span className="text-xs text-red-600">Se proyecta cash negativo en los próximos {days} días. Revisa cobros pendientes.</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="cashGradL" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="inGradL" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="outGradL" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#d97706" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
            interval={days <= 7 ? 0 : days <= 30 ? 4 : 12} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="rgba(0,0,0,0.1)" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#2563eb" strokeWidth={1.5} fill="url(#inGradL)" dot={false} />
          <Area type="monotone" dataKey="salidas" name="Salidas" stroke="#d97706" strokeWidth={1.5} fill="url(#outGradL)" dot={false} />
          <Area type="monotone" dataKey="cash" name="Cash neto" stroke="#059669" strokeWidth={2} fill="url(#cashGradL)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3 justify-center">
        {[{ color: '#059669', label: 'Cash neto' }, { color: '#2563eb', label: 'Entradas' }, { color: '#d97706', label: 'Salidas' }].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ background: color }} />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
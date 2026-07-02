import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1117] border border-white/10 rounded-xl p-3 shadow-2xl min-w-[160px]">
      <p className="text-xs text-white/50 mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-xs text-white/70">{p.name}</span>
          </div>
          <span className="text-xs font-bold text-white">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function CashflowChart({ invoices, expenses }) {
  const data = useMemo(() => {
    const months = Array.from({ length: 7 }, (_, i) => subMonths(new Date(), 6 - i));
    return months.map(month => {
      const interval = { start: startOfMonth(month), end: endOfMonth(month) };

      const ingresos = invoices
        .filter(i => {
          try { return i.tipo === 'emitida' && !i.anulada && isWithinInterval(parseISO(i.fecha_emision), interval); }
          catch { return false; }
        })
        .reduce((s, i) => s + (i.total_factura || 0), 0);

      const gastos = expenses
        .filter(e => {
          try { return e.tipo === 'gasto' && !e.anulada && isWithinInterval(parseISO(e.fecha), interval); }
          catch { return false; }
        })
        .reduce((s, e) => s + (e.total || 0), 0);

      const gastosFacturas = invoices
        .filter(i => {
          try { return i.tipo === 'recibida' && !i.anulada && isWithinInterval(parseISO(i.fecha_emision), interval); }
          catch { return false; }
        })
        .reduce((s, i) => s + (i.total_factura || 0), 0);

      const totalGastos = gastos + gastosFacturas;
      const neto = ingresos - totalGastos;

      return {
        mes: format(month, 'MMM', { locale: es }),
        Ingresos: Math.round(ingresos),
        Gastos: Math.round(totalGastos),
        Neto: Math.round(neto),
      };
    });
  }, [invoices, expenses]);

  const maxVal = Math.max(...data.map(d => Math.max(d.Ingresos, d.Gastos)), 1000);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Cashflow — Últimos 7 meses</h3>
            <p className="text-xs text-muted-foreground">Ingresos, gastos y resultado neto</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {[
            { color: '#3b82f6', label: 'Ingresos' },
            { color: '#ef4444', label: 'Gastos' },
            { color: '#10b981', label: 'Neto' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-xs text-muted-foreground hidden sm:block">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradNeto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="Ingresos" stroke="#3b82f6" strokeWidth={2} fill="url(#gradIngresos)" activeDot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
          <Area type="monotone" dataKey="Gastos" stroke="#ef4444" strokeWidth={2} fill="url(#gradGastos)" activeDot={{ r: 4, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
          <Area type="monotone" dataKey="Neto" stroke="#10b981" strokeWidth={2.5} fill="url(#gradNeto)" activeDot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} strokeDasharray="0" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
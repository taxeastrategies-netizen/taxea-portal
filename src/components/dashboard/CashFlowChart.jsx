import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, startOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';

function buildChartData(invoices, expenses) {
  const end = new Date();
  const start = subMonths(startOfMonth(end), 5);
  const months = eachMonthOfInterval({ start, end });

  return months.map(month => {
    const mes = month.getMonth() + 1;
    const anio = month.getFullYear();

    const ingresos = invoices
      .filter(i => i.tipo === 'emitida' && i.fecha_emision)
      .filter(i => {
        const d = new Date(i.fecha_emision);
        return d.getMonth() + 1 === mes && d.getFullYear() === anio;
      })
      .reduce((s, i) => s + (i.total_factura || 0), 0);

    const gastos = expenses
      .filter(e => e.tipo === 'gasto' && e.fecha)
      .filter(e => {
        const d = new Date(e.fecha);
        return d.getMonth() + 1 === mes && d.getFullYear() === anio;
      })
      .reduce((s, e) => s + (e.total || 0), 0);

    return {
      mes: format(month, 'MMM', { locale: es }),
      Ingresos: Math.round(ingresos),
      Gastos: Math.round(gastos),
      Resultado: Math.round(ingresos - gastos),
    };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f0f12] border border-white/10 rounded-xl shadow-2xl p-4 text-sm backdrop-blur-md">
      <p className="font-semibold text-white/80 mb-2 text-xs uppercase tracking-wider">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2.5 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-white/50 text-xs">{p.name}</span>
          <span className="font-semibold text-white ml-auto pl-4">
            {p.value.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €
          </span>
        </div>
      ))}
    </div>
  );
};

const CustomLegend = ({ payload }) => (
  <div className="flex items-center gap-5 justify-end pt-2 pr-1">
    {payload?.map(p => (
      <div key={p.value} className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
        <span className="text-xs text-muted-foreground font-medium">{p.value}</span>
      </div>
    ))}
  </div>
);

export default function CashFlowChart({ invoices, expenses }) {
  const data = buildChartData(invoices, expenses);
  const hasData = data.some(d => d.Ingresos > 0 || d.Gastos > 0);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-taxea-red/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-taxea-red" />
          </div>
          <div>
            <h3 className="font-jakarta font-semibold text-foreground text-sm">Evolución Financiera</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Últimos 6 meses · Ingresos vs. Gastos</p>
          </div>
        </div>
      </div>

      <div className="px-2 pt-4 pb-3">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-muted-foreground opacity-40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Sin datos suficientes</p>
            <p className="text-xs text-muted-foreground opacity-60">Sube facturas y gastos para ver la evolución</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(350, 75%, 40%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(350, 75%, 40%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(215, 60%, 55%)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(215, 60%, 55%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradResultado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" vertical={false} opacity={0.6} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: 'hsl(0,0%,50%)', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(0,0%,50%)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(0,0%,85%)', strokeWidth: 1 }} />
              <Legend content={<CustomLegend />} />
              <Area
                type="monotoneX"
                dataKey="Ingresos"
                stroke="hsl(350, 75%, 40%)"
                strokeWidth={2.5}
                fill="url(#gradIngresos)"
                dot={false}
                activeDot={{ r: 5, fill: 'hsl(350, 75%, 40%)', stroke: 'white', strokeWidth: 2 }}
              />
              <Area
                type="monotoneX"
                dataKey="Gastos"
                stroke="hsl(215, 60%, 55%)"
                strokeWidth={2}
                fill="url(#gradGastos)"
                dot={false}
                activeDot={{ r: 5, fill: 'hsl(215, 60%, 55%)', stroke: 'white', strokeWidth: 2 }}
              />
              <Area
                type="monotoneX"
                dataKey="Resultado"
                stroke="hsl(142, 60%, 45%)"
                strokeWidth={2}
                strokeDasharray="5 3"
                fill="url(#gradResultado)"
                dot={false}
                activeDot={{ r: 5, fill: 'hsl(142, 60%, 45%)', stroke: 'white', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
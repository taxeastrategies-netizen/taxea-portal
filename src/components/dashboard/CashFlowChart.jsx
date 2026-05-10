import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, startOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

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
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">
            {p.value.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €
          </span>
        </div>
      ))}
    </div>
  );
};

export default function CashFlowChart({ invoices, expenses }) {
  const data = buildChartData(invoices, expenses);
  const hasData = data.some(d => d.Ingresos > 0 || d.Gastos > 0);

  return (
    <div className="bg-card border border-border rounded-xl shadow-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="font-jakarta font-semibold text-foreground text-sm">Evolución de Flujo de Caja</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Últimos 6 meses</p>
        </div>
      </div>

      <div className="p-5">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-muted-foreground text-sm">Sin datos suficientes para mostrar el gráfico</p>
            <p className="text-xs text-muted-foreground mt-1">Sube facturas y gastos para ver la evolución</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(350, 75%, 40%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(350, 75%, 40%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(215, 60%, 55%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(215, 60%, 55%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradResultado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(142, 60%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,88%)" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: 'hsl(0,0%,45%)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(0,0%,45%)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              />
              <Area
                type="monotone"
                dataKey="Ingresos"
                stroke="hsl(350, 75%, 40%)"
                strokeWidth={2}
                fill="url(#gradIngresos)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="Gastos"
                stroke="hsl(215, 60%, 55%)"
                strokeWidth={2}
                fill="url(#gradGastos)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="Resultado"
                stroke="hsl(142, 60%, 45%)"
                strokeWidth={2}
                strokeDasharray="4 2"
                fill="url(#gradResultado)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
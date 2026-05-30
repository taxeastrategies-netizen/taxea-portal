import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Layers } from 'lucide-react';

const CATEGORY_LABELS = {
  ventas_servicios: 'Ventas / Servicios',
  compras: 'Compras',
  suministros: 'Suministros',
  alquiler: 'Alquiler',
  publicidad_marketing: 'Publicidad y Marketing',
  servicios_profesionales: 'Servicios profesionales',
  software: 'Software',
  transporte: 'Transporte',
  dietas: 'Dietas',
  gastos_financieros: 'Gastos financieros',
  seguros: 'Seguros',
  otros: 'Otros',
};

// Taxea palette — distinct but consistent
const COLORS = [
  'hsl(350 72% 38%)',   // taxea-red
  'hsl(215 65% 52%)',   // blue
  'hsl(43 65% 48%)',    // gold
  'hsl(155 55% 42%)',   // green
  'hsl(270 50% 55%)',   // purple
  'hsl(25 75% 52%)',    // orange
  'hsl(340 60% 62%)',   // pink
  'hsl(190 55% 45%)',   // teal
  'hsl(60 55% 45%)',    // yellow-olive
  'hsl(0 55% 55%)',     // red-light
  'hsl(240 45% 55%)',   // indigo
  'hsl(100 45% 45%)',   // lime
];

function fmt(n) {
  return (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GastosPorCategoria({ invoices }) {
  const currentYear = new Date().getFullYear();

  const data = useMemo(() => {
    const map = {};

    // Solo facturas recibidas vía OCR con categoría asignada, del año actual
    (invoices || [])
      .filter(i =>
        i.tipo === 'recibida' &&
        i.categoria_gasto &&
        (i.anio === currentYear || new Date(i.fecha_emision || i.created_date).getFullYear() === currentYear)
      )
      .forEach(i => {
        const cat = i.categoria_gasto;
        map[cat] = (map[cat] || 0) + (i.base_imponible || 0);
      });

    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, value]) => ({
        cat,
        label: CATEGORY_LABELS[cat] || cat,
        value,
      }));
  }, [invoices, currentYear]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 bg-taxea-red/10 rounded-lg flex items-center justify-center">
          <Layers className="w-4 h-4 text-taxea-red" />
        </div>
        <h3 className="font-jakarta font-semibold text-foreground">Gastos por categoría <span className="text-xs font-normal text-muted-foreground">{new Date().getFullYear()}</span></h3>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Layers className="w-9 h-9 text-muted-foreground/20 mb-2" />
          <p className="text-xs text-muted-foreground">Sin facturas recibidas con categoría en {new Date().getFullYear()}</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Donut */}
          <div className="relative flex-shrink-0 w-44 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={data.length > 1 ? 2 : 0}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.cat} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(v, _, props) => [
                    `${fmt(v)} € (${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%)`,
                    props.payload.label,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-base font-bold text-foreground leading-tight">{fmt(total)} €</span>
              <span className="text-[10px] text-muted-foreground">Total</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 w-full space-y-1.5">
            {data.map((entry, i) => {
              const pct = total > 0 ? (entry.value / total) * 100 : 0;
              return (
                <div key={entry.cat} className="flex items-center gap-2.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-xs text-foreground flex-1 truncate">{entry.label}</span>
                  <span className="text-xs font-semibold text-foreground flex-shrink-0">
                    {fmt(entry.value)} €
                  </span>
                  <span className="text-xs text-muted-foreground w-10 text-right flex-shrink-0">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
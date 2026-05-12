import { useMemo } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function APForecast({ invoices, expenses, obligations }) {
  const now = new Date();

  const { forecast7, forecast30, forecastQ, byWeek, alerts } = useMemo(() => {
    const pending = invoices.filter(i => i.estado_cobro !== 'cobrada' && i.fecha_vencimiento);
    const pendingObl = obligations.filter(o => o.estado !== 'presentada' && o.fecha_limite);

    const forecast7 = pending.filter(i => {
      const d = differenceInDays(parseISO(i.fecha_vencimiento), now);
      return d >= -3 && d <= 7;
    }).reduce((s, i) => s + (i.total_factura || 0), 0);

    const forecast30 = pending.filter(i => {
      const d = differenceInDays(parseISO(i.fecha_vencimiento), now);
      return d >= -7 && d <= 30;
    }).reduce((s, i) => s + (i.total_factura || 0), 0);

    const forecastQ = pending.reduce((s, i) => s + (i.total_factura || 0), 0);

    // Por semana próximas 8 semanas
    const byWeek = Array.from({ length: 8 }, (_, w) => {
      const weekStart = w * 7;
      const weekEnd = weekStart + 7;
      const total = pending.filter(i => {
        const d = differenceInDays(parseISO(i.fecha_vencimiento), now);
        return d >= weekStart && d < weekEnd;
      }).reduce((s, i) => s + (i.total_factura || 0), 0);
      const oblTotal = pendingObl.filter(o => {
        const d = differenceInDays(parseISO(o.fecha_limite), now);
        return d >= weekStart && d < weekEnd;
      }).reduce((s, o) => s + (o.importe || 0), 0);
      return { week: w + 1, label: `Sem ${w + 1}`, total: total + oblTotal, facturas: total, obligaciones: oblTotal };
    });

    // Alertas
    const alerts = [];
    const maxWeek = byWeek.reduce((mx, w) => w.total > mx.total ? w : mx, byWeek[0] || { total: 0 });
    if (maxWeek?.total > 0) {
      alerts.push({ msg: `La semana ${maxWeek.week} concentra ${fmt(maxWeek.total)} en pagos. Revisa tu liquidez.`, level: 'warning' });
    }
    const totalPendingObl = pendingObl.slice(0, 3).reduce((s, o) => s + (o.importe || 0), 0);
    if (totalPendingObl > 0) {
      alerts.push({ msg: `Tienes ${fmt(totalPendingObl)} en obligaciones fiscales próximas. Asegúrate de tener liquidez suficiente.`, level: 'info' });
    }

    return { forecast7, forecast30, forecastQ, byWeek, alerts };
  }, [invoices, obligations]);

  const maxBar = Math.max(...byWeek.map(w => w.total), 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pagos próximos 7 días', value: fmt(forecast7), color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
          { label: 'Pagos próximos 30 días', value: fmt(forecast30), color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'Total deuda proveedores', value: fmt(forecastQ), color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
        ].map((c, i) => (
          <div key={i} className={cn("bg-white border rounded-2xl p-4 shadow-sm", c.border)}>
            <p className="text-[11px] text-slate-400 mb-1">{c.label}</p>
            <p className={cn("text-xl font-jakarta font-bold", c.color)}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Gráfico por semanas */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-1">Forecast de pagos — próximas 8 semanas</p>
        <p className="text-xs text-slate-400 mb-4">Facturas proveedores + obligaciones fiscales</p>
        <div className="flex items-end gap-2 h-36">
          {byWeek.map(w => {
            const h = maxBar > 0 ? (w.total / maxBar) * 100 : 0;
            const hasObl = w.obligaciones > 0;
            return (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {fmt(w.total)}
                </div>
                <div className="w-full rounded-t-lg overflow-hidden flex flex-col-reverse" style={{ height: `${Math.max(h, 4)}%` }}>
                  <div className={cn("w-full", hasObl ? "bg-amber-400" : "bg-taxea-red/60")} style={{ height: `${(w.facturas / (w.total || 1)) * 100}%` }} />
                  {hasObl && <div className="w-full bg-amber-600" style={{ height: `${(w.obligaciones / (w.total || 1)) * 100}%` }} />}
                </div>
                <span className="text-[9px] text-slate-400">{w.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-taxea-red/60" /><span className="text-[10px] text-slate-400">Facturas proveedores</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-amber-500" /><span className="text-[10px] text-slate-400">Obligaciones fiscales</span></div>
        </div>
      </div>

      {/* Alertas IA */}
      {alerts.map((a, i) => (
        <div key={i} className={cn("flex items-start gap-3 p-4 rounded-2xl border",
          a.level === 'warning' ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200")}>
          <AlertTriangle className={cn("w-4 h-4 flex-shrink-0 mt-0.5", a.level === 'warning' ? "text-amber-500" : "text-blue-500")} />
          <p className={cn("text-xs", a.level === 'warning' ? "text-amber-700" : "text-blue-700")}>⚠ {a.msg}</p>
        </div>
      ))}
    </div>
  );
}
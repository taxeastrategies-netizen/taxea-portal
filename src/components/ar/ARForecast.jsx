import { useMemo } from 'react';
import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function ARForecast({ invoices }) {
  const now = new Date();

  const { forecast7, forecast30, forecastQ, pendingByProb } = useMemo(() => {
    const pending = invoices.filter(i => i.estado_cobro === 'pendiente' && i.fecha_vencimiento);

    const getProbability = (inv) => {
      const dias = differenceInDays(now, parseISO(inv.fecha_vencimiento));
      if (dias < 0) return 'alta';
      if (dias < 30) return 'media';
      return 'baja';
    };

    const withProb = pending.map(i => ({ ...i, prob: getProbability(i) }));

    const forecast7 = withProb
      .filter(i => {
        const d = differenceInDays(parseISO(i.fecha_vencimiento), now);
        return d >= -7 && d <= 7;
      })
      .reduce((s, i) => s + (i.total_factura || 0) * (i.prob === 'alta' ? 0.9 : i.prob === 'media' ? 0.6 : 0.3), 0);

    const forecast30 = withProb
      .filter(i => {
        const d = differenceInDays(parseISO(i.fecha_vencimiento), now);
        return d >= -30 && d <= 30;
      })
      .reduce((s, i) => s + (i.total_factura || 0) * (i.prob === 'alta' ? 0.9 : i.prob === 'media' ? 0.6 : 0.3), 0);

    const forecastQ = withProb.reduce(
      (s, i) => s + (i.total_factura || 0) * (i.prob === 'alta' ? 0.9 : i.prob === 'media' ? 0.6 : 0.3), 0
    );

    const pendingByProb = {
      alta:  { items: withProb.filter(i => i.prob === 'alta'),  total: 0 },
      media: { items: withProb.filter(i => i.prob === 'media'), total: 0 },
      baja:  { items: withProb.filter(i => i.prob === 'baja'),  total: 0 },
    };
    Object.keys(pendingByProb).forEach(k => {
      pendingByProb[k].total = pendingByProb[k].items.reduce((s, i) => s + (i.total_factura || 0), 0);
    });

    return { forecast7, forecast30, forecastQ, pendingByProb };
  }, [invoices]);

  const PROB_CFG = {
    alta:  { label: 'Alta probabilidad',  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-400', factor: '×0.9' },
    media: { label: 'Media probabilidad', badge: 'bg-amber-50 text-amber-700 border-amber-200',       bar: 'bg-amber-400',   factor: '×0.6' },
    baja:  { label: 'Baja probabilidad',  badge: 'bg-red-50 text-red-700 border-red-200',             bar: 'bg-red-400',     factor: '×0.3' },
  };

  const total = pendingByProb.alta.total + pendingByProb.media.total + pendingByProb.baja.total;

  return (
    <div className="space-y-5">
      {/* Forecast resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Cash esperado 7 días', value: fmt(forecast7), sub: 'Probabilidad ajustada', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Cash esperado 30 días', value: fmt(forecast30), sub: 'Vencimientos próximos', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Cash esperado trimestre', value: fmt(forecastQ), sub: 'Total cartera pendiente', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
        ].map((c, i) => (
          <div key={i} className={cn("bg-white border rounded-2xl p-4 shadow-sm", c.border)}>
            <p className="text-[11px] text-slate-400 mb-1">{c.label}</p>
            <p className={cn("text-xl font-jakarta font-bold", c.color)}>{c.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Por probabilidad */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <p className="text-sm font-semibold text-foreground">Cartera por probabilidad de cobro</p>
        {total === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Sin facturas pendientes</p>
        ) : (
          Object.entries(PROB_CFG).map(([k, cfg]) => {
            const d = pendingByProb[k];
            const pct = total > 0 ? (d.total / total) * 100 : 0;
            return (
              <div key={k} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-lg border", cfg.badge)}>{cfg.label}</span>
                    <span className="text-[10px] text-slate-400">{cfg.factor}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-foreground">{fmt(d.total)}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">{d.items.length} fact.</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", cfg.bar)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Facturas próximas a vencer */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-foreground">Próximos vencimientos</p>
          <p className="text-xs text-slate-400 mt-0.5">Facturas con mayor probabilidad de cobro en los próximos 30 días</p>
        </div>
        <div className="divide-y divide-slate-50">
          {invoices
            .filter(i => i.estado_cobro === 'pendiente' && i.fecha_vencimiento)
            .filter(i => differenceInDays(parseISO(i.fecha_vencimiento), now) >= -5 && differenceInDays(parseISO(i.fecha_vencimiento), now) <= 30)
            .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))
            .slice(0, 8)
            .map(inv => {
              const d = differenceInDays(parseISO(inv.fecha_vencimiento), now);
              const isOverdue = d < 0;
              return (
                <div key={inv.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{inv.cliente_nombre}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{inv.numero_factura}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-foreground">{fmt(inv.total_factura)}</p>
                    <p className={cn("text-[10px] font-medium", isOverdue ? "text-red-500" : d <= 7 ? "text-amber-500" : "text-slate-400")}>
                      {isOverdue ? `Vencida hace ${Math.abs(d)}d` : d === 0 ? 'Vence hoy' : `Vence en ${d}d`}
                    </p>
                  </div>
                </div>
              );
            })}
          {invoices.filter(i => i.estado_cobro === 'pendiente' && i.fecha_vencimiento &&
            differenceInDays(parseISO(i.fecha_vencimiento), now) >= -5 &&
            differenceInDays(parseISO(i.fecha_vencimiento), now) <= 30).length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">No hay vencimientos en los próximos 30 días.</p>
          )}
        </div>
      </div>
    </div>
  );
}
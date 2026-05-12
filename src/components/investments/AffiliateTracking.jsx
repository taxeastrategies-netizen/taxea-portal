import { useMemo } from 'react';
import { format, parseISO, subDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { TrendingUp, MousePointer, Users, DollarSign } from 'lucide-react';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);
}

export default function AffiliateTracking({ clicks, partners, kpis }) {
  const now = new Date();

  const byPartner = useMemo(() => {
    const map = {};
    clicks.forEach(c => {
      if (!map[c.partner_id]) map[c.partner_id] = { id: c.partner_id, nombre: c.partner_nombre || c.partner_id, clicks: 0, registros: 0, conversiones: 0, ingresos: 0 };
      if (c.tipo_evento === 'click') map[c.partner_id].clicks++;
      if (c.tipo_evento === 'registro') map[c.partner_id].registros++;
      if (c.tipo_evento === 'conversion') map[c.partner_id].conversiones++;
      if (c.tipo_evento === 'payout') map[c.partner_id].ingresos += c.importe || 0;
    });
    return Object.values(map).sort((a, b) => b.conversiones - a.conversiones);
  }, [clicks]);

  const byDay = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = subDays(now, 29 - i);
      const label = format(d, 'dd/MM');
      const count = clicks.filter(c => {
        try { return format(parseISO(c.created_date), 'dd/MM') === label && c.tipo_evento === 'click'; } catch { return false; }
      }).length;
      return { label, count };
    });
    return days;
  }, [clicks]);

  const maxDay = Math.max(...byDay.map(d => d.count), 1);

  const conversionRate = kpis.totalClicks > 0 ? ((kpis.totalConversiones / kpis.totalClicks) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total clicks', value: kpis.totalClicks, icon: MousePointer, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Registros generados', value: kpis.totalRegistros, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
          { label: 'Conversiones', value: kpis.totalConversiones, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Ingresos afiliados', value: fmt(kpis.ingresos), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className={cn("bg-white border rounded-2xl p-4 shadow-sm", c.border)}>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-3", c.bg)}>
                <Icon className={cn("w-4 h-4", c.color)} />
              </div>
              <p className="text-[11px] text-slate-400 mb-1">{c.label}</p>
              <p className={cn("text-xl font-jakarta font-bold", c.color)}>{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Tasa conversión */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <div className="text-xs text-slate-400">Tasa de conversión global:</div>
        <div className={cn("text-2xl font-jakarta font-bold", parseFloat(conversionRate) > 5 ? "text-emerald-600" : parseFloat(conversionRate) > 2 ? "text-amber-600" : "text-red-500")}>
          {conversionRate}%
        </div>
        <div className="text-xs text-slate-400">({kpis.totalConversiones} conv. / {kpis.totalClicks} clicks)</div>
      </div>

      {/* Clicks últimos 30 días */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-4">Clicks — últimos 30 días</p>
        {clicks.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Sin datos de tracking aún.</p>
        ) : (
          <div className="flex items-end gap-0.5 h-24">
            {byDay.map((d, i) => {
              const h = (d.count / maxDay) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                  {d.count > 0 && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                      {d.count}
                    </div>
                  )}
                  <div className={cn("w-full rounded-t", d.count > 0 ? "bg-violet-400" : "bg-slate-100")} style={{ height: `${Math.max(h, 4)}%` }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Por partner */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-foreground">Rendimiento por partner</p>
        </div>
        {byPartner.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">Sin datos de tracking.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Partner', 'Clicks', 'Registros', 'Conversiones', 'Conv. Rate', 'Ingresos'].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-slate-400 uppercase px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byPartner.map((p, i) => {
                  const cr = p.clicks > 0 ? ((p.conversiones / p.clicks) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-xs font-semibold text-foreground">{p.nombre}</td>
                      <td className="px-4 py-3 text-xs text-foreground">{p.clicks}</td>
                      <td className="px-4 py-3 text-xs text-foreground">{p.registros}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-emerald-600">{p.conversiones}</td>
                      <td className="px-4 py-3 text-xs font-medium">{cr}%</td>
                      <td className="px-4 py-3 text-xs font-semibold text-amber-600">{fmt(p.ingresos)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
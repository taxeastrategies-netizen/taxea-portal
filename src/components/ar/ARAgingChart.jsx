import { useMemo } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

const BUCKETS = [
  { key: '0_30',  label: '0-30 días',   color: 'bg-emerald-400', textColor: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', min: 0,  max: 30 },
  { key: '30_60', label: '30-60 días',  color: 'bg-amber-400',   textColor: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   min: 30, max: 60 },
  { key: '60_90', label: '60-90 días',  color: 'bg-orange-400',  textColor: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  min: 60, max: 90 },
  { key: '90p',   label: '+90 días',    color: 'bg-red-500',     textColor: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     min: 90, max: 9999 },
];

export default function ARAgingChart({ invoices, contacts }) {
  const now = new Date();

  const { buckets, byClient } = useMemo(() => {
    const pending = invoices.filter(i => i.estado_cobro !== 'cobrada' && i.fecha_vencimiento);

    const buckets = BUCKETS.map(b => {
      const items = pending.filter(i => {
        const d = differenceInDays(now, parseISO(i.fecha_vencimiento));
        const dias = Math.max(0, d);
        return dias >= b.min && dias < b.max;
      });
      return { ...b, items, total: items.reduce((s, i) => s + (i.total_factura || 0), 0), count: items.length };
    });

    // Por cliente
    const clientMap = {};
    pending.forEach(i => {
      const k = i.cliente_nombre || 'Sin cliente';
      if (!clientMap[k]) clientMap[k] = { name: k, nif: i.cliente_nif, '0_30': 0, '30_60': 0, '60_90': 0, '90p': 0, total: 0 };
      const d = Math.max(0, differenceInDays(now, parseISO(i.fecha_vencimiento)));
      const bk = d < 30 ? '0_30' : d < 60 ? '30_60' : d < 90 ? '60_90' : '90p';
      clientMap[k][bk] += i.total_factura || 0;
      clientMap[k].total += i.total_factura || 0;
    });

    const byClient = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 12);
    return { buckets, byClient };
  }, [invoices]);

  const totalGlobal = buckets.reduce((s, b) => s + b.total, 0);

  return (
    <div className="space-y-6">
      {/* Resumen buckets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {buckets.map(b => (
          <div key={b.key} className={cn("bg-white border rounded-2xl p-4 shadow-sm", b.border)}>
            <div className={cn("w-3 h-3 rounded-full mb-3", b.color)} />
            <p className="text-[11px] text-slate-400 mb-1">{b.label}</p>
            <p className={cn("text-xl font-jakarta font-bold", b.textColor)}>{fmt(b.total)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{b.count} facturas</p>
          </div>
        ))}
      </div>

      {/* Barra visual aging */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-4">Distribución del saldo pendiente</p>
        {totalGlobal === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No hay facturas pendientes de cobro.</p>
        ) : (
          <div className="space-y-3">
            {buckets.map(b => {
              const pct = totalGlobal > 0 ? (b.total / totalGlobal) * 100 : 0;
              return (
                <div key={b.key} className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 w-20 flex-shrink-0">{b.label}</span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", b.color)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-24 text-right">{fmt(b.total)}</span>
                  <span className="text-[10px] text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aging por cliente */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-foreground">Aging por cliente</p>
          <p className="text-xs text-slate-400 mt-0.5">Desglose de deuda pendiente por tramos de vencimiento</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-[10px] font-semibold text-slate-400 uppercase px-4 py-3">Cliente</th>
                {BUCKETS.map(b => (
                  <th key={b.key} className="text-right text-[10px] font-semibold text-slate-400 uppercase px-4 py-3">{b.label}</th>
                ))}
                <th className="text-right text-[10px] font-semibold text-slate-400 uppercase px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {byClient.length === 0 && (
                <tr><td colSpan={6} className="text-center text-xs text-slate-400 py-8">Sin datos de cobro pendientes</td></tr>
              )}
              {byClient.map((c, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground">{c.name}</p>
                    {c.nif && <p className="text-[10px] text-slate-400">{c.nif}</p>}
                  </td>
                  {BUCKETS.map(b => (
                    <td key={b.key} className="px-4 py-3 text-right">
                      {c[b.key] > 0
                        ? <span className={cn("text-xs font-semibold", b.textColor)}>{fmt(c[b.key])}</span>
                        : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-bold text-foreground">{fmt(c.total)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* IA insight */}
      {buckets[3].total > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-lg flex-shrink-0">⚠️</span>
          <div>
            <p className="text-xs font-semibold text-red-700">Alerta IA — Aging crítico</p>
            <p className="text-xs text-red-600 mt-0.5">
              Tienes {fmt(buckets[3].total)} en facturas con más de 90 días de retraso. La probabilidad de cobro cae por debajo del 40% a partir de los 90 días. Considera iniciar proceso de reclamación formal.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
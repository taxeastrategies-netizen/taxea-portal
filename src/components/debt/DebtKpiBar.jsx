import { TrendingDown, DollarSign, AlertTriangle, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function DebtKpiBar({ kpis }) {
  const disponible = (kpis.limiteTotal || 0) - (kpis.dispuestoTotal || 0);
  const util = kpis.limiteTotal > 0 ? ((kpis.dispuestoTotal / kpis.limiteTotal) * 100).toFixed(0) : 0;

  const cards = [
    {
      label: 'Deuda total activa',
      value: fmt(kpis.deudaTotal),
      sub: `${kpis.count} instrumentos activos`,
      icon: TrendingDown,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
    },
    {
      label: 'Cuota mensual total',
      value: fmt(kpis.cuotaMensual),
      sub: 'Salida mensual fija de caja',
      icon: DollarSign,
      color: 'text-slate-700',
      bg: 'bg-slate-100',
      border: 'border-slate-200',
    },
    {
      label: 'Coste financiero anual',
      value: fmt(kpis.interesesAnuales),
      sub: kpis.ebitda > 0 ? `${((kpis.interesesAnuales / kpis.ebitda) * 100).toFixed(1)}% del EBITDA` : 'Intereses totales estimados',
      icon: AlertTriangle,
      color: kpis.interesesAnuales / Math.max(kpis.ebitda, 1) > 0.2 ? 'text-red-600' : 'text-amber-600',
      bg: kpis.interesesAnuales / Math.max(kpis.ebitda, 1) > 0.2 ? 'bg-red-50' : 'bg-amber-50',
      border: kpis.interesesAnuales / Math.max(kpis.ebitda, 1) > 0.2 ? 'border-red-100' : 'border-amber-100',
    },
    {
      label: 'Líneas crédito disponible',
      value: fmt(disponible),
      sub: kpis.limiteTotal > 0 ? `${util}% utilizado de ${fmt(kpis.limiteTotal)}` : 'Sin líneas de crédito',
      icon: CreditCard,
      color: disponible > 0 ? 'text-emerald-600' : 'text-slate-400',
      bg: disponible > 0 ? 'bg-emerald-50' : 'bg-slate-50',
      border: disponible > 0 ? 'border-emerald-100' : 'border-slate-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className={cn("bg-white border rounded-2xl p-4 shadow-sm", c.border)}>
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-3", c.bg)}>
              <Icon className={cn("w-4 h-4", c.color)} />
            </div>
            <p className="text-[11px] text-slate-400 mb-1">{c.label}</p>
            <p className={cn("text-xl font-jakarta font-bold", c.color)}>{c.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
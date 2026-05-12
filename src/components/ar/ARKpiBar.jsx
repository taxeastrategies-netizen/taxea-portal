import { TrendingUp, AlertTriangle, Clock, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function ARKpiBar({ kpis }) {
  const cards = [
    {
      label: 'Total pendiente cobro',
      value: fmt(kpis.total_pendiente),
      sub: `${kpis.count_pendientes} facturas`,
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
    },
    {
      label: 'Vencido sin cobrar',
      value: fmt(kpis.total_vencido),
      sub: `${kpis.count_vencidas} facturas vencidas`,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100',
    },
    {
      label: 'En riesgo alto (+30d)',
      value: fmt(kpis.total_riesgo),
      sub: 'Requiere acción inmediata',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-100',
    },
    {
      label: 'DSO actual',
      value: `${kpis.dso} días`,
      sub: 'Days Sales Outstanding',
      icon: Clock,
      color: kpis.dso <= 35 ? 'text-emerald-600' : kpis.dso <= 55 ? 'text-amber-600' : 'text-red-600',
      bg: kpis.dso <= 35 ? 'bg-emerald-50' : kpis.dso <= 55 ? 'bg-amber-50' : 'bg-red-50',
      border: kpis.dso <= 35 ? 'border-emerald-100' : kpis.dso <= 55 ? 'border-amber-100' : 'border-red-100',
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
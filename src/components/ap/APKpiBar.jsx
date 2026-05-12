import { Wallet, AlertTriangle, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function APKpiBar({ kpis }) {
  const cards = [
    {
      label: 'Total pendiente pago',
      value: fmt(kpis.total_pendiente),
      sub: `${kpis.count_pendientes} facturas`,
      icon: Wallet,
      color: 'text-slate-700',
      bg: 'bg-slate-100',
      border: 'border-slate-200',
    },
    {
      label: 'Pagos vencidos',
      value: fmt(kpis.total_vencido),
      sub: `${kpis.count_vencidas} facturas vencidas`,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100',
    },
    {
      label: 'Vence próximos 7 días',
      value: fmt(kpis.proximos7),
      sub: 'Salidas inminentes de caja',
      icon: Zap,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
    },
    {
      label: 'DPO actual',
      value: `${kpis.dpo} días`,
      sub: 'Days Payable Outstanding',
      icon: Clock,
      color: kpis.dpo >= 40 ? 'text-emerald-600' : kpis.dpo >= 25 ? 'text-amber-600' : 'text-red-600',
      bg: kpis.dpo >= 40 ? 'bg-emerald-50' : kpis.dpo >= 25 ? 'bg-amber-50' : 'bg-red-50',
      border: kpis.dpo >= 40 ? 'border-emerald-100' : kpis.dpo >= 25 ? 'border-amber-100' : 'border-red-100',
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
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, ArrowUpCircle, ArrowDownCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { classifyObligations, daysBetween, obligationDay } from '@/lib/reportingPeriods.mjs';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

function Widget({ icon: WidgetIcon, iconColor, iconBg, title, items, emptyText, delay }) {
  const Icon = WidgetIcon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card border border-border rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", iconBg)}>
          <Icon className={cn("w-3.5 h-3.5", iconColor)} />
        </div>
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <Link key={i} to={item.to || "#"} onClick={item.to ? undefined : event => event.preventDefault()} tabIndex={item.to ? 0 : -1} className={cn("flex items-center justify-between gap-2", item.to && "hover:text-primary underline-offset-2 hover:underline")}>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", item.dotColor)} />
                <span className="text-xs text-muted-foreground truncate">{item.label}</span>
              </div>
              <span className="text-xs font-semibold text-foreground flex-shrink-0">{item.value}</span>
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function SmartWidgets({ financials, obligations, calendarError = false }) {
  const { cobrosPendientes, pagosPendientes, vencidas } = financials;

  const dates = classifyObligations(obligations);
  const upcomingObl = dates.upcoming.slice(0, 4);

  const oblItems = upcomingObl.map(o => {
    const days = daysBetween(dates.today, obligationDay(o));
    return {
      label: `${(o.modelo || '').replace('modelo_', 'M. ')} · ${o.periodo || ''}`,
      value: `${days}d`,
      dotColor: days <= 7 ? 'bg-red-500' : 'bg-amber-500',
    };
  });

  const widgets = [
    {
      icon: Calendar,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
      title: 'Obligaciones próximas',
      items: oblItems,
      emptyText: calendarError ? 'Calendario no disponible: revisa las obligaciones' : 'Sin vencimientos en los próximos 30 días',
      delay: 0,
    },
    {
      icon: ArrowUpCircle,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-500/10',
      title: 'Cobros pendientes',
      items: cobrosPendientes > 0 ? [
        { label: 'Total a cobrar', value: fmt(cobrosPendientes), dotColor: 'bg-emerald-500' },
        { label: 'Facturas vencidas', value: `${vencidas.length}`, dotColor: vencidas.length > 0 ? 'bg-red-500' : 'bg-emerald-500' },
      ] : [],
      emptyText: financials.financialError ? 'Cobros no disponibles' : 'Sin cobros pendientes',
      delay: 0.05,
    },
    {
      icon: ArrowDownCircle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
      title: 'Pagos pendientes',
      items: pagosPendientes > 0 ? [
        { label: 'Total a pagar', value: fmt(pagosPendientes), dotColor: 'bg-red-500' },
      ] : [],
      emptyText: financials.financialError ? 'Pagos no disponibles' : 'Sin pagos pendientes',
      delay: 0.1,
    },
    {
      icon: AlertCircle,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      title: 'Acciones rápidas',
      items: [
        { label: 'Centro de tesorería', value: '→', dotColor: 'bg-blue-500', to: '/finance/cashflow' },
        { label: 'Revisar cobros', value: '→', dotColor: 'bg-emerald-500', to: '/finance/ar' },
        { label: 'Ver impuestos', value: '→', dotColor: 'bg-amber-500', to: '/tax-accounting/obligaciones' },
        { label: 'Libros e informes', value: '→', dotColor: 'bg-violet-500', to: '/tax-accounting/libros' },
      ],
      emptyText: '',
      delay: 0.15,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {widgets.map((w) => (
        <Widget key={w.title} {...w} />
      ))}
    </div>
  );
}
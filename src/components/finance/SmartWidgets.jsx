import { motion } from 'framer-motion';
import { Calendar, ArrowUpCircle, ArrowDownCircle, AlertCircle, BarChart3, Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';

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
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", item.dotColor)} />
                <span className="text-xs text-muted-foreground truncate">{item.label}</span>
              </div>
              <span className="text-xs font-semibold text-foreground flex-shrink-0">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function SmartWidgets({ financials, obligations }) {
  const { cobrosPendientes, pagosPendientes, vencidas } = financials;

  // Upcoming obligations (next 30 days)
  const upcomingObl = (obligations || [])
    .filter(o => {
      try {
        const d = parseISO(o.fecha_limite);
        const days = Math.ceil((d - new Date()) / 86400000);
        return days >= 0 && days <= 30 && o.estado !== 'finalizado';
      } catch { return false; }
    })
    .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))
    .slice(0, 4);

  const oblItems = upcomingObl.map(o => {
    const days = Math.ceil((new Date(o.fecha_limite) - new Date()) / 86400000);
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
      emptyText: 'Sin vencimientos próximos',
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
      emptyText: 'Sin cobros pendientes',
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
      emptyText: 'Sin pagos pendientes',
      delay: 0.1,
    },
    {
      icon: AlertCircle,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      title: 'Acciones rápidas',
      items: [
        { label: 'Ver forecast', value: '→', dotColor: 'bg-blue-500' },
        { label: 'Revisar cobros', value: '→', dotColor: 'bg-emerald-500' },
        { label: 'Ver impuestos', value: '→', dotColor: 'bg-amber-500' },
        { label: 'Exportar informe', value: '→', dotColor: 'bg-violet-500' },
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
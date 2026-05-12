import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowUpRight, ArrowDownRight, AlertCircle, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function buildTimelineItems(invoices, expenses, obligations) {
  const items = [];

  invoices.slice(0, 20).forEach(inv => {
    const date = inv.fecha_emision || inv.fecha_vencimiento;
    if (!date) return;
    items.push({
      id: inv.id,
      type: inv.tipo === 'emitida' ? 'cobro' : 'pago',
      label: inv.tipo === 'emitida' ? `Factura a ${inv.cliente_nombre || '—'}` : `Pago a ${inv.cliente_nombre || '—'}`,
      amount: inv.total_factura,
      date,
      status: inv.estado_cobro,
    });
  });

  expenses.slice(0, 10).forEach(exp => {
    if (!exp.fecha) return;
    items.push({
      id: exp.id,
      type: 'gasto',
      label: exp.concepto || 'Gasto',
      amount: exp.total,
      date: exp.fecha,
      status: exp.estado,
    });
  });

  obligations.slice(0, 8).forEach(ob => {
    if (!ob.fecha_limite) return;
    items.push({
      id: ob.id,
      type: 'impuesto',
      label: ob.modelo?.replace(/_/g, ' ').toUpperCase() || 'Obligación fiscal',
      amount: ob.importe || 0,
      date: ob.fecha_limite,
      status: ob.estado,
    });
  });

  return items.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 18);
}

const typeConfig = {
  cobro: { icon: ArrowUpRight, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Cobro', sign: '+' },
  pago: { icon: ArrowDownRight, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pago', sign: '-' },
  gasto: { icon: ArrowDownRight, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Gasto', sign: '-' },
  impuesto: { icon: AlertCircle, color: 'text-violet-400', bg: 'bg-violet-500/10', label: 'Impuesto', sign: '-' },
};

export default function CashflowTimeline({ invoices, expenses, obligations }) {
  const items = buildTimelineItems(invoices, expenses, obligations);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-2xl bg-[#0d0d10] border border-white/8 p-5"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-4 h-4 text-white/40" />
        <h3 className="text-sm font-semibold text-white">Timeline Tesorería</h3>
        <span className="ml-auto text-xs text-white/25">{items.length} movimientos</span>
      </div>

      {/* Feed */}
      {items.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-white/25">Sin movimientos registrados</p>
        </div>
      ) : (
        <div className="space-y-0">
          {items.map((item, i) => {
            const cfg = typeConfig[item.type] || typeConfig.gasto;
            const Icon = cfg.icon;
            const dateStr = (() => {
              try { return format(parseISO(item.date), "d MMM", { locale: es }); }
              catch { return item.date; }
            })();
            return (
              <motion.div
                key={item.id || i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 py-2.5 border-b border-white/4 last:border-0 hover:bg-white/3 rounded-lg px-2 transition-all group"
              >
                {/* Icon */}
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", cfg.bg)}>
                  <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/65 group-hover:text-white/85 transition-colors truncate font-medium">{item.label}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{dateStr} · {cfg.label}</p>
                </div>

                {/* Amount */}
                <p className={cn("text-xs font-semibold flex-shrink-0", cfg.color)}>
                  {cfg.sign}{item.amount ? fmt(item.amount) : '—'}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
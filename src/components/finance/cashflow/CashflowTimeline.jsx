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
    items.push({ id: inv.id, type: inv.tipo === 'emitida' ? 'cobro' : 'pago',
      label: inv.tipo === 'emitida' ? `Factura a ${inv.cliente_nombre || '—'}` : `Pago a ${inv.cliente_nombre || '—'}`,
      amount: inv.total_factura, date, status: inv.estado_cobro });
  });
  expenses.slice(0, 10).forEach(exp => {
    if (!exp.fecha) return;
    items.push({ id: exp.id, type: 'gasto', label: exp.concepto || 'Gasto', amount: exp.total, date: exp.fecha, status: exp.estado });
  });
  obligations.slice(0, 8).forEach(ob => {
    if (!ob.fecha_limite) return;
    items.push({ id: ob.id, type: 'impuesto',
      label: ob.modelo?.replace(/_/g, ' ').toUpperCase() || 'Obligación fiscal',
      amount: ob.importe || 0, date: ob.fecha_limite, status: ob.estado });
  });
  return items.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 18);
}

const typeConfig = {
  cobro:    { icon: ArrowUpRight,  bg: 'bg-emerald-50', border: 'border-emerald-100', icon_color: 'text-emerald-600', sign: '+', amount_color: 'text-emerald-600', label: 'Cobro' },
  pago:     { icon: ArrowDownRight,bg: 'bg-amber-50',   border: 'border-amber-100',   icon_color: 'text-amber-600',   sign: '-', amount_color: 'text-amber-600',   label: 'Pago' },
  gasto:    { icon: ArrowDownRight,bg: 'bg-red-50',     border: 'border-red-100',     icon_color: 'text-red-500',     sign: '-', amount_color: 'text-red-500',     label: 'Gasto' },
  impuesto: { icon: AlertCircle,   bg: 'bg-violet-50',  border: 'border-violet-100',  icon_color: 'text-violet-600',  sign: '-', amount_color: 'text-violet-600',  label: 'Impuesto' },
};

export default function CashflowTimeline({ invoices, expenses, obligations }) {
  const items = buildTimelineItems(invoices, expenses, obligations);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-foreground">Timeline Tesorería</h3>
        <span className="ml-auto text-xs text-slate-400">{items.length} movimientos</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-slate-400">Sin movimientos registrados</p>
        </div>
      ) : (
        <div className="space-y-0">
          {items.map((item, i) => {
            const cfg = typeConfig[item.type] || typeConfig.gasto;
            const Icon = cfg.icon;
            const dateStr = (() => { try { return format(parseISO(item.date), "d MMM", { locale: es }); } catch { return item.date; } })();
            return (
              <motion.div key={item.id || i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded-lg px-2 transition-all group">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border", cfg.bg, cfg.border)}>
                  <Icon className={cn("w-3.5 h-3.5", cfg.icon_color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 group-hover:text-slate-900 transition-colors truncate font-medium">{item.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{dateStr} · {cfg.label}</p>
                </div>
                <p className={cn("text-xs font-semibold flex-shrink-0", cfg.amount_color)}>
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
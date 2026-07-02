import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpCircle, ArrowDownCircle, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { format, parseISO, isAfter, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function FinancialTimeline({ invoices, expenses, obligations }) {
  const events = useMemo(() => {
    const cutoff = subDays(new Date(), 30);
    const list = [];

    // Recent invoices emitidas
    invoices
      .filter(i => i.tipo === 'emitida' && !i.anulada)
      .slice(-8)
      .forEach(i => {
        try {
          list.push({
            id: `inv-${i.id}`,
            date: parseISO(i.fecha_emision),
            type: i.estado_cobro === 'cobrada' ? 'cobro' : 'pendiente',
            icon: i.estado_cobro === 'cobrada' ? CheckCircle2 : ArrowUpCircle,
            color: i.estado_cobro === 'cobrada' ? 'text-emerald-500' : 'text-blue-500',
            bg: i.estado_cobro === 'cobrada' ? 'bg-emerald-500/10' : 'bg-blue-500/10',
            label: i.estado_cobro === 'cobrada' ? 'Cobro recibido' : 'Factura pendiente cobro',
            detail: `${i.cliente_nombre || 'Cliente'} · ${fmt(i.total_factura)}`,
            amount: i.total_factura,
            sign: '+',
          });
        } catch { /* skip */ }
      });

    // Recent expenses
    expenses.filter(e => !e.anulada).slice(-5).forEach(e => {
      try {
        list.push({
          id: `exp-${e.id}`,
          date: parseISO(e.fecha),
          type: 'pago',
          icon: ArrowDownCircle,
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          label: 'Gasto registrado',
          detail: `${e.concepto || 'Gasto'} · ${fmt(e.total)}`,
          amount: e.total,
          sign: '-',
        });
      } catch { /* skip */ }
    });

    // Upcoming obligations
    obligations.slice(0, 4).forEach(o => {
      try {
        const d = parseISO(o.fecha_limite);
        if (isAfter(d, subDays(new Date(), 1))) {
          list.push({
            id: `obl-${o.id}`,
            date: d,
            type: 'fiscal',
            icon: Calendar,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            label: 'Obligación fiscal',
            detail: `${(o.modelo || '').replace('modelo_', 'Modelo ').replace('_', ' ')} · ${o.periodo || ''}`,
            amount: o.importe,
            sign: o.importe ? '-' : '',
          });
        }
      } catch { /* skip */ }
    });

    return list
      .sort((a, b) => b.date - a.date)
      .slice(0, 12);
  }, [invoices, expenses, obligations]);

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Clock className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Timeline Financiero</h3>
          <p className="text-xs text-muted-foreground">Movimientos y vencimientos recientes</p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Sin movimientos recientes</p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
          {events.map((ev, i) => {
            const Icon = ev.icon;
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative flex gap-3 pb-3 group"
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 z-10 border border-white/5", ev.bg)}>
                  <Icon className={cn("w-4 h-4", ev.color)} />
                </div>
                <div className="flex-1 min-w-0 pt-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">{ev.label}</p>
                    {ev.amount && (
                      <span className={cn("text-xs font-bold flex-shrink-0", ev.sign === '+' ? 'text-emerald-600' : 'text-red-500')}>
                        {ev.sign}{fmt(ev.amount)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{ev.detail}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {format(ev.date, "d MMM yyyy", { locale: es })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
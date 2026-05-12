import { useMemo, useState } from 'react';
import { differenceInDays, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function APCalendar({ invoices, expenses, obligations }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const events = useMemo(() => {
    const evs = [];
    invoices.filter(i => i.estado_cobro !== 'cobrada' && i.fecha_vencimiento).forEach(i => {
      evs.push({ date: i.fecha_vencimiento, label: i.cliente_nombre || i.numero_factura, amount: i.total_factura || 0, type: 'factura' });
    });
    obligations.filter(o => o.estado !== 'presentada' && o.fecha_limite).forEach(o => {
      evs.push({ date: o.fecha_limite, label: o.modelo || 'Obligación fiscal', amount: o.importe || 0, type: 'fiscal' });
    });
    return evs;
  }, [invoices, obligations]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startDow = startOfMonth(currentMonth).getDay();
  const paddingDays = startDow === 0 ? 6 : startDow - 1;

  const getEventsForDay = (day) => events.filter(e => isSameDay(parseISO(e.date), day));

  const totalMonth = useMemo(() => {
    return events.filter(e => {
      const d = parseISO(e.date);
      return d >= startOfMonth(currentMonth) && d <= endOfMonth(currentMonth);
    }).reduce((s, e) => s + e.amount, 0);
  }, [events, currentMonth]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-foreground capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Total pagos este mes: <span className="font-semibold text-taxea-red">{fmt(totalMonth)}</span></p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </button>
            <button onClick={() => setCurrentMonth(new Date())}
              className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Hoy</button>
            <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: paddingDays }).map((_, i) => (
            <div key={`pad-${i}`} className="h-14" />
          ))}
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, new Date());
            const totalDay = dayEvents.reduce((s, e) => s + e.amount, 0);
            const hasFiscal = dayEvents.some(e => e.type === 'fiscal');
            const hasFactura = dayEvents.some(e => e.type === 'factura');

            return (
              <div key={day.toString()}
                className={cn(
                  "h-14 rounded-xl p-1 flex flex-col relative transition-colors",
                  isToday ? "bg-taxea-red/8 border border-taxea-red/20" : "hover:bg-slate-50",
                  dayEvents.length > 0 ? "cursor-pointer" : ""
                )}>
                <span className={cn("text-[11px] font-medium text-right w-full", isToday ? "text-taxea-red font-bold" : "text-slate-500")}>
                  {format(day, 'd')}
                </span>
                {dayEvents.length > 0 && (
                  <div className="flex-1 flex flex-col gap-0.5 mt-0.5">
                    {hasFiscal && (
                      <div className="h-1.5 w-full rounded-full bg-amber-400" title="Obligación fiscal" />
                    )}
                    {hasFactura && (
                      <div className="h-1.5 w-full rounded-full bg-red-400" title="Pago proveedor" />
                    )}
                    {totalDay > 0 && (
                      <span className="text-[8px] text-slate-500 font-medium truncate">{fmt(totalDay)}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-1.5 rounded bg-red-400" /><span className="text-[10px] text-slate-400">Pago proveedor</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-1.5 rounded bg-amber-400" /><span className="text-[10px] text-slate-400">Obligación fiscal</span></div>
        </div>
      </div>

      {/* Lista del mes */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-foreground">Pagos del mes ordenados por fecha</p>
        </div>
        <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
          {events
            .filter(e => {
              const d = parseISO(e.date);
              return d >= startOfMonth(currentMonth) && d <= endOfMonth(currentMonth);
            })
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", e.type === 'fiscal' ? "bg-amber-400" : "bg-red-400")} />
                  <div>
                    <p className="text-xs font-medium text-foreground">{e.label}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{format(parseISO(e.date), "d 'de' MMMM", { locale: es })}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-foreground">{fmt(e.amount)}</span>
              </div>
            ))}
          {events.filter(e => {
            const d = parseISO(e.date);
            return d >= startOfMonth(currentMonth) && d <= endOfMonth(currentMonth);
          }).length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">Sin pagos programados este mes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
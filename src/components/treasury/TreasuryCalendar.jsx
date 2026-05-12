import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

const EVENT_TYPES = {
  cobro_previsto:      { color: 'bg-emerald-500',  text: 'text-emerald-600', dot: 'bg-emerald-400', label: 'Cobro' },
  pago_previsto:       { color: 'bg-red-400',       text: 'text-red-500',     dot: 'bg-red-400',     label: 'Pago' },
  transferencia_interna:{ color: 'bg-blue-500',     text: 'text-blue-600',    dot: 'bg-blue-400',    label: 'Trans.' },
  impuesto:            { color: 'bg-amber-500',     text: 'text-amber-600',   dot: 'bg-amber-400',   label: 'Impuesto' },
  cuota_prestamo:      { color: 'bg-violet-500',    text: 'text-violet-600',  dot: 'bg-violet-400',  label: 'Préstamo' },
  nomina:              { color: 'bg-pink-500',      text: 'text-pink-600',    dot: 'bg-pink-400',    label: 'Nómina' },
};

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function TreasuryCalendar({ events, obligations }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selected, setSelected] = useState(null);

  const allEvents = useMemo(() => {
    const evs = (events || []).map(e => ({
      id: e.id, date: e.fecha_prevista, tipo: e.tipo, concepto: e.concepto, importe: e.importe, estado: e.estado,
    }));
    const obls = (obligations || []).filter(o => o.fecha_limite && o.estado !== 'finalizado').map(o => ({
      id: o.id, date: o.fecha_limite, tipo: 'impuesto', concepto: o.modelo?.replace(/_/g, ' ').toUpperCase() || 'Obligación', importe: o.importe || 0, estado: o.estado,
    }));
    return [...evs, ...obls];
  }, [events, obligations]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const startDay = start.getDay() === 0 ? 6 : start.getDay() - 1;
    const days = eachDayOfInterval({ start, end });
    const prefix = Array(startDay).fill(null);
    return [...prefix, ...days];
  }, [currentMonth]);

  const getEventsForDay = (day) => {
    if (!day) return [];
    return allEvents.filter(e => { try { return isSameDay(parseISO(e.date), day); } catch { return false; } });
  };

  const selectedDayEvents = selected ? getEventsForDay(selected) : [];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-foreground">Calendario de Tesorería</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-sm font-semibold text-foreground capitalize min-w-[110px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(EVENT_TYPES).slice(0, 5).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", v.dot)} />
            <span className="text-[10px] text-slate-400">{v.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] text-slate-400 font-semibold py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dayEvents = getEventsForDay(day);
          const isToday = isSameDay(day, new Date());
          const isSelected = selected && isSameDay(day, selected);
          return (
            <button key={i} onClick={() => setSelected(isSelected ? null : day)}
              className={cn("relative aspect-square rounded-xl flex flex-col items-center justify-start pt-1 gap-0.5 transition-all hover:bg-slate-50",
                isToday && "ring-2 ring-taxea-red/30",
                isSelected && "bg-taxea-red/8",
                !isSameMonth(day, currentMonth) && "opacity-30")}>
              <span className={cn("text-[11px] font-medium", isToday ? 'text-taxea-red font-bold' : isSelected ? 'text-taxea-red' : 'text-slate-600')}>
                {format(day, 'd')}
              </span>
              <div className="flex flex-wrap justify-center gap-0.5 px-0.5">
                {dayEvents.slice(0, 3).map((e, j) => {
                  const cfg = EVENT_TYPES[e.tipo] || EVENT_TYPES.pago_previsto;
                  return <span key={j} className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />;
                })}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day */}
      {selected && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 mb-2 capitalize">{format(selected, 'd MMMM yyyy', { locale: es })}</p>
          {selectedDayEvents.length === 0 ? (
            <p className="text-xs text-slate-300 text-center py-4">Sin eventos este día</p>
          ) : (
            <div className="space-y-2">
              {selectedDayEvents.map((e, i) => {
                const cfg = EVENT_TYPES[e.tipo] || EVENT_TYPES.pago_previsto;
                return (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
                    <span className="flex-1 text-xs text-slate-700 truncate">{e.concepto}</span>
                    <span className={cn("text-xs font-semibold", cfg.text)}>{fmt(e.importe)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, addMonths, subMonths, parseISO, differenceInDays, addMonths as addM } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

const TIPO_COLOR = {
  prestamo_bancario: { dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  ico:               { dot: 'bg-taxea-red', badge: 'bg-taxea-red/8 text-taxea-red border-taxea-red/20' },
  leasing:           { dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  renting:           { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  linea_credito:     { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  poliza:            { dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
};

function getMonthlyEvents(debts, monthDate) {
  const events = [];
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  debts.filter(d => d.estado === 'activo' && d.cuota > 0 && d.fecha_inicio).forEach(d => {
    // Cuotas periódicas
    const start = parseISO(d.fecha_inicio);
    const mult = d.periodicidad === 'mensual' ? 1 : d.periodicidad === 'trimestral' ? 3 : d.periodicidad === 'semestral' ? 6 : 12;
    // Find cuota date in this month
    let cur = new Date(start);
    while (cur <= monthEnd) {
      if (cur >= monthStart && cur <= monthEnd) {
        events.push({ date: new Date(cur), label: d.nombre, amount: d.cuota, tipo: d.tipo, kind: 'cuota' });
      }
      cur = addM(cur, mult);
    }
    // Vencimiento
    if (d.fecha_vencimiento) {
      const venc = parseISO(d.fecha_vencimiento);
      if (venc >= monthStart && venc <= monthEnd) {
        events.push({ date: venc, label: `Vencimiento: ${d.nombre}`, amount: d.capital_pendiente || d.importe_inicial, tipo: d.tipo, kind: 'vencimiento' });
      }
    }
  });
  return events;
}

export default function DebtCalendar({ debts }) {
  const [month, setMonth] = useState(new Date());
  const [view, setView] = useState('mes');

  const events = useMemo(() => getMonthlyEvents(debts, month), [debts, month]);

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const startDow = startOfMonth(month).getDay();
  const paddingDays = startDow === 0 ? 6 : startDow - 1;

  const getEventsForDay = d => events.filter(e => isSameDay(e.date, d));
  const totalMonth = events.filter(e => e.kind === 'cuota').reduce((s, e) => s + e.amount, 0);

  // Next 12 months summary
  const monthSummary = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = addM(new Date(), i);
      const evs = getMonthlyEvents(debts, m);
      const total = evs.filter(e => e.kind === 'cuota').reduce((s, e) => s + e.amount, 0);
      return { month: m, label: format(m, 'MMM yy', { locale: es }), total };
    });
  }, [debts]);

  const maxMonth = Math.max(...monthSummary.map(m => m.total), 1);

  return (
    <div className="space-y-5">
      {/* Tabs vista */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {['mes', 'forecast_12m'].map(v => (
          <button key={v} onClick={() => setView(v)}
            className={cn("px-3.5 py-2 rounded-lg text-xs font-medium transition-all",
              view === v ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {v === 'mes' ? 'Vista mensual' : 'Forecast 12 meses'}
          </button>
        ))}
      </div>

      {view === 'mes' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground capitalize">
                {format(month, 'MMMM yyyy', { locale: es })}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Total cuotas: <span className="font-bold text-taxea-red">{fmt(totalMonth)}</span></p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>
              <button onClick={() => setMonth(new Date())} className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Hoy</button>
              <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: paddingDays }).map((_, i) => <div key={`p${i}`} className="h-16" />)}
            {days.map(day => {
              const dayEvs = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toString()}
                  className={cn("h-16 rounded-xl p-1 flex flex-col transition-colors",
                    isToday ? "bg-taxea-red/8 border border-taxea-red/20" : "hover:bg-slate-50",
                    dayEvs.length > 0 ? "cursor-pointer" : "")}>
                  <span className={cn("text-[11px] font-medium text-right w-full", isToday ? "text-taxea-red font-bold" : "text-slate-500")}>
                    {format(day, 'd')}
                  </span>
                  <div className="flex-1 space-y-0.5 mt-0.5 overflow-hidden">
                    {dayEvs.slice(0, 2).map((e, i) => {
                      const tc = TIPO_COLOR[e.tipo] || { dot: 'bg-slate-400' };
                      return (
                        <div key={i} className={cn("flex items-center gap-1 rounded px-1", e.kind === 'vencimiento' ? 'bg-red-50' : '')}>
                          <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", tc.dot)} />
                          <span className="text-[8px] text-slate-500 truncate">{fmt(e.amount)}</span>
                        </div>
                      );
                    })}
                    {dayEvs.length > 2 && <span className="text-[8px] text-slate-400">+{dayEvs.length - 2}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100 flex-wrap">
            {Object.entries(TIPO_COLOR).map(([tipo, cfg]) => (
              <div key={tipo} className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                <span className="text-[10px] text-slate-400 capitalize">{tipo.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'forecast_12m' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-1">Forecast de cuotas — próximos 12 meses</p>
          <p className="text-xs text-slate-400 mb-5">Salidas de caja previstas por cuotas de deuda</p>
          <div className="flex items-end gap-2 h-36 mb-3">
            {monthSummary.map((m, i) => {
              const h = maxMonth > 0 ? (m.total / maxMonth) * 100 : 0;
              const isCurrentMonth = format(m.month, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                    {fmt(m.total)}
                  </div>
                  <div className={cn("w-full rounded-t-lg", isCurrentMonth ? "bg-taxea-red" : "bg-blue-400")} style={{ height: `${Math.max(h, 3)}%` }} />
                  <span className={cn("text-[9px]", isCurrentMonth ? "text-taxea-red font-bold" : "text-slate-400")}>{m.label}</span>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
            {monthSummary.slice(0, 6).map((m, i) => (
              <div key={i} className="text-center">
                <p className="text-[10px] text-slate-400 capitalize">{m.label}</p>
                <p className="text-xs font-bold text-foreground">{fmt(m.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista eventos próximos */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-foreground">Próximos vencimientos y cuotas</p>
        </div>
        <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
          {events.sort((a, b) => a.date - b.date).map((e, i) => {
            const tc = TIPO_COLOR[e.tipo] || { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 border-slate-200' };
            return (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", tc.dot)} />
                  <div>
                    <p className="text-xs font-medium text-foreground">{e.label}</p>
                    <p className="text-[10px] text-slate-400 capitalize">
                      {format(e.date, "d 'de' MMMM", { locale: es })} · {e.kind === 'vencimiento' ? '⚠ Vencimiento' : 'Cuota'}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-foreground">{fmt(e.amount)}</span>
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">Sin cuotas ni vencimientos este mes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
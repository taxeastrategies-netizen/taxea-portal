import { Link } from 'react-router-dom';
import { Clock, CalendarClock, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { financialTimeline } from '@/lib/financialTimeline.mjs';
const currency = value => value === null ? 'Importe sin confirmar' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
export default function FinancialTimeline({ invoices = [], expenses = [], obligations = [], calendarError = false }) {
  const timeline = financialTimeline(invoices, expenses, obligations);
  const section = (rows, empty) => !rows.length ? <p className="py-4 text-xs text-muted-foreground">{empty}</p> : rows.map(row => <Link key={row.id} to={row.route} className="flex items-center gap-3 border-b border-border/60 py-2.5 hover:bg-secondary/40 last:border-0">
    {row.kind === 'tax' ? <CalendarClock className="h-4 w-4 shrink-0 text-amber-600" /> : row.kind === 'income' ? <ArrowUpCircle className="h-4 w-4 shrink-0 text-blue-600" /> : <ArrowDownCircle className="h-4 w-4 shrink-0 text-violet-600" />}
    <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{row.label}</p><p className="truncate text-xs text-muted-foreground">{row.detail}</p><p className="text-[10px] text-muted-foreground">{row.day.split('-').reverse().join('/')}</p></div><span className="text-xs font-medium">{currency(row.amount)}</span>
  </Link>);
  return <section className="rounded-2xl border border-border bg-card p-5"><h3 className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4 text-blue-600" />Actividad y vencimientos</h3><p className="mt-1 text-xs text-muted-foreground">Documentos de los últimos 30 días. Su registro no implica un cobro o pago bancario.</p>
    {section(timeline.recent, 'Sin documentos recientes registrados')}
    <h4 className="mt-4 text-xs font-semibold">Próximos 30 días</h4>{calendarError ? <p role="alert" className="mt-2 text-xs text-amber-700">Calendario no disponible</p> : section(timeline.upcoming, 'Sin vencimientos fiscales próximos registrados')}
    {!calendarError && timeline.overdueCount > 0 && <Link to="/tax-accounting/obligaciones" className="mt-3 block text-xs font-medium text-amber-700">Revisar {timeline.overdueCount} obligaciones con fecha vencida</Link>}
  </section>;
}

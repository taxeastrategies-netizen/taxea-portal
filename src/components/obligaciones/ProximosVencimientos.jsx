import { AlertTriangle, CalendarClock, CheckCircle2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const CLOSED = new Set(['presentado', 'pagado', 'finalizado', 'no_aplica']);
const fmt = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Según supuesto';
const daysUntil = value => value ? Math.ceil((new Date(`${value}T23:59:59`) - new Date()) / 86400000) : null;

function Deadline({ item }) {
  const days = daysUntil(item.filingDeadline);
  const tone = days === null ? 'text-slate-600' : days < 0 ? 'text-red-700' : days <= 7 ? 'text-red-600' : days <= 20 ? 'text-amber-700' : 'text-slate-600';
  const label = days === null ? 'Sin fecha preestablecida' : days < 0 ? `Venció hace ${Math.abs(days)} días` : days === 0 ? 'Vence hoy' : `Vence en ${days} días`;
  return <span className={cn('text-xs font-semibold', tone)}>{label}</span>;
}

export default function ProximosVencimientos({ obligations = [], onEdit }) {
  const open = obligations.filter(item => !CLOSED.has(item.state));
  const overdue = open.filter(item => daysUntil(item.filingDeadline) < 0);
  const upcoming = open.filter(item => {
    const days = daysUntil(item.filingDeadline);
    return days !== null && days >= 0 && days <= 45;
  });
  const completed = obligations.filter(item => CLOSED.has(item.state)).slice().reverse().slice(0, 6);

  const renderRow = item => (
    <button key={item.key} type="button" onClick={() => onEdit?.(item)}
      className="w-full text-left flex flex-col lg:flex-row lg:items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0', item.authority === 'ATC' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800')}>
        {item.code}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">Modelo {item.code} · {item.name}</p>
        <p className="text-xs text-muted-foreground">{item.period} {item.fiscalYear} · {item.authority} · {item.modelSource === 'perfil_fiscal' ? 'perfil fiscal' : 'informada manualmente'}</p>
      </div>
      <div className="grid grid-cols-2 gap-5 lg:text-right">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Domiciliación</p>
          <p className="text-xs font-medium">{fmt(item.domicileDeadline)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Presentación</p>
          <p className="text-xs font-medium">{fmt(item.filingDeadline)}</p>
          <Deadline item={item} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground lg:w-24 lg:justify-end">
        <FileText className="w-3.5 h-3.5" />{item.documents?.length || 0}
      </div>
    </button>
  );

  return (
    <div className="space-y-6">
      {overdue.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3 text-red-700"><AlertTriangle className="w-4 h-4" /><h3 className="text-sm font-semibold">Vencidas pendientes ({overdue.length})</h3></div>
          <div className="space-y-2">{overdue.map(renderRow)}</div>
        </section>
      )}
      {upcoming.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3"><CalendarClock className="w-4 h-4 text-amber-600" /><h3 className="text-sm font-semibold">Próximos 45 días ({upcoming.length})</h3></div>
          <div className="space-y-2">{upcoming.map(renderRow)}</div>
        </section>
      )}
      {overdue.length === 0 && upcoming.length === 0 && (
        <div className="py-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-5007f mx-auto mb-2" />
          <p className="text-sm font-medium">Sin vencimientos pendientes en los próximos 45 días</p>
          <p className="text-xs text-muted-foreground mt-1">El calendario sigue mostrando el resto del ejercicio.</p>
        </div>
      )}
      {completed.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Últimas gestionadas</h3>
          <div className="space-y-2">{completed.map(renderRow)}</div>
        </section>
      )}
    </div>
  );
}


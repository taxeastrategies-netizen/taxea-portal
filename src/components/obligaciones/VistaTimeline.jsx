import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CLOSED = new Set(['presentado', 'pagado', 'finalizado', 'no_aplica']);
const dateOf = value => value ? new Date(`${value}T12:00:00`) : null;

export default function VistaTimeline({ obligations = [], onEdit }) {
  const dated = obligations.filter(item => item.filingDeadline);
  const years = [...new Set(dated.map(item => dateOf(item.filingDeadline).getFullYear()))].sort();
  const noDate = obligations.filter(item => !item.filingDeadline);

  return (
    <div className="space-y-6">
      {years.map(year => (
        <section key={year}>
          <h3 className="text-sm font-semibold mb-3">Vencimientos durante {year}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {MONTHS.map((month, monthIndex) => {
              const rows = dated.filter(item => {
                const date = dateOf(item.filingDeadline);
                return date.getFullYear() === year && date.getMonth() === monthIndex;
              });
              if (!rows.length) return null;
              return (
                <div key={month} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{month}</p>
                  <div className="space-y-2">
                    {rows.map(item => {
                      const date = dateOf(item.filingDeadline);
                      const closed = CLOSED.has(item.state);
                      return (
                        <button key={item.key} type="button" onClick={() => onEdit?.(item)} className="w-full flex items-center gap-3 text-left rounded-lg hover:bg-muted/30 p-2 -mx-2">
                          <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold', closed ? 'bg-emerald-100 text-emerald-700' : item.authority === 'ATC' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800')}>{date.getDate()}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">Modelo {item.code} · {item.period}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{item.name}</p>
                          </div>
                          {item.documents?.length > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><FileText className="w-3 h-3" />{item.documents.length}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {noDate.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">Obligaciones dependientes del supuesto</h3>
          <p className="text-xs text-amber-800 mt-1 mb-3">Necesitan fecha de devengo, operación o confirmación del asesor.</p>
          <div className="flex flex-wrap gap-2">
            {noDate.map(item => <button key={item.key} onClick={() => onEdit?.(item)} className="text-xs rounded-lg border border-amber-200 bg-white px-3 py-2">Modelo {item.code} · {item.period}</button>)}
          </div>
        </section>
      )}
    </div>
  );
}


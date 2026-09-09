import { AlertTriangle, CalendarDays, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS = {
  pendiente_documentacion: ['Pendiente documentación', 'bg-slate-100 text-slate-700'],
  en_preparacion: ['En preparación', 'bg-blue-100 text-blue-700'],
  calculado: ['Calculado', 'bg-blue-100 text-blue-700'],
  borrador: ['Borrador', 'bg-indigo-100 text-indigo-700'],
  pendiente_revision: ['Pendiente revisión', 'bg-amber-100 text-amber-800'],
  revisado: ['Revisado', 'bg-teal-100 text-teal-700'],
  listo_presentar: ['Listo para presentar', 'bg-emerald-100 text-emerald-700'],
  presentado: ['Presentado', 'bg-emerald-100 text-emerald-800'],
  domiciliado: ['Domiciliado', 'bg-emerald-100 text-emerald-800'],
  pagado: ['Pagado', 'bg-emerald-100 text-emerald-800'],
  finalizado: ['Finalizado', 'bg-emerald-100 text-emerald-800'],
  rechazado: ['Rechazado', 'bg-red-100 text-red-700'],
  no_aplica: ['No aplica', 'bg-slate-100 text-slate-500'],
};
const fmt = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-ES') : 'Según supuesto';

export default function CalendarioGeneral({ obligations = [], fiscalYear, verifiedCalendarYear, sources = [], onEdit }) {
  const provisional = obligations.filter(item => item.deadlineStatus !== 'verificado');
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><CalendarDays className="w-5 h-5" /></div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Calendario individual del ejercicio {fiscalYear}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Solo aparecen los modelos activos del perfil, los informados por el asesor y los detectados en documentos fiscales.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-700"><ShieldCheck className="w-4 h-4" />Calendario oficial verificado hasta {verifiedCalendarYear}</div>
      </div>

      {provisional.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">{provisional.length} plazo(s) requieren confirmación</p>
            <p className="text-xs text-amber-800 mt-0.5">Son modelos dependientes del supuesto o vencimientos de un calendario oficial todavía no publicado. El asesor puede fijar la fecha concreta sin alterar la regla general.</p>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Modelo y período</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">Administración</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground">Domiciliación</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground">Presentación máxima</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground">Fecha interna</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground">Documentos</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {obligations.map(item => {
                const status = STATUS[item.state] || [item.state || 'Pendiente', 'bg-slate-100 text-slate-700'];
                return (
                  <tr key={item.key} onClick={() => onEdit?.(item)} className="hover:bg-muted/20 cursor-pointer">
                    <td className="py-3 px-4 min-w-64">
                      <p className="font-semibold">Modelo {item.code} · {item.period} {item.fiscalYear}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.name}</p>
                      {item.notes && <p className="text-[11px] text-amber-700 mt-1 max-w-md">{item.notes}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn('text-xs font-semibold rounded-md px-2 py-1', item.authority === 'ATC' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800')}>{item.authority}</span>
                      <p className="text-[11px] text-muted-foreground mt-1">{item.modelSource === 'perfil_fiscal' ? 'Perfil fiscal' : 'Asesor / documento'}</p>
                    </td>
                    <td className="py-3 px-4 text-center text-xs">{fmt(item.domicileDeadline)}</td>
                    <td className="py-3 px-4 text-center">
                      <p className="text-xs font-semibold">{fmt(item.filingDeadline)}</p>
                      <span className={cn('text-[10px]', item.deadlineStatus === 'verificado' ? 'text-emerald-700' : 'text-amber-700')}>{item.deadlineStatus === 'verificado' ? 'Verificada' : 'Revisar'}</span>
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-muted-foreground">{fmt(item.internalDeadline)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-xs"><FileText className="w-3.5 h-3.5" />{item.documents?.length || 0}</span>
                    </td>
                    <td className="py-3 px-4 text-center"><span className={cn('text-xs rounded-full px-2 py-1 font-medium whitespace-nowrap', status[1])}>{status[0]}</span></td>
                  </tr>
                );
              })}
              {obligations.length === 0 && (
                <tr><td colSpan={7} className="py-14 text-center text-sm text-muted-foreground">No hay obligaciones activas configuradas para este perfil.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-muted/30 p-4">
        <p className="text-xs font-semibold text-foreground mb-2">Fuentes oficiales</p>
        <div className="flex flex-wrap gap-3">
          {sources.map(source => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              {source.authority} · {source.title}<ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}


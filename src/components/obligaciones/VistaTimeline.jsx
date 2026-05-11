import { cn } from '@/lib/utils';
import { getModeloInfo, COLOR_MAP } from './CalendarioAEAT';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const ESTADO_COLOR = {
  pendiente_documentacion: 'bg-secondary text-muted-foreground border-border',
  en_preparacion: 'bg-blue-50 text-blue-700 border-blue-200',
  presentado: 'bg-green-100 text-green-800 border-green-300',
  domiciliado: 'bg-green-50 text-green-700 border-green-200',
  pagado: 'bg-green-100 text-green-800 border-green-300',
  finalizado: 'bg-green-100 text-green-800 border-green-300',
};

function getEstadoColor(obl) {
  const now = new Date();
  if (obl.fecha_limite && new Date(obl.fecha_limite) < now && !['finalizado','presentado','pagado','domiciliado'].includes(obl.estado)) {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  if (obl.fecha_limite) {
    const diff = (new Date(obl.fecha_limite) - now) / 86400000;
    if (diff >= 0 && diff <= 15 && !['finalizado','presentado','pagado','domiciliado'].includes(obl.estado)) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  }
  return ESTADO_COLOR[obl.estado] || 'bg-secondary text-muted-foreground border-border';
}

export default function VistaTimeline({ obligations }) {
  const year = new Date().getFullYear();

  // Agrupar por mes
  const byMonth = Array.from({ length: 12 }, (_, i) => ({
    mes: i,
    label: MESES[i],
    items: obligations.filter(o => {
      if (!o.fecha_limite) return false;
      const d = new Date(o.fecha_limite);
      return d.getFullYear() === year && d.getMonth() === i;
    })
  }));

  const sinFecha = obligations.filter(o => !o.fecha_limite);

  return (
    <div className="space-y-2">
      {byMonth.filter(m => m.items.length > 0 || m.mes === new Date().getMonth()).map(m => {
        const esMesActual = m.mes === new Date().getMonth();
        return (
          <div key={m.mes} className={cn('rounded-xl border p-4', esMesActual ? 'border-teal bg-teal/5' : 'border-border bg-card')}>
            <div className="flex items-center gap-2 mb-3">
              <span className={cn('text-sm font-jakarta font-bold w-8', esMesActual ? 'text-teal' : 'text-muted-foreground')}>{m.label}</span>
              {esMesActual && <span className="text-xs bg-teal text-white px-2 py-0.5 rounded font-medium">Mes actual</span>}
              {m.items.length === 0 && <span className="text-xs text-muted-foreground">Sin vencimientos</span>}
            </div>
            {m.items.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {m.items.map(o => {
                  const info = getModeloInfo(o.modelo);
                  const colorClass = getEstadoColor(o);
                  return (
                    <div key={o.id} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium', colorClass)}>
                      <span>{info.icon}</span>
                      <span>{info.label}</span>
                      <span className="opacity-70">· {new Date(o.fecha_limite).getDate()} {MESES[new Date(o.fecha_limite).getMonth()]}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {sinFecha.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">Sin fecha asignada</p>
          <div className="flex flex-wrap gap-2">
            {sinFecha.map(o => {
              const info = getModeloInfo(o.modelo);
              return (
                <div key={o.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs font-medium text-muted-foreground">
                  <span>{info.icon}</span><span>{info.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
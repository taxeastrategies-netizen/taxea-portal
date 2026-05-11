import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { getModeloInfo } from './CalendarioAEAT';
import { cn } from '@/lib/utils';

export default function ProximosVencimientos({ obligations, onCambiarEstado }) {
  const now = new Date();

  const vencidas = obligations.filter(o => {
    if (!o.fecha_limite) return false;
    return new Date(o.fecha_limite) < now && !['finalizado','presentado','pagado','domiciliado'].includes(o.estado);
  });

  const proximas30 = obligations.filter(o => {
    if (!o.fecha_limite) return false;
    const diff = (new Date(o.fecha_limite) - now) / 86400000;
    return diff >= 0 && diff <= 30 && !['finalizado','presentado','pagado','domiciliado'].includes(o.estado);
  }).sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite));

  const presentadas = obligations.filter(o => ['finalizado','presentado','pagado','domiciliado'].includes(o.estado))
    .sort((a, b) => new Date(b.fecha_limite || 0) - new Date(a.fecha_limite || 0))
    .slice(0, 5);

  function diasRestantes(fecha) {
    const diff = Math.ceil((new Date(fecha) - now) / 86400000);
    if (diff < 0) return `Vencida hace ${Math.abs(diff)} días`;
    if (diff === 0) return 'Vence HOY';
    if (diff === 1) return 'Vence mañana';
    return `Vence en ${diff} días`;
  }

  function urgencyClass(obl) {
    if (!obl.fecha_limite) return '';
    const diff = (new Date(obl.fecha_limite) - now) / 86400000;
    if (diff < 0) return 'border-red-200 bg-red-50/40';
    if (diff <= 5) return 'border-red-200 bg-red-50/20';
    if (diff <= 15) return 'border-amber-200 bg-amber-50/20';
    return 'border-border';
  }

  return (
    <div className="space-y-5">
      {vencidas.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-red-600">Obligaciones vencidas ({vencidas.length})</p>
          </div>
          <div className="space-y-2">
            {vencidas.map(o => {
              const info = getModeloInfo(o.modelo);
              return (
                <div key={o.id} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <span className="text-lg">{info.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">{info.label} — {info.desc}</p>
                    <p className="text-xs text-red-600">{diasRestantes(o.fecha_limite)} · Período: {o.periodo || '—'}</p>
                  </div>
                  {onCambiarEstado && (
                    <button onClick={() => onCambiarEstado(o.id, 'presentado')} className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded font-medium transition-colors">
                      Marcar presentada
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {proximas30.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-semibold text-foreground">Próximos 30 días ({proximas30.length})</p>
          </div>
          <div className="space-y-2">
            {proximas30.map(o => {
              const info = getModeloInfo(o.modelo);
              return (
                <div key={o.id} className={cn('flex items-center gap-3 p-3 rounded-xl border', urgencyClass(o))}>
                  <span className="text-lg">{info.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{info.label} — {info.desc}</p>
                    <p className="text-xs text-muted-foreground">{diasRestantes(o.fecha_limite)} · {o.periodo || '—'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn('text-xs font-bold', (new Date(o.fecha_limite) - now) / 86400000 <= 5 ? 'text-red-600' : 'text-amber-600')}>
                      {new Date(o.fecha_limite).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                    {onCambiarEstado && (
                      <button onClick={() => onCambiarEstado(o.id, 'presentado')} className="text-xs text-teal hover:underline">
                        Presentada
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {proximas30.length === 0 && vencidas.length === 0 && (
        <div className="text-center py-8">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Sin vencimientos en los próximos 30 días</p>
          <p className="text-xs text-muted-foreground mt-1">Todo al día</p>
        </div>
      )}

      {presentadas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Últimas presentadas</p>
          <div className="space-y-1.5">
            {presentadas.map(o => {
              const info = getModeloInfo(o.modelo);
              return (
                <div key={o.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-green-50/50 border border-green-100">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-foreground">{info.label}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{o.periodo || '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
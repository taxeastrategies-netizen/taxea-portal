import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Loader2, AlertTriangle, FileText, RotateCcw } from 'lucide-react';

const CONFIANZA_CONFIG = {
  alta: { label: 'Alta', color: 'text-green-600 bg-green-50 border-green-200' },
  media: { label: 'Media', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  baja: { label: 'Baja', color: 'text-red-600 bg-red-50 border-red-200' },
};

const ESTADO_CONFIG = {
  pendiente: { icon: <FileText className="w-4 h-4 text-muted-foreground" />, label: 'Pendiente', color: 'text-muted-foreground' },
  procesando: { icon: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />, label: 'Procesando IA...', color: 'text-blue-600' },
  identificado: { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, label: 'Identificado', color: 'text-green-600' },
  revision: { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, label: 'Revisión requerida', color: 'text-amber-600' },
  no_identificado: { icon: <XCircle className="w-4 h-4 text-red-500" />, label: 'No identificado', color: 'text-red-600' },
  confirmado: { icon: <CheckCircle2 className="w-4 h-4 text-teal" />, label: 'Confirmado', color: 'text-teal' },
  ignorado: { icon: <XCircle className="w-4 h-4 text-muted-foreground" />, label: 'Ignorado', color: 'text-muted-foreground' },
};

export default function ColaProcesamiento({ items, selectedId, onSelect, onReprocesar }) {
  const total = items.length;
  const confirmados = items.filter(i => i.estado === 'confirmado').length;
  const revision = items.filter(i => ['revision', 'no_identificado'].includes(i.estado)).length;
  const procesando = items.filter(i => i.estado === 'procesando').length;

  return (
    <div className="flex flex-col h-full">
      {/* KPIs mini */}
      <div className="grid grid-cols-4 gap-2 p-3 border-b border-border">
        {[
          { label: 'Total', val: total, color: 'text-foreground' },
          { label: 'OK', val: confirmados, color: 'text-green-600' },
          { label: 'Revisión', val: revision, color: 'text-amber-600' },
          { label: 'En proceso', val: procesando, color: 'text-blue-600' },
        ].map(k => (
          <div key={k.label} className="text-center">
            <p className={cn('text-lg font-bold', k.color)}>{k.val}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar global */}
      {total > 0 && (
        <div className="px-3 py-2 border-b border-border">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progreso global</span>
            <span>{Math.round((items.filter(i => ['confirmado','ignorado','identificado'].includes(i.estado)).length / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-teal rounded-full transition-all"
              style={{ width: `${(items.filter(i => ['confirmado','ignorado','identificado'].includes(i.estado)).length / total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {items.map(item => {
          const cfg = ESTADO_CONFIG[item.estado] || ESTADO_CONFIG.pendiente;
          const confianzaCfg = item.extraccion?.confianza ? CONFIANZA_CONFIG[item.extraccion.confianza] : null;
          return (
            <button key={item.id} onClick={() => onSelect(item.id)}
              className={cn('w-full text-left px-3 py-3 hover:bg-secondary/30 transition-colors',
                selectedId === item.id && 'bg-teal/5 border-l-2 border-teal')}>
              <div className="flex items-center gap-2">
                {cfg.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.file.name}</p>
                  <p className={cn('text-xs mt-0.5', cfg.color)}>{cfg.label}</p>
                  {item.extraccion?.modelo && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.extraccion.modelo} · {item.extraccion.periodo}</p>
                  )}
                </div>
                {confianzaCfg && (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0', confianzaCfg.color)}>
                    {confianzaCfg.label}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
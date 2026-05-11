import { FileText, Image, Trash2, Eye, CheckCircle, XCircle, Loader2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pendiente:          { label: 'Pendiente',        color: 'bg-secondary text-muted-foreground',     icon: Clock },
  subiendo:           { label: 'Subiendo...',       color: 'bg-blue-50 text-blue-600',               icon: Loader2, spin: true },
  subido:             { label: 'Subido',            color: 'bg-blue-50 text-blue-700',               icon: CheckCircle },
  procesando:         { label: 'Procesando IA...',  color: 'bg-amber-50 text-amber-600',             icon: Loader2, spin: true },
  procesado:          { label: 'Procesado',         color: 'bg-purple-50 text-purple-700',           icon: CheckCircle },
  pendiente_revision: { label: 'Pendiente revisión',color: 'bg-orange-50 text-orange-700',           icon: Eye },
  aprobado:           { label: 'Aprobado ✓',        color: 'bg-green-50 text-green-700',             icon: CheckCircle },
  rechazado:          { label: 'Rechazado',         color: 'bg-red-50 text-red-600',                 icon: XCircle },
  error:              { label: 'Error',             color: 'bg-red-50 text-red-600',                 icon: AlertCircle },
};

function fileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  return ['jpg','jpeg','png','webp'].includes(ext) ? Image : FileText;
}

export default function DocumentQueue({ docs, onRemove, onReview, onProcessOne }) {
  if (!docs.length) return null;

  const pending = docs.filter(d => d.status === 'pendiente').length;
  const processed = docs.filter(d => ['aprobado','rechazado'].includes(d.status)).length;

  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/40 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          Cola de documentos <span className="font-normal text-muted-foreground ml-1">{docs.length} archivos</span>
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {pending} pendientes</span>
          <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> {processed} finalizados</span>
        </div>
      </div>
      <div className="divide-y divide-border max-h-72 overflow-y-auto">
        {docs.map(doc => {
          const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pendiente;
          const Icon = fileIcon(doc.file?.name || doc.name);
          const StatusIcon = cfg.icon;
          return (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors">
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.file?.name || doc.name}</p>
                <p className="text-xs text-muted-foreground">{doc.file ? `${(doc.file.size / 1024 / 1024).toFixed(2)} MB` : ''}</p>
              </div>
              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0', cfg.color)}>
                <StatusIcon className={cn('w-3 h-3', cfg.spin && 'animate-spin')} />
                {cfg.label}
              </span>
              {doc.status === 'pendiente_revision' && (
                <Button size="sm" variant="outline" className="h-7 text-xs px-2 gap-1 flex-shrink-0" onClick={() => onReview(doc)}>
                  <Eye className="w-3 h-3" /> Revisar
                </Button>
              )}
              {doc.status === 'pendiente' && onProcessOne && (
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 flex-shrink-0" onClick={() => onProcessOne(doc)}>
                  Procesar
                </Button>
              )}
              {['pendiente','error'].includes(doc.status) && (
                <button onClick={() => onRemove(doc.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
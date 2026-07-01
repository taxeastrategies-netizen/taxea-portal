import { useState } from 'react';
import { FileText, Image, Eye, RefreshCw, Play, CheckCircle, Loader2, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending:               { label: 'Pendiente',                  color: 'text-amber-600',  bg: 'bg-amber-50' },
  queued_for_analysis:   { label: 'En cola',                    color: 'text-blue-600',   bg: 'bg-blue-50' },
  processing:            { label: 'Procesando',                 color: 'text-blue-600',   bg: 'bg-blue-50' },
  analysis_failed:       { label: 'Error de analisis',          color: 'text-red-600',    bg: 'bg-red-50' },
  review_required:       { label: 'Pendiente de revision',      color: 'text-orange-600', bg: 'bg-orange-50' },
  validated:             { label: 'Validado',                   color: 'text-green-600',  bg: 'bg-green-50' },
  accounted:             { label: 'Contabilizado',              color: 'text-green-700',  bg: 'bg-green-50' },
  rejected:              { label: 'Rechazado',                  color: 'text-red-600',    bg: 'bg-red-50' },
  replacement_requested: { label: 'Sustitucion solicitada',     color: 'text-orange-600', bg: 'bg-orange-50' },
  cancelled_by_client:   { label: 'Retirado',                   color: 'text-slate-500',  bg: 'bg-slate-50' },
};

const FILTERS = [
  { key: 'all',     label: 'Todos',        match: () => true },
  { key: 'pending', label: 'Pendientes',   match: (s) => s === 'pending' },
  { key: 'active',  label: 'En revision',  match: (s) => ['queued_for_analysis','processing','review_required','analysis_failed'].includes(s) },
  { key: 'done',    label: 'Procesados',   match: (s) => ['validated','accounted'].includes(s) },
  { key: 'closed',  label: 'Rechazados',   match: (s) => ['rejected','replacement_requested','cancelled_by_client'].includes(s) },
];

function fileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  return ['jpg','jpeg','png','webp'].includes(ext) ? Image : FileText;
}

export default function OcrDocumentTable({
  documents,
  loading,
  isAdmin,
  onRefresh,
  onProcessOcr,
  onReview,
  onWithdraw,
  processingIds,
  emptyMessage,
}) {
  const [filter, setFilter] = useState('all');

  const activeFilter = FILTERS.find(f => f.key === filter);
  const filtered = documents.filter(d => activeFilter.match(d.status));

  const counts = FILTERS.reduce((acc, f) => {
    acc[f.key] = documents.filter(d => f.match(d.status)).length;
    return acc;
  }, {});

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <p className="font-jakarta font-semibold text-sm text-foreground">
          Documentos entregados
          <span className="font-normal text-muted-foreground ml-2">{documents.length}</span>
        </p>
        <button onClick={onRefresh} className="text-sm text-teal hover:text-teal-dark font-medium flex items-center gap-1.5">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Actualizar
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1 px-4 py-2 border-b border-border overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
              filter === f.key ? 'bg-teal text-white' : 'text-muted-foreground hover:bg-secondary'
            )}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 text-center">
          <div className="w-5 h-5 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{emptyMessage || 'No hay documentos en este apartado.'}</p>
        </div>
      ) : (
        <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
          {filtered.map(doc => {
            const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
            const Icon = fileIcon(doc.originalFileName);
            const isProcessing = processingIds?.has(doc.id);
            return (
              <div key={doc.id} className="px-5 py-3 hover:bg-secondary/20 transition-colors">
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{doc.originalFileName || 'Documento'}</p>
                      {doc.duplicateWarning && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">Duplicado</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {doc.uploadedAt
                        ? new Date(doc.uploadedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                      {doc.uploadedByEmail ? ` · ${doc.uploadedByEmail}` : ''}
                    </p>
                  </div>
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0', cfg.bg, cfg.color)}>
                    {isProcessing && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    {cfg.label}
                  </span>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {doc.fileStorageUrl && (
                      <a href={doc.fileStorageUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-teal" title="Ver documento">
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {isAdmin && (doc.status === 'pending' || doc.status === 'analysis_failed') && (
                      <button
                        onClick={() => onProcessOcr(doc)}
                        disabled={isProcessing}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-teal disabled:opacity-50"
                        title="Procesar OCR"
                      >
                        {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {isAdmin && doc.status === 'review_required' && (
                      <button onClick={() => onReview(doc)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-teal" title="Revisar y validar">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!isAdmin && doc.status === 'pending' && (
                      <button onClick={() => onWithdraw(doc.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Retirar documento">
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {doc.safeErrorMessage && (
                  <p className="text-xs text-red-500 mt-1.5 pl-7">{doc.safeErrorMessage}</p>
                )}
                {doc.rejectionReason && (
                  <p className="text-xs text-red-500 mt-1.5 pl-7">Motivo: {doc.rejectionReason}</p>
                )}
                {doc.duplicateWarning && (
                  <p className="text-xs text-amber-600 mt-1.5 pl-7">{doc.duplicateWarning}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
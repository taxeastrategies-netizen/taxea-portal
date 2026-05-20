import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, XCircle,
  Clock, FileText, Eye, MoreVertical, Filter, Download,
  Users, TrendingUp, ShieldCheck, ScanText, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'bg-slate-100 text-slate-600', icon: Clock },
  procesando: { label: 'Procesando', color: 'bg-blue-100 text-blue-700', icon: Loader2, spin: true },
  procesado_alta_confianza: { label: 'Alta confianza', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  procesado_con_advertencias: { label: 'Advertencias', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  requiere_revision: { label: 'Revisar', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  no_reconocido: { label: 'No reconocido', color: 'bg-slate-100 text-slate-500', icon: XCircle },
  duplicado_probable: { label: 'Duplicado', color: 'bg-purple-100 text-purple-700', icon: XCircle },
  validado: { label: 'Validado', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  archivado: { label: 'Archivado', color: 'bg-slate-100 text-slate-600', icon: CheckCircle2 },
  error: { label: 'Error', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const fmt = (n) => typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';

export default function LaborOcrBatchProcessor({ batch, company, onBack, onReviewDoc }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (batch?.id) loadDocuments();
  }, [batch?.id]);

  useEffect(() => {
    const hasProcessing = documents.some(d => d.ocr_status === 'procesando' || d.ocr_status === 'pendiente');
    if (!hasProcessing) return;
    const iv = setInterval(loadDocuments, 4000);
    return () => clearInterval(iv);
  }, [documents]);

  const loadDocuments = async () => {
    const docs = await base44.entities.LaborOcrDocument.filter({ batch_id: batch.id }, 'created_date', 200);
    setDocuments(docs);
    setLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const filtered = filter === 'all' ? documents : documents.filter(d => d.ocr_status === filter);

  const stats = {
    total: documents.length,
    alta: documents.filter(d => d.ocr_status === 'procesado_alta_confianza').length,
    revision: documents.filter(d => ['requiere_revision', 'procesado_con_advertencias'].includes(d.ocr_status)).length,
    validados: documents.filter(d => d.ocr_status === 'validado').length,
    procesando: documents.filter(d => ['procesando', 'pendiente'].includes(d.ocr_status)).length,
    error: documents.filter(d => d.ocr_status === 'error').length,
  };

  const totalNet = documents.reduce((s, d) => s + (d.extracted_fields?.net_pay || 0), 0);
  const totalIrpf = documents.reduce((s, d) => s + (d.extracted_fields?.irpf_amount || 0), 0);
  const totalGross = documents.reduce((s, d) => s + (d.extracted_fields?.total_accruals || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div className="w-px h-4 bg-border" />
        <ScanText className="w-4 h-4 text-taxea-red" />
        <span className="font-semibold text-sm">
          {batch.mode === 'nominas' ? 'Nóminas' : batch.mode === 'seguros_sociales' ? 'Seguros Sociales' : 'Carga Mixta'}
          {batch.period && ` · ${batch.period}`}
        </span>
        <button onClick={refresh} className={cn('ml-auto text-muted-foreground hover:text-foreground transition-colors', refreshing && 'animate-spin')}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground' },
            { label: 'Procesando', value: stats.procesando, color: 'text-blue-600' },
            { label: 'Alta confianza', value: stats.alta, color: 'text-emerald-600' },
            { label: 'Revisar', value: stats.revision, color: 'text-amber-600' },
            { label: 'Validados', value: stats.validados, color: 'text-green-600' },
            { label: 'Errores', value: stats.error, color: 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Financial summary */}
        {totalGross > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Devengado</p>
              <p className="text-xl font-bold text-foreground">{fmt(totalGross)}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Total IRPF</p>
              <p className="text-xl font-bold text-red-600">{fmt(totalIrpf)}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Líquido</p>
              <p className="text-xl font-bold text-emerald-600">{fmt(totalNet)}</p>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'procesando', label: 'En proceso' },
            { id: 'procesado_alta_confianza', label: 'Alta confianza' },
            { id: 'procesado_con_advertencias', label: 'Advertencias' },
            { id: 'requiere_revision', label: 'Revisar' },
            { id: 'validado', label: 'Validados' },
            { id: 'error', label: 'Error' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                filter === f.id ? 'bg-taxea-red text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Documents table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Sin documentos{filter !== 'all' ? ' con este filtro' : ''}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Archivo</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Empleado</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Periodo</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Devengado</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Líquido</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Confianza</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Estado</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(doc => {
                  const s = STATUS_CONFIG[doc.ocr_status] || STATUS_CONFIG.pendiente;
                  const SIcon = s.icon;
                  const fields = doc.extracted_fields || {};
                  return (
                    <tr key={doc.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs font-medium truncate max-w-[140px]">{doc.original_file_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <span className="text-xs text-foreground">{doc.employee_name || fields.employee_name || <span className="text-muted-foreground">—</span>}</span>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{doc.period_label || fields.period_label || '—'}</span>
                      </td>
                      <td className="px-3 py-3 text-right hidden lg:table-cell">
                        <span className="text-xs font-medium">{fmt(fields.total_accruals)}</span>
                      </td>
                      <td className="px-3 py-3 text-right hidden lg:table-cell">
                        <span className="text-xs font-medium text-emerald-700">{fmt(fields.net_pay)}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ConfidencePill value={doc.confidence_global} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', s.color)}>
                          <SIcon className={cn('w-3 h-3', s.spin && 'animate-spin')} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {doc.ocr_status !== 'procesando' && doc.ocr_status !== 'pendiente' && (
                          <button
                            onClick={() => onReviewDoc(doc)}
                            className="text-xs px-2.5 py-1 bg-taxea-red/10 text-taxea-red rounded-lg hover:bg-taxea-red/20 transition-colors font-medium"
                          >
                            Revisar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfidencePill({ value }) {
  if (!value && value !== 0) return <span className="text-xs text-muted-foreground">—</span>;
  const color = value >= 80 ? 'text-emerald-700 bg-emerald-50' : value >= 50 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
  return <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', color)}>{value}%</span>;
}
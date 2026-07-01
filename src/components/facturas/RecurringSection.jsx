import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Repeat, Play, Pause, Trash2, Eye, ChevronRight, ChevronDown, FileText, AlertCircle } from 'lucide-react';
import { formatFrequency, calculateNextRun, FREQUENCY_LABELS, STATUS_LABELS, MODE_LABELS } from '@/lib/recurringUtils';
import { cn } from '@/lib/utils';

const fmt = n => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => d ? d.split('-').reverse().join('/') : '—';

export default function RecurringSection({ company, user, isAdmin }) {
  const [templates, setTemplates] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [tmpls, rns] = await Promise.all([
        base44.entities.RecurringInvoiceTemplate.filter({ ownerAccountId: company.id }, '-created_date'),
        base44.entities.RecurringInvoiceRun.filter({ ownerAccountId: company.id }, '-created_date', 200),
      ]);
      setTemplates(tmpls || []);
      setRuns(rns || []);
    } catch {}
    setLoading(false);
  }, [company?.id]);

  useEffect(() => { load(); }, [load]);

  const togglePause = async (tmpl) => {
    const newStatus = tmpl.status === 'paused' ? 'active' : 'paused';
    await base44.entities.RecurringInvoiceTemplate.update(tmpl.id, { status: newStatus });
    load();
  };

  const handleDelete = async (tmpl) => {
    if (!confirm(`¿Eliminar la recurrencia "${tmpl.concept}"? Las facturas ya emitidas no se borrarán.`)) return;
    await base44.entities.RecurringInvoiceTemplate.update(tmpl.id, { status: 'finished' });
    load();
  };

  const generateNow = async (tmpl) => {
    try {
      const res = await base44.functions.invoke('generateRecurringInvoices', {
        action: 'generate_one',
        templateId: tmpl.id,
        runType: 'manual',
      });
      const d = res?.data || res;
      if (d?.generated > 0) {
        alert(`Factura generada: ${d.generatedInvoiceNumber || 'OK'}`);
      } else if (d?.skipped > 0) {
        alert('Esta factura ya fue generada para este periodo. No se ha duplicado.');
      } else if (d?.errors > 0) {
        alert(`Error: ${d.errorDetail || 'No se pudo generar la factura recurrente.'}`);
      }
      load();
    } catch (e) {
      alert('No se pudo generar la factura recurrente.');
    }
  };

  const runsForTemplate = (tmplId) => runs.filter(r => r.recurringInvoiceTemplateId === tmplId);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
        <Repeat className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-muted-foreground font-medium">No hay facturas recurrentes configuradas</p>
        <p className="text-sm text-muted-foreground mt-1">Crea una nueva factura y marca "Factura recurrente" para configurar la periodicidad.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-8"></th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Concepto</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Periodicidad</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Base</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Total</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Próxima gen.</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Modo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {templates.map(tmpl => {
              const tRuns = runsForTemplate(tmpl.id);
              const generatedCount = tRuns.filter(r => r.status === 'generated' || r.status === 'draft_created').length;
              const isExpanded = expandedId === tmpl.id;
              const statusInfo = STATUS_LABELS[tmpl.status] || { label: tmpl.status, cls: 'bg-muted text-muted-foreground' };
              return (
                <>
                  <tr key={tmpl.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => setExpandedId(isExpanded ? null : tmpl.id)} className="p-1 rounded hover:bg-secondary">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{tmpl.clientName || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">{tmpl.concept || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatFrequency(tmpl)}</td>
                    <td className="px-4 py-3 text-right font-medium hidden lg:table-cell">{fmt(tmpl.baseAmount)} €</td>
                    <td className="px-4 py-3 text-right font-semibold hidden lg:table-cell">{fmt(tmpl.totalAmount)} €</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(tmpl.nextRunDate)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">{MODE_LABELS[tmpl.mode] || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-block text-xs font-medium px-2 py-0.5 rounded-full', statusInfo.cls)}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => generateNow(tmpl)} disabled={tmpl.status === 'paused' || tmpl.status === 'finished'}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-teal transition-colors disabled:opacity-30"
                          title="Generar ahora">
                          <Play className="w-4 h-4" />
                        </button>
                        <button onClick={() => togglePause(tmpl)} disabled={tmpl.status === 'finished'}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-amber-500 transition-colors disabled:opacity-30"
                          title={tmpl.status === 'paused' ? 'Reactivar' : 'Pausar'}>
                          {tmpl.status === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-blue-500 transition-colors"
                          title="Ver facturas generadas">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(tmpl)}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-red-500 transition-colors"
                          title="Eliminar recurrencia">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-secondary/20">
                      <td colSpan={10} className="px-8 py-4">
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Facturas generadas ({generatedCount})
                          </p>
                        </div>
                        {tRuns.length === 0 ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                            <FileText className="w-4 h-4 opacity-40" />
                            Todavía no se han generado facturas de esta recurrencia.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Nº Factura</th>
                                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Fecha emisión</th>
                                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Periodo</th>
                                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Tipo</th>
                                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Estado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {tRuns.map(run => (
                                  <tr key={run.id}>
                                    <td className="py-2 pr-4 font-medium">{run.generatedInvoiceNumber || '—'}</td>
                                    <td className="py-2 pr-4 text-muted-foreground">{fmtDate(run.periodStart)}</td>
                                    <td className="py-2 pr-4 text-muted-foreground">{fmtDate(run.periodStart)} → {fmtDate(run.periodEnd)}</td>
                                    <td className="py-2 pr-4 text-muted-foreground">{run.runType === 'manual' ? 'Manual' : 'Automática'}</td>
                                    <td className="py-2 pr-4">
                                      <span className={cn(
                                        'inline-block text-[10px] font-medium px-2 py-0.5 rounded-full',
                                        run.status === 'generated' && 'bg-green-100 text-green-700',
                                        run.status === 'draft_created' && 'bg-blue-100 text-blue-700',
                                        run.status === 'skipped_duplicate' && 'bg-amber-100 text-amber-700',
                                        run.status === 'error' && 'bg-red-100 text-red-700',
                                      )}>
                                        {run.status === 'generated' ? 'Generada' :
                                         run.status === 'draft_created' ? 'Borrador' :
                                         run.status === 'skipped_duplicate' ? 'Duplicado omitido' :
                                         run.status === 'error' ? 'Error' : run.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div><span className="text-muted-foreground">Base:</span> <strong>{fmt(tmpl.baseAmount)} €</strong></div>
                          <div><span className="text-muted-foreground">Impuesto:</span> <strong>{tmpl.taxRate}%</strong></div>
                          <div><span className="text-muted-foreground">Retención:</span> <strong>{tmpl.retentionRate || 0}%</strong></div>
                          <div><span className="text-muted-foreground">Total:</span> <strong>{fmt(tmpl.totalAmount)} €</strong></div>
                        </div>
                        {tmpl.lastRunDate && (
                          <p className="text-xs text-muted-foreground mt-2">Última generación: {new Date(tmpl.lastRunDate).toLocaleString('es-ES')}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, AlertTriangle, Edit3, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const fmt = (n) => typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';

export default function LaborAccountingEntryPreview({ entry, document: doc, onRefresh }) {
  const [validating, setValidating] = useState(false);

  const handleValidate = async () => {
    if (!entry?.id) return;
    setValidating(true);
    await base44.entities.LaborAccountingEntryProposal.update(entry.id, {
      status: 'validado',
      validated_by: null,
      validated_at: new Date().toISOString(),
    });
    setValidating(false);
    onRefresh?.();
  };

  if (!entry) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Info className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No hay propuesta de asiento generada.</p>
        <p className="text-xs mt-1">El documento necesita ser procesado primero.</p>
      </div>
    );
  }

  const lines = entry.lines || [];
  const debitTotal = lines.reduce((s, l) => s + (l.debe || 0), 0);
  const creditTotal = lines.reduce((s, l) => s + (l.haber || 0), 0);
  const balanced = Math.abs(debitTotal - creditTotal) < 0.1;

  return (
    <div className="space-y-4">
      {/* Status + header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Asiento contable propuesto</p>
          {entry.period && <p className="text-xs text-muted-foreground mt-0.5">Periodo: {entry.period}</p>}
        </div>
        <div className="flex items-center gap-2">
          <EntryStatusBadge status={entry.status} balanced={balanced} />
        </div>
      </div>

      {/* Balance alert */}
      {!balanced && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          El asiento no cuadra. Diferencia: {fmt(Math.abs(debitTotal - creditTotal))}. Revisa los importes antes de validar.
        </div>
      )}

      {(entry.warnings || []).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
          {entry.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-700">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />{w}
            </div>
          ))}
        </div>
      )}

      {/* Entry lines */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/50 border-b border-border">
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Cuenta</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Descripción</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Debe</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Haber</th>
              <th className="text-center px-3 py-2 font-semibold text-muted-foreground hidden md:table-cell">Origen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((l, i) => {
              const confColor = l.confianza === 'alta' ? 'bg-emerald-500' : l.confianza === 'media' ? 'bg-amber-400' : 'bg-red-400';
              return (
                <tr key={i} className="hover:bg-secondary/20">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', confColor)} title={`Confianza: ${l.confianza}`} />
                      <span className="font-mono font-bold text-foreground">{l.cuenta}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{l.descripcion}</td>
                  <td className="px-3 py-2 text-right font-medium text-blue-700">{l.debe > 0 ? fmt(l.debe) : ''}</td>
                  <td className="px-3 py-2 text-right font-medium text-purple-700">{l.haber > 0 ? fmt(l.haber) : ''}</td>
                  <td className="px-3 py-2 text-center hidden md:table-cell">
                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{l.origen || 'OCR'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/30">
              <td colSpan={2} className="px-3 py-2 text-xs font-bold text-right text-muted-foreground">TOTALES</td>
              <td className="px-3 py-2 text-right">
                <span className={cn('text-sm font-bold', balanced ? 'text-blue-700' : 'text-red-600')}>{fmt(debitTotal)}</span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className={cn('text-sm font-bold', balanced ? 'text-purple-700' : 'text-red-600')}>{fmt(creditTotal)}</span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Explain legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Alta confianza</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Revisar</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Baja confianza</span>
      </div>

      {/* Explanation */}
      {lines.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-semibold text-slate-700 mb-2">Cómo se calculó este asiento:</p>
          {lines.filter(l => l.regla_aplicada).map((l, i) => (
            <p key={i} className="text-xs text-slate-600">
              · <span className="font-mono font-bold">{l.cuenta}</span>: {l.regla_aplicada} → {fmt(l.debe || l.haber)}
            </p>
          ))}
        </div>
      )}

      {/* Validate button */}
      {entry.status === 'propuesto' && (
        <Button
          onClick={handleValidate}
          disabled={validating || !balanced}
          className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Validar asiento contable
        </Button>
      )}
      {entry.status === 'validado' && (
        <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-2.5">
          <CheckCircle2 className="w-4 h-4" /> Asiento validado
        </div>
      )}
    </div>
  );
}

function EntryStatusBadge({ status, balanced }) {
  if (!balanced) return <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">Descuadrado</span>;
  const map = {
    propuesto: 'bg-blue-100 text-blue-700',
    validado: 'bg-emerald-100 text-emerald-700',
    rechazado: 'bg-red-100 text-red-700',
    contabilizado: 'bg-green-100 text-green-700',
  };
  const labels = { propuesto: 'Propuesto', validado: 'Validado', rechazado: 'Rechazado', contabilizado: 'Contabilizado' };
  return <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', map[status] || 'bg-slate-100 text-slate-600')}>{labels[status] || status}</span>;
}
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, LockKeyhole, UnlockKeyhole } from 'lucide-react';
import { toast } from 'sonner';

const unwrap = (response) => response?.data || response || {};
const invokeAccounting = async (payload) => {
  const data = unwrap(await base44.functions.invoke('accountingOperations', payload));
  if (data.error || data.success === false) throw new Error(data.error || 'La operación contable no se pudo completar.');
  return data;
};
/** @param {any} value */
const errorMessage = value => value?.response?.data?.error || value?.message || 'No se pudo completar la operación.';

// Cada control procede de la prevalidación del servidor; esta guía no cambia saldos ni asientos.
const CLOSING_CHECKS = [
  { id: 'fecha', label: 'Ejercicio finalizado', passed: p => p.closeDateReached, detail: p => p.period?.endDate || '', tab: null },
  { id: 'asientos', label: 'Asientos revisados', passed: p => p.pendingEntries === 0, detail: p => `${p.pendingEntries || 0} pendientes`, tab: 'diario' },
  { id: 'cuadre', label: 'Asientos cuadrados', passed: p => p.unbalancedEntries === 0, detail: p => `${p.unbalancedEntries || 0} descuadrados`, tab: 'diario' },
  { id: 'apuntes', label: 'Apuntes enlazados', passed: p => p.unresolvedLines === 0, detail: p => `${p.unresolvedLines || 0} huérfanos`, tab: 'diario' },
  { id: 'facturas', label: 'Facturas contabilizadas', passed: p => p.pendingInvoices === 0, detail: p => `${p.pendingInvoices || 0} pendientes`, tab: 'facturas' },
  { id: '555', label: 'Partidas 555 clasificadas', passed: p => Math.abs(Number(p.pending555Balance || 0)) <= 0.01, detail: p => `${Number(p.pending555Balance || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, tab: 'conciliacion' },
  { id: 'banco', label: 'Banco conciliado', passed: p => p.unreconciledBankTransactions === 0, detail: p => `${p.unreconciledBankTransactions || 0} movimientos`, tab: 'conciliacion' },
  { id: 'perfil', label: 'Perfil fiscal validado', passed: p => p.fiscalProfileValidated, detail: p => p.fiscalProfileValidated ? 'Validado por asesor' : 'Sin validar', tab: 'fiscal' },
  { id: 'actividad', label: 'Actividad fiscal activa', passed: p => Number(p.fiscalActivities || 0) > 0, detail: p => `${p.fiscalActivities || 0} actividades`, tab: 'fiscal' },
  { id: 'desglose', label: 'Facturas con desglose fiscal', passed: p => p.legacyFiscalInvoices === 0, detail: p => `${p.legacyFiscalInvoices || 0} sin desglose`, tab: 'iva' },
  { id: 'lineas_fiscales', label: 'Líneas fiscales revisadas', passed: p => p.pendingFiscalLines === 0, detail: p => `${p.pendingFiscalLines || 0} pendientes`, tab: 'iva' },
  { id: 'divisa', label: 'Divisas valoradas en EUR', passed: p => p.currencyIssues === 0, detail: p => `${p.currencyIssues || 0} incidencias`, tab: 'diario' },
];

export default function PeriodosContables({ companyId, onNavigate }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [lockDate, setLockDate] = useState(`${currentYear}-12-31`);
  const [unlockReason, setUnlockReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [reopenConfirmation, setReopenConfirmation] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [actionError, setActionError] = useState('');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['accounting-periods', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => invokeAccounting({ action: 'periods_overview', companyId }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
  const selected = useMemo(() => (query.data?.periods || []).find(item => Number(item.year) === Number(year)), [query.data, year]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['accounting-periods', companyId] });
  const mutation = useMutation({
    mutationFn: async (/** @type {Record<string, any>} */ payload) => invokeAccounting({ companyId, ...payload }),
    onSuccess: (data, variables) => {
      setActionError('');
      // Un bloqueo, configuración o reapertura invalida la prevalidación anterior.
      setPreview(variables.action === 'closing_preview' ? data.preview || null : null);
      refresh();
    },
    onError: (error) => {
      const message = errorMessage(error);
      setActionError(message);
      toast.error(message);
    },
  });
  const configure = async () => {
    await mutation.mutateAsync({ action: 'save_fiscal_year', year: Number(year), startDate: `${year}-01-01`, endDate: `${year}-12-31` });
    toast.success(`Ejercicio ${year} configurado.`);
  };
  const runPreview = async () => {
    await mutation.mutateAsync({ action: 'closing_preview', year: Number(year) });
  };
  const closeYear = async () => {
    await mutation.mutateAsync({ action: 'closing_execute', year: Number(year), confirmation, apply: true });
    toast.success(`Ejercicio ${year} cerrado con regularización, cierre y apertura trazables.`);
    setConfirmation('');
    setPreview(null);
  };
  const reopenYear = async () => {
    await mutation.mutateAsync({ action: 'reopen_fiscal_year', year: Number(year), confirmation: reopenConfirmation, reason: reopenReason, apply: true });
    toast.success(`Ejercicio ${year} reabierto mediante contraasientos auditables.`);
    setReopenConfirmation('');
    setReopenReason('');
    setPreview(null);
  };
  const availableYears = useMemo(() => [...new Set([
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
    ...(query.data?.periods || []).map(item => Number(item.year)),
  ])].filter(Number.isInteger).sort((a, b) => b - a), [currentYear, query.data]);
  const selectYear = (nextYear) => {
    setYear(nextYear);
    setLockDate(`${nextYear}-12-31`);
    setPreview(null);
    setActionError('');
    setReopenConfirmation('');
    setReopenReason('');
  };

  if (!companyId) return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Selecciona una empresa.</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /><h3 className="font-semibold">Ejercicios y cierre contable</h3></div>
            <p className="mt-1 text-xs text-muted-foreground">Bloquea períodos cerrados y prepara regularización, cierre y apertura sin borrar asientos.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="number" className="w-28" value={year} onChange={(event) => selectYear(Number(event.target.value))} />
            {selected ? <Badge variant={selected.status === 'cerrado' ? 'secondary' : 'default'}>{selected.status}</Badge> : <Badge variant="outline">sin configurar</Badge>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {availableYears.map(item => (
          <Button type="button" size="sm" key={item} variant={item === year ? 'default' : 'outline'} onClick={() => selectYear(item)}>
            {item}{(query.data?.periods || []).some(period => Number(period.year) === item) ? ' · configurado' : ''}
          </Button>
        ))}
      </div>

      {(query.error || actionError) && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{query.error?.message || actionError}</div>}

      {!selected ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm">El ejercicio {year} todavía no tiene calendario contable.</p>
          <Button type="button" className="mt-3" onClick={configure} disabled={mutation.isPending}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Configurar ejercicio natural</Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between"><h4 className="font-medium">Bloqueo de períodos</h4><Badge variant="outline">{selected.lockedThroughDate ? `Hasta ${selected.lockedThroughDate}` : 'Sin bloqueo'}</Badge></div>
            <p className="text-xs text-muted-foreground">Las facturas, cobros, bancos y asientos manuales no podrán contabilizarse en fechas bloqueadas.</p>
            <div className="flex gap-2"><Input type="date" value={lockDate} onChange={(event) => setLockDate(event.target.value)} /><Button onClick={async () => { await mutation.mutateAsync({ action: 'set_period_lock', year, lockedThroughDate: lockDate }); toast.success('Período bloqueado.'); }} disabled={mutation.isPending || selected.status === 'cerrado'}><LockKeyhole className="mr-2 h-4 w-4" />Bloquear</Button></div>
            {selected.lockedThroughDate && selected.status !== 'cerrado' && <div className="space-y-2"><Input placeholder="Motivo obligatorio del desbloqueo" value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} /><Button variant="outline" onClick={async () => { await mutation.mutateAsync({ action: 'set_period_lock', year, lockedThroughDate: '', reason: unlockReason }); toast.success('Período desbloqueado con trazabilidad.'); setUnlockReason(''); }} disabled={mutation.isPending || !unlockReason.trim()}><UnlockKeyhole className="mr-2 h-4 w-4" />Desbloquear</Button></div>}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div><h4 className="font-medium">Cierre integral</h4><p className="mt-1 text-xs text-muted-foreground">Primero ejecuta la prevalidación. El cierre se bloquea si hay asientos pendientes, descuadrados o apuntes huérfanos.</p></div>
            <Button variant="outline" onClick={runPreview} disabled={mutation.isPending || selected.status === 'cerrado'}>Analizar cierre</Button>
            {preview && <div className={`rounded-lg border p-3 text-xs ${preview.canClose ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
              <div className="flex items-center gap-2 font-medium">{preview.canClose ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}{preview.canClose ? 'Prevalidación superada' : 'Cierre bloqueado'}</div>
              <p className="mt-2">Resultado previo: {Number(preview.resultBeforeTax || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
              <p className="mt-2 text-muted-foreground">Controles del servidor: revisa cada incidencia en su apartado antes de repetir el análisis. Ningún control modifica la contabilidad automáticamente.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {CLOSING_CHECKS.map(check => {
                  const passed = Boolean(check.passed(preview));
                  return <div key={check.id} className={`rounded-md border px-3 py-2 ${passed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5'}`}>
                    <div className="flex items-center gap-2 font-medium">{passed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}{check.label}</div>
                    <div className="mt-1 flex items-center justify-between gap-2"><span className="text-muted-foreground">{check.detail(preview)}</span>{!passed && check.tab && onNavigate && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onNavigate(check.tab)}>Revisar</Button>}</div>
                  </div>;
                })}
              </div>
              {(preview.blockers || []).length > 0 && <details className="mt-3"><summary className="cursor-pointer font-medium">Ver motivos exactos del motor ({preview.blockers.length})</summary>{preview.blockers.map(item => <p className="mt-1" key={item}>• {item}</p>)}</details>
            </div>}
            {preview?.canClose && <div className="space-y-2"><Input placeholder={`Escribe CERRAR ${year}`} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /><Button variant="destructive" onClick={closeYear} disabled={mutation.isPending || confirmation.trim().toUpperCase() !== `CERRAR ${year}`}>Cerrar ejercicio</Button></div>}
            {selected.status === 'cerrado' && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">Reapertura auditada</p>
              <p className="text-[11px] text-amber-800">No borra ni reescribe asientos confirmados. Revierte apertura, cierre y regularización con nuevos contraasientos. Se bloqueará si el ejercicio siguiente ya tiene actividad.</p>
              <Input placeholder="Motivo documentado obligatorio" value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} />
              <Input placeholder={`Escribe REABRIR ${year}`} value={reopenConfirmation} onChange={(event) => setReopenConfirmation(event.target.value)} />
              <Button variant="outline" onClick={reopenYear} disabled={mutation.isPending || !reopenReason.trim() || reopenConfirmation.trim().toUpperCase() !== `REABRIR ${year}`}><UnlockKeyhole className="mr-2 h-4 w-4" />Reabrir con contraasientos</Button>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}


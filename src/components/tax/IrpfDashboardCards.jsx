import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, Receipt, RefreshCw, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const euro = value => value == null ? '—' : Number(value).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const date = value => String(value || '').split('-').reverse().join('/');

export default function IrpfDashboardCards({ companyId, userId, year, cutoff, windowStart }) {
  const client = useQueryClient();
  const queryKey = ['tax-dashboard-irpf', userId, companyId, year, cutoff, windowStart];
  const query = useQuery({
    queryKey, enabled: Boolean(companyId && userId && cutoff && windowStart), staleTime: 30000,
    refetchOnWindowFocus: true, retry: 1,
    queryFn: async () => {
      const response = await base44.functions.invoke('taxModelOperations', { action: 'dashboard_irpf', companyId, ejercicio: year, cutoff, windowStart });
      const data = response?.data;
      if (!data?.ok || data.companyId !== companyId || data.year !== year || data.cutoff !== cutoff || data.windowStart !== windowStart) throw new Error('No se pudo obtener la estimación IRPF de este perfil.');
      return data;
    },
  });
  useEffect(() => {
    if (!companyId || !userId) return;
    let timer;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => client.invalidateQueries({ queryKey: ['tax-dashboard-irpf', userId, companyId] }), 800); };
    const names = ['Invoice', 'InvoicePayment', 'JournalEntry', 'JournalEntryLine', 'AccountingPostingOperation', 'FiscalProfile', 'FiscalActivity', 'TaxModel', 'TaxFiling', 'TaxDraft'];
    const unsubscribers = [];
    for (const name of names) {
      try { const off = base44.entities[name]?.subscribe?.(refresh); if (typeof off === 'function') unsubscribers.push(off); } catch { /* El refresco manual y al recuperar el foco siguen disponibles. */ }
    }
    window.addEventListener('financials:refresh', refresh);
    return () => { clearTimeout(timer); unsubscribers.forEach(off => off()); window.removeEventListener('financials:refresh', refresh); };
  }, [companyId, userId, client]);

  const data = query.data?.companyId === companyId && query.data?.year === year && query.data?.cutoff === cutoff && query.data?.windowStart === windowStart ? query.data : null;
  const error = query.isError;
  const pending = query.isPending || !data;
  const state = data?.applicability?.state;
  const noEstimate = ['not_applicable', 'exempt', 'model131', 'special_activity', 'conflicting', 'unconfigured'].includes(state);
  const shortStatus = state === 'exempt' ? 'Sin pago fraccionado' : state === 'not_applicable' ? 'No corresponde' : state === 'model131' ? 'Modelo 131' : noEstimate ? 'Por configurar' : data?.provisional ? 'Estimación provisional' : 'Estimación';
  const heading = error ? 'No disponible' : pending ? 'Calculando…' : noEstimate ? shortStatus : euro(data.estimate);
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-3" aria-label="Estimación y retenciones IRPF">
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2"><span className="p-2 rounded-lg bg-taxea-red/10 text-taxea-red"><Calculator className="w-4 h-4" /></span><h3 className="font-semibold text-sm">IRPF · Modelo 130</h3></div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => query.refetch()} disabled={query.isFetching || !companyId || !userId} aria-label="Actualizar estimación IRPF"><RefreshCw className={'w-4 h-4 ' + (query.isFetching ? 'animate-spin' : '')} /></Button>
        </div>
        <div className="mt-3" aria-live="polite"><p className="text-2xl font-bold tracking-tight">{heading}</p><p className="text-xs text-muted-foreground mt-1">{error ? 'Reintenta para obtener datos actuales.' : pending ? 'Consultando contabilidad y pagos anteriores.' : data.applicability.label + (noEstimate ? '' : ' · ' + shortStatus)}</p></div>
        {data && !error && <>
          <p className="text-xs text-muted-foreground mt-3">{data.quarter} {year} · Acumulado {date(data.cumulativeStart)} – {date(data.cutoff)}{data.partialQuarter ? ' · trimestre en curso o corte parcial' : ''}</p>
          {!noEstimate && <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-xs">
              <Metric label="Rendimiento neto acumulado" value={data.basis.net} />
              <Metric label="Retenciones descontadas · cas. 06" value={data.basis.deductibleWithholdings} />
              <Metric label="Pagos anteriores · cas. 05" value={data.basis.priorPayments} />
              <Metric label="Resultado antes de deducciones" value={data.basis.grossPayment} />
            </div>
            {data.signedResult < 0 && <p className="text-xs text-muted-foreground mt-3">Resultado negativo: {euro(data.signedResult)}. No hay ingreso estimado; no equivale a devolución.</p>}
          </>}
          <details className="mt-4 text-xs border-t border-border pt-3">
            <summary className="cursor-pointer font-medium py-1">Ver cálculo y datos pendientes{data.warnings.length ? ` (${data.warnings.length})` : ''}</summary>
            {!noEstimate && <dl className="grid grid-cols-2 gap-3 mt-3">
              <Metric label="Ingresos computables · cas. 01" value={data.basis.revenue} />
              <Metric label="Gastos deducibles · cas. 02" value={data.basis.expenses} />
              <Metric label="Minoración · cas. 13" value={data.basis.reduction} />
              <Metric label="Negativos anteriores · cas. 15" value={data.basis.priorNegative} />
              <Metric label="Vivienda · cas. 16" value={data.basis.housing} />
              <Metric label="Ingreso previo del mismo período" value={data.basis.previousSamePeriod} />
            </dl>}
            <p className="mt-3 text-muted-foreground">{data.coverage.confirmedEntries} asientos confirmados incluidos. {data.basis.imputationMethod === 'cash' ? 'Criterio de cobros y pagos confirmado.' : 'Base contable por devengo, con los ajustes fiscales guardados que correspondan al corte.'}</p>
            {data.warnings.length > 0 && <ul className="mt-3 space-y-2 text-amber-700 dark:text-amber-400 list-disc pl-4">{data.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
            <p className="mt-3 text-muted-foreground">Orientativo, según los datos registrados. No presenta impuestos ni modifica facturas. Las retenciones a proveedores no se descuentan del 130 propio.</p>
          </details>
          {data.carryforward?.previousPaymentsSource === 'missing' && <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 mt-3"><Info className="w-4 h-4 shrink-0" />Faltan modelos anteriores o sus pagos confirmados. El cálculo provisional no los descuenta.</p>}
        </>}
      </div>
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 min-w-0">
        <div className="flex items-center gap-2"><span className="p-2 rounded-lg bg-violet-500/10 text-violet-500"><Receipt className="w-4 h-4" /></span><h3 className="font-semibold text-sm">IRPF en facturas · Acumulado {year}</h3></div>
        <p className="text-2xl font-bold tracking-tight mt-4">{error ? 'No disponible' : pending ? 'Calculando…' : euro(data.retentions.issued)}</p>
        <p className="text-xs text-muted-foreground mt-1">Retenciones en tus facturas emitidas</p>
        {data && !error && <>
          <p className="text-xs text-muted-foreground mt-3">{date(data.cumulativeStart)} – {date(data.cutoff)} · {data.retentions.issuedCount} facturas con retención</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs mt-4">
            <Metric label="En emitidas del período elegido" value={data.retentions.issuedPeriod} />
            <Metric label="Reconocido por cobros acumulados" value={data.retentions.recognizedByCollections} />
            <Metric label="Retenido a proveedores · acumulado" value={data.retentions.received} />
            <Metric label="En recibidas del período elegido" value={data.retentions.receivedPeriod} />
          </div>
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">El acumulado documental incluye facturas pendientes de cobro. La casilla 06 del 130 usa los cobros trazados o el ajuste manual guardado; no se resta dos veces. Puede incluir cobros de facturas de años anteriores.</p>
        </>}
        {error && <p role="status" className="text-xs text-amber-700 dark:text-amber-400 mt-3">La consulta IRPF ha fallado. El resto del dashboard continúa disponible.</p>}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return <div><dt className="text-muted-foreground leading-relaxed">{label}</dt><dd className="font-semibold mt-0.5">{euro(value)}</dd></div>;
}

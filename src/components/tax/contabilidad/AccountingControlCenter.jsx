import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;
const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

const unwrap = (response) => response?.data ?? response;
const readableError = (error, fallback) =>
  error?.response?.data?.error || error?.data?.error || error?.message || fallback;

async function invoke(functionName, payload) {
  const result = unwrap(await base44.functions.invoke(functionName, payload));
  if (!result || result.ok === false || result.success === false || result.error) {
    throw new Error(result?.error || 'La operación no devolvió una respuesta válida.');
  }
  return result;
}

async function collectReady(companyId, action, idField, extra = {}, batchSize = 5000) {
  let offset = 0;
  let guard = 0;
  const ids = [];
  const issues = [];
  while (guard < 50) {
    const response = await invoke('accountingOperations', {
      action,
      companyId,
      apply: false,
      offset,
      batchSize,
      ...extra,
    });
    ids.push(...(response.result?.[idField] || []));
    issues.push(...(response.result?.issues || []));
    if (response.done) break;
    if (!Number.isFinite(Number(response.nextOffset)) || Number(response.nextOffset) <= offset) {
      throw new Error(`La revisión ${action} no pudo avanzar de página.`);
    }
    offset = Number(response.nextOffset);
    guard += 1;
  }
  if (guard >= 50) throw new Error(`La revisión ${action} superó el límite seguro de páginas.`);
  return { ids: [...new Set(ids)], issues };
}

async function applyBatches(companyId, action, ids, field, extra = {}, batchSize = 5) {
  const totals = { posted: 0, repairedLinks: 0, alreadyPosted: 0, issues: [] };
  for (let index = 0; index < ids.length; index += batchSize) {
    const response = await invoke('accountingOperations', {
      action,
      companyId,
      apply: true,
      batchSize,
      [field]: ids.slice(index, index + batchSize),
      ...extra,
    });
    totals.posted += Number(response.result?.posted || 0);
    totals.repairedLinks += Number(response.result?.repairedLinks || 0);
    totals.alreadyPosted += Number(response.result?.alreadyPosted || 0);
    totals.issues.push(...(response.result?.issues || []));
  }
  return totals;
}

function ResultItem({ item, kind }) {
  if (kind === 'invoices') {
    return (
      <div className="grid gap-1 rounded-lg bg-white/70 px-3 py-2 text-xs sm:grid-cols-[100px_1fr_130px_110px]">
        <span className="font-semibold text-slate-700">{item.type || 'Factura'}</span>
        <span className="truncate text-slate-600">{item.number || 'Sin número'} · {item.party || 'Tercero sin identificar'}</span>
        <span className="text-slate-500">{item.date || 'Sin fecha'}</span>
        <span className="font-semibold text-slate-700 sm:text-right">{euro.format(Number(item.total || 0))}</span>
      </div>
    );
  }
  return (
    <div className="grid gap-1 rounded-lg bg-white/70 px-3 py-2 text-xs sm:grid-cols-[100px_1fr_130px_110px]">
      <span className="font-semibold text-slate-700">{item.entryNumber || item.type || 'Asiento'}</span>
      <span className="truncate text-slate-600">{item.description || item.source || 'Sin descripción'}</span>
      <span className="text-slate-500">{item.date || 'Sin fecha'}</span>
      <span className="font-semibold text-slate-700 sm:text-right">{euro.format(Number(item.total || 0))}</span>
    </div>
  );
}

function AuditResults({ audit, view, onViewChange, page, onPageChange }) {
  const collections = {
    invoices: audit?.invoiceDuplicateGroups || [],
    entries: audit?.journalDuplicateGroups || [],
    conflicts: audit?.invoiceEntryConflicts || [],
  };
  const rows = collections[view] || [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const labels = [
    ['invoices', `Facturas (${collections.invoices.length})`],
    ['entries', `Asientos (${collections.entries.length})`],
    ['conflicts', `Enlaces (${collections.conflicts.length})`],
  ];

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Facturas revisadas', audit.counts?.invoicesScanned || 0],
          ['Asientos revisados', audit.counts?.entriesScanned || 0],
          ['Grupos de facturas', audit.counts?.invoiceGroups || 0],
          ['Grupos de asientos', audit.counts?.journalGroups || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-1 rounded-lg bg-slate-200/60 p-1">
        {labels.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { onViewChange(id); onPageChange(1); }}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              view === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {!visible.length && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            No se han detectado incidencias en esta categoría.
          </div>
        )}
        {visible.map((group, index) => {
          if (view === 'conflicts') {
            return (
              <div key={`${group.invoice?.id || index}`} className="rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                <p className="text-xs font-semibold text-amber-800">{group.reason}</p>
                <div className="mt-2"><ResultItem item={group.invoice} kind="invoices" /></div>
              </div>
            );
          }
          return (
            <details key={`${group.key}-${index}`} className="group rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <summary className="cursor-pointer list-none text-xs font-semibold text-amber-900">
                {group.reason} · {group.items?.length || 0} registros · confianza {group.confidence}
              </summary>
              <div className="mt-2 space-y-1.5">
                {(group.items || []).map(item => <ResultItem key={item.id} item={item} kind={view} />)}
              </div>
            </details>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Página {safePage} de {totalPages}</span>
          <div className="flex gap-1">
            <button type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} className="rounded-md border bg-white p-1.5 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <button type="button" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} className="rounded-md border bg-white p-1.5 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountingControlCenter({ companyId }) {
  const [audit, setAudit] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [error, setError] = useState('');
  const [steps, setSteps] = useState([]);
  const [summary, setSummary] = useState(null);
  const [auditView, setAuditView] = useState('invoices');
  const [auditPage, setAuditPage] = useState(1);
  const busy = auditLoading || bankLoading;

  const riskCount = useMemo(() => {
    if (!audit) return 0;
    return Number(audit.counts?.invoiceGroups || 0)
      + Number(audit.counts?.journalGroups || 0)
      + Number(audit.counts?.invoiceEntryConflicts || 0);
  }, [audit]);

  const analyze = async () => {
    if (!companyId || busy) return;
    setAuditLoading(true);
    setError('');
    try {
      const response = await invoke('accountingOperations', { action: 'duplicate_audit', companyId });
      setAudit(response.audit);
      setAuditPage(1);
    } catch (requestError) {
      setError(readableError(requestError, 'No se pudo completar el análisis de duplicados.'));
    } finally {
      setAuditLoading(false);
    }
  };

  const synchronizeAndPost = async () => {
    if (!companyId || busy) return;
    const confirmed = window.confirm(
      'Taxea actualizará todas las cuentas bancarias conectadas, conciliará únicamente coincidencias de alta confianza, contabilizará facturas no duplicadas y enviará a 55500000 los movimientos sin correspondencia. No se borrará ninguna factura ni asiento. ¿Continuar?'
    );
    if (!confirmed) return;

    setBankLoading(true);
    setError('');
    setSummary(null);
    setSteps([]);
    const addStep = (text) => setSteps(current => [...current, text]);
    try {
      addStep('Analizando duplicados antes de contabilizar…');
      const auditResponse = await invoke('accountingOperations', { action: 'duplicate_audit', companyId });
      const currentAudit = auditResponse.audit;
      setAudit(currentAudit);
      const duplicateInvoiceIds = new Set(currentAudit.duplicateInvoiceIds || []);

      addStep('Comprobando cuentas Open Banking activas…');
      const snapshot = await invoke('openBanking', { action: 'treasury_snapshot', company_id: companyId });
      const connectedAccounts = (snapshot.accounts || []).filter(account =>
        account.activa !== false
        && account.estado_conexion === 'conectado'
        && account.origen_datos === 'open_banking'
        && account.provider_account_id
      );
      if (!connectedAccounts.length) throw new Error('No hay ninguna cuenta Open Banking activa para sincronizar.');

      let newTransactions = 0;
      let omittedTransactions = 0;
      let reconciledInvoices = 0;
      const syncedBankIds = [];
      const bankErrors = [];
      for (const account of connectedAccounts) {
        addStep(`Sincronizando ${account.nombre_banco || 'cuenta bancaria'}…`);
        try {
          const sync = await invoke('openBanking', {
            action: 'sync',
            company_id: companyId,
            bank_account_id: account.id,
            force: true,
          });
          syncedBankIds.push(account.id);
          newTransactions += Number(sync.created || sync.movimientos_nuevos || 0);
          omittedTransactions += Number(sync.duplicates || sync.movimientos_duplicados || 0);
          reconciledInvoices += Number(sync.auto_reconciliation?.reconciled || 0);
        } catch (syncError) {
          bankErrors.push(`${account.nombre_banco || 'Cuenta'}: ${readableError(syncError, 'error de sincronización')}`);
        }
      }
      if (!syncedBankIds.length) throw new Error(`No se pudo actualizar ninguna cuenta. ${bankErrors.join(' · ')}`);

      addStep('Buscando coincidencias seguras entre bancos y facturas…');
      const reconciliation = await invoke('openBanking', { action: 'auto_reconcile', company_id: companyId });
      reconciledInvoices += Number(reconciliation.reconciled || 0);

      addStep('Preparando asientos de facturas válidas no duplicadas…');
      const invoiceDryRun = await collectReady(companyId, 'sync_invoices', 'readyInvoiceIds');
      const safeInvoiceIds = invoiceDryRun.ids.filter(id => !duplicateInvoiceIds.has(id));
      const invoicePosting = await applyBatches(companyId, 'sync_invoices', safeInvoiceIds, 'invoiceIds', {}, 8);

      addStep('Contabilizando cobros y pagos conciliados…');
      const paymentDryRun = await collectReady(companyId, 'sync_payments', 'readyPaymentIds', {}, 500);
      const paymentPosting = await applyBatches(companyId, 'sync_payments', paymentDryRun.ids, 'paymentIds', {}, 5);

      addStep('Clasificando en 55500000 los movimientos pendientes de aplicar…');
      const unmatchedDryRun = await collectReady(
        companyId,
        'post_unmatched_bank',
        'readyTransactionIds',
        { bankAccountIds: syncedBankIds },
        5000
      );
      const unmatchedPosting = await applyBatches(
        companyId,
        'post_unmatched_bank',
        unmatchedDryRun.ids,
        'transactionIds',
        { bankAccountIds: syncedBankIds },
        15
      );

      const issueCount = invoiceDryRun.issues.length + invoicePosting.issues.length
        + paymentDryRun.issues.length + paymentPosting.issues.length
        + unmatchedDryRun.issues.length + unmatchedPosting.issues.length;
      setSummary({
        banks: syncedBankIds.length,
        newTransactions,
        omittedTransactions,
        reconciledInvoices,
        invoiceEntries: invoicePosting.posted,
        paymentEntries: paymentPosting.posted,
        pending555Entries: unmatchedPosting.posted,
        protectedDuplicates: duplicateInvoiceIds.size,
        issues: issueCount,
        bankErrors,
        completedAt: new Date().toISOString(),
      });
      addStep('Proceso completado con trazabilidad contable.');
      window.dispatchEvent(new Event('financials:refresh'));
    } catch (requestError) {
      setError(readableError(requestError, 'No se pudo completar la sincronización contable bancaria.'));
    } finally {
      setBankLoading(false);
    }
  };

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-5 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-white/15 bg-white/10 p-2.5"><ShieldCheck className="h-5 w-5 text-cyan-300" /></div>
            <div>
              <h2 className="font-jakarta text-base font-bold">Control contable automático</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
                Detecta duplicidades sin borrar datos y ejecuta el circuito banco → factura → asiento. Las partidas sin correspondencia pasan provisionalmente a 55500000 para revisión.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={analyze} disabled={!companyId || busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold hover:bg-white/15 disabled:opacity-50">
              {auditLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {auditLoading ? 'Analizando…' : 'Analizar duplicados'}
            </button>
            <button type="button" onClick={synchronizeAndPost} disabled={!companyId || busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">
              {bankLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {bankLoading ? 'Procesando…' : 'Sincronizar y contabilizar'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Search className="h-4 w-4 text-amber-500" /> Duplicados</div>
            <p className="mt-1 text-xs text-slate-500">Solo informa y protege los registros dudosos. Nunca elimina automáticamente.</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Landmark className="h-4 w-4 text-cyan-600" /> Conciliación segura</div>
            <p className="mt-1 text-xs text-slate-500">Exige importe, sentido, moneda, fecha y evidencia del cliente o proveedor.</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Sin duplicar asientos</div>
            <p className="mt-1 text-xs text-slate-500">Cada factura y movimiento bancario conserva una clave contable idempotente.</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}

        {steps.length > 0 && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
            <p className="text-xs font-semibold text-blue-900">Ejecución</p>
            <div className="mt-2 space-y-1">
              {steps.map((step, index) => (
                <div key={`${step}-${index}`} className="flex items-center gap-2 text-xs text-blue-700">
                  {bankLoading && index === steps.length - 1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {summary && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><CheckCircle2 className="h-4 w-4" /> Sincronización contable completada</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
              {[
                ['Bancos', summary.banks],
                ['Mov. nuevos', summary.newTransactions],
                ['Facturas conciliadas', summary.reconciledInvoices],
                ['Asientos factura', summary.invoiceEntries],
                ['Asientos cobro/pago', summary.paymentEntries],
                ['Asientos a 555', summary.pending555Entries],
                ['Incidencias', summary.issues + summary.bankErrors.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white px-2.5 py-2 shadow-sm">
                  <p className="text-[10px] text-slate-400">{label}</p><p className="mt-0.5 text-base font-bold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
            {summary.protectedDuplicates > 0 && <p className="mt-3 text-xs text-amber-700">{summary.protectedDuplicates} facturas señaladas como posibles duplicados se excluyeron de la contabilización automática.</p>}
            {summary.bankErrors.length > 0 && <p className="mt-2 text-xs text-red-700">Cuentas no actualizadas: {summary.bankErrors.join(' · ')}</p>}
          </div>
        )}

        {audit && (
          <>
            <div className={cn('mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm', riskCount ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
              {riskCount ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {riskCount ? `${riskCount} grupos o enlaces requieren revisión. No se ha eliminado ni anulado nada.` : 'No se han detectado duplicidades ni enlaces contables inconsistentes.'}
            </div>
            <AuditResults audit={audit} view={auditView} onViewChange={setAuditView} page={auditPage} onPageChange={setAuditPage} />
          </>
        )}
      </div>
    </section>
  );
}


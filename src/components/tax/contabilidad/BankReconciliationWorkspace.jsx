import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronLeft,
  ChevronRight, Loader2, RefreshCw, Search, SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 8;
const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const unwrap = (response) => response?.data ?? response;
const readableError = (error, fallback) =>
  error?.response?.data?.error || error?.data?.error || error?.message || fallback;

async function invoke(payload) {
  const result = unwrap(await base44.functions.invoke('accountingOperations', payload));
  if (!result || result.success === false || result.error) {
    throw new Error(result?.error || 'La operación no devolvió una respuesta válida.');
  }
  return result;
}

function Pager({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
      <span>Página {page} de {totalPages}</span>
      <div className="flex gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}
          className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}
          className="rounded-lg border border-slate-200 bg-white p-2 disabled:opacity-40">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-700">{children}</div>;
}

export default function BankReconciliationWorkspace({ companyId, refreshToken }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [view, setView] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedAccounts, setSelectedAccounts] = useState({});
  const [fxValues, setFxValues] = useState({});

  const loadOverview = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError('');
    try {
      const response = await invoke({ action: 'bank_reconciliation_overview', companyId });
      setOverview(response.overview);
    } catch (requestError) {
      setError(readableError(requestError, 'No se pudo cargar el control bancario.'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadOverview(); }, [loadOverview, refreshToken]);
  useEffect(() => {
    const refresh = () => loadOverview();
    window.addEventListener('financials:refresh', refresh);
    return () => window.removeEventListener('financials:refresh', refresh);
  }, [loadOverview]);

  const pendingRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = overview?.bank555Entries || overview?.pending555 || [];
    if (!query) return rows;
    return rows.filter(item => [item.concept, item.counterparty, item.bankName, item.bankLast4, item.entryNumber]
      .some(value => String(value || '').toLowerCase().includes(query)));
  }, [overview, search]);

  const incidentRows = overview?.incidents || [];
  const visibleSource = view === 'pending' ? pendingRows : incidentRows;
  const totalPages = Math.max(1, Math.ceil(visibleSource.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = visibleSource.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const changeView = (nextView) => {
    setView(nextView);
    setPage(1);
    setSearch('');
    setError('');
    setMessage('');
  };

  const reclassify = async (transaction) => {
    const targetAccountId = selectedAccounts[transaction.id];
    if (!targetAccountId) return setError('Selecciona primero la cuenta contable de contrapartida.');
    const target = overview.selectableAccounts.find(account => account.id === targetAccountId);
    if (!window.confirm(`Se conservará el asiento bancario y se reclasificará la 555 contra ${target?.code || 'la cuenta seleccionada'}. ¿Continuar?`)) return;
    setWorkingId(transaction.id);
    setError('');
    setMessage('');
    try {
      const response = await invoke({
        action: 'reclassify_pending_bank', companyId, apply: true,
        transactionId: transaction.id, targetAccountId,
      });
      setOverview(response.overview);
      setSelectedAccounts(current => {
        const next = { ...current };
        delete next[transaction.id];
        return next;
      });
      setMessage(`Movimiento reclasificado en ${response.result.entryNumber} contra ${response.result.targetAccountCode}.`);
      window.dispatchEvent(new Event('financials:refresh'));
    } catch (requestError) {
      setError(readableError(requestError, 'No se pudo reclasificar el movimiento.'));
    } finally {
      setWorkingId('');
    }
  };

  const regularizeOpening = async (bank) => {
    if (!window.confirm(`Taxea creará un único asiento de apertura 572/555 por ${euro.format(Math.abs(Number(bank.difference || 0)))}. ¿Continuar?`)) return;
    setWorkingId(`bank-${bank.id}`);
    setError('');
    setMessage('');
    try {
      const response = await invoke({
        action: 'create_bank_opening_adjustment', companyId, apply: true, bankAccountId: bank.id,
      });
      setOverview(response.overview);
      setMessage(response.result.alreadyBalanced
        ? 'La cuenta ya estaba cuadrada.'
        : `Saldo inicial regularizado mediante ${response.result.entry.entryNumber}.`);
      window.dispatchEvent(new Event('financials:refresh'));
    } catch (requestError) {
      setError(readableError(requestError, 'No se pudo regularizar el saldo inicial.'));
    } finally {
      setWorkingId('');
    }
  };

  if (!companyId) return <EmptyState>Selecciona una empresa para revisar la conciliación bancaria.</EmptyState>;

  const saveExchangeRate = async (incident) => {
    const values = fxValues[incident.transactionId] || {};
    const exchangeRate = Number(values.rate);
    const exchangeRateDate = values.date || incident.date || new Date().toISOString().slice(0, 10);
    const exchangeRateSource = String(values.source || '').trim();
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0 || exchangeRate === 1) return setError('Indica un tipo de cambio a EUR valido y distinto de 1.');
    if (exchangeRateSource.length < 3) return setError('Indica una fuente verificable para el tipo de cambio.');
    if (!window.confirm('Se guardara el tipo de cambio. Si ya existe un asiento confirmado, Taxea generara un ajuste trazado sin modificar el asiento original.')) return;
    setWorkingId(`fx-${incident.transactionId}`);
    setError('');
    setMessage('');
    try {
      const response = await invoke({
        action: 'save_bank_exchange_rate', companyId, apply: true,
        transactionId: incident.transactionId, exchangeRate, exchangeRateDate, exchangeRateSource,
      });
      setOverview(response.overview);
      setMessage(response.result?.correction
        ? `Tipo de cambio guardado y asiento corrector ${response.result.correction.entryNumber} creado.`
        : 'Tipo de cambio guardado. El movimiento ya puede contabilizarse en EUR.');
      window.dispatchEvent(new Event('financials:refresh'));
    } catch (requestError) {
      setError(readableError(requestError, 'No se pudo guardar el tipo de cambio.'));
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-cyan-700" />
              <h3 className="text-sm font-bold text-slate-900">Mesa de conciliación</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">Revisa la 555 movimiento a movimiento, corrige incidencias y compara el banco con cada 572.</p>
          </div>
          <button type="button" onClick={loadOverview} disabled={loading || Boolean(workingId)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Actualizar control
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ['Bancos conectados', overview?.counts?.banks || 0],
            ['Bancos cuadrados', overview?.counts?.balancedBanks || 0],
            ['Pendientes en 555', overview?.counts?.pending555 || 0],
            ['Incidencias', overview?.counts?.incidents || 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{loading ? '—' : value}</p>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />{error}</div>}
      {message && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />{message}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {[
            ['pending', `Asientos 555 (${overview?.counts?.bank555Entries || overview?.counts?.pending555 || 0})`],
            ['incidents', `Incidencias (${overview?.counts?.incidents || 0})`],
            ['balances', 'Saldo banco / 572'],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => changeView(id)}
              className={cn('rounded-lg px-3 py-2 text-xs font-semibold', view === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
              {label}
            </button>
          ))}
        </div>

        {loading && !overview && <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando conciliación bancaria…</div>}

        {!loading && overview && view === 'pending' && (
          <div className="mt-4">
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Buscar por banco, concepto, tercero o asiento…"
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none ring-cyan-500 focus:ring-2" />
            </div>
            <div className="mt-4 space-y-3">
              {!visibleRows.length && <EmptyState>No hay movimientos pendientes en 555 con asiento bancario activo.</EmptyState>}
              {visibleRows.map((transaction) => {
                const incoming = transaction.direction === 'entrada' || Number(transaction.amount) >= 0;
                return (
                  <article key={transaction.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase', incoming ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                            {incoming ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{incoming ? 'Entrada' : 'Salida'}
                          </span>
                          <span className={cn(
                            'rounded-full px-2 py-1 text-[10px] font-bold uppercase',
                            transaction.isPending ? 'bg-amber-100 text-amber-700' : 'bg-cyan-100 text-cyan-700'
                          )}>
                            {transaction.isPending ? 'Pendiente en 555' : 'Reclasificado'}
                          </span>
                          <span className="text-xs text-slate-500">{transaction.date || 'Sin fecha'}</span>
                          <span className="text-xs text-slate-500">{transaction.bankName}{transaction.bankLast4 ? ` · ${transaction.bankLast4}` : ''}</span>
                        </div>
                        <p className="mt-2 break-words text-sm font-semibold text-slate-900">{transaction.concept}</p>
                        {transaction.counterparty && <p className="mt-1 text-xs text-slate-500">{transaction.counterparty}</p>}
                      </div>
                      <p className={cn('text-lg font-bold', incoming ? 'text-emerald-700' : 'text-rose-700')}>{euro.format(Number(transaction.amount || 0))}</p>
                    </div>
                    <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-700">Ver asiento {transaction.entryNumber || 'bancario'} y sus apuntes</summary>
                      <div className="mt-2 space-y-1">
                        {(transaction.lines || []).map((line, index) => (
                          <div key={`${transaction.id}-${line.accountCode}-${index}`} className="grid gap-1 rounded-md bg-slate-50 px-2 py-2 text-xs sm:grid-cols-[90px_1fr_110px_110px]">
                            <span className="font-semibold text-slate-700">{line.accountCode}</span>
                            <span className="truncate text-slate-500">{line.accountName}</span>
                            <span className="sm:text-right">Debe {euro.format(Number(line.debit || 0))}</span>
                            <span className="sm:text-right">Haber {euro.format(Number(line.credit || 0))}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                    {transaction.isPending ? (
                      <>
                        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto]">
                          <select value={selectedAccounts[transaction.id] || ''}
                            onChange={(event) => setSelectedAccounts(current => ({ ...current, [transaction.id]: event.target.value }))}
                            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                            <option value="">Seleccionar cuenta contable definitiva…</option>
                            {(overview.selectableAccounts || []).map(account => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
                          </select>
                          <button type="button" onClick={() => reclassify(transaction)} disabled={Boolean(workingId) || !selectedAccounts[transaction.id]}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
                            {workingId === transaction.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Reclasificar 555
                          </button>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-400">El asiento bancario se conserva. La reclasificación queda trazada y el movimiento no puede aplicarse dos veces.</p>
                      </>
                    ) : (
                      <p className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-700">
                        Este movimiento ya salió de la 555. Para modificarlo de nuevo debe revisarse en el diario y corregirse mediante contraasiento.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
            <Pager page={safePage} totalPages={totalPages} onChange={setPage} />
          </div>
        )}

        {!loading && overview && view === 'incidents' && (
          <div className="mt-4 space-y-3">
            {!visibleRows.length && <EmptyState>No hay incidencias bancarias o contables pendientes.</EmptyState>}
            {visibleRows.map((incident, index) => (
              <article key={`${incident.type}-${incident.transactionId || incident.bankAccountId || index}-${index}`}
                className={cn('rounded-xl border p-4', incident.severity === 'alta' ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/70')}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn('mt-0.5 h-4 w-4 flex-shrink-0', incident.severity === 'alta' ? 'text-red-600' : 'text-amber-600')} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{incident.title}</p>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{incident.severity || 'revisión'}</span>
                    </div>
                    <p className="mt-1 break-words text-xs leading-relaxed text-slate-600">{incident.detail}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">{incident.type}</p>
                    {incident.type === 'missing_exchange_rate' && (
                      <div className="mt-3 grid gap-2 rounded-xl border border-red-200 bg-white/80 p-3 sm:grid-cols-[120px_150px_1fr_auto]">
                        <label className="text-[11px] font-medium text-slate-600">Cambio a EUR
                          <input type="number" step="0.00000001" placeholder="0,00000000"
                            value={fxValues[incident.transactionId]?.rate || ''}
                            onChange={event => setFxValues(current => ({ ...current, [incident.transactionId]: { ...current[incident.transactionId], rate: event.target.value } }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                        </label>
                        <label className="text-[11px] font-medium text-slate-600">Fecha
                          <input type="date" value={fxValues[incident.transactionId]?.date || incident.date || ''}
                            onChange={event => setFxValues(current => ({ ...current, [incident.transactionId]: { ...current[incident.transactionId], date: event.target.value } }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                        </label>
                        <label className="text-[11px] font-medium text-slate-600">Fuente verificable
                          <input placeholder="BCE o extracto bancario"
                            value={fxValues[incident.transactionId]?.source || ''}
                            onChange={event => setFxValues(current => ({ ...current, [incident.transactionId]: { ...current[incident.transactionId], source: event.target.value } }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                        </label>
                        <button type="button" onClick={() => saveExchangeRate(incident)}
                          disabled={Boolean(workingId)} className="self-end rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
                          {workingId === `fx-${incident.transactionId}` ? 'Guardando...' : 'Validar cambio'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
            <Pager page={safePage} totalPages={totalPages} onChange={setPage} />
          </div>
        )}

        {!loading && overview && view === 'balances' && (
          <div className="mt-4 space-y-3">
            {!(overview.banks || []).length && <EmptyState>No hay cuentas Open Banking conectadas para la empresa activa.</EmptyState>}
            {(overview.banks || []).map(bank => (
              <article key={bank.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{bank.name}{bank.last4 ? ` · ${bank.last4}` : ''}</p>
                      <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold uppercase', bank.balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                        {bank.balanced ? 'Cuadrada' : 'Revisión necesaria'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Subcuenta {bank.accountingAccountCode || 'sin asignar'} · última sincronización {bank.lastSyncAt ? new Date(bank.lastSyncAt).toLocaleString('es-ES') : 'sin dato'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ['Saldo banco', bank.bankBalance], ['Saldo contable', bank.ledgerBalance],
                      ['Diferencia', bank.difference], ['Mov. sin asiento', bank.pendingTransactions],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right">
                        <p className="text-[10px] text-slate-400">{label}</p>
                        <p className={cn('mt-0.5 text-sm font-bold', label === 'Diferencia' && Math.abs(Number(value || 0)) > 0.01 ? 'text-amber-700' : 'text-slate-800')}>
                          {label === 'Mov. sin asiento' ? Number(value || 0) : euro.format(Number(value || 0))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                {!bank.accountingAccountId && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Asigna primero una subcuenta bancaria 572 a esta cuenta.</p>}
                {bank.pendingTransactions > 0 && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Hay {bank.pendingTransactions} movimientos sin asiento activo. Deben contabilizarse o corregirse antes de ajustar la apertura.</p>}
                {bank.openingEntryId && !bank.balanced && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Ya existe un asiento de apertura. La diferencia restante exige revisión y, si procede, contraasiento; Taxea no repetirá el ajuste.</p>}
                {bank.canRegularizeOpening && (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-cyan-800">El histórico está contabilizado, pero falta una diferencia inicial de {euro.format(Math.abs(Number(bank.difference || 0)))}.</p>
                    <button type="button" onClick={() => regularizeOpening(bank)} disabled={Boolean(workingId)}
                      className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
                      {workingId === `bank-${bank.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Regularizar apertura 572/555
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


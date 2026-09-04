import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Plus, Building2, LayoutGrid, ArrowLeftRight, Layers, CalendarDays, Banknote, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import BankCard from './BankCard';
import ConnectBankModal from './ConnectBankModal';
import BankConsolidation from './BankConsolidation';
import BankTransactionsTable from './BankTransactionsTable';
import ReconciliationPanel from './ReconciliationPanel';
import TreasuryCalendar from './TreasuryCalendar';
import TreasuryEventsPanel from './TreasuryEventsPanel';


const BANK_EVENT_CHANNEL = 'taxea-open-banking';
const BANK_EVENT_STORAGE_KEY = 'taxea_open_banking_event';
const finalizationRequests = new Map();

function readableBankError(error, fallback) {
  return error?.response?.data?.error || error?.data?.error || error?.message || fallback;
}

function finalizeAuthorizationOnce(key, payload) {
  if (!finalizationRequests.has(key)) {
    const request = base44.functions.invoke('openBanking', payload);
    finalizationRequests.set(key, request);
    window.setTimeout(() => {
      if (finalizationRequests.get(key) === request) finalizationRequests.delete(key);
    }, 120000);
  }
  return finalizationRequests.get(key);
}

function publishBankEvent(event) {
  const message = { ...event, emitted_at: Date.now() };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(BANK_EVENT_CHANNEL);
      channel.postMessage(message);
      channel.close();
    }
  } catch { /* localStorage remains as fallback */ }
  try {
    window.localStorage.setItem(BANK_EVENT_STORAGE_KEY, JSON.stringify(message));
  } catch { /* the callback page still shows its own result */ }
}

const TABS = [
  { id: 'bancos',       label: 'Bancos',         icon: Building2 },
  { id: 'movimientos',  label: 'Movimientos',     icon: LayoutGrid },
  { id: 'conciliacion', label: 'Conciliación',    icon: ArrowLeftRight },
  { id: 'previsiones',  label: 'Previsiones',     icon: Banknote },
  { id: 'calendario',   label: 'Calendario',      icon: CalendarDays },
];

export default function TreasuryCenter({ company }) {
  const [tab, setTab] = useState('bancos');
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [events, setEvents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [reconTx, setReconTx] = useState(null);
  const [syncingBanks, setSyncingBanks] = useState(false);
  const [bankNotice, setBankNotice] = useState(null);

  const companyId = company?.id;

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    const [accs, txs, evs, invs, exps, obls] = await Promise.all([
      base44.entities.BankAccount.filter({ company_id: companyId }),
      base44.entities.BankTransaction.filter({ company_id: companyId }, '-fecha_operacion', 5000),
      base44.entities.TreasuryEvent.filter({ company_id: companyId }),
      base44.entities.Invoice.filter({ company_id: companyId }),
      base44.entities.Expense.filter({ company_id: companyId }),
      base44.entities.TaxObligation.filter({ company_id: companyId }),
    ]);
    setAccounts(accs);
    setTransactions(txs);
    setEvents(evs);
    setInvoices(invs);
    setExpenses(exps);
    setObligations(obls);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const handleMessage = async (message) => {
      if (!message || message.company_id !== companyId) return;
      if (message.type === 'connected') {
        setBankNotice({ type: 'success', text: message.text || 'Banco conectado y datos actualizados.' });
        await loadData();
      } else if (message.type === 'error') {
        setBankNotice({ type: 'error', text: message.text || 'No se pudo completar la conexión bancaria.' });
      }
    };
    let channel = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(BANK_EVENT_CHANNEL);
        channel.onmessage = event => handleMessage(event.data);
      }
    } catch { channel = null; }
    const onStorage = event => {
      if (event.key !== BANK_EVENT_STORAGE_KEY || !event.newValue) return;
      try { handleMessage(JSON.parse(event.newValue)); } catch { /* ignore malformed local event */ }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const params = new URLSearchParams(window.location.search);
    const accountId = params.get('bank_account_id');
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return;
    let active = true;
    const requestKey = `${companyId}:${state}:${code}`;
    setBankNotice({ type: 'loading', text: 'Finalizando autorización bancaria y descargando movimientos…' });
    const finalize = async () => {
      try {
        const response = await finalizeAuthorizationOnce(requestKey, {
          action: 'finalize', company_id: companyId, ...(accountId ? { bank_account_id: accountId } : {}), code, state,
        });
        const payload = response?.data ?? response;
        if (!payload?.ok) throw new Error(payload?.error || 'El banco todavía no ha completado la autorización.');
        const count = (payload.accounts || []).reduce((sum, item) => sum + Number(item.created || 0), 0);
        const text = payload.session_status === 'PROCESSING'
          ? 'Autorización recibida. Taxea está terminando de sincronizar la cuenta.'
          : `Banco conectado. ${count} movimientos nuevos incorporados sin duplicar los existentes.`;
        publishBankEvent({ type: 'connected', company_id: companyId, text });
        if (active) {
          setBankNotice({ type: 'success', text });
          await loadData();
        }
        if (window.name === 'taxea_open_banking') window.setTimeout(() => window.close(), 1200);
      } catch (error) {
        const text = readableBankError(error, 'No se pudo finalizar la conexión bancaria.');
        publishBankEvent({ type: 'error', company_id: companyId, text });
        if (active) setBankNotice({ type: 'error', text });
      } finally {
        const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
        window.history.replaceState({}, '', cleanUrl);
      }
    };
    finalize();
    return () => { active = false; };
  }, [companyId]);

  const syncAllBanks = async () => {
    const connected = accounts.filter(account => account.estado_conexion === 'conectado' && account.origen_datos === 'open_banking' && account.provider_account_id);
    if (!connected.length || syncingBanks) {
      setBankNotice({ type: 'error', text: 'No hay cuentas Open Banking activas para sincronizar.' });
      return;
    }
    setSyncingBanks(true);
    setBankNotice({ type: 'loading', text: `Sincronizando ${connected.length} ${connected.length === 1 ? 'cuenta' : 'cuentas'}…` });
    let created = 0;
    const failures = [];
    for (const account of connected) {
      try {
        const response = await base44.functions.invoke('openBanking', { action: 'sync', company_id: companyId, bank_account_id: account.id });
        const payload = response?.data ?? response;
        if (!payload?.ok) throw new Error(payload?.error || 'Error de sincronización');
        created += Number(payload.created || 0);
      } catch (error) {
        failures.push(`${account.nombre_banco}: ${error?.message || 'error'}`);
      }
    }
    await loadData();
    setSyncingBanks(false);
    setBankNotice(failures.length
      ? { type: 'error', text: `${created} movimientos nuevos. ${failures.join(' · ')}` }
      : { type: 'success', text: `Sincronización completada. ${created} movimientos nuevos; los duplicados se han omitido.` });
  };

  const pendingConciliation = useMemo(() =>
    transactions.filter(t => t.estado_proveedor !== 'pending' && (t.estado_conciliacion === 'sin_conciliar' || t.estado_conciliacion === 'sugerida_ia')).length,
    [transactions]);

  if (!companyId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-400">Selecciona una empresa para acceder a Treasury.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-taxea-red/8 border border-taxea-red/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-taxea-red" />
          </div>
          <div>
            <h2 className="text-lg font-jakarta font-bold text-foreground">Treasury / Tesorería</h2>
            <p className="text-xs text-slate-400">{accounts.length} {accounts.length === 1 ? 'cuenta bancaria' : 'cuentas bancarias'} · {transactions.length} movimientos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">

          <button onClick={syncAllBanks} disabled={syncingBanks} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all">
            <RefreshCw className={cn("w-3.5 h-3.5", syncingBanks && 'animate-spin')} /> {syncingBanks ? 'Sincronizando…' : 'Sincronizar bancos'}
          </button>
          <button onClick={() => setShowConnect(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Conectar banco
          </button>
        </div>
      </div>

      {bankNotice && (
        <div className={cn("rounded-xl border px-4 py-3 text-sm",
          bankNotice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
          bankNotice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700')}>
          {bankNotice.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          const badge = t.id === 'conciliacion' && pendingConciliation > 0;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all",
                tab === t.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              <Icon className="w-3.5 h-3.5" />
              {t.label}
              {badge && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-taxea-red text-white text-[9px] flex items-center justify-center font-bold">{pendingConciliation > 9 ? '9+' : pendingConciliation}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* BANCOS */}
          {tab === 'bancos' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-taxea-red/8 flex items-center justify-center mb-4">
                    <Building2 className="w-8 h-8 text-taxea-red/60" />
                  </div>
                  <p className="text-base font-semibold text-foreground mb-1">Sin cuentas bancarias</p>
                  <p className="text-sm text-slate-400 max-w-xs mb-6">Conecta tus cuentas para ver saldos, movimientos y conciliación en tiempo real.</p>
                  <button onClick={() => setShowConnect(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
                    <Plus className="w-4 h-4" /> Conectar primer banco
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {accounts.map((acc, i) => (
                      <BankCard key={acc.id} account={acc} companyId={companyId} delay={i * 0.06}
                        onViewMovements={() => setTab('movimientos')}
                        onDisconnect={async (a) => { await base44.entities.BankAccount.update(a.id, { estado_conexion: 'desconectado' }); loadData(); }}
                        onRefresh={loadData}
                      />
                    ))}
                    <button onClick={() => setShowConnect(true)}
                      className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-slate-300 hover:border-taxea-red/30 hover:text-taxea-red/50 transition-all min-h-[160px]">
                      <Plus className="w-6 h-6" />
                      <span className="text-xs font-medium">Conectar banco</span>
                    </button>
                  </div>
                  <BankConsolidation accounts={accounts} />
                </>
              )}
            </motion.div>
          )}

          {/* MOVIMIENTOS */}
          {tab === 'movimientos' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <BankTransactionsTable transactions={transactions} accounts={accounts} onConciliar={tx => { setReconTx(tx); setTab('conciliacion'); }} />
            </motion.div>
          )}

          {/* CONCILIACIÓN */}
          {tab === 'conciliacion' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <BankTransactionsTable
                transactions={transactions.filter(t => t.estado_proveedor !== 'pending' && ['sin_conciliar', 'sugerida_ia', 'revisar'].includes(t.estado_conciliacion))}
                accounts={accounts}
                onConciliar={tx => setReconTx(tx)}
              />
            </motion.div>
          )}

          {/* PREVISIONES */}
          {tab === 'previsiones' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid lg:grid-cols-2 gap-4">
              <TreasuryEventsPanel events={events} companyId={companyId} accounts={accounts} onRefresh={loadData} />
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">Impacto en Cashflow (próx. 30 días)</p>
                  {['cobro_previsto', 'pago_previsto', 'impuesto'].map(tipo => {
                    const total = events.filter(e => e.tipo === tipo).reduce((s, e) => s + (e.importe || 0), 0);
                    const labels = { cobro_previsto: 'Cobros previstos', pago_previsto: 'Pagos previstos', impuesto: 'Impuestos' };
                    const colors = { cobro_previsto: 'text-emerald-600', pago_previsto: 'text-red-500', impuesto: 'text-amber-600' };
                    return (
                      <div key={tipo} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <span className="text-sm text-slate-600">{labels[tipo]}</span>
                        <span className={cn("text-sm font-bold", colors[tipo])}>
                          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(total)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* CALENDARIO */}
          {tab === 'calendario' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <TreasuryCalendar events={events} obligations={obligations} />
            </motion.div>
          )}
        </>
      )}

      {showConnect && (
        <ConnectBankModal companyId={companyId} onClose={() => setShowConnect(false)}
          onConnected={() => { setShowConnect(false); loadData(); }} />
      )}

      {reconTx && (
        <ReconciliationPanel transaction={reconTx} invoices={invoices} expenses={expenses}
          onClose={() => setReconTx(null)} onReconciled={loadData} />
      )}
    </div>
  );
}
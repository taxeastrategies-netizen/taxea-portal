import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle,
  FileText,
  Search,
  SplitSquareHorizontal,
  X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

function fmt(value, currency = 'EUR') {
  if (!value && value !== 0) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

const CONFIDENCE_CFG = {
  alta: { label: 'Coincidencia alta', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  media: { label: 'Coincidencia media', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  baja: { label: 'Coincidencia baja', color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
};

function scoreMatch(transaction, candidate) {
  let score = 0;
  const transactionAmount = Math.abs(transaction.importe || 0);
  const candidateAmount = Math.abs(candidate.importe_pendiente ?? candidate.total_factura ?? candidate.total ?? 0);
  if (Math.abs(transactionAmount - candidateAmount) < 0.01) score += 50;
  else if (candidateAmount > 0 && Math.abs(transactionAmount - candidateAmount) < candidateAmount * 0.05) score += 20;
  const bankText = `${transaction.concepto || ''} ${transaction.nombre_contraparte || ''} ${transaction.referencia || ''}`.toLowerCase();
  const party = (candidate.cliente_nombre || candidate.proveedor_nombre || '').toLowerCase();
  if (party && bankText.includes(party.split(' ')[0])) score += 25;
  const invoiceNumber = (candidate.numero_factura || '').toLowerCase();
  if (invoiceNumber && bankText.includes(invoiceNumber)) score += 30;
  return score;
}

export default function ReconciliationPanel({ transaction, invoices, onClose, onReconciled }) {
  const [mode, setMode] = useState('invoice');
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedBankLedgerId, setSelectedBankLedgerId] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [bankLedgerAccounts, setBankLedgerAccounts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!transaction?.id) return;
    setMode('invoice');
    setSelected(null);
    setSelectedAccountId('');
    setSelectedBankLedgerId('');
    setAccountSearch('');
    setError('');
    setLoadingAccounts(true);
    base44.functions.invoke('openBanking', {
      action: 'accounting_options',
      company_id: transaction.company_id,
      bank_transaction_id: transaction.id,
    }).then(response => {
      const payload = response?.data ?? response;
      if (!payload?.ok) throw new Error(payload?.error || 'No se pudo cargar el plan contable.');
      setAccounts(payload.accounts || []);
      setBankLedgerAccounts(payload.bank_accounts || []);
      setSelectedBankLedgerId(payload.recommended_bank_account_id || '');
    }).catch(caught => {
      setError(caught?.response?.data?.error || caught?.message || 'No se pudo cargar el plan contable.');
    }).finally(() => setLoadingAccounts(false));
  }, [transaction?.id, transaction?.company_id]);

  const candidates = useMemo(() => {
    if (!transaction) return [];
    const incoming = transaction.tipo === 'entrada';
    const pool = incoming
      ? invoices.filter(invoice => invoice.tipo === 'emitida' && invoice.estado_cobro !== 'cobrada')
      : invoices.filter(invoice => invoice.tipo === 'recibida' && invoice.estado_cobro !== 'cobrada');
    return pool.map(candidate => {
      const score = scoreMatch(transaction, candidate);
      const confidence = score >= 70 ? 'alta' : score >= 35 ? 'media' : 'baja';
      return { ...candidate, _score: score, _conf: confidence };
    }).sort((left, right) => right._score - left._score).slice(0, 12);
  }, [transaction, invoices]);

  const filteredAccounts = useMemo(() => {
    const query = accountSearch.trim().toLowerCase();
    return accounts
      .filter(account => account.id !== selectedBankLedgerId)
      .filter(account => !query || `${account.code} ${account.name} ${account.type || ''}`.toLowerCase().includes(query))
      .slice(0, 100);
  }, [accounts, accountSearch, selectedBankLedgerId]);

  const selectedAccount = accounts.find(account => account.id === selectedAccountId);
  const selectedBankLedger = bankLedgerAccounts.find(account => account.id === selectedBankLedgerId);
  const amount = Math.abs(transaction?.importe || 0);
  const currency = transaction?.moneda || 'EUR';

  const finish = async () => {
    await onReconciled?.();
    onClose();
  };

  const handleInvoiceConfirm = async () => {
    if (!selected || !selectedBankLedgerId || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await base44.functions.invoke('invoiceOperations', {
        action: 'reconcile',
        company_id: transaction.company_id,
        invoice_id: selected.id,
        bank_transaction_id: transaction.id,
        bank_accounting_account_id: selectedBankLedgerId,
      });
      const payload = response?.data ?? response;
      if (!payload?.ok) throw new Error(payload?.error || 'No se pudo completar la conciliación.');
      await finish();
    } catch (caught) {
      setError(caught?.response?.data?.error || caught?.message || 'No se pudo completar la conciliación.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountConfirm = async () => {
    if (!selectedAccountId || !selectedBankLedgerId || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await base44.functions.invoke('openBanking', {
        action: 'reconcile_accounting_account',
        company_id: transaction.company_id,
        bank_transaction_id: transaction.id,
        accounting_account_id: selectedAccountId,
        bank_accounting_account_id: selectedBankLedgerId,
      });
      const payload = response?.data ?? response;
      if (!payload?.ok) throw new Error(payload?.error || 'No se pudo generar el asiento bancario.');
      await finish();
    } catch (caught) {
      setError(caught?.response?.data?.error || caught?.message || 'No se pudo generar el asiento bancario.');
    } finally {
      setLoading(false);
    }
  };

  const classifyTransaction = async status => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await base44.functions.invoke('openBanking', {
        action: 'classify_transaction',
        company_id: transaction.company_id,
        bank_transaction_id: transaction.id,
        status,
      });
      const payload = response?.data ?? response;
      if (!payload?.ok) throw new Error(payload?.error || 'No se pudo clasificar el movimiento.');
      await finish();
    } catch (caught) {
      setError(caught?.response?.data?.error || caught?.message || 'No se pudo clasificar el movimiento.');
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Conciliar movimiento bancario</h2>
            <p className="text-xs text-slate-400 mt-0.5">Factura o cuenta contable, con asiento equilibrado y trazabilidad</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"><X className="w-4 h-4 text-slate-400 hover:text-slate-700" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Movimiento bancario</p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{transaction.concepto || 'Movimiento sin concepto'}</p>
                {transaction.nombre_contraparte && <p className="text-xs text-slate-500 mt-0.5">{transaction.nombre_contraparte}</p>}
                <p className="text-xs text-slate-400 mt-0.5">{transaction.fecha_operacion} · {currency}</p>
              </div>
              <p className={cn('text-lg font-bold font-mono flex-shrink-0', transaction.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-500')}>
                {transaction.tipo === 'entrada' ? '+' : '-'}{fmt(amount, currency)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => setMode('invoice')} className={cn('flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold', mode === 'invoice' ? 'bg-white shadow-sm text-foreground' : 'text-slate-500')}>
              <FileText className="w-3.5 h-3.5" /> Asociar factura
            </button>
            <button onClick={() => setMode('account')} className={cn('flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold', mode === 'account' ? 'bg-white shadow-sm text-foreground' : 'text-slate-500')}>
              <BookOpen className="w-3.5 h-3.5" /> Asociar cuenta contable
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cuenta contable del banco</label>
            <select value={selectedBankLedgerId} onChange={event => setSelectedBankLedgerId(event.target.value)}
              disabled={loadingAccounts}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-sm">
              <option value="">Seleccionar subcuenta bancaria…</option>
              {bankLedgerAccounts.map(account => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}
            </select>
            {currency !== 'EUR' && <p className="text-[11px] text-amber-700 mt-1">La divisa es {currency}; utiliza una subcuenta bancaria específica para esa divisa.</p>}
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

          {mode === 'invoice' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-100" />
                <ArrowRight className="w-4 h-4 text-slate-300" />
                <p className="text-xs text-slate-400 font-medium">Facturas compatibles ({candidates.length})</p>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              {candidates.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
                  <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No hay facturas compatibles pendientes</p>
                </div>
              ) : candidates.map((candidate, index) => {
                const config = CONFIDENCE_CFG[candidate._conf];
                const candidateAmount = Math.abs(candidate.importe_pendiente ?? candidate.total_factura ?? 0);
                const difference = Math.abs(amount - candidateAmount);
                const active = selected?.id === candidate.id;
                const party = candidate.tipo === 'recibida'
                  ? candidate.proveedor_nombre || candidate.cliente_nombre
                  : candidate.cliente_nombre;
                return (
                  <motion.button key={candidate.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
                    onClick={() => setSelected(active ? null : candidate)}
                    className={cn('w-full text-left p-4 rounded-xl border transition-all', active ? 'border-taxea-red/40 bg-taxea-red/5 ring-2 ring-taxea-red/20' : 'border-slate-200 hover:bg-slate-50')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">Factura {candidate.numero_factura || 'sin número'}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{party || 'Tercero sin identificar'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold font-mono">{fmt(candidateAmount, candidate.moneda || currency)}</p>
                        {difference > 0.01 && <p className="text-[10px] text-amber-600">Diferencia {fmt(difference, currency)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', config.bg, config.color)}>{config.label}</span>
                      {active && <CheckCircle className="w-3.5 h-3.5 text-taxea-red ml-auto" />}
                    </div>
                  </motion.button>
                );
              })}
              <p className="text-[11px] text-slate-500">Al confirmar se contabiliza la factura si todavía estaba pendiente y se genera el cobro o pago contra la cuenta del cliente/proveedor.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input value={accountSearch} onChange={event => setAccountSearch(event.target.value)}
                  placeholder="Buscar por código, nombre o tipo…"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-taxea-red/20" />
              </div>
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredAccounts.map(account => {
                  const active = selectedAccountId === account.id;
                  return (
                    <button key={account.id} onClick={() => setSelectedAccountId(active ? '' : account.id)}
                      className={cn('w-full flex items-center justify-between gap-3 px-4 py-3 text-left', active ? 'bg-taxea-red/5' : 'hover:bg-slate-50')}>
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-semibold text-foreground">{account.code}</p>
                        <p className="text-xs text-slate-500 truncate">{account.name}</p>
                      </div>
                      <span className="text-[10px] text-slate-400">{account.type || 'otro'}</span>
                    </button>
                  );
                })}
              </div>
              {selectedAccount && selectedBankLedger && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 space-y-1">
                  <p className="font-semibold">Vista previa del asiento</p>
                  {transaction.tipo === 'entrada' ? (
                    <>
                      <p>Debe: {selectedBankLedger.code} · {fmt(amount, currency)}</p>
                      <p>Haber: {selectedAccount.code} · {fmt(amount, currency)}</p>
                    </>
                  ) : (
                    <>
                      <p>Debe: {selectedAccount.code} · {fmt(amount, currency)}</p>
                      <p>Haber: {selectedBankLedger.code} · {fmt(amount, currency)}</p>
                    </>
                  )}
                </div>
              )}
              <p className="text-[11px] text-slate-500">Esta opción es para nóminas, impuestos, comisiones, préstamos u otros movimientos sin factura. La cuenta elegida es responsabilidad de quien realiza la conciliación.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button disabled={loading || !selectedBankLedgerId || (mode === 'invoice' ? !selected : !selectedAccountId)}
            onClick={mode === 'invoice' ? handleInvoiceConfirm : handleAccountConfirm}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white disabled:opacity-40 hover:bg-taxea-red/90 transition-all">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {mode === 'invoice' ? 'Conciliar con factura' : 'Crear asiento y conciliar'}
          </button>
          <button onClick={() => classifyTransaction('movimiento_interno')} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <SplitSquareHorizontal className="w-3.5 h-3.5" /> Interno
          </button>
          <button onClick={() => classifyTransaction('descartada')} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium border border-red-100 text-red-500 hover:bg-red-50 disabled:opacity-40">
            <X className="w-3.5 h-3.5" /> Descartar
          </button>
        </div>
      </motion.div>
    </div>
  );
}


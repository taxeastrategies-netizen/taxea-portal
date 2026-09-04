/**
 * Fuente compartida del departamento financiero.
 * Une facturas/gastos con el snapshot bancario seguro de Tesorería para que
 * Dashboard, Cashflow, Cuentas a cobrar y Cuentas a pagar usen el mismo dato.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const EMPTY_TREASURY = {
  connectedAccounts: 0,
  availableCash: 0,
  reconciledTransactions: 0,
  unreconciledTransactions: 0,
  inflows: 0,
  outflows: 0,
  lastBankSync: null,
};

export function useFinancialData(companyId, options = {}) {
  const { year, autoRefresh = true } = options;
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [treasury, setTreasury] = useState(EMPTY_TREASURY);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    try {
      const params = { company_id: companyId };
      if (year) params.anio = year;
      const [financialResponse, treasuryResponse] = await Promise.all([
        base44.functions.invoke('getCompanyFinancials', params),
        base44.functions.invoke('openBanking', { action: 'treasury_snapshot', company_id: companyId })
          .catch(error => {
            console.error('[useFinancialData] Treasury snapshot unavailable:', error);
            return { data: { accounts: [], transactions: [], summary: {} } };
          }),
      ]);
      const finData = financialResponse?.data || financialResponse;
      const bankData = treasuryResponse?.data || treasuryResponse;
      const summary = bankData?.summary || {};
      if (!mountedRef.current) return;
      setInvoices(finData?.invoices || []);
      setExpenses(finData?.expenses || []);
      setBankAccounts(bankData?.accounts || []);
      setBankTransactions(bankData?.transactions || []);
      setTreasury({
        connectedAccounts: Number(summary.connected_accounts || 0),
        availableCash: Number(summary.available_cash_eur || 0),
        reconciledTransactions: Number(summary.reconciled_transactions || 0),
        unreconciledTransactions: Number(summary.unreconciled_transactions || 0),
        inflows: Number(summary.inflows || 0),
        outflows: Number(summary.outflows || 0),
        lastBankSync: summary.last_sync || null,
      });
      setLastSync(new Date());
    } catch (err) {
      console.error('[useFinancialData] Error fetching unified financials:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [companyId, year]);

  const refresh = useCallback(() => {
    if (companyId) fetch();
  }, [fetch, companyId]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  useEffect(() => {
    if (!autoRefresh) return;
    const onFocus = () => fetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetch, autoRefresh]);

  useEffect(() => {
    if (!companyId || !autoRefresh) return;
    const unsubscribers = [];
    for (const entity of ['Invoice', 'Expense', 'BankAccount', 'BankTransaction']) {
      try {
        const unsubscribe = base44.entities[entity].subscribe(() => fetch());
        if (unsubscribe) unsubscribers.push(unsubscribe);
      } catch {}
    }
    return () => { unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [companyId, fetch, autoRefresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const onRefresh = () => fetch();
    window.addEventListener('financials:refresh', onRefresh);
    return () => window.removeEventListener('financials:refresh', onRefresh);
  }, [fetch, autoRefresh]);

  return { invoices, expenses, bankAccounts, bankTransactions, treasury, loading, lastSync, refresh };
}

export function triggerFinancialRefresh() {
  window.dispatchEvent(new Event('financials:refresh'));
}
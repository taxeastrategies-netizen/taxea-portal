/**
 * useFinancialData - Hook compartido para datos financieros
 * 
 * Garantiza que todas las pantallas lean de la misma fuente de verdad
 * y se actualicen cuando hay mutaciones financieras.
 * 
 * - Llama a getCompanyFinancials (unica fuente de datos)
 * - Re-fetch automatico al volver a enfocar la pestana
 * - Suscripcion en tiempo real a cambios en Invoice
 * - Funcion refresh() para forzar actualizacion tras mutaciones
 * - Evento global 'financials:refresh' para que cualquier pantalla pueda disparar refresh
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export function useFinancialData(companyId, options = {}) {
  const { year, autoRefresh = true } = options;
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    try {
      const params = { company_id: companyId };
      if (year) params.anio = year;
      const res = await base44.functions.invoke('getCompanyFinancials', params);
      const finData = res?.data || res;
      if (!mountedRef.current) return;
      setInvoices(finData?.invoices || []);
      setExpenses(finData?.expenses || []);
      setLastSync(new Date());
    } catch (err) {
      console.error('[useFinancialData] Error fetching financials:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [companyId, year]);

  const refresh = useCallback(() => {
    if (companyId) fetch();
  }, [fetch, companyId]);

  // Carga inicial + refetch cuando cambia company o year
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  // Re-fetch al volver a enfocar la pestana (sincronizacion movil/PC)
  useEffect(() => {
    if (!autoRefresh) return;
    const onFocus = () => fetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetch, autoRefresh]);

  // Suscripción en tiempo real a cambios en facturas y gastos
  useEffect(() => {
    if (!companyId || !autoRefresh) return;
    const unsubscribers = [];
    try {
      const unsubscribeInvoices = base44.entities.Invoice.subscribe(() => fetch());
      if (unsubscribeInvoices) unsubscribers.push(unsubscribeInvoices);
    } catch {}
    try {
      const unsubscribeExpenses = base44.entities.Expense.subscribe(() => fetch());
      if (unsubscribeExpenses) unsubscribers.push(unsubscribeExpenses);
    } catch {}
    return () => { unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [companyId, fetch, autoRefresh]);

  // Escuchar evento global de refresh (para que cualquier mutacion dispare actualizacion)
  useEffect(() => {
    if (!autoRefresh) return;
    const onRefresh = () => fetch();
    window.addEventListener('financials:refresh', onRefresh);
    return () => window.removeEventListener('financials:refresh', onRefresh);
  }, [fetch, autoRefresh]);

  return { invoices, expenses, loading, lastSync, refresh };
}

/**
 * Dispara un evento global para que todas las pantallas que usan useFinancialData se actualicen.
 * Llamar despues de cualquier mutacion financiera: crear, editar, anular, borrar, aprobar OCR.
 */
export function triggerFinancialRefresh() {
  window.dispatchEvent(new Event('financials:refresh'));
}
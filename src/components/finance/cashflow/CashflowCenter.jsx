import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { subDays, isAfter, parseISO } from 'date-fns';
import { useFinancialData } from '@/hooks/useFinancialData';

import CashPositionHeader from './CashPositionHeader';
import CashKpiGrid from './CashKpiGrid';
import CashflowForecastChart from './CashflowForecastChart';
import LiquidityRiskEngine from './LiquidityRiskEngine';
import CashflowTimeline from './CashflowTimeline';
import CashAlertsPanel from './CashAlertsPanel';
import SurvivalMode from './SurvivalMode';
import CashInsights from './CashInsights';

export default function CashflowCenter() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;

  const { invoices, expenses, bankTransactions, treasury, loading: financialLoading, lastSync, refresh } = useFinancialData(companyId);
  const [obligations, setObligations] = useState([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const loading = financialLoading || supportLoading;

  const loadObligations = () => {
    if (!companyId) { setSupportLoading(false); return; }
    setSupportLoading(true);
    base44.entities.TaxObligation.filter({ company_id: companyId })
      .then(obl => setObligations(obl || []))
      .finally(() => setSupportLoading(false));
  };

  useEffect(() => { loadObligations(); }, [companyId]);

  const financials = useMemo(() => {
    const now = new Date();
    const cutoff = subDays(now, 30);
    const prevCutoff = subDays(cutoff, 30);

    const filteredInvoices = invoices.filter(i => {
      try { return isAfter(parseISO(i.fecha_emision), cutoff); } catch { return false; }
    });
    const filteredExpenses = expenses.filter(e => {
      try { return isAfter(parseISO(e.fecha), cutoff); } catch { return false; }
    });

    const filteredBankTransactions = (bankTransactions || []).filter(transaction => {
      try {
        return transaction.estado_proveedor !== 'pending'
          && transaction.categoria_ia !== 'transferencia_interna'
          && isAfter(parseISO(transaction.fecha_operacion), cutoff);
      } catch { return false; }
    });
    const invoiceIngresos = filteredInvoices
      .filter(i => i.tipo === 'emitida')
      .reduce((s, i) => s + (i.total_factura || 0), 0);
    const totalIngresos = treasury.connectedAccounts > 0
      ? filteredBankTransactions.filter(transaction => transaction.tipo === 'entrada').reduce((sum, transaction) => sum + Number(transaction.importe || 0), 0)
      : invoiceIngresos;

    const gastoFact = filteredInvoices
      .filter(i => i.tipo === 'recibida')
      .reduce((s, i) => s + (i.total_factura || 0), 0);
    const gastoExp = filteredExpenses
      .filter(e => e.tipo === 'gasto')
      .reduce((s, e) => s + (e.total || 0), 0);
    const gastoTotal = treasury.connectedAccounts > 0
      ? filteredBankTransactions.filter(transaction => transaction.tipo === 'salida').reduce((sum, transaction) => sum + Number(transaction.importe || 0), 0)
      : gastoFact + gastoExp;

    const beneficio = totalIngresos - gastoTotal;
    const margenNeto = totalIngresos > 0 ? (beneficio / totalIngresos) * 100 : 0;
    const ebitda = beneficio;

    const cashDisponible = treasury.connectedAccounts > 0
      ? treasury.availableCash
      : invoices.filter(i => i.tipo === 'emitida' && i.estado_cobro === 'cobrada')
        .reduce((s, i) => s + (i.total_factura || 0), 0);

    const cobrosPendientes = invoices
      .filter(i => i.tipo === 'emitida' && i.estado_cobro === 'pendiente')
      .reduce((s, i) => s + (i.total_factura || 0), 0);

    const pagosPendientes = invoices
      .filter(i => i.tipo === 'recibida' && i.estado_cobro === 'pendiente')
      .reduce((s, i) => s + (i.total_factura || 0), 0);

    const burnRate = gastoTotal / 1 || 0; // monthly
    const runway = cashDisponible > 0 && burnRate > 0 ? cashDisponible / burnRate : null;

    const invoicesEmitidas = invoices.filter(i => i.tipo === 'emitida');
    const dso = invoicesEmitidas.length > 0
      ? invoicesEmitidas.reduce((s, i) => s + (i.estado_cobro === 'cobrada' ? 25 : 55), 0) / invoicesEmitidas.length
      : 0;

    const workingCapital = cobrosPendientes - pagosPendientes;

    const vencidas = invoices.filter(i => i.tipo === 'emitida' && i.estado_cobro === 'vencida');

    const prevIngresos = invoices
      .filter(i => {
        try {
          const d = parseISO(i.fecha_emision);
          return i.tipo === 'emitida' && isAfter(d, prevCutoff) && !isAfter(d, cutoff);
        } catch { return false; }
      })
      .reduce((s, i) => s + (i.total_factura || 0), 0);
    const ingresosDelta = prevIngresos > 0 ? ((totalIngresos - prevIngresos) / prevIngresos) * 100 : 0;

    return {
      totalIngresos, gastoTotal, beneficio, margenNeto, ebitda,
      cashDisponible, cashSource: treasury.connectedAccounts > 0 ? 'bank' : 'invoices', bankConnected: treasury.connectedAccounts, bankUnreconciled: treasury.unreconciledTransactions, cobrosPendientes, pagosPendientes,
      burnRate, runway, dso, workingCapital, vencidas, ingresosDelta,
      filteredInvoices, filteredExpenses,
    };
  }, [invoices, expenses, bankTransactions, treasury]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando datos de tesorería...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-10"
    >
      {/* Header */}
      <CashPositionHeader
        company={company}
        lastSync={lastSync}
        loading={loading}
        onRefresh={() => { refresh(); loadObligations(); }}
      />

      {/* KPI Grid */}
      <CashKpiGrid financials={financials} />

      {/* Main chart */}
      <CashflowForecastChart invoices={invoices} expenses={expenses} obligations={obligations} />

      {/* Risk + Survival side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <LiquidityRiskEngine financials={financials} />
        <SurvivalMode financials={financials} />
      </div>

      {/* Alerts + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CashAlertsPanel financials={financials} obligations={obligations} />
        <CashInsights financials={financials} />
      </div>

      {/* Timeline */}
      <CashflowTimeline invoices={invoices} expenses={expenses} obligations={obligations} />
    </motion.div>
  );
}
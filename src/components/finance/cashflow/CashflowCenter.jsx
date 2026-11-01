import { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { useFinancialData } from '@/hooks/useFinancialData';
import { buildFinanceDashboardModel } from '@/lib/financeDashboardModel.mjs';
import { useFinanceObligations } from '@/hooks/useFinanceReporting';

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

  const { invoices, expenses, bankAccounts, bankTransactions, treasury, treasuryError, error: financialError, loading: financialLoading, refresh } = useFinancialData(companyId);
  const calendar = useFinanceObligations(companyId);
  const obligations = calendar.data?.rows || [];
  const [treasuryEvents, setTreasuryEvents] = useState([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const [supportError, setSupportError] = useState('');
  const supportRequestRef = useRef(0);
  const loading = financialLoading || supportLoading || calendar.isLoading;

  const loadObligations = () => {
    const requestId = ++supportRequestRef.current;
    if (!companyId) { setTreasuryEvents([]); setSupportLoading(false); return; }
    setSupportLoading(true);
    setSupportError('');
    Promise.allSettled([
      base44.entities.TreasuryEvent.filter({ company_id: companyId }),
    ]).then(([eventsResult]) => {
      if (requestId !== supportRequestRef.current) return;
      setTreasuryEvents(eventsResult.status === 'fulfilled' ? eventsResult.value || [] : []);
      setSupportError([eventsResult.status !== 'fulfilled' ? 'eventos' : ''].filter(Boolean).join(' y '));
    }).finally(() => { if (requestId === supportRequestRef.current) setSupportLoading(false); });
  };

  useEffect(() => { setTreasuryEvents([]); loadObligations(); return () => { supportRequestRef.current++; }; }, [companyId]);

  const financials = useMemo(() => {
    const shared = buildFinanceDashboardModel({ invoices, expenses, bankAccounts, bankTransactions, obligations, treasuryError, financialError, period: '30d' });
    const totalIngresos = shared.bankKnown ? shared.bankInflows : shared.documentIncomeNet;
    const gastoTotal = shared.bankKnown ? shared.bankOutflows : shared.documentExpenseNet;
    return { ...shared, totalIngresos, gastoTotal, beneficio: totalIngresos === null || gastoTotal === null ? null : totalIngresos - gastoTotal, ingresosDelta: shared.bankDelta };
  }, [invoices, expenses, bankAccounts, bankTransactions, treasuryError, financialError, calendar.data]);

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
        lastSync={treasury.lastBankSync}
        bankKnown={financials.bankKnown}
        loading={loading}
        onRefresh={() => { refresh(); loadObligations(); calendar.refetch(); }}
      />

      {calendar.data?.provisionalDates && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Las fechas del próximo ejercicio son provisionales hasta contrastarlas con el calendario oficial.</p>}
      {financials.bankActivityReasons.length > 0 && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Movimientos sin verificar: {financials.bankActivityReasons.join(" ")}</p>}
      {financialError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Datos financieros no disponibles: {financialError}. Los importes de esta vista no son fiables hasta actualizar.</p>}
      {/* KPI Grid */}
      <CashKpiGrid financials={financials} />

      {/* Main chart */}
      <CashflowForecastChart invoices={invoices} obligations={obligations} events={treasuryEvents} treasury={{ ...treasury, connectedAccounts: financials.bankKnown ? financials.bankConnected : 0, connectedEuroAccounts: financials.bankKnown ? financials.bankConnected : 0, availableCash: financials.cashDisponible }} treasuryError={treasuryError} supportError={[supportError, calendar.isError ? 'calendario fiscal' : ''].filter(Boolean).join(' y ')} />

      {/* Risk + Survival side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {financials.bankKnown && financials.cashHistorySufficient ? <LiquidityRiskEngine financials={financials} /> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Riesgo de liquidez sin calcular: se necesita saldo reciente e historial observado suficiente.</div>}
        {financials.bankKnown && financials.cashHistorySufficient ? <SurvivalMode financials={financials} /> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">La autonomía de caja requiere banco conectado y salidas observadas. No se deduce de facturas cobradas.</div>}
      </div>

      {/* Alerts + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CashAlertsPanel financials={financials} obligations={obligations} calendarError={calendar.isError} />
        <CashInsights financials={financials} />
      </div>

      {/* Timeline */}
      <CashflowTimeline invoices={invoices} expenses={expenses} obligations={obligations} calendarError={calendar.isError} />
    </motion.div>
  );
}
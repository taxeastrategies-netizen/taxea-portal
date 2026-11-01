import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import FinanceHeader from './FinanceHeader';
import KpiRow from './KpiRow';
import CashflowChart from './CashflowChart';
import ForecastPanel from './ForecastPanel';
import AlertasIA from './AlertasIA';
import FinancialTimeline from './FinancialTimeline';
import SmartWidgets from './SmartWidgets';
import InsightsIA from './InsightsIA';
import HealthScore from './FinanceHealthScore';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useFinancePeriod, useFinanceObligations } from '@/hooks/useFinanceReporting';
import { buildFinanceDashboardModel } from '@/lib/financeDashboardModel.mjs';

export default function FinanceDashboard() {
  const { company } = useOutletContext() || {};
  const companyId = company?.id;
  const [period, setPeriod] = useState('30d');
  const data = useFinancialData(companyId);
  const accounting = useFinancePeriod(companyId, period);
  const calendar = useFinanceObligations(companyId);
  const obligations = calendar.data?.rows || [];
  const financials = useMemo(() => buildFinanceDashboardModel({
    ...data, obligations, accountingPeriod: accounting.data,
    financialError: data.error, accountingError: accounting.isError ? 'No se pudo actualizar la PyG del periodo.' : '', period,
  }), [data.invoices, data.expenses, data.bankAccounts, data.bankTransactions, data.error, data.treasuryError, accounting.data, accounting.isError, calendar.data, period]);
  const loading = data.loading || accounting.isLoading || calendar.isLoading;
  const refresh = () => { data.refresh(); accounting.refetch(); calendar.refetch(); };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} className="space-y-6 pb-8">
      <FinanceHeader company={company} period={period} setPeriod={setPeriod} lastSync={data.lastSync} loading={loading} onRefresh={refresh} />
      {!loading && <>
        <div role="status" className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground space-y-1">
          <p>Resultado: asientos confirmados y cuadrados · {financials.window.start} a {financials.window.end}. Saldo: cuentas EUR conectadas con sincronización reciente.</p>
          {!financials.accountingKnown && <p>No hay un resultado contable verificable para este periodo. Consulta los asientos y sus incidencias.</p>}
          {financials.accountingProvisional && <p>Lectura parcial: {financials.accountingPending} asientos pendientes y {financials.accountingExcluded} excluidos. El marco contable requiere revisión cuando no está validado.</p>}
          {!financials.bankKnown && <p>Saldo y autonomía de caja sin calcular: {financials.bankReasons.join(' ')}</p>}
          {financials.duplicateBankAccounts + financials.duplicateBankTransactions > 0 && <p>La lectura ha omitido repeticiones de identidad bancaria: {financials.duplicateBankAccounts} cuentas y {financials.duplicateBankTransactions} movimientos. No se han borrado registros.</p>}
          {calendar.data?.provisionalDates && <p>Hay fechas de un ejercicio posterior aún pendientes de contraste con su calendario oficial.</p>}
        </div>
        {(data.error || accounting.isError || calendar.isError) && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No se pudieron actualizar todas las fuentes. {data.error} {accounting.isError ? 'PyG no disponible.' : ''} {calendar.isError ? 'Calendario no disponible: no se afirma que no existan obligaciones.' : ''}
          <button className="ml-2 font-semibold underline" onClick={refresh}>Reintentar</button>
        </div>}
        <KpiRow financials={financials} period={period} />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2"><CashflowChart invoices={data.invoices} expenses={data.expenses} bankTransactions={data.bankTransactions} financials={financials} period={period} /></div>
          <div className="flex flex-col gap-5"><ForecastPanel financials={financials} /><HealthScore financials={financials} /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><AlertasIA financials={financials} invoices={data.invoices} obligations={obligations} calendarError={calendar.isError} /><InsightsIA financials={financials} /></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5"><div className="lg:col-span-2"><FinancialTimeline invoices={data.invoices} expenses={data.expenses} obligations={obligations} calendarError={calendar.isError} /></div><SmartWidgets financials={financials} obligations={obligations} calendarError={calendar.isError} /></div>
      </>}
      {loading && <div className="flex items-center justify-center h-64"><div className="flex flex-col items-center gap-3"><div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-sm text-muted-foreground">Cargando fuentes financieras...</p></div></div>}
    </motion.div>
  );
}

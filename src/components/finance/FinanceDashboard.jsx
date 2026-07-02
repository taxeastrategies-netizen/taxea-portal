import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
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
import { subDays, subMonths, isAfter, parseISO } from 'date-fns';
import { calculateFinancialKPIs, activeInvoices } from '@/lib/financialCore';
import { useFinancialData } from '@/hooks/useFinancialData';

export default function FinanceDashboard() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;

  const companyId = company?.id;
  const { invoices, expenses, loading: finLoading, lastSync } = useFinancialData(companyId);
  const [obligations, setObligations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    base44.entities.TaxObligation.filter({ company_id: companyId })
      .then(obl => setObligations(obl || []))
      .finally(() => setLoading(false));
  }, [companyId]);

  // ── Derived financial data (usa capa unificada) ───────────────────────────
  const financials = useMemo(() => {
    const now = new Date();
    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const cutoff = subDays(now, periodDays);

    // Filtrar por periodo pero excluyendo anuladas (via activeInvoices)
    const filteredInvoices = activeInvoices(invoices).filter(i => {
      try { return isAfter(parseISO(i.fecha_emision), cutoff); } catch { return false; }
    });
    const filteredExpenses = (expenses || []).filter(e => {
      try { return !e.anulada && isAfter(parseISO(e.fecha), cutoff); } catch { return false; }
    });

    // KPIs unificados del periodo filtrado
    const finKPIs = calculateFinancialKPIs(filteredInvoices, filteredExpenses);

    const totalIngresos = finKPIs.totalIngresos;
    const gastoTotal = finKPIs.totalGastos;
    const beneficio = finKPIs.resultado;
    const margenNeto = totalIngresos > 0 ? (beneficio / totalIngresos) * 100 : 0;

    // EBITDA approximation
    const ebitda = beneficio + gastoTotal * 0.05;

    // Cash (sum of cobradas invoices, excluyendo anuladas)
    const cashDisponible = activeInvoices(invoices)
      .filter(i => i.tipo === 'emitida' && i.estado_cobro === 'cobrada')
      .reduce((s, i) => s + (i.total_factura || 0), 0);

    const cobrosPendientes = finKPIs.cobrosPendientes;
    const pagosPendientes = finKPIs.pagosPendientes;

    // Burn rate
    const burnRate = gastoTotal / (periodDays / 30);
    const runway = cashDisponible > 0 && burnRate > 0 ? cashDisponible / burnRate : null;

    // DSO
    const invoicesEmitidas = activeInvoices(invoices).filter(i => i.tipo === 'emitida');
    const dso = invoicesEmitidas.length > 0
      ? invoicesEmitidas.reduce((s, i) => {
          const days = i.estado_cobro === 'cobrada' ? 30 : 60;
          return s + days;
        }, 0) / invoicesEmitidas.length
      : 0;

    // DPO
    const invoicesRecibidas = activeInvoices(invoices).filter(i => i.tipo === 'recibida');
    const dpo = invoicesRecibidas.length > 0
      ? invoicesRecibidas.reduce((s, i) => {
          const days = i.estado_cobro === 'cobrada' ? 30 : 45;
          return s + days;
        }, 0) / invoicesRecibidas.length
      : 0;

    const workingCapital = cobrosPendientes - pagosPendientes;

    const upcoming = obligations.filter(o => {
      try {
        const d = parseISO(o.fecha_limite);
        return isAfter(d, now) && isAfter(subDays(d, 30), subDays(now, 1));
      } catch { return false; }
    });

    const vencidas = finKPIs.facturasVencidasList;

    // Previous period comparison
    const prevCutoff = subDays(cutoff, periodDays);
    const prevIngresos = activeInvoices(invoices)
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
      cashDisponible, cobrosPendientes, pagosPendientes,
      burnRate, runway, dso, dpo, workingCapital,
      upcoming, vencidas, ingresosDelta,
      filteredInvoices, filteredExpenses,
    };
  }, [invoices, expenses, obligations, period]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="space-y-6 pb-8"
    >
      <FinanceHeader
        company={company}
        period={period}
        setPeriod={setPeriod}
        lastSync={lastSync}
        loading={loading}
      />

      {!loading && !finLoading && (
        <>
          <KpiRow financials={financials} period={period} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2">
              <CashflowChart invoices={invoices} expenses={expenses} period={period} />
            </div>
            <div className="flex flex-col gap-5">
              <ForecastPanel financials={financials} />
              <HealthScore financials={financials} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AlertasIA financials={financials} invoices={invoices} obligations={obligations} />
            <InsightsIA financials={financials} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <FinancialTimeline invoices={invoices} expenses={expenses} obligations={obligations} />
            </div>
            <SmartWidgets financials={financials} obligations={obligations} />
          </div>
        </>
      )}

      {(loading || finLoading) && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Cargando datos financieros...</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
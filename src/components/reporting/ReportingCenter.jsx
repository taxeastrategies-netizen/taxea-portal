import { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  FileText, BarChart2, Users, Building2, Download, Share2,
  Zap, Brain, Award, TrendingUp, RefreshCw, Clock
} from 'lucide-react';
import ReportingDashboard from './ReportingDashboard';
import MonthlyReport from './MonthlyReport';
import BoardReport from './BoardReport';
import InvestorReport from './InvestorReport';
import BankReport from './BankReport';
import ExcelExport from './ExcelExport';
import ShareDashboard from './ShareDashboard';
import AutoReports from './AutoReports';
import FinancialIntelligenceAI from './FinancialIntelligenceAI';
import CompanyScoring from './CompanyScoring';
import MnAAnalytics from './MnAAnalytics';
import ExecutiveCommentary from './ExecutiveCommentary';
import { useFinancialData } from '@/hooks/useFinancialData';
import { buildFinanceDashboardModel, reportingMetricSnapshot } from '@/lib/financeDashboardModel.mjs';
import { useFinanceObligations, useFinancePeriod } from '@/hooks/useFinanceReporting';
import { financialReportReadiness } from '@/lib/verifiedFinancialMetrics';

const TABS = [
  { id: 'dashboard',   label: 'Centro',             icon: BarChart2,   color: 'text-slate-600' },
  { id: 'monthly',     label: 'Mensual',             icon: Clock,       color: 'text-blue-600' },
  { id: 'board',       label: 'Board Report',        icon: Users,       color: 'text-violet-600' },
  { id: 'investor',    label: 'Inversores',          icon: TrendingUp,  color: 'text-emerald-600' },
  { id: 'bank',        label: 'Bancos',              icon: Building2,   color: 'text-indigo-600' },
  { id: 'excel',       label: 'Export Excel',        icon: Download,    color: 'text-green-600' },
  { id: 'share',       label: 'Compartir',           icon: Share2,      color: 'text-amber-600' },
  { id: 'auto',        label: 'Automático',          icon: Zap,         color: 'text-orange-500' },
  { id: 'ai',          label: 'Financial AI',        icon: Brain,       color: 'text-taxea-red' },
  { id: 'scoring',     label: 'Company Score',       icon: Award,       color: 'text-taxea-red' },
  { id: 'mna',         label: 'M&A Analytics',       icon: FileText,    color: 'text-slate-700' },
  { id: 'commentary',  label: 'Commentary AI',       icon: FileText,    color: 'text-purple-600' },
];

export default function ReportingCenter() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;

  const [tab, setTab] = useState('dashboard');
  const { invoices, expenses, bankAccounts, bankTransactions: transactions, treasury, loading: financialLoading, error: financialError, treasuryError, refresh } = useFinancialData(companyId, { year: new Date().getFullYear() });
  const calendar = useFinanceObligations(companyId);
  const obligations = calendar.data?.rows || [];
  const requestRef = useRef(0);
  const [loadedCompany, setLoadedCompany] = useState(null);
  const [debts, setDebts] = useState([]);
  const accounting = useFinancePeriod(companyId,'ytd');
  const accountingReport = accounting.data?.current || null;
  const [auxiliaryLoading, setAuxiliaryLoading] = useState(true);
  const [auxiliaryError, setAuxiliaryError] = useState('');
  const loading = financialLoading || auxiliaryLoading || calendar.isLoading || accounting.isLoading || loadedCompany !== companyId;

  const loadData = async () => {
    if (!companyId) { setAuxiliaryLoading(false); return; }
    const request = ++requestRef.current;
    setAuxiliaryLoading(true);
    setAuxiliaryError('');
    try {
      const dbs=await base44.entities.DebtInstrument.filter({company_id:companyId});
      if(request!==requestRef.current)return;
      setDebts(dbs||[]);
    } catch (error) {
      if(request !== requestRef.current)return;
      setAuxiliaryError(error?.message || 'No se pudieron cargar obligaciones o deudas.');
    } finally {
      if(request === requestRef.current){setAuxiliaryLoading(false);setLoadedCompany(companyId);}
    }
  };

  useEffect(() => { setDebts([]); setLoadedCompany(null); loadData(); return () => {requestRef.current++;}; }, [companyId]);

  const financials = useMemo(() => {
    const shared=buildFinanceDashboardModel({invoices,expenses,bankAccounts,bankTransactions:transactions,obligations,treasuryError,financialError,accountingError:accounting.isError?'PyG anual no disponible':auxiliaryError,accountingPeriod:accounting.data,period:'ytd'});
    return reportingMetricSnapshot(shared,debts,accountingReport);
  }, [invoices,expenses,bankAccounts,transactions,debts,treasuryError,financialError,auxiliaryError,accountingReport,accounting.data,accounting.isError,calendar.data]);

  const sharedProps = { company, companyId, financials, invoices, expenses, obligations, debts, bankAccounts, transactions, loading, monthlyLedger: accounting.data?.monthly || [] };

  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-400">Selecciona una empresa</p>
        <p className="text-xs text-slate-300 mt-1">Para acceder al Reporting Center necesitas una empresa activa.</p>
      </div>
    );
  }

  const readiness=financialReportReadiness({financials,financialError,treasuryError,auxiliaryError:auxiliaryError || (accounting.isError?'PyG no disponible':''),calendarError:calendar.isError});
  if (!loading && !readiness.ready) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">No se puede generar un informe financiero fiable: {readiness.reasons.join(' ')}<button type="button" onClick={() => {refresh();loadData();calendar.refetch();accounting.refetch();}} className="ml-3 underline">Reintentar</button></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow-md">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-jakarta font-bold text-foreground">Reporting Center</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">CFO SUITE</span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">Informes del ejercicio y análisis de datos registrados</p>
          </div>
        </div>
        <button onClick={() => { refresh(); loadData(); accounting.refetch(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar datos
        </button>
      </div>

      <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-900">
        Datos acumulados del ejercicio hasta hoy. Caja: saldo EUR reciente y verificable. Entradas y salidas son movimientos bancarios, no ventas y gastos. EBITDA: derivado de la PyG contable confirmada de {financials.accountingEbitda?.year || new Date().getFullYear()}.
        {financials.accountingEbitda?.provisional && ' Cifra provisional: hay asientos pendientes, excluidos o marco contable por revisar.'}
      </p>

      {/* Tabs */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 min-w-max">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                  tab === t.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                <Icon className={cn("w-3.5 h-3.5", tab === t.id ? t.color : "")} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reinicia resultados locales al cambiar de empresa. */}
      <div key={companyId}>
      {/* Content */}
      {tab === 'dashboard'  && <ReportingDashboard {...sharedProps} onNavigate={setTab} />}
      {tab === 'monthly'    && <MonthlyReport {...sharedProps} />}
      {tab === 'board'      && <BoardReport {...sharedProps} />}
      {tab === 'investor'   && <InvestorReport {...sharedProps} />}
      {tab === 'bank'       && <BankReport {...sharedProps} />}
      {tab === 'excel'      && <ExcelExport {...sharedProps} />}
      {tab === 'share'      && <ShareDashboard {...sharedProps} />}
      {tab === 'auto'       && <AutoReports {...sharedProps} />}
      {tab === 'ai'         && <FinancialIntelligenceAI {...sharedProps} />}
      {tab === 'scoring'    && <CompanyScoring {...sharedProps} />}
      {tab === 'mna'        && <MnAAnalytics {...sharedProps} />}
      {tab === 'commentary' && <ExecutiveCommentary {...sharedProps} />}
      </div>
    </motion.div>
  );
}

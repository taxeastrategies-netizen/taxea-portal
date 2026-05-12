import { useState, useEffect, useMemo } from 'react';
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
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [debts, setDebts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const [inv, exp, obl, dbs, banks, txs] = await Promise.all([
      base44.entities.Invoice.filter({ company_id: companyId }),
      base44.entities.Expense.filter({ company_id: companyId }),
      base44.entities.TaxObligation.filter({ company_id: companyId }),
      base44.entities.DebtInstrument.filter({ company_id: companyId }),
      base44.entities.BankAccount.filter({ company_id: companyId }),
      base44.entities.BankTransaction.filter({ company_id: companyId }, '-fecha_operacion', 500),
    ]);
    setInvoices(inv || []);
    setExpenses(exp || []);
    setObligations(obl || []);
    setDebts(dbs || []);
    setBankAccounts(banks || []);
    setTransactions(txs || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [companyId]);

  const financials = useMemo(() => {
    const ingresos = invoices.filter(i => i.tipo === 'emitida').reduce((s, i) => s + (i.total_factura || 0), 0);
    const gastosInv = invoices.filter(i => i.tipo === 'recibida').reduce((s, i) => s + (i.total_factura || 0), 0);
    const gastosExp = expenses.filter(e => e.tipo === 'gasto').reduce((s, e) => s + (e.total || 0), 0);
    const gastoTotal = gastosInv + gastosExp;
    const beneficio = ingresos - gastoTotal;
    const margen = ingresos > 0 ? (beneficio / ingresos) * 100 : 0;
    const ebitda = beneficio + gastoTotal * 0.05;
    const deudaTotal = debts.filter(d => d.estado === 'activo').reduce((s, d) => s + (d.capital_pendiente || d.importe_inicial || 0), 0);
    const cashTotal = bankAccounts.reduce((s, b) => s + (b.saldo_disponible || 0), 0);
    const burnRate = gastoTotal / 12;
    const runway = burnRate > 0 ? cashTotal / burnRate : null;
    const cobrosPendientes = invoices.filter(i => i.tipo === 'emitida' && i.estado_cobro === 'pendiente').reduce((s, i) => s + (i.total_factura || 0), 0);
    const pagosPendientes = invoices.filter(i => i.tipo === 'recibida' && i.estado_cobro === 'pendiente').reduce((s, i) => s + (i.total_factura || 0), 0);
    const workingCapital = cobrosPendientes - pagosPendientes;
    const cuotasMensuales = debts.filter(d => d.estado === 'activo' && d.periodicidad === 'mensual').reduce((s, d) => s + (d.cuota || 0), 0);
    const interesesAnuales = debts.filter(d => d.estado === 'activo').reduce((s, d) => {
      const cap = d.capital_pendiente || d.importe_inicial || 0;
      return s + cap * ((d.tin || 0) / 100);
    }, 0);
    const dso = invoices.filter(i => i.tipo === 'emitida').length > 0 ? 45 : 0;
    const dpo = invoices.filter(i => i.tipo === 'recibida').length > 0 ? 38 : 0;
    return {
      ingresos, gastoTotal, beneficio, margen, ebitda, deudaTotal,
      cashTotal, burnRate, runway, cobrosPendientes, pagosPendientes,
      workingCapital, cuotasMensuales, interesesAnuales, dso, dpo
    };
  }, [invoices, expenses, debts, bankAccounts]);

  const sharedProps = { company, companyId, financials, invoices, expenses, obligations, debts, bankAccounts, transactions, loading };

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
            <p className="text-sm text-slate-400 mt-0.5">Informes ejecutivos, scoring financiero e inteligencia Big4</p>
          </div>
        </div>
        <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar datos
        </button>
      </div>

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
    </motion.div>
  );
}
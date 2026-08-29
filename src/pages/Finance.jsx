import { lazy } from 'react';
import { useParams } from 'react-router-dom';

const FinanceDashboard = lazy(() => import('@/components/finance/FinanceDashboard'));
const CashflowCenter = lazy(() => import('@/components/finance/cashflow/CashflowCenter'));
const TreasuryPage = lazy(() => import('@/components/treasury/TreasuryPage'));
const AccountsReceivable = lazy(() => import('@/components/ar/AccountsReceivable'));
const AccountsPayable = lazy(() => import('@/components/ap/AccountsPayable'));
const DebtCenter = lazy(() => import('@/components/debt/DebtCenter'));
const InvestmentsCenter = lazy(() => import('@/components/investments/InvestmentsCenter'));
const ReportingCenter = lazy(() => import('@/components/reporting/ReportingCenter'));
const AnalysisHome = lazy(() => import('@/components/finance/analysis/AnalysisHome'));

export default function Finance() {
  const { module } = useParams();

  switch (module) {
    case 'cashflow':
      return <CashflowCenter />;
    case 'treasury':
      return <TreasuryPage />;
    case 'ar':
      return <AccountsReceivable />;
    case 'ap':
      return <AccountsPayable />;
    case 'debt':
      return <DebtCenter />;
    case 'investments':
      return <InvestmentsCenter />;
    case 'reporting':
      return <ReportingCenter />;
    case 'analysis':
      return <AnalysisHome />;
    case 'dashboard':
    default:
      return <FinanceDashboard />;
  }
}
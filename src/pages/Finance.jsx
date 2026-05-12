import { useParams } from 'react-router-dom';
import FinanceDashboard from '@/components/finance/FinanceDashboard';
import CashflowCenter from '@/components/finance/cashflow/CashflowCenter';
import TreasuryPage from '@/components/treasury/TreasuryPage';
import AccountsReceivable from '@/components/ar/AccountsReceivable';
import AccountsPayable from '@/components/ap/AccountsPayable';
import DebtCenter from '@/components/debt/DebtCenter';

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
    case 'dashboard':
    default:
      return <FinanceDashboard />;
  }
}
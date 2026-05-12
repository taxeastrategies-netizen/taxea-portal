import { useParams } from 'react-router-dom';
import FinanceDashboard from '@/components/finance/FinanceDashboard';
import CashflowCenter from '@/components/finance/cashflow/CashflowCenter';
import TreasuryPage from '@/components/treasury/TreasuryPage';

export default function Finance() {
  const { module } = useParams();

  switch (module) {
    case 'cashflow':
      return <CashflowCenter />;
    case 'treasury':
      return <TreasuryPage />;
    case 'dashboard':
    default:
      return <FinanceDashboard />;
  }
}
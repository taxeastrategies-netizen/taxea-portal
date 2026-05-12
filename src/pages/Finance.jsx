import { useParams, useNavigate } from 'react-router-dom';
import FinanceDashboard from '@/components/finance/FinanceDashboard';
import CashflowCenter from '@/components/finance/cashflow/CashflowCenter';

export default function Finance() {
  const { module } = useParams();

  switch (module) {
    case 'cashflow':
      return <CashflowCenter />;
    case 'dashboard':
    default:
      return <FinanceDashboard />;
  }
}
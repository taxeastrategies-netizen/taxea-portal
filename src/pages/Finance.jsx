import { useParams, useNavigate } from 'react-router-dom';
import FinanceDashboard from '@/components/finance/FinanceDashboard';

export default function Finance() {
  const { module } = useParams();
  const navigate = useNavigate();

  switch (module) {
    case 'dashboard':
    default:
      return <FinanceDashboard />;
  }
}
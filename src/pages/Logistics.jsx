import { useParams } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import LogisticsDashboard from '@/components/logistics/LogisticsDashboard';
import InventoryBuilder from '@/components/logistics/InventoryBuilder';
import StockMovements from '@/components/logistics/StockMovements';
import InventoryValuation from '@/components/logistics/InventoryValuation';
import StockReplenishment from '@/components/logistics/StockReplenishment';
import LogisticsReports from '@/components/logistics/LogisticsReports';
import InventorySmartImport from '@/components/logistics/InventorySmartImport';
import LogisticsSuppliers from '@/components/logistics/LogisticsSuppliers';

const MODULE_MAP = {
  dashboard: LogisticsDashboard,
  inventory: InventoryBuilder,
  movements: StockMovements,
  valuation: InventoryValuation,
  replenishment: StockReplenishment,
  reports: LogisticsReports,
  import: InventorySmartImport,
  suppliers: LogisticsSuppliers,
};

export default function Logistics() {
  const { module } = useParams();
  const ctx = useOutletContext() || {};
  const Component = MODULE_MAP[module] || LogisticsDashboard;
  return <Component {...ctx} />;
}
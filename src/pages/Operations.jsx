import { useParams, useOutletContext } from 'react-router-dom';
import OperationsDashboard from '@/components/operations/OperationsDashboard';
import OperationsTaskManager from '@/components/operations/OperationsTaskManager';
import OperationsProjects from '@/components/operations/OperationsProjects';
import OperationsProcessCenter from '@/components/operations/OperationsProcessCenter';
import OperationsRoadmap from '@/components/operations/OperationsRoadmap';
import OperationsReports from '@/components/operations/OperationsReports';

const MODULE_MAP = {
  dashboard: OperationsDashboard,
  today: OperationsDashboard,
  tasks: OperationsTaskManager,
  projects: OperationsProjects,
  roadmap: OperationsRoadmap,
  processes: OperationsProcessCenter,
  sops: OperationsProcessCenter,
  reports: OperationsReports,
};

export default function Operations() {
  const { module } = useParams();
  const ctx = useOutletContext() || {};
  const Component = MODULE_MAP[module] || OperationsDashboard;
  return <Component {...ctx} />;
}
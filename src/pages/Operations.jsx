import { useParams, useOutletContext } from 'react-router-dom';
import OperationsDashboard from '@/components/operations/OperationsDashboard';
import OperationsFocusView from '@/components/operations/OperationsFocusView';
import OperationsTaskManager from '@/components/operations/OperationsTaskManager';
import OperationsProjects from '@/components/operations/OperationsProjects';
import OperationsProcessCenter from '@/components/operations/OperationsProcessCenter';
import OperationsRoadmap from '@/components/operations/OperationsRoadmap';
import OperationsReports from '@/components/operations/OperationsReports';
import OperationsTickets from '@/components/operations/OperationsTickets';
import OperationsRisks from '@/components/operations/OperationsRisks';
import OperationsCalendar from '@/components/operations/OperationsCalendar';

const MODULE_MAP = {
  dashboard: OperationsDashboard,
  today: OperationsFocusView,
  focus: OperationsFocusView,
  tasks: OperationsTaskManager,
  projects: OperationsProjects,
  roadmap: OperationsRoadmap,
  processes: OperationsProcessCenter,
  sops: OperationsProcessCenter,
  tickets: OperationsTickets,
  risks: OperationsRisks,
  calendar: OperationsCalendar,
  reports: OperationsReports,
};

export default function Operations() {
  const { module } = useParams();
  const ctx = useOutletContext() || {};
  const Component = MODULE_MAP[module] || OperationsDashboard;
  return <Component {...ctx} />;
}
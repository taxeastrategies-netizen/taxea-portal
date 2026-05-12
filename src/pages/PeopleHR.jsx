import { useParams } from 'react-router-dom';
import HRDashboard from '@/components/hr/HRDashboard';
import EmployeeCenter from '@/components/hr/EmployeeCenter';
import HRDocuments from '@/components/hr/HRDocuments';
import TimeAttendance from '@/components/hr/TimeAttendance';
import HRAbsences from '@/components/hr/HRAbsences';
import HoursBank from '@/components/hr/HoursBank';
import PerformanceGoals from '@/components/hr/PerformanceGoals';
import OnboardingOffboarding from '@/components/hr/OnboardingOffboarding';
import Recruiting from '@/components/hr/Recruiting';
import HRExpenses from '@/components/hr/HRExpenses';
import HRReports from '@/components/hr/HRReports';
import HRAIAssistant from '@/components/hr/HRAIAssistant';

export default function PeopleHR() {
  const { module } = useParams();

  switch (module) {
    case 'employees':
      return <EmployeeCenter />;
    case 'documents':
      return <HRDocuments />;
    case 'time':
      return <TimeAttendance />;
    case 'absences':
      return <HRAbsences />;
    case 'hours-bank':
      return <HoursBank />;
    case 'performance':
      return <PerformanceGoals />;
    case 'onboarding':
      return <OnboardingOffboarding />;
    case 'recruiting':
      return <Recruiting />;
    case 'expenses':
      return <HRExpenses />;
    case 'reports':
      return <HRReports />;
    case 'ai-assistant':
      return <HRAIAssistant />;
    case 'dashboard':
    default:
      return <HRDashboard />;
  }
}
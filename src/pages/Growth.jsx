import { useParams } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import GrowthDashboard from '@/components/growth/GrowthDashboard';
import CampaignCenter from '@/components/growth/CampaignCenter';
import ContentPlanner from '@/components/growth/ContentPlanner';
import GrowthSalesCenter from '@/components/growth/GrowthSalesCenter';
import GrowthExperimentCenter from '@/components/growth/GrowthExperimentCenter';
import GrowthAIDirector from '@/components/growth/GrowthAIDirector';
import GrowthAnalytics from '@/components/growth/GrowthAnalytics';
import GrowthRetention from '@/components/growth/GrowthRetention';
import GrowthReports from '@/components/growth/GrowthReports';
import GrowthSettings from '@/components/growth/GrowthSettings';
import GrowthComingSoon from '@/components/growth/GrowthComingSoon';

const MODULE_MAP = {
  dashboard: GrowthDashboard,
  campaigns: CampaignCenter,
  content: ContentPlanner,
  sales: GrowthSalesCenter,
  'growth-lab': GrowthExperimentCenter,
  ai: GrowthAIDirector,
  analytics: GrowthAnalytics,
  retention: GrowthRetention,
  reports: GrowthReports,
  settings: GrowthSettings,
  seo: GrowthComingSoon,
  'ai-visibility': GrowthComingSoon,
  landings: GrowthComingSoon,
  forms: GrowthComingSoon,
  'lead-magnets': GrowthComingSoon,
  funnels: GrowthComingSoon,
  leads: GrowthComingSoon,
  proposals: GrowthComingSoon,
  pricing: GrowthComingSoon,
  email: GrowthComingSoon,
  whatsapp: GrowthComingSoon,
  ads: GrowthComingSoon,
  benchmarks: GrowthComingSoon,
  reputation: GrowthComingSoon,
  referrals: GrowthComingSoon,
  partners: GrowthComingSoon,
  compliance: GrowthComingSoon,
  forecast: GrowthComingSoon,
  goals: GrowthComingSoon,
  automation: GrowthComingSoon,
};

export default function Growth() {
  const { module } = useParams();
  const context = useOutletContext();
  const Component = MODULE_MAP[module] || GrowthDashboard;
  return <Component {...context} />;
}
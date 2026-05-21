import { useParams, useOutletContext } from 'react-router-dom';
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
import FunnelLeakDetector from '@/components/growth/FunnelLeakDetector';
import LeadFitScore from '@/components/growth/LeadFitScore';
import MarketingPnL from '@/components/growth/MarketingPnL';
import UnitEconomicsCenter from '@/components/growth/UnitEconomicsCenter';
import WhatsAppClosingAssistant from '@/components/growth/WhatsAppClosingAssistant';
import MarketingLegalRiskChecker from '@/components/growth/MarketingLegalRiskChecker';
import FiscalSeoComplianceChecker from '@/components/growth/FiscalSeoComplianceChecker';
import SeoCenter from '@/components/growth/SeoCenter';
import AiVisibilityCenter from '@/components/growth/AiVisibilityCenter';
import RevenueTaskPrioritizer from '@/components/growth/RevenueTaskPrioritizer';
import PricingGuardrailV2 from '@/components/growth/PricingGuardrailV2';

const MODULE_MAP = {
  // Fase 1
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

  // Fase 2 — Revenue Intelligence
  pnl: MarketingPnL,
  'unit-economics': UnitEconomicsCenter,

  // Fase 2 — Funnel Intelligence
  funnels: FunnelLeakDetector,
  'funnel-leaks': FunnelLeakDetector,

  // Fase 2 — Lead Quality
  leads: LeadFitScore,
  'lead-fit': LeadFitScore,

  // Fase 2 — SEO & AI Visibility
  seo: SeoCenter,
  'ai-visibility': AiVisibilityCenter,
  'fiscal-compliance': FiscalSeoComplianceChecker,

  // Fase 2 — Sales Assistants
  whatsapp: WhatsAppClosingAssistant,

  // Fase 2 — Pricing
  pricing: PricingGuardrailV2,

  // Fase 2 — Compliance
  compliance: MarketingLegalRiskChecker,
  'marketing-risk': MarketingLegalRiskChecker,

  // Fase 2 — Priorities
  priorities: RevenueTaskPrioritizer,
  'revenue-tasks': RevenueTaskPrioritizer,

  // Coming soon stubs
  landings: GrowthComingSoon,
  forms: GrowthComingSoon,
  'lead-magnets': GrowthComingSoon,
  proposals: GrowthComingSoon,
  email: GrowthComingSoon,
  ads: GrowthComingSoon,
  benchmarks: GrowthComingSoon,
  reputation: GrowthComingSoon,
  referrals: GrowthComingSoon,
  partners: GrowthComingSoon,
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
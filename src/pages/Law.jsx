import { useParams, useNavigate } from 'react-router-dom';

// Tax Law modules
import TaxLawDashboard from '@/components/law/tax/TaxLawDashboard';
import TaxCompliance from '@/components/law/tax/TaxCompliance';
import TaxLitigation from '@/components/law/tax/TaxLitigation';
import TaxInspections from '@/components/law/tax/TaxInspections';
import TaxKnowledgeBase from '@/components/law/tax/TaxKnowledgeBase';
import TaxAIAssistant from '@/components/law/tax/TaxAIAssistant';

// Business Law modules
import LegalDashboard from '@/components/law/business/LegalDashboard';
import ContractsCenter from '@/components/law/business/ContractsCenter';
import CorporateLaw from '@/components/law/business/CorporateLaw';
import ComplianceCenter from '@/components/law/business/ComplianceCenter';
import LegalDocuments from '@/components/law/business/LegalDocuments';
import SignaturesApprovals from '@/components/law/business/SignaturesApprovals';
import LegalAIAssistant from '@/components/law/business/LegalAIAssistant';

// M&A modules
import MandADashboard from '@/components/law/ma/MandADashboard';
import DealPipeline from '@/components/law/ma/DealPipeline';
import DueDiligenceCenter from '@/components/law/ma/DueDiligenceCenter';
import DataRooms from '@/components/law/ma/DataRooms';
import ValuationCenter from '@/components/law/ma/ValuationCenter';
import MandAAIAssistant from '@/components/law/ma/MandAAIAssistant';

// Legal Knowledge Engine
import LegalKnowledgeEngine from '@/components/law/knowledge/LegalKnowledgeEngine';

// Law Home
import LawHome from '@/components/law/LawHome';

export default function Law() {
  const { subdept, module } = useParams();

  if (!subdept) return <LawHome />;

  if (subdept === 'tax') {
    switch (module) {
      case 'compliance': return <TaxCompliance />;
      case 'litigation': return <TaxLitigation />;
      case 'inspections': return <TaxInspections />;
      case 'knowledge': return <TaxKnowledgeBase />;
      case 'ai': return <TaxAIAssistant />;
      case 'dashboard':
      default: return <TaxLawDashboard />;
    }
  }

  if (subdept === 'business') {
    switch (module) {
      case 'contracts': return <ContractsCenter />;
      case 'corporate': return <CorporateLaw />;
      case 'compliance': return <ComplianceCenter />;
      case 'documents': return <LegalDocuments />;
      case 'signatures': return <SignaturesApprovals />;
      case 'ai': return <LegalAIAssistant />;
      case 'dashboard':
      default: return <LegalDashboard />;
    }
  }

  if (subdept === 'ma') {
    switch (module) {
      case 'pipeline': return <DealPipeline />;
      case 'due-diligence': return <DueDiligenceCenter />;
      case 'data-rooms': return <DataRooms />;
      case 'valuation': return <ValuationCenter />;
      case 'ai': return <MandAAIAssistant />;
      case 'dashboard':
      default: return <MandADashboard />;
    }
  }

  if (subdept === 'knowledge') return <LegalKnowledgeEngine />;

  return <LawHome />;
}
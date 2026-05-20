import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import LaborOcrWorkspace from '@/components/labor-ocr/LaborOcrWorkspace';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { Loader2 } from 'lucide-react';

export default function LaborOcr() {
  const { user } = useAuth();
  const { company, loadingCompany } = useCompanyContext(user);

  if (loadingCompany) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) return <NoCompanyState pageName="OCR Laboral" />;

  return <LaborOcrWorkspace company={company} user={user} />;
}
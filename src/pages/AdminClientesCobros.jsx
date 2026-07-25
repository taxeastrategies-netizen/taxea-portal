import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, Lock } from 'lucide-react';
import BillingHeader from '@/components/billing/BillingHeader';
import BillingKpis from '@/components/billing/BillingKpis';
import BillingStripeSummary from '@/components/billing/BillingStripeSummary';
import BillingOverdueList from '@/components/billing/BillingOverdueList';
import BillingClientsTable from '@/components/billing/BillingClientsTable';

export default function AdminClientesCobros() {
  const { isAdmin } = useOutletContext() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getBillingOverview', {});
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error al cargar datos');
    }
    setLoading(false);
    setSyncing(false);
  };

  useEffect(() => { loadData(); }, []);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Lock className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Acceso restringido</p>
        <p className="text-xs text-muted-foreground mt-1">Solo administradores pueden acceder a esta sección.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-medium text-red-600">{error}</p>
        <button onClick={loadData} className="mt-3 text-xs text-primary underline">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <BillingHeader stripe={data?.stripe} onSync={loadData} syncing={syncing} generatedAt={data?.generatedAt} />
      {error && <p className="text-xs text-amber-600 mb-3">Aviso: {error}</p>}
      <BillingKpis kpis={data?.kpis} />
      <BillingStripeSummary stripe={data?.stripe} />
      <BillingOverdueList clients={data?.clients || []} />
      <BillingClientsTable clients={data?.clients || []} issues={data?.dataQualityIssues || []} />
    </div>
  );
}
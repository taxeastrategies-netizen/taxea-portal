import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import CalendarioGeneral from '@/components/obligaciones/CalendarioGeneral';
import KPIsObligaciones from '@/components/obligaciones/KPIsObligaciones';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const EMPTY = { items: [], sources: [], profile: null, verifiedCalendarYear: null };

export default function CalendarioFiscalTab() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [bundle, setBundle] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = async ({ synchronize = false, quiet = false } = {}) => {
    if (!companyId) return;
    if (!quiet) setLoading(true);
    try {
      if (synchronize) {
        setSyncing(true);
        await base44.functions.invoke('fiscalCalendarOperations', { action: 'synchronize', companyId, fiscalYear });
      }
      const response = await base44.functions.invoke('fiscalCalendarOperations', { action: 'bundle', companyId, fiscalYear });
      setBundle(response.data || EMPTY);
      if (synchronize && !quiet) toast.success('Calendario fiscal sincronizado.');
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'No se pudo cargar el calendario fiscal.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => { load({ synchronize: fiscalYear === currentYear, quiet: true }); }, [companyId, fiscalYear]);

  useEffect(() => {
    if (!companyId) return undefined;
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => load({ quiet: true }), 500);
    };
    const unsubs = ['TaxModel', 'TaxObligation', 'TaxPeriod', 'TaxFiling', 'Document'].map(name => {
      try { return base44.entities[name].subscribe(refresh); } catch { return null; }
    }).filter(Boolean);
    return () => { clearTimeout(timer); unsubs.forEach(unsub => unsub?.()); };
  }, [companyId, fiscalYear]);

  if (!companyId) return <div className="text-center py-16 text-sm text-muted-foreground">Selecciona un cliente.</div>;
  if (loading) return <div className="py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Calendario fiscal individual</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Misma fuente de verdad que Calendario y obligaciones: perfil fiscal, asesor, presentaciones y documentos.</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(fiscalYear)} onValueChange={value => setFiscalYear(Number(value))}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => load({ synchronize: true })} disabled={syncing}>
            <RefreshCw className={cn('w-4 h-4 mr-2', syncing && 'animate-spin')} />Sincronizar
          </Button>
        </div>
      </div>

      {!bundle.profile && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5" />
          <p className="text-xs text-amber-900">Completa y valida el perfil fiscal para que las obligaciones propuestas sean fiables.</p>
        </div>
      )}

      <KPIsObligaciones obligations={bundle.items} profile={bundle.profile} />
      <CalendarioGeneral obligations={bundle.items} fiscalYear={fiscalYear} verifiedCalendarYear={bundle.verifiedCalendarYear} sources={bundle.sources} />
    </div>
  );
}


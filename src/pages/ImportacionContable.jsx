import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Database, RefreshCw, AlertTriangle, CheckCircle, FileSpreadsheet, Brain, Upload } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ImpResumen from '@/components/importacion/ImpResumen';
import ImpTaxTab from '@/components/importacion/ImpTaxTab';
import ImpFinanceTab from '@/components/importacion/ImpFinanceTab';

const EXCEL_URL = 'https://media.base44.com/files/public/6a00fec50cc522a74ddde4b2/fe88edf68_base44_import_contabilidad_cliente_2023_2025.xlsx';

export default function ImportacionContable() {
  const { company, user, isAdmin } = useOutletContext() || {};
  const [activeTab, setActiveTab] = useState('resumen');
  const [ejercicio, setEjercicio] = useState(2025);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [stats, setStats] = useState(null);

  const loadStats = useCallback(async () => {
    if (!company?.id) return;
    try {
      const [accounts, entries, lines, vat, pyle, metrics, controls, sources] = await Promise.all([
        base44.entities.AccountingAccount.filter({ companyId: company.id }, '-created_date', 1),
        base44.entities.JournalEntry.filter({ companyId: company.id }, '-created_date', 1),
        base44.entities.JournalEntryLine.filter({ companyId: company.id }, '-created_date', 1),
        base44.entities.VATRecord.filter({ companyId: company.id }, '-created_date', 1),
        base44.entities.ProfitLossLine.filter({ companyId: company.id }, '-created_date', 1),
        base44.entities.FinancialMetric.filter({ companyId: company.id }, '-created_date', 1),
        base44.entities.ImportControlIssue.filter({ companyId: company.id }, '-created_date', 50),
        base44.entities.ImportSource.filter({ companyId: company.id }, '-created_date', 20),
      ]);
      setStats({
        hasData: (accounts?.length || 0) > 0,
        accounts: accounts?.length || 0,
        entries: entries?.length || 0,
        lines: lines?.length || 0,
        vat: vat?.length || 0,
        pyle: pyle?.length || 0,
        metrics: metrics?.length || 0,
        controls: controls || [],
        sources: sources || [],
        lastImport: sources?.[0]?.created_date,
      });
    } catch (e) {
      console.error('loadStats:', e);
    }
  }, [company?.id]);

  useEffect(() => { if (company?.id) loadStats(); }, [company?.id, loadStats]);

  const handleImport = async () => {
    if (!company?.id) return;
    setImporting(true);
    setImportProgress({ phase: 'Cargando Excel y procesando hojas...', sheet: '' });
    try {
      const resp = await base44.functions.invoke('importClientAccounting', {
        file_url: EXCEL_URL,
        companyId: company.id,
      });
      if (resp?.data?.status === 'ok') {
        const r = resp.data.results;
        const total = Object.values(r).reduce((acc, v) => acc + (v.created || 0), 0);
        toast.success(`Importación completada: ${total} registros importados`);
        await loadStats();
        setActiveTab('resumen');
      } else {
        toast.error('La importación no devolvió resultados correctos');
      }
    } catch (e) {
      console.error('Import failed:', e);
      toast.error('Error en la importación: ' + (e.message || 'desconocido'));
    }
    setImporting(false);
    setImportProgress(null);
  };

  if (!company) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Selecciona un cliente para ver su contabilidad importada.
      </div>
    );
  }

  const TABS = [
    { key: 'resumen', label: 'Resumen', icon: Database },
    { key: 'tax', label: 'Tax & Accounting', icon: FileSpreadsheet },
    { key: 'finance', label: 'Finance', icon: Brain },
  ];

  return (
    <div>
      <PageHeader
        title="Contabilidad Importada"
        subtitle={`Historial contable y financiero · ${company.name || ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Select value={String(ejercicio)} onValueChange={v => setEjercicio(Number(v))}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Button onClick={handleImport} disabled={importing} className="bg-teal hover:bg-teal-dark gap-2">
                {importing ? <><RefreshCw className="w-4 h-4 animate-spin" /> Importando...</> : <><Upload className="w-4 h-4" /> Importar Excel</>}
              </Button>
            )}
          </div>
        }
      />

      {/* Status banner */}
      {stats && (
        <div className={cn(
          "mb-4 rounded-xl border p-4 flex items-center gap-3",
          stats.hasData ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"
        )}>
          {stats.hasData ? <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" /> : <Database className="w-5 h-5 text-blue-600 flex-shrink-0" />}
          <div className="flex-1 text-sm">
            {stats.hasData ? (
              <>
                <span className="font-semibold text-amber-800">Contabilidad importada — pendiente de revisión.</span>{' '}
                <span className="text-amber-700">
                  {stats.accounts} cuentas · {stats.entries} asientos · {stats.lines} líneas de diario · {stats.vat} registros IVA · {stats.pyle} líneas PyG · {stats.metrics} KPIs
                </span>
              </>
            ) : (
              <span className="text-blue-700">Sin importación. Usa el botón "Importar Excel" para cargar el historial contable 2023-2025.</span>
            )}
          </div>
        </div>
      )}

      {importing && importProgress && (
        <div className="mb-4 rounded-xl border border-teal/30 bg-teal-light/50 p-4 flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-teal animate-spin" />
          <span className="text-sm text-teal font-medium">{importProgress.phase}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b border-border">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.key ? "border-teal text-teal" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'resumen' && <ImpResumen stats={stats} ejercicio={ejercicio} companyId={company.id} />}
      {activeTab === 'tax' && <ImpTaxTab companyId={company.id} ejercicio={ejercicio} />}
      {activeTab === 'finance' && <ImpFinanceTab companyId={company.id} ejercicio={ejercicio} />}
    </div>
  );
}
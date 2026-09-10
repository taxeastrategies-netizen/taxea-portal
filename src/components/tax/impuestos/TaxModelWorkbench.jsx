import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { AlertCircle, AlertTriangle, Calculator, CheckCircle2, Download, FileCheck2, FileJson, Loader2, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PERIODS = {
  anual: ['Anual'],
  trimestral: ['1T', '2T', '3T', '4T'],
  mensual: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
};

function formatMoney(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
}

function periodsFor(definition, fiscalProfile) {
  if (definition.frequency === 'anual') return PERIODS.anual;
  if (definition.code === '130' || definition.code === '420') return PERIODS.trimestral;
  if (definition.frequency.includes('mensual') && (fiscalProfile?.isLargeCompany || fiscalProfile?.isREDEME || fiscalProfile?.usesSII)) return PERIODS.mensual;
  return PERIODS.trimestral;
}

function downloadBase64(file) {
  if (!file?.contentBase64) return;
  const bytes = Uint8Array.from(atob(file.contentBase64), char => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ model }) {
  if (model.officialExport) return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">Diseño AEAT</span>;
  if (model.authority === 'ATC') return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">Programa ATC</span>;
  return <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">Borrador validable</span>;
}

export default function TaxModelWorkbench() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const [modelCode, setModelCode] = useState('303');
  const [year, setYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState('1T');
  const [result, setResult] = useState(null);
  const [actionError, setActionError] = useState('');

  const { data: catalogResponse, isLoading: loadingCatalog } = useQuery({
    queryKey: ['tax-model-engine-catalog'],
    queryFn: async () => (await base44.functions.invoke('taxModelOperations', { action: 'catalog' })).data,
  });

  const { data: fiscalProfiles = [] } = useQuery({
    queryKey: ['fiscal-profile-tax-models', companyId],
    queryFn: () => base44.entities.FiscalProfile.filter({ company_id: companyId }),
    enabled: !!companyId,
  });

  const profile = fiscalProfiles.find(item => item.active !== false) || fiscalProfiles[0];
  const models = catalogResponse?.models || [];
  const definition = models.find(item => item.code === modelCode) || models[0];
  const periodOptions = useMemo(() => definition ? periodsFor(definition, profile) : PERIODS.trimestral, [definition, profile]);

  useEffect(() => {
    if (definition && !periodOptions.includes(period)) setPeriod(periodOptions[0]);
    setResult(null);
    setActionError('');
  }, [modelCode, year, definition?.frequency]);

  const invoke = useMutation({
    mutationFn: async ({ action }) => {
      const response = await base44.functions.invoke('taxModelOperations', {
        action,
        companyId,
        modeloCodigo: modelCode,
        ejercicio: year,
        periodo: period,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      setActionError('');
      if (variables.action === 'calculate' || variables.action === 'save_draft') setResult(data);
      if (variables.action === 'export' || variables.action === 'export_review') downloadBase64(data.file);
    },
    onError: error => {
      const payload = error?.response?.data;
      const messages = payload?.blockers?.length ? payload.blockers.join(' ') : payload?.error || error?.message || 'No se pudo completar la operación.';
      setActionError(messages);
    },
  });

  if (!companyId) return <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Selecciona una empresa para preparar sus modelos.</div>;

  return (
    <div className="grid min-h-[690px] grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-slate-950 lg:border-b-0 lg:border-r">
        <div className="border-b border-white/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Motor tributario</p>
          <p className="mt-2 text-sm text-slate-300">Modelos calculados desde contabilidad y documentos reales.</p>
        </div>
        <div className="max-h-[620px] overflow-y-auto p-2">
          {loadingCatalog ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" /></div> : models.map(model => (
            <button
              key={model.code}
              onClick={() => setModelCode(model.code)}
              className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition ${model.code === modelCode ? 'bg-cyan-400/15 ring-1 ring-cyan-300/40' : 'hover:bg-white/5'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-bold ${model.code === modelCode ? 'text-cyan-200' : 'text-white'}`}>{model.code}</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">{model.authority}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-400">{model.name}</p>
            </button>
          ))}
        </div>
      </aside>

      <main className="min-w-0 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40">
        <div className="border-b border-slate-200 bg-white/90 p-5 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Modelo {definition?.code}</h2>
                {definition && <StatusBadge model={definition} />}
              </div>
              <p className="mt-1 text-sm text-slate-500">{definition?.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={year} onChange={event => setYear(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                {[year - 2, year - 1, year, year + 1].filter((value, index, array) => array.indexOf(value) === index).map(value => <option key={value}>{value}</option>)}
              </select>
              <select value={period} onChange={event => { setPeriod(event.target.value); setResult(null); }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                {periodOptions.map(value => <option key={value}>{value}</option>)}
              </select>
              <Button onClick={() => invoke.mutate({ action: 'calculate' })} disabled={invoke.isPending} className="gap-2 bg-slate-950 text-white hover:bg-slate-800">
                {invoke.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                Calcular borrador
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {definition?.designWarning && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div><p className="font-semibold">Límite de exportación oficial</p><p className="mt-0.5 text-xs leading-5">{definition.designWarning}</p></div>
            </div>
          )}

          {actionError && (
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{actionError}</span></div>
          )}

          {!result ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><RefreshCw className="h-5 w-5 text-cyan-600" /><h3 className="mt-4 text-sm font-semibold text-slate-800">Fuente única</h3><p className="mt-1 text-xs leading-5 text-slate-500">Cruza líneas fiscales, facturas, nóminas y asientos confirmados sin alterar ningún registro.</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h3 className="mt-4 text-sm font-semibold text-slate-800">Validación previa</h3><p className="mt-1 text-xs leading-5 text-slate-500">Los datos obligatorios ausentes bloquean la exportación. Un aviso nunca se convierte en una cifra inventada.</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><FileCheck2 className="h-5 w-5 text-violet-600" /><h3 className="mt-4 text-sm font-semibold text-slate-800">Trazabilidad</h3><p className="mt-1 text-xs leading-5 text-slate-500">Cada casilla conserva los identificadores de sus facturas, nóminas o líneas contables de origen.</p></div>
            </div>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Resultado</p><p className={`mt-2 text-2xl font-bold ${Number(result.calculation?.result) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{definition?.kind === 'informative' ? 'Informativo' : formatMoney(result.calculation?.result)}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Documentos trazados</p><p className="mt-2 text-2xl font-bold text-slate-900">{result.source?.count || 0}</p><p className="mt-1 text-[11px] text-slate-400">Hash {result.source?.hash?.slice(0, 12)}…</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Incidencias bloqueantes</p><p className={`mt-2 text-2xl font-bold ${result.validation?.blockers?.length ? 'text-red-600' : 'text-emerald-600'}`}>{result.validation?.blockers?.length || 0}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Diseño</p><p className="mt-2 text-sm font-bold text-slate-900">{result.definition?.design}</p><p className="mt-1 text-[11px] text-slate-400">Motor {result.engineVersion}</p></div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,0.7fr)]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-semibold text-slate-800">Casillas calculadas</h3><p className="mt-0.5 text-xs text-slate-500">Importes y recuentos obtenidos de sus fuentes.</p></div>
                  <div className="max-h-[390px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2 text-left">Casilla</th><th className="px-4 py-2 text-left">Concepto</th><th className="px-4 py-2 text-right">Valor</th><th className="px-4 py-2 text-right">Fuentes</th></tr></thead>
                      <tbody>{(result.calculation?.fields || []).map(field => <tr key={`${field.code}-${field.label}`} className="border-t border-slate-100"><td className="px-4 py-2 font-mono text-xs font-semibold text-cyan-700">{field.code}</td><td className="px-4 py-2 text-slate-700"><p>{field.label}</p>{field.section && <p className="text-[11px] text-slate-400">{field.section}</p>}</td><td className="px-4 py-2 text-right font-medium text-slate-900">{field.code === 'DECLARADOS' || /Perceptores|Número/.test(field.label) ? Number(field.value).toLocaleString('es-ES') : formatMoney(field.value)}</td><td className="px-4 py-2 text-right text-xs text-slate-400">{field.sourceIds?.length || 0}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className={`rounded-2xl border p-4 ${result.validation?.blockers?.length ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                    <div className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${result.validation?.blockers?.length ? 'text-red-600' : 'text-emerald-600'}`} /><h3 className="text-sm font-semibold text-slate-800">Control previo</h3></div>
                    {result.validation?.blockers?.length ? <ul className="mt-3 space-y-2 text-xs leading-5 text-red-700">{result.validation.blockers.map((message, index) => <li key={index}>• {message}</li>)}</ul> : <p className="mt-2 text-xs text-emerald-700">No se han detectado bloqueos con los datos disponibles.</p>}
                    {!!result.validation?.warnings?.length && <ul className="mt-3 space-y-2 border-t border-amber-200 pt-3 text-xs leading-5 text-amber-700">{result.validation.warnings.map((message, index) => <li key={index}>• {message}</li>)}</ul>}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Cobertura del cálculo</h3>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">{Object.entries(result.source?.stats || {}).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-2"><dt className="capitalize text-slate-400">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className="mt-1 text-lg font-bold text-slate-800">{value}</dd></div>)}</dl>
                  </div>
                </div>
              </section>

              {!!result.calculation?.details?.length && (
                <details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Ver detalle de declarados y documentos ({result.calculation.details.length})</summary><div className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-300"><pre className="whitespace-pre-wrap">{JSON.stringify(result.calculation.details, null, 2)}</pre></div></details>
              )}

              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                <Button variant="outline" className="gap-2" onClick={() => invoke.mutate({ action: 'save_draft' })} disabled={invoke.isPending}><Save className="h-4 w-4" />Guardar versión</Button>
                <Button variant="outline" className="gap-2" onClick={() => invoke.mutate({ action: 'export_review' })} disabled={invoke.isPending}><FileJson className="h-4 w-4" />Descargar revisión</Button>
                <Button className="gap-2 bg-emerald-700 hover:bg-emerald-800" onClick={() => invoke.mutate({ action: 'export' })} disabled={invoke.isPending || !result.validation?.canExportOfficial}><Download className="h-4 w-4" />Exportar diseño oficial</Button>
                {!result.validation?.canExportOfficial && <p className="flex items-center text-xs text-slate-500">Resuelve los bloqueos o usa el programa oficial indicado antes de presentar.</p>}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}


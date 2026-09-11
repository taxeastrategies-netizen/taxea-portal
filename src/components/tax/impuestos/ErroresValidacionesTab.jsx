import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Loader2, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { useTaxWorkspace } from './useTaxWorkspace';

const CATEGORY_LABEL = { configuracion: 'Configuración', borrador: 'Borrador', presentacion: 'Presentación', incidencia: 'Incidencia fiscal', fichero: 'Fichero' };

function Metric({ label, value, tone }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-emerald-700';
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div>;
}

export default function ErroresValidacionesTab({ onOpenModel, onOpenConfig }) {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [severity, setSeverity] = useState('all');
  const [category, setCategory] = useState('all');
  const workspace = useTaxWorkspace(companyId, year);
  const issues = useMemo(() => (workspace.data?.validationIssues || []).filter(item => (severity === 'all' || item.severity === severity) && (category === 'all' || item.category === category)), [workspace.data, severity, category]);

  if (!companyId) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">Selecciona una empresa.</div>;

  const blockers = workspace.data?.stats?.blockers || 0;
  const warnings = workspace.data?.stats?.warnings || 0;
  const reviewedDrafts = (workspace.data?.latestDrafts || []).filter(item => ['revisado', 'aprobado'].includes(item.estado) && !item.blockers?.length).length;

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div><h2 className="text-base font-semibold text-slate-900">Centro de validaciones</h2><p className="mt-1 text-sm text-slate-500">Una única bandeja para bloqueos del motor, avisos de borradores, evidencias incompletas e incidencias fiscales abiertas.</p></div>
      <div className="flex flex-wrap items-center gap-2"><select value={year} onChange={event => setYear(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(value => <option key={value}>{value}</option>)}</select><Button variant="outline" className="gap-2" onClick={() => workspace.refetch()} disabled={workspace.isFetching}><RefreshCw className={`h-4 w-4 ${workspace.isFetching ? 'animate-spin' : ''}`} />Volver a comprobar</Button></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Bloqueos" value={blockers} tone={blockers ? 'red' : 'emerald'} /><Metric label="Avisos a revisar" value={warnings} tone={warnings ? 'amber' : 'emerald'} /><Metric label="Borradores revisados sin bloqueos" value={reviewedDrafts} tone="emerald" /></div>

    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2">{[['all','Todo'],['blocker','Bloqueos'],['warning','Avisos']].map(([value,label]) => <button key={value} onClick={() => setSeverity(value)} className={`rounded-full border px-3 py-1 text-xs font-medium ${severity === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}</div>
      <select value={category} onChange={event => setCategory(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Todas las áreas</option>{Object.entries(CATEGORY_LABEL).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
    </div>

    {workspace.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>
      : workspace.isError ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{workspace.error?.response?.data?.error || workspace.error?.message}</div>
      : issues.length === 0 ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-14 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><p className="mt-3 font-semibold text-emerald-900">No hay incidencias con estos filtros</p><p className="mt-1 text-xs text-emerald-700">La validación acredita coherencia interna de los datos disponibles; no sustituye la revisión profesional ni la aceptación administrativa.</p></div>
      : <div className="space-y-3">{issues.map(issue => {
        const blocker = issue.severity === 'blocker';
        const Icon = blocker ? AlertCircle : AlertTriangle;
        return <article key={issue.id} className={`rounded-2xl border p-4 ${blocker ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
          <div className="flex items-start gap-3"><div className={`mt-0.5 rounded-lg p-2 ${blocker ? 'bg-red-100' : 'bg-amber-100'}`}><Icon className={`h-4 w-4 ${blocker ? 'text-red-700' : 'text-amber-700'}`} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${blocker ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{blocker ? 'Bloquea exportación o arrastre' : 'Revisión necesaria'}</span><span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{CATEGORY_LABEL[issue.category] || issue.category}</span><span className="font-mono text-[10px] text-slate-400">{issue.code}</span></div><p className="mt-2 text-sm font-medium text-slate-800">{issue.message}</p>{issue.modeloCodigo && <p className="mt-1 text-xs text-slate-500">Modelo {issue.modeloCodigo} · {issue.periodo} {issue.ejercicio}</p>}{issue.recommendedAction && <p className="mt-2 text-xs text-slate-600"><strong>Acción recomendada:</strong> {issue.recommendedAction}</p>}</div><div className="flex shrink-0 gap-2">{issue.category === 'configuracion' && <Button size="sm" variant="outline" onClick={onOpenConfig}><Settings className="mr-1 h-3.5 w-3.5" />Configurar</Button>}{issue.modeloCodigo && <Button size="sm" variant="outline" onClick={() => onOpenModel?.({ modelCode: issue.modeloCodigo, year: issue.ejercicio || year, period: issue.periodo || 'Anual' })}>Revisar <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}</div></div>
        </article>;
      })}</div>}

    <div className="flex gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-xs leading-5 text-cyan-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>Los avisos se resuelven corrigiendo su fuente —perfil, factura, nómina, asiento, borrador o modelo importado—. Esta pestaña no permite “marcar como resuelto” sin arreglar el dato que originó la incidencia.</p></div>
  </div>;
}


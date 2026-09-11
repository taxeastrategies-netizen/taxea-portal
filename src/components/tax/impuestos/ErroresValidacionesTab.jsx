import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RefreshCw, Settings } from 'lucide-react';
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

  const recommendations = workspace.data?.stats?.recommendations ?? workspace.data?.stats?.warnings ?? 0;
  const reviewedDrafts = (workspace.data?.latestDrafts || []).filter(item => ['revisado', 'aprobado'].includes(item.estado)).length;

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div><h2 className="text-base font-semibold text-slate-900">Centro de validaciones</h2><p className="mt-1 text-sm text-slate-500">Una única bandeja de recomendaciones sobre configuración, borradores, evidencias e incidencias fiscales. Ninguna impide exportar.</p></div>
      <div className="flex flex-wrap items-center gap-2"><select value={year} onChange={event => setYear(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(value => <option key={value}>{value}</option>)}</select><Button variant="outline" className="gap-2" onClick={() => workspace.refetch()} disabled={workspace.isFetching}><RefreshCw className={`h-4 w-4 ${workspace.isFetching ? 'animate-spin' : ''}`} />Volver a comprobar</Button></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Recomendaciones" value={recommendations} tone={recommendations ? 'amber' : 'emerald'} /><Metric label="Bloqueos de exportación" value={0} tone="emerald" /><Metric label="Borradores revisados" value={reviewedDrafts} tone="emerald" /></div>

    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2">{[['all','Todas'],['warning','Recomendaciones']].map(([value,label]) => <button key={value} onClick={() => setSeverity(value)} className={`rounded-full border px-3 py-1 text-xs font-medium ${severity === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}</div>
      <select value={category} onChange={event => setCategory(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Todas las áreas</option>{Object.entries(CATEGORY_LABEL).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
    </div>

    {workspace.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>
      : workspace.isError ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{workspace.error?.response?.data?.error || workspace.error?.message}</div>
      : issues.length === 0 ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-14 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><p className="mt-3 font-semibold text-emerald-900">No hay incidencias con estos filtros</p><p className="mt-1 text-xs text-emerald-700">La validación acredita coherencia interna de los datos disponibles; no sustituye la revisión profesional ni la aceptación administrativa.</p></div>
      : <div className="space-y-3">{issues.map(issue => {
        return <article key={issue.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-start gap-3"><div className="mt-0.5 rounded-lg bg-amber-100 p-2"><AlertTriangle className="h-4 w-4 text-amber-700" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Recomendación no bloqueante</span><span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{CATEGORY_LABEL[issue.category] || issue.category}</span><span className="font-mono text-[10px] text-slate-400">{issue.code}</span></div><p className="mt-2 text-sm font-medium text-slate-800">{issue.message}</p>{issue.modeloCodigo && <p className="mt-1 text-xs text-slate-500">Modelo {issue.modeloCodigo} · {issue.periodo} {issue.ejercicio}</p>}{issue.recommendedAction && <p className="mt-2 text-xs text-slate-600"><strong>Acción recomendada:</strong> {issue.recommendedAction}</p>}</div><div className="flex shrink-0 gap-2">{issue.category === 'configuracion' && <Button size="sm" variant="outline" onClick={onOpenConfig}><Settings className="mr-1 h-3.5 w-3.5" />Configurar</Button>}{issue.modeloCodigo && <Button size="sm" variant="outline" onClick={() => onOpenModel?.({ modelCode: issue.modeloCodigo, year: issue.ejercicio || year, period: issue.periodo || 'Anual' })}>Revisar <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}</div></div>
        </article>;
      })}</div>}

    <div className="flex gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-xs leading-5 text-cyan-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Las recomendaciones se resuelven corrigiendo su fuente —perfil, factura, nómina, asiento, borrador o modelo importado—, pero no inmovilizan el borrador ni el fichero. La Administración conserva sus controles de aceptación.</p></div>
  </div>;
}


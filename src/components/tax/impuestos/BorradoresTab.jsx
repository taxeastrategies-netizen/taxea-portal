import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, FileClock, FilePen, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { base44 } from '@/api/base44Client';
import { DRAFT_STATUS, formatDate, formatMoney, isReviewer, statusPill, taxWorkspaceKey, useTaxWorkspace } from './useTaxWorkspace';

function Metric({ label, value, tone = 'slate' }) {
  const tones = { slate: 'text-slate-900', amber: 'text-amber-700', red: 'text-red-700', emerald: 'text-emerald-700' };
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p></div>;
}

export default function BorradoresTab({ onOpenModel }) {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [showVersions, setShowVersions] = useState(false);
  const [actionError, setActionError] = useState('');
  const queryClient = useQueryClient();
  const workspace = useTaxWorkspace(companyId, year);
  const reviewer = isReviewer(user);

  const rows = useMemo(() => [...(showVersions ? workspace.data?.drafts || [] : workspace.data?.latestDrafts || [])]
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)), [showVersions, workspace.data]);

  const updateStatus = useMutation({
    mutationFn: async ({ draftId, status }) => (await base44.functions.invoke('taxModelOperations', { action: 'update_draft_status', companyId, draftId, status })).data,
    onSuccess: async () => { setActionError(''); await queryClient.invalidateQueries({ queryKey: taxWorkspaceKey(companyId, year) }); },
    onError: error => setActionError(error?.response?.data?.error || error?.message || 'No se pudo actualizar el borrador.'),
  });

  if (!companyId) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">Selecciona una empresa.</div>;

  const latest = workspace.data?.latestDrafts || [];
  const inReview = latest.filter(item => item.estado === 'en_revision').length;
  const recommendations = latest.reduce((sum, item) => sum + (item.recommendations?.length || item.warnings?.length || 0), 0);
  const approved = latest.filter(item => item.estado === 'aprobado').length;

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div><h2 className="text-base font-semibold text-slate-900">Borradores versionados</h2><p className="mt-1 text-sm text-slate-500">Cada versión procede del motor tributario, conserva su huella de datos y nunca recalcula importes en esta pestaña.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={year} onChange={event => setYear(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(value => <option key={value}>{value}</option>)}</select>
        <Button variant="outline" className="gap-2" onClick={() => workspace.refetch()} disabled={workspace.isFetching}><RefreshCw className={`h-4 w-4 ${workspace.isFetching ? 'animate-spin' : ''}`} />Actualizar</Button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Últimas versiones" value={latest.length} />
      <Metric label="Pendientes de revisión" value={inReview} tone={inReview ? 'amber' : 'emerald'} />
      <Metric label="Recomendaciones" value={recommendations} tone={recommendations ? 'amber' : 'emerald'} />
      <Metric label="Aprobados" value={approved} tone="emerald" />
    </div>

    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
      <span>Guardar de nuevo el mismo cálculo no crea duplicados. Si cambian fuentes o ajustes, Taxea crea una versión enlazada.</span>
      <label className="ml-4 flex shrink-0 items-center gap-2"><input type="checkbox" checked={showVersions} onChange={event => setShowVersions(event.target.checked)} />Ver todas las versiones</label>
    </div>

    {actionError && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{actionError}</div>}
    {workspace.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>
      : workspace.isError ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{workspace.error?.response?.data?.error || workspace.error?.message}</div>
      : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><FilePen className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Todavía no hay borradores guardados</p><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">Calcula el modelo en “Modelos y periodos” y pulsa “Guardar versión”. Aquí aparecerá la fotografía exacta del cálculo.</p></div>
      : <div className="space-y-3">{rows.map(draft => {
        const status = statusPill(DRAFT_STATUS[draft.estado], draft.estado);
        const isLatest = workspace.data?.latestDrafts?.some(item => item.id === draft.id);
        return <article key={draft.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-cyan-200">{draft.modeloCodigo}</div>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">Modelo {draft.modeloCodigo} · {draft.periodo} {draft.ejercicio}</h3><span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}>{status.label}</span>{!isLatest && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Histórica</span>}</div><p className="mt-1 text-xs text-slate-500">Versión {draft.version} · guardada {formatDate(draft.updatedAt, true)} · motor {draft.engineVersion || 'sin versión registrada'}</p><p className="mt-1 truncate font-mono text-[11px] text-slate-400">Huella {draft.snapshotHash || draft.sourceHash || 'no disponible'}</p></div>
            </div>
            <div className="text-left xl:text-right"><p className="text-xs text-slate-500">Resultado calculado</p><p className={`text-xl font-bold ${draft.resultadoCalculado > 0 ? 'text-red-600' : draft.resultadoCalculado < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>{formatMoney(draft.resultadoCalculado)}</p><p className="text-[11px] text-slate-400">{draft.sourceCount} fuentes trazadas</p></div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className={`rounded-xl border p-3 ${draft.recommendations?.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><div className="flex items-center gap-2">{draft.recommendations?.length ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}<span className="text-xs font-semibold">{draft.recommendations?.length || 0} recomendaciones</span></div>{draft.recommendations?.slice(0, 2).map((item, index) => <p key={index} className="mt-1 text-xs text-amber-700">{item.message}</p>)}</div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="text-xs font-semibold">Exportación disponible</span></div><p className="mt-1 text-xs text-emerald-700">Las recomendaciones no bloquean la descarga ni la revisión del borrador.</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2"><FileClock className="h-4 w-4 text-cyan-700" /><span className="text-xs font-semibold">Ajustes revisables</span></div><p className="mt-1 text-xs text-slate-600">{draft.adjustments?.length ? `${draft.adjustments.length} ajustes conservados en esta versión.` : 'Sin ajustes manuales.'}</p></div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => onOpenModel?.({ modelCode: draft.modeloCodigo, year: draft.ejercicio, period: draft.periodo })}><ArrowRight className="h-3.5 w-3.5" />Abrir modelo</Button>
            {isLatest && draft.estado === 'borrador' && <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ draftId: draft.id, status: 'en_revision' })} disabled={updateStatus.isPending}>Enviar a revisión</Button>}
            {isLatest && reviewer && draft.estado === 'en_revision' && <Button size="sm" variant="outline" className="border-cyan-300 text-cyan-800" onClick={() => updateStatus.mutate({ draftId: draft.id, status: 'revisado' })} disabled={updateStatus.isPending}><ShieldCheck className="mr-1 h-3.5 w-3.5" />Marcar revisado</Button>}
            {isLatest && reviewer && draft.estado === 'revisado' && <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => updateStatus.mutate({ draftId: draft.id, status: 'aprobado' })} disabled={updateStatus.isPending}>Aprobar</Button>}
            {isLatest && reviewer && !['aprobado', 'rechazado'].includes(draft.estado) && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => updateStatus.mutate({ draftId: draft.id, status: 'rechazado' })} disabled={updateStatus.isPending}>Rechazar</Button>}
          </div>
        </article>;
      })}</div>}
  </div>;
}


import { useMemo, useState } from 'react';
import { ArrowRight, FileCheck2, FileClock, FileDown, History, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { formatDate, formatMoney, useTaxWorkspace } from './useTaxWorkspace';

const EVENT = {
  draft: { label: 'Borrador', icon: FileClock, color: 'bg-cyan-100 text-cyan-700' },
  filing: { label: 'Presentación', icon: FileCheck2, color: 'bg-emerald-100 text-emerald-700' },
  file: { label: 'Fichero', icon: FileDown, color: 'bg-violet-100 text-violet-700' },
};

function Metric({ label, value }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div>;
}

export default function HistorialFiscalTab({ onOpenModel }) {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [type, setType] = useState('all');
  const [model, setModel] = useState('all');
  const workspace = useTaxWorkspace(companyId, year);
  const models = useMemo(() => [...new Set((workspace.data?.events || []).map(item => item.modeloCodigo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true })), [workspace.data]);
  const events = useMemo(() => (workspace.data?.events || []).filter(item => (type === 'all' || item.type === type) && (model === 'all' || item.modeloCodigo === model)), [workspace.data, type, model]);

  if (!companyId) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">Selecciona una empresa.</div>;

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-base font-semibold text-slate-900">Historial fiscal auditable</h2><p className="mt-1 text-sm text-slate-500">Cronología sin duplicar estados: versiones guardadas, ficheros generados y declaraciones realmente presentadas.</p></div><div className="flex flex-wrap gap-2"><select value={year} onChange={event => setYear(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">{[currentYear - 3, currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(value => <option key={value}>{value}</option>)}</select><Button variant="outline" className="gap-2" onClick={() => workspace.refetch()} disabled={workspace.isFetching}><RefreshCw className={`h-4 w-4 ${workspace.isFetching ? 'animate-spin' : ''}`} />Actualizar</Button></div></div>

    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Versiones de borrador" value={workspace.data?.stats?.drafts || 0} /><Metric label="Snapshots presentados" value={workspace.data?.stats?.filings || 0} /><Metric label="Ficheros generados" value={workspace.data?.stats?.officialFiles || 0} /></div>

    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row"><select value={type} onChange={event => setType(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Todos los eventos</option><option value="draft">Borradores</option><option value="filing">Presentaciones</option><option value="file">Ficheros</option></select><select value={model} onChange={event => setModel(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Todos los modelos</option>{models.map(value => <option key={value} value={value}>Modelo {value}</option>)}</select></div>

    {workspace.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>
      : workspace.isError ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{workspace.error?.response?.data?.error || workspace.error?.message}</div>
      : events.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><History className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">Sin actividad fiscal con estos filtros</p><p className="mt-1 text-xs text-slate-500">El historial se alimenta automáticamente al guardar versiones, generar ficheros o importar presentaciones.</p></div>
      : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="divide-y divide-slate-100">{events.map(event => {
        const cfg = EVENT[event.type] || EVENT.draft;
        const Icon = cfg.icon;
        return <div key={event.id} className="flex flex-col gap-3 p-4 hover:bg-slate-50/70 sm:flex-row sm:items-center">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}><Icon className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-slate-900">{event.title}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{cfg.label}</span></div><p className="mt-0.5 text-xs text-slate-500">{event.detail} · {formatDate(event.date, true)}</p>{event.hash && <p className="mt-1 truncate font-mono text-[10px] text-slate-400">Huella {event.hash}</p>}</div>
          {event.result != null && <div className="sm:text-right"><p className="text-[11px] text-slate-400">Resultado</p><p className={`text-sm font-semibold ${event.result > 0 ? 'text-red-600' : event.result < 0 ? 'text-emerald-700' : 'text-slate-600'}`}>{formatMoney(event.result)}</p></div>}
          {event.modeloCodigo && <Button size="sm" variant="ghost" onClick={() => onOpenModel?.({ modelCode: event.modeloCodigo, year: event.ejercicio, period: event.periodo })}>Abrir <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>}
        </div>;
      })}</div></div>}

    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">El historial muestra evidencia operativa interna. Una presentación queda acreditada por su snapshot, justificante, CSV o fichero oficial; un borrador o una descarga no son prueba de presentación.</div>
  </div>;
}


import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Building2, ChevronLeft, ChevronRight, Download, ExternalLink,
  FileSearch, Filter, Landmark, LayoutList, Loader2, RefreshCw, Save, Search,
  ShieldCheck, Siren, SlidersHorizontal, Trash2, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { startImpersonation } from '@/lib/impersonation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const REVIEW_ROLES = ['admin', 'super_admin', 'advisor', 'asesor'];
const TRACEABLE = new Set(['Invoice', 'InvoiceTaxLine', 'JournalEntry', 'JournalEntryLine', 'InvoicePayment', 'BankTransaction']);
const SEVERITY = {
  critical: { label: 'Crítica', badge: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-600' },
  high: { label: 'Alta', badge: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  medium: { label: 'Media', badge: 'bg-cyan-100 text-cyan-800 border-cyan-200', dot: 'bg-cyan-500' },
  low: { label: 'Baja', badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
};
const CATEGORY = {
  accounting: 'Contabilidad', bank: 'Banco / 555', fiscal_profile: 'Perfil fiscal',
  fiscal_treatment: 'Tratamiento fiscal', tax_model: 'Modelos', deadline: 'Vencimientos',
  incident: 'Incidencias', configuration: 'Configuración',
};

const unwrap = response => response?.data || response || {};
const invoke = async payload => {
  const data = unwrap(await base44.functions.invoke('advisorWorkspaceOperations', payload));
  if (data.error || data.ok === false) throw new Error(data.error || 'No se pudo cargar la bandeja de asesoría.');
  return data;
};
const formatDateTime = value => value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
const formatMoney = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

function SummaryCard({ label, value, detail, tone = 'slate', icon: Icon }) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-800', amber: 'border-amber-200 bg-amber-50 text-amber-800',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-800', violet: 'border-violet-200 bg-violet-50 text-violet-800',
    slate: 'border-slate-200 bg-white text-slate-800',
  };
  return <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
    <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>{Icon && <Icon className="h-4 w-4 opacity-70" />}</div>
    <p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-[11px] opacity-70">{detail}</p>
  </div>;
}

function TraceDrawer({ input, onClose }) {
  const traceQuery = useQuery({
    queryKey: ['advisor-entity-trace', input?.companyId, input?.entityType, input?.entityId],
    queryFn: () => invoke({ action: 'trace', ...input }),
    enabled: Boolean(input?.companyId && input?.entityType && input?.entityId),
  });
  if (!input) return null;
  const trace = traceQuery.data?.trace;
  return <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Trazabilidad operativa">
    <button type="button" className="min-w-0 flex-1 cursor-default" onClick={onClose} aria-label="Cerrar trazabilidad" />
    <aside className="flex h-full w-full max-w-2xl flex-col bg-slate-50 shadow-2xl">
      <header className="border-b border-slate-800 bg-slate-950 px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Cadena documental</p><h2 className="mt-1 text-lg font-bold">{input.title || 'Trazabilidad completa'}</h2><p className="mt-1 text-xs text-slate-300">Factura → línea fiscal → asiento → pago → movimiento bancario</p></div><Button size="icon" variant="ghost" onClick={onClose} className="text-white hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></Button></div>
      </header>
      <div className="flex-1 overflow-y-auto p-5">
        {traceQuery.isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-cyan-600" /></div>
          : traceQuery.isError ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{traceQuery.error.message}</div>
            : <div className="space-y-3">
              {(trace?.nodes || []).map((item, index) => {
                const outgoing = (trace?.edges || []).filter(edge => edge.from === item.id);
                return <div key={item.id}>
                  <article className={`rounded-2xl border bg-white p-4 shadow-sm ${trace.root === item.id ? 'border-cyan-400 ring-2 ring-cyan-100' : 'border-slate-200'}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{item.type}</Badge>{item.status && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{String(item.status).replaceAll('_', ' ')}</span>}</div><h3 className="mt-2 text-sm font-semibold text-slate-900">{item.label}</h3><p className="mt-0.5 text-xs text-slate-500">{[item.date, item.subtitle].filter(Boolean).join(' · ')}</p></div>{item.amount != null && <p className="text-sm font-bold text-slate-800">{formatMoney(item.amount)}</p>}</div>
                  </article>
                  {!!outgoing.length && <div className="ml-6 border-l-2 border-dashed border-cyan-200 py-2 pl-4 text-[11px] font-medium text-cyan-700">{outgoing.map(edge => edge.relation).join(' · ')}</div>}
                  {!outgoing.length && index < (trace?.nodes || []).length - 1 && <div className="h-3" />}
                </div>;
              })}
              {!trace?.nodes?.length && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">No se han encontrado relaciones para este registro.</div>}
            </div>}
      </div>
    </aside>
  </div>;
}

function AlertRow({ alert, onTrace, onOpen }) {
  const severity = SEVERITY[alert.severity] || SEVERITY.medium;
  return <div className="rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severity.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${severity.dot}`} />{severity.label}</span><span className="text-[11px] font-medium text-slate-500">{CATEGORY[alert.category] || alert.category}</span></div><p className="mt-2 text-sm font-semibold text-slate-900">{alert.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{alert.detail || 'Sin detalle adicional.'}</p></div>
      <div className="flex shrink-0 flex-wrap gap-2">{TRACEABLE.has(alert.sourceType) && alert.sourceId && <Button size="sm" variant="outline" onClick={() => onTrace(alert)}><FileSearch className="mr-1 h-3.5 w-3.5" />Trazar</Button>}<Button size="sm" variant="outline" onClick={() => onOpen(alert.deepLink)}><ExternalLink className="mr-1 h-3.5 w-3.5" />Abrir</Button></div>
    </div>
  </div>;
}

export default function AdvisorWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canReview = REVIEW_ROLES.includes(String(user?.role || '').toLowerCase());
  const currentYear = new Date().getFullYear();
  const [filters, setFilters] = useState({ year: currentYear, search: '', severity: 'all', category: 'all', page: 1, pageSize: 12 });
  const [searchInput, setSearchInput] = useState('');
  const [expandedCompany, setExpandedCompany] = useState('');
  const [traceInput, setTraceInput] = useState(null);
  const [viewName, setViewName] = useState('');

  const overview = useQuery({
    queryKey: ['advisor-workspace', filters],
    queryFn: () => invoke({ action: 'overview', ...filters }),
    enabled: canReview,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });
  const savedViews = useQuery({
    queryKey: ['advisor-saved-views'],
    queryFn: () => invoke({ action: 'saved_views' }),
    enabled: canReview,
  });
  const saveView = useMutation({
    mutationFn: payload => invoke(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['advisor-saved-views'] }); setViewName(''); toast.success('Vista guardada.'); },
    onError: error => toast.error(error.message),
  });
  const deleteView = useMutation({
    mutationFn: payload => invoke(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['advisor-saved-views'] }); toast.success('Vista eliminada.'); },
    onError: error => toast.error(error.message),
  });

  const data = overview.data || {};
  const rows = data.rows || [];
  const summary = data.summary || {};
  const pagination = data.pagination || { page: 1, totalPages: 1, total: 0 };

  const exportRows = useMemo(() => rows.flatMap(row => row.alerts.map(alert => ({
    empresa: row.company.name, nif: row.company.taxId, severidad: alert.severity,
    categoria: CATEGORY[alert.category] || alert.category, titulo: alert.title, detalle: alert.detail,
    tipo_origen: alert.sourceType, id_origen: alert.sourceId, detectado: alert.detectedAt,
  }))), [rows]);

  if (!canReview) return <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-amber-700" /><h1 className="mt-3 text-lg font-bold text-slate-900">Bandeja reservada a asesoría</h1><p className="mt-2 text-sm leading-6 text-slate-600">Tu perfil de cliente mantiene acceso a su propia empresa. La vista multiempresa requiere asignación profesional explícita.</p></div>;

  const updateFilter = (key, value) => setFilters(current => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
  const openCompanyPath = (row, path) => {
    startImpersonation({ clientAccountId: row.client?.id || '', clientName: row.company.name, clientEmail: row.client?.email || row.company.ownerEmail, companyId: row.company.id });
    window.location.assign(path || '/tax-accounting/dashboard');
  };
  const downloadCsv = () => {
    const headers = ['Empresa', 'NIF', 'Severidad', 'Categoría', 'Incidencia', 'Detalle', 'Tipo origen', 'ID origen', 'Detectado'];
    const lines = [headers.map(csvCell).join(';'), ...exportRows.map(row => Object.values(row).map(csvCell).join(';'))];
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `bandeja-asesoria-${filters.year}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="mx-auto max-w-[1600px] space-y-5">
    <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 text-white shadow-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><LayoutList className="h-4 w-4" />Control multiempresa</div><h1 className="mt-2 text-2xl font-bold">Bandeja del asesor</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Pendientes reales de contabilidad, banco, tratamiento fiscal, modelos, cierres e incidencias. Los indicadores se recalculan desde cada empresa; no son datos estáticos.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={downloadCsv} disabled={!exportRows.length}><Download className="mr-2 h-4 w-4" />Exportar vista</Button><Button className="bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => overview.refetch()} disabled={overview.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${overview.isFetching ? 'animate-spin' : ''}`} />Actualizar</Button></div></div>
      <p className="mt-4 text-[11px] text-slate-400">Ámbito: {data.scope === 'global_admin' ? 'administración global' : 'cartera asignada'} · Último cálculo: {formatDateTime(data.generatedAt)}</p>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <SummaryCard label="Empresas" value={summary.companies ?? '—'} detail={`${summary.loadedCompanies || 0} cargadas en esta página`} icon={Building2} />
      <SummaryCard label="Alertas página" value={summary.alerts ?? '—'} detail="Calculadas desde eventos reales" tone="cyan" icon={AlertTriangle} />
      <SummaryCard label="Críticas" value={summary.critical ?? '—'} detail="Requieren atención inmediata" tone="red" icon={Siren} />
      <SummaryCard label="Altas" value={summary.high ?? '—'} detail="Prioridad profesional" tone="amber" icon={AlertTriangle} />
      <SummaryCard label="Pendientes 555" value={summary.suspense555 ?? '—'} detail="Banco por aplicar" tone="violet" icon={Landmark} />
      <SummaryCard label="Modelos" value={summary.pendingModels ?? '—'} detail="Períodos u obligaciones pendientes" tone="cyan" icon={SlidersHorizontal} />
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="flex-1"><label className="text-xs font-semibold text-slate-600">Buscar empresa, NIF o correo</label><div className="mt-1 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" value={searchInput} onChange={event => setSearchInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') updateFilter('search', searchInput); }} placeholder="Nombre, NIF o propietario" /></div><Button variant="outline" onClick={() => updateFilter('search', searchInput)}>Buscar</Button></div></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[620px]">
          <Select value={String(filters.year)} onValueChange={value => updateFilter('year', Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select>
          <Select value={filters.severity} onValueChange={value => updateFilter('severity', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda severidad</SelectItem><SelectItem value="critical">Crítica</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="medium">Media</SelectItem></SelectContent></Select>
          <Select value={filters.category} onValueChange={value => updateFilter('category', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las áreas</SelectItem>{Object.entries(CATEGORY).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          <Select value={String(filters.pageSize)} onValueChange={value => updateFilter('pageSize', Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="12">12 empresas</SelectItem><SelectItem value="24">24 empresas</SelectItem><SelectItem value="50">50 empresas</SelectItem></SelectContent></Select>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">{(savedViews.data?.rows || []).map(view => <div key={view.id} className="flex items-center rounded-full border border-slate-200 bg-slate-50"><button className="px-3 py-1 text-xs font-medium text-slate-700" onClick={() => { setFilters(current => ({ ...current, ...view.filters, page: 1 })); setSearchInput(view.filters?.search || ''); }}>{view.name}</button><button className="border-l border-slate-200 px-2 py-1 text-slate-400 hover:text-red-600" onClick={() => deleteView.mutate(/** @type {any} */ ({ action: 'delete_view', viewId: view.id }))} aria-label={`Eliminar vista ${view.name}`}><Trash2 className="h-3 w-3" /></button></div>)}</div>
        <div className="flex gap-2"><Input className="h-8 w-48 text-xs" value={viewName} onChange={event => setViewName(event.target.value)} placeholder="Nombre de esta vista" /><Button size="sm" variant="outline" disabled={!viewName.trim() || saveView.isPending} onClick={() => saveView.mutate(/** @type {any} */ ({ action: 'save_view', name: viewName, filters: { year: filters.year, search: filters.search, severity: filters.severity, category: filters.category, pageSize: filters.pageSize } }))}><Save className="mr-1 h-3.5 w-3.5" />Guardar filtro</Button></div>
      </div>
    </section>

    {overview.isLoading ? <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-24"><Loader2 className="h-8 w-8 animate-spin text-cyan-600" /></div>
      : overview.isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{overview.error.message}</div>
        : !rows.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center"><Filter className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No hay empresas en este filtro</p><p className="mt-1 text-xs text-slate-500">En perfiles de asesoría, confirma que la empresa tenga el correo del asesor en usuarios autorizados.</p></div>
          : <section className="space-y-3">{rows.map(row => {
            const open = expandedCompany === row.company.id;
            return <article key={row.company.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <button className="min-w-0 text-left" onClick={() => setExpandedCompany(open ? '' : row.company.id)}><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold text-slate-900">{row.company.name}</h2><Badge variant="outline">{row.company.taxId || 'Sin NIF'}</Badge>{row.profile?.status === 'validado_asesor' ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Fiscal validado · v{row.profile.version || 1}</span> : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Perfil fiscal pendiente</span>}</div><p className="mt-1 text-xs text-slate-500">{row.company.ownerEmail || 'Sin correo propietario'}{row.client?.internalOwner ? ` · Responsable: ${row.client.internalOwner}` : ''}</p></button>
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{row.counts.critical} críticas</span><span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{row.counts.high} altas</span><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{row.alerts.length} visibles</span><Button size="sm" variant="outline" onClick={() => openCompanyPath(row, '/tax-accounting/impuestos?tab=configuracion')}>Configurar fiscal</Button><Button size="sm" onClick={() => openCompanyPath(row, '/tax-accounting/dashboard')}>Entrar en empresa</Button></div>
              </div>
              {open && <div className="border-t border-slate-100 bg-slate-50/70 p-4"><div className="mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5"><div className="rounded-lg bg-white p-2"><span className="text-slate-400">Contabilidad</span><p className="font-bold">{row.counts.pendingAccounting}</p></div><div className="rounded-lg bg-white p-2"><span className="text-slate-400">Sin fiscal</span><p className="font-bold">{row.counts.invoicesWithoutTax}</p></div><div className="rounded-lg bg-white p-2"><span className="text-slate-400">555</span><p className="font-bold">{row.counts.suspense555}</p></div><div className="rounded-lg bg-white p-2"><span className="text-slate-400">Modelos</span><p className="font-bold">{row.counts.pendingModels}</p></div><div className="rounded-lg bg-white p-2"><span className="text-slate-400">Incidencias</span><p className="font-bold">{row.counts.incidents}</p></div></div><div className="space-y-2">{row.alerts.length ? row.alerts.map(alert => <AlertRow key={alert.id} alert={alert} onTrace={item => setTraceInput({ companyId: row.company.id, entityType: item.sourceType, entityId: item.sourceId, title: item.title })} onOpen={path => openCompanyPath(row, path)} />) : <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">Sin pendientes en los filtros seleccionados.</p>}</div></div>}
            </article>;
          })}</section>}

    <footer className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span>{pagination.total || 0} empresa(s) · página {pagination.page || 1} de {pagination.totalPages || 1}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={(pagination.page || 1) <= 1} onClick={() => updateFilter('page', (pagination.page || 1) - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button size="sm" variant="outline" disabled={(pagination.page || 1) >= (pagination.totalPages || 1)} onClick={() => updateFilter('page', (pagination.page || 1) + 1)}><ChevronRight className="h-4 w-4" /></Button></div></footer>
    <TraceDrawer input={traceInput} onClose={() => setTraceInput(null)} />
  </div>;
}

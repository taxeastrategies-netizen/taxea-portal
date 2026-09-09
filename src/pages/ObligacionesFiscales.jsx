import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import NoCompanyState from '@/components/ui/NoCompanyState';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CalendarDays, Clock3, FileCheck2, LayoutList, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MODELOS_AEAT } from '@/components/obligaciones/CalendarioAEAT';
import KPIsObligaciones from '@/components/obligaciones/KPIsObligaciones';
import VistaTimeline from '@/components/obligaciones/VistaTimeline';
import ProximosVencimientos from '@/components/obligaciones/ProximosVencimientos';
import CalendarioGeneral from '@/components/obligaciones/CalendarioGeneral';

const TABS = [
  { id: 'proximos', label: 'Próximos vencimientos', icon: Clock3 },
  { id: 'obligaciones', label: 'Mis obligaciones', icon: LayoutList },
  { id: 'calendario', label: 'Calendario individual', icon: CalendarDays },
  { id: 'timeline', label: 'Timeline anual', icon: ShieldCheck },
  { id: 'documentos', label: 'Documentos fiscales', icon: FileCheck2 },
];
const EMPTY_FORM = {
  modelCode: '303', period: 'T1', fiscalYear: new Date().getFullYear(), filingDeadline: '',
  domicileDeadline: '', internalDeadline: '', state: 'pendiente_documentacion', result: 'pendiente',
  amount: '', comments: '', deadlineStatus: 'revisar',
};
const STATE_OPTIONS = [
  ['pendiente_documentacion', 'Pendiente de documentación'], ['en_preparacion', 'En preparación'],
  ['pendiente_revision', 'Pendiente de revisión'], ['revisado', 'Revisado'],
  ['listo_presentar', 'Listo para presentar'], ['presentado', 'Presentado'],
  ['domiciliado', 'Domiciliado'], ['pagado', 'Pagado'], ['finalizado', 'Finalizado'],
  ['rechazado', 'Rechazado'], ['no_aplica', 'No aplica'],
];
const stateLabel = value => STATE_OPTIONS.find(([key]) => key === value)?.[1] || value || 'Pendiente';
const fmt = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-ES') : 'Según supuesto';

export default function ObligacionesFiscales() {
  const { company, user, isAdmin, loadingCompany } = useOutletContext() || {};
  const companyId = company?.id;
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [bundle, setBundle] = useState({ items: [], documents: [], unlinkedDocuments: [], models: [], sources: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('proximos');
  const [filterState, setFilterState] = useState('all');
  const [filterAuthority, setFilterAuthority] = useState('all');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const synced = useRef(new Set());
  const role = String(user?.role || user?.data?.role || '').toLowerCase();
  const canManage = Boolean(isAdmin || ['admin', 'super_admin', 'advisor', 'asesor'].includes(role));

  const load = async ({ synchronize = false, quiet = false } = {}) => {
    if (!companyId) return;
    if (!quiet) setLoading(true);
    try {
      if (synchronize) {
        setSyncing(true);
        const syncResponse = await base44.functions.invoke('fiscalCalendarOperations', { action: 'synchronize', companyId, fiscalYear });
        const sync = syncResponse.data;
        if (!quiet && sync?.success) toast.success(`Calendario sincronizado: ${sync.created} nuevas y ${sync.updated} actualizadas.`);
      }
      const response = await base44.functions.invoke('fiscalCalendarOperations', { action: 'bundle', companyId, fiscalYear });
      setBundle(response.data || { items: [], documents: [], unlinkedDocuments: [], models: [], sources: [] });
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'No se pudo cargar el calendario fiscal.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!companyId) {
      if (!loadingCompany) setLoading(false);
      return;
    }
    const key = `${companyId}:${fiscalYear}`;
    const shouldSync = fiscalYear === currentYear && !synced.current.has(key);
    if (shouldSync) synced.current.add(key);
    load({ synchronize: shouldSync, quiet: true });
  }, [companyId, fiscalYear, loadingCompany]);

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

  const filtered = useMemo(() => bundle.items.filter(item =>
    (filterState === 'all' || item.state === filterState) &&
    (filterAuthority === 'all' || item.authority === filterAuthority)
  ), [bundle.items, filterState, filterAuthority]);

  const openCreate = () => {
    setSelected(null);
    setForm({ ...EMPTY_FORM, fiscalYear });
    setShowForm(true);
  };
  const openItem = item => {
    setSelected(item);
    setForm({
      modelCode: item.code, period: item.period, fiscalYear: item.fiscalYear,
      filingDeadline: item.filingDeadline || '', domicileDeadline: item.domicileDeadline || '',
      internalDeadline: item.internalDeadline || '', state: item.state || 'pendiente_documentacion',
      result: item.result || 'pendiente', amount: item.amount || '', comments: item.comments || '',
      deadlineStatus: item.deadlineStatus || 'revisar',
    });
    setShowForm(true);
  };
  const save = async () => {
    if (!canManage) return;
    if (!form.modelCode || !form.period || !form.filingDeadline) {
      toast.error('Modelo, período y fecha máxima de presentación son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const action = selected?.obligation?.id ? 'save_obligation' : 'create_obligation';
      await base44.functions.invoke('fiscalCalendarOperations', {
        action, companyId, fiscalYear: Number(form.fiscalYear),
        obligationId: selected?.obligation?.id,
        modelCode: form.modelCode, period: form.period,
        fecha_limite_presentacion: form.filingDeadline,
        fecha_limite_domiciliacion: form.domicileDeadline || null,
        fecha_limite_interna: form.internalDeadline || null,
        estado: form.state, resultado: form.result,
        importe: Number(form.amount || 0), comentarios_asesor: form.comments,
        deadline_status: form.deadlineStatus,
      });
      toast.success(selected ? 'Obligación actualizada.' : 'Obligación incorporada al calendario.');
      setShowForm(false);
      await load({ quiet: true });
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'No se pudo guardar la obligación.');
    } finally { setSaving(false); }
  };

  if (loadingCompany && loading) return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!company && !loadingCompany) return <NoCompanyState pageName="Calendario y obligaciones" />;

  return (
    <div>
      <PageHeader title="Calendario y obligaciones" subtitle="Calendario fiscal individual, vencimientos, domiciliaciones y justificantes">
        <div className="flex items-center gap-2">
          <Select value={String(fiscalYear)} onValueChange={value => setFiscalYear(Number(value))}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => load({ synchronize: true })} disabled={syncing}>
            <RefreshCw className={cn('w-4 h-4 mr-2', syncing && 'animate-spin')} />Sincronizar
          </Button>
          {canManage && <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Nueva obligación</Button>}
        </div>
      </PageHeader>

      {bundle.profile && bundle.profile.profileStatus !== 'validado_asesor' && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
          <div><p className="text-sm font-semibold text-amber-900">Perfil fiscal pendiente de validación</p><p className="text-xs text-amber-800 mt-0.5">El calendario refleja lo informado, pero el asesor debe confirmar territorio, actividades, regímenes y obligaciones antes de tomarlo como definitivo.</p></div>
        </div>
      )}
      {!bundle.profile && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
          <div><p className="text-sm font-semibold text-red-900">Falta el perfil fiscal</p><p className="text-xs text-red-800 mt-0.5">No es seguro proponer obligaciones automáticamente hasta completar el Perfil fiscal de Contabilidad.</p></div>
        </div>
      )}

      <KPIsObligaciones obligations={bundle.items} profile={bundle.profile} />

      <div className="flex gap-1 flex-wrap mb-5 bg-secondary/40 border border-border rounded-xl p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors', activeTab === tab.id ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:bg-secondary/60')}><Icon className="w-4 h-4" />{tab.label}</button>;
        })}
      </div>

      {loading ? (
        <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <>
          {activeTab === 'proximos' && <div className="bg-card border border-border rounded-xl p-5"><ProximosVencimientos obligations={bundle.items} onEdit={openItem} /></div>}
          {activeTab === 'calendario' && <CalendarioGeneral obligations={filtered} fiscalYear={fiscalYear} verifiedCalendarYear={bundle.verifiedCalendarYear} sources={bundle.sources} onEdit={openItem} />}
          {activeTab === 'timeline' && <VistaTimeline obligations={filtered} onEdit={openItem} />}
          {activeTab === 'obligaciones' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Select value={filterState} onValueChange={setFilterState}><SelectTrigger className="w-56 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem>{STATE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                <Select value={filterAuthority} onValueChange={setFilterAuthority}><SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">AEAT y ATC</SelectItem><SelectItem value="AEAT">AEAT</SelectItem><SelectItem value="ATC">ATC</SelectItem><SelectItem value="Otro">Otra</SelectItem></SelectContent></Select>
                <span className="self-center text-xs text-muted-foreground">{filtered.length} vencimientos</span>
              </div>
              {filtered.map(item => (
                <button key={item.key} onClick={() => openItem(item)} className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/30">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold', item.authority === 'ATC' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800')}>{item.code}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold">Modelo {item.code} · {item.name}</p><p className="text-xs text-muted-foreground">{item.period} {item.fiscalYear} · {item.authority} · {stateLabel(item.state)}</p></div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-5 text-xs">
                      <div><p className="text-muted-foreground">Domiciliación</p><p className="font-medium">{fmt(item.domicileDeadline)}</p></div>
                      <div><p className="text-muted-foreground">Presentación</p><p className="font-medium">{fmt(item.filingDeadline)}</p></div>
                      <div><p className="text-muted-foreground">Documentos</p><p className="font-medium">{item.documents?.length || 0}</p></div>
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No hay obligaciones que coincidan con los filtros.</div>}
            </div>
          )}
          {activeTab === 'documentos' && (
            <div className="space-y-4">
              {bundle.unlinkedDocuments?.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>{bundle.unlinkedDocuments.length} documento(s) fiscal(es) sin vincular.</strong> El asesor debe indicar modelo, ejercicio y período para evitar asociaciones incorrectas.</div>}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="divide-y divide-border">
                  {bundle.documents.map(doc => (
                    <div key={doc.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                      <FileCheck2 className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{doc.nombre}</p><p className="text-xs text-muted-foreground">{doc.detected?.code ? `Modelo ${doc.detected.code}` : 'Sin modelo'} · {doc.detected?.period || 'Sin período'} · {doc.detected?.fiscalYear || 'Sin ejercicio'} · {doc.fiscal_document_kind || 'Documento fiscal'}</p></div>
                      <span className="text-xs rounded-full bg-slate-100 text-slate-700 px-2 py-1">{doc.estado || 'pendiente'}</span>
                      {doc.archivo_url && <a href={doc.archivo_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Abrir documento</a>}
                    </div>
                  ))}
                  {bundle.documents.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">Todavía no hay documentos fiscales en este perfil.</div>}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected ? `Modelo ${selected.code} · ${selected.period} ${selected.fiscalYear}` : 'Nueva obligación fiscal'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="space-y-1.5"><Label>Modelo</Label><Select value={form.modelCode} onValueChange={value => setForm(prev => ({ ...prev, modelCode: value }))} disabled={Boolean(selected)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent className="max-h-72">{MODELOS_AEAT.map(model => <SelectItem key={model.code} value={model.code}>{model.label} · {model.authority}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Período</Label><Input value={form.period} onChange={event => setForm(prev => ({ ...prev, period: event.target.value }))} disabled={Boolean(selected)} placeholder="T1, M01, ANUAL…" /></div>
            <div className="space-y-1.5"><Label>Fecha máxima de domiciliación</Label><Input type="date" value={form.domicileDeadline || ''} onChange={event => setForm(prev => ({ ...prev, domicileDeadline: event.target.value }))} disabled={!canManage} /></div>
            <div className="space-y-1.5"><Label>Fecha máxima de presentación</Label><Input type="date" value={form.filingDeadline || ''} onChange={event => setForm(prev => ({ ...prev, filingDeadline: event.target.value }))} disabled={!canManage} /></div>
            <div className="space-y-1.5"><Label>Fecha interna del despacho</Label><Input type="date" value={form.internalDeadline || ''} onChange={event => setForm(prev => ({ ...prev, internalDeadline: event.target.value }))} disabled={!canManage} /></div>
            <div className="space-y-1.5"><Label>Estado</Label><Select value={form.state} onValueChange={value => setForm(prev => ({ ...prev, state: value }))} disabled={!canManage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Resultado</Label><Select value={form.result} onValueChange={value => setForm(prev => ({ ...prev, result: value }))} disabled={!canManage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pendiente">Pendiente</SelectItem><SelectItem value="a_pagar">A pagar</SelectItem><SelectItem value="a_devolver">A devolver</SelectItem><SelectItem value="a_compensar">A compensar</SelectItem><SelectItem value="cero">Cero</SelectItem><SelectItem value="informativo">Informativo</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Importe</Label><Input type="number" step="0.01" value={form.amount} onChange={event => setForm(prev => ({ ...prev, amount: event.target.value }))} disabled={!canManage} /></div>
            <div className="md:col-span-2 space-y-1.5"><Label>Comentarios del asesor</Label><Textarea value={form.comments} onChange={event => setForm(prev => ({ ...prev, comments: event.target.value }))} disabled={!canManage} rows={3} /></div>
          </div>
          {selected?.documents?.length > 0 && <div className="mt-4 rounded-xl border border-border p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Documentos vinculados</p>{selected.documents.map(doc => <a key={doc.id} href={doc.archivo_url} target="_blank" rel="noreferrer" className="block text-sm text-primary hover:underline py-1">{doc.nombre}</a>)}</div>}
          <div className="flex justify-end gap-2 mt-5"><Button variant="outline" onClick={() => setShowForm(false)}>Cerrar</Button>{canManage && <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


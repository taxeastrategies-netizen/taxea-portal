import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { BellRing, BookmarkPlus, RefreshCw, Trash2 } from 'lucide-react';

const labelFor = (kind, criteria) => {
  const place = criteria.province || criteria.communityName || 'España';
  const topic = criteria.query || criteria.topic || criteria.cpv || 'todas las actividades';
  return (kind === 'grant' ? 'Ayudas' : 'Licitaciones') + ' · ' + place + ' · ' + topic;
};

export default function OpportunityWatchPanel({ kind, criteria, onApply }) {
  const { company, user } = useOutletContext() || {};
  const companyId = company?.id;
  const [watches, setWatches] = useState([]);
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const identityRef = useRef('');
  const identity = `${companyId || ''}:${kind}`;
  identityRef.current = identity;
  const load = async () => {
    if (!companyId) return;
    const requested = identity;
    try {
      const rows = await base44.entities.OpportunityWatch.filter({ company_id: companyId, kind }, '-created_date', 30);
      if (identityRef.current === requested) setWatches(rows || []);
    } catch (caught) { if (identityRef.current === requested) setError(caught?.message || 'No se pudieron cargar las búsquedas guardadas.'); }
  };
  useEffect(() => { setWatches([]); setResults({}); setError(''); load(); }, [companyId, kind]);
  const save = async () => {
    if (!companyId || busy || watches.length >= 10) return;
    const key = JSON.stringify(criteria);
    if (watches.some(row => JSON.stringify(row.criteria || {}) === key)) { setError('Esta búsqueda ya está guardada.'); return; }
    setBusy('save'); setError('');
    try {
      await base44.entities.OpportunityWatch.create({ company_id: companyId, kind, title: labelFor(kind, criteria), criteria, created_by: user?.email || '', enabled: true });
      await load();
    } catch (caught) { setError(caught?.message || 'No se pudo guardar la búsqueda.'); }
    finally { setBusy(''); }
  };
  const check = async watch => {
    if (busy) return;
    setBusy(watch.id); setError('');
    const requested = identity;
    try {
      const saved = watch.criteria || {};
      const params = kind === 'grant'
        ? { communityCode: saved.communityCode || '', province: saved.province || '', applicant: saved.applicant || 'all', topic: saved.topic || 'all', finality: saved.finality || '', administration: saved.administration || '', query: saved.query || '', status: 'all', page: 0 }
        : { kind: 'all', query: saved.query || '', cpv: saved.cpv || '', contractType: saved.contractType || '', communityCode: saved.communityCode || '', provinceCode: saved.provinceCode || '', minAmount: saved.minAmount || '', maxAmount: saved.maxAmount || '' };
      const response = await base44.functions.invoke(kind === 'grant' ? 'searchGrants' : 'searchTenders', params);
      const payload = response?.data || response;
      if (!payload?.ok) throw new Error(payload?.error || 'La fuente oficial no respondió.');
      const rows = (kind === 'grant' ? payload.grants || [] : payload.tenders || []).filter(row => kind === 'grant' ? ['open', 'upcoming'].includes(row.status) : ['abierta', 'anuncio_previo', 'consulta'].includes(row.kind));
      const signatures = Object.fromEntries(rows.slice(0, 200).map(row => [String(row.id), [row.updatedAt || row.publishedAt || '', row.deadline || row.endDate || '', row.status || row.kind || ''].join('|')]));
      const seen = watch.seen_signatures || {};
      const updated = rows.filter(row => !watch.last_checked_at || seen[String(row.id)] !== signatures[String(row.id)]);
      if (identityRef.current === requested) setResults(prev => ({ ...prev, [watch.id]: { rows, updated, signatures, checkedAt: new Date().toISOString(), partial: Boolean(payload.partial), examined: payload.examinedEntries || payload.attemptedDetails || 0 } }));
    } catch (caught) { setError(caught?.response?.data?.error || caught?.message || 'No se pudo comprobar la búsqueda.'); }
    finally { setBusy(''); }
  };
  const markRead = async watch => {
    const result = results[watch.id];
    if (!result || busy) return;
    setBusy(watch.id);
    try {
      await base44.entities.OpportunityWatch.update(watch.id, { last_checked_at: result.checkedAt, seen_signatures: { ...(watch.seen_signatures || {}), ...result.signatures } });
      setResults(prev => ({ ...prev, [watch.id]: { ...prev[watch.id], updated: [] } }));
      await load();
    } catch (caught) { setError(caught?.message || 'No se pudo marcar como revisada.'); }
    finally { setBusy(''); }
  };
  const remove = async watch => {
    if (busy || !window.confirm('¿Eliminar solo esta búsqueda guardada? No se borran convocatorias ni expedientes.')) return;
    setBusy(watch.id);
    try { await base44.entities.OpportunityWatch.delete(watch.id); await load(); }
    catch (caught) { setError(caught?.message || 'No se pudo eliminar la búsqueda.'); }
    finally { setBusy(''); }
  };
  if (!companyId) return null;
  return <section className="rounded-2xl border border-border bg-card p-5" aria-label="Radar personalizado">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-jakarta text-base font-bold"><BellRing className="h-4 w-4 text-taxea-red" />Mi radar personalizado</h2><p className="mt-1 text-xs text-muted-foreground">Guarda filtros y comprueba coincidencias oficiales sin importar expedientes a Taxea.</p></div><button type="button" onClick={save} disabled={!!busy || watches.length >= 10} className="flex items-center gap-1.5 rounded-lg bg-taxea-red px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><BookmarkPlus className="h-4 w-4" />Guardar búsqueda actual</button></div>
    {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    <div className="mt-4 grid gap-3 md:grid-cols-2">{watches.map(watch => { const result = results[watch.id]; return <div key={watch.id} className="rounded-xl border border-border bg-background p-4">
      <p className="text-sm font-semibold">{watch.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{watch.last_checked_at ? 'Revisada: ' + new Date(watch.last_checked_at).toLocaleString('es-ES') : 'Aún no revisada'}</p>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onApply?.(watch.criteria || {})} className="rounded-lg border border-border px-2.5 py-1.5 text-xs">Abrir filtros</button><button type="button" onClick={() => check(watch)} disabled={!!busy} className="flex items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1.5 text-xs text-cyan-900 disabled:opacity-50"><RefreshCw className={'h-3.5 w-3.5 ' + (busy === watch.id ? 'animate-spin' : '')} />Comprobar</button>{result && <button type="button" onClick={() => markRead(watch)} disabled={!!busy} className="rounded-lg border border-border px-2.5 py-1.5 text-xs">Marcar revisada</button>}<button type="button" onClick={() => remove(watch)} disabled={!!busy} aria-label={'Eliminar ' + watch.title} className="rounded-lg border border-border p-1.5 text-slate-500 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button></div>
      {result && <div className="mt-3 text-xs"><p className="font-semibold">{result.rows.length} coincidencia(s) en las páginas examinadas{watch.last_checked_at ? ' · ' + result.updated.length + ' publicadas o actualizadas desde la última revisión' : ''}</p>{result.partial && <p className="mt-1 text-amber-700">Fuente parcial: repite la consulta antes de decidir.</p>}<div className="mt-2 space-y-1">{result.rows.slice(0, 4).map(row => <a key={row.id} href={row.sourceUrl || row.url} target="_blank" rel="noopener noreferrer" className="block truncate text-taxea-red hover:underline">{row.title}</a>)}</div></div>}
    </div>; })}{!watches.length && <p className="text-xs text-muted-foreground">Aún no tienes búsquedas guardadas. Ajusta filtros y pulsa «Guardar búsqueda actual».</p>}</div>
    <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Las alertas son dentro del portal y se calculan al pulsar «Comprobar». No son un rastreo continuo ni certifican cobertura completa de la BDNS o PLACSP. Verifica siempre requisitos y plazos en el enlace oficial.</p>
  </section>;
}

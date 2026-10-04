import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import OpportunityWatchPanel from '@/components/OpportunityWatchPanel';
import { ArrowUpRight, BellRing, BriefcaseBusiness, CalendarClock, ChevronDown, CircleAlert, FileSearch2, Filter, Landmark, MapPinned, RefreshCw, Search, ShieldCheck, Sparkles } from 'lucide-react';

const GEOJSON_URL = '/data/spain-provinces.geojson';
const COMMUNITIES = [
  { ine: '01', code: 'ES61', name: 'Andalucía' }, { ine: '02', code: 'ES24', name: 'Aragón' },
  { ine: '03', code: 'ES53', name: 'Illes Balears' }, { ine: '04', code: 'ES70', name: 'Canarias' },
  { ine: '05', code: 'ES13', name: 'Cantabria' }, { ine: '06', code: 'ES42', name: 'Castilla-La Mancha' },
  { ine: '07', code: 'ES41', name: 'Castilla y León' }, { ine: '08', code: 'ES51', name: 'Cataluña' },
  { ine: '09', code: 'ES63', name: 'Ceuta' }, { ine: '10', code: 'ES43', name: 'Extremadura' },
  { ine: '11', code: 'ES11', name: 'Galicia' }, { ine: '12', code: 'ES23', name: 'La Rioja' },
  { ine: '13', code: 'ES30', name: 'Comunidad de Madrid' }, { ine: '14', code: 'ES64', name: 'Melilla' },
  { ine: '15', code: 'ES62', name: 'Región de Murcia' }, { ine: '16', code: 'ES22', name: 'Navarra' },
  { ine: '17', code: 'ES21', name: 'País Vasco' }, { ine: '18', code: 'ES12', name: 'Asturias' },
  { ine: '19', code: 'ES52', name: 'Comunitat Valenciana' },
];
const PROVINCES = '01:17:Araba/Álava|02:06:Albacete|03:19:Alacant/Alicante|04:01:Almería|05:07:Ávila|06:10:Badajoz|07:03:Illes Balears|08:08:Barcelona|09:07:Burgos|10:10:Cáceres|11:01:Cádiz|12:19:Castelló/Castellón|13:06:Ciudad Real|14:01:Córdoba|15:11:A Coruña|16:06:Cuenca|17:08:Girona|18:01:Granada|19:06:Guadalajara|20:17:Gipuzkoa|21:01:Huelva|22:02:Huesca|23:01:Jaén|24:07:León|25:08:Lleida|26:12:La Rioja|27:11:Lugo|28:13:Madrid|29:01:Málaga|30:15:Murcia|31:16:Navarra|32:11:Ourense|33:18:Asturias|34:07:Palencia|35:04:Las Palmas|36:11:Pontevedra|37:07:Salamanca|38:04:Santa Cruz de Tenerife|39:05:Cantabria|40:07:Segovia|41:01:Sevilla|42:07:Soria|43:08:Tarragona|44:02:Teruel|45:06:Toledo|46:19:València/Valencia|47:07:Valladolid|48:17:Bizkaia|49:07:Zamora|50:02:Zaragoza|51:09:Ceuta|52:14:Melilla'.split('|').map(item => { const [code, ine, name] = item.split(':'); return { code, ine, name }; });
const TABS = [{ id: 'all', label: 'Todas las oportunidades' }, { id: 'abierta', label: 'Licitaciones abiertas' }, { id: 'anuncio_previo', label: 'Anuncios previos' }, { id: 'consulta', label: 'Consultas preliminares' }];
const TYPES = ['Suministros', 'Servicios', 'Obras', 'Concesión de obras', 'Concesión de servicios', 'Administrativo especial', 'Privado'];
const badgeStyle = { abierta: 'border-emerald-300 bg-emerald-50 text-emerald-800', anuncio_previo: 'border-cyan-300 bg-cyan-50 text-cyan-800', consulta: 'border-amber-300 bg-amber-50 text-amber-800' };
const kindLabel = { abierta: 'Plazo abierto', anuncio_previo: 'Anuncio previo', consulta: 'Consulta preliminar' };
const fmtDate = value => value ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value + 'T12:00:00Z')) : 'No consta';
const fmtMoney = value => value == null ? 'No publicado' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function TenderCard({ row }) {
  return <article className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className={'rounded-full border px-3 py-1 text-[11px] font-bold ' + badgeStyle[row.kind]}>{kindLabel[row.kind]}</span>
      <span className="text-[11px] text-muted-foreground">{row.updatedAt ? 'Actualizada ' + fmtDate(row.updatedAt.slice(0, 10)) : 'Fecha no indicada'}</span>
    </div>
    <h3 className="mt-4 font-jakarta text-base font-bold leading-snug text-foreground">{row.title}</h3>
    <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"><Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" />{row.contractingBody || 'Órgano no estructurado en esta ficha'}</p>
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-secondary/40 p-3 text-xs sm:grid-cols-3">
      <div><span className="block text-muted-foreground">{row.kind === 'abierta' ? 'Fin de ofertas' : row.kind === 'consulta' ? 'Fin de consulta' : 'Plazo de ofertas'}</span><strong className="mt-1 block">{fmtDate(row.kind === 'abierta' ? row.deadline : row.kind === 'consulta' ? row.consultationLimit : null)}{row.kind === 'abierta' && row.deadlineTime ? ' · ' + row.deadlineTime : ''}</strong></div>
      <div><span className="block text-muted-foreground">Importe sin IVA</span><strong className="mt-1 block">{fmtMoney(row.amountExVat)}</strong></div>
      <div className="col-span-2 sm:col-span-1"><span className="block text-muted-foreground">Localización</span><strong className="mt-1 block">{row.province || 'No precisada'}</strong></div>
    </div>
    <div className="mt-3 flex flex-wrap gap-1.5">
      <span className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground">{row.contractType}</span>
      {row.cpv.slice(0, 3).map(code => <span key={code} className="rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground">CPV {code}</span>)}
    </div>
    <details className="mt-4 rounded-xl border border-border bg-background open:shadow-inner">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold text-taxea-red">Resumen del expediente <ChevronDown className="h-4 w-4" /></summary>
      <div className="space-y-3 border-t border-border px-4 py-4 text-xs leading-relaxed text-muted-foreground">
        <p>{row.summary}</p>
        <p><strong className="text-foreground">Identificador:</strong> {row.tenderId || row.id}</p>
        <p><strong className="text-foreground">CPV:</strong> {row.cpv.length ? row.cpv.join(', ') : 'No estructurado'}</p>
        <p><strong className="text-foreground">Valor estimado:</strong> {fmtMoney(row.estimatedValue)}. El importe mostrado no equivale necesariamente al presupuesto licitable; verifica pliegos y lotes.</p>
        {row.kind === 'consulta' && <p>La fecha indicada pertenece a la consulta de mercado, no garantiza cuándo se abrirá una licitación.{row.plannedDate ? ' Hito previsto de la consulta: ' + fmtDate(row.plannedDate) + '.' : ''}</p>}
        {row.kind === 'anuncio_previo' && <p>No consta una fecha confirmada de apertura de ofertas dentro de los próximos seis meses.</p>}
      </div>
    </details>
    <a href={row.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-taxea-red hover:underline">Ver expediente publicado en la fuente oficial <ArrowUpRight className="h-4 w-4" /></a>
  </article>;
}
export default function PublicTenders() {
  const [geo, setGeo] = useState(null);
  const [mapError, setMapError] = useState(false);
  const [community, setCommunity] = useState('');
  const [province, setProvince] = useState('');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [cpv, setCpv] = useState('');
  const [contractType, setContractType] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [kind, setKind] = useState('abierta');
  const [pages, setPages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [requestCursor, setRequestCursor] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [show, setShow] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch(GEOJSON_URL).then(r => { if (!r.ok) throw new Error('mapa'); return r.json(); }).then(value => { if (active) { if (value?.features?.length === 52) setGeo(value); else setMapError(true); } }).catch(() => { if (active) setMapError(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const timer = setTimeout(() => base44.functions.invoke('searchTenders', { kind, query, cpv, contractType, communityCode: community?.code || '', provinceCode: province, minAmount, maxAmount, cursor: requestCursor })
      .then(result => {
        if (!active) return;
        const value = result?.data || result;
        if (!value?.ok) throw new Error(value?.error || 'No se pudieron consultar las licitaciones.');
        setPages(previous => requestCursor ? [...previous, value] : [value]);
        setCursor(value.nextCursor);
      })
      .catch(err => { if (active) setError(err?.response?.data?.error || err?.message || 'No se pudieron consultar las licitaciones.'); })
      .finally(() => { if (active) setLoading(false); }), 350);
    return () => { active = false; clearTimeout(timer); };
  }, [kind, query, cpv, contractType, community, province, minAmount, maxAmount, requestCursor, refresh]);
  const reset = () => { setPages([]); setCursor(null); setRequestCursor(null); setShow(24); setRefresh(v => v + 1); };
  const selectCommunity = (value, selectedProvince = '') => { setCommunity(value); setProvince(selectedProvince); reset(); };
  const applySavedSearch = saved => {
    setCommunity(COMMUNITIES.find(item => item.code === saved.communityCode) || '');
    setProvince(saved.provinceCode || ''); setDraft(saved.query || ''); setQuery(saved.query || '');
    setCpv(saved.cpv || ''); setContractType(saved.contractType || '');
    setMinAmount(saved.minAmount || ''); setMaxAmount(saved.maxAmount || '');
    setKind('all'); reset();
  };
  const options = useMemo(() => PROVINCES.filter(item => !community || item.ine === community.ine).sort((a, b) => a.name.localeCompare(b.name, 'es')), [community]);
  const rows = useMemo(() => Array.from(new Map(pages.flatMap(item => item.tenders || []).map(row => [row.id, row])).values()), [pages]);
  const counts = useMemo(() => ({ abierta: rows.filter(row => row.kind === 'abierta').length, anuncio_previo: rows.filter(row => row.kind === 'anuncio_previo').length, consulta: rows.filter(row => row.kind === 'consulta').length }), [rows]);
  const examined = pages.reduce((sum, item) => sum + (item.examinedEntries || 0), 0);
  const partial = pages.some(item => item.partial);
  const fetchedAt = Object.values(pages.at(-1)?.fetchedAt || {}).filter(Boolean).sort()[0];
  const stale = pages.some(item => item.stale);
  const uncached = pages.some(item => item.uncachedSources?.length);
  const chooseProvince = feature => {
    const value = COMMUNITIES.find(item => item.ine === feature.properties.cod_ccaa);
    if (value) selectCommunity(value, PROVINCES.find(item => item.ine === value.ine && normal(item.name).split('/').some(name => name === normal(feature.properties.name)))?.code || '');
  };
  const mapStyle = feature => {
    const selectedName = PROVINCES.find(item => item.code === province)?.name || '';
    const selected = province ? normal(selectedName).split('/').some(name => name === normal(feature.properties.name)) && community?.ine === feature.properties.cod_ccaa : community?.ine === feature.properties.cod_ccaa;
    return { color: selected ? '#e22c43' : '#ffffff', weight: selected ? 2 : 1, fillColor: selected ? '#e22c43' : community?.ine === feature.properties.cod_ccaa ? '#22d3ee' : '#254463', fillOpacity: selected ? 0.85 : 0.68 };
  };
  return <main className="mx-auto max-w-7xl space-y-7 px-4 py-7 md:px-7">
    <section className="relative overflow-hidden rounded-[28px] border border-cyan-500/20 bg-[#071425] p-7 text-white shadow-2xl md:p-10">
      <div className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-44 w-44 rounded-full bg-rose-500/20 blur-3xl" />
      <div className="relative z-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-200"><Sparkles className="h-3.5 w-3.5" /> Radar de contratación pública</span>
        <h1 className="mt-4 max-w-3xl font-jakarta text-3xl font-extrabold tracking-tight md:text-5xl">Licitaciones y<br/><span className="text-cyan-300">contratos públicos</span></h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">Encuentra oportunidades reales de contratación en España. Filtra por territorio, CPV, tipo e importe, consulta el expediente y verifica sus pliegos en la fuente oficial.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px] text-slate-300"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Datos abiertos oficiales PLACSP</span><span>Fuentes oficiales · renovación programada cada 30 min</span>{fetchedAt && <span>Última actualización: {new Date(fetchedAt).toLocaleString('es-ES')}</span>}</div>
      </div>
    </section>
    <div className="grid gap-4 sm:grid-cols-3">
      {[
        { icon: BriefcaseBusiness, value: counts.abierta, label: 'Abiertas en páginas examinadas', color: 'text-emerald-600' },
        { icon: BellRing, value: counts.anuncio_previo, label: 'Anuncios previos encontrados', color: 'text-cyan-600' },
        { icon: CalendarClock, value: counts.consulta, label: 'Consultas preliminares encontradas', color: 'text-amber-600' },
      ].map(item => <div key={item.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><item.icon className={'h-5 w-5 ' + item.color} /><p className="mt-3 font-jakarta text-3xl font-extrabold">{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.label}</p></div>)}
    </div>
    <OpportunityWatchPanel kind="tender" criteria={{ communityCode: community?.code || '', communityName: community?.name || '', provinceCode: province, query, cpv, contractType, minAmount, maxAmount }} onApply={applySavedSearch} />
    <div className="grid gap-5 xl:grid-cols-[minmax(310px,0.92fr)_minmax(0,1.08fr)]">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="flex items-center gap-2 font-jakarta text-sm font-bold"><MapPinned className="h-4 w-4 text-taxea-red" />Mapa de oportunidades</h2><span className="text-xs text-muted-foreground">Selecciona provincia</span></div>
        {geo ? <div className="h-[420px]"><MapContainer center={[38, -4]} zoom={5} minZoom={4} maxZoom={9} maxBounds={[[25, -20], [46, 7]]} scrollWheelZoom={false} className="h-full w-full" style={{ background: '#d7e6ef' }}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><GeoJSON key={(community?.code || 'all') + province} data={geo} style={mapStyle} onEachFeature={(feature, layer) => { layer.bindTooltip(feature.properties.name); layer.on('click', () => chooseProvince(feature)); }} /></MapContainer></div> : <div className="flex h-[420px] items-center justify-center p-7 text-center text-sm text-muted-foreground">{mapError ? 'Mapa no disponible. Usa los selectores geográficos.' : 'Cargando mapa…'}</div>}
        <p className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">El mapa filtra por lugar de ejecución cuando la ficha lo informa; no restringe quién puede licitar. Geometría: <a href="https://github.com/codeforgermany/click_that_hood" target="_blank" rel="noopener noreferrer" className="underline">Click That Hood (MIT)</a>.</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="flex items-center gap-2 font-jakarta text-sm font-bold"><Filter className="h-4 w-4 text-taxea-red" />Filtros de búsqueda</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold">Comunidad autónoma<select value={community?.ine || ''} onChange={e => selectCommunity(COMMUNITIES.find(item => item.ine === e.target.value) || '')} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"><option value="">Toda España</option>{COMMUNITIES.map(item => <option key={item.ine} value={item.ine}>{item.name}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-semibold">Provincia<select value={province} disabled={!community} onChange={e => { setProvince(e.target.value); reset(); }} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-50"><option value="">Todas las provincias</option>{options.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-semibold">Tipo de contrato<select value={contractType} onChange={e => { setContractType(e.target.value); reset(); }} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"><option value="">Todos los tipos</option>{TYPES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-semibold">Código CPV<input value={cpv} onChange={e => { if (/^\d{0,8}$/.test(e.target.value)) { setCpv(e.target.value); reset(); } }} placeholder="Ej.: 72000000" inputMode="numeric" maxLength={8} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" /></label>
          <label className="space-y-1.5 text-xs font-semibold">Importe mínimo sin IVA (€)<input value={minAmount} onChange={e => { setMinAmount(e.target.value); reset(); }} type="number" min="0" placeholder="Sin mínimo" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" /></label>
          <label className="space-y-1.5 text-xs font-semibold">Importe máximo sin IVA (€)<input value={maxAmount} onChange={e => { setMaxAmount(e.target.value); reset(); }} type="number" min="0" placeholder="Sin máximo" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" /></label>
        </div>
        <form onSubmit={e => { e.preventDefault(); setQuery(draft.trim()); reset(); }} className="mt-4"><label htmlFor="tender-query" className="text-xs font-semibold">Actividad, órgano, expediente o palabra clave</label><div className="mt-1.5 flex gap-2"><input id="tender-query" value={draft} onChange={e => setDraft(e.target.value)} maxLength={100} placeholder="Ej.: software, construcción, formación" className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm" /><button type="submit" aria-label="Buscar licitaciones" className="rounded-xl bg-taxea-red px-4 text-white hover:brightness-110"><Search className="h-4 w-4" /></button></div></form>
        <div className="mt-5 rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 text-xs leading-relaxed text-slate-700"><strong>Horizonte de seis meses:</strong> se destacan únicamente fechas que constan en los datos oficiales. Un anuncio previo o una consulta puede anticipar contratación, pero no implica que las ofertas se abran dentro de ese plazo.</div>
      </section>
    </div>
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="flex items-center gap-2 font-jakarta text-xl font-bold"><FileSearch2 className="h-5 w-5 text-taxea-red" />Expedientes encontrados</h2><p className="mt-1 text-xs text-muted-foreground">{examined} registros oficiales examinados en esta búsqueda · {rows.length} {rows.length === 1 ? 'coincidencia visible' : 'coincidencias visibles'}. No son totales nacionales.</p></div><button onClick={reset} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"><RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />Actualizar</button></div>
      <div className="mt-4 flex flex-wrap gap-2">{TABS.map(tab => <button key={tab.id} onClick={() => { setKind(tab.id); reset(); }} className={'rounded-full border px-3 py-2 text-xs font-semibold transition-colors ' + (kind === tab.id ? 'border-taxea-red bg-taxea-red text-white' : 'border-border bg-card text-muted-foreground hover:text-foreground')}>{tab.label}</button>)}</div>
      {error && <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><CircleAlert className="h-4 w-4 shrink-0" />{error}</div>}
      {partial && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">Una fuente oficial no respondió. La lista es parcial; vuelve a actualizar para completar la búsqueda.</div>}
      {stale && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">Los datos de alguna fuente tienen más de 90 minutos. Comprueba plazo y estado en el expediente oficial antes de actuar.</div>}
      {uncached && <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">Hay resultados oficiales, pero no se pudo actualizar la copia temporal de una fuente. La siguiente búsqueda puede tardar más.</div>}
      {loading && !rows.length && <p className="mt-6 text-sm text-muted-foreground">Cargando oportunidades recientes de las fuentes oficiales… La primera carga puede tardar mientras se prepara la copia temporal.</p>}
      {!loading && !error && !rows.length && <div className="mt-5 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Sin coincidencias en las páginas examinadas. Cambia los filtros o sigue consultando páginas oficiales.</div>}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">{rows.slice(0, show).map(row => <TenderCard key={row.id} row={row} />)}</div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">{show < rows.length && <button onClick={() => setShow(value => value + 24)} className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold hover:bg-secondary">Mostrar más resultados cargados</button>}{cursor && <button disabled={loading} onClick={() => setRequestCursor(cursor)} className="rounded-xl bg-taxea-red px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{loading ? 'Consultando…' : 'Buscar en más páginas oficiales'}</button>}</div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Fuente: datos abiertos de la Plataforma de Contratación del Sector Público (perfiles alojados, plataformas agregadas y consultas preliminares). Se guarda temporalmente la primera página Atom de cada fuente oficial y tiene renovación programada cada 30 minutos; las páginas adicionales se consultan en directo. No se importan ni almacenan expedientes completos de contratación. Los filtros se aplican a las páginas examinadas, no a todo el histórico. Comprueba plazo, pliegos, lotes, solvencia y trámites en el expediente original. <a className="font-semibold text-taxea-red hover:underline" target="_blank" rel="noopener noreferrer" href="https://contrataciondelestado.es/wps/portal/plataforma/buscadores/busqueda/">Abrir buscador oficial completo <ArrowUpRight className="inline h-3.5 w-3.5" /></a></p>
    </section>
  </main>;
}
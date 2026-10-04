import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import OpportunityWatchPanel from '@/components/OpportunityWatchPanel';
import { MapPinned, Search, RefreshCw, ArrowUpRight, Sparkles, AlertCircle, SlidersHorizontal, Mail, ShieldCheck } from 'lucide-react';

const GEOJSON_URL = '/data/spain-provinces.geojson';
const COMMUNITIES = [
  { ine: '01', code: 'ES61', name: 'Andalucía' },
  { ine: '02', code: 'ES24', name: 'Aragón' },
  { ine: '03', code: 'ES53', name: 'Illes Balears' },
  { ine: '04', code: 'ES70', name: 'Canarias' },
  { ine: '05', code: 'ES13', name: 'Cantabria' },
  { ine: '06', code: 'ES42', name: 'Castilla-La Mancha' },
  { ine: '07', code: 'ES41', name: 'Castilla y León' },
  { ine: '08', code: 'ES51', name: 'Cataluña' },
  { ine: '09', code: 'ES63', name: 'Ceuta' },
  { ine: '10', code: 'ES43', name: 'Extremadura' },
  { ine: '11', code: 'ES11', name: 'Galicia' },
  { ine: '12', code: 'ES23', name: 'La Rioja' },
  { ine: '13', code: 'ES30', name: 'Comunidad de Madrid' },
  { ine: '14', code: 'ES64', name: 'Melilla' },
  { ine: '15', code: 'ES62', name: 'Región de Murcia' },
  { ine: '16', code: 'ES22', name: 'Navarra' },
  { ine: '17', code: 'ES21', name: 'País Vasco' },
  { ine: '18', code: 'ES12', name: 'Asturias' },
  { ine: '19', code: 'ES52', name: 'Comunitat Valenciana' },
];
const PROVINCES = '01:17:Araba/Álava|02:06:Albacete|03:19:Alacant/Alicante|04:01:Almería|05:07:Ávila|06:10:Badajoz|07:03:Illes Balears|08:08:Barcelona|09:07:Burgos|10:10:Cáceres|11:01:Cádiz|12:19:Castelló/Castellón|13:06:Ciudad Real|14:01:Córdoba|15:11:A Coruña|16:06:Cuenca|17:08:Girona|18:01:Granada|19:06:Guadalajara|20:17:Gipuzkoa/Guipúzcoa|21:01:Huelva|22:02:Huesca|23:01:Jaén|24:07:León|25:08:Lleida|26:12:La Rioja|27:11:Lugo|28:13:Madrid|29:01:Málaga|30:15:Murcia|31:16:Navarra|32:11:Ourense|33:18:Asturias|34:07:Palencia|35:04:Las Palmas|36:11:Pontevedra|37:07:Salamanca|38:04:Santa Cruz De Tenerife|39:05:Cantabria|40:07:Segovia|41:01:Sevilla|42:07:Soria|43:08:Tarragona|44:02:Teruel|45:06:Toledo|46:19:València/Valencia|47:07:Valladolid|48:17:Bizkaia/Vizcaya|49:07:Zamora|50:02:Zaragoza|51:09:Ceuta|52:14:Melilla'.split('|').map(row => { const [code, ine, name] = row.split(':'); return { code, ine, name }; });
const OFFICIAL_FINALITIES = [
  [8, 'Vivienda y edificación'], [12, 'Agricultura, pesca y alimentación'], [14, 'Comercio, turismo y pymes'], [11, 'Cultura'], [7, 'Desempleo'], [10, 'Educación'], [6, 'Fomento del empleo'], [13, 'Industria y energía'], [16, 'Infraestructuras'], [17, 'Investigación, desarrollo e innovación'], [18, 'Otras actuaciones económicas'], [4, 'Otras prestaciones económicas'], [9, 'Sanidad'], [5, 'Servicios sociales'], [15, 'Transporte'], [20, 'Cooperación internacional y cultural'], [1, 'Justicia'], [2, 'Defensa'], [3, 'Seguridad ciudadana'], [19, 'Sin información específica'], [21, 'Información no disponible'],
];
const STATUS = {
  open: { label: 'Abierta', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  upcoming: { label: 'Próxima · apertura confirmada', className: 'bg-cyan-500/15 text-cyan-800 border-cyan-500/30' },
  announced: { label: 'Plazo por verificar', className: 'bg-amber-500/15 text-amber-800 border-amber-500/30' },
  later: { label: 'A más de 6 meses', className: 'bg-blue-500/15 text-blue-800 border-blue-500/30' },
  closed: { label: 'Cerrada', className: 'bg-slate-500/15 text-slate-700 border-slate-500/30' },
};
const formatDate = value => value ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value + 'T12:00:00Z')) : 'No indicada';
function StatusBadge({ status }) {
  const item = STATUS[status] || STATUS.announced;
  return <span className={'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ' + item.className}>{item.label}</span>;
}
function GrantCard({ item }) {
  const subject = encodeURIComponent('Consulta sobre ayuda BDNS ' + item.id);
  const body = encodeURIComponent('Hola, me interesa esta ayuda y quisiera confirmar si puedo solicitarla:\n\n' + item.title + '\n' + item.sourceUrl + '\n\n');
  const audience = item.beneficiaries?.length ? item.beneficiaries.join(' · ') : 'No especificado en la ficha estructurada';
  const period = [item.opensAt ? 'Desde ' + formatDate(item.opensAt) : item.startNote ? 'Inicio: ' + item.startNote : null, item.closesAt ? 'Hasta ' + formatDate(item.closesAt) : item.endNote ? 'Fin: ' + item.endNote : null].filter(Boolean).join(' · ') || 'Sin fechas estructuradas; comprobar convocatoria';
  const benefit = [item.purpose && 'Finalidad: ' + item.purpose, item.instruments?.length && 'Modalidad: ' + item.instruments.join(' · ')].filter(Boolean).join('. ') || 'El beneficio concreto debe consultarse en las bases';
  return <article className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <StatusBadge status={item.status} />
      <span className="text-[11px] text-muted-foreground">BDNS {item.id} · {item.publishedAt ? formatDate(item.publishedAt) : 'sin fecha'}</span>
    </div>
    <h3 className="mt-3 font-jakarta text-base font-bold leading-snug text-foreground">{item.title}</h3>
    <p className="mt-2 text-xs text-muted-foreground">{item.administration || item.scope || 'Administración pública'}{item.scope && item.administration ? ' · ' + item.scope : ''}</p>
    {item.purpose && <p className="mt-3 text-xs text-muted-foreground">Finalidad: {item.purpose}</p>}
    <details className="group mt-4 rounded-xl border border-border bg-secondary/30 open:bg-background">
      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-bold text-taxea-red marker:hidden">Ver resumen, requisitos y enlaces oficiales <span aria-hidden="true" className="float-right transition-transform group-open:rotate-180">⌄</span></summary>
      <div className="space-y-4 border-t border-border px-4 py-4 text-xs leading-relaxed">
        <dl className="grid gap-3">
          <div><dt className="font-bold text-foreground">Periodo de solicitud</dt><dd className="mt-1 text-muted-foreground">{period}{item.notice?.period && <span className="mt-1 block">Extracto oficial: {item.notice.period}</span>}</dd></div>
          <div><dt className="font-bold text-foreground">A quién va dirigida</dt><dd className="mt-1 text-muted-foreground">Categoría BDNS: {audience}{item.notice?.audience && <span className="mt-1 block">Beneficiarios según extracto oficial: {item.notice.audience}</span>}</dd></div>
          <div><dt className="font-bold text-foreground">Qué ofrece</dt><dd className="mt-1 text-muted-foreground">{benefit}{item.budget != null ? '. Presupuesto total de la convocatoria: ' + new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(item.budget) + ' (no es la cuantía individual).' : ''}{item.notice?.object && <span className="mt-1 block">Objeto según extracto oficial: {item.notice.object}</span>}{item.notice?.amount && <span className="mt-1 block">Cuantía según extracto oficial: {item.notice.amount}</span>}</dd></div>
          <div><dt className="font-bold text-foreground">Ámbito y condiciones que constan</dt><dd className="mt-1 text-muted-foreground">{item.regions?.length ? 'Ámbito: ' + item.regions.join(' · ') + '. ' : ''}{item.sectors?.length ? 'Sectores: ' + item.sectors.join(' · ') + '. ' : ''}{item.callType ? 'Procedimiento: ' + item.callType + '. ' : ''}{item.notice?.requirements && <span className="mt-1 block">Requisitos según extracto oficial: {item.notice.requirements}</span>}Las condiciones completas de acceso, exclusiones y documentación deben comprobarse en la convocatoria y sus bases.</dd></div>
        </dl>
        {item.basisName && <p className="text-muted-foreground">Bases reguladoras: {item.basisName}</p>}
        <div className="flex flex-wrap gap-3 border-t border-border pt-3">
          {item.applicationUrl && <a href={item.applicationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-taxea-red hover:underline">Sede publicada en BDNS <ArrowUpRight className="h-3.5 w-3.5" /></a>}
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-taxea-red hover:underline">Convocatoria oficial <ArrowUpRight className="h-3.5 w-3.5" /></a>
          {item.notice?.noticeUrl && <a href={item.notice.noticeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-taxea-red hover:underline">Extracto en boletín <ArrowUpRight className="h-3.5 w-3.5" /></a>}
          {item.basesUrl && <a href={item.basesUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-taxea-red hover:underline">Bases reguladoras <ArrowUpRight className="h-3.5 w-3.5" /></a>}
          <a href={'mailto:taxeastrategies@gmail.com?subject=' + subject + '&body=' + body} className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline"><Mail className="h-3.5 w-3.5" />Preguntar a Taxea</a>
        </div>
        {!item.applicationUrl && <p className="text-amber-800">La ficha oficial no aporta una URL de tramitación válida. Accede a la convocatoria para localizar el procedimiento exacto.</p>}
        {item.applicationUrl && <p className="text-muted-foreground">La sede procede de la ficha BDNS; puede llevar al portal general, no al formulario, o haber cambiado. Si falla, consulta la convocatoria oficial.</p>}
      </div>
    </details>
  </article>;
}
export default function Grants() {
  const [geo, setGeo] = useState(null);
  const [mapError, setMapError] = useState(false);
  const [community, setCommunity] = useState('');
  const [province, setProvince] = useState('');
  const [applicant, setApplicant] = useState('all');
  const [topic, setTopic] = useState('all');
  const [finality, setFinality] = useState('');
  const [administration, setAdministration] = useState('');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(GEOJSON_URL).then(response => {
      if (!response.ok) throw new Error('Mapa no disponible');
      return response.json();
    }).then(value => { if (active && value?.features?.length === 52) setGeo(value); else if (active) setMapError(true); })
      .catch(() => { if (active) setMapError(true); });
    return () => { active = false; };
  }, []);
  const options = useMemo(() => PROVINCES.filter(row => !community || row.ine === community.ine).sort((a, b) => a.name.localeCompare(b.name, 'es')), [community]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    base44.functions.invoke('searchGrants', { communityCode: community?.code || '', province, applicant, topic, finality, administration, query, status: tab, page })
      .then(result => {
        if (!active) return;
        const value = result?.data || result;
        if (!value?.ok) throw new Error(value?.error || 'No se pudieron consultar las ayudas.');
        setPages(prev => page === 0 ? [value] : [...prev.filter(row => row.page !== page), value]);
        setCheckedAt(value.checkedAt);
      })
      .catch(err => { if (active) setError(err?.response?.data?.error || err?.message || 'No se pudieron consultar las ayudas.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [community, province, applicant, topic, finality, administration, query, tab, page, refresh]);
  const grants = useMemo(() => Array.from(new Map(pages.flatMap(row => row.grants || []).map(row => [row.id, row])).values()), [pages]);
  const visible = useMemo(() => {
    const rows = tab === 'all' ? grants : grants.filter(row => row.status === tab);
    const priority = { open: 0, upcoming: 1, announced: 2, later: 3, closed: 4 };
    return [...rows].sort((a, b) => (priority[a.status] ?? 5) - (priority[b.status] ?? 5) || String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  }, [grants, tab]);
  const latest = pages.find(row => row.page === page);
  const changeGeography = (nextCommunity, nextProvince = '') => { setCommunity(nextCommunity); setProvince(nextProvince); setPage(0); setPages([]); };
  const applySavedSearch = saved => {
    setCommunity(COMMUNITIES.find(row => row.code === saved.communityCode) || '');
    setProvince(saved.province || ''); setApplicant(saved.applicant || 'all'); setTopic(saved.topic || 'all');
    setFinality(saved.finality || ''); setAdministration(saved.administration || '');
    setDraft(saved.query || ''); setQuery(saved.query || ''); setTab('open'); setPage(0); setPages([]);
  };
  const chooseProvince = feature => {
    const item = COMMUNITIES.find(row => row.ine === feature.properties.cod_ccaa);
    if (item) changeGeography(item, feature.properties.name);
  };
  const mapStyle = feature => {
    const selected = province ? province === feature.properties.name && community?.ine === feature.properties.cod_ccaa : community?.ine === feature.properties.cod_ccaa;
    return { color: selected ? '#b91c1c' : '#fff', weight: selected ? 2.4 : 1, fillColor: selected ? '#e74747' : '#255579', fillOpacity: selected ? 0.88 : 0.68 };
  };
  const tabs = [
    { id: 'open', name: 'Abiertas' },
    { id: 'upcoming', name: 'Lista de espera · 6 meses' },
    { id: 'announced', name: 'Plazo por verificar' },
    { id: 'later', name: 'Más adelante' },
    { id: 'closed', name: 'Cerradas' },
    { id: 'all', name: 'Todas las encontradas' },
  ];
  return <main className="mx-auto max-w-[1500px] space-y-6 p-4 pb-16 md:p-7">
    <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 px-6 py-8 text-white md:px-9">
      <div className="absolute -right-16 -top-28 h-72 w-72 rounded-full bg-red-500/20 blur-3xl" />
      <div className="absolute bottom-0 right-1/4 h-36 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-cyan-200"><Sparkles className="h-3.5 w-3.5" />Radar de oportunidades</span>
        <h1 className="mt-4 font-jakarta text-3xl font-extrabold tracking-tight md:text-4xl">Subvenciones y Ayudas</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">Encuentra ayudas para autónomos, empresas, particulares y entidades por territorio, finalidad y administración. Consulta las bases oficiales y pregunta a Taxea antes de solicitar.</p>
        <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 text-emerald-400" />Fuente activa: BDNS oficial · actualización al consultar (caché máxima: 10 min){checkedAt ? ' · ' + new Date(checkedAt).toLocaleString('es-ES') : ''}</p>
      </div>
    </section>
    <OpportunityWatchPanel kind="grant" criteria={{ communityCode: community?.code || '', communityName: community?.name || '', province, applicant, topic, finality, administration, query }} onApply={applySavedSearch} />
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.95fr)_minmax(0,1.3fr)]">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="flex items-center gap-2 font-jakarta text-sm font-bold"><MapPinned className="h-4 w-4 text-taxea-red" />Mapa de España</h2><span className="text-xs text-muted-foreground">Pulsa una provincia</span></div>
        {geo ? <div className="h-[390px] w-full">
          <MapContainer center={[38, -4]} zoom={5} minZoom={4} maxZoom={9} maxBounds={[[25, -20], [46, 7]]} scrollWheelZoom={false} className="h-full w-full" style={{ background: '#d7e6ef' }}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <GeoJSON key={(community?.code || 'all') + province} data={geo} style={mapStyle} onEachFeature={(feature, layer) => { layer.bindTooltip(feature.properties.name); layer.on('click', () => chooseProvince(feature)); }} />
          </MapContainer>
        </div> : <div className="flex h-[390px] items-center justify-center p-8 text-center text-sm text-muted-foreground">{mapError ? 'El mapa no se pudo cargar. Usa los selectores geográficos para seguir buscando.' : 'Cargando mapa interactivo…'}</div>}
        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">El mapa orienta la búsqueda. Comprueba siempre el ámbito territorial y los requisitos en la convocatoria. Geometría: <a href="https://github.com/codeforgermany/click_that_hood" target="_blank" rel="noopener noreferrer" className="underline">Click That Hood (MIT)</a>.</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <h2 className="flex items-center gap-2 font-jakarta text-sm font-bold"><SlidersHorizontal className="h-4 w-4 text-taxea-red" />Ajusta la búsqueda</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold">Comunidad autónoma
            <select value={community?.ine || ''} onChange={e => changeGeography(COMMUNITIES.find(row => row.ine === e.target.value) || '')} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              <option value="">Toda España</option>{COMMUNITIES.map(row => <option key={row.ine} value={row.ine}>{row.name}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold">Provincia
            <select value={province} onChange={e => { setProvince(e.target.value); setPage(0); setPages([]); }} disabled={!community} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-50">
              <option value="">Todas las provincias</option>{options.map(row => <option key={row.code} value={row.name}>{row.name}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold">Quién busca la ayuda
            <select value={applicant} onChange={e => { setApplicant(e.target.value); setPage(0); setPages([]); }} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              <option value="all">Todos los beneficiarios</option><option value="autonomos">Autónomos</option><option value="pymes">Pymes</option><option value="grandes_empresas">Grandes empresas</option><option value="particulares">Particulares</option><option value="entidades">Entidades y asociaciones</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold">Qué quieres impulsar
            <select value={topic} onChange={e => { setTopic(e.target.value); setPage(0); setPages([]); }} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              <option value="all">Cualquier finalidad</option><option value="inicio">Emprendimiento e inicio</option><option value="digitalizacion">Digitalización</option><option value="empleo">Empleo y contratación</option><option value="energia">Energía y sostenibilidad</option><option value="rural">Campo y medio rural</option><option value="innovacion">Innovación e I+D</option><option value="cultura">Cultura, deporte y educación</option><option value="vivienda">Vivienda y rehabilitación</option><option value="social">Acción social y cuidados</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold">Finalidad oficial BDNS
            <select value={finality} onChange={e => { setFinality(e.target.value); setPage(0); setPages([]); }} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              <option value="">Todas las finalidades</option>{OFFICIAL_FINALITIES.map(([id, label]) => <option key={id} value={String(id)}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold">Administración convocante
            <select value={administration} onChange={e => { setAdministration(e.target.value); setPage(0); setPages([]); }} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              <option value="">Todas las administraciones</option><option value="C">Estado</option><option value="A">Comunidad autónoma</option><option value="L">Entidad local</option><option value="O">Otros organismos</option>
            </select>
          </label>
          <form onSubmit={e => { e.preventDefault(); setQuery(draft.trim()); setPage(0); setPages([]); }} className="space-y-1.5">
            <label htmlFor="grant-keyword" className="block text-xs font-semibold">Actividad o palabra clave</label>
            <div className="flex gap-2"><input id="grant-keyword" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Ej.: comercio, hostelería, digitalización" maxLength={100} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm" /><button type="submit" aria-label="Buscar" className="rounded-xl bg-taxea-red px-3 text-white"><Search className="h-4 w-4" /></button></div>
          </form>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">La finalidad oficial filtra por la clasificación BDNS. Los temas son búsquedas textuales orientativas; una palabra clave sustituye el tema. No equivale a un filtro CNAE ni garantiza todas las ayudas aplicables.</p>
        {(applicant === 'autonomos' || applicant === 'pymes') && <p className="mt-2 text-[11px] text-amber-800">La BDNS agrupa autónomos y pymes en un mismo tipo oficial. La selección muestra candidatas; confirma los requisitos en cada convocatoria.</p>}
        <div className="mt-5 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4 text-xs leading-relaxed text-slate-700"><strong>Cómo leer el radar:</strong> «Abierta» procede del estado/plazo informado por BDNS. «Próxima» exige fecha de inicio publicada dentro de seis meses. Una ficha sin fecha confirmada queda por verificar; no se asume próxima ni solicitables.</div>
        <p className="mt-5 text-xs text-muted-foreground">Buscador propio de Taxea con información oficial de BDNS. Las ayudas de otras fuentes todavía no están incorporadas; cada ficha enlaza la convocatoria oficial y, cuando existen, sus bases y la sede publicada.</p>
      </section>
    </div>
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-jakarta text-xl font-bold">Convocatorias encontradas</h2><p className="mt-1 text-xs text-muted-foreground">El filtro elegido se aplica a las fichas oficiales examinadas en la BDNS. Puede haber más coincidencias en páginas posteriores.</p></div>
        <button onClick={() => { setPage(0); setPages([]); setRefresh(value => value + 1); }} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"><RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')} />Actualizar consulta</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{tabs.map(row => <button key={row.id} onClick={() => { setTab(row.id); setPage(0); setPages([]); }} className={'rounded-full border px-3 py-2 text-xs font-semibold ' + (tab === row.id ? 'border-taxea-red bg-taxea-red text-white' : 'border-border bg-card text-muted-foreground hover:text-foreground')}>{row.name}</button>)}</div>
      {error && <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
      {latest?.partial && <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertCircle className="h-4 w-4" />La BDNS no ha entregado el detalle de {latest.failedDetails} convocatoria(s). Resultados parciales; comprueba de nuevo más tarde.</div>}
      {loading && page === 0 && <p className="mt-7 text-sm text-muted-foreground">Consultando convocatorias oficiales…</p>}
      {!loading && !error && visible.length === 0 && <div className="mt-5 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No se encontraron coincidencias en las fichas examinadas. Ajusta los filtros o continúa buscando en la BDNS.</div>}
      <div className="mt-5 grid gap-4 md:grid-cols-2">{visible.map(row => <GrantCard key={row.id} item={row} />)}</div>
      {latest?.hasMore && <div className="mt-6 text-center"><button disabled={loading} onClick={() => setPage(latest.nextPage)} className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50">{loading ? 'Buscando…' : 'Seguir buscando en BDNS'}</button></div>}
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">La búsqueda consulta directamente la BDNS y no guarda las convocatorias en Taxea. Los resultados se recorren por páginas; el estado abierta/próxima se verifica en cada ficha porque el listado BDNS no permite filtrarlo por estado. Si aparecen pocos resultados, usa «Seguir buscando en BDNS». «Plazo por verificar» no significa abierta. Comprueba siempre bases, fechas y elegibilidad en el enlace oficial.</p>
    </section>
  </main>;
}

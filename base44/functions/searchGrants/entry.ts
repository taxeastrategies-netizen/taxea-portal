import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

const ROOT = 'https://www.infosubvenciones.es/bdnstrans/api';
const REGION_TTL = 24 * 60 * 60 * 1000;
const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE = 80;
let regionCache: { at: number; rows: Region[] } | null = null;
const resultCache = new Map<string, { at: number; value: unknown }>();
type Region = { id: number; descripcion: string; children?: Region[] };
const clean = (value: unknown, max = 120) => String(value ?? '').trim().slice(0, max);
const fold = (value: unknown) => clean(value, 180).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const iso = (value: unknown): string | null => {
  const raw = clean(value, 30);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};
const today = () => new Date().toISOString().slice(0, 10);
const sixMonths = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 6); return d.toISOString().slice(0, 10); };
const normalizeCode = (value: unknown) => clean(value, 6).toUpperCase();
const allowedCountryCode = (code: string) => /^ES(?:[0-9]{2})?$/.test(code);
const provinceAliases: Record<string, string[]> = {
  'las palmas': ['Fuerteventura', 'Gran Canaria', 'Lanzarote'],
  'santa cruz de tenerife': ['Tenerife', 'La Palma', 'La Gomera', 'El Hierro'],
  'illes balears': ['Eivissa y Formentera', 'Mallorca', 'Menorca'],
  'islas baleares': ['Eivissa y Formentera', 'Mallorca', 'Menorca'],
  'alava': ['Araba/Álava'], 'araba': ['Araba/Álava'],
  'guipuzcoa': ['Gipuzkoa'], 'vizcaya': ['Bizkaia'],
  'gerona': ['Girona'], 'lerida': ['Lleida'],
  'orense': ['Ourense'], 'la coruna': ['A Coruña'],
  'alicante': ['Alacant/Alicante'], 'castellon': ['Castelló/Castellón'],
  'valencia': ['València/Valencia'],
};

async function requestJson(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`BDNS respondió ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function regions(): Promise<Region[]> {
  if (regionCache && Date.now() - regionCache.at < REGION_TTL) return regionCache.rows;
  const url = new URL(`${ROOT}/regiones`);
  url.searchParams.set('vpd', 'GE');
  const rows = await requestJson(url);
  if (!Array.isArray(rows)) throw new Error('Catálogo geográfico BDNS no disponible');
  regionCache = { rows, at: Date.now() };
  return rows;
}
function flatten(rows: Region[]): Region[] {
  return rows.flatMap(row => [row, ...flatten(row.children || [])]);
}
function findRegionIds(rows: Region[], communityCode: string, province: string): number[] {
  const all = flatten(rows);
  const country = all.find(row => /^ES - /i.test(row.descripcion));
  const countryId = country?.id || 1;
  if (!communityCode) return [];
  const community = all.find(row => row.descripcion.toUpperCase().startsWith(`${communityCode} -`));
  if (!community) throw Object.assign(new Error('Comunidad autónoma no reconocida.'), { status: 400 });
  if (!province) return [...new Set([community.id, ...flatten(community.children || []).map(row => row.id), countryId])];
  const names = provinceAliases[fold(province)] || province.split('/').map(part => part.trim());
  const childIds = flatten(community.children || []).filter(row => names.some(name => fold(row.descripcion.replace(/^ES\d+ - /, '')) === fold(name) || fold(row.descripcion).includes(fold(name)))).map(row => row.id);
  if (!childIds.length) throw Object.assign(new Error('Provincia no reconocida en la comunidad seleccionada.'), { status: 400 });
  return [...new Set([...childIds, community.id, countryId])];
}
function classify(detail: any) {
  const start = iso(detail?.fechaInicioSolicitud);
  const end = iso(detail?.fechaFinSolicitud);
  const now = today();
  if (end && end < now) return 'closed';
  if (start && start > now && start <= sixMonths()) return 'upcoming';
  if (start && start > sixMonths()) return 'later';
  if (detail?.abierto === true) return 'open';
  return 'announced';
}
function normalize(summary: any, detail: any) {
  const id = clean(detail?.codigoBDNS || summary?.numeroConvocatoria, 30);
  const status = classify(detail);
  const sectors = Array.isArray(detail?.sectores) ? detail.sectores.map((s: any) => clean(s?.descripcion || s, 100)).filter(Boolean).slice(0, 6) : [];
  return {
    id, title: clean(detail?.descripcion || summary?.descripcion, 500),
    status, publishedAt: iso(summary?.fechaRecepcion || detail?.fechaRecepcion),
    opensAt: iso(detail?.fechaInicioSolicitud), closesAt: iso(detail?.fechaFinSolicitud),
    timingNote: clean(detail?.textInicio || detail?.textFin, 240),
    administration: clean(detail?.organo?.descripcion || summary?.nivel3 || summary?.nivel2, 150),
    scope: clean(summary?.nivel2 || summary?.nivel1, 100),
    sectors,
    budget: typeof detail?.presupuestoTotal === 'number' ? detail.presupuestoTotal : null,
    source: 'BDNS · fuente oficial',
    sourceUrl: `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/${encodeURIComponent(id)}`,
    checkedAt: new Date().toISOString(),
  };
}
function appliesGeography(summary: any, detail: any, communityCode: string, selectedCodes: string[]) {
  if (!communityCode) return true;
  const codes = Array.isArray(detail?.regiones) ? detail.regiones.map((region: any) => clean(region?.descripcion, 70).match(/^(ES\d*)\s*-/i)?.[1]?.toUpperCase()).filter(Boolean) : [];
  if (!codes.length) return false;
  return codes.some((code: string) => code === communityCode || selectedCodes.includes(code) || (code !== 'ES' && communityCode.startsWith(code)) || (code === 'ES' && clean(summary?.nivel1).toUpperCase() === 'ESTATAL'));
}
async function detailFor(summary: any, communityCode: string, selectedCodes: string[]) {
  const id = clean(summary?.numeroConvocatoria, 30);
  if (!/^\d+$/.test(id)) return null;
  const url = new URL(`${ROOT}/convocatorias`);
  url.searchParams.set('vpd', 'GE');
  url.searchParams.set('numConv', id);
  const detail = await requestJson(url);
  return appliesGeography(summary, detail, communityCode, selectedCodes) ? normalize(summary, detail) : null;
}
function response(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
Deno.serve(async req => {
  try {
    const sdk = createClientFromRequest(req);
    const user = await sdk.auth.me();
    if (!user) return response({ error: 'Inicia sesión para consultar las ayudas.' }, 401);
    const body = await req.json().catch(() => ({}));
    const communityCode = normalizeCode(body?.communityCode);
    const province = clean(body?.province, 80);
    const query = clean(body?.query, 100);
    const focus = body?.focus === 'all' ? 'all' : 'autonomos';
    const page = Number(body?.page ?? 0);
    if (communityCode && !allowedCountryCode(communityCode)) return response({ error: 'Comunidad no válida.' }, 400);
    if (province && !communityCode) return response({ error: 'Selecciona antes una comunidad.' }, 400);
    if (!Number.isInteger(page) || page < 0 || page > 30) return response({ error: 'Página no válida.' }, 400);
    const broadAutonomos = !query && focus === 'autonomos';
    const searchText = query || (broadAutonomos ? 'autónom autoempleo emprendimiento' : '');
    // Acotar siempre a convocatorias recibidas en los últimos 24 meses; se informa en la respuesta.
    const earliest = new Date(); earliest.setUTCMonth(earliest.getUTCMonth() - 24);
    const key = JSON.stringify({ communityCode, province, searchText, page });
    const cached = resultCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL) return response(cached.value);
    const regionRows = await regions();
    const ids = findRegionIds(regionRows, communityCode, province);
    const selectedCodes = flatten(regionRows).filter(row => ids.includes(row.id) && row.descripcion.toUpperCase().startsWith('ES')).map(row => row.descripcion.match(/^(ES\d*)\s*-/i)?.[1]?.toUpperCase()).filter((code): code is string => Boolean(code && code !== 'ES' && code !== communityCode));
    const url = new URL(`${ROOT}/convocatorias/busqueda`);
    url.searchParams.set('vpd', 'GE');
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', '18');
    url.searchParams.set('order', 'fechaRecepcion');
    url.searchParams.set('direccion', 'desc');
    url.searchParams.set('fechaDesde', `${String(earliest.getUTCDate()).padStart(2, '0')}/${String(earliest.getUTCMonth() + 1).padStart(2, '0')}/${earliest.getUTCFullYear()}`);
    if (searchText) url.searchParams.set('descripcion', searchText);
    if (broadAutonomos) url.searchParams.set('descripcionTipoBusqueda', '2');
    if (ids.length) url.searchParams.set('regiones', ids.join(','));
    const list = await requestJson(url);
    if (!Array.isArray(list?.content)) throw new Error('Respuesta BDNS inesperada.');
    const summaries = list.content.filter((row: any) => /^\d+$/.test(String(row?.numeroConvocatoria || '')));
    const grants: any[] = [];
    let failedDetails = 0;
    for (let i = 0; i < summaries.length; i += 3) {
      const batch = await Promise.allSettled(summaries.slice(i, i + 3).map((summary: any) => detailFor(summary, communityCode, selectedCodes)));
      failedDetails += batch.filter(row => row.status === 'rejected').length;
      grants.push(...batch.filter((row): row is PromiseFulfilledResult<any> => row.status === 'fulfilled').map(row => row.value).filter(Boolean));
    }
    if (summaries.length && failedDetails === summaries.length) throw new Error('No se pudieron consultar los detalles de la BDNS.');
    const value = {
      ok: true,
      grants: grants.filter(grant => grant.status !== 'closed' && grant.status !== 'later'),
      page, hasMore: page + 1 < Number(list?.totalPages || 0) && page < 30,
      totalSourceMatches: Number(list?.totalElements || 0),
      partial: failedDetails > 0, failedDetails,
      checkedAt: new Date().toISOString(),
      source: 'BDNS', coverage: 'Convocatorias publicadas en los últimos 24 meses. No garantiza exhaustividad de otras fuentes ni la elegibilidad personal.',
      provider: { fandit: 'Pendiente de clave y autorización de consumo API' },
    };
    if (resultCache.size >= MAX_CACHE) resultCache.delete(resultCache.keys().next().value);
    resultCache.set(key, { at: Date.now(), value });
    return response(value);
  } catch (error) {
    const status = (error as any)?.status || 502;
    const message = status === 400 ? (error as Error).message : 'La fuente oficial no responde ahora. Vuelve a intentarlo en unos minutos.';
    return response({ error: message }, status);
  }
});

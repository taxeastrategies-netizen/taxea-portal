import { XMLParser } from 'npm:fast-xml-parser@4.5.3';

export const SOURCES = {
  hosted: 'https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom',
  aggregated: 'https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1044/PlataformasAgregadasSinMenores.atom',
  consultations: 'https://contrataciondelestado.es/sindicacion/sindicacion_1403/CPM_SectorPublico.atom',
};
const PATHS = {
  hosted: /^\/sindicacion\/sindicacion_643\/licitacionesPerfilesContratanteCompleto3(?:_\d{8}_\d{6})?\.atom$/,
  aggregated: /^\/sindicacion\/sindicacion_1044\/PlataformasAgregadasSinMenores(?:_\d{8}_\d{6})?\.atom$/,
  consultations: /^\/sindicacion\/sindicacion_1403\/CPM_SectorPublico(?:_\d{8}_\d{6})?\.atom$/,
};
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, trimValues: true, processEntities: true });
const cache = new Map<string, { at: number; value: { rows: any[]; next: string | null; updated: string | null; examined: number } }>();
const CACHE_TTL = 10 * 60 * 1000;
const asArray = (v: any): any[] => v == null ? [] : Array.isArray(v) ? v : [v];
const val = (v: any): string => String(v && typeof v === 'object' ? v['#text'] ?? '' : v ?? '').trim();
const txt = (v: any, max = 500): string => val(v).replace(/\s+/g, ' ').slice(0, max);
const iso = (v: any): string | null => /^\d{4}-\d{2}-\d{2}/.test(val(v)) ? val(v).slice(0, 10) : null;
const fold = (v: any) => txt(v, 500).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const dateToday = () => new Date().toISOString().slice(0, 10);
const inSixMonths = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 6); return d.toISOString().slice(0, 10); };
function safeLink(value: any): string | null {
  try {
    const url = new URL(txt(value, 900));
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname)) return null;
    return url.toString();
  } catch { return null; }
}
export function allowedFeedUrl(source: keyof typeof SOURCES, candidate: unknown): string {
  if (typeof candidate !== 'string' || candidate.length > 260) throw new Error('Cursor de búsqueda inválido.');
  const url = new URL(candidate);
  if (url.protocol !== 'https:' || !['contrataciondelestado.es', 'contrataciondelsectorpublico.gob.es'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !PATHS[source].test(url.pathname)) throw new Error('Cursor de búsqueda inválido.');
  return url.toString();
}
function nextLink(feed: any, source: keyof typeof SOURCES): string | null {
  const link = asArray(feed?.link).find((item: any) => item?.['@_rel'] === 'next')?.['@_href'];
  return link ? allowedFeedUrl(source, link) : null;
}
function partyName(status: any) {
  const party = status?.['cac-place-ext:LocatedContractingParty']?.['cac:Party'];
  const partyNames = asArray(party?.['cac:PartyName']);
  return txt(partyNames[0]?.['cbc:Name'] || party?.['cac:PartyIdentification']?.['cbc:ID'], 180);
}
function contractType(code: string): string {
  return ({ '1': 'Suministros', '2': 'Servicios', '3': 'Obras', '4': 'Concesión de obras', '5': 'Concesión de servicios', '6': 'Administrativo especial', '7': 'Privado' } as Record<string, string>)[code] || 'Contrato público';
}
function money(value: any): number | null {
  const number = Number(val(value));
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export function normalizeEntry(entry: any, source: keyof typeof SOURCES, now = dateToday()): any | null {
  const consultation = source === 'consultations';
  const status = consultation ? entry?.['cac-place-ext:PreliminaryMarketConsultationStatus'] : entry?.['cac-place-ext:ContractFolderStatus'];
  if (!status) return null;
  const rawState = val(status[consultation ? 'cbc-place-ext:PreliminaryMarketConsultationStatusCode' : 'cbc-place-ext:ContractFolderStatusCode']).toUpperCase();
  const project = status?.['cac:ProcurementProject'] || {};
  const process = status?.['cac:TenderingProcess'] || {};
  const location = project?.['cac:RealizedLocation'] || {};
  const deadline = iso(process?.['cac:TenderSubmissionDeadlinePeriod']?.['cbc:EndDate']);
  const consultationLimit = iso(status?.['cbc:LimitDate']);
  const plannedDate = iso(status?.['cbc:PlannedDate']);
  const cpv = asArray(project?.['cac:RequiredCommodityClassification']).map((item: any) => txt(item?.['cbc:ItemClassificationCode'], 10)).filter((item: string) => /^\d{8}$/.test(item)).slice(0, 12);
  const title = txt(entry?.title || project?.['cbc:Name'] || status?.['cbc:ConsultationName'], 650);
  const id = txt(entry?.id, 240);
  const url = safeLink(entry?.link?.['@_href']);
  if (!id || !title || !url) return null;
  let kind = '';
  if (consultation) {
    if (rawState !== 'PUB' || (consultationLimit && consultationLimit < now)) return null;
    kind = 'consulta';
  } else if (rawState === 'PUB' && deadline && deadline >= now) {
    kind = 'abierta';
  } else if (rawState === 'PRE') {
    kind = 'anuncio_previo';
  } else return null;
  const futureLimit = inSixMonths();
  // PlannedDate in consultations is a consultation milestone, not a guaranteed tender date.
  return {
    id, tenderId: txt(status?.[consultation ? 'cbc-place-ext:PreliminaryMarketConsultationID' : 'cbc:ContractFolderID'], 140),
    title, kind, rawState, source, url,
    updatedAt: txt(entry?.updated, 45),
    deadline: kind === 'abierta' ? deadline : null,
    consultationLimit: kind === 'consulta' ? consultationLimit : null,
    plannedDate: kind === 'consulta' && plannedDate && plannedDate >= now && plannedDate <= futureLimit ? plannedDate : null,
    cpv, contractType: contractType(val(project?.['cbc:TypeCode'])),
    amountExVat: money(project?.['cac:BudgetAmount']?.['cbc:TaxExclusiveAmount']),
    estimatedValue: money(project?.['cac:BudgetAmount']?.['cbc:EstimatedOverallContractAmount']),
    province: txt(location?.['cbc:CountrySubentity'], 90),
    nuts: txt(location?.['cbc:CountrySubentityCode'], 12).toUpperCase(),
    contractingBody: partyName(status) || txt(entry?.summary?.['#text'] || entry?.summary, 200).match(/Órgano de Contratación:\s*([^;]+)/i)?.[1]?.trim() || '',
    summary: kind === 'abierta' ? 'Expediente publicado con plazo de presentación vigente según los datos estructurados de la Plataforma.' : kind === 'anuncio_previo' ? 'Anuncio previo publicado. Aún no consta un plazo de presentación de ofertas: no equivale a una licitación abierta.' : 'Consulta preliminar de mercado. Puede permitir aportaciones, pero no constituye una convocatoria de ofertas.',
  };
}
export async function readFeed(source: keyof typeof SOURCES, requestedUrl?: string | null) {
  const url = requestedUrl ? allowedFeedUrl(source, requestedUrl) : SOURCES[source];
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/atom+xml' } });
    if (!response.ok) throw new Error('La Plataforma devolvió ' + response.status);
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > 16_000_000) throw new Error('Feed oficial demasiado grande');
    const xml = await response.text();
    if (xml.length > 16_000_000) throw new Error('Feed oficial demasiado grande');
    const feed = parser.parse(xml)?.feed;
    if (!feed || !feed.id || !feed.entry) throw new Error('Formato Atom oficial inesperado');
    const entries = asArray(feed.entry);
    const result = { rows: entries.map((entry: any) => normalizeEntry(entry, source)).filter(Boolean), next: nextLink(feed, source), updated: txt(feed.updated, 45) || null, examined: entries.length };
    if (cache.size >= 24) cache.delete(cache.keys().next().value);
    cache.set(url, { at: Date.now(), value: result });
    return result;
  } finally { clearTimeout(timer); }
}
export function filterRows(rows: any[], filters: any) {
  const query = fold(filters.query);
  const province = fold(filters.province);
  const community = txt(filters.communityCode, 4).toUpperCase();
  const cpv = txt(filters.cpv, 8);
  const kind = txt(filters.kind, 20);
  const type = txt(filters.contractType, 40);
  const min = filters.minAmount === '' || filters.minAmount == null ? null : Number(filters.minAmount);
  const max = filters.maxAmount === '' || filters.maxAmount == null ? null : Number(filters.maxAmount);
  return rows.filter(row => {
    if (kind !== 'all' && row.kind !== kind) return false;
    if (query && !fold([row.title, row.tenderId, row.contractingBody, row.province, row.cpv.join(' ')].join(' ')).includes(query)) return false;
    if (cpv && !row.cpv.some((code: string) => code.startsWith(cpv))) return false;
    if (type && row.contractType !== type) return false;
    if (community && !row.nuts.startsWith(community)) return false;
    if (province && !fold(row.province).includes(province)) return false;
    const amount = row.amountExVat ?? row.estimatedValue;
    if (min != null && (amount == null || amount < min)) return false;
    if (max != null && (amount == null || amount > max)) return false;
    return true;
  }).sort((a, b) => (a.deadline || a.consultationLimit || '9999').localeCompare(b.deadline || b.consultationLimit || '9999') || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

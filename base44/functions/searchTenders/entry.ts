import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { allowedFeedUrl, filterRows, readFeed, validProvinceCode } from './core.ts';
import { getSnapshot, isSource, refreshSnapshot } from './snapshot.ts';

const SOURCE_KEYS = ['hosted', 'aggregated', 'consultations'] as const;
const KINDS = ['all', 'abierta', 'anuncio_previo', 'consulta'];
const TYPES = ['', 'Suministros', 'Servicios', 'Obras', 'Concesión de obras', 'Concesión de servicios', 'Administrativo especial', 'Privado', 'Contrato público'];
const response = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Taxea-Tenders-Revision': 'cache-v1' } });
const text = (v: unknown, max = 100) => String(v ?? '').trim().slice(0, max);

Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return response({ error: 'Método no permitido.' }, 405);
    const sdk = createClientFromRequest(req);
    if (!await sdk.auth.me()) return response({ error: 'Inicia sesión para consultar licitaciones.' }, 401);
    const body = await req.json().catch(() => ({}));
    if (body.action === 'refresh_source') {
      const user = await sdk.auth.me();
      if (!['admin', 'super_admin'].includes(user?.role)) return response({ error: 'Acceso reservado al administrador.' }, 403);
      if (!isSource(body.source)) return response({ error: 'Fuente no válida.' }, 400);
      try {
        const refreshed = await refreshSnapshot(sdk, body.source);
        return response({ ok: true, source: body.source, fetchedAt: refreshed.fetchedAt, examined: refreshed.examined, matches: refreshed.rows.length });
      } catch (error) {
        console.error('Tender cache refresh failed:', String((error as Error)?.message || error).slice(0, 250));
        return response({ error: 'No se pudo renovar esta fuente oficial; se conserva la última copia correcta.' }, 502);
      }
    }
    const filters = {
      kind: text(body.kind, 20) || 'all',
      query: text(body.query, 100),
      communityCode: text(body.communityCode, 4).toUpperCase(),
      provinceCode: text(body.provinceCode, 2),
      cpv: text(body.cpv, 8),
      contractType: text(body.contractType, 40),
      minAmount: body.minAmount === '' || body.minAmount == null ? '' : Number(body.minAmount),
      maxAmount: body.maxAmount === '' || body.maxAmount == null ? '' : Number(body.maxAmount),
    };
    if (!KINDS.includes(filters.kind) || (filters.communityCode && !/^ES\d{2}$/.test(filters.communityCode)) || (filters.provinceCode && (!filters.communityCode || !validProvinceCode(filters.provinceCode))) || (filters.cpv && !/^\d{1,8}$/.test(filters.cpv)) || !TYPES.includes(filters.contractType) || (filters.minAmount !== '' && (!Number.isFinite(filters.minAmount) || Number(filters.minAmount) < 0)) || (filters.maxAmount !== '' && (!Number.isFinite(filters.maxAmount) || Number(filters.maxAmount) < 0)) || (filters.minAmount !== '' && filters.maxAmount !== '' && Number(filters.minAmount) > Number(filters.maxAmount))) return response({ error: 'Filtros de búsqueda no válidos.' }, 400);
    const requestedCursor = body.cursor && typeof body.cursor === 'object' && !Array.isArray(body.cursor) ? body.cursor : null;
    const sources: (typeof SOURCE_KEYS[number])[] = filters.kind === 'consulta' ? ['consultations'] : filters.kind === 'all' ? [...SOURCE_KEYS] : ['hosted', 'aggregated'];
    const requested: { source: typeof SOURCE_KEYS[number]; url: string | null }[] = [];
    for (const source of sources) {
      const candidate = requestedCursor ? requestedCursor[source] : null;
      if (requestedCursor && !candidate) continue;
      requested.push({ source, url: candidate ? allowedFeedUrl(source, candidate) : null });
    }
    if (!requested.length) return response({ ok: true, tenders: [], nextCursor: null, hasMore: false, examinedEntries: 0, checkedAt: new Date().toISOString(), sourceUpdated: {}, partial: false, coverage: 'No quedan páginas adicionales de esta búsqueda.' });
    const fetched = await Promise.allSettled(requested.map(async ({ source, url }) => {
      if (url) return { ...(await readFeed(source, url)), fetchedAt: new Date().toISOString(), cached: false };
      const snapshot = await getSnapshot(sdk, source);
      if (snapshot) return { ...snapshot, cached: true };
      return { ...(await refreshSnapshot(sdk, source)), cached: false };
    }));
    const rows: any[] = [];
    const errors: string[] = [];
    const nextCursor: Record<string, string> = {};
    const sourceUpdated: Record<string, string | null> = {};
    let examinedEntries = 0;
    const fetchedAt: Record<string, string> = {};
    let stale = false;
    fetched.forEach((result, index) => {
      const source = requested[index].source;
      if (result.status === 'rejected') { errors.push(source); return; }
      rows.push(...result.value.rows);
      examinedEntries += result.value.examined;
      sourceUpdated[source] = result.value.updated;
      fetchedAt[source] = result.value.fetchedAt;
      if (Date.now() - Date.parse(result.value.fetchedAt) > 90 * 60 * 1000) stale = true;
      if (result.value.next) nextCursor[source] = result.value.next;
    });
    if (errors.length === requested.length) return response({ error: 'Las fuentes oficiales de contratación no responden en este momento.' }, 502);
    const tenders = filterRows(Array.from(new Map(rows.map(row => [row.id, row])).values()), filters);
    return response({
      ok: true, tenders, nextCursor: Object.keys(nextCursor).length ? nextCursor : null, hasMore: Object.keys(nextCursor).length > 0,
      examinedEntries, checkedAt: new Date().toISOString(), sourceUpdated, fetchedAt,
      stale, partial: errors.length > 0, failedSources: errors,
      coverage: 'Resultados de las páginas Atom oficiales examinadas y guardadas temporalmente. Los filtros se aplican a estos registros; puede haber más coincidencias en páginas siguientes. Las consultas preliminares y los anuncios previos no son licitaciones abiertas.',
    });
  } catch (error) {
    if (String((error as Error)?.message || '').includes('Cursor de búsqueda inválido') || error instanceof TypeError && String((error as Error)?.message || '').includes('URL')) return response({ error: 'Cursor de búsqueda inválido.' }, 400);
    return response({ error: 'No se pudo consultar la fuente oficial. Inténtalo más tarde.' }, 502);
  }
});
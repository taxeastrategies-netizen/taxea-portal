import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

const ROOT = 'https://www.infosubvenciones.es/bdnstrans/api';
const PAGE_SIZE = 500;
const MAX_BATCH = 20;
const SOURCE = 'BDNS-GE';
const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const iso = (value: unknown) => {
  const text = clean(value, 30);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parts = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : '';
};
const today = () => new Date().toISOString().slice(0, 10);
const horizon = () => {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + 6);
  return date.toISOString().slice(0, 10);
};
function classify(detail: any): 'open' | 'upcoming' | 'closed' {
  const start = iso(detail?.fechaInicioSolicitud);
  const end = iso(detail?.fechaFinSolicitud);
  if (end && end < today()) return 'closed';
  if (start && start > today() && start <= horizon()) return 'upcoming';
  return detail?.abierto === true ? 'open' : 'closed';
}
async function getJson(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const result = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!result.ok) throw new Error(`BDNS HTTP ${result.status}`);
    return await result.json();
  } finally { clearTimeout(timer); }
}
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });

Deno.serve(async req => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'super_admin'].includes(user.role)) return reply({ error: 'Solo administración puede controlar la importación.' }, 403);
    const body = await req.json().catch(() => ({}));
    const action = clean(body?.action, 20) || 'status';
    if (!['status', 'scan'].includes(action)) return reply({ error: 'Acción no válida.' }, 400);
    const store = base44.asServiceRole.entities;
    const rows = await store.GrantImportRun.filter({ source: SOURCE }, '-created_date', 2);
    if (rows.length > 1) return reply({ error: 'Estado de importación duplicado: revisar antes de continuar.' }, 409);
    let run = rows[0] || null;
    if (action === 'status') return reply({ ok: true, run, coverageComplete: run?.state === 'complete' });
    const dryRun = body?.dryRun !== false;
    const limit = Math.min(MAX_BATCH, Math.max(1, Number.isInteger(Number(body?.limit)) ? Number(body.limit) : MAX_BATCH));
    if (run?.state === 'scanning' && Date.now() - Date.parse(run.updatedAt || '') < 5 * 60 * 1000) {
      return reply({ error: 'Ya hay un lote en curso.' }, 409);
    }
    const page = Math.max(0, Number(run?.page || 0));
    const offset = Math.max(0, Number(run?.offset || 0));
    const listUrl = new URL(`${ROOT}/convocatorias/busqueda`);
    for (const [key, value] of Object.entries({ vpd: 'GE', page: String(page), pageSize: String(PAGE_SIZE), order: 'numeroConvocatoria', direccion: 'asc' })) listUrl.searchParams.set(key, value);
    const listing = await getJson(listUrl);
    if (!Array.isArray(listing?.content) || !Number.isFinite(Number(listing?.totalPages))) throw new Error('Listado BDNS inesperado.');
    const slice = listing.content.slice(offset, offset + limit);
    if (!run && !dryRun) {
      run = await store.GrantImportRun.create({ source: SOURCE, state: 'ready', page: 0, offset: 0, pageSize: PAGE_SIZE, sourceTotal: Number(listing.totalElements || 0), inspected: 0, activeFound: 0, failed: 0, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    if (!dryRun && run) run = await store.GrantImportRun.update(run.id, { state: 'scanning', updatedAt: new Date().toISOString(), lastError: '' });
    let active = 0;
    let inspected = 0;
    const samples: Array<{ id: string; status: string }> = [];
    try {
      for (const summary of slice) {
        const id = clean(summary?.numeroConvocatoria, 30);
        if (!/^\d+$/.test(id)) throw new Error('Identificador BDNS inválido; lote detenido.');
        const detailUrl = new URL(`${ROOT}/convocatorias`);
        detailUrl.searchParams.set('vpd', 'GE');
        detailUrl.searchParams.set('numConv', id);
        const detail = await getJson(detailUrl);
        const status = classify(detail);
        inspected++;
        samples.push({ id, status });
        if (status !== 'closed') active++;
        if (dryRun) continue;
        const existing = await store.GrantCatalog.filter({ bdnsId: id }, '-created_date', 2);
        if (existing.length > 1) throw new Error(`Convocatoria BDNS ${id} duplicada: revisión manual necesaria.`);
        if (status === 'closed') {
          if (existing[0] && existing[0].status !== 'closed') await store.GrantCatalog.update(existing[0].id, { status: 'closed', checkedAt: new Date().toISOString() });
          continue;
        }
        const data = {
          bdnsId: id,
          title: clean(detail?.descripcion || summary?.descripcion),
          status,
          publishedAt: iso(summary?.fechaRecepcion || detail?.fechaRecepcion),
          opensAt: iso(detail?.fechaInicioSolicitud),
          closesAt: iso(detail?.fechaFinSolicitud),
          regionCodes: Array.isArray(detail?.regiones) ? detail.regiones.map((r: any) => clean(r?.descripcion, 80).match(/^(ES\d*)\s*-/i)?.[1]).filter(Boolean) : [],
          beneficiaryTypes: Array.isArray(detail?.tiposBeneficiarios) ? detail.tiposBeneficiarios.map((r: any) => clean(r?.descripcion, 120)).filter(Boolean) : [],
          finality: clean(detail?.descripcionFinalidad, 120),
          administration: clean(summary?.nivel1, 40),
          searchText: clean(`${detail?.descripcion || summary?.descripcion} ${detail?.descripcionFinalidad || ''} ${summary?.nivel2 || ''}`, 1000),
          payload: JSON.stringify({ purpose: clean(detail?.descripcionFinalidad, 120), callType: clean(detail?.tipoConvocatoria, 120), basisName: clean(detail?.descripcionBasesReguladoras, 300), basesUrl: clean(detail?.urlBasesReguladoras, 700), applicationUrl: clean(detail?.sedeElectronica, 700), budget: typeof detail?.presupuestoTotal === 'number' ? detail.presupuestoTotal : null, startNote: clean(detail?.textInicio, 240), endNote: clean(detail?.textFin, 240), sectors: Array.isArray(detail?.sectores) ? detail.sectores.map((r: any) => clean(r?.descripcion, 100)).filter(Boolean).slice(0, 12) : [] }),
          checkedAt: new Date().toISOString(),
          sourceUrl: `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/${encodeURIComponent(id)}`,
        };
        if (existing[0]) await store.GrantCatalog.update(existing[0].id, data);
        else await store.GrantCatalog.create(data);
      }
    } catch (error) {
      if (!dryRun && run) await store.GrantImportRun.update(run.id, { state: 'error', failed: Number(run.failed || 0) + 1, updatedAt: new Date().toISOString(), lastError: clean((error as Error).message, 300) });
      throw error;
    }
    if (dryRun) return reply({ ok: true, dryRun: true, page, offset, inspected, active, samples, sourceTotal: Number(listing.totalElements || 0), warning: 'Prueba sin escrituras. No acredita cobertura nacional.' });
    const nextOffset = offset + slice.length;
    const nextPage = nextOffset >= listing.content.length ? page + 1 : page;
    const done = nextPage >= Number(listing.totalPages);
    run = await store.GrantImportRun.update(run.id, {
      state: done ? 'complete' : 'ready', page: nextPage, offset: nextPage === page ? nextOffset : 0,
      sourceTotal: Number(listing.totalElements || 0), inspected: Number(run.inspected || 0) + inspected,
      activeFound: Number(run.activeFound || 0) + active, updatedAt: new Date().toISOString(),
      completedAt: done ? new Date().toISOString() : '',
    });
    return reply({ ok: true, dryRun: false, run, batch: { inspected, active, samples }, coverageComplete: done });
  } catch (error) {
    return reply({ error: clean((error as Error).message, 300) || 'Falló el lote BDNS.' }, 502);
  }
});

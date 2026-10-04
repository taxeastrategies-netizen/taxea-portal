import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { compareWatchResults } from './core.ts';

const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
const errorText = (error: unknown) => String((error as any)?.response?.data?.error || (error as Error)?.message || error).slice(0, 180);
const twoHours = 2 * 60 * 60 * 1000;
const oneDay = 24 * 60 * 60 * 1000;

function requestFor(watch: any, status?: string) {
  const c = watch.criteria || {};
  return watch.kind === 'grant'
    ? { communityCode: c.communityCode || '', province: c.province || '', applicant: c.applicant || 'all', topic: c.topic || 'all', finality: c.finality || '', administration: c.administration || '', query: c.query || '', status, page: 0 }
    : { kind: 'all', query: c.query || '', cpv: c.cpv || '', contractType: c.contractType || '', communityCode: c.communityCode || '', provinceCode: c.provinceCode || '', minAmount: c.minAmount || '', maxAmount: c.maxAmount || '' };
}

async function search(sdk: any, watch: any) {
  const statuses = watch.kind === 'grant' ? ['open', 'upcoming'] : [undefined];
  const found = [];
  let examined = 0;
  let limited = false;
  for (const status of statuses) {
    const response = await sdk.functions.invoke(watch.kind === 'grant' ? 'searchGrants' : 'searchTenders', requestFor(watch, status));
    const payload = response?.data || response;
    if (!payload?.ok || payload?.partial || payload?.stale) throw new Error(payload?.error || 'La fuente oficial devolvió datos parciales o desactualizados.');
    const rows = watch.kind === 'grant' ? payload.grants : payload.tenders;
    if (!Array.isArray(rows)) throw new Error('Respuesta de fuente oficial incompleta.');
    found.push(...rows.filter((row: any) => watch.kind === 'grant' ? ['open', 'upcoming'].includes(row.status) : ['abierta', 'anuncio_previo', 'consulta'].includes(row.kind)));
    examined += Number(payload.examinedEntries || payload.attemptedDetails || 0);
    limited ||= Boolean(payload.hasMore);
  }
  return { rows: [...new Map(found.map((row: any) => [String(row.id), row])).values()], examined, limited };
}

Deno.serve(async req => {
  try {
    if (req.method !== 'POST') return reply({ error: 'Método no permitido.' }, 405);
    const sdk = createClientFromRequest(req);
    const user = await sdk.auth.me();
    if (!['admin', 'super_admin'].includes(user?.role)) return reply({ error: 'Acceso reservado al administrador.' }, user ? 403 : 401);
    const now = Date.now();
    const watches = await sdk.asServiceRole.entities.OpportunityWatch.filter({ enabled: true }, '-created_date', 500);
    const due = (watches || []).filter((watch: any) => ['grant', 'tender'].includes(watch.kind)
      && (!watch.last_checked_at || now - Date.parse(watch.last_checked_at) >= oneDay)
      && (!watch.last_attempt_at || now - Date.parse(watch.last_attempt_at) >= twoHours))
      .sort((a: any, b: any) => Date.parse(a.last_attempt_at || a.last_checked_at || '1970-01-01') - Date.parse(b.last_attempt_at || b.last_checked_at || '1970-01-01'))
      .slice(0, 2);
    const summary = [];
    for (const watch of due) {
      const checkedAt = new Date().toISOString();
      try {
        await sdk.asServiceRole.entities.OpportunityWatch.update(watch.id, { last_attempt_at: checkedAt });
        const result = await search(sdk, watch);
        const state = compareWatchResults(watch, result.rows, checkedAt);
        await sdk.asServiceRole.entities.OpportunityWatch.update(watch.id, {
          last_checked_at: state.last_checked_at,
          seen_signatures: state.seen_signatures,
          unread_items: state.unread_items,
          unread_count: state.unread_count,
          last_alert_at: state.last_alert_at,
          last_error: '',
          last_examined_count: result.examined,
          last_coverage_limited: result.limited,
        });
        summary.push({ watch: watch.id, ok: true, detected: state.detected, baseline: state.baseline, examined: result.examined, limited: result.limited });
      } catch (error) {
        console.error('Opportunity watch check failed:', watch.id, errorText(error));
        await sdk.asServiceRole.entities.OpportunityWatch.update(watch.id, { last_error: errorText(error), last_attempt_at: checkedAt }).catch(() => {});
        summary.push({ watch: watch.id, ok: false });
      }
    }
    return reply({ ok: true, processed: summary.length, summary, dueRemaining: Math.max(0, (watches || []).length - due.length), checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Opportunity watch scheduler failed:', errorText(error));
    return reply({ error: 'No se pudo completar la revisión automática del radar.' }, 502);
  }
});

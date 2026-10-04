export const signatureFor = (row: any) => [
  row.updatedAt || row.publishedAt || '',
  row.closesAt || row.deadline || row.endDate || '',
  row.status || row.kind || '',
].join('|');

export function compareWatchResults(watch: any, rows: any[], checkedAt: string) {
  const previous = watch.seen_signatures && typeof watch.seen_signatures === 'object' ? watch.seen_signatures : {};
  const examined = rows.filter(row => row && row.id).slice(0, 200);
  const signatures = Object.fromEntries(examined.map(row => [String(row.id), signatureFor(row)]));
  const baseline = !watch.last_checked_at;
  const incoming = baseline ? [] : examined.filter(row => previous[String(row.id)] !== signatures[String(row.id)]);
  const existing = Array.isArray(watch.unread_items) ? watch.unread_items : [];
  const byId = new Map(existing.filter(row => row?.id).map(row => [String(row.id), row]));
  for (const row of incoming) {
    byId.set(String(row.id), {
      id: String(row.id),
      title: String(row.title || 'Convocatoria sin título').slice(0, 300),
      url: String(row.sourceUrl || row.url || '').slice(0, 700),
      status: String(row.status || row.kind || '').slice(0, 30),
      detected_at: checkedAt,
    });
  }
  return {
    last_checked_at: checkedAt,
    last_error: '',
    seen_signatures: { ...previous, ...signatures },
    unread_items: [...byId.values()].slice(-50),
    unread_count: Math.min(byId.size, 50),
    last_alert_at: incoming.length ? checkedAt : watch.last_alert_at || null,
    detected: incoming.length,
    baseline,
  };
}

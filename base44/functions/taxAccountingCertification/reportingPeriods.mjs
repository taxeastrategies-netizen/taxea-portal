const DAY = 86400000;
const CLOSED = new Set(['presentado', 'presentada', 'finalizado', 'finalizada', 'pagado', 'pagada', 'cancelado', 'cancelada', 'anulado', 'anulada', 'archivado', 'cerrado', 'cerrada', 'completado', 'completada', 'no_aplica', 'sin_obligacion', 'no_obligado']);
export function civilDay(value, timeZone = 'Europe/Madrid') {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(part => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}
export function shiftDay(day, amount) {
  if (!civilDay(day) || !Number.isInteger(amount)) return null;
  return new Date(Date.parse(day + 'T00:00:00Z') + amount * DAY).toISOString().slice(0, 10);
}
export function daysBetween(from, to) {
  return civilDay(from) && civilDay(to) ? Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY) : null;
}
export function withinWindow(value, window, timeZone = 'Europe/Madrid') {
  const day = civilDay(value, timeZone);
  return Boolean(day && day >= window.start && day <= window.end);
}
export function reportingWindow(period = '30d', now = new Date(), timeZone = 'Europe/Madrid') {
  const end = civilDay(now, timeZone);
  const days = period === 'ytd' && end ? daysBetween(end.slice(0,4)+'-01-01',end)+1 : period === 'mtd' && end ? Number(end.slice(8, 10)) : ({ '7d': 7, '30d': 30, '90d': 90, '365d': 365 })[period];
  if (!days || !end) throw new RangeError('Periodo financiero no válido.');
  const start = shiftDay(end, 1 - days);
  return { period, days, start, end, previous: { start: shiftDay(start, -days), end: shiftDay(start, -1) }, timeZone };
}
export function obligationDay(row) {
  return civilDay(row?.filingDeadline || row?.fecha_limite || row?.dueDate);
}
export function obligationOpen(row) {
  return !row?.anulada && !CLOSED.has(String(row?.state || row?.estado || '').trim().toLowerCase());
}
export function classifyObligations(rows = [], { now = new Date(), horizon = 30, timeZone = 'Europe/Madrid' } = {}) {
  const today = civilDay(now, timeZone), end = shiftDay(today, Math.max(0, Math.min(366, Number(horizon) || 0)));
  const open = rows.filter(obligationOpen), sort = (a, b) => String(obligationDay(a)).localeCompare(String(obligationDay(b)));
  return {
    today, end,
    upcoming: open.filter(row => { const day = obligationDay(row); return day && day >= today && day <= end; }).sort(sort),
    overdue: open.filter(row => { const day = obligationDay(row); return day && day < today; }).sort(sort),
    undated: open.filter(row => !obligationDay(row)),
  };
}

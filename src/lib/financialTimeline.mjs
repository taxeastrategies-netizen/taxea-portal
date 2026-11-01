import { civilDay, shiftDay, classifyObligations, obligationDay } from './reportingPeriods.mjs';
import { reconcileFinancialSources } from './financialSourceTruth.js';
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
export function financialTimeline(invoices = [], expenses = [], obligations = [], { now = new Date() } = {}) {
  const today = civilDay(now), from = shiftDay(today, -29);
  const source = reconcileFinancialSources(invoices, expenses), rows = [];
  for (const invoice of source.invoices) {
    const day = civilDay(invoice.fecha_emision);
    if (!day || day < from || day > today || invoice.anulada || ['anulada','cancelada','borrador'].includes(String(invoice.estado || invoice.estado_cobro || '').toLowerCase())) continue;
    const incoming = invoice.tipo === 'emitida';
    rows.push({ id: 'invoice:' + invoice.id, day, kind: incoming ? 'income' : 'expense', label: incoming ? 'Factura emitida' : 'Factura recibida', detail: `${invoice.numero_factura || 'Sin número'} · ${invoice.cliente_nombre || invoice.proveedor_nombre || 'Sin contraparte'}`, amount: finite(invoice.total_factura) ? Number(invoice.total_factura) : null, route: incoming ? '/finance/ar' : '/finance/ap' });
  }
  for (const expense of source.expenses) {
    const day = civilDay(expense.fecha);
    if (!day || day < from || day > today || expense.anulada) continue;
    rows.push({ id: 'expense:' + expense.id, day, kind: 'document', label: expense.tipo === 'ingreso' ? 'Ingreso registrado' : 'Gasto registrado', detail: expense.concepto || 'Documento', amount: finite(expense.total) ? Number(expense.total) : null, route: '/tax-accounting/income-expenses' });
  }
  const calendar = classifyObligations(obligations, { now, horizon: 30 });
  const upcoming = calendar.upcoming.slice(0, 5).map(row => ({ id: 'tax:' + (row.id || row.calendarKey || `${row.modelo}|${row.periodo}`), day: obligationDay(row), kind: 'tax', label: 'Vencimiento fiscal', detail: `Modelo ${row.code || row.modelo_codigo || row.modelo || ''} · ${row.period || row.periodo || ''}`, amount: finite(row.importe) ? Number(row.importe) : null, route: '/tax-accounting/obligaciones' }));
  return { recent: rows.sort((a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id)).slice(0, 12), upcoming, overdueCount: calendar.overdue.length };
}

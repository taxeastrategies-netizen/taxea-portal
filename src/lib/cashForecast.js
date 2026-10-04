import { getOutstandingAmount } from './financialCore';

const CLOSED = new Set(['presentado', 'domiciliado', 'pagado', 'finalizado', 'no_aplica', 'cancelado']);
const money = value => Math.round((Number(value) || 0) * 100) / 100;
const ymd = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
const addDays = (date, days) => {
  const copy = new Date(date + 'T12:00:00Z');
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
};

export function buildCashForecast({ invoices = [], obligations = [], events = [], treasury = {}, treasuryError = '', today = new Date().toISOString().slice(0, 10), days = 91 } = {}) {
  const opening = Number(treasury.availableCash);
  const hasBankBalance = !treasuryError && Number(treasury.connectedAccounts) > 0 && Number.isFinite(opening);
  const horizon = Math.min(91, Math.max(1, Number(days) || 91));
  const lastDay = addDays(today, horizon - 1);
  const movements = [];
  let undated = 0;
  const add = (kind, id, date, amount, label, certainty, route) => {
    const value = money(amount);
    if (!value) return;
    const due = ymd(date);
    if (!due) { undated++; return; }
    if (due > lastDay) return;
    movements.push({ key: kind + ':' + id, kind, date: due < today ? today : due, originalDate: due, amount: value, label, certainty, route });
  };
  const activeEvents = events.filter(row => !['ejecutado', 'cancelado'].includes(row.estado) && row.moneda !== 'USD' && (!row.moneda || row.moneda === 'EUR'));
  const linked = new Set(activeEvents.filter(row => row.entidad_id).map(row => String(row.entidad_id)));
  for (const invoice of invoices) {
    if (invoice.anulada || linked.has(String(invoice.id)) || invoice.moneda && invoice.moneda !== 'EUR') continue;
    const outstanding = getOutstandingAmount(invoice);
    if (outstanding <= 0.009) continue;
    const date = invoice.fecha_vencimiento;
    const incoming = invoice.tipo === 'emitida';
    // Overdue receivables have no reliable collection date: do not count them as cash.
    if (incoming && ymd(date) && ymd(date) < today) { undated++; continue; }
    add('invoice', invoice.id, date, incoming ? outstanding : -outstanding,
      (incoming ? 'Cobro factura ' : 'Pago factura ') + (invoice.numero_factura || invoice.id),
      'previsto', incoming ? '/finance/ar' : '/finance/ap');
  }
  for (const obligation of obligations) {
    if (CLOSED.has(obligation.estado) || linked.has(String(obligation.id))) continue;
    if (!['a_pagar', 'a_ingresar'].includes(obligation.resultado) || Number(obligation.importe) <= 0) continue;
    add('tax', obligation.id, obligation.fecha_limite_domiciliacion || obligation.fecha_limite_presentacion || obligation.fecha_limite,
      -Math.abs(obligation.importe), 'Modelo ' + (obligation.modelo_codigo || obligation.modelo || ''), 'previsto', '/tax-accounting/obligaciones');
  }
  for (const event of activeEvents) {
    if (event.tipo === 'transferencia_interna') continue;
    const incoming = event.tipo === 'cobro_previsto';
    add('event', event.id, event.fecha_prevista, incoming ? Math.abs(event.importe) : -Math.abs(event.importe),
      event.concepto || 'Evento previsto', event.estado === 'confirmado' ? 'confirmado' : 'previsto', '/finance/treasury');
  }
  movements.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  const points = [];
  let cash = hasBankBalance ? money(opening) : null;
  let index = 0;
  for (let day = 0; day < horizon; day++) {
    const date = addDays(today, day);
    let inflow = 0;
    let outflow = 0;
    while (index < movements.length && movements[index].date === date) {
      const amount = movements[index++].amount;
      if (amount > 0) inflow = money(inflow + amount);
      else outflow = money(outflow - amount);
    }
    if (cash !== null) cash = money(cash + inflow - outflow);
    points.push({ date, day: date.slice(8, 10) + '/' + date.slice(5, 7), entradas: inflow, salidas: outflow, cash });
  }
  const outflows = money(movements.filter(row => row.amount < 0).reduce((sum, row) => sum - row.amount, 0));
  const inflows = money(movements.filter(row => row.amount > 0).reduce((sum, row) => sum + row.amount, 0));
  return {
    hasBankBalance, opening: hasBankBalance ? money(opening) : null,
    points, movements, outflows, inflows, undated,
    projected: hasBankBalance ? points.at(-1).cash : null,
    floor: hasBankBalance ? Math.min(...points.map(row => row.cash)) : null,
    source: hasBankBalance ? 'Saldo bancario conectado + vencimientos y eventos registrados' : 'Sin saldo bancario conectado verificable',
  };
}

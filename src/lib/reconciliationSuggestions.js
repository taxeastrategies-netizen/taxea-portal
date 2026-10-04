import { getOutstandingAmount } from './financialCore';

const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = value => normal(value).split(' ').filter(word => word.length >= 4 && !['factura', 'pago', 'transferencia', 'empresa', 'banco'].includes(word));
const cents = value => Math.round(Math.abs(Number(value) || 0) * 100);
const daysApart = (left, right) => {
  if (!left || !right) return null;
  const a = Date.parse(left.slice(0, 10) + 'T12:00:00Z');
  const b = Date.parse(right.slice(0, 10) + 'T12:00:00Z');
  return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(Math.round((a - b) / 86400000)) : null;
};

export function groupInvoiceCandidates(transaction, invoices = []) {
  if (!transaction || transaction.estado_proveedor === 'pending' || transaction.es_demo) return [];
  const currency = String(transaction.moneda || 'EUR').toUpperCase();
  if (currency !== 'EUR') return [];
  return invoices.flatMap(invoice => {
    if (invoice.anulada || invoice.company_id !== transaction.company_id) return [];
    const credit = Number(invoice.total_factura) < 0;
    const expected = invoice.tipo === 'recibida' ? (credit ? 'entrada' : 'salida') : (credit ? 'salida' : 'entrada');
    if (expected !== transaction.tipo || String(invoice.moneda || 'EUR').toUpperCase() !== currency) return [];
    const outstanding = getOutstandingAmount(invoice);
    return outstanding > 0.009 ? [{ ...invoice, _groupOutstanding: outstanding }] : [];
  }).sort((a, b) => String(b.fecha_emision || '').localeCompare(String(a.fecha_emision || '')));
}

export function suggestInvoiceMatches(transaction, invoices = []) {
  if (!transaction || transaction.estado_proveedor === 'pending' || transaction.es_demo) return [];
  const amount = cents(transaction.importe);
  if (!amount) return [];
  const text = normal([transaction.concepto, transaction.nombre_contraparte, transaction.referencia].join(' '));
  return invoices.flatMap(invoice => {
    if (invoice.anulada || invoice.company_id !== transaction.company_id) return [];
    const credit = Number(invoice.total_factura) < 0;
    const expected = invoice.tipo === 'recibida' ? (credit ? 'entrada' : 'salida') : (credit ? 'salida' : 'entrada');
    if (transaction.tipo !== expected || (transaction.moneda || 'EUR') !== (invoice.moneda || 'EUR')) return [];
    const outstanding = cents(getOutstandingAmount(invoice));
    if (!outstanding || amount > outstanding + 1) return [];
    const reasons = [];
    let score = 0;
    if (Math.abs(amount - outstanding) <= 1) { score += 45; reasons.push('Importe pendiente exacto'); }
    else { score += 22; reasons.push('Pago parcial: quedará saldo pendiente'); }
    const invoiceNumber = normal(invoice.numero_factura);
    const reference = invoiceNumber && text.includes(invoiceNumber);
    if (reference) { score += 30; reasons.push('Número de factura en el banco'); }
    const party = invoice.tipo === 'recibida' ? invoice.proveedor_nombre || invoice.cliente_nombre : invoice.cliente_nombre;
    const partyTokens = tokens(party);
    if (partyTokens.length && partyTokens.some(token => text.includes(token))) { score += 25; reasons.push('Tercero coincidente'); }
    const delta = daysApart(transaction.fecha_operacion, invoice.fecha_vencimiento || invoice.fecha_emision);
    if (delta != null && delta <= 14) { score += 8; reasons.push('Fecha próxima'); }
    if (!reference && !reasons.includes('Tercero coincidente')) reasons.push('Tercero o referencia sin confirmar');
    const confidence = score >= 70 && (reference || reasons.includes('Tercero coincidente')) ? 'alta' : score >= 45 ? 'media' : 'baja';
    return [{ ...invoice, _score: score, _conf: confidence, _reasons: reasons, _partial: amount + 1 < outstanding }];
  }).sort((a, b) => b._score - a._score || String(b.fecha_emision || '').localeCompare(String(a.fecha_emision || ''))).slice(0, 12);
}

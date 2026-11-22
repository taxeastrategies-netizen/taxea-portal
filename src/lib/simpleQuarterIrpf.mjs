import { buildFinancialSummary, invoiceEuroAmount, reconcileFinancialSources } from './financialSourceTruth.js';
import { civilDay, reportingWindow, withinWindow } from './reportingPeriods.mjs';

const money = value => Math.round(value * 100) / 100;
const cancelled = row => row.anulada || [row.estado, row.estado_cobro].some(state => ['borrador', 'anulado', 'anulada', 'cancelado', 'cancelada', 'rechazado', 'rechazada'].includes(String(state || '').toLowerCase()));

// Dashboard budgeting shortcut requested by the client, not a model 130 liquidation.
export function simpleQuarterIrpf({ invoices = [], expenses = [], companyId = '', now = new Date(), timeZone = 'Europe/Madrid', financialError = '' } = {}) {
  const today = civilDay(now, timeZone);
  const year = Number(today.slice(0, 4)), quarter = Math.ceil(Number(today.slice(5, 7)) / 3);
  const window = reportingWindow(`${year}-T${quarter}`, now, timeZone);
  // Reconcile before filtering dates so an old duplicate cannot reappear across a quarter boundary.
  const source = reconcileFinancialSources(invoices.filter(row => !companyId || row.company_id === companyId), expenses.filter(row => !companyId || row.company_id === companyId));
  const issuedDate = row => row.fiscal_document_type === 'F2' && row.fecha_operacion ? row.fecha_operacion : row.fecha_emision;
  const quarterInvoices = source.invoices.filter(row => !cancelled(row) && withinWindow(issuedDate(row), window, timeZone));
  const quarterExpenses = source.expenses.filter(row => !cancelled(row) && withinWindow(row.fecha, window, timeZone));
  const totals = buildFinancialSummary(quarterInvoices, quarterExpenses);
  const known = !financialError && !totals.currencyIssueCount;
  const retained = quarterInvoices.filter(row => row.tipo === 'emitida').reduce((sum, row) => sum + invoiceEuroAmount(row, 'importe_retencion'), 0)
    + quarterExpenses.filter(row => row.tipo === 'ingreso').reduce((sum, row) => sum + invoiceEuroAmount(row, 'importe_retencion'), 0);
  return { year, quarter, start: window.start, end: window.end, income: known ? totals.base_ingresos : null, expenses: known ? totals.base_gastos : null,
    estimate: known ? money(Math.max(0, totals.base_ingresos - totals.base_gastos) * 0.2) : null, retained: known ? money(retained) : null };
}

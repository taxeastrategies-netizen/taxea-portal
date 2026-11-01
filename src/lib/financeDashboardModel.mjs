import { calculateFinancialKPIs, getOutstandingAmount } from './financialCore.js';
import { deriveAccountingEbitda } from './verifiedFinancialMetrics.js';
import { bankObservation, bankFlows } from './observedBanking.mjs';
export { bankObservation, bankFlows } from './observedBanking.mjs';
import { reportingWindow, withinWindow, civilDay, daysBetween, classifyObligations } from './reportingPeriods.mjs';
const money = value => Math.round((Number(value) || 0) * 100) / 100;
const lower = value => String(value || '').trim().toLowerCase();
const closedInvoice = row => row.anulada || ['anulada', 'cancelada', 'cancelado', 'borrador'].includes(lower(row.estado_cobro || row.estado));

export function buildFinanceDashboardModel({ invoices = [], expenses = [], bankAccounts = [], bankTransactions = [], obligations = [], accountingPeriod = null, accountingError = '', financialError = '', treasuryError = '', period = '30d', now = new Date() } = {}) {
  const window = accountingPeriod?.window || reportingWindow(period, now);
  const active = invoices.filter(row => !closedInvoice(row));
  const filteredInvoices = active.filter(row => withinWindow(row.fecha_emision, window, window.timeZone));
  const filteredExpenses = expenses.filter(row => !row.anulada && withinWindow(row.fecha, window, window.timeZone));
  const document = calculateFinancialKPIs(filteredInvoices, filteredExpenses);
  const observation = bankObservation(bankAccounts, bankTransactions, { now, treasuryError, timeZone: window.timeZone });
  const flows = bankFlows(observation, window), previousFlows = bankFlows(observation, window.previous);
  const report = accountingPeriod?.current;
  const accountingKnown = !accountingError && report?.includedEntries > 0 && Boolean(report.profitAndLoss);
  const pnl = accountingKnown ? report.profitAndLoss : null;
  const ebitda = accountingKnown ? deriveAccountingEbitda(report) : null;
  const portfolio = active.filter(row => !['cobrada', 'pagada', 'anulada', 'cancelada'].includes(lower(row.estado_cobro)));
  const pending = type => !financialError ? money(portfolio.filter(row => row.tipo === type).reduce((sum, row) => sum + (Number(row.total_factura) < 0 ? -1 : 1) * getOutstandingAmount(row), 0)) : null;
  const cobrosPendientes = pending('emitida'), pagosPendientes = pending('recibida');
  const measured = type => active.filter(row => row.tipo === type && ['cobrada', 'pagada'].includes(lower(row.estado_cobro)) && withinWindow(row.ultimo_pago_at, window, window.timeZone)).map(row => daysBetween(civilDay(row.fecha_emision, window.timeZone), civilDay(row.ultimo_pago_at, window.timeZone))).filter(value => Number.isFinite(value) && value >= 0);
  const collections = measured('emitida'), payments = measured('recibida');
  const previousPnl = accountingPeriod?.previous;
  const ingresosDelta = accountingKnown && previousPnl?.includedEntries > 0 && previousPnl.profitAndLoss.totalIncome > 0 ? money((pnl.totalIncome - previousPnl.profitAndLoss.totalIncome) / previousPnl.profitAndLoss.totalIncome * 100) : null;
  const today = civilDay(now, window.timeZone);
  const vencidas = !financialError ? portfolio.filter(row => row.tipo === 'emitida' && Number(row.total_factura) > 0 && civilDay(row.fecha_vencimiento) && civilDay(row.fecha_vencimiento) < today && getOutstandingAmount(row) > 0) : [];
  const bankActivityKnown = observation.bankKnown && observation.activityKnown && flows.count > 0;
  const observedDays = flows.first ? daysBetween(flows.first, window.end) + 1 : 0;
  const cashHistorySufficient = bankActivityKnown && window.days >= 30 && observedDays >= 28;
  const burnRate = cashHistorySufficient ? money(flows.outflows / window.days * 30) : null;
  const runway = burnRate > 0 && observation.cash !== null ? money(Math.max(0, observation.cash) / burnRate) : null;
  const monthly = accountingPeriod?.monthly || [];
  return {
    window, periodDays: window.days, accountingKnown, accountingProvisional: accountingKnown && (report.pendingEntriesInYear > 0 || report.excludedEntries > 0 || report.frameworkReviewStatus !== 'validated'),
    accountingPending: report?.pendingEntriesInYear || 0, accountingExcluded: report?.excludedEntries || 0,
    totalIngresos: pnl?.totalIncome ?? null, gastoTotal: pnl?.totalExpenses ?? null, beneficio: pnl?.result ?? null,
    margenNeto: pnl?.totalIncome > 0 ? money(pnl.result / pnl.totalIncome * 100) : null,
    ebitda: ebitda?.value ?? null, ebitdaProvisional: ebitda?.provisional ?? true,
    documentIncomeNet: !financialError ? document.baseIngresos : null, documentExpenseNet: !financialError ? document.baseGastos : null,
    documentIncomeGross: !financialError ? document.totalIngresos : null, documentExpenseGross: !financialError ? document.totalGastos : null,
    bankKnown: observation.bankKnown, cashDisponible: observation.cash, cashSource: observation.bankKnown ? 'bank' : 'unavailable',
    bankConnected: observation.connected, bankReasons: observation.reasons, bankUnreconciled: observation.rows.filter(row => !['conciliada_auto', 'conciliada_manual', 'conciliado'].includes(lower(row.estado_conciliacion))).length,
    duplicateBankAccounts: observation.duplicateAccounts, duplicateBankTransactions: observation.duplicateTransactions,
    bankActivityKnown, bankInflows: bankActivityKnown ? flows.inflows : null, bankOutflows: bankActivityKnown ? flows.outflows : null, bankNet: bankActivityKnown ? flows.net : null,
    bankDelta: bankActivityKnown && previousFlows.count > 0 && previousFlows.inflows > 0 ? money((flows.inflows - previousFlows.inflows) / previousFlows.inflows * 100) : null,
    burnRate, runway, cashHistorySufficient,
    dso: collections.length ? money(collections.reduce((a, b) => a + b, 0) / collections.length) : null,
    dpo: payments.length ? money(payments.reduce((a, b) => a + b, 0) / payments.length) : null,
    dsoSample: collections.length, dpoSample: payments.length,
    cobrosPendientes, pagosPendientes, workingCapital: cobrosPendientes === null || pagosPendientes === null ? null : money(cobrosPendientes - pagosPendientes),
    upcoming: classifyObligations(obligations, { now, horizon: 30, timeZone: window.timeZone }).upcoming,
    overdueObligations: classifyObligations(obligations, { now, horizon: 30, timeZone: window.timeZone }).overdue,
    vencidas, ingresosDelta, filteredInvoices, filteredExpenses, observation,
    sparkData: { ingresos: monthly.map(row => row.includedEntries ? row.income : null), gastos: monthly.map(row => row.includedEntries ? row.expenses : null), beneficio: monthly.map(row => row.includedEntries ? row.result : null), cash: null },
    financialError, accountingError, treasuryError,
  };
}

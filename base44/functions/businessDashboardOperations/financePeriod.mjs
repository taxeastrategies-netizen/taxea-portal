import { accountingData, buildReports } from './accountingReportEngine.ts';
import { reportingWindow, withinWindow, civilDay } from './reportingPeriods.mjs';
const money = value => Math.round((Number(value) || 0) * 100) / 100;
const mergeById = arrays => [...new Map(arrays.flat().map(row => [row.id, row])).values()];

export async function loadFinancePeriodData(service, companyId, window) {
  const year = Number(window.end.slice(0, 4));
  const firstYear = Number(window.previous.start.slice(0, 4));
  const current = await accountingData(service, companyId, { year, includeBusinessData: false });
  if (firstYear >= year - 1) return current;
  const earlier = await accountingData(service, companyId, { year: firstYear + 1, includeBusinessData: false });
  const entries = mergeById([earlier.entries, current.entries]);
  const lines = mergeById([earlier.lines, current.lines]);
  const linesByEntry = new Map();
  for (const [entryId, rows] of [...earlier.linesByEntry, ...current.linesByEntry]) linesByEntry.set(entryId, mergeById([linesByEntry.get(entryId) || [], rows]));
  return { ...current, entries, lines, linesByEntry, operationById: new Map([...earlier.operationById, ...current.operationById]) };
}

export function reportForWindow(data, window) {
  const entries = data.entries.filter(entry => withinWindow(entry.date, window));
  const years = [...new Set(entries.map(entry => Number(entry.ejercicio || String(entry.date || '').slice(0, 4))).filter(Boolean))];
  const reports = years.map(year => buildReports({ ...data, entries }, { year, scope: 'confirmed', withoutComparative: true }));
  const combine = field => {
    const totals = new Map();
    for (const report of reports) for (const row of report.profitAndLoss[field]) {
      const previous = totals.get(row.code) || { ...row, amount: 0, debit: 0, credit: 0, movements: 0 };
      for (const key of ['amount', 'debit', 'credit', 'movements']) previous[key] = money(previous[key] + Number(row[key] || 0));
      totals.set(row.code, previous);
    }
    return [...totals.values()];
  };
  const income = combine('income'), expenses = combine('expenses');
  const totalIncome = money(income.reduce((sum, row) => sum + row.amount, 0));
  const totalExpenses = money(expenses.reduce((sum, row) => sum + row.amount, 0));
  return {
    year: Number(window.end.slice(0, 4)), window,
    includedEntries: reports.reduce((sum, report) => sum + report.includedEntries, 0),
    excludedEntries: reports.reduce((sum, report) => sum + report.excludedEntries, 0),
    pendingEntriesInYear: entries.filter(entry => ['borrador', 'pendiente_revision'].includes(entry.status)).length,
    frameworkReviewStatus: data.configuration?.frameworkReviewStatus || 'pendiente_asesor',
    profitAndLoss: { income, expenses, totalIncome, totalExpenses, result: money(totalIncome - totalExpenses) },
    source: 'asientos_confirmados_cuadrados',
  };
}

export function buildFinancePeriod(data, { period = '30d', now = new Date(), timeZone = 'Europe/Madrid' } = {}) {
  const window = reportingWindow(period, now, timeZone);
  const monthly = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(window.end + 'T12:00:00Z');
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - (6 - index));
    const start = date.toISOString().slice(0, 10);
    date.setUTCMonth(date.getUTCMonth() + 1); date.setUTCDate(0);
    const end = [date.toISOString().slice(0, 10), window.end].sort()[0];
    const report = reportForWindow(data, { start, end });
    return { month: start.slice(0, 7), income: report.profitAndLoss.totalIncome, expenses: report.profitAndLoss.totalExpenses, result: report.profitAndLoss.result, includedEntries: report.includedEntries };
  });
  return { version: 'finance-period-v1', generatedAt: new Date(now).toISOString(), window, current: reportForWindow(data, window), previous: reportForWindow(data, window.previous), monthly };
}

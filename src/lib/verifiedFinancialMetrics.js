/** EBITDA contable orientativo: resultado confirmado más conceptos fuera de explotación.
 * Nunca aplica porcentajes presuntos a las facturas. El usuario debe revisar
 * la clasificación PGC y los asientos pendientes antes de usarlo externamente.
 */
export function deriveAccountingEbitda(report) {
  const pnl = report?.profitAndLoss;
  if (!pnl || !Array.isArray(pnl.income) || !Array.isArray(pnl.expenses) || !Number.isFinite(Number(pnl.result)) || Number(report.includedEntries || 0) === 0) return null;
  const amount = rows => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const expenses = pnl.expenses;
  const income = pnl.income;
  const addBack = amount(expenses.filter(row => /^(66|68|630|633|638|639)/.test(String(row.code || ''))));
  const remove = amount(income.filter(row => /^76/.test(String(row.code || ''))));
  return {
    value: Math.round((Number(pnl.result) + addBack - remove) * 100) / 100,
    provisional: Number(report.pendingEntriesInYear || 0) > 0 || Number(report.excludedEntries || 0) > 0 || report.frameworkReviewStatus !== 'validated',
    year: report.year,
    includedEntries: Number(report.includedEntries || 0),
    pendingEntries: Number(report.pendingEntriesInYear || 0),
    excludedEntries: Number(report.excludedEntries || 0),
  };
}

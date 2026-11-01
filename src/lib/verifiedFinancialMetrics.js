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

/** Readiness describes source coverage, not financial health or tax certification. */
export function financialReportReadiness({financials=/** @type {{bankKnown?:boolean,accountingKnown?:boolean,accountingEbitda?:object|null}} */({}),financialError='',treasuryError='',auxiliaryError='',calendarError=false}={}) {
  const reasons=[];
  if(financialError)reasons.push('La lectura documental no está actualizada.');
  if(treasuryError || !financials.bankKnown)reasons.push('Falta un saldo bancario EUR reciente y verificable.');
  if(auxiliaryError || !financials.accountingKnown || !financials.accountingEbitda)reasons.push('Falta la PyG contable confirmada del ejercicio.');
  if(calendarError)reasons.push('No se pudo actualizar el calendario fiscal.');
  return {ready:reasons.length===0,reasons};
}

export function financialScoringReadiness(financials) {
 return Boolean(financials?.bankKnown && financials?.accountingKnown && !financials.accountingProvisional && financials.cashHistorySufficient && Number.isFinite(financials.runway) && Number.isFinite(financials.dso) && Number.isFinite(financials.margen));
}
export function financialExportNumber(value) {
 if(!['number','string'].includes(typeof value) || value === null || typeof value === 'string' && !value.trim() || !Number.isFinite(Number(value)))return 'No verificable';
 return Math.round(Number(value)*100)/100;
}

export function financialPercentLabel(value) {
 if(value===null || value===undefined || value==='' || typeof value==='string' && !value.trim() || typeof value==='boolean' || !Number.isFinite(Number(value)))return 'No verificable';
 return Number(value).toFixed(1)+'%';
}

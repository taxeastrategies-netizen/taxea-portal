import { classifyObligations } from './reportingPeriods.mjs';
const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

export function fiscalCoverage(fiscal) {
  const profile = fiscal?.profile;
  const configured = Boolean(profile && profile.active !== false);
  const reviewed = configured && profile.profileStatus === 'validado_asesor';
  const models = fiscal?.models?.length || 0;
  const items = fiscal?.items?.length || 0;
  const calendarPending = Number(fiscal?.fiscalYear) > Number(fiscal?.verifiedCalendarYear);
  const undated = classifyObligations(fiscal?.items || []).undated.length;
  const active = reviewed && models > 0 && items > 0 && !calendarPending && !undated;
  const reason = !configured ? 'Falta configurar el perfil fiscal.' : !reviewed ? 'El perfil fiscal está pendiente de validación por el asesor.' : !models || !items ? 'No hay modelos y obligaciones suficientes para evaluar el cumplimiento.' : undated ? 'Hay obligaciones abiertas sin fecha verificable.' : calendarPending ? 'El calendario del ejercicio está pendiente de contraste oficial.' : '';
  return { configured, reviewed, models, items, active, reason };
}

export function computeBusinessHealth(summary, fiscal, { now = new Date(), stale = false } = {}) {
  if (!summary) return { score: null, coverage: 0, dimensions: [], reasons: ['Esperando datos operativos.'] };
  const dimensions = [];
  const add = (key, label, weight, active, rawScore, reasons = []) => dimensions.push({ key, label, weight, active, score: active ? clamp(rawScore) : null, reasons });

  const quality = summary.accounting?.quality || {};
  const accountingActive = Number(quality.entries || 0) > 0 || Number(quality.activeInvoices || 0) > 0;
  let accountingScore = 100;
  const accountingReasons = [];
  if (quality.activeInvoices > 0 && quality.confirmedEntries === 0) { accountingScore -= 30; accountingReasons.push('Hay facturas, pero no asientos confirmados en el ejercicio.'); }
  const unbalanced = Number(quality.unbalancedEntries || 0) + Number(quality.entriesWithoutLines || 0);
  if (unbalanced) { accountingScore -= Math.min(50, unbalanced * 12); accountingReasons.push(`${unbalanced} asiento(s) sin líneas o descuadrados.`); }
  if (quality.pendingInvoicePostings) { accountingScore -= Math.min(35, (quality.pendingInvoicePostings / Math.max(1, quality.activeInvoices)) * 35); accountingReasons.push(`${quality.pendingInvoicePostings} factura(s) sin asiento confirmado y cuadrado.`); }
  if (quality.reviewEntries) { accountingScore -= Math.min(15, quality.reviewEntries * 3); accountingReasons.push(`${quality.reviewEntries} asiento(s) pendientes de revisión.`); }
  add('accounting', 'Contabilidad', 25, accountingActive, accountingScore, accountingReasons);

  const treasury = summary.treasury || {};
  const unavailable = summary.sourceErrors || {};
  const treasuryActive = treasury.balanceKnown === true && treasury.activityKnown !== false && !unavailable.BankAccount && !unavailable.BankTransaction;
  let treasuryScore = treasury.connectedAccounts ? 100 : 40;
  const treasuryReasons = [];
  if (!treasuryActive) treasuryReasons.push('No hay un saldo bancario reciente verificable; tesorería no puntúa.');
  if (treasury.connectionIssues) { treasuryScore -= Math.min(40, treasury.connectionIssues * 20); treasuryReasons.push(`${treasury.connectionIssues} conexión(es) bancaria(s) requieren atención.`); }
  if (treasury.transactions && treasury.unreconciled) { treasuryScore -= Math.min(45, (treasury.unreconciled / treasury.transactions) * 45); treasuryReasons.push(`${treasury.unreconciled} movimiento(s) bancarios sin conciliar.`); }
  if (treasury.stale) { treasuryScore -= 15; treasuryReasons.push('La última sincronización bancaria supera 72 horas.'); }
  add('treasury', 'Tesorería', 20, treasuryActive, treasuryScore, treasuryReasons);

  const receivables = summary.finance?.receivables || {};
  const payables = summary.finance?.payables || {};
  const financeActive = accountingActive || receivables.documents > 0 || payables.documents > 0;
  let financeScore = 100;
  const financeReasons = [];
  if (receivables.overdue) { financeScore -= Math.min(35, receivables.overdue * 7); financeReasons.push(`${receivables.overdue} cobro(s) vencidos.`); }
  if (payables.overdue) { financeScore -= Math.min(30, payables.overdue * 6); financeReasons.push(`${payables.overdue} pago(s) vencidos.`); }
  if (summary.accounting?.pnl?.result < 0) { financeScore -= 20; financeReasons.push('El resultado contable confirmado es negativo.'); }
  if (treasuryActive && payables.overdueAmount > 0 && treasury.cashEur < payables.overdueAmount) { financeScore -= 15; financeReasons.push('El saldo EUR observado no cubre las facturas vencidas por pagar.'); }
  add('finance', 'Finanzas', 20, financeActive, financeScore, financeReasons);

  const fiscalItems = fiscal?.items || [];
  const readiness = fiscalCoverage(fiscal);
  const fiscalDates = classifyObligations(fiscalItems, { now, horizon: 15 });
  const overdueFiscal = fiscalDates.overdue;
  const urgentFiscal = fiscalDates.upcoming;
  let fiscalScore = 100;
  const fiscalReasons = [];
  if (!readiness.active) fiscalReasons.push(readiness.reason);
  if (overdueFiscal.length) { fiscalScore -= Math.min(60, overdueFiscal.length * 15); fiscalReasons.push(`${overdueFiscal.length} obligación(es) vencidas.`); }
  if (urgentFiscal.length) { fiscalScore -= Math.min(20, urgentFiscal.length * 5); fiscalReasons.push(`${urgentFiscal.length} obligación(es) vencen en 15 días.`); }
  if (fiscal?.unlinkedDocuments?.length) { fiscalScore -= Math.min(20, fiscal.unlinkedDocuments.length * 2); fiscalReasons.push(`${fiscal.unlinkedDocuments.length} documento(s) fiscales sin vincular.`); }
  add('fiscal', 'Fiscalidad', 20, readiness.active, fiscalScore, fiscalReasons);

  const people = summary.people || {};
  const laborActive = !['Employee','HRAbsence','HRDocument','LaborOcrDocument','PayrollExtraction','SocialSecurityExtraction'].some(name => unavailable[name]) && (people.employees > 0 || people.payrollExtractions > 0 || people.socialSecurityExtractions > 0 || people.laborDocumentsReview > 0);
  let laborScore = 100;
  const laborReasons = [];
  if (people.laborDocumentsReview) { laborScore -= Math.min(40, people.laborDocumentsReview * 10); laborReasons.push(`${people.laborDocumentsReview} documento(s) laborales requieren revisión.`); }
  if (people.expiredDocuments || people.pendingSignature) { laborScore -= Math.min(30, (people.expiredDocuments + people.pendingSignature) * 6); laborReasons.push(`${people.expiredDocuments + people.pendingSignature} documento(s) pendientes o expirados.`); }
  if (people.pendingAbsences) { laborScore -= Math.min(20, people.pendingAbsences * 5); laborReasons.push(`${people.pendingAbsences} ausencia(s) pendientes.`); }
  add('labor', 'Laboral', 10, laborActive, laborScore, laborReasons);

  const operations = summary.operations || {};
  let operationsScore = 100;
  const operationsReasons = [];
  if (operations.criticalErrors) { operationsScore -= Math.min(75, operations.criticalErrors * 25); operationsReasons.push(`${operations.criticalErrors} incidencia(s) críticas abiertas.`); }
  add('operations', 'Incidencias', 5, !unavailable.FiscalError && (accountingActive || treasuryActive || laborActive || readiness.active || Number(summary.documents?.total || 0) > 0), operationsScore, operationsReasons);

  const active = dimensions.filter((dimension) => dimension.active);
  const activeWeight = active.reduce((sum, dimension) => sum + dimension.weight, 0);
  const score = activeWeight ? Math.round(active.reduce((sum, dimension) => sum + dimension.score * dimension.weight, 0) / activeWeight) : null;
  const reasons = [...active.flatMap((dimension) => dimension.reasons.map((reason) => ({ reason, score: dimension.score }))).sort((a, b) => a.score - b.score).map((item) => item.reason), ...dimensions.filter(dimension => !dimension.active).flatMap(dimension => dimension.reasons)].slice(0, 6);
  const sourcesComplete = Object.keys(unavailable).length === 0;
  const coreComplete = accountingActive && treasuryActive && readiness.active && sourcesComplete;
  if (!coreComplete) reasons.unshift(sourcesComplete ? 'La puntuación global requiere contabilidad, calendario fiscal validado y saldo bancario verificable.' : 'Hay fuentes sin actualizar; la puntuación global queda sin verificar.');
  if (stale) reasons.unshift('La actualización no está completa; la puntuación queda sin verificar.');
  return { score: stale || !coreComplete ? null : score, coverage: activeWeight, dimensions, reasons };
}


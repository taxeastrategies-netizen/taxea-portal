const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

export function computeBusinessHealth(summary, fiscal) {
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
  const treasuryActive = Number(treasury.accounts || 0) > 0 || Number(treasury.transactions || 0) > 0 || accountingActive;
  let treasuryScore = treasury.connectedAccounts ? 100 : 40;
  const treasuryReasons = [];
  if (!treasury.connectedAccounts) treasuryReasons.push('No hay una cuenta bancaria conectada y activa.');
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
  if (payables.overdueAmount > 0 && treasury.cashEur < payables.overdueAmount) { financeScore -= 15; financeReasons.push('La tesorería EUR no cubre los pagos vencidos registrados.'); }
  add('finance', 'Finanzas', 20, financeActive, financeScore, financeReasons);

  const fiscalItems = fiscal?.items || [];
  const openStates = new Set(['pendiente', 'pendiente_documentacion', 'en_preparacion', 'borrador', 'rechazado']);
  const today = new Date().toISOString().slice(0, 10);
  const openFiscal = fiscalItems.filter((item) => openStates.has(String(item.state || '').toLowerCase()));
  const overdueFiscal = openFiscal.filter((item) => item.filingDeadline && item.filingDeadline < today);
  const urgentFiscal = openFiscal.filter((item) => item.filingDeadline && item.filingDeadline >= today && (new Date(item.filingDeadline) - new Date(today)) / 86400000 <= 15);
  let fiscalScore = fiscal?.profile ? 100 : 35;
  const fiscalReasons = [];
  if (!fiscal?.profile) fiscalReasons.push('Falta completar o validar el perfil fiscal.');
  if (overdueFiscal.length) { fiscalScore -= Math.min(60, overdueFiscal.length * 15); fiscalReasons.push(`${overdueFiscal.length} obligación(es) vencidas.`); }
  if (urgentFiscal.length) { fiscalScore -= Math.min(20, urgentFiscal.length * 5); fiscalReasons.push(`${urgentFiscal.length} obligación(es) vencen en 15 días.`); }
  if (fiscal?.unlinkedDocuments?.length) { fiscalScore -= Math.min(20, fiscal.unlinkedDocuments.length * 2); fiscalReasons.push(`${fiscal.unlinkedDocuments.length} documento(s) fiscales sin vincular.`); }
  add('fiscal', 'Fiscalidad', 20, true, fiscalScore, fiscalReasons);

  const people = summary.people || {};
  const laborActive = people.employees > 0 || people.payrollExtractions > 0 || people.socialSecurityExtractions > 0 || people.laborDocumentsReview > 0;
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
  if (operations.overdueTasks) { operationsScore -= Math.min(50, operations.overdueTasks * 10); operationsReasons.push(`${operations.overdueTasks} tarea(s) vencidas.`); }
  add('operations', 'Operaciones', 5, true, operationsScore, operationsReasons);

  const active = dimensions.filter((dimension) => dimension.active);
  const activeWeight = active.reduce((sum, dimension) => sum + dimension.weight, 0);
  const score = activeWeight ? Math.round(active.reduce((sum, dimension) => sum + dimension.score * dimension.weight, 0) / activeWeight) : null;
  const reasons = active.flatMap((dimension) => dimension.reasons.map((reason) => ({ reason, score: dimension.score }))).sort((a, b) => a.score - b.score).map((item) => item.reason).slice(0, 4);
  return { score, coverage: activeWeight, dimensions, reasons };
}


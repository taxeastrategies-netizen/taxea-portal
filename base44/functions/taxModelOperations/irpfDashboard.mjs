import { invoiceEuroAmount } from './financialSourceTruth.js';
import { verifiedCompanyAssignment } from './verifiedCompanyAssignment.mjs';
import { taxModelCompanyAllowed, taxModelUserEnabled, taxModelValidation } from './taxModelAccess.mjs';

const text = value => String(value ?? '').trim();
const money = value => Math.round((Number(value) || 0) * 100) / 100;
const day = value => text(value).slice(0, 10);
const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const sameTenant = (rows, id, field) => rows.filter(row => row[field] === id);
const activeInvoice = row => !row.anulada && !['borrador', 'anulado', 'anulada', 'rechazado', 'rechazada'].includes(text(row.estado).toLowerCase());

export async function authorizeIrpfDashboard(svc, user, companyId, company) {
  if (!taxModelUserEnabled(user)) throw taxModelValidation('Acceso no permitido.', 403);
  if (!company || company.id !== companyId) throw taxModelValidation('Empresa no encontrada.', 404);
  if (taxModelCompanyAllowed(user, companyId, company)) return;
  if (company.activa !== false && company.active !== false && await verifiedCompanyAssignment(svc, user, companyId)) return;
  throw taxModelValidation('No tienes acceso a esta empresa.', 403);
}

export function irpfDashboardPeriod(body, company, now = new Date()) {
  const year = Number(body.ejercicio);
  const requestedEnd = text(body.cutoff);
  const windowStart = text(body.windowStart || `${year}-01-01`);
  const timeZone = company.timezone === 'Atlantic/Canary' ? 'Atlantic/Canary' : 'Europe/Madrid';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !validDay(requestedEnd) || Number(requestedEnd.slice(0, 4)) !== year || !validDay(windowStart) || windowStart < `${year}-01-01` || windowStart > requestedEnd || requestedEnd > today) {
    throw taxModelValidation('El período de estimación IRPF no es válido.', 400);
  }
  const quarter = Math.ceil(Number(requestedEnd.slice(5, 7)) / 3);
  const quarterEnd = new Date(Date.UTC(year, quarter * 3, 0)).toISOString().slice(0, 10);
  return { year, cutoff: requestedEnd, windowStart, quarter: `${quarter}T`, cumulativeStart: `${year}-01-01`, quarterStart: `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`, quarterEnd, partialQuarter: requestedEnd !== quarterEnd };
}

async function all(entity, query, sort = 'created_date') {
  const rows = [], limit = 5000;
  for (let skip = 0; skip < 100000; skip += limit) {
    const page = await entity.filter(query, sort, limit, skip);
    rows.push(...(page || []));
    if (!page || page.length < limit) return rows;
  }
  throw taxModelValidation('Demasiados registros para completar la estimación. Acota el ejercicio.', 422);
}

// Read-only projection: never creates a period, draft, payment or journal entry.
export async function loadIrpfDashboard(svc, company, period, engine) {
  const companyId = company.id;
  const queries = [
    ['entries', 'JournalEntry', { companyId, ejercicio: period.year }, 'companyId'],
    ['entryLines', 'JournalEntryLine', { companyId, ejercicio: period.year }, 'companyId'],
    ['operations', 'AccountingPostingOperation', { companyId }, 'companyId'],
    ['invoices', 'Invoice', { company_id: companyId }, 'company_id'],
    ['invoicePayments', 'InvoicePayment', { company_id: companyId }, 'company_id'],
    ['profiles', 'FiscalProfile', { company_id: companyId }, 'company_id'],
    ['activities', 'FiscalActivity', { company_id: companyId }, 'company_id'],
    ['models', 'TaxModel', { companyId, codigo: '130' }, 'companyId'],
    ['filings', 'TaxFiling', { companyId, modeloCodigo: '130', ejercicio: period.year }, 'companyId'],
    ['drafts', 'TaxDraft', { companyId, modeloCodigo: '130', ejercicio: period.year }, 'companyId'],
  ];
  const rows = await Promise.all(queries.map(async ([key, entity, query, field]) => [key, sameTenant(await all(svc.entities[entity], query), companyId, field)]));
  return buildIrpfDashboard(Object.fromEntries(rows), companyId, period, engine);
}

function applicable(profile, activities, models) {
  const active130 = models.some(row => row.codigo === '130' && row.activo !== false);
  const obligated = activities.some(row => row.model130Treatment === 'obligado');
  if (['sociedad', 'asociacion_fundacion', 'entidad_publica'].includes(profile?.entityType)) return { state: 'not_applicable', label: 'No corresponde modelo 130' };
  if (profile?.irpfEstimation === 'objetiva_modulos') return { state: 'model131', label: 'Estimación objetiva · modelo 131' };
  if (profile?.model130ExemptionConfirmed === true && !obligated && !active130) return { state: 'exempt', label: 'Exclusión del 130 confirmada' };
  if (activities.some(row => ['agricola_ganadera', 'forestal'].includes(row.activityType) || ['agricola_ganadera', 'agricultura_ganaderia_pesca'].includes(row.indirectTaxRegime))) return { state: 'special_activity', label: 'Actividad agraria · requiere desglose específico' };
  if (profile?.model130ExemptionConfirmed === true && (obligated || active130)) return { state: 'conflicting', label: 'Configuración del 130 contradictoria' };
  if (profile?.subjectToIRPF === true && ['directa_normal', 'directa_simplificada'].includes(profile.irpfEstimation)) return { state: active130 || obligated ? 'applicable' : 'unconfirmed', label: active130 || obligated ? 'Estimación directa' : 'Estimación directa · obligación por confirmar' };
  return { state: 'unconfigured', label: 'Configura la obligación de IRPF' };
}

const stableAdjustments = new Set(['previousPayments', 'priorNegativeResults', 'previousYearNetIncome', 'article110Reduction', 'applyDifficultJustificationExpenses', 'difficultJustificationRate', 'sectionOnePercentage', 'agriculturePercentage']);
const allowedAdjustments = new Set([...stableAdjustments, 'additionalComputableIncome', 'nonComputableAccountingIncome', 'additionalDeductibleExpenses', 'nonDeductibleAccountingExpenses', 'withholdings', 'agricultureRevenue', 'agricultureWithholdings', 'housingDeduction', 'previousSamePeriodResult']);

export function buildIrpfDashboard(rows, companyId, period, engine) {
  const warnings = [];
  const profiles = [...rows.profiles].filter(row => row.active !== false && (!row.effectiveFrom || day(row.effectiveFrom) <= period.cutoff) && (!row.effectiveTo || day(row.effectiveTo) >= period.cutoff)).sort((a, b) => text(b.updated_date || b.created_date).localeCompare(text(a.updated_date || a.created_date)));
  const profile = profiles[0] || null;
  const activities = rows.activities.filter(row => row.active !== false && (!row.startDate || day(row.startDate) <= period.cutoff) && (!row.endDate || day(row.endDate) >= period.cumulativeStart));
  const applicability = applicable(profile, activities, rows.models.filter(row => (!row.fechaAlta || day(row.fechaAlta) <= period.cutoff) && (!row.fechaBaja || day(row.fechaBaja) >= period.cutoff)));
  const operationById = new Map(rows.operations.map(row => [row.id, row]));
  const linesByEntry = new Map();
  const aliases = new Map(rows.entries.flatMap(row => [[row.id, row.id], ...(row.importKey ? [[row.importKey, row.id]] : [])]));
  for (const line of rows.entryLines) {
    const id = aliases.get(line.journalEntryId) || aliases.get(line.importKey) || aliases.get(line.asientoKey);
    if (id) linesByEntry.set(id, [...(linesByEntry.get(id) || []), line]);
  }
  const entries = [], entryLines = [];
  let excludedEntries = 0;
  for (const entry of rows.entries) {
    const date = day(entry.date);
    if (date < period.cumulativeStart || date > period.cutoff || entry.status !== 'confirmado') continue;
    if (['apertura', 'cierre', 'regularizacion', 'regularización', 'opening', 'closing', 'regularization'].includes(text(entry.type || entry.entryType).toLowerCase()) || ['opening', 'closing', 'regularization', 'apertura', 'cierre', 'regularizacion'].includes(text(entry.sourceEvent).toLowerCase())) continue;
    const lines = (linesByEntry.get(entry.id) || []).map(line => ({ ...line, journalEntryId: entry.id, debit: Number(line.debit || line.debeE || 0), credit: Number(line.credit || line.haberE || 0) }));
    const valid = lines.length >= 2 && lines.every(line => /^\d{3,}$/.test(text(line.accountCode || line.subcuenta)) && Number.isFinite(line.debit) && Number.isFinite(line.credit)) && Math.abs(money(lines.reduce((sum, line) => sum + line.debit - line.credit, 0))) <= 0.01 && (!entry.accountingOperationId || operationById.get(entry.accountingOperationId)?.status === 'committed');
    if (!valid) { excludedEntries += 1; continue; }
    entries.push({ ...entry, isBalanced: true }); entryLines.push(...lines);
  }
  if (excludedEntries) warnings.push(`${excludedEntries} asiento(s) excluidos por descuadre o contabilización incompleta.`);
  const invoices = rows.invoices.filter(activeInvoice);
  const invoicePayments = rows.invoicePayments.filter(row => (!row.operation_status || row.operation_status === 'committed') && (!row.accounting_operation_id || operationById.get(row.accounting_operation_id)?.status === 'committed'));
  const invoiceTotals = { issued: 0, received: 0, issuedPeriod: 0, receivedPeriod: 0, issuedCount: 0, receivedCount: 0, excludedFx: 0 };
  for (const invoice of invoices) {
    const date = day(invoice.fecha_operacion || invoice.fecha_emision);
    if (date < period.cumulativeStart || date > period.cutoff || !['emitida', 'recibida'].includes(invoice.tipo)) continue;
    const currency = text(invoice.moneda || invoice.currency || 'EUR').toUpperCase();
    if (currency !== 'EUR' && !(Number(invoice.exchange_rate) > 0)) { invoiceTotals.excludedFx += 1; continue; }
    const value = invoiceEuroAmount(invoice, 'importe_retencion');
    const key = invoice.tipo === 'emitida' ? 'issued' : 'received';
    invoiceTotals[key] = money(invoiceTotals[key] + value);
    if (Math.abs(value) > 0.009) invoiceTotals[key + 'Count'] += 1;
    if (date >= period.windowStart) invoiceTotals[key + 'Period'] = money(invoiceTotals[key + 'Period'] + value);
  }
  if (invoiceTotals.excludedFx) warnings.push(`${invoiceTotals.excludedFx} factura(s) en divisa sin cambio válido, excluidas del acumulado documental de IRPF.`);
  const draft = rows.drafts.filter(row => text(row.periodo).replace(/^T([1-4])$/, '$1T') === period.quarter && !['descartado', 'anulado'].includes(row.estado)).sort((a, b) => Number(b.version || 0) - Number(a.version || 0) || text(b.updated_date || b.created_date).localeCompare(text(a.updated_date || a.created_date)))[0];
  const adjustments = {};
  let omittedAdjustments = 0;
  for (const item of draft?.ajustesManuales || []) {
    if (!allowedAdjustments.has(item.field)) continue;
    if (period.partialQuarter && !stableAdjustments.has(item.field)) { omittedAdjustments += 1; continue; }
    if (item.field === 'applyDifficultJustificationExpenses') { if (typeof item.value === 'boolean') adjustments[item.field] = item.value; }
    else if (item.value !== '' && item.value != null && Number.isFinite(Number(item.value))) adjustments[item.field] = Number(item.value);
  }
  if (omittedAdjustments) warnings.push('Los ajustes de importes del borrador trimestral solo se incorporan al seleccionar el trimestre completo. El corte parcial usa datos actuales.');
  const data = { entries, entryLines, invoices, invoicePayments, profile, activities, filings: rows.filings, year: period.year, period: period.quarter, warnings: [], blockers: [] };
  const b = { start: period.quarterStart, end: period.cutoff, cumulativeStart: period.cumulativeStart };
  // Same calculator as the tax models, with freshly read sources; never reuse a frozen result.
  const calculation = ['applicable', 'unconfirmed'].includes(applicability.state) ? engine.calculate130(data, b, adjustments) : null;
  const fields = Object.fromEntries((calculation?.fields || []).map(field => [field.code, money(field.value)]));
  const recognized = engine.supportedWithholdingEvents({ ...data, warnings: [], blockers: [] }, b).reduce((sum, event) => sum + event.withholding, 0);
  const hasIncomeExpense = entryLines.some(line => /^[67]/.test(text(line.accountCode || line.subcuenta))) || calculation?.details?.[0]?.cashEvents?.length > 0;
  const estimate = calculation && hasIncomeExpense ? Math.max(0, money(calculation.result)) : null;
  if (calculation && !hasIncomeExpense) warnings.push('Todavía no hay ingresos o gastos contables confirmados para estimar el 130.');
  if (applicability.state === 'unconfirmed') warnings.push('La estimación no confirma por sí sola la obligación de presentar el modelo 130.');
  const safeMessages = [...new Set([...warnings, ...data.warnings, ...data.blockers])].map(message => text(message).replace(/Factura [^ ]+/g, 'Una factura').replace(/factura emitida [^ ]+/g, 'factura emitida')).slice(0, 30);
  return {
    ok: true, version: 'irpf-dashboard-v1', companyId, ...period, generatedAt: new Date().toISOString(), applicability,
    estimate, signedResult: estimate === null ? null : money(calculation.result), provisional: safeMessages.length > 0 || !['applicable', 'not_applicable', 'exempt', 'model131'].includes(applicability.state),
    basis: { revenue: fields['01'] ?? null, expenses: fields['02'] ?? null, net: fields['03'] ?? null, rate: calculation?.details?.[0]?.sectionOneRate ?? null, grossPayment: fields['04'] ?? null, priorPayments: fields['05'] ?? null, deductibleWithholdings: fields['06'] ?? null, reduction: fields['13'] ?? null, priorNegative: fields['15'] ?? null, housing: fields['16'] ?? null, previousSamePeriod: fields['18'] ?? null, imputationMethod: calculation?.details?.[0]?.irpfImputationMethod || null },
    retentions: { ...invoiceTotals, recognizedByCollections: money(recognized) },
    carryforward: calculation ? { previousPaymentsSource: calculation.carryforward.previousPaymentsSource, priorNegativeSource: calculation.carryforward.priorNegativeSource, missingPeriods: calculation.carryforward.missingPeriods, missingNegativePeriods: calculation.carryforward.missingNegativePeriods } : null,
    coverage: { confirmedEntries: entries.length, excludedEntries, issuedInvoices: invoices.filter(row => row.tipo === 'emitida').length, receivedInvoices: invoices.filter(row => row.tipo === 'recibida').length, savedAdjustments: Object.keys(adjustments).length }, warnings: safeMessages,
  };
}

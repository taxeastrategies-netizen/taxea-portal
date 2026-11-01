import { classifyObligations } from './reportingPeriods.mjs';
import { getOutstandingAmount } from './financialCore.js';
const currency = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
export function deriveFinanceHealth(data) {
  const dimensions = [
    { label: 'Resultado', known: data.accountingKnown && !data.accountingProvisional && !data.accountingPending && !data.accountingExcluded, score: data.margenNeto === null ? 50 : Math.max(0, Math.min(100, 70 + data.margenNeto)), reason: data.accountingKnown ? 'Asientos admitidos del periodo' : 'Sin PyG verificable' },
    { label: 'Saldo y facturas', known: data.bankKnown && data.pagosPendientes !== null, score: data.cashDisponible >= Math.max(0, data.pagosPendientes) ? 100 : data.cashDisponible < 0 ? 0 : 40, reason: data.bankKnown ? 'Saldo observado frente a facturas por pagar' : 'Sin saldo verificable' },
    { label: 'Cobros vencidos', known: !data.financialError && data.cobrosPendientes !== null, score: Math.max(0, 100 - data.vencidas.length * 15), reason: data.financialError ? 'Fuente documental no disponible' : `${data.vencidas.length} facturas vencidas registradas` },
  ];
  const coverage = Math.round(dimensions.filter(item => item.known).length / dimensions.length * 100);
  const score = coverage === 100 ? Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length) : null;
  return { score, coverage, dimensions };
}
export function financeInsights(data) {
  const rows = [];
  if (data.accountingKnown) rows.push({ kind: data.beneficio < 0 ? 'down' : 'up', text: `El resultado de los asientos confirmados admitidos es ${currency(data.beneficio)}.${data.accountingProvisional ? ' Hay revisión o cobertura contable pendiente.' : ''}` });
  else rows.push({ kind: 'neutral', text: 'El periodo no tiene una PyG verificable; no se sustituye por el total de facturas.' });
  if (data.ingresosDelta !== null) rows.push({ kind: data.ingresosDelta < 0 ? 'down' : 'up', text: `Los ingresos contables varían un ${data.ingresosDelta.toFixed(1)} % frente al periodo anterior de igual duración.` });
  if (data.dso !== null) rows.push({ kind: 'neutral', text: `Plazo de cobro observado: ${data.dso} días, en ${data.dsoSample} facturas con cobro completo fechado en el periodo. No es una comparación sectorial.` });
  if (data.workingCapital !== null) rows.push({ kind: 'neutral', text: `Cobros menos pagos pendientes: ${currency(data.workingCapital)}. Es una diferencia documental; no representa el fondo de maniobra contable.` });
  if (!data.bankKnown) rows.push({ kind: 'neutral', text: 'Falta un saldo bancario reciente verificable. Liquidez y autonomía de caja permanecen sin calcular.' });
  if (data.bankActivityKnown) rows.push({ kind: 'neutral', text: `Movimientos EUR disponibles del periodo: entradas ${currency(data.bankInflows)} y salidas ${currency(data.bankOutflows)}. Incluyen conceptos distintos de ventas y gastos.` });
  return rows;
}
export function financeAlerts(data, obligations = [], { calendarError = false, now = new Date() } = {}) {
  const alerts = [];
  if (!data.bankKnown) alerts.push({ id: 'bank-data', severity: 'warning', title: 'Saldo bancario sin verificar', desc: 'Revisa conexión, moneda y fecha de sincronización. No se emite un diagnóstico de liquidez a partir de facturas.' });
  else if (data.runway !== null && data.runway < 3) alerts.push({ id: 'observed-outflows', severity: 'warning', title: 'Revisar saldo y salidas observadas', desc: `El saldo equivale a ${data.runway.toFixed(1)} meses de salidas al ritmo registrado. Es un escenario sin ingresos futuros, no una fecha de insolvencia.` });
  if (data.accountingKnown && data.beneficio < 0) alerts.push({ id: 'accounting-result', severity: 'warning', title: 'Resultado contable negativo', desc: `Los asientos admitidos muestran ${currency(data.beneficio)}. Revisa el periodo y la cobertura antes de decidir.` });
  if (data.financialError || data.accountingError) alerts.push({ id: 'source-error', severity: 'warning', title: 'Lectura financiera incompleta', desc: 'Hay una fuente no actualizada; no se interpreta su ausencia como cero actividad.' });
  if (data.vencidas.length) alerts.push({ id: 'overdue-invoices', severity: data.vencidas.length > 3 ? 'critical' : 'warning', title: `${data.vencidas.length} facturas vencidas con importe pendiente`, desc: `Pendiente registrado: ${currency(data.vencidas.reduce((sum, row) => sum + getOutstandingAmount(row), 0))}. Se respetan los pagos parciales.` });
  const fiscal = classifyObligations(obligations, { now, horizon: 15, timeZone: data.window?.timeZone });
  if (calendarError) alerts.push({ id: 'calendar-data', severity: 'warning', title: 'Calendario sin verificar', desc: 'No se pudo actualizar el calendario. Consulta las obligaciones antes de dar el periodo por atendido.' });
  else if (fiscal.overdue.length) alerts.push({ id: 'overdue-tax', severity: 'critical', title: `${fiscal.overdue.length} obligaciones con fecha vencida`, desc: 'El calendario las mantiene abiertas. Revisa su presentación o su estado con el asesor.' });
  if (!calendarError && fiscal.undated.length) alerts.push({ id: 'undated-tax', severity: 'warning', title: 'Obligaciones sin fecha verificable', desc: `Hay ${fiscal.undated.length} obligaciones abiertas sin vencimiento válido. Revísalas en el calendario.` });
  if (!calendarError && fiscal.upcoming.length) alerts.push({ id: 'upcoming-tax', severity: 'warning', title: `${fiscal.upcoming.length} obligaciones en los próximos 15 días`, desc: 'Incluye el día de hoy y excluye las obligaciones cerradas. Comprueba presentación y domiciliación en el calendario.' });
  if (!alerts.length) alerts.push({ id: 'ok', severity: 'ok', title: 'Sin alertas en los datos registrados', desc: 'No se han detectado vencimientos o señales de atención en las fuentes disponibles. Revisa su cobertura y fecha.' });
  return alerts;
}

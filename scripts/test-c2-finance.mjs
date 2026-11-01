import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reportingWindow, classifyObligations, civilDay, shiftDay } from '../src/lib/reportingPeriods.mjs';
import { buildFinanceDashboardModel, reportingMetricSnapshot, bankObservation, bankFlows } from '../src/lib/financeDashboardModel.mjs';
import { financeAlerts, financeInsights, deriveFinanceHealth } from '../src/lib/financeSignals.mjs';
import { buildFinancePeriod, reportForWindow } from '../base44/functions/businessDashboardOperations/financePeriod.mjs';
const now = new Date('2026-11-01T12:00:00Z');
let checks = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const window = reportingWindow('30d', now);
equal(window.start, '2026-10-03', '30 calendar days include today and both exact boundaries');
equal(window.previous, { start: '2026-09-03', end: '2026-10-02' }, 'comparison window has equal duration with no overlap');
equal(civilDay('2026-02-30'), null, 'invalid civil dates never enter a deadline');
equal(civilDay(new Date('2026-03-28T23:30:00Z')), '2026-03-29', 'Madrid calendar date crosses daylight-saving boundary correctly');
equal(civilDay(new Date('2026-03-28T23:30:00Z'), 'Atlantic/Canary'), '2026-03-28', 'Canary calendar date is independent of Madrid');
equal(shiftDay('2026-03-29', -1), '2026-03-28', 'civil arithmetic does not lose a day on DST');
const obligations = [-1, 0, 7, 15, 30, 60].map(offset => ({ id: String(offset), fecha_limite: shiftDay('2026-11-01', offset), estado: 'pendiente' }));
obligations.push({ id: 'done', filingDeadline: '2026-11-02', state: 'presentado' }, { id: 'invalid', fecha_limite: 'bad' });
const dates = classifyObligations(obligations, { now });
equal(dates.upcoming.map(row => row.id), ['0', '7', '15', '30'], 'current day, 7, 15 and 30 days included; 60 days excluded');
equal(dates.overdue.map(row => row.id), ['-1'], 'overdue obligations remain distinct');
equal(dates.undated.map(row => row.id), ['invalid'], 'missing dates are visible, not interpreted as completed');
for (const state of ['presentado', 'finalizado', 'cerrado', 'completado', 'no_aplica', 'sin_obligacion', 'anulado']) equal(classifyObligations([{ state, filingDeadline: '2026-11-02' }], { now }).upcoming.length, 0, 'closed fiscal state: ' + state);
const invoices = [
  { id: 'sale', tipo: 'emitida', fecha_emision: '2026-10-10', base_imponible: 100, total_factura: 121, estado_cobro: 'cobrada', importe_pagado: 121, ultimo_pago_at: '2026-10-20' },
  { id: 'purchase', tipo: 'recibida', fecha_emision: '2026-10-11', base_imponible: 20, total_factura: 24.2, estado_cobro: 'pendiente', importe_pendiente: 24.2 },
  { id: 'future', tipo: 'emitida', fecha_emision: '2027-01-01', base_imponible: 9999, total_factura: 9999, estado_cobro: 'pendiente' },
  { id: 'cancelled', tipo: 'emitida', anulada: true, fecha_emision: '2026-10-10', base_imponible: 9999, total_factura: 9999 },
];
const entries = [
  { id: 'sale-entry', companyId: 'qa', ejercicio: 2026, date: '2026-10-10', status: 'confirmado' },
  { id: 'purchase-entry', companyId: 'qa', ejercicio: 2026, date: '2026-10-11', status: 'confirmado' },
  { id: 'draft-entry', companyId: 'qa', ejercicio: 2026, date: '2026-10-10', status: 'borrador' },
  { id: 'broken-entry', companyId: 'qa', ejercicio: 2026, date: '2026-10-10', status: 'confirmado' },
];
const lines = [
  { id: 's1', journalEntryId: 'sale-entry', accountCode: '43000001', debit: 121, credit: 0 },
  { id: 's2', journalEntryId: 'sale-entry', accountCode: '70000000', debit: 0, credit: 100 },
  { id: 's3', journalEntryId: 'sale-entry', accountCode: '47700000', debit: 0, credit: 21 },
  { id: 'p1', journalEntryId: 'purchase-entry', accountCode: '60000000', debit: 24.2, credit: 0 },
  { id: 'p2', journalEntryId: 'purchase-entry', accountCode: '40000001', debit: 0, credit: 24.2 },
  { id: 'd1', journalEntryId: 'draft-entry', accountCode: '70000000', debit: 0, credit: 1000 },
  { id: 'd2', journalEntryId: 'draft-entry', accountCode: '43000001', debit: 1000, credit: 0 },
  { id: 'b1', journalEntryId: 'broken-entry', accountCode: '70000000', debit: 0, credit: 9999 },
];
const data = { entries, lines, linesByEntry: new Map(entries.map(entry => [entry.id, lines.filter(line => line.journalEntryId === entry.id)])), accountByCode: new Map(), operationById: new Map(), configuration: { frameworkReviewStatus: 'validated' } };
const accountingPeriod = buildFinancePeriod(data, { now });
equal(accountingPeriod.current.profitAndLoss.totalIncome, 100, 'accounting income excludes output VAT');
equal(accountingPeriod.current.profitAndLoss.totalExpenses, 24.2, 'non-deductible tax already posted to expense is preserved');
equal(accountingPeriod.current.profitAndLoss.result, 75.8, 'result follows admitted journal entries rather than gross or net invoice subtraction');
equal(accountingPeriod.current.includedEntries, 2, 'only balanced confirmed entries included');
equal(accountingPeriod.current.excludedEntries, 1, 'unbalanced confirmed entry reported');
equal(accountingPeriod.current.pendingEntriesInYear, 1, 'pending entry remains visible in coverage');
const noBank = buildFinanceDashboardModel({ invoices, accountingPeriod, now, obligations });
equal(noBank.cashDisponible, null, 'paid invoices cannot create an invented cash balance');
equal(noBank.runway, null, 'no bank means no runway');
equal(noBank.beneficio, 75.8, 'dashboard preserves accounting result');
equal(noBank.documentIncomeNet, 100, 'document comparison excludes cancelled and future invoices');
equal(noBank.dso, 10, 'observed collection delay uses complete dated payment');
equal(noBank.dsoSample, 1, 'collection sample visible');
equal(deriveFinanceHealth(noBank).score, null, 'missing bank cannot produce full financial health');
equal(financeAlerts(noBank, [], { now }).some(alert => alert.id === 'liquidez' && alert.severity === 'critical'), false, 'no invented critical liquidity warning');
equal(financeInsights(noBank).some(row => /superior a la media|estándar de 45/i.test(row.text)), false, 'no unsourced sector comparisons');
const account = { id: 'bank-a', iban: 'QA ES 0001', moneda: 'EUR', activa: true, estado_conexion: 'conectado', saldo_disponible: 1000, fecha_ultima_sync: now.toISOString() };
const tx = (id, amount, kind, day = '2026-10-20') => ({ id, bank_account_id: 'bank-a', moneda: 'EUR', estado_proveedor: 'booked', importe: amount, tipo: kind, fecha_operacion: day });
const transactions = [tx('in', 400, 'entrada', '2026-10-03'), tx('out', 90, 'salida'), tx('same-provider', 90, 'salida'), { ...tx('same-provider-copy', 90, 'salida'), clave_transaccion: 'provider-one' }, { ...tx('same-provider-copy-2', 90, 'salida'), clave_transaccion: 'provider-one' }, { ...tx('pending', 9999, 'entrada'), estado_proveedor: 'pending' }, { ...tx('foreign', 9999, 'entrada'), bank_account_id: 'other-company' }, { ...tx('internal', 9999, 'entrada'), categoria_ia: 'transferencia_interna' }];
const observed = bankObservation([account, { ...account, id: 'bank-duplicate' }], transactions, { now });
equal(observed.cash, 1000, 'duplicate physical account never doubles cash');
equal(observed.duplicateAccounts, 1, 'duplicate account is diagnosed');
equal(observed.duplicateTransactions, 1, 'only stable duplicate transaction identity is suppressed');
equal(bankFlows(observed, window).outflows, 270, 'same amount/date with different identities remains legitimate');
equal(bankFlows(observed, window).inflows, 400, 'pending, foreign and internal movements excluded');
equal(bankObservation([{ ...account, saldo_disponible: 0 }], [], { now }).cash, 0, 'verified zero balance remains zero');
equal(bankObservation([{ ...account, saldo_disponible: null }], [], { now }).cash, null, 'unknown balance is not zero');
equal(bankObservation([{ ...account, moneda: 'USD' }], [], { now }).cash, null, 'non-EUR account is not summed into EUR');
equal(bankObservation([{ ...account, fecha_ultima_sync: '2026-09-01' }], [], { now }).bankKnown, false, 'old bank balance cannot support liquidity');
equal(bankObservation([account], [], { now, treasuryError: 'failed' }).bankKnown, false, 'failed snapshot is not a valid bank source');
equal(bankObservation([account, { ...account, id: 'conflict', saldo_disponible: 2000 }], [], { now }).bankKnown, false, 'conflicting physical account balances require review');
const bankModel = buildFinanceDashboardModel({ invoices, bankAccounts: [account], bankTransactions: transactions, accountingPeriod, now });
equal(bankModel.cashDisponible, 1000, 'cash comes only from observed bank balance');
equal(bankModel.burnRate, 270, 'monthly outflow normalized to selected 30-day window');
equal(bankModel.runway, 3.7, 'runway uses bank balance and observed bank outflows');
const empty = buildFinanceDashboardModel({ now });
equal(empty.beneficio, null, 'empty ledger is unknown instead of apparent zero profit');
equal(empty.dso, null, 'no completed dated collections is unknown, not immediate payment');
equal(empty.ingresosDelta, null, 'no comparative period is not fabricated zero growth');
equal(deriveFinanceHealth(empty).score, null, 'empty client cannot receive a health score');
const failed = buildFinanceDashboardModel({ invoices, now, financialError: 'unavailable' });
equal(failed.cobrosPendientes, null, 'failed documentary source is not interpreted as zero receivables');
equal(financeAlerts(failed, [], { now, calendarError: true }).some(row => row.id === 'ok'), false, 'failed sources cannot yield an all-clear alert');
equal(fs.readFileSync('src/lib/reportingPeriods.mjs', 'utf8'), fs.readFileSync('base44/functions/businessDashboardOperations/reportingPeriods.mjs', 'utf8'), 'server and client use identical date and obligation rules');
equal(bankObservation([account], [{...tx('collision-a',10,'salida'),clave_transaccion:'collision'},{...tx('collision-b',20,'salida'),clave_transaccion:'collision'}], {now}).activityKnown, false, 'conflicting stable transaction identity prevents reliable flow projections');
equal(fs.readFileSync('src/lib/observedBanking.mjs','utf8'),fs.readFileSync('base44/functions/businessDashboardOperations/observedBanking.mjs','utf8'),'bank observation rules identical in frontend and backend');
equal(financeAlerts(bankModel,[{id:'undated',estado:'pendiente'}],{now}).some(row=>row.id==='undated-tax'),true,'undated obligations prevent an all-clear');
const resolvedModel=buildFinanceDashboardModel({bankAccounts:[account],bankTransactions:[{...tx('resolved',10,'salida'),estado_conciliacion:'descartada'}],now});
equal(resolvedModel.bankUnreconciled,0,'resolved legacy bank states are consistent across panels');
equal(reportingWindow('mtd',now).start,'2026-11-01','monthly dashboard starts on the first civil day');
equal(reportingWindow('mtd',new Date('2026-10-31T12:00:00Z')).days,31,'monthly dashboard includes all days through month end');
const reportingSnapshot=reportingMetricSnapshot(bankModel,[{estado:'activo',capital_pendiente:0,importe_inicial:9999}],accountingPeriod.current);
equal(reportingSnapshot.ingresos,100,'reporting centre uses admitted ledger income, not invoices including tax');
equal(reportingSnapshot.beneficio,75.8,'reporting centre keeps canonical ledger result');
equal(reportingSnapshot.deudaTotal,0,'zero remaining debt is not replaced by its original principal');
equal(reportingSnapshot.cashTotal,1000,'reporting uses the observed unique-account balance');
equal(reportingSnapshot.runway,3.7,'reporting runway uses observed bank flow, not annual expense divided by twelve');
equal(Object.values(reportingSnapshot).some(Array.isArray),false,'report metrics never include raw document or bank arrays');
equal(reportingSnapshot.observation,undefined,'report sharing receives no raw bank observation');
equal(reportingSnapshot.filteredInvoices,undefined,'report sharing receives no invoice objects');
console.log(JSON.stringify({ ok: true, checks, scenarios: ['calendar-boundaries', 'confirmed-PnL', 'bank-absence-and-zero', 'bank-deduplication', 'observed-cashflow', 'source-failure', 'no-false-green'], externalCalls: 0, financialWrites: 0 }));

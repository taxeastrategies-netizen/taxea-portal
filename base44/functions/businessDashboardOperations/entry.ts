import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { accountingData, buildReports, fetchAll } from './accountingReportEngine.ts';
import { reconcileFinancialSources } from './financialSourceTruth.js';

const clean = (value: unknown) => String(value ?? '').trim();
const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;
const roleOf = (user: any) => clean(user?.role || user?.data?.role).toLowerCase();
const privileged = (user: any) => ['admin', 'super_admin', 'advisor', 'asesor'].includes(roleOf(user));
const dateOf = (row: any, fields: string[]) => fields.map((field) => clean(row?.[field])).find(Boolean) || '';
const yearOf = (row: any, fields: string[]) => Number(row?.ejercicio || row?.anio || dateOf(row, fields).slice(0, 4)) || null;
const isClosedInvoice = (invoice: any) => invoice?.anulada || ['cobrada', 'pagada', 'anulada', 'cancelada'].includes(clean(invoice?.estado_cobro || invoice?.estado).toLowerCase());
const outstanding = (invoice: any) => {
  if (Number.isFinite(Number(invoice?.importe_pendiente))) return Math.max(0, money(invoice.importe_pendiente));
  return Math.max(0, money(Number(invoice?.total_factura || invoice?.total || 0) - Number(invoice?.importe_pagado || 0)));
};

async function authorize(svc: any, user: any, companyId: string) {
  const company = await svc.entities.Company.get(companyId).catch(() => null);
  if (!company) throw Object.assign(new Error('Empresa no encontrada.'), { status: 404 });
  const role = roleOf(user);
  const email = clean(user?.email).toLowerCase();
  const authorizedEmails = Array.isArray(company.usuarios_autorizados)
    ? company.usuarios_autorizados.map((value: unknown) => clean(value).toLowerCase())
    : [];
  const allowed = ['admin', 'super_admin'].includes(role)
    || clean(user?.data?.company_id || user?.company_id) === companyId
    || (email && clean(company.owner_email).toLowerCase() === email)
    || (email && authorizedEmails.includes(email));
  if (!allowed) throw Object.assign(new Error('No tienes permiso para consultar esta empresa.'), { status: 403 });
  return company;
}

async function safeFetch(entity: any, query: any, sort = '-created_date', max = 100000) {
  if (!entity) return [];
  try { return await fetchAll(entity, query, sort, max); }
  catch (error) {
    console.warn('[businessDashboardOperations] optional source unavailable', error?.message || error);
    return [];
  }
}

function integrity(entry: any, rows: any[]) {
  const debit = money(rows.reduce((sum, line) => sum + Number(line.debit || line.debeE || 0), 0));
  const credit = money(rows.reduce((sum, line) => sum + Number(line.credit || line.haberE || 0), 0));
  return { debit, credit, balanced: rows.length >= 2 && Math.abs(debit - credit) <= 0.01 };
}

function accountingQuality(data: any, invoices: any[], year: number) {
  const entries = data.entries.filter((entry: any) => yearOf(entry, ['date']) === year && entry.status !== 'anulado');
  const entryByKey = new Map<string, any>();
  for (const entry of data.entries) {
    entryByKey.set(entry.id, entry);
    if (entry.importKey) entryByKey.set(entry.importKey, entry);
  }
  const checks = entries.map((entry: any) => ({ entry, ...integrity(entry, data.linesByEntry.get(entry.id) || []) }));
  const activeInvoices = invoices.filter((invoice: any) => !invoice.anulada && yearOf(invoice, ['fecha_emision', 'fecha', 'created_date']) === year);
  const healthyInvoicePostings = activeInvoices.filter((invoice: any) => {
    const entry = entryByKey.get(invoice.linked_journal_entry_id);
    return entry?.status === 'confirmado' && integrity(entry, data.linesByEntry.get(entry.id) || []).balanced;
  }).length;
  return {
    entries: entries.length,
    confirmedEntries: entries.filter((entry: any) => entry.status === 'confirmado').length,
    reviewEntries: entries.filter((entry: any) => ['borrador', 'pendiente_revision'].includes(entry.status)).length,
    entriesWithoutLines: checks.filter((check: any) => !(data.linesByEntry.get(check.entry.id) || []).length).length,
    unbalancedEntries: checks.filter((check: any) => (data.linesByEntry.get(check.entry.id) || []).length && !check.balanced).length,
    unresolvedLines: Number(data.unresolvedLines || 0),
    activeInvoices: activeInvoices.length,
    healthyInvoicePostings,
    pendingInvoicePostings: Math.max(0, activeInvoices.length - healthyInvoicePostings),
  };
}

function monthlyAccounting(data: any, year: number) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const result = months.map((month) => ({ month, ingresos: 0, gastos: 0 }));
  for (const entry of data.entries) {
    if (entry.status !== 'confirmado' || yearOf(entry, ['date']) !== year) continue;
    const lines = data.linesByEntry.get(entry.id) || [];
    if (!integrity(entry, lines).balanced) continue;
    const month = Number(String(entry.date || '').slice(5, 7)) - 1;
    if (month < 0 || month > 11) continue;
    for (const line of lines) {
      const code = clean(line.accountCode || line.subcuenta);
      if (code.startsWith('7')) result[month].ingresos += Number(line.credit || line.haberE || 0) - Number(line.debit || line.debeE || 0);
      if (code.startsWith('6')) result[month].gastos += Number(line.debit || line.debeE || 0) - Number(line.credit || line.haberE || 0);
    }
  }
  return result.map((row) => ({ ...row, ingresos: money(row.ingresos), gastos: money(row.gastos) }));
}

function financeSnapshot(invoices: any[], year: number) {
  const rows = invoices.filter((invoice) => !invoice.anulada && yearOf(invoice, ['fecha_emision', 'fecha', 'created_date']) === year);
  const today = new Date().toISOString().slice(0, 10);
  const emitted = rows.filter((invoice) => clean(invoice.tipo).toLowerCase() !== 'recibida');
  const received = rows.filter((invoice) => clean(invoice.tipo).toLowerCase() === 'recibida');
  const summarize = (items: any[]) => {
    const open = items.filter((invoice) => !isClosedInvoice(invoice) && outstanding(invoice) > 0.01);
    const overdue = open.filter((invoice) => dateOf(invoice, ['fecha_vencimiento', 'vencimiento']) && dateOf(invoice, ['fecha_vencimiento', 'vencimiento']) < today);
    return {
      documents: items.length,
      open: open.length,
      outstanding: money(open.reduce((sum, invoice) => sum + outstanding(invoice), 0)),
      overdue: overdue.length,
      overdueAmount: money(overdue.reduce((sum, invoice) => sum + outstanding(invoice), 0)),
    };
  };
  return { receivables: summarize(emitted), payables: summarize(received) };
}

function treasurySnapshot(accounts: any[], transactions: any[], year: number) {
  const active = accounts.filter((account) => account.activa !== false);
  const connected = active.filter((account) => ['conectado', 'conectada', 'connected', 'activa', 'active'].includes(clean(account.estado_conexion).toLowerCase()));
  const accountIds = new Set(active.map((account) => account.id));
  const visible = transactions.filter((tx) => {
    const accountId = clean(tx.bank_account_id || tx.cuenta_bancaria_id || tx.account_id);
    const reconciliationState = clean(tx.estado_conciliacion).toLowerCase();
    const duplicate = tx.es_duplicado || tx.duplicado || tx.es_demo === true || ['duplicada', 'duplicado', 'duplicate'].includes(reconciliationState) || ['duplicado', 'duplicate'].includes(clean(tx.estado_proveedor).toLowerCase());
    const booked = !tx.estado_proveedor || ['booked', 'contabilizado', 'confirmado'].includes(clean(tx.estado_proveedor).toLowerCase());
    return (!accountId || accountIds.has(accountId)) && !duplicate && booked;
  });
  const yearRows = visible.filter((tx) => yearOf(tx, ['fecha_operacion', 'fecha_valor', 'fecha']) === year);
  const resolved = new Set(['conciliado', 'reconciliada', 'conciliada_auto', 'conciliada_manual', 'descartada', 'movimiento_interno', 'auto', 'manual', 'ignored', 'ignorado']);
  const reconciled = yearRows.filter((tx) => resolved.has(clean(tx.estado_conciliacion).toLowerCase())).length;
  const unresolved = Math.max(0, yearRows.length - reconciled);
  const latestSync = active.map((account) => dateOf(account, ['fecha_ultima_sync', 'last_sync_at', 'updated_date'])).filter(Boolean).sort().at(-1) || '';
  const staleHours = latestSync ? (Date.now() - new Date(latestSync).getTime()) / 3600000 : null;
  const issues = active.filter((account) => ['error', 'requiere_renovacion', 'expired', 'desconectada', 'desconectado'].includes(clean(account.estado_conexion).toLowerCase())).length;
  return {
    accounts: active.length,
    connectedAccounts: connected.length,
    connectionIssues: issues,
    cashEur: money(connected.filter((account) => clean(account.moneda || 'EUR').toUpperCase() === 'EUR').reduce((sum, account) => sum + Number(account.saldo_disponible ?? account.saldo_actual ?? 0), 0)),
    nonEurAccounts: connected.filter((account) => clean(account.moneda || 'EUR').toUpperCase() !== 'EUR').map((account) => clean(account.moneda)).filter(Boolean),
    transactions: yearRows.length,
    reconciled,
    unreconciled: unresolved,
    reconciliationRate: yearRows.length ? Math.round((reconciled / yearRows.length) * 100) : null,
    inflows: money(yearRows.filter((tx) => Number(tx.importe || 0) > 0).reduce((sum, tx) => sum + Number(tx.importe || 0), 0)),
    outflows: money(Math.abs(yearRows.filter((tx) => Number(tx.importe || 0) < 0).reduce((sum, tx) => sum + Number(tx.importe || 0), 0))),
    lastSync: latestSync,
    stale: staleHours !== null && staleHours > 72,
  };
}

function peopleSnapshot(employees: any[], absences: any[], documents: any[], laborDocs: any[], payrolls: any[], socialSecurity: any[]) {
  const today = new Date().toISOString().slice(0, 10);
  const active = employees.filter((employee) => !employee.estado || employee.estado === 'activo');
  const pendingAbsences = absences.filter((absence) => ['pendiente', 'solicitada', 'en_revision'].includes(clean(absence.estado).toLowerCase()));
  const currentAbsences = absences.filter((absence) => ['aprobada', 'aprobado'].includes(clean(absence.estado).toLowerCase()) && (!absence.fecha_inicio || absence.fecha_inicio <= today) && (!absence.fecha_fin || absence.fecha_fin >= today));
  const pendingSignature = documents.filter((doc) => ['pendiente_firma', 'sin_firma'].includes(clean(doc.estado_firma).toLowerCase())).length;
  const expiredDocuments = documents.filter((doc) => clean(doc.estado_firma).toLowerCase() === 'expirado' || (doc.fecha_expiracion && doc.fecha_expiracion < today && doc.estado_firma !== 'firmado')).length;
  const reviewStates = new Set(['pendiente', 'procesando', 'requiere_revision', 'procesado_con_advertencias', 'error', 'no_reconocido', 'duplicado_probable', 'revision_manual', 'rechazado']);
  const laborReview = laborDocs.filter((doc) => reviewStates.has(clean(doc.ocr_status).toLowerCase()) || reviewStates.has(clean(doc.validation_status).toLowerCase())).length;
  const payrollWarnings = [...payrolls, ...socialSecurity].reduce((sum, row) => sum + (Array.isArray(row.validation_warnings) ? row.validation_warnings.length : 0), 0);
  return {
    employees: employees.length,
    activeEmployees: active.length,
    pendingAbsences: pendingAbsences.length,
    currentAbsences: currentAbsences.length,
    pendingSignature,
    expiredDocuments,
    laborDocumentsReview: laborReview,
    payrollExtractions: payrolls.length,
    socialSecurityExtractions: socialSecurity.length,
    payrollWarnings,
    team: active.slice(0, 8).map((employee) => ({ id: employee.id, name: employee.full_name || [employee.nombre, employee.apellidos].filter(Boolean).join(' ') || 'Empleado', department: employee.departamento || employee.puesto || employee.cargo || '', status: employee.estado || 'activo' })),
  };
}

function sourceDate(rows: any[], fields: string[]) {
  return rows.map((row) => dateOf(row, fields)).filter(Boolean).sort().at(-1) || '';
}

function activityFeed({ invoices, expenses, transactions, entries, laborDocs, documents }: any) {
  const events: any[] = [];
  const push = (event: any) => { if (event.date) events.push(event); };
  invoices.slice(-40).forEach((row: any) => push({ id: `invoice:${row.id}`, type: 'invoice', date: dateOf(row, ['fecha_emision', 'created_date']), title: row.numero_factura || (row.tipo === 'recibida' ? 'Factura recibida' : 'Factura emitida'), detail: row.cliente_nombre || row.proveedor_nombre || row.proveedor_cliente || '', amount: money(row.total_factura || row.total), route: '/tax-accounting/facturas' }));
  expenses.slice(-30).forEach((row: any) => push({ id: `expense:${row.id}`, type: 'expense', date: dateOf(row, ['fecha', 'created_date']), title: row.concepto || 'Ingreso o gasto', detail: row.proveedor_cliente || '', amount: money(row.total), route: '/tax-accounting/ingresos-gastos' }));
  transactions.slice(-40).forEach((row: any) => push({ id: `bank:${row.id}`, type: 'bank', date: dateOf(row, ['fecha_operacion', 'fecha_valor', 'created_date']), title: row.concepto || row.descripcion || 'Movimiento bancario', detail: row.contraparte || row.nombre_contraparte || '', amount: money(row.importe), route: '/finance/cashflow' }));
  entries.slice(-40).forEach((row: any) => push({ id: `entry:${row.id}`, type: 'entry', date: dateOf(row, ['date', 'updated_date']), title: row.entryNumber ? `Asiento ${row.entryNumber}` : 'Asiento contable', detail: row.description || '', amount: money(row.totalDebit), route: '/tax-accounting/contabilidad' }));
  laborDocs.slice(-20).forEach((row: any) => push({ id: `labor:${row.id}`, type: 'labor', date: dateOf(row, ['updated_date', 'created_date']), title: row.original_file_name || row.file_name || row.nombre_archivo || 'Documento laboral', detail: clean(row.ocr_status || row.validation_status), route: '/people/documents' }));
  documents.slice(-20).forEach((row: any) => push({ id: `document:${row.id}`, type: 'document', date: dateOf(row, ['updated_date', 'created_date']), title: row.nombre || 'Documento', detail: row.estado || row.carpeta || '', route: '/documentos' }));
  return events.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
}

export function buildBusinessSummary(data: any, year: number, user: any = {}) {
  const report = buildReports(data.accounting, { year, scope: 'confirmed' });
  const quality = accountingQuality(data.accounting, data.invoices, year);
  const finance = financeSnapshot(data.invoices, year);
  const treasury = treasurySnapshot(data.bankAccounts, data.bankTransactions, year);
  const people = peopleSnapshot(data.employees, data.absences, data.hrDocuments, data.laborDocs, data.payrolls, data.socialSecurity);
  const openTaskStates = new Set(['pendiente', 'en_progreso', 'pendiente_cliente', 'bloqueada']);
  const visibleTasks = privileged(user) ? data.tasks : data.tasks.filter((task: any) => !task.interna);
  const openTasks = visibleTasks.filter((task: any) => openTaskStates.has(clean(task.estado).toLowerCase()));
  const today = new Date().toISOString().slice(0, 10);
  const openErrors = data.errors.filter((error: any) => !['resuelto', 'ignorado', 'cerrado'].includes(clean(error.estado).toLowerCase()));
  return {
    year,
    generatedAt: new Date().toISOString(),
    accounting: {
      pnl: { income: report.profitAndLoss.totalIncome, expenses: report.profitAndLoss.totalExpenses, result: report.profitAndLoss.result, margin: report.profitAndLoss.totalIncome ? Math.round((report.profitAndLoss.result / report.profitAndLoss.totalIncome) * 1000) / 10 : null },
      balance: { assets: report.balanceSheet.totalAssets, liabilities: report.balanceSheet.totalLiabilities, equity: report.balanceSheet.totalEquity, difference: report.balanceSheet.difference },
      report: { includedEntries: report.includedEntries, excludedEntries: report.excludedEntries, pendingEntries: report.pendingEntriesInYear },
      quality,
      monthly: monthlyAccounting(data.accounting, year),
      source: 'asientos_confirmados_cuadrados',
    },
    finance,
    treasury,
    people,
    operations: {
      openTasks: openTasks.length,
      overdueTasks: openTasks.filter((task: any) => task.fecha_limite && task.fecha_limite < today).length,
      pendingClientTasks: openTasks.filter((task: any) => task.estado === 'pendiente_cliente').length,
      openErrors: openErrors.length,
      criticalErrors: openErrors.filter((error: any) => ['critica', 'critical', 'alta'].includes(clean(error.severidad).toLowerCase())).length,
      unreadNotifications: data.notifications.filter((notification: any) => notification.leida !== true).slice(0, 5),
    },
    documents: {
      total: data.documents.length,
      pendingReview: data.documents.filter((doc: any) => ['pendiente', 'en_revision', 'revision'].includes(clean(doc.estado).toLowerCase())).length,
      rejected: data.documents.filter((doc: any) => ['rechazado', 'error'].includes(clean(doc.estado).toLowerCase())).length,
    },
    activity: activityFeed({ invoices: data.invoices, expenses: data.expenses, transactions: data.bankTransactions, entries: data.accounting.entries, laborDocs: data.laborDocs, documents: data.documents }),
    freshness: {
      accounting: sourceDate(data.accounting.entries, ['updated_date', 'date', 'created_date']),
      invoices: sourceDate(data.invoices, ['updated_date', 'fecha_emision', 'created_date']),
      banking: treasury.lastSync || sourceDate(data.bankTransactions, ['importado_at', 'created_date', 'fecha_operacion']),
      labor: sourceDate([...data.laborDocs, ...data.payrolls, ...data.socialSecurity], ['updated_date', 'created_date']),
      documents: sourceDate(data.documents, ['updated_date', 'created_date']),
    },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const companyId = clean(body.companyId || user.data?.company_id);
    const year = Number(body.year || new Date().getUTCFullYear());
    if (!companyId) return Response.json({ error: 'companyId es obligatorio.' }, { status: 400 });
    if (year < 2000 || year > 2100) return Response.json({ error: 'Ejercicio no valido.' }, { status: 400 });
    if (clean(body.action || 'summary') !== 'summary') return Response.json({ error: 'Accion no soportada.' }, { status: 400 });
    const svc = base44.asServiceRole;
    await authorize(svc, user, companyId);
    const [accounting, invoices, payments, expenses, bankAccounts, bankTransactions, employees, absences, hrDocuments, laborDocs, payrolls, socialSecurity, tasks, errors, documents, notifications] = await Promise.all([
      accountingData(svc, companyId, { year, includeBusinessData: false }),
      fetchAll(svc.entities.Invoice, { company_id: companyId }, 'created_date', 100000),
      safeFetch(svc.entities.InvoicePayment, { company_id: companyId }, 'created_date', 100000),
      safeFetch(svc.entities.Expense, { company_id: companyId }, 'created_date', 100000),
      safeFetch(svc.entities.BankAccount, { company_id: companyId }, 'created_date', 10000),
      safeFetch(svc.entities.BankTransaction, { company_id: companyId }, 'created_date', 100000),
      safeFetch(svc.entities.Employee, { company_id: companyId }, 'created_date', 50000),
      safeFetch(svc.entities.HRAbsence, { company_id: companyId }, 'created_date', 50000),
      safeFetch(svc.entities.HRDocument, { company_id: companyId }, 'created_date', 50000),
      safeFetch(svc.entities.LaborOcrDocument, { company_id: companyId }, 'created_date', 50000),
      safeFetch(svc.entities.PayrollExtraction, { company_id: companyId }, 'created_date', 50000),
      safeFetch(svc.entities.SocialSecurityExtraction, { company_id: companyId }, 'created_date', 50000),
      safeFetch(svc.entities.Task, { company_id: companyId }, 'created_date', 100000),
      safeFetch(svc.entities.FiscalError, { company_id: companyId }, 'created_date', 100000),
      safeFetch(svc.entities.Document, { company_id: companyId }, 'created_date', 100000),
      user.email ? safeFetch(svc.entities.Notification, { company_id: companyId, destinatario_email: user.email }, '-created_date', 1000) : Promise.resolve([]),
    ]);
    const financialSources = reconcileFinancialSources(invoices, expenses);
    return Response.json({
      success: true,
      companyId,
      sourceTruth: financialSources.sourceTruth,
      ...buildBusinessSummary({ accounting, invoices: financialSources.invoices, payments, expenses: financialSources.expenses, bankAccounts, bankTransactions, employees, absences, hrDocuments, laborDocs, payrolls, socialSecurity, tasks, errors, documents, notifications }, year, user),
    });
  } catch (error) {
    console.error('[businessDashboardOperations]', error?.message || error);
    return Response.json({ error: error?.message || 'No se pudo construir el dashboard.' }, { status: error?.status || 500 });
  }
});


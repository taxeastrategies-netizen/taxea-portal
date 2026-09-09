const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export async function fetchAll(entity, query = {}, sort = 'created_date', max = 30000) {
  const rowsById = new Map();
  const pageSize = Math.min(5000, max);
  const descending = String(sort || '').startsWith('-');
  const cursorField = String(sort || 'created_date').replace(/^-/, '');
  let cursor;

  while (rowsById.size < max) {
    const cursorQuery = cursor === undefined
      ? query
      : { ...query, [cursorField]: { [descending ? '$lte' : '$gte']: cursor } };
    const page = await entity.filter(cursorQuery, sort, pageSize, 0);
    if (!page?.length) break;

    const sizeBefore = rowsById.size;
    for (const row of page) rowsById.set(row.id || `${cursorField}:${row[cursorField]}:${rowsById.size}`, row);
    const nextCursor = page[page.length - 1]?.[cursorField];

    if (page.length < pageSize || nextCursor === undefined || nextCursor === null) break;
    if (Object.is(nextCursor, cursor) && rowsById.size === sizeBefore) break;
    cursor = nextCursor;
  }
  return [...rowsById.values()].slice(0, max);
}

function yearOf(entry) {
  return Number(entry.ejercicio || String(entry.date || '').slice(0, 4)) || null;
}

function accountKind(account = {}, code = '') {
  const type = account.type || '';
  if (code.startsWith('555') || account.presentationRole === 'pasivo_corriente_otras_deudas') return 'liability';
  if (type === 'ingreso' || code.startsWith('7')) return 'income';
  if (type === 'gasto' || code.startsWith('6')) return 'expense';
  if (type === 'patrimonio') return 'equity';
  if (/^(400|401|403|404|405|406|410|411|419|438|465|475|476|477)/.test(code)) return 'liability';
  if (/^(430|431|432|433|434|435|436|437|440|441|449|460|464|470|471|472|473|474)/.test(code)) return 'asset';
  if (['pasivo', 'proveedor', 'impuesto'].includes(type)) return 'liability';
  if (['activo', 'cliente', 'banco'].includes(type)) return 'asset';
  if (code.startsWith('1')) return 'equity';
  if (/^[23]/.test(code)) return 'asset';
  if (code.startsWith('4')) return /^(40|41|438|465|475|476|477)/.test(code) ? 'liability' : 'asset';
  if (code.startsWith('5')) return /^(50|51|52|55)/.test(code) ? 'liability' : 'asset';
  return 'unclassified';
}

function presentationSection(account, kind) {
  const code = String(account.code || '');
  if (kind === 'income') {
    if (/^76/.test(code)) return { key: 'ingresos_financieros', label: 'Ingresos financieros' };
    if (/^77/.test(code)) return { key: 'otros_ingresos', label: 'Otros ingresos' };
    return { key: 'ingresos_explotacion', label: 'Ingresos de explotación' };
  }
  if (kind === 'expense') {
    if (/^66/.test(code)) return { key: 'gastos_financieros', label: 'Gastos financieros' };
    if (/^67/.test(code)) return { key: 'otros_gastos', label: 'Otros gastos' };
    return { key: 'gastos_explotacion', label: 'Gastos de explotación' };
  }
  if (kind === 'equity') return { key: 'patrimonio_neto', label: 'Patrimonio neto' };
  if (kind === 'liability') {
    if (/^(14|15|16|17|18|19)/.test(code)) return { key: 'pasivo_no_corriente', label: 'Pasivo no corriente' };
    if (/^(400|401|403|404|405|406|410|411|419)/.test(code)) return { key: 'acreedores_comerciales', label: 'Acreedores comerciales y otras cuentas a pagar' };
    if (/^(475|476|477)/.test(code)) return { key: 'administraciones_acreedoras', label: 'Administraciones públicas acreedoras' };
    if (/^555/.test(code)) return { key: 'partidas_pendientes', label: 'Partidas pendientes de aplicación' };
    return { key: 'deudas_corrientes', label: 'Deudas a corto plazo' };
  }
  if (kind === 'asset') {
    if (/^2/.test(code)) return { key: 'activo_no_corriente', label: 'Activo no corriente' };
    if (/^3/.test(code)) return { key: 'existencias', label: 'Existencias' };
    if (/^(430|431|432|433|434|435|436|437|440|441|449)/.test(code)) return { key: 'deudores_comerciales', label: 'Deudores comerciales y otras cuentas a cobrar' };
    if (/^(470|471|472|473|474)/.test(code)) return { key: 'administraciones_deudoras', label: 'Administraciones públicas deudoras' };
    if (/^57/.test(code)) return { key: 'efectivo', label: 'Efectivo y otros activos líquidos equivalentes' };
    return { key: 'activo_corriente', label: 'Otros activos corrientes' };
  }
  return { key: 'sin_clasificar', label: 'Pendiente de clasificación' };
}

function groupPresentation(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = row.section?.key || 'sin_clasificar';
    if (!grouped.has(key)) grouped.set(key, { key, label: row.section?.label || 'Pendiente de clasificación', accounts: [], amount: 0 });
    const group = grouped.get(key);
    group.accounts.push(row);
    group.amount += Number(row.amount || 0);
  }
  return [...grouped.values()].map(group => ({ ...group, amount: round2(group.amount) }));
}

function resolveModel(entries, lines) {
  const entryByKey = new Map();
  const linesByEntry = new Map();
  for (const entry of entries) {
    entryByKey.set(entry.id, entry);
    if (entry.importKey) entryByKey.set(entry.importKey, entry);
  }
  let unresolvedLines = 0;
  for (const line of lines) {
    const entry = entryByKey.get(line.journalEntryId)
      || entryByKey.get(line.importKey)
      || entryByKey.get(line.asientoKey);
    if (!entry) { unresolvedLines += 1; continue; }
    if (!linesByEntry.has(entry.id)) linesByEntry.set(entry.id, []);
    linesByEntry.get(entry.id).push({
      ...line,
      journalEntryId: entry.id,
      entryDate: line.entryDate || line.fechaOriginal || entry.date,
      entryStatus: entry.status,
      entryNumber: entry.entryNumber,
      entryDescription: entry.description,
    });
  }
  return { linesByEntry, unresolvedLines };
}

function entryIntegrity(entry, rows) {
  const debit = round2(rows.reduce((sum, line) => sum + Number(line.debit || line.debeE || 0), 0));
  const credit = round2(rows.reduce((sum, line) => sum + Number(line.credit || line.haberE || 0), 0));
  return { debit, credit, balanced: rows.length >= 2 && Math.abs(debit - credit) <= 0.01 };
}

export async function accountingData(svc, companyId, options = {}) {
  const selectedYear = Number(options.year) || null;
  const entryQuery = selectedYear ? { companyId, ejercicio: selectedYear } : { companyId };
  const lineQuery = selectedYear ? { companyId, ejercicio: selectedYear } : { companyId };
  const [entries, lines, accounts, invoices, payments] = await Promise.all([
    selectedYear
      ? Promise.all([fetchAll(svc.entities.JournalEntry, entryQuery, 'entryNumber'), fetchAll(svc.entities.JournalEntry, { companyId, ejercicio: selectedYear - 1 }, 'entryNumber')]).then(pages => [...new Map(pages.flat().map(row => [row.id, row])).values()])
      : fetchAll(svc.entities.JournalEntry, entryQuery, 'entryNumber'),
    selectedYear
      ? Promise.all([fetchAll(svc.entities.JournalEntryLine, lineQuery, 'journalEntryId'), fetchAll(svc.entities.JournalEntryLine, { companyId, ejercicio: selectedYear - 1 }, 'journalEntryId')]).then(pages => [...new Map(pages.flat().map(row => [row.id, row])).values()])
      : fetchAll(svc.entities.JournalEntryLine, lineQuery, 'journalEntryId'),
    fetchAll(svc.entities.AccountingAccount, { companyId }, 'code', 10000),
    options.includeBusinessData ? fetchAll(svc.entities.Invoice, { company_id: companyId }, 'created_date', 10000) : Promise.resolve([]),
    options.includeBusinessData ? fetchAll(svc.entities.InvoicePayment, { company_id: companyId }, 'created_date', 10000) : Promise.resolve([]),
  ]);
  const resolved = resolveModel(entries, lines);
  const accountByCode = new Map(accounts.map(account => [account.code, account]));
  const yearHeaders = selectedYear
    ? await svc.entities.JournalEntry.filter({ companyId }, '-date', 5000, 0, ['ejercicio', 'date'])
    : entries;
  const availableYears = [...new Set((yearHeaders || []).map(yearOf).filter(Boolean))].sort((a, b) => b - a);
  return { entries, lines, accounts, invoices, payments, accountByCode, availableYears, businessDataIncluded: Boolean(options.includeBusinessData), ...resolved };
}

export function accountingQuality(data) {
  const activeInvoices = data.invoices.filter(invoice => !invoice.anulada);
  const entryByKey = new Map();
  for (const entry of data.entries) {
    entryByKey.set(entry.id, entry);
    if (entry.importKey) entryByKey.set(entry.importKey, entry);
  }
  const healthyInvoice = activeInvoices.filter(invoice => {
    const entry = entryByKey.get(invoice.linked_journal_entry_id);
    if (!entry || entry.status === 'anulado') return false;
    return entryIntegrity(entry, data.linesByEntry.get(entry.id) || []).balanced;
  });
  const brokenInvoiceLinks = activeInvoices.filter(invoice => invoice.linked_journal_entry_id && !entryByKey.has(invoice.linked_journal_entry_id));
  const integrity = data.entries.map(entry => ({ entry, ...entryIntegrity(entry, data.linesByEntry.get(entry.id) || []) }));
  return {
    entries: data.entries.length,
    confirmedEntries: data.entries.filter(entry => entry.status === 'confirmado').length,
    reviewEntries: data.entries.filter(entry => ['borrador', 'pendiente_revision'].includes(entry.status)).length,
    annulledEntries: data.entries.filter(entry => entry.status === 'anulado').length,
    entriesWithoutLines: integrity.filter(item => !data.linesByEntry.get(item.entry.id)?.length).length,
    unbalancedEntries: integrity.filter(item => data.linesByEntry.get(item.entry.id)?.length && !item.balanced).length,
    unresolvedLines: data.unresolvedLines,
    businessDataIncluded: Boolean(data.businessDataIncluded),
    activeInvoices: data.businessDataIncluded ? activeInvoices.length : null,
    healthyInvoicePostings: data.businessDataIncluded ? healthyInvoice.length : null,
    pendingInvoicePostings: data.businessDataIncluded ? Math.max(0, activeInvoices.length - healthyInvoice.length) : null,
    brokenInvoiceLinks: data.businessDataIncluded ? brokenInvoiceLinks.length : null,
    payments: data.businessDataIncluded ? data.payments.length : null,
    paymentsWithEntry: data.businessDataIncluded ? data.payments.filter(payment => payment.journal_entry_id && entryByKey.has(payment.journal_entry_id)).length : null,
  };
}

export function buildReports(data, { year, scope = 'confirmed', withoutComparative = false } = {}) {
  const selectedYear = Number(year) || new Date().getFullYear();
  const eligible = data.entries.filter(entry => {
    if (yearOf(entry) !== selectedYear || entry.status === 'anulado') return false;
    return scope === 'provisional' ? ['confirmado', 'pendiente_revision'].includes(entry.status) : entry.status === 'confirmado';
  });
  const validEntries = [];
  const excluded = [];
  for (const entry of eligible) {
    const rows = data.linesByEntry.get(entry.id) || [];
    const integrity = entryIntegrity(entry, rows);
    if (integrity.balanced) validEntries.push({ entry, rows, ...integrity });
    else excluded.push({ id: entry.id, entryNumber: entry.entryNumber, reason: rows.length < 2 ? 'sin_lineas' : 'descuadrado' });
  }
  const totals = new Map();
  for (const item of validEntries) {
    for (const line of item.rows) {
      const code = String(line.accountCode || line.subcuenta || '').trim();
      if (!code) continue;
      const account = data.accountByCode.get(code) || {};
      if (!totals.has(code)) totals.set(code, { code, name: line.accountName || account.name || code, type: account.type || '', debit: 0, credit: 0, movements: 0 });
      const total = totals.get(code);
      total.debit += Number(line.debit || line.debeE || 0);
      total.credit += Number(line.credit || line.haberE || 0);
      total.movements += 1;
    }
  }
  const accounts = [...totals.values()].map(account => {
    const debit = round2(account.debit);
    const credit = round2(account.credit);
    const balance = round2(debit - credit);
    const baseKind = accountKind(account, account.code);
    const bankOverdraft = baseKind === 'asset' && (account.type === 'banco' || account.code.startsWith('57')) && balance < 0;
    return {
      ...account,
      debit,
      credit,
      balance,
      kind: bankOverdraft ? 'liability' : baseKind,
      presentationAdjustment: bankOverdraft ? 'descubierto_bancario_a_pasivo_corriente' : '',
      section: presentationSection(account, bankOverdraft ? 'liability' : baseKind),
    };
  }).sort((a, b) => a.code.localeCompare(b.code));
  const income = accounts.filter(a => a.kind === 'income').map(a => ({ ...a, amount: round2(a.credit - a.debit) }));
  const expenses = accounts.filter(a => a.kind === 'expense').map(a => ({ ...a, amount: round2(a.debit - a.credit) }));
  const assets = accounts.filter(a => a.kind === 'asset').map(a => ({ ...a, amount: round2(a.debit - a.credit) }));
  const liabilities = accounts.filter(a => a.kind === 'liability').map(a => ({ ...a, amount: round2(a.credit - a.debit) }));
  const equity = accounts.filter(a => a.kind === 'equity').map(a => ({ ...a, amount: round2(a.credit - a.debit) }));
  const totalIncome = round2(income.reduce((s, a) => s + a.amount, 0));
  const totalExpenses = round2(expenses.reduce((s, a) => s + a.amount, 0));
  const result = round2(totalIncome - totalExpenses);
  const totalAssets = round2(assets.reduce((s, a) => s + a.amount, 0));
  const totalLiabilities = round2(liabilities.reduce((s, a) => s + a.amount, 0));
  const totalEquityBeforeResult = round2(equity.reduce((s, a) => s + a.amount, 0));
  const totalEquity = round2(totalEquityBeforeResult + result);
  const balanceDifference = round2(totalAssets - totalLiabilities - totalEquity);
  const trialDebit = round2(accounts.reduce((s, a) => s + a.debit, 0));
  const trialCredit = round2(accounts.reduce((s, a) => s + a.credit, 0));
  const report = {
    year: selectedYear, scope,
    years: data.availableYears || [...new Set(data.entries.map(yearOf).filter(Boolean))].sort((a, b) => b - a),
    includedEntries: validEntries.length,
    excludedEntries: excluded.length,
    excluded: excluded.slice(0, 50),
    pendingEntriesInYear: data.entries.filter(e => yearOf(e) === selectedYear && ['borrador', 'pendiente_revision'].includes(e.status)).length,
    accounts,
    trialBalance: { debit: trialDebit, credit: trialCredit, difference: round2(trialDebit - trialCredit) },
    model: 'interno_simplificado_pgc',
    modelNotice: 'Presentación interna basada en epígrafes PGC. No sustituye los modelos oficiales de depósito ni la memoria.',
    profitAndLoss: { income, expenses, incomeSections: groupPresentation(income), expenseSections: groupPresentation(expenses), totalIncome, totalExpenses, result },
    balanceSheet: { assets, liabilities, equity, assetSections: groupPresentation(assets), liabilitySections: groupPresentation(liabilities), equitySections: groupPresentation(equity), totalAssets, totalLiabilities, totalEquityBeforeResult, result, totalEquity, difference: balanceDifference },
  };
  if (withoutComparative) return report;
  return { ...report, comparative: buildReports(data, { year: selectedYear - 1, scope, withoutComparative: true }) };
}

export function buildJournal(data, { year, status = 'all', type = 'all', source = 'all', search = '', page = 1, pageSize = 100 } = {}) {
  const normalizedSearch = String(search || '').trim().toLowerCase();
  const rows = data.entries.filter(entry => {
    if (year && year !== 'all' && yearOf(entry) !== Number(year)) return false;
    if (status !== 'all' && entry.status !== status) return false;
    if (type !== 'all' && entry.type !== type) return false;
    if (source !== 'all' && entry.source !== source) return false;
    return !normalizedSearch || `${entry.entryNumber || ''} ${entry.description || ''} ${entry.documentId || ''}`.toLowerCase().includes(normalizedSearch);
  }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.entryNumber || '').localeCompare(String(a.entryNumber || '')));
  const safeSize = Math.min(200, Math.max(20, Number(pageSize) || 100));
  const safePage = Math.max(1, Number(page) || 1);
  return {
    total: rows.length,
    page: safePage,
    pageSize: safeSize,
    years: data.availableYears || [...new Set(data.entries.map(yearOf).filter(Boolean))].sort((a, b) => b - a),
    entries: rows.slice((safePage - 1) * safeSize, safePage * safeSize).map(entry => {
      const resolvedLines = data.linesByEntry.get(entry.id) || [];
      const integrity = entryIntegrity(entry, resolvedLines);
      return { ...entry, totalDebit: integrity.debit, totalCredit: integrity.credit, isBalanced: integrity.balanced, lines: resolvedLines };
    }),
  };
}

export function buildLedger(data, { year, scope = 'confirmed', accountCode = '' } = {}) {
  const report = buildReports(data, { year, scope });
  if (!accountCode) return { year: report.year, years: report.years, scope, accounts: report.accounts };
  const eligibleStatuses = scope === 'provisional' ? new Set(['confirmado', 'pendiente_revision']) : new Set(['confirmado']);
  const entryById = new Map(data.entries.map(entry => [entry.id, entry]));
  const movements = [];
  for (const [entryId, rows] of data.linesByEntry.entries()) {
    const entry = entryById.get(entryId);
    if (!entry || yearOf(entry) !== report.year || !eligibleStatuses.has(entry.status)) continue;
    if (!entryIntegrity(entry, rows).balanced) continue;
    for (const line of rows) if (String(line.accountCode || line.subcuenta) === String(accountCode)) movements.push({
      id: line.id, date: line.entryDate || entry.date, entryId: entry.id, entryNumber: entry.entryNumber,
      description: line.description || entry.description, debit: round2(line.debit || line.debeE), credit: round2(line.credit || line.haberE),
      documentId: line.documentId || entry.documentId || '', isReconciled: Boolean(line.isReconciled),
    });
  }
  movements.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.entryNumber).localeCompare(String(b.entryNumber)));
  let runningBalance = 0;
  return { year: report.year, years: report.years, scope, accounts: report.accounts, accountCode, movements: movements.map(m => ({ ...m, runningBalance: runningBalance = round2(runningBalance + m.debit - m.credit) })) };
}


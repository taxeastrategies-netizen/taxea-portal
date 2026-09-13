export const PHASE0_CERTIFICATION_VERSION = 'tax-accounting-phase0-2026.09.12-v1';

export const TAX_MODEL_ENGINE_CODES = [
  '111', '115', '123', '130', '131', '180', '190', '193', '200', '202', '216',
  '232', '296', '303', '347', '349', '390', '415', '417', '420', '421', '425',
];

export const FISCAL_CATALOG_CODES = [
  '036', '037', '111', '115', '123', '130', '131', '180', '190', '193', '200',
  '202', '210', '216', '232', '296', '303', '309', '322', '347', '349', '353',
  '368', '369', '390', '400', '412', '414', '415', '416', '417', '418', '419',
  '420', '421', '422', '424', '425',
];

const round = value => Math.round((Number(value) || 0) * 100) / 100;
const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const active = row => row && row.anulada !== true && lower(row.status) !== 'anulado';

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows || []) {
    const key = clean(keyFn(row));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function duplicateGroups(rows, keyFn) {
  return [...groupBy(rows, keyFn).entries()]
    .filter(([, values]) => values.length > 1)
    .map(([key, values]) => ({ key, ids: values.map(value => value.id).filter(Boolean), count: values.length }));
}

function tenantOf(row) {
  return clean(row?.companyId || row?.company_id);
}

export function evaluateCompanyAccess(user, company) {
  const role = lower(user?.role);
  const email = lower(user?.email);
  const companyId = clean(company?.id);
  const assignedCompanyId = clean(user?.data?.company_id);
  const authorized = (company?.usuarios_autorizados || []).map(lower);
  const isPlatformAdmin = role === 'admin' || role === 'super_admin';
  const isOwner = Boolean(email && email === lower(company?.owner_email));
  const isAssigned = Boolean(companyId && assignedCompanyId === companyId);
  const isExplicitlyAuthorized = Boolean(email && authorized.includes(email));
  const allowed = isPlatformAdmin || isOwner || isAssigned || isExplicitlyAuthorized;
  return {
    allowed,
    role: role || 'user',
    reason: isPlatformAdmin
      ? 'platform_admin'
      : isOwner
        ? 'company_owner'
        : isAssigned
          ? 'assigned_company'
          : isExplicitlyAuthorized
            ? 'authorized_user'
            : 'not_assigned',
  };
}

function check(id, label, status, summary, metrics = {}, issues = []) {
  return { id, label, status, summary, metrics, issues: issues.slice(0, 100) };
}

function statusFor(blockers, warnings = 0) {
  if (blockers > 0) return 'blocked';
  if (warnings > 0) return 'review';
  return 'pass';
}

function stableBankAccountKey(row) {
  const providerAccount = clean(row?.provider_account_id);
  if (providerAccount) return `${lower(row?.proveedor_integracion || row?.proveedor)}|provider-account:${providerAccount}`;
  const iban = clean(row?.iban).replace(/\s+/g, '').toUpperCase();
  return iban ? `iban:${iban}` : '';
}

function stableBankTransactionKey(row, bankById) {
  const bank = bankById.get(clean(row?.bank_account_id));
  const physicalAccount = stableBankAccountKey(bank) || `bank-record:${clean(row?.bank_account_id)}`;
  const provider = clean(row?.clave_transaccion || row?.proveedor_transaccion_id);
  if (provider) return `${physicalAccount}|provider:${provider}`;
  return [
    physicalAccount, clean(row?.fecha_operacion), round(row?.importe),
    lower(row?.referencia || row?.concepto), lower(row?.moneda || 'EUR'),
  ].join('|');
}

function filingHasEvidence(row) {
  return Boolean(
    clean(row?.numeroJustificante)
    || clean(row?.csv)
    || clean(row?.justificantePdfUrl)
    || clean(row?.ficheroPresentadoUrl)
    || clean(row?.hashFicheroImportado)
  );
}

export function buildPhase0Certification(input = {}) {
  const companyId = clean(input.companyId);
  const sources = input.sources || {};
  const sourceErrors = input.sourceErrors || {};
  const sourceNames = Object.keys(sources);
  const allRows = sourceNames.flatMap(name => (sources[name] || []).map(row => ({ source: name, row })));
  const foreignRows = allRows.filter(({ row }) => {
    const tenant = tenantOf(row);
    return tenant && tenant !== companyId;
  });
  const truncatedSources = Object.entries(input.truncated || {}).filter(([, value]) => value === true).map(([name]) => name);
  const checks = [];

  const failedSources = Object.entries(sourceErrors).map(([source, message]) => ({ source, message: clean(message) }));
  checks.push(check(
    'source_readability',
    'Cobertura de fuentes',
    statusFor(failedSources.length),
    failedSources.length
      ? 'No se han podido leer todas las fuentes y el resultado no puede considerarse completo.'
      : 'Todas las fuentes necesarias respondieron correctamente.',
    { failedSources: failedSources.length, availableSources: sourceNames.length },
    failedSources.map(item => ({ type: 'source_read_error', ...item })),
  ));

  checks.push(check(
    'tenant_isolation',
    'Aislamiento por empresa',
    statusFor(foreignRows.length, truncatedSources.length),
    foreignRows.length
      ? `${foreignRows.length} registro(s) ajeno(s) llegaron al conjunto de certificación.`
      : truncatedSources.length
        ? 'No se detectaron registros ajenos, pero alguna fuente alcanzó su límite de lectura.'
        : 'Todas las fuentes leídas pertenecen exclusivamente a la empresa activa.',
    { foreignRows: foreignRows.length, truncatedSources },
    foreignRows.map(item => ({ source: item.source, id: item.row?.id, companyId: tenantOf(item.row) })),
  ));

  const entries = (sources.entries || []).filter(active);
  const lines = sources.lines || [];
  const entryByReference = new Map();
  for (const entry of entries) {
    if (entry.id) entryByReference.set(clean(entry.id), entry);
    if (entry.importKey) entryByReference.set(clean(entry.importKey), entry);
  }
  const linesByEntry = groupBy(lines, line => line.journalEntryId);
  const entryIntegrityIssues = [];
  for (const entry of entries) {
    const entryLines = [
      ...(linesByEntry.get(clean(entry.id)) || []),
      ...(entry.importKey && clean(entry.importKey) !== clean(entry.id) ? (linesByEntry.get(clean(entry.importKey)) || []) : []),
    ];
    const debit = round(entryLines.reduce((sum, line) => sum + round(line.debit), 0));
    const credit = round(entryLines.reduce((sum, line) => sum + round(line.credit), 0));
    if (!entryLines.length || Math.abs(debit - credit) > 0.01) {
      entryIntegrityIssues.push({
        type: !entryLines.length ? 'entry_without_lines' : 'unbalanced_entry',
        entryId: entry.id,
        entryNumber: entry.entryNumber,
        debit,
        credit,
        difference: round(debit - credit),
      });
    }
  }
  const orphanLines = lines.filter(line => clean(line.journalEntryId) && !entryByReference.has(clean(line.journalEntryId)));
  const duplicatePostingKeys = duplicateGroups(entries, entry => entry.postingKey);
  const duplicateEntryNumbers = duplicateGroups(entries, entry => {
    const year = entry.ejercicio || clean(entry.date).slice(0, 4);
    return entry.entryNumber ? `${year}|${entry.series || 'GENERAL'}|${entry.entryNumber}` : '';
  });
  const accountingBlockers = entryIntegrityIssues.length + orphanLines.length + duplicatePostingKeys.length + duplicateEntryNumbers.length;
  checks.push(check(
    'accounting_integrity',
    'Integridad del libro diario',
    statusFor(accountingBlockers),
    accountingBlockers
      ? 'Existen asientos, líneas o claves que impiden certificar el libro.'
      : 'Asientos con líneas, partida doble y claves únicas en el conjunto analizado.',
    {
      entries: entries.length,
      lines: lines.length,
      entryIssues: entryIntegrityIssues.length,
      orphanLines: orphanLines.length,
      duplicatePostingKeys: duplicatePostingKeys.length,
      duplicateEntryNumbers: duplicateEntryNumbers.length,
    },
    [...entryIntegrityIssues, ...orphanLines.slice(0, 25).map(line => ({ type: 'orphan_line', lineId: line.id, journalEntryId: line.journalEntryId })), ...duplicatePostingKeys.map(item => ({ type: 'duplicate_posting_key', ...item })), ...duplicateEntryNumbers.map(item => ({ type: 'duplicate_entry_number', ...item }))],
  ));

  const invoices = (sources.invoices || []).filter(row => row.anulada !== true);
  const liveEntryIds = new Set(entries.flatMap(entry => [clean(entry.id), clean(entry.importKey)]).filter(Boolean));
  const brokenInvoiceLinks = invoices.filter(invoice => clean(invoice.linked_journal_entry_id) && !liveEntryIds.has(clean(invoice.linked_journal_entry_id)));
  const expectedPostedInvoices = invoices.filter(invoice => lower(invoice.estado_contable) === 'contabilizada' || lower(invoice.accounting_review_status) === 'validada_contabilizada');
  const postedWithoutLink = expectedPostedInvoices.filter(invoice => !clean(invoice.linked_journal_entry_id));
  const pendingInvoices = invoices.filter(invoice => !clean(invoice.linked_journal_entry_id) && !expectedPostedInvoices.includes(invoice) && invoice.accounting_migration_hold !== true);
  const invoiceBlockers = brokenInvoiceLinks.length + postedWithoutLink.length;
  checks.push(check(
    'invoice_accounting_links',
    'Facturas y asientos',
    statusFor(invoiceBlockers, pendingInvoices.length),
    invoiceBlockers
      ? 'Hay facturas contabilizadas con un enlace contable roto o inexistente.'
      : pendingInvoices.length
        ? 'Los enlaces existentes son coherentes; quedan facturas pendientes de contabilizar o revisar.'
        : 'Todas las facturas activas esperadas están enlazadas con un asiento válido.',
    {
      activeInvoices: invoices.length,
      expectedPosted: expectedPostedInvoices.length,
      brokenLinks: brokenInvoiceLinks.length,
      postedWithoutLink: postedWithoutLink.length,
      pendingPosting: pendingInvoices.length,
    },
    [
      ...brokenInvoiceLinks.map(invoice => ({ type: 'broken_invoice_link', invoiceId: invoice.id, journalEntryId: invoice.linked_journal_entry_id })),
      ...postedWithoutLink.map(invoice => ({ type: 'posted_invoice_without_link', invoiceId: invoice.id })),
      ...pendingInvoices.slice(0, 50).map(invoice => ({ type: 'pending_invoice_posting', invoiceId: invoice.id })),
    ],
  ));

  const taxLines = sources.taxLines || [];
  const taxLinesByInvoice = groupBy(taxLines, row => row.invoiceId);
  const missingTaxDetail = invoices.filter(invoice => !(taxLinesByInvoice.get(clean(invoice.id)) || []).length);
  const reviewedTaxLines = taxLines.filter(line => ['validado', 'validado_asesor'].includes(lower(line.reviewStatus || line.fiscalReviewStatus)));
  checks.push(check(
    'fiscal_subledger',
    'Submayor fiscal IVA / IGIC',
    statusFor(0, missingTaxDetail.length),
    missingTaxDetail.length
      ? 'Existen facturas que dependen todavía del agregado fiscal legado.'
      : 'Todas las facturas activas disponen de desglose fiscal normalizado.',
    { taxLines: taxLines.length, reviewedTaxLines: reviewedTaxLines.length, invoicesWithoutTaxLines: missingTaxDetail.length },
    missingTaxDetail.slice(0, 100).map(invoice => ({ type: 'missing_invoice_tax_lines', invoiceId: invoice.id })),
  ));

  const expenses = (sources.expenses || []).filter(row => row.anulada !== true);
  const parallelExpenses = expenses.filter(expense =>
    !clean(expense.canonical_invoice_id || expense.linked_invoice_id)
    && !clean(expense.linked_journal_entry_id)
  );
  checks.push(check(
    'single_source_truth',
    'Fuente única de ingresos y gastos',
    statusFor(0, parallelExpenses.length),
    parallelExpenses.length
      ? 'Hay registros manuales Expense que no están enlazados con factura o asiento canónico.'
      : 'No se detectaron registros económicos activos fuera del circuito canónico.',
    { expenses: expenses.length, parallelExpenses: parallelExpenses.length },
    parallelExpenses.slice(0, 100).map(expense => ({ type: 'parallel_expense', expenseId: expense.id })),
  ));

  const payments = sources.payments || [];
  const invoiceIds = new Set(invoices.map(invoice => clean(invoice.id)));
  const brokenPayments = payments.filter(payment => !invoiceIds.has(clean(payment.invoice_id)) || (clean(payment.journal_entry_id) && !liveEntryIds.has(clean(payment.journal_entry_id))));
  const unpostedPayments = payments.filter(payment => !clean(payment.journal_entry_id));
  checks.push(check(
    'payment_accounting',
    'Cobros y pagos',
    statusFor(brokenPayments.length, unpostedPayments.length),
    brokenPayments.length
      ? 'Hay cobros o pagos con referencias rotas.'
      : unpostedPayments.length
        ? 'Los enlaces son válidos, pero quedan movimientos de cobro o pago sin asiento.'
        : 'Todos los cobros y pagos analizados están vinculados con factura y asiento.',
    { payments: payments.length, brokenPayments: brokenPayments.length, unpostedPayments: unpostedPayments.length },
    [
      ...brokenPayments.map(payment => ({ type: 'broken_payment_link', paymentId: payment.id, invoiceId: payment.invoice_id, journalEntryId: payment.journal_entry_id })),
      ...unpostedPayments.slice(0, 100).map(payment => ({ type: 'unposted_payment', paymentId: payment.id, invoiceId: payment.invoice_id })),
    ],
  ));

  const accounts = (sources.accounts || []).filter(row => lower(row.status) !== 'inactiva');
  const accountsById = new Map(accounts.map(account => [clean(account.id), account]));
  const accountsByCode = new Map(accounts.map(account => [clean(account.code), account]));
  const bankAccounts = (sources.bankAccounts || []).filter(row => row.activa !== false);
  const bankById = new Map(bankAccounts.map(account => [clean(account.id), account]));
  const bankTransactions = (sources.bankTransactions || []).filter(row => row.es_demo !== true && lower(row.estado_proveedor) !== 'pending');
  const duplicateBankAccounts = duplicateGroups(bankAccounts, stableBankAccountKey);
  const duplicateLedgerMappings = duplicateGroups(bankAccounts, row => clean(row.accounting_account_id || row.accounting_account_code));
  const duplicateBankTransactions = duplicateGroups(bankTransactions, row => stableBankTransactionKey(row, bankById));
  const reconciledStates = new Set(['conciliada_auto', 'conciliada_manual', 'movimiento_interno']);
  const reconciledWithoutEntry = bankTransactions.filter(row => reconciledStates.has(lower(row.estado_conciliacion)) && !clean(row.journal_entry_id));
  const confirmedEntries = entries.filter(entry => lower(entry.status) === 'confirmado');
  const confirmedReferences = new Set();
  for (const entry of confirmedEntries) {
    if (entry.id) confirmedReferences.add(clean(entry.id));
    if (entry.importKey) confirmedReferences.add(clean(entry.importKey));
  }
  const confirmedLines = lines.filter(line => confirmedReferences.has(clean(line.journalEntryId)));
  const bankBalances = bankAccounts.map(bank => {
    const ledger = accountsById.get(clean(bank.accounting_account_id)) || accountsByCode.get(clean(bank.accounting_account_code));
    const ledgerCode = clean(ledger?.code || bank.accounting_account_code);
    const ledgerBalance = round(confirmedLines
      .filter(line => (ledger?.id && clean(line.accountId) === clean(ledger.id)) || (ledgerCode && clean(line.accountCode) === ledgerCode))
      .reduce((sum, line) => sum + round(line.debit) - round(line.credit), 0));
    const currency = clean(bank.moneda || 'EUR').toUpperCase();
    const bankBalance = round(bank.saldo_disponible ?? bank.saldo_contable);
    return {
      bankAccountId: bank.id,
      ledgerAccountId: ledger?.id || '',
      ledgerCode,
      currency,
      mapped: Boolean(ledger && /^572\d{5}$/.test(ledgerCode)),
      comparable: currency === 'EUR',
      bankBalance,
      ledgerBalance,
      difference: currency === 'EUR' ? round(bankBalance - ledgerBalance) : null,
    };
  });
  const invalidBankMappings = bankBalances.filter(item => !item.mapped);
  const bankDifferences = bankBalances.filter(item => item.comparable && Math.abs(item.difference) > 0.01);
  const nonComparableBanks = bankBalances.filter(item => !item.comparable);
  const bankBlockers = duplicateBankAccounts.length + duplicateLedgerMappings.length + duplicateBankTransactions.length + reconciledWithoutEntry.length;
  const bankWarnings = invalidBankMappings.length + bankDifferences.length + nonComparableBanks.length;
  checks.push(check(
    'bank_reconciliation',
    'Banco y subcuentas 572',
    statusFor(bankBlockers, bankWarnings),
    bankBlockers
      ? 'Hay duplicados bancarios o conciliaciones sin asiento.'
      : bankWarnings
        ? 'No hay duplicados estructurales, pero quedan mapeos, divisas o diferencias banco–572 por revisar.'
        : 'Movimientos únicos y saldos bancarios EUR conciliados con sus subcuentas 572.',
    {
      bankAccounts: bankAccounts.length,
      bankTransactions: bankTransactions.length,
      duplicateBankAccountGroups: duplicateBankAccounts.length,
      duplicateLedgerMappings: duplicateLedgerMappings.length,
      duplicateTransactionGroups: duplicateBankTransactions.length,
      reconciledWithoutEntry: reconciledWithoutEntry.length,
      invalidMappings: invalidBankMappings.length,
      balanceDifferences: bankDifferences.length,
      nonComparableCurrencies: nonComparableBanks.length,
      balances: bankBalances,
    },
    [
      ...duplicateBankAccounts.map(item => ({ type: 'duplicate_bank_account', ...item })),
      ...duplicateLedgerMappings.map(item => ({ type: 'duplicate_bank_ledger_mapping', ...item })),
      ...duplicateBankTransactions.map(item => ({ type: 'duplicate_bank_transaction', ...item })),
      ...reconciledWithoutEntry.map(row => ({ type: 'reconciled_bank_without_entry', bankTransactionId: row.id })),
      ...invalidBankMappings.map(item => ({ type: 'invalid_bank_mapping', ...item })),
      ...bankDifferences.map(item => ({ type: 'bank_ledger_difference', ...item })),
      ...nonComparableBanks.map(item => ({ type: 'currency_requires_revaluation', ...item })),
    ],
  ));

  const drafts = sources.taxDrafts || [];
  const filings = sources.taxFilings || [];
  const officialFiles = sources.taxOfficialFiles || [];
  const periods = sources.taxPeriods || [];
  const duplicateDraftSnapshots = duplicateGroups(drafts, draft => draft.snapshotHash ? `${draft.modeloCodigo}|${draft.ejercicio}|${draft.periodo}|${draft.snapshotHash}` : '');
  const presentedWithoutEvidence = filings.filter(row => ['presentado', 'subsanado'].includes(lower(row.estadoPresentacion)) && !filingHasEvidence(row));
  const mutableOfficialFiles = officialFiles.filter(row => row.immutable !== true);
  const closedPeriodsWithoutFiling = periods.filter(period => lower(period.estado) === 'presentado' && !filings.some(filing => clean(filing.modeloCodigo) === clean(period.modeloCodigo) && Number(filing.ejercicio) === Number(period.ejercicio) && clean(filing.periodo) === clean(period.periodo) && ['presentado', 'subsanado'].includes(lower(filing.estadoPresentacion))));
  const fiscalBlockers = presentedWithoutEvidence.length + mutableOfficialFiles.length + closedPeriodsWithoutFiling.length;
  checks.push(check(
    'fiscal_workflow',
    'Borradores, ficheros y presentaciones',
    statusFor(fiscalBlockers, duplicateDraftSnapshots.length),
    fiscalBlockers
      ? 'Hay estados fiscales que no conservan toda la evidencia o inmutabilidad exigida.'
      : duplicateDraftSnapshots.length
        ? 'El circuito es trazable, pero existen snapshots duplicados que deben revisarse.'
        : 'Los estados fiscales analizados conservan separación e inmutabilidad coherentes.',
    {
      drafts: drafts.length,
      filings: filings.length,
      officialFiles: officialFiles.length,
      periods: periods.length,
      duplicateDraftSnapshots: duplicateDraftSnapshots.length,
      presentedWithoutEvidence: presentedWithoutEvidence.length,
      mutableOfficialFiles: mutableOfficialFiles.length,
      closedPeriodsWithoutFiling: closedPeriodsWithoutFiling.length,
    },
    [
      ...duplicateDraftSnapshots.map(item => ({ type: 'duplicate_tax_snapshot', ...item })),
      ...presentedWithoutEvidence.map(row => ({ type: 'filing_without_evidence', filingId: row.id })),
      ...mutableOfficialFiles.map(row => ({ type: 'mutable_official_file', officialFileId: row.id })),
      ...closedPeriodsWithoutFiling.map(row => ({ type: 'presented_period_without_filing', taxPeriodId: row.id })),
    ],
  ));

  const configuredModels = (sources.taxModels || []).filter(model => model.activo !== false).map(model => clean(model.codigo)).filter(Boolean);
  const engineSet = new Set(TAX_MODEL_ENGINE_CODES);
  const catalogSet = new Set(FISCAL_CATALOG_CODES);
  const configuredWithoutEngine = configuredModels.filter(code => !engineSet.has(code));
  const engineMissingFromCatalog = TAX_MODEL_ENGINE_CODES.filter(code => !catalogSet.has(code));
  checks.push(check(
    'model_catalog',
    'Catálogo y motor de modelos',
    statusFor(engineMissingFromCatalog.length, configuredWithoutEngine.length),
    engineMissingFromCatalog.length
      ? 'El motor contiene modelos ausentes del catálogo fiscal.'
      : configuredWithoutEngine.length
        ? 'El catálogo está alineado; algunas obligaciones configuradas son solo censales o todavía no tienen motor de cálculo.'
        : 'Todos los modelos configurados están cubiertos por el motor publicado.',
    {
      catalogModels: FISCAL_CATALOG_CODES.length,
      engineModels: TAX_MODEL_ENGINE_CODES.length,
      configuredModels: configuredModels.length,
      configuredWithoutEngine,
      engineMissingFromCatalog,
      catalogOnlyModels: FISCAL_CATALOG_CODES.filter(code => !engineSet.has(code)),
    },
    [
      ...engineMissingFromCatalog.map(code => ({ type: 'engine_model_missing_from_catalog', code })),
      ...configuredWithoutEngine.map(code => ({ type: 'configured_model_without_engine', code })),
    ],
  ));

  const blockingChecks = checks.filter(item => item.status === 'blocked');
  const reviewChecks = checks.filter(item => item.status === 'review');
  const passedChecks = checks.filter(item => item.status === 'pass');
  const score = Math.max(0, Math.round(((passedChecks.length + reviewChecks.length * 0.5) / Math.max(1, checks.length)) * 100));
  return {
    version: PHASE0_CERTIFICATION_VERSION,
    generatedAt: new Date().toISOString(),
    companyId,
    status: blockingChecks.length ? 'blocked' : reviewChecks.length ? 'review' : 'certified',
    score,
    summary: {
      checks: checks.length,
      passed: passedChecks.length,
      review: reviewChecks.length,
      blocked: blockingChecks.length,
    },
    checks,
    guarantees: {
      readOnly: true,
      noAutomaticCorrections: true,
      officialImporterAcceptance: false,
      professionalReviewRequired: true,
    },
  };
}

export function runSyntheticCertificationSuite() {
  const companyId = 'company-a';
  const baseSources = {
    invoices: [{ id: 'invoice-1', company_id: companyId, estado_contable: 'contabilizada', linked_journal_entry_id: 'entry-1' }],
    expenses: [],
    entries: [{ id: 'entry-1', companyId, entryNumber: '1', ejercicio: 2026, date: '2026-01-15', series: 'GENERAL', status: 'confirmado', postingKey: 'invoice:invoice-1' }],
    lines: [
      { id: 'line-1', companyId, journalEntryId: 'entry-1', accountId: 'customer-1', accountCode: '43000001', debit: 121, credit: 0 },
      { id: 'line-2', companyId, journalEntryId: 'entry-1', accountId: 'income-1', accountCode: '70500000', debit: 0, credit: 100 },
      { id: 'line-3', companyId, journalEntryId: 'entry-1', accountId: 'tax-1', accountCode: '47700000', debit: 0, credit: 21 },
    ],
    taxLines: [{ id: 'tax-1', companyId, invoiceId: 'invoice-1', reviewStatus: 'validado' }],
    payments: [], bankAccounts: [], bankTransactions: [], accounts: [],
    taxDrafts: [], taxFilings: [], taxOfficialFiles: [], taxPeriods: [], taxModels: [], fiscalProfiles: [],
  };
  const healthy = buildPhase0Certification({ companyId, sources: baseSources });
  const broken = buildPhase0Certification({
    companyId,
    sources: {
      ...baseSources,
      expenses: [{ id: 'expense-1', company_id: companyId, total: 50 }],
      entries: [...baseSources.entries, { id: 'entry-2', companyId, entryNumber: '1', ejercicio: 2026, date: '2026-01-16', status: 'confirmado', postingKey: 'invoice:invoice-1' }],
      lines: [...baseSources.lines, { id: 'line-4', companyId, journalEntryId: 'entry-2', accountCode: '62900000', debit: 50, credit: 0 }],
      bankAccounts: [
        { id: 'bank-account-1', company_id: companyId, proveedor_integracion: 'enablebanking', provider_account_id: 'physical-1', accounting_account_code: '57200001' },
        { id: 'bank-account-2', company_id: companyId, proveedor_integracion: 'enablebanking', provider_account_id: 'physical-1', accounting_account_code: '57200001' },
      ],
      bankTransactions: [
        { id: 'bank-1', company_id: companyId, bank_account_id: 'bank-account-1', fecha_operacion: '2026-01-20', concepto: 'Pago', importe: -50, clave_transaccion: 'same' },
        { id: 'bank-2', company_id: companyId, bank_account_id: 'bank-account-1', fecha_operacion: '2026-01-20', concepto: 'Pago', importe: -50, clave_transaccion: 'same' },
      ],
    },
  });
  const crossTenant = buildPhase0Certification({
    companyId,
    sources: { ...baseSources, expenses: [{ id: 'foreign-1', company_id: 'company-b', total: 10 }] },
  });
  const accessCases = {
    owner: evaluateCompanyAccess({ email: 'owner@example.com', role: 'user', data: {} }, { id: companyId, owner_email: 'owner@example.com' }).allowed,
    assigned: evaluateCompanyAccess({ email: 'user@example.com', role: 'user', data: { company_id: companyId } }, { id: companyId }).allowed,
    explicitAdvisor: evaluateCompanyAccess({ email: 'advisor@example.com', role: 'advisor', data: {} }, { id: companyId, usuarios_autorizados: ['advisor@example.com'] }).allowed,
    unrelatedAdvisorDenied: !evaluateCompanyAccess({ email: 'other@example.com', role: 'advisor', data: {} }, { id: companyId }).allowed,
    platformAdmin: evaluateCompanyAccess({ email: 'admin@example.com', role: 'admin', data: {} }, { id: companyId }).allowed,
  };
  const assertions = {
    healthyCertified: healthy.status === 'certified',
    unbalancedDetected: broken.checks.find(item => item.id === 'accounting_integrity')?.status === 'blocked',
    duplicatePostingDetected: broken.checks.find(item => item.id === 'accounting_integrity')?.metrics?.duplicatePostingKeys === 1,
    duplicateNumberDetected: broken.checks.find(item => item.id === 'accounting_integrity')?.metrics?.duplicateEntryNumbers === 1,
    duplicateBankDetected: broken.checks.find(item => item.id === 'bank_reconciliation')?.metrics?.duplicateTransactionGroups === 1,
    duplicatePhysicalBankDetected: broken.checks.find(item => item.id === 'bank_reconciliation')?.metrics?.duplicateBankAccountGroups === 1,
    duplicateLedgerMappingDetected: broken.checks.find(item => item.id === 'bank_reconciliation')?.metrics?.duplicateLedgerMappings === 1,
    parallelExpenseDetected: broken.checks.find(item => item.id === 'single_source_truth')?.status === 'review',
    crossTenantDetected: crossTenant.checks.find(item => item.id === 'tenant_isolation')?.status === 'blocked',
    ...accessCases,
  };
  return {
    ok: Object.values(assertions).every(Boolean),
    version: PHASE0_CERTIFICATION_VERSION,
    assertions,
    diagnostics: { healthy: healthy.summary, broken: broken.summary, crossTenant: crossTenant.summary },
  };
}

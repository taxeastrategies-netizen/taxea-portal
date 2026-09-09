import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import {
  SCHEMA_VERSION,
  assertAccountingDateOpen,
  buildInvoicePosting,
  canonical8,
  createJournalEntry,
  ensureAccount,
  isCanonical8,
  postBankReconciliation,
  postInvoice,
  seedOperationalPgc,
} from './accountingEngine.ts';
import {
  accountingData,
  accountingQuality,
  buildJournal,
  buildLedger,
  buildReports,
  fetchAll,
} from './accountingReportEngine.ts';
import {
  closingPreview,
  executeClosing,
  listFiscalYears,
  saveFiscalYear,
  setPeriodLock,
} from './accountingPeriodEngine.ts';

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

async function resolveEntryLines(svc, companyId, entry) {
  let lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: entry.id }, 'lineNumber', 5000);
  if ((!lines || !lines.length) && entry.importKey) {
    lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: entry.importKey }, 'lineNumber', 5000);
  }
  return lines || [];
}

const normalizeBankIban = (value) => String(value || '').replace(/\s+/g, '').toUpperCase();
const bankCurrency = (bankAccount) => String(bankAccount?.moneda || bankAccount?.currency || 'EUR').trim().toUpperCase();
const stableBankIdentity = (bankAccount) => {
  const currency = bankCurrency(bankAccount);
  const iban = normalizeBankIban(bankAccount?.iban);
  if (iban) return `iban:${iban}:${currency}`;
  const providerAccountId = String(bankAccount?.provider_account_id || '').trim();
  if (providerAccountId) return `provider:${providerAccountId}:${currency}`;
  return '';
};

async function linkBankPostingAccount(svc, bankAccount, account, identityKey) {
  await svc.entities.BankAccount.update(bankAccount.id, { accounting_account_id: account.id, accounting_account_code: account.code });
  const updates = {};
  if (identityKey && account.bankIdentityKey !== identityKey) updates.bankIdentityKey = identityKey;
  if (account.bankAccountId !== bankAccount.id) updates.bankAccountId = bankAccount.id;
  if (account.bankCurrency !== bankCurrency(bankAccount)) updates.bankCurrency = bankCurrency(bankAccount);
  if (Object.keys(updates).length) await svc.entities.AccountingAccount.update(account.id, updates);
  return { ...account, ...updates };
}

async function ensureBankPostingAccount(svc, companyId, bankAccount) {
  if (!bankAccount || bankAccount.company_id !== companyId) throw new Error('La cuenta bancaria no pertenece a la empresa.');
  const identityKey = stableBankIdentity(bankAccount);
  if (bankAccount.accounting_account_id) {
    const linked = await svc.entities.AccountingAccount.get(bankAccount.accounting_account_id).catch(() => null);
    if (linked && linked.companyId === companyId && linked.status !== 'inactiva') return await linkBankPostingAccount(svc, bankAccount, linked, identityKey);
  }
  if (bankAccount.accounting_account_code) {
    const linked = await svc.entities.AccountingAccount.filter({ companyId, code: bankAccount.accounting_account_code }, '-created_date', 1);
    if (linked?.[0] && linked[0].status !== 'inactiva') return await linkBankPostingAccount(svc, bankAccount, linked[0], identityKey);
  }
  if (identityKey) {
    const byIdentity = await svc.entities.AccountingAccount.filter({ companyId, bankIdentityKey: identityKey }, '-created_date', 10);
    const reusable = byIdentity?.find(item => item.status !== 'inactiva');
    if (reusable) return await linkBankPostingAccount(svc, bankAccount, reusable, identityKey);

    const peerBanks = await fetchAll(svc.entities.BankAccount, { company_id: companyId }, 'created_date', 10000);
    for (const peer of peerBanks) {
      if (peer.id === bankAccount.id || stableBankIdentity(peer) !== identityKey) continue;
      let peerAccount = null;
      if (peer.accounting_account_id) peerAccount = await svc.entities.AccountingAccount.get(peer.accounting_account_id).catch(() => null);
      if (!peerAccount && peer.accounting_account_code) {
        const rows = await svc.entities.AccountingAccount.filter({ companyId, code: peer.accounting_account_code }, '-created_date', 1);
        peerAccount = rows?.[0] || null;
      }
      if (peerAccount && peerAccount.companyId === companyId && peerAccount.status !== 'inactiva') {
        return await linkBankPostingAccount(svc, bankAccount, peerAccount, identityKey);
      }
    }
  }

  const accounts = await fetchAll(svc.entities.AccountingAccount, { companyId }, 'code', 10000);
  if (identityKey) {
    const reusable = accounts.find(item => item.bankIdentityKey === identityKey && item.status !== 'inactiva');
    if (reusable) return await linkBankPostingAccount(svc, bankAccount, reusable, identityKey);
  }
  const used = new Set(accounts.map(account => String(account.code || '')));
  let code = '';
  for (let sequence = 1; sequence <= 9999; sequence += 1) {
    const candidate = `5720${String(sequence).padStart(4, '0')}`;
    if (!used.has(candidate)) { code = candidate; break; }
  }
  if (!code) throw new Error('No quedan subcuentas bancarias disponibles en el grupo 5720.');
  const suffix = bankAccount.ultimos_4 ? ` · ${bankAccount.ultimos_4}` : '';
  const account = await ensureAccount(svc, companyId, code, `${bankAccount.nombre_banco || 'Banco'}${suffix} · ${bankCurrency(bankAccount)}`, 'banco');
  return await linkBankPostingAccount(svc, bankAccount, account, identityKey);
}

async function buildAccountingConfigurationDiagnostics(svc, companyId, configuration) {
  const [accounts, banks, invoices, periods] = await Promise.all([
    fetchAll(svc.entities.AccountingAccount, { companyId }, 'code', 10000),
    fetchAll(svc.entities.BankAccount, { company_id: companyId }, 'created_date', 10000),
    fetchAll(svc.entities.Invoice, { company_id: companyId }, 'fecha_emision', 100000),
    listFiscalYears(svc, companyId),
  ]);
  const activeAccounts = accounts.filter(item => item.status !== 'inactiva');
  const activeByCode = new Map(activeAccounts.map(item => [String(item.code || ''), item]));
  let mappings = [];
  try {
    const parsed = JSON.parse(configuration?.mappingsJson || '[]');
    mappings = Array.isArray(parsed) ? parsed : Object.entries(parsed || {}).map(([categoria, cuenta]) => ({ categoria, cuenta }));
  } catch {
    mappings = [];
  }
  const mappingCodes = [...new Set(mappings.map(item => String(item?.cuenta || '')).filter(Boolean))];
  const invalidMappingCodes = mappingCodes.filter(code => !/^\d{8}$/.test(code) || !activeByCode.has(code));
  const usedCategories = [...new Set(invoices.map(invoice => String(invoice.categoria || invoice.categoria_gasto || invoice.categoria_contable || '').trim()).filter(Boolean))];
  const mappedCategories = new Set(mappings.map(item => String(item?.categoria || '').trim()).filter(Boolean));
  const unmappedCategories = usedCategories.filter(category => !mappedCategories.has(category));
  const activeBanks = banks.filter(bank => bank.activa !== false);
  const connectedBanks = activeBanks.filter(bank => ['conectado', 'connected', 'active', 'ready'].includes(String(bank.estado_conexion || '').toLowerCase()));
  const mappedBanks = connectedBanks.filter(bank => bank.accounting_account_id && activeAccounts.some(account => account.id === bank.accounting_account_id));
  const referencedLedgerIds = new Set(banks.map(bank => bank.accounting_account_id).filter(Boolean));
  const orphanBankLedgers = activeAccounts.filter(account => account.type === 'banco' && /^5720/.test(String(account.code || '')) && account.code !== '57200000' && !referencedLedgerIds.has(account.id));
  const currentYear = new Date().getUTCFullYear();
  const currentPeriod = periods.find(period => Number(period.year) === currentYear) || null;
  const scoreParts = [invalidMappingCodes.length === 0, unmappedCategories.length === 0, connectedBanks.length === mappedBanks.length, orphanBankLedgers.length === 0, Boolean(currentPeriod)];
  return {
    generatedAt: new Date().toISOString(),
    readinessScore: Math.round((scoreParts.filter(Boolean).length / scoreParts.length) * 100),
    accounts: { total: accounts.length, active: activeAccounts.length, invalidMappingCodes },
    categories: { used: usedCategories, unmapped: unmappedCategories },
    banking: { active: connectedBanks.length, connected: connectedBanks.length, mapped: mappedBanks.length, pendingConnections: activeBanks.length - connectedBanks.length, orphanLedgerCodes: orphanBankLedgers.map(account => account.code) },
    periods: { total: periods.length, currentYearConfigured: Boolean(currentPeriod), currentYearStatus: currentPeriod?.status || 'sin_configurar' },
  };
}

const normalizeAuditText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const normalizeAuditTaxId = (value) => normalizeAuditText(value).replace(/\s/g, '');
const invoiceParty = (invoice) => invoice.tipo === 'emitida'
  ? { name: invoice.cliente_nombre || '', taxId: invoice.cliente_nif || '' }
  : { name: invoice.proveedor_nombre || '', taxId: invoice.proveedor_nif || '' };
const invoiceSummary = (invoice) => {
  const party = invoiceParty(invoice);
  return {
    id: invoice.id,
    type: invoice.tipo || '',
    number: invoice.numero_factura || '',
    date: invoice.fecha_emision || '',
    party: party.name,
    taxId: party.taxId,
    total: money(invoice.total_factura),
    status: invoice.estado_contable || '',
    linkedEntryId: invoice.linked_journal_entry_id || '',
  };
};
const entrySummary = (entry) => ({
  id: entry.id,
  entryNumber: entry.entryNumber || '',
  date: entry.date || '',
  type: entry.type || '',
  source: entry.source || '',
  description: entry.description || '',
  documentId: entry.documentId || '',
  postingKey: entry.postingKey || '',
  total: money(entry.totalDebit),
  status: entry.status || '',
});

function duplicateGroups(rows, keyFor, summarize, reason, confidence, excludedSets = new Set()) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }
  const result = [];
  for (const [key, group] of grouped.entries()) {
    if (group.length < 2) continue;
    const idSet = group.map(item => item.id).sort().join('|');
    if (excludedSets.has(idSet)) continue;
    excludedSets.add(idSet);
    result.push({ key, reason, confidence, items: group.map(summarize) });
  }
  return result;
}

function buildDuplicateAudit(invoices, entries, accounts = []) {
  const activeInvoices = (invoices || []).filter(invoice => !invoice.anulada);
  const activeEntries = (entries || []).filter(entry => entry.status !== 'anulado');
  const invoiceSets = new Set();
  const strongInvoices = duplicateGroups(
    activeInvoices,
    (invoice) => {
      const party = invoiceParty(invoice);
      const number = normalizeAuditText(invoice.numero_factura).replace(/\s/g, '');
      const identity = normalizeAuditTaxId(party.taxId) || normalizeAuditText(party.name);
      return number && identity ? `${invoice.tipo}|${identity}|${number}` : '';
    },
    invoiceSummary,
    'Mismo tipo, tercero y número de factura',
    'alta',
    invoiceSets,
  );
  const strongSignatureInvoices = duplicateGroups(
    activeInvoices,
    (invoice) => {
      const number = normalizeAuditText(invoice.numero_factura).replace(/\s/g, '');
      return number && invoice.fecha_emision
        ? `${invoice.tipo}|${number}|${invoice.fecha_emision}|${money(invoice.total_factura).toFixed(2)}`
        : '';
    },
    invoiceSummary,
    'Mismo tipo, número, fecha e importe de factura',
    'alta',
    invoiceSets,
  );
  const possibleInvoices = duplicateGroups(
    activeInvoices,
    (invoice) => {
      const party = invoiceParty(invoice);
      const identity = normalizeAuditTaxId(party.taxId) || normalizeAuditText(party.name);
      const concept = normalizeAuditText(invoice.concepto);
      return invoice.fecha_emision && identity
        ? `${invoice.tipo}|${invoice.fecha_emision}|${money(invoice.total_factura).toFixed(2)}|${identity}|${concept}`
        : '';
    },
    invoiceSummary,
    'Mismo tipo, fecha, importe, tercero y concepto',
    'media',
    invoiceSets,
  );

  const entrySets = new Set();
  const postingKeyEntries = duplicateGroups(
    activeEntries,
    entry => entry.postingKey ? `posting:${entry.postingKey}` : '',
    entrySummary,
    'Clave contable idempotente repetida',
    'alta',
    entrySets,
  );
  const documentEntries = duplicateGroups(
    activeEntries,
    entry => entry.documentId && ['factura_emitida', 'factura_recibida', 'OCR', 'conciliacion'].includes(entry.source)
      ? `documento:${entry.source}:${entry.documentId}`
      : '',
    entrySummary,
    'Más de un asiento activo para el mismo documento origen',
    'alta',
    entrySets,
  );
  const possibleEntries = duplicateGroups(
    activeEntries,
    entry => entry.date && Number(entry.totalDebit || 0) > 0
      ? `firma:${entry.date}|${entry.type}|${money(entry.totalDebit).toFixed(2)}|${normalizeAuditText(entry.description)}`
      : '',
    entrySummary,
    'Misma fecha, tipo, importe y descripción',
    'media',
    entrySets,
  );

  const entryById = new Map();
  for (const entry of entries || []) {
    entryById.set(entry.id, entry);
    if (entry.importKey) entryById.set(entry.importKey, entry);
  }
  const activeEntriesByDocument = new Map();
  for (const entry of activeEntries) {
    if (!entry.documentId) continue;
    const isInvoicePosting = String(entry.postingKey || '').startsWith('invoice:')
      || ['factura_emitida', 'factura_recibida', 'OCR'].includes(entry.source);
    if (!isInvoicePosting) continue;
    activeEntriesByDocument.set(entry.documentId, [...(activeEntriesByDocument.get(entry.documentId) || []), entry]);
  }
  const invoiceEntryConflicts = [];
  for (const invoice of activeInvoices) {
    const linked = invoice.linked_journal_entry_id ? entryById.get(invoice.linked_journal_entry_id) : null;
    const documentMatches = activeEntriesByDocument.get(invoice.id) || [];
    if (invoice.linked_journal_entry_id && (!linked || linked.status === 'anulado' || linked.companyId !== invoice.company_id)) {
      invoiceEntryConflicts.push({ invoice: invoiceSummary(invoice), reason: 'La factura apunta a un asiento inexistente, anulado o de otra empresa.' });
    } else if (linked && linked.documentId && linked.documentId !== invoice.id) {
      invoiceEntryConflicts.push({ invoice: invoiceSummary(invoice), reason: 'La factura apunta a un asiento asociado a otro documento.' });
    } else if (documentMatches.length > 1) {
      invoiceEntryConflicts.push({ invoice: invoiceSummary(invoice), reason: 'La factura tiene más de un asiento activo.', entries: documentMatches.map(entrySummary) });
    }
  }
  const invoiceDuplicateGroups = [...strongInvoices, ...strongSignatureInvoices, ...possibleInvoices];
  const journalDuplicateGroups = [...postingKeyEntries, ...documentEntries, ...possibleEntries];
  const accountDuplicateGroups = duplicateGroups(
    (accounts || []).filter(account => account.status !== 'inactiva' && isCanonical8(account.code)),
    account => account.code,
    account => ({ id: account.id, code: account.code, name: account.name || '', type: account.type || '', status: account.status || 'activa' }),
    'La misma subcuenta está activa más de una vez',
    'alta',
  );
  const duplicateInvoiceIds = [...new Set(invoiceDuplicateGroups.flatMap(group => group.items.map(item => item.id)))];
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      invoicesScanned: activeInvoices.length,
      entriesScanned: activeEntries.length,
      accountsScanned: (accounts || []).length,
      invoiceGroups: invoiceDuplicateGroups.length,
      journalGroups: journalDuplicateGroups.length,
      accountGroups: accountDuplicateGroups.length,
      invoiceEntryConflicts: invoiceEntryConflicts.length,
      highConfidenceInvoiceGroups: invoiceDuplicateGroups.filter(group => group.confidence === 'alta').length,
      highConfidenceJournalGroups: journalDuplicateGroups.filter(group => group.confidence === 'alta').length,
    },
    duplicateInvoiceIds,
    invoiceDuplicateGroups,
    journalDuplicateGroups,
    accountDuplicateGroups,
    invoiceEntryConflicts,
  };
}

async function postPendingBankBatch(svc, companyId, transactions, bankById, entries, userEmail) {
  const result = { posted: 0, alreadyPosted: 0, repairedLinks: 0, issues: [] };
  if (!transactions.length) return result;

  const pendingAccount = await ensureAccount(
    svc,
    companyId,
    '55500000',
    'Partidas pendientes de aplicación',
    'pasivo',
  );
  const bankPostingById = new Map();
  for (const bankAccountId of [...new Set(transactions.map(item => item.bank_account_id))]) {
    const physicalBank = bankById.get(bankAccountId);
    try {
      bankPostingById.set(
        bankAccountId,
        await ensureBankPostingAccount(svc, companyId, physicalBank),
      );
    } catch (error) {
      result.issues.push({
        bankAccountId,
        reason: error.message || 'cuenta_bancaria_contable_no_disponible',
      });
    }
  }

  const candidates = transactions
    .filter(item => bankPostingById.has(item.bank_account_id))
    .sort((a, b) => String(a.fecha_operacion || '').localeCompare(String(b.fecha_operacion || ''))
      || String(a.id).localeCompare(String(b.id)));
  if (!candidates.length) return result;

  const duplicateChecks = await Promise.all(candidates.map(transaction =>
    svc.entities.JournalEntry.filter(
      { companyId, postingKey: 'bank:' + transaction.id + ':' + SCHEMA_VERSION },
      '-created_date',
      1,
    )
  ));
  const postable = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const transaction = candidates[index];
    const existing = duplicateChecks[index]?.find(entry => entry.status !== 'anulado') || null;
    if (!existing) {
      postable.push(transaction);
      continue;
    }
    const existingLines = await resolveEntryLines(svc, companyId, existing);
    if (!(existingLines || []).some(line => line.accountId === pendingAccount.id || line.accountCode === '55500000')) {
      result.issues.push({
        transactionId: transaction.id,
        reason: 'El movimiento ya tiene un asiento bancario con otra contrapartida.',
      });
      continue;
    }
    const bankAccount = bankPostingById.get(transaction.bank_account_id);
    await svc.entities.BankTransaction.update(transaction.id, {
      journal_entry_id: existing.id,
      accounting_account_id: bankAccount.id,
      accounting_account_code: bankAccount.code,
      entidad_tipo: 'accounting_account',
      entidad_id: pendingAccount.id,
      estado_conciliacion: 'revisar',
      confianza_conciliacion: 'baja',
    });
    result.alreadyPosted += 1;
    result.repairedLinks += 1;
  }
  if (!postable.length) return result;

  // Use the same reservation, period-lock and rollback engine as every other posting.
  // Small concurrent waves keep the operation responsive without inventing numbers client-side.
  const note = 'Clasificación contable provisional automática en 55500000. Pendiente de aplicar a factura o cuenta definitiva.';
  const waveSize = 4;
  for (let start = 0; start < postable.length; start += waveSize) {
    const wave = postable.slice(start, start + waveSize);
    const outcomes = await Promise.all(wave.map(async (transaction) => {
      const bankAccount = bankPostingById.get(transaction.bank_account_id);
      const amount = money(Math.abs(transaction.importe));
      const concept = transaction.concepto || transaction.referencia || transaction.id;
      const posting = await createJournalEntry(svc, companyId, {
        date: transaction.fecha_operacion,
        description: 'Movimiento bancario pendiente de aplicar · ' + concept,
        type: 'cobro',
        source: 'conciliacion',
        sourceEvent: 'bank_unmatched_incoming',
        documentId: transaction.id,
        postingKey: 'bank:' + transaction.id + ':' + SCHEMA_VERSION,
        status: 'confirmado',
        lines: [
          {
            accountId: bankAccount.id,
            accountCode: bankAccount.code,
            accountName: bankAccount.name,
            description: concept,
            debit: amount,
            credit: 0,
            sourceLineType: 'banco',
          },
          {
            accountId: pendingAccount.id,
            accountCode: pendingAccount.code,
            accountName: pendingAccount.name,
            description: concept,
            debit: 0,
            credit: amount,
            sourceLineType: 'ajuste',
          },
        ],
      }, userEmail);
      await svc.entities.BankTransaction.update(transaction.id, {
        journal_entry_id: posting.entry.id,
        accounting_account_id: bankAccount.id,
        accounting_account_code: bankAccount.code,
        entidad_tipo: 'accounting_account',
        entidad_id: pendingAccount.id,
        estado_conciliacion: 'revisar',
        confianza_conciliacion: 'baja',
        notas: ((transaction.notas ? transaction.notas + '\n' : '') + note).slice(0, 2000),
      });
      return posting;
    }).map(promise => promise.then(
      posting => ({ ok: true, posting }),
      error => ({ ok: false, error }),
    )));
    for (let index = 0; index < outcomes.length; index += 1) {
      const outcome = outcomes[index];
      if (outcome.ok) {
        if (outcome.posting.alreadyPosted) result.alreadyPosted += 1;
        else result.posted += 1;
      } else {
        result.issues.push({
          transactionId: wave[index].id,
          reason: outcome.error?.message || 'error_contabilizacion_555',
        });
      }
    }
  }
  return result;

  const nextSequenceByYear = new Map();
  for (const transaction of postable) {
    const year = new Date(transaction.fecha_operacion).getFullYear();
    if (nextSequenceByYear.has(year)) continue;
    const maximum = (entries || [])
      .filter(entry => entry.ejercicio === year && entry.status !== 'anulado')
      .reduce((current, entry) => {
        const match = String(entry.entryNumber || '').match(/(\d+)$/);
        return Math.max(current, match ? Number(match[1]) : 0);
      }, 0);
    nextSequenceByYear.set(year, maximum + 1);
  }

  const now = new Date().toISOString();
  const entryPayloads = postable.map((transaction) => {
    const year = new Date(transaction.fecha_operacion).getFullYear();
    const sequence = nextSequenceByYear.get(year);
    nextSequenceByYear.set(year, sequence + 1);
    const amount = money(Math.abs(transaction.importe));
    const concept = transaction.concepto || transaction.referencia || transaction.id;
    return {
      companyId,
      entryNumber: String(year) + '-' + String(sequence).padStart(6, '0'),
      date: transaction.fecha_operacion,
      ejercicio: year,
      type: transaction.tipo === 'entrada' ? 'cobro' : 'pago',
      description: 'Movimiento bancario pendiente de aplicar · ' + concept,
      documentId: transaction.id,
      ocrDocumentId: '',
      source: 'conciliacion',
      status: 'confirmado',
      totalDebit: amount,
      totalCredit: amount,
      isBalanced: true,
      confirmedAt: now,
      confirmedBy: userEmail || '',
      validationStatus: 'CONFIRMADO',
      postingKey: 'bank:' + transaction.id + ':' + SCHEMA_VERSION,
      accountingSchemaVersion: SCHEMA_VERSION,
    };
  });

  const createdEntries = await svc.entities.JournalEntry.bulkCreate(entryPayloads);
  try {
    const createdByKey = new Map((createdEntries || []).map(entry => [entry.postingKey, entry]));
    const linePayloads = [];
    const transactionUpdates = [];
    const note = 'Clasificación contable provisional automática en 55500000. Pendiente de aplicar a factura o cuenta definitiva.';

    for (const transaction of postable) {
      const postingKey = 'bank:' + transaction.id + ':' + SCHEMA_VERSION;
      const entry = createdByKey.get(postingKey);
      if (!entry) throw new Error('No se pudo recuperar el asiento bancario recién creado.');
      const bankAccount = bankPostingById.get(transaction.bank_account_id);
      const amount = money(Math.abs(transaction.importe));
      const description = entry.description;
      const year = entry.ejercicio;
      const line = (account, debit, credit, sourceLineType, lineNumber) => ({
        journalEntryId: entry.id,
        companyId,
        lineNumber,
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        description,
        debit: money(debit),
        credit: money(credit),
        taxCode: '',
        counterpartyAccountId: '',
        counterpartyAccountCode: '',
        documentId: transaction.id,
        bankTransactionId: transaction.id,
        isReconciled: false,
        reconciledAt: null,
        entryStatus: 'confirmado',
        entryDate: transaction.fecha_operacion,
        ejercicio: year,
        subcuenta: account.code,
        cuenta4: account.code.slice(0, 4),
        cuenta3: account.code.slice(0, 3),
        grupo: account.code.slice(0, 1),
        sourceLineType,
        validationStatus: 'CONFIRMADO',
        accountingSchemaVersion: SCHEMA_VERSION,
      });
      if (transaction.tipo === 'entrada') {
        linePayloads.push(line(bankAccount, amount, 0, 'banco', 1));
        linePayloads.push(line(pendingAccount, 0, amount, 'ajuste', 2));
      } else {
        linePayloads.push(line(pendingAccount, amount, 0, 'ajuste', 1));
        linePayloads.push(line(bankAccount, 0, amount, 'banco', 2));
      }
      transactionUpdates.push({
        id: transaction.id,
        journal_entry_id: entry.id,
        accounting_account_id: bankAccount.id,
        accounting_account_code: bankAccount.code,
        entidad_tipo: 'accounting_account',
        entidad_id: pendingAccount.id,
        estado_conciliacion: 'revisar',
        confianza_conciliacion: 'baja',
        notas: ((transaction.notas ? transaction.notas + '\n' : '') + note).slice(0, 2000),
      });
    }

    await svc.entities.JournalEntryLine.bulkCreate(linePayloads);
    await svc.entities.BankTransaction.bulkUpdate(transactionUpdates);
    result.posted = transactionUpdates.length;
    return result;
  } catch (error) {
    await svc.entities.JournalEntry.bulkUpdate((createdEntries || []).map(entry => ({
      id: entry.id,
      status: 'anulado',
      validationStatus: 'ERROR_CREACION_LINEAS',
      notes: 'Error creando lote bancario: ' + (error.message || 'error desconocido'),
    }))).catch(() => null);
    throw error;
  }
}

const excludedBankStates = new Set(['duplicada', 'descartada', 'movimiento_interno']);

const usableBankTransaction = (transaction) =>
  transaction.estado_proveedor !== 'pending'
  && !transaction.es_demo
  && Number.isFinite(Number(transaction.importe))
  && money(Math.abs(transaction.importe)) > 0
  && !excludedBankStates.has(transaction.estado_conciliacion);

const validBankTransaction = (transaction) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(transaction.fecha_operacion || ''))
  && ['entrada', 'salida'].includes(transaction.tipo)
  && Number.isFinite(Number(transaction.importe))
  && money(Math.abs(transaction.importe)) > 0;

async function loadBankReconciliationOverview(svc, companyId) {
  const [bankAccounts, transactions, accounts, entries, lines] = await Promise.all([
    fetchAll(svc.entities.BankAccount, { company_id: companyId }, 'created_date', 10000),
    fetchAll(svc.entities.BankTransaction, { company_id: companyId }, '-fecha_operacion', 100000),
    fetchAll(svc.entities.AccountingAccount, { companyId }, 'code', 10000),
    fetchAll(svc.entities.JournalEntry, { companyId }, '-date', 100000),
    fetchAll(svc.entities.JournalEntryLine, { companyId }, 'journalEntryId', 100000),
  ]);
  const activeBanks = (bankAccounts || []).filter(account =>
    account.activa !== false
    && account.estado_conexion === 'conectado'
    && account.origen_datos === 'open_banking'
    && account.provider_account_id
  );
  const activeEntries = (entries || []).filter(entry => entry.status !== 'anulado');
  const entryById = new Map();
  for (const entry of entries || []) {
    entryById.set(entry.id, entry);
    if (entry.importKey) entryById.set(entry.importKey, entry);
  }
  const linesByEntry = new Map();
  for (const line of lines || []) {
    linesByEntry.set(line.journalEntryId, [...(linesByEntry.get(line.journalEntryId) || []), line]);
  }
  const confirmedLines = (lines || []).filter(line => {
    const header = entryById.get(line.journalEntryId);
    return header && header.status === 'confirmado';
  });
  const accountById = new Map((accounts || []).map(account => [account.id, account]));
  const accountByCode = new Map((accounts || []).map(account => [account.code, account]));
  const bankById = new Map(activeBanks.map(account => [account.id, account]));
  const transactionById = new Map((transactions || []).map(transaction => [transaction.id, transaction]));
  const pendingAccount = accountByCode.get('55500000') || null;
  const activeEntryIds = new Set(activeEntries.flatMap(entry => [entry.id, entry.importKey].filter(Boolean)));
  const incidents = [];

  const entryPostingGroups = new Map();
  for (const entry of activeEntries) {
    if (!entry.postingKey) continue;
    entryPostingGroups.set(entry.postingKey, [...(entryPostingGroups.get(entry.postingKey) || []), entry]);
  }
  for (const [postingKey, group] of entryPostingGroups.entries()) {
    if (group.length > 1) {
      incidents.push({
        type: 'duplicate_journal_posting',
        severity: 'alta',
        title: 'Clave contable bancaria duplicada',
        detail: postingKey,
        count: group.length,
      });
    }
  }

  const transactionIdentityGroups = new Map();
  for (const transaction of transactions || []) {
    const identity = transaction.clave_transaccion
      || (transaction.proveedor_transaccion_id
        ? transaction.bank_account_id + '|' + transaction.proveedor_transaccion_id
        : '');
    if (!identity) continue;
    transactionIdentityGroups.set(identity, [...(transactionIdentityGroups.get(identity) || []), transaction]);
  }
  for (const [identity, group] of transactionIdentityGroups.entries()) {
    if (group.length > 1 && group.some(item => item.estado_conciliacion !== 'duplicada')) {
      incidents.push({
        type: 'duplicate_bank_transaction',
        severity: 'alta',
        title: 'Movimiento bancario potencialmente duplicado',
        detail: identity,
        count: group.length,
      });
    }
  }

  const usableTransactions = (transactions || []).filter(usableBankTransaction);
  for (const transaction of usableTransactions) {
    const physicalBank = bankById.get(transaction.bank_account_id);
    const transactionCurrency = String(transaction.moneda || physicalBank?.moneda || 'EUR').trim().toUpperCase();
    const transactionFxRate = Number(transaction.exchange_rate || transaction.tipo_cambio || 1);
    if (transactionCurrency !== 'EUR' && (!Number.isFinite(transactionFxRate) || transactionFxRate <= 0 || transactionFxRate === 1)) {
      incidents.push({
        type: 'missing_exchange_rate',
        severity: 'alta',
        title: 'Movimiento en divisa sin contravalor EUR validado',
        detail: `${transaction.concepto || transaction.referencia || transaction.id} · ${money(transaction.importe).toFixed(2)} ${transactionCurrency}`,
        transactionId: transaction.id,
        bankAccountId: transaction.bank_account_id,
        currency: transactionCurrency,
        amount: money(transaction.importe),
        date: transaction.fecha_operacion || '',
        currentRate: Number.isFinite(transactionFxRate) ? transactionFxRate : 0,
      });
    } else if (!validBankTransaction(transaction)) {
      const problems = [
        !/^\d{4}-\d{2}-\d{2}$/.test(String(transaction.fecha_operacion || '')) ? 'fecha no válida' : '',
        !['entrada', 'salida'].includes(transaction.tipo) ? 'sentido no válido' : '',
        !Number.isFinite(Number(transaction.importe)) ? 'importe no numérico' : '',
        money(Math.abs(transaction.importe)) <= 0 ? 'importe cero' : '',
      ].filter(Boolean);
      incidents.push({
        type: 'incomplete_bank_transaction',
        severity: 'media',
        title: 'Movimiento no contabilizable',
        detail: (transaction.concepto || transaction.referencia || transaction.id)
          + ' · revisar: ' + problems.join(', '),
        transactionId: transaction.id,
        bankAccountId: transaction.bank_account_id,
      });
    } else if (
      ['conciliada_auto', 'conciliada_manual'].includes(transaction.estado_conciliacion)
      && (!transaction.journal_entry_id || !activeEntryIds.has(transaction.journal_entry_id))
    ) {
      incidents.push({
        type: 'reconciled_without_entry',
        severity: 'alta',
        title: 'Movimiento conciliado sin asiento activo',
        detail: transaction.concepto || transaction.referencia || transaction.id,
        transactionId: transaction.id,
        bankAccountId: transaction.bank_account_id,
      });
    }
  }

  const banks = activeBanks.map((bankAccount) => {
    const postingAccount = (bankAccount.accounting_account_id && accountById.get(bankAccount.accounting_account_id))
      || (bankAccount.accounting_account_code && accountByCode.get(bankAccount.accounting_account_code))
      || null;
    const ledgerBalance = postingAccount
      ? money(confirmedLines
        .filter(line => line.accountId === postingAccount.id || line.accountCode === postingAccount.code)
        .reduce((sum, line) => sum + money(line.debit) - money(line.credit), 0))
      : 0;
    const bankBalance = Number.isFinite(Number(bankAccount.saldo_contable))
      ? money(bankAccount.saldo_contable)
      : money(bankAccount.saldo_disponible);
    const difference = money(bankBalance - ledgerBalance);
    const accountTransactions = usableTransactions.filter(item => item.bank_account_id === bankAccount.id);
    const pendingTransactions = accountTransactions.filter(item =>
      validBankTransaction(item)
      && (!item.journal_entry_id || !activeEntryIds.has(item.journal_entry_id))
    );
    const historyStart = accountTransactions
      .map(item => item.fecha_operacion)
      .filter(Boolean)
      .sort()[0] || bankAccount.sync_desde || '';
    const openingPostingKey = 'bank-opening:' + bankAccount.id + ':' + SCHEMA_VERSION;
    const openingEntry = activeEntries.find(entry => entry.postingKey === openingPostingKey) || null;
    const balanced = Boolean(postingAccount) && Math.abs(difference) <= 0.01 && pendingTransactions.length === 0;
    if (!postingAccount) {
      incidents.push({
        type: 'bank_account_not_mapped',
        severity: 'alta',
        title: 'Cuenta bancaria sin subcuenta 572',
        detail: bankAccount.nombre_banco || 'Banco',
        bankAccountId: bankAccount.id,
      });
    }
    if (!balanced) {
      incidents.push({
        type: 'bank_ledger_difference',
        severity: Math.abs(difference) > 0.01 ? 'alta' : 'media',
        title: 'Saldo bancario y cuenta 572 no coinciden',
        detail: (bankAccount.nombre_banco || 'Banco') + ' · diferencia ' + difference.toFixed(2) + ' EUR',
        bankAccountId: bankAccount.id,
        difference,
      });
    }
    return {
      id: bankAccount.id,
      name: bankAccount.nombre_banco || 'Banco',
      last4: bankAccount.ultimos_4 || '',
      currency: bankAccount.moneda || 'EUR',
      connectionStatus: bankAccount.estado_conexion || '',
      lastSyncAt: bankAccount.fecha_ultima_sync || '',
      historyStart,
      accountingAccountId: postingAccount?.id || '',
      accountingAccountCode: postingAccount?.code || bankAccount.accounting_account_code || '',
      bankBalance,
      ledgerBalance,
      difference,
      pendingTransactions: pendingTransactions.length,
      balanced,
      openingEntryId: openingEntry?.id || '',
      canRegularizeOpening: Boolean(
        postingAccount
        && (bankAccount.moneda || 'EUR') === 'EUR'
        && pendingTransactions.length === 0
        && Math.abs(difference) > 0.01
        && !openingEntry
      ),
    };
  });

  const pending555 = pendingAccount
    ? usableTransactions
      .filter(transaction =>
        transaction.company_id === companyId
        && transaction.entidad_tipo === 'accounting_account'
        && transaction.entidad_id === pendingAccount.id
        && transaction.estado_conciliacion === 'revisar'
      )
      .map((transaction) => {
        const entry = entryById.get(transaction.journal_entry_id) || null;
        const entryLines = entry
          ? (linesByEntry.get(entry.id) || linesByEntry.get(entry.importKey) || [])
          : [];
        const bank = bankById.get(transaction.bank_account_id);
        return {
          id: transaction.id,
          date: transaction.fecha_operacion || '',
          concept: transaction.concepto || transaction.referencia || 'Movimiento bancario',
          counterparty: transaction.nombre_contraparte || '',
          amount: money(transaction.importe),
          direction: transaction.tipo,
          currency: transaction.moneda || 'EUR',
          bankName: bank?.nombre_banco || 'Banco',
          bankLast4: bank?.ultimos_4 || '',
          journalEntryId: entry?.id || '',
          entryNumber: entry?.entryNumber || '',
          entryStatus: entry?.status || '',
          lines: entryLines.map(line => ({
            accountCode: line.accountCode || '',
            accountName: line.accountName || '',
            debit: money(line.debit),
            credit: money(line.credit),
          })),
        };
      })
      .filter(item => item.journalEntryId && item.entryStatus !== 'anulado')
    : [];

  const bank555Entries = pendingAccount
    ? activeEntries
      .filter(entry => String(entry.postingKey || '').startsWith('bank:'))
      .map((entry) => {
        const entryLines = linesByEntry.get(entry.id) || linesByEntry.get(entry.importKey) || [];
        if (!entryLines.some(line =>
          line.accountId === pendingAccount.id || line.accountCode === '55500000'
        )) return null;
        const transaction = transactionById.get(entry.documentId) || null;
        const bank = transaction ? bankById.get(transaction.bank_account_id) : null;
        const isPending = Boolean(
          transaction
          && transaction.entidad_tipo === 'accounting_account'
          && transaction.entidad_id === pendingAccount.id
          && transaction.estado_conciliacion === 'revisar'
        );
        return {
          id: transaction?.id || entry.id,
          date: transaction?.fecha_operacion || entry.date || '',
          concept: transaction?.concepto || transaction?.referencia || entry.description || 'Movimiento bancario',
          counterparty: transaction?.nombre_contraparte || '',
          amount: money(transaction?.importe ?? entry.totalDebit ?? 0),
          direction: transaction?.tipo || '',
          currency: transaction?.moneda || 'EUR',
          bankName: bank?.nombre_banco || 'Banco',
          bankLast4: bank?.ultimos_4 || '',
          journalEntryId: entry.id,
          entryNumber: entry.entryNumber || '',
          entryStatus: entry.status || '',
          isPending,
          reconciliationStatus: transaction?.estado_conciliacion || '',
          targetAccountId: transaction?.entidad_id || '',
          lines: entryLines.map(line => ({
            accountCode: line.accountCode || '',
            accountName: line.accountName || '',
            debit: money(line.debit),
            credit: money(line.credit),
          })),
        };
      })
      .filter(Boolean)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))
        || String(b.entryNumber).localeCompare(String(a.entryNumber)))
    : [];

  const selectableAccounts = (accounts || [])
    .filter(account =>
      account.status !== 'inactiva'
      && account.code !== '55500000'
      && account.type !== 'banco'
      && isCanonical8(account.code)
    )
    .map(account => ({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type || 'otro',
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      banks: banks.length,
      balancedBanks: banks.filter(item => item.balanced).length,
      pending555: pending555.length,
      bank555Entries: bank555Entries.length,
      incidents: incidents.length,
    },
    banks,
    pending555,
    bank555Entries,
    incidents,
    selectableAccounts,
  };
}

async function saveBankExchangeRate(svc, companyId, body, userEmail) {
  const transaction = await svc.entities.BankTransaction.get(String(body.transactionId || '')).catch(() => null);
  if (!transaction || transaction.company_id !== companyId) throw new Error('El movimiento no pertenece a la empresa activa.');
  const bankAccount = await svc.entities.BankAccount.get(transaction.bank_account_id).catch(() => null);
  const currency = String(transaction.moneda || bankAccount?.moneda || 'EUR').trim().toUpperCase();
  const rate = Number(body.exchangeRate);
  const rateDate = String(body.exchangeRateDate || transaction.fecha_operacion || '').trim();
  const source = String(body.exchangeRateSource || '').trim();
  if (currency === 'EUR') throw new Error('El movimiento ya está denominado en EUR.');
  if (!Number.isFinite(rate) || rate <= 0 || rate === 1) throw new Error('Indica un tipo de cambio válido a EUR, distinto de 1.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rateDate)) throw new Error('Indica la fecha del tipo de cambio.');
  if (source.length < 3) throw new Error('Indica la fuente del tipo de cambio (BCE, extracto bancario u otra fuente verificable).');

  const currentEntry = transaction.journal_entry_id
    ? await svc.entities.JournalEntry.get(transaction.journal_entry_id).catch(() => null)
    : null;
  let correction = null;
  let delta = 0;
  if (currentEntry && currentEntry.companyId === companyId && currentEntry.status === 'confirmado') {
    const prior = await svc.entities.JournalEntry.filter({ companyId }, '-created_date', 100000);
    const existingCorrection = (prior || []).find(entry => entry.status !== 'anulado' && String(entry.postingKey || '').startsWith(`bank-fx-correction:${transaction.id}:`));
    if (existingCorrection) throw new Error('Este movimiento ya tiene una corrección de cambio activa. Para cambiarla, usa contraasiento y revisión contable.');
    const currentLines = await resolveEntryLines(svc, companyId, currentEntry);
    const bankPostingAccount = await ensureBankPostingAccount(svc, companyId, bankAccount);
    const bankLine = (currentLines || []).find(line => line.accountId === bankPostingAccount.id || line.accountCode === bankPostingAccount.code);
    if (!bankLine) throw new Error('El asiento existente no contiene la subcuenta bancaria esperada.');
    const currentSigned = money(Number(bankLine.debit || 0) - Number(bankLine.credit || 0));
    const targetSigned = money((transaction.tipo === 'entrada' ? 1 : -1) * Math.abs(Number(transaction.importe || 0)) * rate);
    delta = money(targetSigned - currentSigned);
    if (Math.abs(delta) > 0.01) {
      const pendingRows = await svc.entities.AccountingAccount.filter({ companyId, code: '55500000' }, '-created_date', 1);
      const isPending = transaction.estado_conciliacion === 'revisar' && transaction.entidad_id === pendingRows?.[0]?.id;
      const counterpart = isPending
        ? pendingRows[0]
        : delta > 0
          ? await ensureAccount(svc, companyId, '76800000', 'Diferencias positivas de cambio', 'ingreso')
          : await ensureAccount(svc, companyId, '66800000', 'Diferencias negativas de cambio', 'gasto');
      if (!counterpart) throw new Error('No se pudo resolver la contrapartida del ajuste de cambio.');
      const amount = money(Math.abs(delta));
      const description = `Corrección de cambio ${currency}/EUR · ${transaction.concepto || transaction.referencia || transaction.id}`;
      const now = new Date().toISOString();
      const line = (account, debit, credit) => ({ accountId: account.id, accountCode: account.code, accountName: account.name, description, debit: money(debit), credit: money(credit), bankTransactionId: transaction.id, isReconciled: true, reconciledAt: now, sourceLineType: 'ajuste' });
      const created = await createJournalEntry(svc, companyId, {
        date: rateDate, description, type: 'ajuste', source: 'banco', documentId: transaction.id,
        postingKey: `bank-fx-correction:${transaction.id}:${rate.toFixed(8)}:${SCHEMA_VERSION}`, status: 'confirmado',
        currency, fxRate: rate, originalAmount: Math.abs(Number(transaction.importe || 0)),
        lines: delta > 0 ? [line(bankPostingAccount, amount, 0), line(counterpart, 0, amount)] : [line(counterpart, amount, 0), line(bankPostingAccount, 0, amount)],
      }, userEmail);
      correction = created.entry;
    }
  }
  const updated = await svc.entities.BankTransaction.update(transaction.id, {
    exchange_rate: rate, exchange_rate_date: rateDate, exchange_rate_source: source,
    exchange_rate_reviewed_by: userEmail || '',
    notas: `${transaction.notas ? `${transaction.notas}\n` : ''}Tipo de cambio ${currency}/EUR ${rate} validado el ${rateDate}; fuente: ${source}.${correction ? ` Corrección: ${correction.entryNumber}.` : ''}`.slice(0, 2000),
  });
  return { transaction: updated, correction, delta, currency, exchangeRate: rate };
}

async function reclassifyPendingBankTransaction(svc, companyId, transactionId, targetAccountId, userEmail) {
  const transaction = await svc.entities.BankTransaction.get(transactionId).catch(() => null);
  if (!transaction || transaction.company_id !== companyId) {
    throw new Error('El movimiento no pertenece a la empresa activa.');
  }
  const targetAccount = await svc.entities.AccountingAccount.get(targetAccountId).catch(() => null);
  if (!targetAccount || targetAccount.companyId !== companyId || targetAccount.status === 'inactiva') {
    throw new Error('La cuenta de contrapartida no pertenece a la empresa o está inactiva.');
  }
  if (targetAccount.code === '55500000' || targetAccount.type === 'banco') {
    throw new Error('Selecciona una cuenta de contrapartida distinta de 555 y de la cuenta bancaria.');
  }
  const pendingRows = await svc.entities.AccountingAccount.filter({ companyId, code: '55500000' }, '-created_date', 1);
  const pendingAccount = pendingRows?.[0];
  if (!pendingAccount || transaction.entidad_id !== pendingAccount.id || transaction.estado_conciliacion !== 'revisar') {
    throw new Error('El movimiento ya no está pendiente en la cuenta 555.');
  }
  const bankEntry = transaction.journal_entry_id
    ? await svc.entities.JournalEntry.get(transaction.journal_entry_id).catch(() => null)
    : null;
  if (!bankEntry || bankEntry.companyId !== companyId || bankEntry.status !== 'confirmado') {
    throw new Error('El asiento bancario original no existe o no está confirmado.');
  }
  const bankLines = await resolveEntryLines(svc, companyId, bankEntry);
  if (!(bankLines || []).some(line => line.accountId === pendingAccount.id || line.accountCode === '55500000')) {
    throw new Error('El asiento bancario original no contiene la cuenta 555.');
  }

  const postingKey = 'bank-reclass:' + transaction.id + ':' + SCHEMA_VERSION;
  const duplicate = await svc.entities.JournalEntry.filter({ companyId, postingKey }, '-created_date', 1);
  let reclassification = duplicate?.find(entry => entry.status !== 'anulado') || null;
  if (reclassification) {
    const duplicateLines = await resolveEntryLines(svc, companyId, reclassification);
    if (!(duplicateLines || []).some(line => line.accountId === targetAccount.id)) {
      throw new Error('El movimiento ya fue reclasificado a otra cuenta. Debe corregirse mediante contraasiento.');
    }
  } else {
    const transactionCurrency = String(transaction.moneda || 'EUR').trim().toUpperCase();
    const transactionFxRate = transactionCurrency === 'EUR' ? 1 : Number(transaction.exchange_rate || transaction.tipo_cambio);
    if (!Number.isFinite(transactionFxRate) || transactionFxRate <= 0 || (transactionCurrency !== 'EUR' && transactionFxRate === 1)) {
      throw new Error('El movimiento en divisa necesita un tipo de cambio a EUR validado antes de reclasificar la 555.');
    }
    const amount = money(Math.abs(transaction.importe) * transactionFxRate);
    const description = 'Reclasificación de 555 · ' + (transaction.concepto || transaction.referencia || transaction.id);
    const now = new Date().toISOString();
    const line = (account, debit, credit, sourceLineType) => ({
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      description,
      debit: money(debit),
      credit: money(credit),
      bankTransactionId: transaction.id,
      isReconciled: true,
      reconciledAt: now,
      sourceLineType,
    });
    const created = await createJournalEntry(svc, companyId, {
      date: transaction.fecha_operacion,
      description,
      type: 'ajuste',
      source: 'conciliacion',
      documentId: transaction.id,
      postingKey,
      status: 'confirmado',
      lines: transaction.tipo === 'entrada'
        ? [line(pendingAccount, amount, 0, 'ajuste'), line(targetAccount, 0, amount, 'ajuste')]
        : [line(targetAccount, amount, 0, 'ajuste'), line(pendingAccount, 0, amount, 'ajuste')],
    }, userEmail);
    reclassification = created.entry;
  }

  const note = 'Reclasificación manual de 555 a ' + targetAccount.code + ' mediante asiento ' + reclassification.entryNumber + '.';
  await svc.entities.BankTransaction.update(transaction.id, {
    entidad_tipo: 'accounting_account',
    entidad_id: targetAccount.id,
    estado_conciliacion: 'conciliada_manual',
    confianza_conciliacion: 'alta',
    reconciled_at: new Date().toISOString(),
    reconciled_by: userEmail || '',
    notas: ((transaction.notas ? transaction.notas + '\n' : '') + note).slice(0, 2000),
  });
  return { alreadyPosted: Boolean(duplicate?.length), entry: reclassification, targetAccount };
}

async function createBankOpeningAdjustment(svc, companyId, bankAccountId, userEmail) {
  const bankAccount = await svc.entities.BankAccount.get(bankAccountId).catch(() => null);
  if (!bankAccount || bankAccount.company_id !== companyId || bankAccount.activa === false) {
    throw new Error('La cuenta bancaria no pertenece a la empresa activa.');
  }
  const [transactions, entries, lines] = await Promise.all([
    fetchAll(svc.entities.BankTransaction, { company_id: companyId, bank_account_id: bankAccount.id }, 'fecha_operacion', 100000),
    fetchAll(svc.entities.JournalEntry, { companyId }, '-date', 100000),
    fetchAll(svc.entities.JournalEntryLine, { companyId }, 'journalEntryId', 100000),
  ]);
  const bankPostingAccount = await ensureBankPostingAccount(svc, companyId, bankAccount);
  const pendingAccount = await ensureAccount(svc, companyId, '55500000', 'Partidas pendientes de aplicación', 'pasivo');
  const activeEntries = (entries || []).filter(entry => entry.status !== 'anulado');
  const activeEntryIds = new Set(activeEntries.flatMap(entry => [entry.id, entry.importKey].filter(Boolean)));
  const pendingTransactions = (transactions || []).filter(transaction =>
    usableBankTransaction(transaction)
    && validBankTransaction(transaction)
    && (!transaction.journal_entry_id || !activeEntryIds.has(transaction.journal_entry_id))
  );
  if (pendingTransactions.length) {
    throw new Error('Hay movimientos bancarios sin asiento. Contabilízalos o corrige sus incidencias antes de regularizar la apertura.');
  }
  const confirmedEntryIds = new Set(
    activeEntries
      .filter(entry => entry.status === 'confirmado')
      .flatMap(entry => [entry.id, entry.importKey].filter(Boolean))
  );
  const ledgerBalance = money((lines || [])
    .filter(line =>
      confirmedEntryIds.has(line.journalEntryId)
      && (line.accountId === bankPostingAccount.id || line.accountCode === bankPostingAccount.code)
    )
    .reduce((sum, line) => sum + money(line.debit) - money(line.credit), 0));
  const bankBalance = Number.isFinite(Number(bankAccount.saldo_contable))
    ? money(bankAccount.saldo_contable)
    : money(bankAccount.saldo_disponible);
  if ((bankAccount.moneda || 'EUR') !== 'EUR' && Math.abs(bankBalance) > 0.01) {
    throw new Error('La cuenta en divisa tiene saldo distinto de cero. Indica el contravalor EUR y el tipo de cambio antes de regularizarla.');
  }
  const difference = money(bankBalance - ledgerBalance);
  if (Math.abs(difference) <= 0.01) {
    return { alreadyBalanced: true, bankBalance, ledgerBalance, difference: 0 };
  }
  const postingKey = 'bank-opening:' + bankAccount.id + ':' + SCHEMA_VERSION;
  const duplicate = activeEntries.find(entry => entry.postingKey === postingKey);
  if (duplicate) {
    throw new Error('Ya existe una regularización de apertura para esta cuenta. La diferencia actual requiere revisión contable.');
  }
  const firstDate = (transactions || [])
    .map(item => item.fecha_operacion)
    .filter(Boolean)
    .sort()[0] || bankAccount.sync_desde || new Date().toISOString().slice(0, 10);
  const date = firstDate;
  const amount = money(Math.abs(difference));
  const description = 'Saldo inicial inferido de ' + (bankAccount.nombre_banco || 'cuenta bancaria') + ' a ' + firstDate;
  const line = (account, debit, credit) => ({
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    description,
    debit: money(debit),
    credit: money(credit),
    sourceLineType: 'ajuste',
  });
  const created = await createJournalEntry(svc, companyId, {
    date,
    description,
    type: 'apertura',
    source: 'banco',
    documentId: bankAccount.id,
    postingKey,
    status: 'confirmado',
    lines: difference > 0
      ? [line(bankPostingAccount, amount, 0), line(pendingAccount, 0, amount)]
      : [line(pendingAccount, amount, 0), line(bankPostingAccount, 0, amount)],
  }, userEmail);
  return {
    alreadyBalanced: false,
    entry: created.entry,
    bankBalance,
    ledgerBalanceBefore: ledgerBalance,
    ledgerBalanceAfter: bankBalance,
    differenceApplied: difference,
  };
}

async function consolidateDuplicateBankLedgers(svc, companyId, apply, userEmail, postingDate) {
  const [banks, transactions, accounts, entries, lines] = await Promise.all([
    fetchAll(svc.entities.BankAccount, { company_id: companyId }, 'created_date', 10000),
    fetchAll(svc.entities.BankTransaction, { company_id: companyId }, 'fecha_operacion', 100000),
    fetchAll(svc.entities.AccountingAccount, { companyId }, 'code', 10000),
    fetchAll(svc.entities.JournalEntry, { companyId }, 'date', 100000),
    fetchAll(svc.entities.JournalEntryLine, { companyId }, 'journalEntryId', 100000),
  ]);
  const accountById = new Map(accounts.map(item => [item.id, item]));
  const bankById = new Map(banks.map(item => [item.id, item]));
  const transactionById = new Map(transactions.map(item => [item.id, item]));
  const entryById = new Map();
  for (const entry of entries.filter(item => item.status === 'confirmado')) {
    entryById.set(entry.id, entry);
    if (entry.importKey) entryById.set(entry.importKey, entry);
  }
  const canonicalByIdentity = new Map();
  const referencedLedgerIds = new Set();
  for (const bank of banks.filter(item => item.activa !== false)) {
    const identity = stableBankIdentity(bank);
    const linked = accountById.get(bank.accounting_account_id);
    if (!identity || !linked || linked.status === 'inactiva') continue;
    referencedLedgerIds.add(linked.id);
    if (!canonicalByIdentity.has(identity)) canonicalByIdentity.set(identity, linked);
  }
  const plans = [];
  const skipped = [];
  for (const orphan of accounts.filter(item => item.status !== 'inactiva' && item.type === 'banco' && /^5720\d{4}$/.test(String(item.code || '')) && item.code !== '57200000' && !referencedLedgerIds.has(item.id))) {
    const orphanLines = lines.filter(line => line.accountId === orphan.id || line.accountCode === orphan.code);
    const confirmedLines = orphanLines.filter(line => entryById.has(line.journalEntryId));
    const identities = new Set();
    for (const line of confirmedLines) {
      const entry = entryById.get(line.journalEntryId);
      const transaction = entry ? transactionById.get(entry.documentId) : null;
      const bank = transaction ? bankById.get(transaction.bank_account_id) : null;
      const identity = stableBankIdentity(bank);
      if (identity) identities.add(identity);
    }
    if (identities.size !== 1) {
      skipped.push({ fromCode: orphan.code, reason: identities.size ? 'origen_bancario_ambiguo' : 'sin_origen_bancario_verificable', lines: confirmedLines.length });
      continue;
    }
    const identity = [...identities][0];
    const canonical = canonicalByIdentity.get(identity);
    if (!canonical || canonical.id === orphan.id) {
      skipped.push({ fromCode: orphan.code, reason: 'sin_cuenta_572_canonica', lines: confirmedLines.length });
      continue;
    }
    const balance = money(confirmedLines.reduce((sum, line) => sum + Number(line.debit || line.debeE || 0) - Number(line.credit || line.haberE || 0), 0));
    const originBank = banks.find(bank => stableBankIdentity(bank) === identity);
    plans.push({
      orphan,
      canonical,
      balance,
      lines: confirmedLines.length,
      identity,
      identityLabel: `${originBank?.ultimos_4 || '----'} · ${bankCurrency(originBank)}`,
    });
  }
  const applied = [];
  if (apply) {
    await assertAccountingDateOpen(svc, companyId, postingDate);
    for (const plan of plans) {
      const postingKey = `bank-ledger-consolidation:${plan.orphan.id}:${plan.canonical.id}:${SCHEMA_VERSION}`;
      const prior = entries.find(entry => entry.postingKey === postingKey && entry.status !== 'anulado');
      let entry = prior || null;
      if (!entry && Math.abs(plan.balance) > 0.01) {
        const amount = Math.abs(plan.balance);
        const oldLine = { accountId: plan.orphan.id, accountCode: plan.orphan.code, accountName: plan.orphan.name, description: `Consolidación en ${plan.canonical.code}`, debit: plan.balance < 0 ? amount : 0, credit: plan.balance > 0 ? amount : 0, sourceLineType: 'reclasificacion' };
        const newLine = { accountId: plan.canonical.id, accountCode: plan.canonical.code, accountName: plan.canonical.name, description: `Consolidación desde ${plan.orphan.code}`, debit: plan.balance > 0 ? amount : 0, credit: plan.balance < 0 ? amount : 0, sourceLineType: 'reclasificacion' };
        entry = (await createJournalEntry(svc, companyId, { date: postingDate, description: `Consolidación de subcuenta bancaria duplicada ${plan.orphan.code} → ${plan.canonical.code}`, type: 'ajuste', source: 'sistema', sourceEvent: 'bank_ledger_consolidation', postingKey, status: 'confirmado', lines: [oldLine, newLine] }, userEmail)).entry;
      }
      await svc.entities.AccountingAccount.update(plan.orphan.id, {
        status: 'inactiva',
        notes: `Subcuenta consolidada de forma trazable en ${plan.canonical.code} el ${postingDate}. No reutilizar.`,
        accountingSchemaVersion: SCHEMA_VERSION,
      });
      if (plan.identity && plan.canonical.bankIdentityKey !== plan.identity) {
        await svc.entities.AccountingAccount.update(plan.canonical.id, { bankIdentityKey: plan.identity, bankCurrency: bankCurrency(banks.find(bank => stableBankIdentity(bank) === plan.identity)) });
      }
      applied.push({ fromCode: plan.orphan.code, toCode: plan.canonical.code, balance: plan.balance, entryId: entry?.id || '', alreadyApplied: Boolean(prior) });
    }
  }
  return {
    mode: apply ? 'apply' : 'dry_run',
    plans: plans.map(plan => ({ fromCode: plan.orphan.code, toCode: plan.canonical.code, balance: plan.balance, lines: plan.lines, bank: plan.identityLabel })),
    skipped,
    applied,
  };
}

const DEFAULT_CATEGORY_MAPPINGS = {
  ventas_servicios: '70500000',
  compras: '60000000',
  suministros: '62800000',
  alquiler: '62100000',
  publicidad_marketing: '62700000',
  servicios_profesionales: '62300000',
  software: '62910000',
  transporte: '62400000',
  dietas: '62920000',
  gastos_financieros: '66900000',
  seguros: '62500000',
  otros: '62900000',
};

async function ensureAccountingReady(svc, companyId, userEmail) {
  const company = await svc.entities.Company.get(companyId).catch(() => null);
  if (!company || company.activa === false) throw new Error('La empresa no existe o está inactiva.');

  const pgc = await seedOperationalPgc(svc, companyId);
  const year = new Date().getUTCFullYear();
  const periods = await listFiscalYears(svc, companyId);
  let period = periods.find(item => Number(item.year) === year) || null;
  if (!period) period = await saveFiscalYear(svc, companyId, { year }, userEmail);

  const taxKind = String(company.tipo_impuesto || 'iva').trim().toLowerCase();
  const usesIgic = taxKind === 'igic';
  const configurationRows = await svc.entities.AccountingConfiguration.filter({ companyId }, '-created_date', 10);
  let configuration = configurationRows?.[0] || null;
  if (!configuration) {
    configuration = await svc.entities.AccountingConfiguration.create({
      companyId,
      mappingsJson: JSON.stringify(DEFAULT_CATEGORY_MAPPINGS),
      clientAccount: '43000000',
      supplierAccount: '41000000',
      outputTaxAccount: usesIgic ? '47770000' : '47700000',
      inputTaxAccount: usesIgic ? '47270000' : '47200000',
      withholdingReceivableAccount: '47300000',
      withholdingPayableAccount: '47510000',
      unmatchedIncomingAccount: '55500000',
      unmatchedOutgoingMode: 'revision',
      unmatchedOutgoingAccount: '',
      accountDigits: 8,
      accountingModel: 'interno_simplificado',
      baseCurrency: 'EUR',
      autoSeedAccounts: true,
      accountingSchemaVersion: SCHEMA_VERSION,
      updatedBy: userEmail,
      updatedAt: new Date().toISOString(),
    });
  }

  const banks = await fetchAll(svc.entities.BankAccount, { company_id: companyId }, 'created_date', 10000);
  const connectedBanks = banks.filter(bank =>
    bank.activa !== false
    && ['conectado', 'connected', 'active', 'ready'].includes(String(bank.estado_conexion || '').toLowerCase())
  );
  const bankMappings = [];
  for (const bank of connectedBanks) {
    const account = await ensureBankPostingAccount(svc, companyId, bank);
    bankMappings.push({ bankAccountId: bank.id, accountingAccountId: account.id, accountingAccountCode: account.code });
  }

  return {
    companyId,
    year,
    periodId: period.id,
    configurationId: configuration.id,
    pgc,
    connectedBanks: connectedBanks.length,
    bankMappings,
    taxKind,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const companyId = body.companyId || user.data?.company_id;
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (!companyId || (!isAdmin && user.data?.company_id !== companyId)) {
      return Response.json({ error: 'No tienes permiso para operar en la empresa seleccionada.' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    if (action === 'ensure_accounting_ready') {
      const result = await ensureAccountingReady(svc, companyId, user.email);
      return Response.json({ success: true, schemaVersion: SCHEMA_VERSION, result });
    }

    if (action === 'periods_overview') {
      return Response.json({ success: true, periods: await listFiscalYears(svc, companyId), schemaVersion: SCHEMA_VERSION });
    }
    if (action === 'save_fiscal_year') {
      const period = await saveFiscalYear(svc, companyId, body, user.email);
      return Response.json({ success: true, period, periods: await listFiscalYears(svc, companyId) });
    }
    if (action === 'set_period_lock') {
      const period = await setPeriodLock(svc, companyId, body, user.email);
      return Response.json({ success: true, period, periods: await listFiscalYears(svc, companyId) });
    }
    if (action === 'closing_preview') {
      try {
        return Response.json({ success: true, preview: await closingPreview(svc, companyId, body.year) });
      } catch (error) {
        return Response.json({ error: error.message || 'No se pudo analizar el cierre.' }, { status: 409 });
      }
    }
    if (action === 'closing_execute') {
      try {
        if (body.apply !== true) return Response.json({ success: true, mode: 'dry_run', preview: await closingPreview(svc, companyId, body.year) });
        const result = await executeClosing(svc, companyId, body, user.email);
        return Response.json({ success: true, mode: 'apply', result });
      } catch (error) {
        return Response.json({ error: error.message || 'No se pudo cerrar el ejercicio.' }, { status: 409 });
      }
    }

    if (action === 'get_accounting_configuration' || action === 'save_accounting_configuration') {
      const rows = await svc.entities.AccountingConfiguration.filter({ companyId }, '-created_date', 10);
      const existing = rows?.[0] || null;
      if (action === 'get_accounting_configuration') return Response.json({ success: true, configuration: existing, diagnostics: await buildAccountingConfigurationDiagnostics(svc, companyId, existing) });
      const accountFields = ['clientAccount', 'supplierAccount', 'outputTaxAccount', 'inputTaxAccount', 'withholdingReceivableAccount', 'withholdingPayableAccount', 'unmatchedIncomingAccount', 'unmatchedOutgoingAccount'];
      const defaults = { clientAccount: '43000000', supplierAccount: '41000000', outputTaxAccount: '47700000', inputTaxAccount: '47200000', withholdingReceivableAccount: '47300000', withholdingPayableAccount: '47510000', unmatchedIncomingAccount: '55500000', unmatchedOutgoingAccount: '' };
      const payload = {};
      for (const field of accountFields) {
        const value = String(body[field] ?? existing?.[field] ?? defaults[field] ?? '').trim();
        if (!value && field === 'unmatchedOutgoingAccount') { payload[field] = ''; continue; }
        if (!isCanonical8(value)) throw new Error(`La cuenta configurada en ${field} debe tener exactamente 8 dígitos.`);
        const account = await svc.entities.AccountingAccount.filter({ companyId, code: value }, '-created_date', 1);
        if (!account?.[0] || account[0].status === 'inactiva') throw new Error(`La cuenta ${value} no existe o está inactiva.`);
        payload[field] = value;
      }
      const mappingsJson = String(body.mappingsJson ?? existing?.mappingsJson ?? '{}');
      let mappings;
      try { mappings = JSON.parse(mappingsJson); } catch { throw new Error('El mapa de cuentas no contiene JSON válido.'); }
      if (!mappings || typeof mappings !== 'object') throw new Error('El mapa de cuentas debe ser un objeto o lista JSON.');
      const mappedCodes = Array.isArray(mappings)
        ? mappings.map(item => String(item?.cuenta || '').trim()).filter(Boolean)
        : Object.values(mappings).map(value => String(value || '').trim()).filter(value => /^\d{8}$/.test(value));
      for (const code of [...new Set(mappedCodes)]) {
        if (!isCanonical8(code)) throw new Error(`La cuenta ${code} del mapeo debe tener exactamente 8 dígitos.`);
        const account = await svc.entities.AccountingAccount.filter({ companyId, code }, '-created_date', 1);
        if (!account?.[0] || account[0].status === 'inactiva') throw new Error(`La cuenta ${code} del mapeo no existe o está inactiva.`);
      }
      payload.mappingsJson = JSON.stringify(mappings);
      payload.accountDigits = 8;
      payload.accountingModel = body.accountingModel || existing?.accountingModel || 'interno_simplificado';
      payload.baseCurrency = String(body.baseCurrency || existing?.baseCurrency || 'EUR').toUpperCase();
      payload.unmatchedOutgoingMode = body.unmatchedOutgoingMode || existing?.unmatchedOutgoingMode || 'revision';
      payload.autoSeedAccounts = body.autoSeedAccounts === true;
      payload.accountingSchemaVersion = SCHEMA_VERSION;
      payload.updatedBy = user.email;
      payload.updatedAt = new Date().toISOString();
      const configuration = existing
        ? await svc.entities.AccountingConfiguration.update(existing.id, payload)
        : await svc.entities.AccountingConfiguration.create({ companyId, ...payload });
      return Response.json({ success: true, configuration, diagnostics: await buildAccountingConfigurationDiagnostics(svc, companyId, configuration) });
    }

    if (action === 'tax_summary') {
      const [invoices, taxLines, company] = await Promise.all([
        fetchAll(svc.entities.Invoice, { company_id: companyId }, 'fecha_emision', 100000),
        fetchAll(svc.entities.InvoiceTaxLine, { companyId }, 'operationDate', 100000),
        svc.entities.Company.get(companyId).catch(() => null),
      ]);
      const activeInvoices = invoices.filter(invoice => invoice.estado_contable === 'contabilizada' && !invoice.anulada);
      const invoiceById = new Map(activeInvoices.map(invoice => [invoice.id, invoice]));
      const detailedByInvoice = new Map();
      for (const item of taxLines) {
        if (!invoiceById.has(item.invoiceId)) continue;
        detailedByInvoice.set(item.invoiceId, [...(detailedByInvoice.get(item.invoiceId) || []), item]);
      }
      const companyTaxKind = company?.tipo_impuesto === 'igic' ? 'igic' : 'iva';
      const rows = [];
      for (const invoice of activeInvoices) {
        const details = detailedByInvoice.get(invoice.id);
        if (details?.length) {
          for (const detail of details) rows.push({
            invoiceId: invoice.id,
            invoiceType: invoice.tipo,
            operationDate: detail.operationDate || invoice.fecha_emision,
            taxKind: detail.taxKind || companyTaxKind,
            rate: Number(detail.rate || 0),
            base: money(detail.base),
            quota: money(detail.quota),
            deductibleQuota: invoice.tipo === 'recibida'
              ? money(detail.deductibleQuota ?? (detail.deductible === false ? 0 : detail.quota))
              : 0,
            nonDeductibleQuota: invoice.tipo === 'recibida'
              ? money(detail.nonDeductibleQuota ?? (detail.deductible === false ? detail.quota : 0))
              : 0,
            regime: detail.regime || 'general',
            reviewStatus: detail.reviewStatus || 'pendiente_revision',
            source: 'detalle_fiscal',
          });
        } else {
          rows.push({
            invoiceId: invoice.id,
            invoiceType: invoice.tipo,
            operationDate: invoice.fecha_emision,
            taxKind: companyTaxKind,
            rate: Number(invoice.tipo_iva || 0),
            base: money(invoice.base_imponible),
            quota: money(invoice.cuota_iva),
            deductibleQuota: invoice.tipo === 'recibida' ? money(invoice.cuota_iva) : 0,
            nonDeductibleQuota: 0,
            regime: 'general',
            reviewStatus: 'pendiente_revision',
            source: 'factura_agregada_legacy',
          });
        }
      }
      const years = [...new Set(rows.map(row => Number(String(row.operationDate || '').slice(0, 4))).filter(Boolean))].sort((a, b) => b - a);
      const selectedYear = body.year && body.year !== 'todos' ? Number(body.year) : null;
      const selectedQuarter = body.quarter && body.quarter !== 'todos' ? Number(String(body.quarter).replace('T', '')) : null;
      const filtered = rows.filter(row => {
        const date = new Date(String(row.operationDate || '') + 'T12:00:00Z');
        const yearMatches = !selectedYear || date.getUTCFullYear() === selectedYear;
        const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
        return yearMatches && (!selectedQuarter || quarter === selectedQuarter);
      });
      const groups = new Map();
      for (const row of filtered) {
        const key = row.taxKind + ':' + row.rate;
        if (!groups.has(key)) groups.set(key, { taxKind: row.taxKind, rate: row.rate, issuedBase: 0, outputQuota: 0, receivedBase: 0, inputQuota: 0, deductibleQuota: 0, nonDeductibleQuota: 0, invoices: new Set() });
        const group = groups.get(key);
        group.invoices.add(row.invoiceId);
        if (row.invoiceType === 'emitida') {
          group.issuedBase = money(group.issuedBase + row.base);
          group.outputQuota = money(group.outputQuota + row.quota);
        } else {
          group.receivedBase = money(group.receivedBase + row.base);
          group.inputQuota = money(group.inputQuota + row.quota);
          group.deductibleQuota = money(group.deductibleQuota + row.deductibleQuota);
          group.nonDeductibleQuota = money(group.nonDeductibleQuota + row.nonDeductibleQuota);
        }
      }
      const summaryRows = [...groups.values()].map(group => ({ ...group, invoiceCount: group.invoices.size, invoices: undefined }));
      const totals = {
        outputQuota: money(filtered.filter(row => row.invoiceType === 'emitida').reduce((sum, row) => sum + row.quota, 0)),
        inputQuota: money(filtered.filter(row => row.invoiceType === 'recibida').reduce((sum, row) => sum + row.quota, 0)),
        deductibleQuota: money(filtered.filter(row => row.invoiceType === 'recibida').reduce((sum, row) => sum + row.deductibleQuota, 0)),
        nonDeductibleQuota: money(filtered.filter(row => row.invoiceType === 'recibida').reduce((sum, row) => sum + row.nonDeductibleQuota, 0)),
      };
      totals.result = money(totals.outputQuota - totals.deductibleQuota);
      return Response.json({
        success: true,
        taxKind: companyTaxKind,
        years,
        rows: summaryRows,
        totals,
        quality: {
          invoices: new Set(filtered.map(row => row.invoiceId)).size,
          detailedInvoices: new Set(filtered.filter(row => row.source === 'detalle_fiscal').map(row => row.invoiceId)).size,
          legacyAggregateInvoices: new Set(filtered.filter(row => row.source === 'factura_agregada_legacy').map(row => row.invoiceId)).size,
          pendingReviewLines: filtered.filter(row => row.reviewStatus !== 'validado').length,
        },
        notice: 'Resumen interno basado en facturas contabilizadas. Las facturas históricas sin desglose fiscal se muestran como agregado pendiente de revisión.',
      });
    }
    if (action === 'assets_overview') {
      const [assets, schedule] = await Promise.all([
        fetchAll(svc.entities.AccountingAsset, { companyId }, 'inServiceDate', 10000),
        fetchAll(svc.entities.AmortizationScheduleLine, { companyId }, 'postingDate', 100000),
      ]);
      const totals = {
        cost: money(assets.filter(item => item.status !== 'disposed').reduce((sum, item) => sum + Number(item.cost || 0), 0)),
        postedDepreciation: money(schedule.filter(item => item.status === 'posted').reduce((sum, item) => sum + Number(item.amount || 0), 0)),
        pendingDepreciation: money(schedule.filter(item => item.status === 'pending').reduce((sum, item) => sum + Number(item.amount || 0), 0)),
      };
      return Response.json({ success: true, assets, schedule, totals });
    }

    if (action === 'save_asset') {
      const name = String(body.name || '').trim();
      const acquisitionDate = String(body.acquisitionDate || '');
      const inServiceDate = String(body.inServiceDate || '');
      const cost = money(body.cost);
      const residualValue = money(body.residualValue);
      const requestedUsefulLifeMonths = Number(body.usefulLifeMonths);
      const requestedRate = Number(body.depreciationRate);
      const depreciationRate = requestedRate > 0
        ? Math.round(requestedRate * 10000) / 10000
        : (requestedUsefulLifeMonths > 0 ? Math.round((1200 / requestedUsefulLifeMonths) * 10000) / 10000 : 0);
      const usefulLifeMonths = requestedRate > 0 ? Math.ceil(1200 / requestedRate) : requestedUsefulLifeMonths;
      const fiscalMaxRate = Number(body.fiscalMaxRate || 0);
      const fiscalMaxYears = Number(body.fiscalMaxYears || 0);
      const codes = {
        assetAccountCode: String(body.assetAccountCode || ''),
        accumulatedDepreciationAccountCode: String(body.accumulatedDepreciationAccountCode || ''),
        expenseAccountCode: String(body.expenseAccountCode || ''),
      };
      if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(acquisitionDate) || !/^\d{4}-\d{2}-\d{2}$/.test(inServiceDate)) {
        return Response.json({ error: 'Nombre, fecha de compra y fecha de puesta en servicio son obligatorios.' }, { status: 400 });
      }
      if (cost <= 0 || residualValue < 0 || residualValue >= cost || !Number.isInteger(usefulLifeMonths) || usefulLifeMonths < 1 || usefulLifeMonths > 1200 || depreciationRate <= 0 || depreciationRate > 100) {
        return Response.json({ error: 'Revisa coste, valor residual, porcentaje anual y vida útil.' }, { status: 400 });
      }
      for (const [field, rawCode] of Object.entries(codes)) {
        if (!isCanonical8(rawCode)) return Response.json({ error: 'La cuenta de ' + field + ' debe tener 8 dígitos.' }, { status: 400 });
        const found = await svc.entities.AccountingAccount.filter({ companyId, code: rawCode }, '-created_date', 1);
        if (!found?.[0] || found[0].status === 'inactiva') {
          return Response.json({ error: 'La cuenta ' + rawCode + ' no existe o está inactiva.' }, { status: 409 });
        }
      }
      const payload = {
        companyId,
        name,
        description: String(body.description || ''),
        acquisitionDate,
        inServiceDate,
        cost,
        residualValue,
        usefulLifeMonths,
        depreciationRate,
        fiscalTable: ['lis', 'irpf_eds'].includes(String(body.fiscalTable || '')) ? String(body.fiscalTable) : 'manual',
        fiscalCategoryCode: String(body.fiscalCategoryCode || ''),
        fiscalCategoryLabel: String(body.fiscalCategoryLabel || ''),
        fiscalMaxRate: fiscalMaxRate > 0 ? fiscalMaxRate : 0,
        fiscalMaxYears: Number.isInteger(fiscalMaxYears) && fiscalMaxYears > 0 ? fiscalMaxYears : 0,
        fiscalReviewRequired: fiscalMaxRate > 0 && depreciationRate > fiscalMaxRate + 0.0001,
        method: 'lineal',
        currency: 'EUR',
        status: body.status || 'active',
        sourceInvoiceId: String(body.sourceInvoiceId || ''),
        ...codes,
        updatedBy: user.email,
        accountingSchemaVersion: SCHEMA_VERSION,
      };
      let asset;
      if (body.assetId) {
        const current = await svc.entities.AccountingAsset.get(String(body.assetId)).catch(() => null);
        if (!current || current.companyId !== companyId) return Response.json({ error: 'Activo no encontrado.' }, { status: 404 });
        const existingSchedule = await svc.entities.AmortizationScheduleLine.filter({ companyId, assetId: current.id }, 'postingDate', 1);
        if (existingSchedule?.length) {
          return Response.json({ error: 'No se puede cambiar la base del activo después de generar su cuadro. Crea un ajuste contable documentado.' }, { status: 409 });
        }
        asset = await svc.entities.AccountingAsset.update(current.id, payload);
      } else {
        asset = await svc.entities.AccountingAsset.create({ ...payload, createdBy: user.email });
      }
      return Response.json({ success: true, asset });
    }

    if (action === 'generate_amortization_schedule') {
      const asset = await svc.entities.AccountingAsset.get(String(body.assetId || '')).catch(() => null);
      if (!asset || asset.companyId !== companyId) return Response.json({ error: 'Activo no encontrado.' }, { status: 404 });
      if (asset.status === 'disposed') return Response.json({ error: 'El activo está dado de baja.' }, { status: 409 });
      const existing = await svc.entities.AmortizationScheduleLine.filter({ companyId, assetId: asset.id }, 'postingDate', 5000);
      if (existing?.length) return Response.json({ success: true, alreadyGenerated: true, schedule: existing });
      const depreciable = money(Number(asset.cost) - Number(asset.residualValue || 0));
      const configuredMonths = Number(asset.usefulLifeMonths);
      const annualRate = Number(asset.depreciationRate || 0);
      if (depreciable <= 0 || !Number.isInteger(configuredMonths) || configuredMonths < 1 || (annualRate && (annualRate <= 0 || annualRate > 100))) {
        return Response.json({ error: 'La base amortizable, el porcentaje anual o la vida útil no son válidos.' }, { status: 409 });
      }
      const start = new Date(asset.inServiceDate + 'T12:00:00Z');
      const regularAmount = money(annualRate > 0 ? (depreciable * annualRate / 1200) : (depreciable / configuredMonths));
      if (regularAmount <= 0) return Response.json({ error: 'La cuota mensual calculada es inferior a un céntimo. Revisa el porcentaje o la base amortizable.' }, { status: 409 });
      const months = annualRate > 0 ? Math.min(1200, Math.ceil(depreciable / regularAmount)) : configuredMonths;
      let accumulated = 0;
      const payloads = [];
      for (let index = 0; index < months; index += 1) {
        const year = start.getUTCFullYear();
        const month = start.getUTCMonth() + index;
        const postingDate = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
        const amount = index === months - 1 ? money(depreciable - accumulated) : regularAmount;
        accumulated = money(accumulated + amount);
        payloads.push({
          companyId,
          assetId: asset.id,
          period: postingDate.slice(0, 7),
          postingDate,
          amount,
          accumulatedAmount: accumulated,
          netBookValue: money(Number(asset.cost) - accumulated),
          status: 'pending',
          postingKey: 'amortization:' + asset.id + ':' + postingDate + ':' + SCHEMA_VERSION,
          accountingSchemaVersion: SCHEMA_VERSION,
        });
      }
      const schedule = await svc.entities.AmortizationScheduleLine.bulkCreate(payloads);
      return Response.json({ success: true, alreadyGenerated: false, schedule });
    }

    if (action === 'post_amortization') {
      const scheduleLine = await svc.entities.AmortizationScheduleLine.get(String(body.scheduleLineId || '')).catch(() => null);
      if (!scheduleLine || scheduleLine.companyId !== companyId) return Response.json({ error: 'Cuota de amortización no encontrada.' }, { status: 404 });
      const asset = await svc.entities.AccountingAsset.get(scheduleLine.assetId).catch(() => null);
      if (!asset || asset.companyId !== companyId) return Response.json({ error: 'Activo no encontrado.' }, { status: 404 });
      if (scheduleLine.status === 'posted' && scheduleLine.journalEntryId) {
        const linked = await svc.entities.JournalEntry.get(scheduleLine.journalEntryId).catch(() => null);
        if (linked && linked.status !== 'anulado') return Response.json({ success: true, alreadyPosted: true, line: scheduleLine, entry: linked });
      }
      await assertAccountingDateOpen(svc, companyId, scheduleLine.postingDate);
      const accountCodes = [asset.expenseAccountCode, asset.accumulatedDepreciationAccountCode];
      const resolved = [];
      for (const code of accountCodes) {
        const rows = await svc.entities.AccountingAccount.filter({ companyId, code }, '-created_date', 1);
        if (!rows?.[0] || rows[0].status === 'inactiva') return Response.json({ error: 'La cuenta ' + code + ' no existe o está inactiva.' }, { status: 409 });
        resolved.push(rows[0]);
      }
      const amount = money(scheduleLine.amount);
      const posting = await createJournalEntry(svc, companyId, {
        date: scheduleLine.postingDate,
        description: 'Amortización mensual · ' + asset.name,
        type: 'amortizacion',
        source: 'sistema',
        sourceEvent: 'asset_monthly_depreciation',
        documentId: asset.id,
        postingKey: scheduleLine.postingKey || ('amortization:' + asset.id + ':' + scheduleLine.postingDate + ':' + SCHEMA_VERSION),
        status: 'confirmado',
        lines: [
          { accountId: resolved[0].id, accountCode: resolved[0].code, accountName: resolved[0].name, description: asset.name, debit: amount, credit: 0, sourceLineType: 'amortizacion' },
          { accountId: resolved[1].id, accountCode: resolved[1].code, accountName: resolved[1].name, description: asset.name, debit: 0, credit: amount, sourceLineType: 'amortizacion' },
        ],
      }, user.email);
      const updated = await svc.entities.AmortizationScheduleLine.update(scheduleLine.id, {
        status: 'posted',
        journalEntryId: posting.entry.id,
      });
      const pending = await svc.entities.AmortizationScheduleLine.filter({ companyId, assetId: asset.id, status: 'pending' }, 'postingDate', 1);
      if (!pending?.length) await svc.entities.AccountingAsset.update(asset.id, { status: 'fully_depreciated', updatedBy: user.email });
      return Response.json({ success: true, alreadyPosted: posting.alreadyPosted, line: updated, entry: posting.entry });
    }
    if (action === 'validate_payroll_proposal' || action === 'post_payroll_proposal') {
      const proposalId = String(body.proposalId || '');
      if (!proposalId) return Response.json({ error: 'Falta la propuesta contable de nómina.' }, { status: 400 });
      const proposal = await svc.entities.LaborAccountingEntryProposal.get(proposalId).catch(() => null);
      if (!proposal || proposal.company_id !== companyId) {
        return Response.json({ error: 'La propuesta no existe o no pertenece a la empresa.' }, { status: 404 });
      }
      const proposalLines = Array.isArray(proposal.lines) ? proposal.lines : [];
      const debit = money(proposalLines.reduce((sum, item) => sum + Number(item.debe || 0), 0));
      const credit = money(proposalLines.reduce((sum, item) => sum + Number(item.haber || 0), 0));
      if (proposalLines.length < 2 || debit <= 0 || Math.abs(debit - credit) > 0.01) {
        return Response.json({ error: 'La propuesta debe tener al menos dos líneas y estar cuadrada antes de validarse.' }, { status: 409 });
      }
      if (action === 'validate_payroll_proposal') {
        if (proposal.status === 'contabilizado') {
          return Response.json({ success: true, alreadyPosted: true, proposal });
        }
        const validated = await svc.entities.LaborAccountingEntryProposal.update(proposal.id, {
          status: 'validado',
          balanced: true,
          debit_total: debit,
          credit_total: credit,
          validated_by: user.email,
          validated_at: new Date().toISOString(),
        });
        return Response.json({ success: true, proposal: validated });
      }

      if (proposal.status === 'contabilizado' && proposal.journal_entry_id) {
        const linked = await svc.entities.JournalEntry.get(proposal.journal_entry_id).catch(() => null);
        if (linked && linked.companyId === companyId && linked.status !== 'anulado') {
          return Response.json({ success: true, alreadyPosted: true, proposal, entry: linked });
        }
      }
      if (proposal.status !== 'validado') {
        return Response.json({ error: 'Primero valida la propuesta de nómina.' }, { status: 409 });
      }
      const date = String(body.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return Response.json({ error: 'Indica la fecha contable de la nómina.' }, { status: 400 });
      }
      await assertAccountingDateOpen(svc, companyId, date);
      const resolvedLines = [];
      for (const item of proposalLines) {
        const code = canonical8(item.cuenta);
        const rows = await svc.entities.AccountingAccount.filter({ companyId, code }, '-created_date', 1);
        const account = rows?.[0];
        if (!account || account.status === 'inactiva') {
          return Response.json({ error: 'La cuenta ' + code + ' no existe o está inactiva. Inicializa o completa el plan contable.' }, { status: 409 });
        }
        resolvedLines.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          description: item.descripcion || ('Nómina ' + (proposal.employee_name || proposal.period || '')).trim(),
          debit: money(item.debe),
          credit: money(item.haber),
          sourceLineType: 'nomina',
        });
      }
      const postingKey = 'payroll:' + proposal.id + ':' + SCHEMA_VERSION;
      const posting = await createJournalEntry(svc, companyId, {
        date,
        description: ('Nómina ' + (proposal.employee_name || '') + ' · ' + (proposal.period || date)).trim(),
        type: 'nomina',
        source: 'sistema',
        sourceEvent: 'payroll_validated',
        documentId: proposal.labor_ocr_document_id || proposal.id,
        postingKey,
        status: 'confirmado',
        lines: resolvedLines,
      }, user.email);
      const updated = await svc.entities.LaborAccountingEntryProposal.update(proposal.id, {
        status: 'contabilizado',
        journal_entry_id: posting.entry.id,
        posting_key: postingKey,
        accounted_at: new Date().toISOString(),
        accounted_by: user.email,
      });
      return Response.json({ success: true, alreadyPosted: posting.alreadyPosted, proposal: updated, entry: posting.entry });
    }
    if (action === 'consolidate_bank_ledgers') {
      const postingDate = String(body.postingDate || new Date().toISOString().slice(0, 10));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(postingDate)) return Response.json({ error: 'Fecha de consolidación no válida.' }, { status: 400 });
      const result = await consolidateDuplicateBankLedgers(svc, companyId, body.apply === true, user.email, postingDate);
      return Response.json({ success: true, ...result });
    }

    if (action === 'save_bank_exchange_rate') {
      if (body.apply !== true) return Response.json({ success: true, mode: 'dry_run', transactionId: body.transactionId || '' });
      const result = await saveBankExchangeRate(svc, companyId, body, user.email);
      return Response.json({ success: true, mode: 'apply', result, overview: await loadBankReconciliationOverview(svc, companyId) });
    }

    if (action === 'bank_reconciliation_overview') {
      return Response.json({
        success: true,
        overview: await loadBankReconciliationOverview(svc, companyId),
        schemaVersion: SCHEMA_VERSION,
      });
    }

    if (action === 'reclassify_pending_bank') {
      if (body.apply !== true) {
        return Response.json({ success: true, mode: 'dry_run', transactionId: body.transactionId || '', targetAccountId: body.targetAccountId || '' });
      }
      if (!body.transactionId || !body.targetAccountId) {
        return Response.json({ error: 'Selecciona un movimiento y una cuenta contable.' }, { status: 400 });
      }
      const result = await reclassifyPendingBankTransaction(
        svc,
        companyId,
        String(body.transactionId),
        String(body.targetAccountId),
        user.email,
      );
      return Response.json({
        success: true,
        mode: 'apply',
        result: {
          alreadyPosted: result.alreadyPosted,
          entryId: result.entry.id,
          entryNumber: result.entry.entryNumber,
          targetAccountCode: result.targetAccount.code,
        },
        overview: await loadBankReconciliationOverview(svc, companyId),
      });
    }

    if (action === 'create_bank_opening_adjustment') {
      if (body.apply !== true) {
        return Response.json({ success: true, mode: 'dry_run', bankAccountId: body.bankAccountId || '' });
      }
      if (!body.bankAccountId) {
        return Response.json({ error: 'Selecciona una cuenta bancaria.' }, { status: 400 });
      }
      const result = await createBankOpeningAdjustment(
        svc,
        companyId,
        String(body.bankAccountId),
        user.email,
      );
      return Response.json({
        success: true,
        mode: 'apply',
        result,
        overview: await loadBankReconciliationOverview(svc, companyId),
      });
    }

    if (action === 'duplicate_audit') {
      const [invoices, entries, accounts] = await Promise.all([
        fetchAll(svc.entities.Invoice, { company_id: companyId }, 'created_date', 10000),
        fetchAll(svc.entities.JournalEntry, { companyId }, 'created_date', 100000),
        fetchAll(svc.entities.AccountingAccount, { companyId }, 'code', 10000),
      ]);
      return Response.json({
        success: true,
        audit: buildDuplicateAudit(invoices, entries, accounts),
        schemaVersion: SCHEMA_VERSION,
      });
    }

    if (action === 'post_unmatched_bank') {
      const apply = body.apply === true;
      const offset = Math.max(0, Number(body.offset) || 0);
      const batchSize = apply ? Math.min(100, Math.max(1, Number(body.batchSize) || 100)) : Math.min(5000, Math.max(1, Number(body.batchSize) || 5000));
      const requestedIdList = Array.isArray(body.transactionIds)
        ? [...new Set(body.transactionIds.map(String))].slice(0, 100)
        : null;
      const requestedIds = requestedIdList ? new Set(requestedIdList) : null;
      const requestedBankIds = Array.isArray(body.bankAccountIds) ? new Set(body.bankAccountIds.map(String)) : null;
      const [transactions, bankAccounts, entries] = await Promise.all([
        requestedIdList
          ? Promise.all(requestedIdList.map(id => svc.entities.BankTransaction.get(id).catch(() => null)))
            .then(rows => rows.filter(Boolean))
          : fetchAll(svc.entities.BankTransaction, { company_id: companyId }, 'fecha_operacion', 100000),
        fetchAll(svc.entities.BankAccount, { company_id: companyId }, 'created_date', 10000),
        fetchAll(svc.entities.JournalEntry, { companyId }, 'created_date', 100000),
      ]);
      const bankById = new Map((bankAccounts || []).filter(account => account.activa !== false).map(account => [account.id, account]));
      const postingByKey = new Map((entries || []).filter(entry => entry.postingKey && entry.status !== 'anulado').map(entry => [entry.postingKey, entry]));
      const eligible = (transactions || []).filter(transaction =>
        transaction.company_id === companyId
        && bankById.has(transaction.bank_account_id)
        && (!requestedBankIds || requestedBankIds.has(transaction.bank_account_id))
        && (!requestedIds || requestedIds.has(transaction.id))
        && transaction.estado_proveedor !== 'pending'
        && !transaction.es_demo
        && Number.isFinite(Number(transaction.importe))
        && money(Math.abs(transaction.importe)) > 0
        && !transaction.entidad_id
        && !['duplicada', 'descartada', 'movimiento_interno', 'conciliada_auto', 'conciliada_manual'].includes(transaction.estado_conciliacion)
      );
      const page = eligible.slice(offset, offset + batchSize);
      const result = { scanned: 0, ready: 0, readyTransactionIds: [], posted: 0, alreadyPosted: 0, repairedLinks: 0, issues: [] };
      let pendingAccount = null;
      for (const transaction of page) {
        result.scanned += 1;
        const postingKey = `bank:${transaction.id}:${SCHEMA_VERSION}`;
        const existing = postingByKey.get(postingKey);
        if (existing) {
          result.alreadyPosted += 1;
          if (apply) {
            if (!pendingAccount) {
              pendingAccount = await ensureAccount(
                svc,
                companyId,
                '55500000',
                'Partidas pendientes de aplicación',
                'pasivo',
              );
            }
            const existingLines = await resolveEntryLines(svc, companyId, existing);
            if (!(existingLines || []).some(line =>
              line.accountId === pendingAccount.id || line.accountCode === '55500000'
            )) {
              result.issues.push({
                transactionId: transaction.id,
                reason: 'El asiento bancario existente no contiene la cuenta 55500000.',
              });
              continue;
            }
            const bankPostingAccount = await ensureBankPostingAccount(
              svc,
              companyId,
              bankById.get(transaction.bank_account_id),
            );
            await svc.entities.BankTransaction.update(transaction.id, {
              journal_entry_id: existing.id,
              accounting_account_id: bankPostingAccount.id,
              accounting_account_code: bankPostingAccount.code,
              entidad_tipo: 'accounting_account',
              entidad_id: pendingAccount.id,
              estado_conciliacion: 'revisar',
              confianza_conciliacion: 'baja',
            });
            result.repairedLinks += 1;
          }
          continue;
        }
        const valid = /^\d{4}-\d{2}-\d{2}$/.test(String(transaction.fecha_operacion || ''))
          && ['entrada', 'salida'].includes(transaction.tipo)
          && Number.isFinite(Number(transaction.importe))
          && money(Math.abs(transaction.importe)) > 0;
        if (!valid) {
          result.issues.push({ transactionId: transaction.id, reason: 'movimiento_bancario_incompleto' });
          continue;
        }
        if (transaction.tipo === 'salida') {
          result.issues.push({
            transactionId: transaction.id,
            reason: 'salida_pendiente_de_cuenta_contable',
            message: 'Las salidas sin documento no se contabilizan en 555. Selecciona una cuenta de contrapartida.',
          });
          continue;
        }
        result.ready += 1;
        result.readyTransactionIds.push(transaction.id);
        if (!apply) continue;
        if (apply) continue;
        try {
          if (!pendingAccount) pendingAccount = await ensureAccount(svc, companyId, '55500000', 'Partidas pendientes de aplicación', 'pasivo');
          const physicalBank = bankById.get(transaction.bank_account_id);
          const bankPostingAccount = await ensureBankPostingAccount(svc, companyId, physicalBank);
          const posting = await postBankReconciliation(svc, companyId, transaction, bankPostingAccount, pendingAccount, user.email, {
            documentId: transaction.id,
            description: `Movimiento bancario pendiente de aplicar · ${transaction.concepto || transaction.referencia || transaction.id}`,
            counterpartyLineType: 'ajuste',
            status: 'confirmado',
          });
          const note = 'Clasificación contable provisional automática en 55500000. Pendiente de aplicar a factura o cuenta definitiva.';
          await svc.entities.BankTransaction.update(transaction.id, {
            journal_entry_id: posting.entry.id,
            accounting_account_id: bankPostingAccount.id,
            accounting_account_code: bankPostingAccount.code,
            entidad_tipo: 'accounting_account',
            entidad_id: pendingAccount.id,
            estado_conciliacion: 'revisar',
            confianza_conciliacion: 'baja',
            notas: `${transaction.notas ? `${transaction.notas}\n` : ''}${note}`.slice(0, 2000),
          });
          if (posting.alreadyPosted) result.alreadyPosted += 1; else result.posted += 1;
        } catch (error) {
          result.issues.push({ transactionId: transaction.id, reason: error.message || 'error_contabilizacion_555' });
        }
      }
      if (apply && result.readyTransactionIds.length) {
        const readyIds = new Set(result.readyTransactionIds);
        try {
          const batch = await postPendingBankBatch(
            svc,
            companyId,
            page.filter(transaction => readyIds.has(transaction.id)),
            bankById,
            entries,
            user.email,
          );
          result.posted += batch.posted;
          result.alreadyPosted += batch.alreadyPosted;
          result.repairedLinks += batch.repairedLinks;
          result.issues.push(...batch.issues);
        } catch (error) {
          result.issues.push({ reason: error.message || 'error_lote_contabilizacion_555' });
        }
      }
      const nextOffset = offset + page.length;
      return Response.json({
        success: true,
        mode: apply ? 'apply' : 'dry_run',
        total: eligible.length,
        offset,
        nextOffset,
        done: nextOffset >= eligible.length,
        result,
        pendingAccountCode: '55500000',
        schemaVersion: SCHEMA_VERSION,
      });
    }

    if (action === 'sync_invoices') {
      const apply = body.apply === true;
      const offset = Math.max(0, Number(body.offset) || 0);
      const batchSize = apply ? Math.min(25, Math.max(1, Number(body.batchSize) || 3)) : Math.min(5000, Math.max(1, Number(body.batchSize) || 5000));
      const [invoices, entries] = await Promise.all([
        fetchAll(svc.entities.Invoice, { company_id: companyId }, 'created_date', 10000),
        fetchAll(svc.entities.JournalEntry, { companyId }, 'created_date', 100000),
      ]);
      const requestedInvoiceIds = Array.isArray(body.invoiceIds) ? new Set(body.invoiceIds.map(String)) : null;
      const active = (invoices || []).filter(invoice => !invoice.anulada && (!body.invoiceType || invoice.tipo === body.invoiceType) && (!requestedInvoiceIds || requestedInvoiceIds.has(invoice.id)));
      const entryById = new Map();
      for (const entry of entries || []) {
        entryById.set(entry.id, entry);
        if (entry.importKey) entryById.set(entry.importKey, entry);
      }
      const postingByKey = new Map((entries || []).filter(entry => entry.postingKey).map(entry => [entry.postingKey, entry]));
      const page = active.slice(offset, offset + batchSize);
      const result = { scanned: 0, alreadyLinked: 0, ready: 0, readyInvoiceIds: [], posted: 0, repairedLinks: 0, issues: [] };
      for (const invoice of page) {
        result.scanned += 1;
        const linked = invoice.linked_journal_entry_id ? entryById.get(invoice.linked_journal_entry_id) : null;
        if (linked && linked.status !== 'anulado') { result.alreadyLinked += 1; continue; }
        if (invoice.accounting_migration_hold) {
          result.issues.push({ invoiceId: invoice.id, number: invoice.numero_factura || '', reason: invoice.accounting_migration_hold_reason || 'revision_contable_obligatoria' });
          continue;
        }
        const postingKey = `invoice:${invoice.id}:${SCHEMA_VERSION}`;
        const duplicate = postingByKey.get(postingKey);
        if (duplicate && duplicate.status !== 'anulado') {
          result.repairedLinks += 1;
          if (apply) await svc.entities.Invoice.update(invoice.id, { linked_journal_entry_id: duplicate.id, estado_contable: duplicate.status === 'confirmado' ? 'contabilizada' : 'asiento_propuesto' });
          continue;
        }
        const party = invoice.tipo === 'emitida' ? invoice.cliente_nombre : invoice.proveedor_nombre;
        const totalExpected = money(Number(invoice.base_imponible || 0) + Number(invoice.cuota_iva || 0) - Number(invoice.importe_retencion || 0));
        const totalMatches = Math.abs(totalExpected - money(invoice.total_factura)) <= 0.02;
        const valid = /^\d{4}-\d{2}-\d{2}$/.test(String(invoice.fecha_emision || ''))
          && ['emitida', 'recibida'].includes(invoice.tipo)
          && Number.isFinite(Number(invoice.total_factura))
          && totalMatches
          && String(party || '').trim();
        if (!valid) {
          result.issues.push({ invoiceId: invoice.id, number: invoice.numero_factura || '', reason: !party ? 'tercero_sin_identificar' : !totalMatches ? 'importe_total_no_cuadra_con_base_e_impuestos' : 'datos_contables_incompletos' });
          continue;
        }
        result.ready += 1;
        result.readyInvoiceIds.push(invoice.id);
        if (apply) {
          try {
            const posting = await postInvoice(svc, companyId, invoice, user.email, { status: 'confirmado' });
            if (!posting.alreadyPosted) result.posted += 1;
          } catch (error) {
            result.issues.push({ invoiceId: invoice.id, number: invoice.numero_factura || '', reason: error.message || 'error_contabilizacion' });
          }
        }
      }
      const nextOffset = offset + page.length;
      return Response.json({ success: true, mode: apply ? 'apply' : 'dry_run', total: active.length, offset, nextOffset, done: nextOffset >= active.length, result, schemaVersion: SCHEMA_VERSION });
    }

    if (action === 'sync_payments') {
      const apply = body.apply === true;
      const offset = Math.max(0, Number(body.offset) || 0);
      const batchSize = apply ? Math.min(10, Math.max(1, Number(body.batchSize) || 3)) : Math.min(500, Math.max(1, Number(body.batchSize) || 500));
      const [payments, invoices, transactions, bankAccounts, entries, accounts] = await Promise.all([
        fetchAll(svc.entities.InvoicePayment, { company_id: companyId }, 'created_date', 10000),
        fetchAll(svc.entities.Invoice, { company_id: companyId }, 'created_date', 10000),
        fetchAll(svc.entities.BankTransaction, { company_id: companyId }, 'created_date', 100000),
        fetchAll(svc.entities.BankAccount, { company_id: companyId }, 'created_date', 10000),
        fetchAll(svc.entities.JournalEntry, { companyId }, 'created_date', 100000),
        fetchAll(svc.entities.AccountingAccount, { companyId }, 'code', 10000),
      ]);
      const requestedPaymentIds = Array.isArray(body.paymentIds) ? new Set(body.paymentIds.map(String)) : null;
      const activePayments = requestedPaymentIds ? payments.filter(payment => requestedPaymentIds.has(payment.id)) : payments;
      const invoiceById = new Map(invoices.map(invoice => [invoice.id, invoice]));
      const transactionById = new Map(transactions.map(transaction => [transaction.id, transaction]));
      const bankById = new Map(bankAccounts.map(account => [account.id, account]));
      const accountById = new Map(accounts.map(account => [account.id, account]));
      const accountByCode = new Map(accounts.map(account => [account.code, account]));
      const entryByKey = new Map();
      for (const entry of entries) { entryByKey.set(entry.id, entry); if (entry.importKey) entryByKey.set(entry.importKey, entry); }
      const page = activePayments.slice(offset, offset + batchSize);
      const result = { scanned: 0, alreadyLinked: 0, ready: 0, readyPaymentIds: [], posted: 0, repairedLinks: 0, issues: [] };
      for (const payment of page) {
        result.scanned += 1;
        const linked = payment.journal_entry_id ? entryByKey.get(payment.journal_entry_id) : null;
        if (linked && linked.status !== 'anulado') { result.alreadyLinked += 1; continue; }
        const invoice = invoiceById.get(payment.invoice_id);
        const transaction = transactionById.get(payment.bank_transaction_id);
        const physicalBank = transaction ? bankById.get(transaction.bank_account_id) : null;
        if (!invoice || invoice.anulada || !transaction || !physicalBank) {
          result.issues.push({ paymentId: payment.id, invoiceId: payment.invoice_id, reason: !invoice ? 'factura_no_encontrada' : invoice.anulada ? 'factura_anulada' : !transaction ? 'movimiento_bancario_no_encontrado' : 'cuenta_bancaria_no_encontrada' });
          continue;
        }
        const invoiceEntry = entryByKey.get(invoice.linked_journal_entry_id);
        if (!invoiceEntry || invoiceEntry.status === 'anulado') {
          result.issues.push({ paymentId: payment.id, invoiceId: invoice.id, reason: 'factura_sin_asiento_valido' });
          continue;
        }
        let counterparty = accountById.get(invoice.counterparty_account_id) || accountByCode.get(invoice.counterparty_account_code);
        if (!counterparty) {
          const invoiceLines = await resolveEntryLines(svc, companyId, invoiceEntry);
          const partyLine = invoiceLines.find(line => /^(400|410|430)/.test(String(line.accountCode || line.subcuenta || '')));
          const code = partyLine ? canonical8(partyLine.accountCode || partyLine.subcuenta) : '';
          counterparty = code ? accountByCode.get(code) : null;
        }
        if (!counterparty) {
          result.issues.push({ paymentId: payment.id, invoiceId: invoice.id, reason: 'subcuenta_tercero_no_encontrada' });
          continue;
        }
        const invoiceTotal = Number(invoice.total_factura || 0);
        const expectedIncoming = (invoice.tipo === 'emitida' && invoiceTotal >= 0) || (invoice.tipo === 'recibida' && invoiceTotal < 0);
        if ((transaction.tipo === 'entrada') !== expectedIncoming) {
          result.issues.push({ paymentId: payment.id, invoiceId: invoice.id, reason: 'sentido_bancario_incompatible_con_factura' });
          continue;
        }
        if (money(Math.abs(transaction.importe)) !== money(Math.abs(payment.amount))) {
          result.issues.push({ paymentId: payment.id, invoiceId: invoice.id, reason: 'importe_pago_movimiento_no_coincide' });
          continue;
        }
        result.ready += 1;
        result.readyPaymentIds.push(payment.id);
        if (apply) {
          try {
            const bankPostingAccount = await ensureBankPostingAccount(svc, companyId, physicalBank);
            const posting = await postBankReconciliation(svc, companyId, transaction, bankPostingAccount, counterparty, user.email, {
              documentId: invoice.id,
              description: `${invoice.tipo === 'emitida' ? 'Cobro' : 'Pago'} factura ${invoice.numero_factura || ''}`.trim(),
              counterpartyLineType: 'tercero',
              status: 'confirmado',
            });
            await svc.entities.InvoicePayment.update(payment.id, { journal_entry_id: posting.entry.id });
            await svc.entities.BankTransaction.update(transaction.id, {
              journal_entry_id: posting.entry.id,
              accounting_account_id: bankPostingAccount.id,
              accounting_account_code: bankPostingAccount.code,
            });
            if (posting.alreadyPosted) result.repairedLinks += 1; else result.posted += 1;
          } catch (error) {
            result.issues.push({ paymentId: payment.id, invoiceId: invoice.id, reason: error.message || 'error_contabilizacion_pago' });
          }
        }
      }
      const nextOffset = offset + page.length;
      return Response.json({ success: true, mode: apply ? 'apply' : 'dry_run', total: activePayments.length, offset, nextOffset, done: nextOffset >= activePayments.length, result, schemaVersion: SCHEMA_VERSION });
    }

    if (action === 'quality' || action === 'reports' || action === 'journal' || action === 'ledger') {
      const requestedYear = body.year && body.year !== 'all' ? Number(body.year) : null;
      const data = await accountingData(svc, companyId, {
        year: action === 'quality' ? null : requestedYear,
        includeBusinessData: action === 'quality',
      });
      if (action === 'quality') {
        return Response.json({ success: true, quality: accountingQuality(data), schemaVersion: SCHEMA_VERSION });
      }
      if (action === 'reports') {
        return Response.json({ success: true, report: buildReports(data, { year: body.year, scope: body.scope }), quality: accountingQuality(data), schemaVersion: SCHEMA_VERSION });
      }
      if (action === 'journal') {
        return Response.json({ success: true, journal: buildJournal(data, { year: body.year, status: body.status, type: body.type, source: body.source, search: body.search, page: body.page, pageSize: body.pageSize }), quality: accountingQuality(data), schemaVersion: SCHEMA_VERSION });
      }
      return Response.json({ success: true, ledger: buildLedger(data, { year: body.year, scope: body.scope, accountCode: body.accountCode }), quality: accountingQuality(data), schemaVersion: SCHEMA_VERSION });
    }

    if (action === 'seed_pgc') {
      const result = await seedOperationalPgc(svc, companyId);
      return Response.json({ success: true, schemaVersion: SCHEMA_VERSION, ...result });
    }

    if (action === 'create_account') {
      const code = String(body.code || '').trim();
      const name = String(body.name || '').trim();
      if (!isCanonical8(code) || !/^[1-9]/.test(code)) {
        return Response.json({ error: 'La subcuenta debe tener exactamente 8 dígitos y pertenecer a los grupos 1 a 9 del PGC.' }, { status: 400 });
      }
      if (!name) return Response.json({ error: 'El nombre de la cuenta es obligatorio.' }, { status: 400 });
      const duplicate = await svc.entities.AccountingAccount.filter({ companyId, code }, '-created_date', 1);
      if (duplicate?.length) return Response.json({ error: `La cuenta ${code} ya existe.` }, { status: 409 });
      const group = code.slice(0, 1);
      const type = body.type || (
        group === '1' ? (/^(10|11|12|13)/.test(code) ? 'patrimonio' : 'pasivo')
          : ['2', '3'].includes(group) ? 'activo'
            : group === '4' ? (code.startsWith('40') || code.startsWith('41') ? 'proveedor' : code.startsWith('43') ? 'cliente' : code.startsWith('47') ? 'impuesto' : 'pasivo')
              : group === '5' ? (code.startsWith('57') ? 'banco' : /^(50|51|52|55)/.test(code) ? 'pasivo' : 'activo')
                : group === '6' ? 'gasto' : group === '7' ? 'ingreso' : 'otro'
      );
      const account = await svc.entities.AccountingAccount.create({
        companyId,
        code,
        name,
        type,
        group,
        subgroup1: code.slice(0, 2),
        subgroup2: code.slice(0, 3),
        subgroup3: code.slice(0, 4),
        status: 'activa',
        isSystemAccount: false,
        canonical8: true,
        codeLength: 8,
        accountingSchemaVersion: SCHEMA_VERSION,
      });
      return Response.json({ success: true, account });
    }

    if (action === 'duplicate_entry') {
      const original = await svc.entities.JournalEntry.get(String(body.entryId || '')).catch(() => null);
      if (!original || original.companyId !== companyId) return Response.json({ error: 'Asiento no encontrado.' }, { status: 404 });
      const originalLines = await resolveEntryLines(svc, companyId, original);
      if (originalLines.length < 2) return Response.json({ error: 'El asiento no tiene líneas suficientes para duplicarse.' }, { status: 409 });
      const date = String(body.date || new Date().toISOString().slice(0, 10));
      const created = await createJournalEntry(svc, companyId, {
        date,
        description: 'Copia de ' + (original.entryNumber || '') + ' · ' + (original.description || ''),
        type: original.type === 'cierre' || original.type === 'regularizacion' ? 'manual' : (original.type || 'manual'),
        source: 'manual',
        sourceEvent: 'entry_duplicated_as_draft',
        status: 'borrador',
        lines: originalLines.map(item => ({
          accountId: item.accountId || '',
          accountCode: canonical8(item.accountCode || item.subcuenta),
          accountName: item.accountName || '',
          description: item.description || original.description || '',
          debit: money(item.debit || item.debeE),
          credit: money(item.credit || item.haberE),
          taxCode: item.taxCode || '',
          sourceLineType: item.sourceLineType || 'manual',
        })),
      }, user.email);
      return Response.json({ success: true, entryId: created.entry.id, entryNumber: created.entry.entryNumber });
    }
    if (action === 'create_manual') {
      const { date, description, type = 'manual', status = 'borrador', lines = [] } = body;
      if (!date || !String(description || '').trim()) {
        return Response.json({ error: 'Fecha y descripción son obligatorias.' }, { status: 400 });
      }
      if (!Array.isArray(lines) || lines.length < 2) {
        return Response.json({ error: 'Se necesitan al menos dos líneas.' }, { status: 400 });
      }
      const bad = lines.find(line => !isCanonical8(line.accountCode));
      if (bad) {
        return Response.json({
          error: `La cuenta ${bad?.accountCode || 'vacía'} debe tener exactamente 8 dígitos y existir en el plan contable.`,
        }, { status: 400 });
      }
      const created = await createJournalEntry(svc, companyId, {
        date,
        description,
        type,
        status,
        source: 'manual',
        lines,
      }, user.email);
      return Response.json({
        success: true,
        entryId: created.entry.id,
        entryNumber: created.entry.entryNumber,
        schemaVersion: SCHEMA_VERSION,
      });
    }

    if (action === 'confirm' || action === 'annul') {
      const entry = await svc.entities.JournalEntry.get(body.entryId);
      if (!entry || entry.companyId !== companyId) {
        return Response.json({ error: 'Asiento no encontrado en la empresa seleccionada.' }, { status: 404 });
      }
      let lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: entry.id }, 'lineNumber', 5000);
      if ((!lines || !lines.length) && entry.importKey) {
        lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: entry.importKey }, 'lineNumber', 5000);
      }
      if (action === 'confirm') {
        await assertAccountingDateOpen(svc, companyId, entry.date);
        if (!lines?.length) return Response.json({ error: 'El asiento no tiene líneas.' }, { status: 409 });
        const bad = lines.find(line => !isCanonical8(line.accountCode));
        if (bad) return Response.json({ error: `La cuenta ${bad.accountCode} no tiene 8 dígitos. Migra el asiento antes de confirmarlo.` }, { status: 409 });
        const debit = money(lines.reduce((sum, line) => sum + money(line.debit), 0));
        const credit = money(lines.reduce((sum, line) => sum + money(line.credit), 0));
        if (Math.abs(debit - credit) > 0.01) return Response.json({ error: 'El asiento no cuadra.' }, { status: 400 });
        const now = new Date().toISOString();
        await svc.entities.JournalEntry.update(entry.id, {
          status: 'confirmado',
          confirmedAt: now,
          confirmedBy: user.email,
          isBalanced: true,
          totalDebit: debit,
          totalCredit: credit,
          validationStatus: 'CONFIRMADO',
          accountingSchemaVersion: SCHEMA_VERSION,
        });
        for (const line of lines) {
          await svc.entities.JournalEntryLine.update(line.id, {
            accountCode: canonical8(line.accountCode),
            subcuenta: canonical8(line.accountCode),
            cuenta4: canonical8(line.accountCode).slice(0, 4),
            cuenta3: canonical8(line.accountCode).slice(0, 3),
            grupo: canonical8(line.accountCode).slice(0, 1),
            entryStatus: 'confirmado',
            entryDate: line.entryDate || entry.date,
            ejercicio: line.ejercicio || entry.ejercicio || new Date(entry.date).getFullYear(),
            validationStatus: 'CONFIRMADO',
            accountingSchemaVersion: SCHEMA_VERSION,
          });
        }
        return Response.json({ success: true });
      }

      const reason = String(body.reason || '').trim();
      if (!reason) return Response.json({ error: 'El motivo de anulación es obligatorio.' }, { status: 400 });
      const now = new Date().toISOString();
      if (entry.status === 'confirmado') {
        if (entry.reversalEntryId) {
          const existingReversal = await svc.entities.JournalEntry.get(entry.reversalEntryId).catch(() => null);
          if (existingReversal) return Response.json({ success: true, alreadyReversed: true, reversalEntryId: existingReversal.id });
        }
        if (!lines?.length) return Response.json({ error: 'El asiento confirmado no tiene líneas para crear su reversión.' }, { status: 409 });
        const postingKey = `reversal:${entry.id}:${SCHEMA_VERSION}`;
        const duplicate = await svc.entities.JournalEntry.filter({ companyId, postingKey }, '-created_date', 1);
        let reversal = duplicate?.[0];
        if (!reversal) {
          const reversedLines = lines.map(line => ({
            accountCode: canonical8(line.accountCode || line.subcuenta),
            accountName: line.accountName || '',
            description: `Reversión: ${line.description || entry.description || reason}`,
            debit: money(line.credit || line.haberE),
            credit: money(line.debit || line.debeE),
            taxCode: line.taxCode || '',
            counterpartyAccountId: line.counterpartyAccountId || '',
            counterpartyAccountCode: line.counterpartyAccountCode || '',
            sourceLineType: line.sourceLineType || 'ajuste',
          }));
          const created = await createJournalEntry(svc, companyId, {
            date: body.date || now.slice(0, 10),
            description: `Reversión ${entry.entryNumber || ''}: ${reason}`.trim(),
            type: 'ajuste',
            source: 'sistema',
            documentId: entry.documentId || '',
            postingKey,
            status: 'confirmado',
            lines: reversedLines,
          }, user.email);
          reversal = created.entry;
        }
        await svc.entities.JournalEntry.update(entry.id, {
          reversalEntryId: reversal.id,
          annulledAt: now,
          annulledBy: user.email,
          annulmentReason: reason,
          validationStatus: 'REVERTIDO',
        });
        if (entry.documentId) {
          const invoice = await svc.entities.Invoice.get(entry.documentId).catch(() => null);
          if (invoice && invoice.company_id === companyId && invoice.linked_journal_entry_id === entry.id) {
            await svc.entities.Invoice.update(invoice.id, { estado_contable: 'requiere_correccion', accounting_review_status: 'asiento_anulado' });
          }
        }
        return Response.json({ success: true, reversalEntryId: reversal.id });
      }

      if (entry.status === 'anulado') return Response.json({ success: true, alreadyAnnulled: true });
      await svc.entities.JournalEntry.update(entry.id, {
        status: 'anulado',
        annulledAt: now,
        annulledBy: user.email,
        annulmentReason: reason,
        validationStatus: 'ANULADO',
      });
      for (const line of lines || []) {
        await svc.entities.JournalEntryLine.update(line.id, { entryStatus: 'anulado', validationStatus: 'ANULADO' });
      }
      return Response.json({ success: true });
    }

    if (action === 'preview_invoice' || action === 'post_invoice') {
      const invoice = await svc.entities.Invoice.get(body.invoiceId);
      if (!invoice || invoice.company_id !== companyId) {
        return Response.json({ error: 'Factura no encontrada en la empresa seleccionada.' }, { status: 404 });
      }
      if (action === 'preview_invoice') {
        const proposal = await buildInvoicePosting(svc, companyId, invoice);
        return Response.json({
          success: true,
          lines: proposal.lines,
          counterparty: {
            accountId: proposal.counterparty.account.id,
            accountCode: proposal.counterparty.account.code,
            accountName: proposal.counterparty.account.name,
            role: proposal.counterparty.role,
          },
          resultAccount: {
            accountId: proposal.resultAccount.id,
            accountCode: proposal.resultAccount.code,
            accountName: proposal.resultAccount.name,
          },
          taxKind: proposal.taxKind,
          schemaVersion: SCHEMA_VERSION,
        });
      }
      const options = {
        date: body.date,
        description: body.description,
        status: body.status || 'confirmado',
        ocrDocumentId: body.ocrDocumentId || invoice.ocr_document_id,
      };
      if (Array.isArray(body.lines) && body.lines.length) {
        options.lines = body.lines.map(line => ({
          ...line,
          accountCode: canonical8(line.accountCode || line.cuenta),
          accountName: line.accountName || line.nombre,
          debit: money(line.debit ?? line.debe),
          credit: money(line.credit ?? line.haber),
        }));
      }
      const result = await postInvoice(svc, companyId, invoice, user.email, options);
      return Response.json({
        success: true,
        alreadyPosted: Boolean(result.alreadyPosted),
        entryId: result.entry.id,
        entryNumber: result.entry.entryNumber,
        schemaVersion: SCHEMA_VERSION,
      });
    }

    return Response.json({ error: 'Acción no válida.' }, { status: 400 });
  } catch (error) {
    console.error('[accountingOperations]', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
});

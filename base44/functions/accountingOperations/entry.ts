import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import {
  SCHEMA_VERSION,
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

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

async function resolveEntryLines(svc, companyId, entry) {
  let lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: entry.id }, 'lineNumber', 5000);
  if ((!lines || !lines.length) && entry.importKey) {
    lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: entry.importKey }, 'lineNumber', 5000);
  }
  return lines || [];
}

async function ensureBankPostingAccount(svc, companyId, bankAccount) {
  if (!bankAccount || bankAccount.company_id !== companyId) throw new Error('La cuenta bancaria no pertenece a la empresa.');
  if (bankAccount.accounting_account_id) {
    const linked = await svc.entities.AccountingAccount.get(bankAccount.accounting_account_id).catch(() => null);
    if (linked && linked.companyId === companyId && linked.status !== 'inactiva') return linked;
  }
  if (bankAccount.accounting_account_code) {
    const linked = await svc.entities.AccountingAccount.filter({ companyId, code: bankAccount.accounting_account_code }, '-created_date', 1);
    if (linked?.[0]) {
      await svc.entities.BankAccount.update(bankAccount.id, { accounting_account_id: linked[0].id });
      return linked[0];
    }
  }
  const accounts = await fetchAll(svc.entities.AccountingAccount, { companyId }, 'code', 10000);
  const used = new Set(accounts.map(account => String(account.code || '')));
  let code = '';
  for (let sequence = 1; sequence <= 9999; sequence += 1) {
    const candidate = `5720${String(sequence).padStart(4, '0')}`;
    if (!used.has(candidate)) { code = candidate; break; }
  }
  if (!code) throw new Error('No quedan subcuentas bancarias disponibles en el grupo 5720.');
  const suffix = bankAccount.ultimos_4 ? ` · ${bankAccount.ultimos_4}` : '';
  const account = await ensureAccount(svc, companyId, code, `${bankAccount.nombre_banco || 'Banco'}${suffix}`, 'banco');
  await svc.entities.BankAccount.update(bankAccount.id, { accounting_account_id: account.id, accounting_account_code: account.code });
  return account;
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

function buildDuplicateAudit(invoices, entries) {
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
  const duplicateInvoiceIds = [...new Set(invoiceDuplicateGroups.flatMap(group => group.items.map(item => item.id)))];
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      invoicesScanned: activeInvoices.length,
      entriesScanned: activeEntries.length,
      invoiceGroups: invoiceDuplicateGroups.length,
      journalGroups: journalDuplicateGroups.length,
      invoiceEntryConflicts: invoiceEntryConflicts.length,
      highConfidenceInvoiceGroups: invoiceDuplicateGroups.filter(group => group.confidence === 'alta').length,
      highConfidenceJournalGroups: journalDuplicateGroups.filter(group => group.confidence === 'alta').length,
    },
    duplicateInvoiceIds,
    invoiceDuplicateGroups,
    journalDuplicateGroups,
    invoiceEntryConflicts,
  };
}

async function postPendingBankBatch(svc, companyId, transactions, bankById, entries, userEmail) {
  const result = { posted: 0, issues: [] };
  if (!transactions.length) return result;

  const pendingAccount = await ensureAccount(
    svc,
    companyId,
    '55500000',
    'Partidas pendientes de aplicación',
    'activo',
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

  const postable = transactions
    .filter(item => bankPostingById.has(item.bank_account_id))
    .sort((a, b) => String(a.fecha_operacion || '').localeCompare(String(b.fecha_operacion || ''))
      || String(a.id).localeCompare(String(b.id)));
  if (!postable.length) return result;

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
      status: 'pendiente_revision',
      validationStatus: 'ERROR_CREACION_LINEAS',
      notes: 'Error creando lote bancario: ' + (error.message || 'error desconocido'),
    }))).catch(() => null);
    throw error;
  }
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

    if (action === 'duplicate_audit') {
      const [invoices, entries] = await Promise.all([
        fetchAll(svc.entities.Invoice, { company_id: companyId }, 'created_date', 10000),
        fetchAll(svc.entities.JournalEntry, { companyId }, 'created_date', 30000),
      ]);
      return Response.json({
        success: true,
        audit: buildDuplicateAudit(invoices, entries),
        schemaVersion: SCHEMA_VERSION,
      });
    }

    if (action === 'post_unmatched_bank') {
      const apply = body.apply === true;
      const offset = Math.max(0, Number(body.offset) || 0);
      const batchSize = apply ? Math.min(20, Math.max(1, Number(body.batchSize) || 5)) : Math.min(5000, Math.max(1, Number(body.batchSize) || 5000));
      const requestedIds = Array.isArray(body.transactionIds) ? new Set(body.transactionIds.map(String)) : null;
      const requestedBankIds = Array.isArray(body.bankAccountIds) ? new Set(body.bankAccountIds.map(String)) : null;
      const [transactions, bankAccounts, entries] = await Promise.all([
        fetchAll(svc.entities.BankTransaction, { company_id: companyId }, 'fecha_operacion', 30000),
        fetchAll(svc.entities.BankAccount, { company_id: companyId }, 'created_date', 10000),
        fetchAll(svc.entities.JournalEntry, { companyId }, 'created_date', 30000),
      ]);
      const bankById = new Map((bankAccounts || []).filter(account => account.activa !== false).map(account => [account.id, account]));
      const postingByKey = new Map((entries || []).filter(entry => entry.postingKey && entry.status !== 'anulado').map(entry => [entry.postingKey, entry]));
      const eligible = (transactions || []).filter(transaction =>
        bankById.has(transaction.bank_account_id)
        && (!requestedBankIds || requestedBankIds.has(transaction.bank_account_id))
        && (!requestedIds || requestedIds.has(transaction.id))
        && transaction.estado_proveedor !== 'pending'
        && !transaction.es_demo
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
          if (apply && transaction.journal_entry_id !== existing.id) {
            await svc.entities.BankTransaction.update(transaction.id, { journal_entry_id: existing.id });
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
        result.ready += 1;
        result.readyTransactionIds.push(transaction.id);
        if (!apply) continue;
        try {
          if (!pendingAccount) pendingAccount = await ensureAccount(svc, companyId, '55500000', 'Partidas pendientes de aplicación', 'activo');
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
        fetchAll(svc.entities.JournalEntry, { companyId }, 'created_date', 30000),
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
        fetchAll(svc.entities.BankTransaction, { company_id: companyId }, 'created_date', 30000),
        fetchAll(svc.entities.BankAccount, { company_id: companyId }, 'created_date', 10000),
        fetchAll(svc.entities.JournalEntry, { companyId }, 'created_date', 30000),
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
      const data = await accountingData(svc, companyId);
      if (action === 'quality') {
        return Response.json({ success: true, quality: accountingQuality(data), schemaVersion: SCHEMA_VERSION });
      }
      if (action === 'reports') {
        return Response.json({ success: true, report: buildReports(data, { year: body.year, scope: body.scope }), quality: accountingQuality(data), schemaVersion: SCHEMA_VERSION });
      }
      if (action === 'journal') {
        return Response.json({ success: true, journal: buildJournal(data, { year: body.year, status: body.status, type: body.type, search: body.search, page: body.page, pageSize: body.pageSize }), quality: accountingQuality(data), schemaVersion: SCHEMA_VERSION });
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
      if (!isCanonical8(code) || !/^[1-7]/.test(code)) {
        return Response.json({ error: 'La subcuenta debe tener exactamente 8 dígitos y pertenecer a los grupos 1 a 7 del PGC.' }, { status: 400 });
      }
      if (!name) return Response.json({ error: 'El nombre de la cuenta es obligatorio.' }, { status: 400 });
      const duplicate = await svc.entities.AccountingAccount.filter({ companyId, code }, '-created_date', 1);
      if (duplicate?.length) return Response.json({ error: `La cuenta ${code} ya existe.` }, { status: 409 });
      const group = code.slice(0, 1);
      const type = body.type || (
        group === '1' ? 'patrimonio'
          : ['2', '3'].includes(group) ? 'activo'
            : group === '4' ? (code.startsWith('40') || code.startsWith('41') ? 'proveedor' : code.startsWith('43') ? 'cliente' : code.startsWith('47') ? 'impuesto' : 'pasivo')
              : group === '5' ? (code.startsWith('57') ? 'banco' : 'activo')
                : group === '6' ? 'gasto' : 'ingreso'
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

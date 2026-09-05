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

    if (action === 'sync_invoices') {
      const apply = body.apply === true;
      const offset = Math.max(0, Number(body.offset) || 0);
      const batchSize = apply ? Math.min(25, Math.max(1, Number(body.batchSize) || 20)) : Math.min(500, Math.max(1, Number(body.batchSize) || 500));
      const [invoices, entries] = await Promise.all([
        fetchAll(svc.entities.Invoice, { company_id: companyId }, 'created_date', 10000),
        fetchAll(svc.entities.JournalEntry, { companyId }, 'created_date', 30000),
      ]);
      const active = (invoices || []).filter(invoice => !invoice.anulada && (!body.invoiceType || invoice.tipo === body.invoiceType));
      const entryById = new Map();
      for (const entry of entries || []) {
        entryById.set(entry.id, entry);
        if (entry.importKey) entryById.set(entry.importKey, entry);
      }
      const postingByKey = new Map((entries || []).filter(entry => entry.postingKey).map(entry => [entry.postingKey, entry]));
      const page = active.slice(offset, offset + batchSize);
      const result = { scanned: 0, alreadyLinked: 0, ready: 0, posted: 0, repairedLinks: 0, issues: [] };
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
      const invoiceById = new Map(invoices.map(invoice => [invoice.id, invoice]));
      const transactionById = new Map(transactions.map(transaction => [transaction.id, transaction]));
      const bankById = new Map(bankAccounts.map(account => [account.id, account]));
      const accountById = new Map(accounts.map(account => [account.id, account]));
      const accountByCode = new Map(accounts.map(account => [account.code, account]));
      const entryByKey = new Map();
      for (const entry of entries) { entryByKey.set(entry.id, entry); if (entry.importKey) entryByKey.set(entry.importKey, entry); }
      const page = payments.slice(offset, offset + batchSize);
      const result = { scanned: 0, alreadyLinked: 0, ready: 0, posted: 0, repairedLinks: 0, issues: [] };
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
      return Response.json({ success: true, mode: apply ? 'apply' : 'dry_run', total: payments.length, offset, nextOffset, done: nextOffset >= payments.length, result, schemaVersion: SCHEMA_VERSION });
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
      await svc.entities.JournalEntry.update(entry.id, {
        status: 'anulado',
        annulledAt: now,
        annulledBy: user.email,
        annulmentReason: reason,
        validationStatus: 'ANULADO',
      });
      for (const line of lines || []) {
        await svc.entities.JournalEntryLine.update(line.id, {
          entryStatus: 'anulado',
          validationStatus: 'ANULADO',
        });
      }
      if (entry.documentId) {
        const invoice = await svc.entities.Invoice.get(entry.documentId).catch(() => null);
        if (invoice && invoice.company_id === companyId && invoice.linked_journal_entry_id === entry.id) {
          await svc.entities.Invoice.update(invoice.id, {
            estado_contable: 'requiere_correccion',
            accounting_review_status: 'asiento_anulado',
          });
        }
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

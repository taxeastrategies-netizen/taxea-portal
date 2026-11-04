import { enabledPortalUser, portalAdmin, requirePortalCompany } from './portalAccess.generated.mjs';
import {PublicDomainError,publicServiceFailure} from './publicServiceError.mjs';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { SCHEMA_VERSION, canonical8, createJournalEntry, commitJournalEntry, assertAccountingDateOpen } from './accountingEngine.ts';
import { queuedAccountingClient } from './accountingRequestQueue.mjs';
import { assertReccAdvanceCanReverse } from './reccAdvances.mjs';

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

async function resolveLines(svc, companyId, entry) {
  let lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: entry.id }, 'lineNumber', 5000);
  if ((!lines || !lines.length) && entry.importKey) {
    lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: entry.importKey }, 'lineNumber', 5000);
  }
  return lines || [];
}

async function reverseConfirmedEntry(svc, companyId, entry, reason, userEmail, date) {
  if (entry.reversalEntryId) {
    const existing = await svc.entities.JournalEntry.get(entry.reversalEntryId).catch(() => null);
    if (existing?.companyId === companyId && existing.id !== entry.id && existing.status !== 'anulado') {
      await assertAccountingDateOpen(svc, companyId, existing.date);
      return (await commitJournalEntry(svc, companyId, existing, userEmail)).entry;
    }
  }
  const postingKey = `reversal:${entry.id}:${SCHEMA_VERSION}`;
  const duplicate = await svc.entities.JournalEntry.filter({ companyId, postingKey }, '-created_date', 1);
  const pendingOrConfirmed = (duplicate || []).find(item => item.status !== 'anulado');
  if (pendingOrConfirmed) {
    await assertAccountingDateOpen(svc, companyId, pendingOrConfirmed.date);
    const recovered = await commitJournalEntry(svc, companyId, pendingOrConfirmed, userEmail);
    await svc.entities.JournalEntry.update(entry.id, { reversalEntryId: recovered.entry.id, validationStatus: 'REVERTIDO' });
    return recovered.entry;
  }
  const lines = await resolveLines(svc, companyId, entry);
  if (lines.length < 2) throw new PublicDomainError(`El asiento ${entry.entryNumber || entry.id} no tiene líneas suficientes para revertirse.`);
  const reversed = await createJournalEntry(svc, companyId, {
    date,
    description: `Reversión ${entry.entryNumber || ''}: ${reason}`.trim(),
    type: 'ajuste',
    source: 'sistema',
    documentId: entry.documentId || '',
    postingKey,
    reversalOfEntryId: entry.id,
    status: 'confirmado',
    lines: lines.map(line => ({
      accountCode: canonical8(line.accountCode || line.subcuenta),
      accountName: line.accountName || '',
      description: `Reversión: ${line.description || entry.description || reason}`,
      debit: money(line.credit ?? line.haberE),
      credit: money(line.debit ?? line.debeE),
      taxCode: line.taxCode || '',
      counterpartyAccountId: line.counterpartyAccountId || '',
      counterpartyAccountCode: line.counterpartyAccountCode || '',
      sourceLineType: line.sourceLineType || 'ajuste',
    })),
  }, userEmail);
  const committedReversal = await commitJournalEntry(svc, companyId, reversed.entry, userEmail);
  await svc.entities.JournalEntry.update(entry.id, {
    reversalEntryId: committedReversal.entry.id,
    annulledAt: new Date().toISOString(),
    annulledBy: userEmail,
    annulmentReason: reason,
    validationStatus: 'REVERTIDO',
  });
  return committedReversal.entry;
}

const batchLimit = 4;
const emptyLock = { $in: [null, ''] };

async function acquireAnnulmentLease(svc, companyId, invoiceId, now) {
  const token = crypto.randomUUID();
  const claim = await svc.entities.Invoice.updateMany({
    id: invoiceId,
    company_id: companyId,
    anulada: { $ne: true },
    source_confirmation_lock_token: emptyLock,
    payment_lock_token: emptyLock,
    recc_application_lock_token: emptyLock,
  }, { $set: {
    source_confirmation_lock_token: token,
    source_confirmation_lock_started_at: now,
    payment_lock_token: token,
    payment_lock_started_at: now,
    payment_lock_key: 'annul:' + invoiceId,
    recc_application_lock_token: token,
    recc_application_lock_started_at: now,
    recc_application_lock_document_id: invoiceId,
  } });
  if (Number(claim?.updated) !== 1) {
    throw new PublicDomainError('La factura tiene otra operación en curso. Actualiza antes de reintentar.', 409);
  }
  return async () => {
    await svc.entities.Invoice.updateMany({
      id: invoiceId, company_id: companyId,
      source_confirmation_lock_token: token, payment_lock_token: token, recc_application_lock_token: token,
    }, { $set: {
      source_confirmation_lock_token: '', source_confirmation_lock_started_at: '',
      payment_lock_token: '', payment_lock_started_at: '', payment_lock_key: '',
      recc_application_lock_token: '', recc_application_lock_started_at: '', recc_application_lock_document_id: '',
    } });
  };
}

async function findOriginalEntry(svc, companyId, invoice) {
  if (invoice.linked_journal_entry_id) {
    const entry = await svc.entities.JournalEntry.get(invoice.linked_journal_entry_id);
    if (!entry || entry.companyId !== companyId || (entry.documentId && entry.documentId !== invoice.id)) {
      throw new PublicDomainError('El asiento original no está disponible para esta factura.', 409);
    }
    return entry;
  }
  const rows = await svc.entities.JournalEntry.filter({
    companyId, postingKey: 'invoice:' + invoice.id + ':' + SCHEMA_VERSION,
  }, 'id', 2);
  if (rows.length > 1 || (!rows.length && invoice.estado_contable === 'contabilizada')) {
    throw new PublicDomainError('No se pudo identificar un único asiento original. Revisa la factura antes de anularla.', 409);
  }
  return rows[0] || null;
}

async function annulInvoice(svc, companyId, invoice, reason, email, now, accountingDate) {
  if (invoice.anulada) return { invoiceId: invoice.id, status: 'already_annulled', timestamp: invoice.fecha_anulacion };
  const release = await acquireAnnulmentLease(svc, companyId, invoice.id, now);
  try {
    const current = await svc.entities.Invoice.get(invoice.id);
    if (current?.company_id !== companyId) throw new PublicDomainError('Factura no disponible en esta empresa.', 404);
    const payments = await svc.entities.InvoicePayment.filter({
      company_id: companyId, invoice_id: current.id,
    }, 'id', 1);
    if (payments.length || Number(current.importe_pagado) > 0) {
      throw new PublicDomainError('La factura tiene cobros o pagos registrados. Revísalos antes de anularla.', 409);
    }
    if (current.qr_mode === 'verifactu') {
      throw new PublicDomainError('La factura tiene un registro VERI*FACTU aceptado. Tramita su corrección en el circuito fiscal correspondiente.', 409);
    }
    await assertReccAdvanceCanReverse(svc, companyId, current);
    const entry = await findOriginalEntry(svc, companyId, current);
    let reversalEntryId = '';
    if (entry?.status === 'confirmado') {
      const reversal = await reverseConfirmedEntry(svc, companyId, entry, reason, email, accountingDate);
      reversalEntryId = reversal.id;
    } else if (entry) {
      const lines = await resolveLines(svc, companyId, entry);
      const activeLines = lines.filter(line => line.entryStatus !== 'anulado');
      if (activeLines.length) {
        await svc.entities.JournalEntryLine.bulkUpdate(activeLines.map(line => ({
          id: line.id, entryStatus: 'anulado', validationStatus: 'ANULADO',
        })));
      }
      if (entry.status !== 'anulado') {
        await svc.entities.JournalEntry.update(entry.id, {
          status: 'anulado', annulledAt: now, annulledBy: email,
          annulmentReason: reason, validationStatus: 'ANULADO',
        });
      }
    }
    await svc.entities.Invoice.update(current.id, {
      anulada: true,
      fecha_anulacion: now,
      motivo_anulacion: reason,
      accounting_review_status: 'asiento_anulado',
    });
    return { invoiceId: current.id, status: 'annulled', reversalEntryId, timestamp: now };
  } finally {
    await release().catch(() => console.error('[anularFacturas] No se pudo liberar la reserva'));
  }
}

function itemFailure(error) {
  if (error instanceof PublicDomainError) return error.message;
  if (/^(El ejercicio \d{4} está cerrado\.|El período está bloqueado hasta \d{4}-\d{2}-\d{2}\.|La fecha queda fuera del ejercicio contable \d{4}\.|El anticipo tiene (aplicaciones|devoluciones) activas\.)/.test(error?.message || '')) {
    return error.message;
  }
  console.error('[anularFacturas]', { status: Number(error?.response?.status || error?.status || 500) });
  return 'No se pudo confirmar la anulación. Actualiza la lista y reintenta la misma factura.';
}

Deno.serve(async req => {
  try {
    if (req.method !== 'POST') throw new PublicDomainError('Método no permitido.', 400);
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) throw new PublicDomainError('Unauthorized', 401);
    if (!enabledPortalUser(user)) throw new PublicDomainError('Acceso al portal suspendido.', 403);

    const body = await req.json().catch(() => ({}));
    const activeCompany = user.data?.company_id || user.company_id;
    const companyId = body.companyId || activeCompany;
    if (!companyId || (!portalAdmin(user) && companyId !== activeCompany)) {
      throw new PublicDomainError('La empresa indicada no coincide con la empresa activa.', 403);
    }
    const reason = typeof body.motivo === 'string' ? body.motivo.trim() : '';
    if (!reason || reason.length > 500) throw new PublicDomainError('Indica un motivo de anulación de hasta 500 caracteres.', 400);
    if (!Array.isArray(body.invoiceIds) || !body.invoiceIds.length || body.invoiceIds.some(id => typeof id !== 'string' || !/^[\w-]{1,120}$/.test(id))) {
      throw new PublicDomainError('Selecciona facturas válidas antes de anular.', 400);
    }
    const ids = [...new Set(body.invoiceIds)];
    if (ids.length > batchLimit) throw new PublicDomainError('Envía un máximo de cuatro facturas por operación.', 413);

    const svc = queuedAccountingClient(base44.asServiceRole, { intervalMs: 150 });
    await requirePortalCompany(svc, user, companyId);
    const now = new Date().toISOString();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Atlantic/Canary', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
    const accountingDate = body.accountingDate || today;
    if (typeof accountingDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(accountingDate)
      || Number.isNaN(Date.parse(accountingDate)) || new Date(accountingDate).toISOString().slice(0, 10) !== accountingDate) {
      throw new PublicDomainError('La fecha contable no es válida.', 400);
    }
    const rows = await svc.entities.Invoice.filter({ company_id: companyId, id: { $in: ids } }, 'id', ids.length);
    const targets = new Map(rows.filter(row => row.company_id === companyId).map(row => [row.id, row]));
    const results = [];
    for (const id of ids) {
      try {
        const invoice = targets.get(id);
        if (!invoice) throw new PublicDomainError('Factura no disponible en esta empresa.', 404);
        results.push(await annulInvoice(svc, companyId, invoice, reason, user.email, now, accountingDate));
      } catch (error) {
        results.push({ invoiceId: id, status: 'failed', error: itemFailure(error) });
      }
    }

    const annulledIds = results.filter(item => item.status !== 'failed').map(item => item.invoiceId);
    return Response.json({
      success: annulledIds.length === ids.length,
      annulled: results.filter(item => item.status === 'annulled').length,
      annulledIds, results, timestamp: now,
    });
  } catch (error) {
    if (error?.portalPublic === true) return publicServiceFailure(new PublicDomainError(error.message, 403), 'anularFacturas');
    return publicServiceFailure(error, 'anularFacturas');
  }
});

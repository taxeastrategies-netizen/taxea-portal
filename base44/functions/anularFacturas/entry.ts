import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { SCHEMA_VERSION, canonical8, createJournalEntry } from '../accountingOperations/accountingEngine.ts';

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
    if (existing) return existing;
  }
  const postingKey = `reversal:${entry.id}:${SCHEMA_VERSION}`;
  const duplicate = await svc.entities.JournalEntry.filter({ companyId, postingKey }, '-created_date', 1);
  if (duplicate?.[0]) {
    await svc.entities.JournalEntry.update(entry.id, { reversalEntryId: duplicate[0].id, validationStatus: 'REVERTIDO' });
    return duplicate[0];
  }
  const lines = await resolveLines(svc, companyId, entry);
  if (lines.length < 2) throw new Error(`El asiento ${entry.entryNumber || entry.id} no tiene líneas suficientes para revertirse.`);
  const reversed = await createJournalEntry(svc, companyId, {
    date,
    description: `Reversión ${entry.entryNumber || ''}: ${reason}`.trim(),
    type: 'ajuste',
    source: 'sistema',
    documentId: entry.documentId || '',
    postingKey,
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
  await svc.entities.JournalEntry.update(entry.id, {
    reversalEntryId: reversed.entry.id,
    annulledAt: new Date().toISOString(),
    annulledBy: userEmail,
    annulmentReason: reason,
    validationStatus: 'REVERTIDO',
  });
  return reversed.entry;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userCompanyId = user.data?.company_id;
    if (!userCompanyId) return Response.json({ error: 'Selecciona una empresa antes de anular facturas.' }, { status: 403 });

    const body = await req.json();
    const { invoiceIds, motivo, companyId } = body || {};
    if (companyId && companyId !== userCompanyId) return Response.json({ error: 'La empresa indicada no coincide con la empresa activa.' }, { status: 403 });
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) return Response.json({ error: 'invoiceIds required' }, { status: 400 });

    const reason = String(motivo || '').trim();
    if (!reason) return Response.json({ error: 'El motivo de anulación es obligatorio.' }, { status: 400 });
    const svc = base44.asServiceRole;
    const now = new Date().toISOString();
    const accountingDate = String(body.accountingDate || now.slice(0, 10));
    const allInvoices = await svc.entities.Invoice.filter({ company_id: userCompanyId }, 'created_date', 5000);
    const targets = (allInvoices || []).filter(invoice => invoiceIds.includes(invoice.id) && !invoice.anulada);
    if (!targets.length) return Response.json({ success: true, annulled: 0, message: 'No invoices to annul' });

    const results = [];
    for (const invoice of targets) {
      let reversalEntryId = '';
      if (invoice.linked_journal_entry_id) {
        const entry = await svc.entities.JournalEntry.get(invoice.linked_journal_entry_id).catch(() => null);
        if (entry && entry.companyId === userCompanyId) {
          if (entry.status === 'confirmado') {
            const reversal = await reverseConfirmedEntry(svc, userCompanyId, entry, reason, user.email, accountingDate);
            reversalEntryId = reversal.id;
          } else if (entry.status !== 'anulado') {
            const lines = await resolveLines(svc, userCompanyId, entry);
            await svc.entities.JournalEntry.update(entry.id, {
              status: 'anulado', annulledAt: now, annulledBy: user.email,
              annulmentReason: reason, validationStatus: 'ANULADO',
            });
            for (const line of lines) await svc.entities.JournalEntryLine.update(line.id, { entryStatus: 'anulado', validationStatus: 'ANULADO' });
          }
        }
      }
      await svc.entities.Invoice.update(invoice.id, {
        anulada: true,
        fecha_anulacion: now,
        motivo_anulacion: reason,
        accounting_review_status: 'asiento_anulado',
      });
      results.push({ invoiceId: invoice.id, reversalEntryId });
    }

    return Response.json({ success: true, annulled: results.length, annulledIds: results.map(item => item.invoiceId), results, timestamp: now });
  } catch (error) {
    console.error('anularFacturas error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});


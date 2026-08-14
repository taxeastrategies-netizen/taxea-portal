import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import {
  SCHEMA_VERSION,
  buildInvoicePosting,
  canonical8,
  createJournalEntry,
  isCanonical8,
  postInvoice,
  seedOperationalPgc,
} from './accountingEngine.ts';

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

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

    if (action === 'seed_pgc') {
      const result = await seedOperationalPgc(svc, companyId);
      return Response.json({ success: true, schemaVersion: SCHEMA_VERSION, ...result });
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
      const lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: entry.id });
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

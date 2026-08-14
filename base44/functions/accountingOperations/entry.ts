import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const getYear = (date) => {
  const year = new Date(date).getFullYear();
  return Number.isFinite(year) ? year : new Date().getFullYear();
};

function checkLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) return 'Se necesitan al menos dos líneas.';
  for (const line of lines) {
    if (!String(line.accountCode || '').trim()) return 'Todas las líneas necesitan cuenta contable.';
    const debit = money(line.debit);
    const credit = money(line.credit);
    if (debit < 0 || credit < 0) return 'Debe y Haber no pueden ser negativos.';
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      return 'Cada línea debe tener importe solo en Debe o solo en Haber.';
    }
  }
  const totalDebit = money(lines.reduce((sum, line) => sum + money(line.debit), 0));
  const totalCredit = money(lines.reduce((sum, line) => sum + money(line.credit), 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) return 'El asiento no cuadra.';
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const companyId = body.companyId || user.data?.company_id;
    if (!companyId || user.data?.company_id !== companyId) {
      return Response.json({ error: 'Selecciona la empresa antes de operar en contabilidad.' }, { status: 403 });
    }

    if (action === 'create_manual') {
      const { date, description, type = 'manual', status = 'borrador', lines = [] } = body;
      if (!date || !String(description || '').trim()) {
        return Response.json({ error: 'Fecha y descripción son obligatorias.' }, { status: 400 });
      }
      const validationError = checkLines(lines);
      if (validationError) return Response.json({ error: validationError }, { status: 400 });

      const totalDebit = money(lines.reduce((sum, line) => sum + money(line.debit), 0));
      const totalCredit = money(lines.reduce((sum, line) => sum + money(line.credit), 0));
      const ejercicio = getYear(date);
      const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
      const entryNumber = `A-${ejercicio}-${Date.now().toString(36).toUpperCase()}-${suffix}`;

      const entry = await base44.asServiceRole.entities.JournalEntry.create({
        companyId, entryNumber, date, ejercicio, type,
        description: String(description).trim(), source: 'manual', status,
        totalDebit, totalCredit, isBalanced: true,
        confirmedBy: status === 'confirmado' ? user.email : '',
        confirmedAt: status === 'confirmado' ? new Date().toISOString() : null,
        validationStatus: status === 'confirmado' ? 'CONFIRMADO' : 'BORRADOR_PENDIENTE_REVISION',
      });

      try {
        await Promise.all(lines.map((line, index) =>
          base44.asServiceRole.entities.JournalEntryLine.create({
            journalEntryId: entry.id,
            companyId,
            lineNumber: index + 1,
            accountCode: String(line.accountCode).trim(),
            accountName: line.accountName || '',
            description: line.description || description,
            debit: money(line.debit),
            credit: money(line.credit),
            entryStatus: status,
            entryDate: date,
            ejercicio,
            validationStatus: status === 'confirmado' ? 'CONFIRMADO' : 'BORRADOR_PENDIENTE_REVISION',
          })
        ));
      } catch (lineError) {
        await base44.asServiceRole.entities.JournalEntry.update(entry.id, {
          status: 'pendiente_revision',
          validationStatus: 'ERROR_CREACION_LINEAS',
          notes: `Error creando líneas: ${lineError.message}`,
        });
        throw lineError;
      }
      return Response.json({ success: true, entryId: entry.id, entryNumber });
    }

    if (action === 'confirm' || action === 'annul') {
      const entry = await base44.asServiceRole.entities.JournalEntry.get(body.entryId);
      if (!entry || entry.companyId !== companyId) {
        return Response.json({ error: 'Asiento no encontrado en la empresa seleccionada.' }, { status: 404 });
      }
      const lines = await base44.asServiceRole.entities.JournalEntryLine.filter({
        companyId,
        journalEntryId: entry.id,
      });

      if (action === 'confirm') {
        const validationError = checkLines(lines);
        if (validationError) return Response.json({ error: validationError }, { status: 400 });
        const now = new Date().toISOString();
        await base44.asServiceRole.entities.JournalEntry.update(entry.id, {
          status: 'confirmado',
          confirmedAt: now,
          confirmedBy: user.email,
          isBalanced: true,
          validationStatus: 'CONFIRMADO',
          ejercicio: entry.ejercicio || getYear(entry.date),
        });
        await Promise.all(lines.map(line => base44.asServiceRole.entities.JournalEntryLine.update(line.id, {
          entryStatus: 'confirmado',
          entryDate: line.entryDate || entry.date,
          ejercicio: line.ejercicio || entry.ejercicio || getYear(entry.date),
          validationStatus: 'CONFIRMADO',
        })));
        return Response.json({ success: true });
      }

      const reason = String(body.reason || '').trim();
      if (!reason) return Response.json({ error: 'El motivo de anulación es obligatorio.' }, { status: 400 });
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.JournalEntry.update(entry.id, {
        status: 'anulado',
        annulledAt: now,
        annulledBy: user.email,
        annulmentReason: reason,
        validationStatus: 'ANULADO',
      });
      await Promise.all(lines.map(line => base44.asServiceRole.entities.JournalEntryLine.update(line.id, {
        entryStatus: 'anulado',
        validationStatus: 'ANULADO',
      })));
      return Response.json({ success: true });
    }

    if (action === 'post_invoice') {
      const invoice = await base44.asServiceRole.entities.Invoice.get(body.invoiceId);
      if (!invoice || invoice.company_id !== companyId) {
        return Response.json({ error: 'Factura no encontrada en la empresa seleccionada.' }, { status: 404 });
      }
      if (invoice.anulada) return Response.json({ error: 'No se puede contabilizar una factura anulada.' }, { status: 409 });
      if (invoice.linked_journal_entry_id) {
        return Response.json({ success: true, alreadyPosted: true, entryId: invoice.linked_journal_entry_id });
      }

      const date = body.date || invoice.fecha_emision;
      const description = String(body.description || invoice.concepto || `Factura ${invoice.numero_factura}`).trim();
      const proposedLines = Array.isArray(body.lines) ? body.lines : [];
      const lines = proposedLines.map(line => ({
        accountCode: line.accountCode || line.cuenta,
        accountName: line.accountName || line.nombre || '',
        description: line.description || description,
        debit: money(line.debit ?? line.debe),
        credit: money(line.credit ?? line.haber),
      }));
      const validationError = checkLines(lines);
      if (validationError) return Response.json({ error: validationError }, { status: 400 });

      const totalDebit = money(lines.reduce((sum, line) => sum + line.debit, 0));
      const totalCredit = money(lines.reduce((sum, line) => sum + line.credit, 0));
      const ejercicio = getYear(date);
      const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
      const entryNumber = `F-${ejercicio}-${Date.now().toString(36).toUpperCase()}-${suffix}`;
      const source = invoice.tipo === 'emitida' ? 'factura_emitida' : 'factura_recibida';

      const entry = await base44.asServiceRole.entities.JournalEntry.create({
        companyId, entryNumber, date, ejercicio,
        type: invoice.tipo === 'emitida' ? 'ingreso' : 'gasto',
        description, documentId: invoice.id, source,
        status: 'confirmado', totalDebit, totalCredit, isBalanced: true,
        confirmedAt: new Date().toISOString(), confirmedBy: user.email,
        validationStatus: 'CONFIRMADO',
      });

      try {
        await Promise.all(lines.map((line, index) =>
          base44.asServiceRole.entities.JournalEntryLine.create({
            journalEntryId: entry.id,
            companyId,
            lineNumber: index + 1,
            accountCode: line.accountCode,
            accountName: line.accountName,
            description: line.description,
            debit: line.debit,
            credit: line.credit,
            documentId: invoice.id,
            entryStatus: 'confirmado',
            entryDate: date,
            ejercicio,
            validationStatus: 'CONFIRMADO',
          })
        ));
        await base44.asServiceRole.entities.Invoice.update(invoice.id, {
          estado_contable: 'contabilizada',
          linked_journal_entry_id: entry.id,
          fecha_contabilizacion: new Date().toISOString(),
          confirmado_por: user.email,
        });
      } catch (postError) {
        await base44.asServiceRole.entities.JournalEntry.update(entry.id, {
          status: 'pendiente_revision',
          validationStatus: 'ERROR_CONTABILIZACION_FACTURA',
          notes: `Error finalizando factura: ${postError.message}`,
        });
        throw postError;
      }

      return Response.json({ success: true, entryId: entry.id, entryNumber });
    }

    return Response.json({ error: 'Acción no válida.' }, { status: 400 });
  } catch (error) {
    console.error('[accountingOperations]', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
});

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userCompanyId = user.data?.company_id;
    if (!userCompanyId) {
      return Response.json({ error: 'Selecciona una empresa antes de anular facturas.' }, { status: 403 });
    }

    const body = await req.json();
    const { invoiceIds, motivo, companyId } = body || {};
    if (companyId && companyId !== userCompanyId) {
      return Response.json({ error: 'La empresa indicada no coincide con la empresa activa.' }, { status: 403 });
    }
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return Response.json({ error: 'invoiceIds required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const motivoFinal = motivo || 'Anulación directa';

    // Fetch invoices to get linked journal entries (service role bypasses RLS)
    const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 5000);
    const targets = allInvoices.filter(i => invoiceIds.includes(i.id) && !i.anulada);

    const foreign = targets.filter(t => t.company_id !== userCompanyId);
    if (foreign.length > 0) {
      return Response.json({ error: 'No se pueden anular facturas de otra empresa.' }, { status: 403 });
    }

    if (targets.length === 0) {
      return Response.json({ success: true, annulled: 0, message: 'No invoices to annul' });
    }

    // Bulk update invoices
    await base44.asServiceRole.entities.Invoice.bulkUpdate(
      targets.map(t => ({
        id: t.id,
        anulada: true,
        fecha_anulacion: now,
        motivo_anulacion: motivoFinal,
      }))
    );

    // Annul linked journal entries in parallel
    const journalIds = targets
      .map(t => t.linked_journal_entry_id)
      .filter(Boolean);

    if (journalIds.length > 0) {
      await base44.asServiceRole.entities.JournalEntry.bulkUpdate(
        journalIds.map(id => ({
          id,
          status: 'anulado',
          annulledAt: now,
          annulledBy: user.email,
          annulmentReason: motivoFinal,
          validationStatus: 'ANULADO',
        }))
      );

      for (const journalEntryId of journalIds) {
        const entryLines = await base44.asServiceRole.entities.JournalEntryLine.filter({
          companyId: userCompanyId,
          journalEntryId,
        });
        await Promise.all(entryLines.map(line =>
          base44.asServiceRole.entities.JournalEntryLine.update(line.id, {
            entryStatus: 'anulado',
            validationStatus: 'ANULADO',
          })
        ));
      }
    }

    return Response.json({
      success: true,
      annulled: targets.length,
      annulledIds: targets.map(t => t.id),
      timestamp: now,
    });
  } catch (error) {
    console.error('anularFacturas error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
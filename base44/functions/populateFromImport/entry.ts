import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { companyId } = await req.json().catch(() => ({}));
    if (!companyId) return Response.json({ error: 'companyId required' }, { status: 400 });

    const BATCH_SIZE = 400;
    const results = { invoices: { created: 0, errors: 0, skipped: 0 }, expenses: { created: 0, errors: 0, skipped: 0 } };

    // Fetch all journal entries across all exercises
    let allEntries = [];
    let hasMore = true;
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.JournalEntry.filter(
        { companyId, source: 'importacion' },
        '-created_date',
        500,
        allEntries.length
      );
      allEntries = allEntries.concat(batch || []);
      hasMore = (batch || []).length === 500;
    }

    // Parse descriptions to extract invoice data
    // Patterns:
    //   "S/ FAC. Nº XXX. SUPPLIER NAME" → recibida (expense)
    //   "N/ FAC. Nº XXX. CLIENT NAME" → emitida (income)
    //   "NAME FRA:XXX" → emitida (income)
    const invoicesToCreate = [];
    const expensesToCreate = [];

    const parseTrimestre = (month) => {
      if (month <= 3) return 'T1';
      if (month <= 6) return 'T2';
      if (month <= 9) return 'T3';
      return 'T4';
    };

    for (const entry of allEntries) {
      const desc = (entry.description || '').trim();
      if (!desc) continue;
      const total = Math.abs(entry.totalDebit || entry.totalCredit || 0);
      if (total === 0) continue;

      const date = entry.date;
      if (!date) continue;
      const dateObj = new Date(date);
      const month = dateObj.getMonth() + 1;
      const year = dateObj.getFullYear();
      const trimestre = parseTrimestre(month);

      let invoiceNumber = null;
      let name = null;
      let tipo = null;

      // S/ FAC. Nº XXX. NAME → recibida
      let m = desc.match(/^S\/\s*FAC\.?\s*N[ºo.]?\s*([^.\n]+)\.?\s*(.*)$/i);
      if (m) {
        invoiceNumber = m[1].trim();
        name = m[2].trim();
        tipo = 'recibida';
      }

      // N/ FAC. Nº XXX. NAME → emitida
      if (!invoiceNumber) {
        m = desc.match(/^N\/\s*FAC\.?\s*N[ºo.]?\s*([^.\n]+)\.?\s*(.*)$/i);
        if (m) {
          invoiceNumber = m[1].trim();
          name = m[2].trim();
          tipo = 'emitida';
        }
      }

      // FRA:XXX or FRA XXX → could be either, default to emitida if starts with name
      if (!invoiceNumber) {
        m = desc.match(/FRA[:\s]*([^\s]+)/i);
        if (m) {
          invoiceNumber = m[1].trim();
          name = desc.replace(/FRA[:\s]*[^\s]+/i, '').trim() || desc;
          tipo = 'emitida';
        }
      }

      // S/ FAC. without Nº
      if (!invoiceNumber) {
        m = desc.match(/^S\/\s*FAC\.?\s*([^.\n]+)\.?\s*(.*)$/i);
        if (m) {
          invoiceNumber = m[1].trim();
          name = m[2].trim();
          tipo = 'recibida';
        }
      }

      if (!invoiceNumber || !tipo) {
        results.invoices.skipped++;
        continue;
      }

      // Clean up name
      if (name) {
        name = name.replace(/^\.?\s*/, '').trim();
        if (name.length < 2) name = null;
      }

      const importKey = entry.importKey || `${year}|${invoiceNumber}|${date}`;

      if (tipo === 'emitida') {
        invoicesToCreate.push({
          company_id: companyId,
          numero_factura: invoiceNumber,
          fecha_emision: date,
          fecha_operacion: date,
          base_imponible: total,
          tipo_iva: 0,
          cuota_iva: 0,
          total_factura: total,
          tipo: 'emitida',
          cliente_nombre: name || 'CLIENTE',
          trimestre,
          anio: year,
          estado_cobro: 'cobrada',
          estado_contable: 'contabilizada',
          origin: 'importacion',
          linked_journal_entry_id: entry.id,
          comentarios: `Importado del diario - Asiento ${entry.entryNumber}`,
          moneda: 'EUR',
        });
      } else {
        invoicesToCreate.push({
          company_id: companyId,
          numero_factura: invoiceNumber,
          fecha_emision: date,
          fecha_operacion: date,
          base_imponible: total,
          tipo_iva: 0,
          cuota_iva: 0,
          total_factura: total,
          tipo: 'recibida',
          proveedor_nombre: name || 'PROVEEDOR',
          trimestre,
          anio: year,
          estado_cobro: 'cobrada',
          estado_contable: 'contabilizada',
          origin: 'importacion',
          linked_journal_entry_id: entry.id,
          comentarios: `Importado del diario - Asiento ${entry.entryNumber}`,
          moneda: 'EUR',
        });

        // Also create Expense record for Ingresos/Gastos
        expensesToCreate.push({
          company_id: companyId,
          tipo: 'gasto',
          fecha: date,
          proveedor_cliente: name || 'PROVEEDOR',
          concepto: desc.substring(0, 200),
          categoria: 'otros',
          base_imponible: total,
          tipo_impuesto: 0,
          cuota_impuesto: 0,
          total: total,
          trimestre,
          anio: year,
          estado: 'contabilizado',
        });
      }
    }

    // Bulk create invoices in batches
    for (let i = 0; i < invoicesToCreate.length; i += BATCH_SIZE) {
      const batch = invoicesToCreate.slice(i, i + BATCH_SIZE);
      try {
        await base44.asServiceRole.entities.Invoice.bulkCreate(batch);
        results.invoices.created += batch.length;
      } catch (e) {
        console.error('Invoice batch error:', e.message);
        results.invoices.errors += batch.length;
      }
    }

    // Bulk create expenses in batches
    for (let i = 0; i < expensesToCreate.length; i += BATCH_SIZE) {
      const batch = expensesToCreate.slice(i, i + BATCH_SIZE);
      try {
        await base44.asServiceRole.entities.Expense.bulkCreate(batch);
        results.expenses.created += batch.length;
      } catch (e) {
        console.error('Expense batch error:', e.message);
        results.expenses.errors += batch.length;
      }
    }

    return Response.json({
      status: 'ok',
      totalEntries: allEntries.length,
      results,
    });
  } catch (error) {
    console.error('populateFromImport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
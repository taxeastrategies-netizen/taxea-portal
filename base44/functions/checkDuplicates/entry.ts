import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { company_id, scope, period_type, year, period_value } = body;

    if (!company_id || !scope) {
      return Response.json({ error: 'company_id and scope are required' }, { status: 400 });
    }

    // scope: 'ocr_expense' | 'ocr_income' | 'invoices_emitida' | 'invoices_recibida'
    const periodType = period_type || 'all'; // 'month' | 'quarter' | 'all'
    const filterYear = year ? parseInt(year) : null;
    const periodValue = period_value || null; // '1'-'12' for month, 'T1'-'T4' for quarter

    // Helper: normalize strings for comparison
    const normalize = (s) => (s || '').toString().trim().toUpperCase().replace(/[\s\-_./]/g, '').replace(/^0+/, '');
    const parseAmount = (v) => {
      if (v == null) return null;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
      return isNaN(n) ? null : Math.round(n * 100) / 100;
    };

    // Helper: get quarter from date
    const getQuarter = (dateStr) => {
      if (!dateStr) return null;
      const m = new Date(dateStr).getMonth() + 1;
      if (isNaN(m)) return null;
      return m <= 3 ? 'T1' : m <= 6 ? 'T2' : m <= 9 ? 'T3' : 'T4';
    };

    const getMonth = (dateStr) => {
      if (!dateStr) return null;
      const m = new Date(dateStr).getMonth() + 1;
      return isNaN(m) ? null : m;
    };

    const getYear = (dateStr) => {
      if (!dateStr) return null;
      const y = new Date(dateStr).getFullYear();
      return isNaN(y) ? null : y;
    };

    // Helper: check if record matches period filter
    const matchesPeriod = (dateStr) => {
      if (periodType === 'all') return true;
      const recYear = getYear(dateStr);
      if (filterYear && recYear !== filterYear) return false;
      if (periodType === 'month' && periodValue) {
        return getMonth(dateStr) === parseInt(periodValue);
      }
      if (periodType === 'quarter' && periodValue) {
        return getQuarter(dateStr) === periodValue;
      }
      return true;
    };

    // Helper: parse OCR extracted data
    const parseExtracted = (raw) => {
      if (!raw) return null;
      if (typeof raw === 'object') return raw;
      try { return JSON.parse(raw); } catch { return null; }
    };

    // Fetch all records with pagination
    const fetchAll = async (entityName, filter) => {
      let all = [];
      let skip = 0;
      while (true) {
        const batch = await base44.asServiceRole.entities[entityName].filter(filter, '-created_date', 200, skip);
        all = all.concat(batch);
        if (batch.length < 200) break;
        skip += 200;
      }
      return all;
    };

    let records = [];

    if (scope === 'ocr_expense' || scope === 'ocr_income') {
      const docType = scope === 'ocr_expense' ? 'expense_invoice' : 'income_invoice';
      const docs = await fetchAll('OcrInvoiceDocument', { company_id, documentType: docType });

      for (const doc of docs) {
        const extracted = parseExtracted(doc.extractedData);
        const dateStr = extracted?.fecha || extracted?.fecha_emision || '';
        if (!matchesPeriod(dateStr)) continue;

        const numero = extracted?.numero_factura || extracted?.numero || '';
        const proveedor = extracted?.proveedor || extracted?.proveedor_nombre || '';
        const cliente = extracted?.cliente_nombre || '';
        const total = parseAmount(extracted?.total || extracted?.total_factura);
        const base = parseAmount(extracted?.base_imponible);

        records.push({
          id: doc.id,
          entityType: 'OcrInvoiceDocument',
          numero: numero,
          fecha: dateStr,
          proveedor_cliente: proveedor || cliente,
          total: total,
          base: base,
          status: doc.status,
          linkedInvoiceId: doc.linkedInvoiceId,
          originalFileName: doc.originalFileName,
          source: 'ocr'
        });
      }
    } else if (scope === 'invoices_emitida' || scope === 'invoices_recibida') {
      const tipo = scope === 'invoices_emitida' ? 'emitida' : 'recibida';
      const invoices = await fetchAll('Invoice', { company_id, tipo });

      for (const inv of invoices) {
        if (inv.anulada) continue; // skip annulled
        if (!matchesPeriod(inv.fecha_emision)) continue;

        const proveedor = inv.proveedor_nombre || '';
        const cliente = inv.cliente_nombre || '';
        const total = parseAmount(inv.total_factura);
        const base = parseAmount(inv.base_imponible);

        records.push({
          id: inv.id,
          entityType: 'Invoice',
          numero: inv.numero_factura || '',
          fecha: inv.fecha_emision || '',
          proveedor_cliente: tipo === 'emitida' ? cliente : proveedor,
          total: total,
          base: base,
          status: inv.estado_contable,
          linkedInvoiceId: null,
          originalFileName: null,
          source: 'invoice'
        });
      }
    }

    // Build fingerprint groups
    // Group 1: by normalized invoice number + normalized provider/client
    // Group 2: by date + total amount + provider/client (for records without invoice number)
    const groupsByKey = {};

    for (const rec of records) {
      const numNorm = normalize(rec.numero);
      const provNorm = normalize(rec.proveedor_cliente);

      let groupKey = null;
      let reason = '';

      if (numNorm && provNorm) {
        groupKey = `num:${numNorm}|prov:${provNorm}`;
        reason = 'Mismo numero de factura y proveedor/cliente';
      } else if (numNorm) {
        groupKey = `num:${numNorm}`;
        reason = 'Mismo numero de factura';
      }

      // If no invoice number, try date + amount + provider
      if (!groupKey && rec.fecha && rec.total != null && provNorm) {
        groupKey = `date:${rec.fecha}|amt:${rec.total}|prov:${provNorm}`;
        reason = 'Misma fecha, importe y proveedor/cliente (sin numero de factura)';
      }

      if (!groupKey) continue;

      if (!groupsByKey[groupKey]) groupsByKey[groupKey] = { key: groupKey, reason, items: [] };
      groupsByKey[groupKey].items.push(rec);
    }

    // Filter to only groups with duplicates
    const duplicateGroups = [];
    for (const group of Object.values(groupsByKey)) {
      if (group.items.length < 2) continue;

      // Sort items: keep the one that is accounted/contabilizada or oldest, delete the rest
      const sorted = [...group.items].sort((a, b) => {
        // Prioritize keeping: accounted > validated > review_required > pending
        const statusPriority = (s) => {
          if (s === 'accounted' || s === 'contabilizada') return 0;
          if (s === 'validated' || s === 'revisada') return 1;
          if (s === 'review_required' || s === 'en_revision') return 2;
          if (s === 'pending' || s === 'pendiente') return 3;
          return 4;
        };
        return statusPriority(a.status) - statusPriority(b.status);
      });

      const keep = sorted[0];
      const toDelete = sorted.slice(1);

      duplicateGroups.push({
        groupKey: group.key,
        reason: group.reason,
        keep: {
          id: keep.id,
          entityType: keep.entityType,
          numero: keep.numero,
          fecha: keep.fecha,
          proveedor_cliente: keep.proveedor_cliente,
          total: keep.total,
          status: keep.status,
          originalFileName: keep.originalFileName
        },
        toDelete: toDelete.map(r => ({
          id: r.id,
          entityType: r.entityType,
          numero: r.numero,
          fecha: r.fecha,
          proveedor_cliente: r.proveedor_cliente,
          total: r.total,
          status: r.status,
          originalFileName: r.originalFileName
        })),
        allItems: sorted.map(r => ({
          id: r.id,
          entityType: r.entityType,
          numero: r.numero,
          fecha: r.fecha,
          proveedor_cliente: r.proveedor_cliente,
          total: r.total,
          status: r.status,
          originalFileName: r.originalFileName,
          action: r.id === keep.id ? 'keep' : 'delete'
        }))
      });
    }

    const totalToDelete = duplicateGroups.reduce((sum, g) => sum + g.toDelete.length, 0);

    return Response.json({
      success: true,
      scope,
      period: { type: periodType, year: filterYear, value: periodValue },
      totalRecordsAnalyzed: records.length,
      duplicateGroupsCount: duplicateGroups.length,
      totalToDelete,
      duplicateGroups
    });
  } catch (error) {
    console.error('checkDuplicates error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { normalizedDate, normalizedNumber, normalizedName, normalizedTaxId, sameInvoiceIdentity } from './duplicateIdentity.mjs';

const parseSource = raw => {
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
};
const money = value => value == null || value === '' ? null : Number(value);
const excludedOcr = new Set(['rejected', 'rechazada', 'cancelled_by_client', 'cancelled', 'eliminado']);
const priority = record => record.entityType === 'Invoice' ? 0
  : record.status === 'accounted' ? 1 : record.status === 'validated' ? 2 : 3;

Deno.serve(async req => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.is_deleted === true || ['bloqueado', 'suspendido', 'eliminado'].includes(user.status))
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const companyId = body.company_id;
    const scope = body.scope;
    const allowedScopes = new Set(['ocr_expense', 'ocr_income', 'invoices_emitida', 'invoices_recibida']);
    if (!companyId || !allowedScopes.has(scope))
      return Response.json({ error: 'Empresa y alcance válidos son obligatorios.' }, { status: 400 });
    const company = await base44.asServiceRole.entities.Company.get(companyId);
    if (!company) return Response.json({ error: 'Empresa no encontrada' }, { status: 404 });
    const admin = ['admin', 'super_admin'].includes(user.role);
    const email = String(user.email || '').trim().toLowerCase();
    const members = Array.isArray(company.usuarios_autorizados) ? company.usuarios_autorizados : [];
    if (!admin && (!email || (String(company.owner_email || '').trim().toLowerCase() !== email
      && !members.some(member => String(member).trim().toLowerCase() === email))))
      return Response.json({ error: 'Forbidden' }, { status: 403 });

    const direction = scope === 'ocr_income' || scope === 'invoices_emitida' ? 'emitida' : 'recibida';
    const docType = direction === 'emitida' ? 'income_invoice' : 'expense_invoice';
    const periodType = body.period_type || 'all';
    const periodValue = body.period_value || null;
    const filterYear = body.year ? Number(body.year) : null;
    if (!['all', 'quarter', 'month'].includes(periodType)
      || (periodType !== 'all' && (!Number.isInteger(filterYear) || !periodValue)))
      return Response.json({ error: 'Periodo no válido.' }, { status: 400 });

    const fetchAll = async (name, filter) => {
      const result = [];
      for (let skip = 0; ; skip += 200) {
        const batch = await base44.asServiceRole.entities[name].filter(filter, '-created_date', 200, skip);
        result.push(...batch);
        if (batch.length < 200) return result;
      }
    };
    const single = body.action === 'check_one';
    if (single && !body.docId) return Response.json({ error: 'docId es obligatorio.' }, { status: 400 });
    const target = single ? await base44.asServiceRole.entities.OcrInvoiceDocument.get(body.docId) : null;
    if (single && (!target || target.company_id !== companyId || target.documentType !== docType))
      return Response.json({ error: 'Documento OCR no encontrado en esta empresa.' }, { status: 404 });
    const targetSource = parseSource(target?.extractedData);
    const targetNumber = normalizedNumber(targetSource.numero_factura || targetSource.numero);
    const targetDate = normalizedDate(direction === 'emitida' ? targetSource.fecha_emision || targetSource.fecha
      : targetSource.fecha || targetSource.fecha_emision);
    if (single && (!targetNumber || !targetDate)) return Response.json({
      success: true, scope, period: { type: periodType, year: filterYear, value: periodValue },
      totalRecordsAnalyzed: 1, incompleteRecordsCount: 1, duplicateGroupsCount: 0,
      totalToDelete: 0, duplicateGroups: [], message: 'Falta número o fecha para comparar el documento.' });
    const [invoices, allDocs] = await Promise.all([
      fetchAll('Invoice', single ? { company_id: companyId, tipo: direction, fecha_emision: targetDate }
        : { company_id: companyId, tipo: direction }),
      fetchAll('OcrInvoiceDocument', { company_id: companyId, documentType: docType }),
    ]);
    const docs = single ? allDocs.filter(doc => {
      const source = parseSource(doc.extractedData);
      return normalizedNumber(source.numero_factura || source.numero) === targetNumber
        && normalizedDate(direction === 'emitida' ? source.fecha_emision || source.fecha
          : source.fecha || source.fecha_emision) === targetDate;
    }) : allDocs;
    const activeInvoices = invoices.filter(invoice => !invoice.anulada);
    const invoiceIds = new Set(invoices.map(invoice => invoice.id));
    const records = [
      ...activeInvoices.map(invoice => ({
        id: invoice.id, entityType: 'Invoice', source: 'invoice', companyId, direction,
        number: invoice.numero_factura, date: invoice.fecha_emision,
        taxId: direction === 'emitida' ? invoice.cliente_nif : invoice.proveedor_nif,
        name: direction === 'emitida' ? invoice.cliente_nombre : invoice.proveedor_nombre,
        total: money(invoice.total_factura), status: invoice.estado_contable || 'registrada',
        originalFileName: null, linkedInvoiceId: null,
      })),
      ...docs.filter(doc => !excludedOcr.has(doc.status) && (!doc.linkedInvoiceId || !invoiceIds.has(doc.linkedInvoiceId)))
        .map(doc => {
          const source = parseSource(doc.extractedData);
          return {
            id: doc.id, entityType: 'OcrInvoiceDocument', source: 'ocr', companyId, direction,
            number: source.numero_factura || source.numero,
            date: direction === 'emitida' ? source.fecha_emision || source.fecha : source.fecha || source.fecha_emision,
            taxId: direction === 'emitida' ? source.cliente_nif || source.nif_cliente : source.nif_proveedor,
            name: direction === 'emitida' ? source.cliente_nombre || source.cliente : source.proveedor || source.proveedor_nombre,
            total: money(source.total_factura ?? source.total),
            status: doc.status, originalFileName: doc.originalFileName, linkedInvoiceId: doc.linkedInvoiceId || null,
          };
        }),
    ];
    const matchesPeriod = record => {
      if (periodType === 'all') return true;
      const date = normalizedDate(record.date);
      if (!date || Number(date.slice(0, 4)) !== filterYear) return false;
      const month = Number(date.slice(5, 7));
      return periodType === 'month' ? month === Number(periodValue)
        : `T${Math.ceil(month / 3)}` === periodValue;
    };
    const filtered = records.filter(matchesPeriod);
    const incompleteRecordsCount = filtered.filter(record => !normalizedNumber(record.number)
      || !normalizedDate(record.date) || !(normalizedTaxId(record.taxId) || normalizedName(record.name))).length;
    const buckets = new Map();
    for (const record of filtered) {
      const number = normalizedNumber(record.number);
      const date = normalizedDate(record.date);
      if (!number || !date) continue; // Never infer a duplicate from an amount alone.
      const key = JSON.stringify([number, date]);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(record);
    }
    const pairs = [];
    for (const rows of buckets.values()) {
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          if (!sameInvoiceIdentity(rows[i], rows[j])) continue;
          const [keep, candidate] = [rows[i], rows[j]].sort((left, right) => priority(left) - priority(right));
          const view = record => ({
            id: record.id, entityType: record.entityType, numero: record.number || '',
            fecha: normalizedDate(record.date), proveedor_cliente: record.name || '',
            nif_tercero: record.taxId || '', total: record.total, status: record.status,
            originalFileName: record.originalFileName,
          });
          pairs.push({
            groupKey: `${keep.id}:${candidate.id}`,
            reason: 'Coinciden tercero, número y fecha de factura',
            keep: view(keep), toDelete: [],
            allItems: [{ ...view(keep), action: 'keep' }, { ...view(candidate), action: 'keep' }],
          });
        }
      }
    }
    const duplicateGroups = single
      ? pairs.filter(pair => pair.allItems.some(item => item.id === body.docId && item.entityType === 'OcrInvoiceDocument'))
      : pairs;
    return Response.json({
      success: true, scope, period: { type: periodType, year: filterYear, value: periodValue },
      totalRecordsAnalyzed: filtered.length, incompleteRecordsCount, duplicateGroupsCount: duplicateGroups.length,
      totalToDelete: 0, duplicateGroups,
      message: 'Coincidencias para revisión individual; este chequeo no elimina ni anula asientos.',
    });
  } catch (error) {
    console.error('checkDuplicates error:', error);
    return Response.json({ error: 'No se pudo completar el chequeo de duplicados.' }, { status: 500 });
  }
});
export async function readBookExportReference(entity, userId, companyId, year, period = 'all') {
  if (!userId || !companyId) return null;
  const rows = await entity.filter({
    created_by_id: userId,
    clientAccountId: companyId,
    exportYear: Number(year),
    exportPeriod: period,
    status: 'ok',
  }, '-exportedAt', 1);
  return rows.find(row => row.created_by_id === userId && row.clientAccountId === companyId
    && row.exportYear === Number(year) && row.exportPeriod === period && row.status === 'ok') ?? null;
}

export async function readBookExportReferences(entity, userId, companyIds, year, period = 'all') {
  if (!userId || !companyIds.length) return {};
  const requested = new Set(companyIds);
  const references = {};
  const limit = 200;
  for (let skip = 0; ; skip += limit) {
    const rows = await entity.filter({
      created_by_id: userId,
      clientAccountId: { $in: companyIds },
      exportYear: Number(year),
      exportPeriod: period,
      status: 'ok',
    }, '-exportedAt', limit, skip);
    for (const row of rows) {
      if (row.created_by_id === userId && row.exportYear === Number(year) && row.exportPeriod === period
        && row.status === 'ok' && requested.has(row.clientAccountId) && !Object.hasOwn(references, row.clientAccountId)) {
        references[row.clientAccountId] = row;
      }
    }
    if (Object.keys(references).length === requested.size || rows.length < limit) return references;
  }
}

export function compareBookExport(invoices, expenses, reference) {
  const emittedInvoiceIds = invoices.filter(row => row.tipo === 'emitida').map(row => row.id);
  const receivedInvoiceIds = invoices.filter(row => row.tipo === 'recibida').map(row => row.id);
  const expenseIds = expenses.map(row => row.id);
  const difference = (ids, previousIds) => {
    if (!reference) return [];
    const previous = new Set(previousIds);
    return ids.filter(id => !previous.has(id));
  };
  const emitted = difference(emittedInvoiceIds, reference?.emittedInvoiceIds);
  const received = difference(receivedInvoiceIds, reference?.receivedInvoiceIds);
  const newExpenses = difference(expenseIds, reference?.expenseIds);

  return {
    newInvoiceIds: new Set([...emitted, ...received]),
    newExpenseIds: new Set(newExpenses),
    count: emitted.length + received.length + newExpenses.length,
    fields: {
      emittedInvoiceIds,
      receivedInvoiceIds,
      expenseIds,
      totalEmitted: emittedInvoiceIds.length,
      totalReceived: receivedInvoiceIds.length,
      newEmittedCount: emitted.length,
      newReceivedCount: received.length,
      newExpenseCount: newExpenses.length,
    },
  };
}

export async function saveBookExportReference(entity, user, company, year, exportedAt, fields) {
  const saved = await entity.create({
    clientAccountId: company.id,
    clientName: company.razon_social || company.nombre_comercial || '',
    exportYear: Number(year),
    exportPeriod: 'all',
    exportedAt,
    exportedBy: user.email || '',
    ...fields,
    status: 'ok',
  });
  if (!saved?.id || saved.created_by_id !== user.id) {
    throw new Error('No se pudo verificar que la referencia se guardó en tu perfil.');
  }
  return saved;
}

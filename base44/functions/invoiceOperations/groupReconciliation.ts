import { commitJournalEntry, createJournalEntry, postInvoice, SCHEMA_VERSION, updatePostingOperation } from './accountingEngine.ts';

const cents = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || Math.abs(number * 100 - Math.round(number * 100)) > 0.0001) {
    throw Object.assign(new Error('Cada reparto debe tener un importe positivo con dos decimales.'), { status: 400 });
  }
  return Math.round(number * 100);
};
const clean = (value, max = 160) => String(value ?? '').trim().slice(0, max);
const active = account => account?.status !== 'inactiva';
const directionFor = invoice => invoice.tipo === 'recibida'
  ? (Number(invoice.total_factura) < 0 ? 'entrada' : 'salida')
  : (Number(invoice.total_factura) < 0 ? 'salida' : 'entrada');

export function normalizeGroupAllocations(input, transactionAmount) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 25) {
    throw Object.assign(new Error('Selecciona entre 2 y 25 facturas para este movimiento.'), { status: 400 });
  }
  const seen = new Set();
  const rows = input.map(item => {
    const invoiceId = clean(item?.invoice_id, 120);
    if (!invoiceId || seen.has(invoiceId)) throw Object.assign(new Error('Hay facturas repetidas o sin identificar.'), { status: 400 });
    seen.add(invoiceId);
    const amountCents = cents(item?.amount);
    return { invoiceId, amountCents };
  }).sort((a, b) => a.invoiceId.localeCompare(b.invoiceId));
  if (rows.reduce((sum, row) => sum + row.amountCents, 0) !== cents(transactionAmount)) {
    throw Object.assign(new Error('La suma repartida debe coincidir exactamente con el movimiento bancario.'), { status: 409 });
  }
  return rows;
}

export async function reconcileInvoiceGroup(base44, user, companyId, body, helpers) {
  const svc = base44.asServiceRole;
  const transactionId = clean(body.bank_transaction_id, 120);
  const bankLedgerId = clean(body.bank_accounting_account_id, 120);
  if (!transactionId || !bankLedgerId) throw Object.assign(new Error('Selecciona el movimiento y su subcuenta bancaria.'), { status: 400 });
  const transaction = await svc.entities.BankTransaction.get(transactionId).catch(() => null);
  if (!transaction || transaction.company_id !== companyId) throw Object.assign(new Error('Movimiento no encontrado en la empresa activa.'), { status: 404 });
  if (transaction.es_demo || transaction.estado_proveedor === 'pending' || transaction.estado_conciliacion === 'duplicada') {
    throw Object.assign(new Error('El movimiento no está contabilizado por el banco o no admite conciliación.'), { status: 409 });
  }
  if (clean(transaction.moneda || 'EUR', 8).toUpperCase() !== 'EUR') {
    throw Object.assign(new Error('El reparto de un movimiento en varias facturas requiere EUR. Revisa manualmente divisas y diferencias de cambio.'), { status: 409 });
  }
  const allocations = normalizeGroupAllocations(body.allocations, Math.abs(Number(transaction.importe) || 0));
  const bankLedger = await svc.entities.AccountingAccount.get(bankLedgerId).catch(() => null);
  const sourceBank = await svc.entities.BankAccount.get(transaction.bank_account_id).catch(() => null);
  if (!bankLedger || bankLedger.companyId !== companyId || !active(bankLedger) || bankLedger.type !== 'banco' || !/^57[23]\d{5}$/.test(bankLedger.code || '')) {
    throw Object.assign(new Error('La subcuenta bancaria no es válida para esta empresa.'), { status: 409 });
  }
  if (!sourceBank || sourceBank.company_id !== companyId || (sourceBank.accounting_account_id && sourceBank.accounting_account_id !== bankLedger.id)) {
    throw Object.assign(new Error('Selecciona la subcuenta contable ya vinculada a esta cuenta bancaria.'), { status: 409 });
  }
  const ids = allocations.map(row => row.invoiceId);
  const existingGroup = transaction.entidad_tipo === 'invoice_group' && transaction.entidad_id === transaction.id;
  if (transaction.entidad_id && !existingGroup) throw Object.assign(new Error('Este movimiento ya está conciliado con otro documento.'), { status: 409 });
  if (!existingGroup && !['sin_conciliar', 'sugerida_ia', 'revisar'].includes(transaction.estado_conciliacion)) {
    throw Object.assign(new Error('El movimiento no está disponible para conciliación.'), { status: 409 });
  }
  if (existingGroup && JSON.stringify([...(transaction.invoice_ids || [])].sort()) !== JSON.stringify([...ids].sort())) {
    throw Object.assign(new Error('El movimiento ya está repartido entre otras facturas.'), { status: 409 });
  }
  const postingKey = `bank:${transaction.id}:${SCHEMA_VERSION}`;
  const priorEntries = await svc.entities.JournalEntry.filter({ companyId, postingKey }, '-created_date', 5);
  if (priorEntries?.length) {
    const priorOperation = priorEntries[0].accountingOperationId
      ? await svc.entities.AccountingPostingOperation.get(priorEntries[0].accountingOperationId).catch(() => null)
      : null;
    if (priorOperation?.operationType !== 'bank_invoice_group') {
      throw Object.assign(new Error('Este movimiento ya tiene un asiento bancario. Revisa o reclasifica primero el asiento existente, incluida la cuenta 555 si procede.'), { status: 409 });
    }
  }
  const invoices = [];
  for (const allocation of allocations) {
    const invoice = await svc.entities.Invoice.get(allocation.invoiceId).catch(() => null);
    if (!invoice || invoice.company_id !== companyId || invoice.anulada) throw Object.assign(new Error('Una factura no pertenece a esta empresa o está anulada.'), { status: 409 });
    if (directionFor(invoice) !== transaction.tipo || clean(invoice.moneda || 'EUR', 8).toUpperCase() !== 'EUR') {
      throw Object.assign(new Error('Todas las facturas deben coincidir en sentido bancario y divisa EUR.'), { status: 409 });
    }
    const state = await helpers.refreshInvoicePaymentState(base44, invoice, companyId);
    const priorPayment = (await svc.entities.InvoicePayment.filter({ company_id: companyId, invoice_id: invoice.id, bank_transaction_id: transaction.id }, 'created_at', 5))?.[0];
    if (priorPayment && Math.round(Math.abs(Number(priorPayment.amount) || 0) * 100) !== allocation.amountCents) {
      throw Object.assign(new Error('El reparto ya estaba reservado con un importe distinto. Revisa la incidencia contable.'), { status: 409 });
    }
    if (!priorPayment && allocation.amountCents > Math.round(state.outstanding * 100)) {
      throw Object.assign(new Error(`El reparto supera el pendiente de la factura ${clean(invoice.numero_factura, 80)}.`), { status: 409 });
    }
    invoices.push({ invoice, allocation, priorPayment });
  }
  if (existingGroup) {
    const operation = transaction.accounting_operation_id
      ? await svc.entities.AccountingPostingOperation.get(transaction.accounting_operation_id).catch(() => null)
      : null;
    if (operation?.status === 'committed') {
      const expected = invoices.every(row => row.priorPayment?.operation_status === 'committed' && row.priorPayment.accounting_operation_id === operation.id);
      if (expected) return { ok: true, duplicate: true, transaction_id: transaction.id, invoice_ids: ids, journal_entry_id: transaction.journal_entry_id };
    }
  }
  const accountRows = [];
  for (const row of invoices) {
    await postInvoice(svc, companyId, row.invoice, user.email, { status: 'confirmado' });
    const posted = await svc.entities.Invoice.get(row.invoice.id);
    const counterparty = posted.counterparty_account_id
      ? await svc.entities.AccountingAccount.get(posted.counterparty_account_id).catch(() => null)
      : (await svc.entities.AccountingAccount.filter({ companyId, code: posted.counterparty_account_code }, '-created_date', 1))?.[0];
    if (!counterparty || counterparty.companyId !== companyId || !active(counterparty)) {
      throw Object.assign(new Error(`No se pudo identificar la subcuenta de tercero de ${clean(row.invoice.numero_factura, 80)}.`), { status: 409 });
    }
    accountRows.push({ ...row, counterparty });
  }
  const now = new Date().toISOString();
  const incoming = transaction.tipo === 'entrada';
  const amount = Math.abs(Number(transaction.importe) || 0);
  const description = `Reparto bancario de ${ids.length} facturas · ${clean(transaction.concepto, 220)}`;
  const lines = [
    { accountId: bankLedger.id, accountCode: bankLedger.code, accountName: bankLedger.name, description, debit: incoming ? amount : 0, credit: incoming ? 0 : amount, sourceLineType: 'banco', bankTransactionId: transaction.id, isReconciled: true, reconciledAt: now },
    ...accountRows.map(row => ({ accountId: row.counterparty.id, accountCode: row.counterparty.code, accountName: row.counterparty.name, description: `Factura ${clean(row.invoice.numero_factura, 100)}`, debit: incoming ? 0 : row.allocation.amountCents / 100, credit: incoming ? row.allocation.amountCents / 100 : 0, sourceLineType: 'tercero', bankTransactionId: transaction.id, isReconciled: true, reconciledAt: now })),
  ];
  let posting = null;
  const payments = [];
  try {
    posting = await createJournalEntry(svc, companyId, { date: transaction.fecha_operacion, description, type: incoming ? 'cobro' : 'pago', source: 'conciliacion', documentId: transaction.id, postingKey, operationType: 'bank_invoice_group', status: 'confirmado', deferCommit: true, lines }, user.email);
    if (!posting.operation?.id) throw new Error('No se pudo reservar la unidad contable del reparto.');
    for (const row of accountRows) {
      const reservation = row.priorPayment
        ? { payment: row.priorPayment }
        : await helpers.reserveInvoicePayment(base44, companyId, row.invoice, {
          company_id: companyId, invoice_id: row.invoice.id, amount: row.allocation.amountCents / 100,
          currency: 'EUR', payment_date: transaction.fecha_operacion, method: 'transferencia',
          reference: clean(transaction.referencia || transaction.concepto, 160),
          notes: 'Reparto de un movimiento bancario entre varias facturas.',
          origin: 'bank_reconciliation', bank_transaction_id: transaction.id,
          idempotency_key: `bank:${transaction.id}:invoice:${row.invoice.id}`,
          created_at: now, created_by: user.full_name || user.email || 'Usuario',
        });
      const payment = await svc.entities.InvoicePayment.update(reservation.payment.id, {
        accounting_operation_id: posting.operation.id, journal_entry_id: posting.entry.id, operation_status: 'preparing',
      });
      payments.push(payment);
    }
    const committed = await commitJournalEntry(svc, companyId, posting.entry, user.email);
    for (const payment of payments) await svc.entities.InvoicePayment.update(payment.id, { operation_status: 'committed' });
    await svc.entities.BankTransaction.update(transaction.id, {
      estado_conciliacion: 'conciliada_manual', confianza_conciliacion: 'alta',
      entidad_tipo: 'invoice_group', entidad_id: transaction.id, invoice_ids: ids,
      journal_entry_id: committed.entry.id, accounting_operation_id: posting.operation.id,
      accounting_account_id: '', accounting_account_code: '',
      reconciled_at: now, reconciled_by: user.email,
      notas: clean(`${transaction.notas ? `${transaction.notas}\n` : ''}Repartido entre ${ids.length} facturas.`, 500),
    });
    if (!sourceBank.accounting_account_id) await svc.entities.BankAccount.update(sourceBank.id, {
      accounting_account_id: bankLedger.id, accounting_account_code: bankLedger.code,
    });
    await updatePostingOperation(svc, posting.operation, {
      status: 'committed', stage: 'committed', journalEntryId: committed.entry.id,
      bankTransactionId: transaction.id, committedAt: now, lastError: '',
    });
    for (const row of accountRows) {
      await helpers.refreshInvoicePaymentState(base44, row.invoice, companyId);
      await helpers.recordTimeline(base44, {
        invoice_id: row.invoice.id, company_id: companyId,
        event_type: 'conciliacion_bancaria', event_label: 'Factura conciliada en grupo',
        event_detail: `${(row.allocation.amountCents / 100).toFixed(2)} EUR · movimiento compartido`,
        created_at: now, created_by: user.full_name || user.email || 'Usuario', origin: 'manual',
      });
    }
    return { ok: true, duplicate: false, transaction_id: transaction.id, invoice_ids: ids, journal_entry_id: committed.entry.id, allocations: accountRows.map(row => ({ invoice_id: row.invoice.id, amount: row.allocation.amountCents / 100 })) };
  } catch (error) {
    if (posting?.operation?.id) {
      await updatePostingOperation(svc, posting.operation, { status: 'recovery_required', stage: 'group_incomplete', lastError: clean(error?.message, 300) }).catch(() => null);
      for (const payment of payments) await svc.entities.InvoicePayment.update(payment.id, { operation_status: 'recovery_required' }).catch(() => null);
    }
    throw error;
  }
}

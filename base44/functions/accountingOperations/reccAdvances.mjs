// Anticipos RECC: se factura solo el saldo nuevo; la aplicación no crea otra cuota de IVA.
const clean = value => String(value ?? '').trim();
const cents = value => Math.round(Number(value) * 100);
const taxId = invoice => clean(invoice.tipo === 'emitida' ? invoice.cliente_nif : (invoice.proveedor_nif || invoice.cliente_nif)).toUpperCase().replace(/[^A-Z0-9]/g, '');
export function reccAdvanceMetadata(value = {}) {
  const kind = clean(value.documentKind || 'ordinary');
  if (!['ordinary', 'advance', 'final'].includes(kind)) throw new Error('Tipo de documento RECC no válido.');
  const source = value.advanceAllocations ?? [];
  if (!Array.isArray(source) || source.length > 20) throw new Error('Revisa la lista de anticipos RECC.');
  const allocations = source.map(row => {
    const invoiceId = clean(row.invoiceId), baseCents = cents(row.base);
    if (!invoiceId || !Number.isFinite(baseCents) || baseCents <= 0 || Math.abs(Number(row.base) * 100 - baseCents) > 0.00001)
      throw new Error('Cada aplicación requiere ID de anticipo y base positiva con dos decimales.');
    return { invoiceId, base: baseCents / 100 };
  });
  if (new Set(allocations.map(row => row.invoiceId)).size !== allocations.length) throw new Error('El mismo anticipo no puede repetirse en la factura final.');
  if ((kind !== 'final' && allocations.length) || (kind === 'final' && !allocations.length)) throw new Error('Solo la factura final debe indicar anticipos aplicados.');
  const finalOperationBase = Number(value.finalOperationBase);
  if (kind === 'final' && (!Number.isFinite(finalOperationBase) || finalOperationBase <= 0 || Math.abs(finalOperationBase * 100 - cents(finalOperationBase)) > 0.00001))
    throw new Error('Confirma la base total de la operación antes de descontar anticipos, con dos decimales.');
  return { documentKind: kind, advanceAllocations: allocations, ...(kind === 'final' ? { finalOperationBase } : {}) };
}
function metadata(invoice) {
  try { return JSON.parse(invoice.recc_metadata || '{}'); } catch { throw new Error('Metadatos RECC inválidos.'); }
}
async function all(entity, query, sort = '-created_date') {
  const rows = [];
  for (let skip = 0; skip < 100000; skip += 500) {
    const page = await entity.filter(query, sort, 500, skip);
    if (!Array.isArray(page)) throw new Error('No se ha podido comprobar el histórico completo de anticipos.');
    rows.push(...page);
    if (page.length < 500) return rows;
  }
  throw new Error('El histórico de anticipos requiere consulta segmentada antes de aplicar importes.');
}
async function confirmedCashCents(svc, companyId, invoice, throughDate) {
  const payments = await all(svc.entities.InvoicePayment, { company_id: companyId, invoice_id: invoice.id }, 'payment_date');
  let paid = 0;
  for (const payment of payments) {
    if (payment.operation_status !== 'committed' || !payment.journal_entry_id)
      throw new Error('Hay un cobro/devolución pendiente de confirmación contable del anticipo.');
    if (clean(payment.currency || 'EUR').toUpperCase() !== 'EUR' || !/^\d{4}-\d{2}-\d{2}$/.test(clean(payment.payment_date))
      || clean(payment.payment_date) > throughDate || !Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0)
      throw new Error('Fecha, moneda o importe del cobro/devolución incompatible con la aplicación del anticipo.');
    const journal = await svc.entities.JournalEntry.get(payment.journal_entry_id);
    if (!journal || journal.companyId !== companyId || journal.status !== 'confirmado' || journal.reversalEntryId)
      throw new Error('El cobro/devolución del anticipo no tiene un asiento confirmado.');
    if (payment.accounting_operation_id) {
      const operation = await svc.entities.AccountingPostingOperation.get(payment.accounting_operation_id);
      if (!operation || operation.companyId !== companyId || operation.status !== 'committed')
        throw new Error('La unidad del cobro/devolución del anticipo no está confirmada.');
    }
    paid += cents(payment.amount);
  }
  if (paid > Math.abs(cents(invoice.total_factura)) + 1) throw new Error('El cobro/devolución excede el documento del anticipo.');
  return paid;
}
function advanceCorrections(rows, originalId, exceptId = '') {
  return rows.filter(row => row.id !== exceptId && !row.anulada && row.es_rectificativa === true
    && row.fiscal_review_status === 'validado' && metadata(row).originalInvoiceId === originalId);
}
async function validateAdvanceCorrection(svc, companyId, invoice, input, result) {
  const original = await svc.entities.Invoice.get(clean(input.originalInvoiceId));
  if (!original || original.company_id !== companyId || original.tipo !== invoice.tipo || original.anulada
    || original.fiscal_review_status !== 'validado' || original.fiscal_regime !== 'criterio_caja'
    || original.es_rectificativa || reccAdvanceMetadata(metadata(original)).documentKind !== 'advance'
    || taxId(original) !== taxId(invoice) || !original.linked_journal_entry_id)
    throw new Error('La devolución exige anticipo original validado, contabilizado, de esta empresa y contraparte.');
  if (Number(invoice.base_imponible) >= 0 || input.adjustmentMode !== 'price_change' || !clean(input.reason)
    || clean(input.adjustmentDate) < clean(original.fecha_operacion || original.fecha_emision))
    throw new Error('La devolución de anticipo requiere abono negativo, causa documentada y fecha fiscal posterior al anticipo.');
  const journal = await svc.entities.JournalEntry.get(original.linked_journal_entry_id);
  if (!journal || journal.companyId !== companyId || journal.status !== 'confirmado' || journal.reversalEntryId)
    throw new Error('El asiento original del anticipo no está confirmado.');
  const rows = await all(svc.entities.Invoice, { company_id: companyId, fiscal_regime: 'criterio_caja' });
  if (rows.some(row => !row.anulada && row.fiscal_review_status === 'validado'
    && reccAdvanceMetadata(metadata(row)).advanceAllocations.some(link => link.invoiceId === original.id)))
    throw new Error('Revierte primero las aplicaciones del anticipo antes de devolverlo; no se modifica su historial.');
  const corrections = advanceCorrections(rows, original.id, invoice.id);
  if (corrections.some(row => Number(row.base_imponible) >= 0 || reccAdvanceMetadata(metadata(row)).documentKind !== 'advance'))
    throw new Error('El histórico de rectificaciones del anticipo requiere revisión específica.');
  if (cents(original.base_imponible) + cents(invoice.base_imponible) + corrections.reduce((sum,row)=>sum+cents(row.base_imponible),0) < 0
    || cents(original.total_factura) + cents(invoice.total_factura) + corrections.reduce((sum,row)=>sum+cents(row.total_factura),0) < 0)
    throw new Error('Las devoluciones superan el anticipo original.');
  if (await confirmedCashCents(svc, companyId, original, clean(input.adjustmentDate)) < cents(original.total_factura))
    throw new Error('Este circuito de devolución exige anticipo íntegramente cobrado/pagado; el anticipo parcial requiere revisión contable específica.');
  return { ...result, applications: [], originalAdvanceId: original.id, originalJournalEntryId: journal.id };
}
export async function assertReccAdvanceCanReverse(svc, companyId, invoice) {
  if (clean(invoice.fiscal_regime) !== 'criterio_caja' || reccAdvanceMetadata(metadata(invoice)).documentKind !== 'advance') return;
  const consumers = await all(svc.entities.Invoice, { company_id: companyId, fiscal_regime: 'criterio_caja' });
  if (advanceCorrections(consumers, invoice.id).length) throw new Error('El anticipo tiene devoluciones activas. Revisa primero sus abonos y pagos; el historial permanece intacto.');
  if (consumers.some(row => row.id !== invoice.id && !row.anulada && row.fiscal_review_status === 'validado'
    && reccAdvanceMetadata(metadata(row)).advanceAllocations.some(link => link.invoiceId === invoice.id)))
    throw new Error('El anticipo tiene aplicaciones activas. Revierte primero la factura final y después revisa el anticipo; no se rompe el vínculo contable.');
}

export async function acquireReccAdvanceLocks(svc, companyId, input, finalInvoiceId) {
  const result = reccAdvanceMetadata(input);
  const lockIds = result.documentKind === 'final' ? result.advanceAllocations.map(row => row.invoiceId)
    : result.documentKind === 'advance' && clean(input.originalInvoiceId) ? [clean(input.originalInvoiceId)] : [];
  if (!lockIds.length) return async () => {};
  const token = crypto.randomUUID();
  const acquired = [];
  const release = async () => {
    for (const id of acquired.slice().reverse()) {
      const released = await svc.entities.Invoice.updateMany(
        { id, company_id: companyId, recc_application_lock_token: token },
        { $set: { recc_application_lock_token: '', recc_application_lock_started_at: '', recc_application_lock_document_id: '' } });
      if (!released?.success || Number(released.updated) !== 1)
        throw new Error('No se pudo liberar el bloqueo RECC. El asesor debe revisar la incidencia antes de reutilizar el anticipo.');
    }
  };
  try {
    for (const id of lockIds.sort()) {
      // CAS sobre el anticipo existente, no un comprobar-y-crear ni una cola de una sola instancia.
      // No caduca automáticamente: un proceso interrumpido queda protegido para revisión del asesor.
      const claim = await svc.entities.Invoice.updateMany(
        { id, company_id: companyId, $or: [{ recc_application_lock_token: { $exists: false } }, { recc_application_lock_token: null }, { recc_application_lock_token: '' }] },
        { $set: { recc_application_lock_token: token, recc_application_lock_started_at: new Date().toISOString(), recc_application_lock_document_id: finalInvoiceId } });
      if (!claim?.success || Number(claim.updated) !== 1)
        throw Object.assign(new Error('Otro proceso está confirmando este anticipo, o no pertenece a esta empresa. Espera a que termine; no se ha aplicado dos veces.'), { status: 409 });
      acquired.push(id);
    }
    return release;
  } catch (error) {
    try { await release(); } catch (releaseError) { console.error('[RECC lock]', releaseError.message); }
    throw error;
  }
}


export async function recoverReccAdvanceLock(svc, companyId, invoiceId, input, actor) {
  const invoice = await svc.entities.Invoice.get(invoiceId);
  if (!invoice || invoice.company_id !== companyId) throw Object.assign(new Error('Anticipo no accesible.'), {status:403});
  const started = clean(invoice.recc_application_lock_started_at);
  const token = clean(invoice.recc_application_lock_token);
  if (!token) return { success:true, released:false, alreadyReleased:true };
  if (input.confirmProcessingStopped !== true || clean(input.reason).length < 12)
    throw Object.assign(new Error('Confirma que el proceso ha terminado e indica el motivo de la recuperación.'), {status:422});
  if (!started || started !== input.expectedStartedAt || !Number.isFinite(Date.parse(started)) || Date.now()-Date.parse(started)<3600000)
    throw Object.assign(new Error('El bloqueo ha cambiado o tiene menos de una hora. No se interrumpe una confirmación activa.'), {status:409});
  const operations = await all(svc.entities.AccountingPostingOperation, {companyId,documentId:invoice.recc_application_lock_document_id});
  if (operations.some(row=>['preparing','recovery_required'].includes(row.status)))
    throw Object.assign(new Error('Hay una unidad contable pendiente. Revisa primero su recuperación, sin liberar el anticipo.'), {status:409});
  const audit = await svc.entities.AccountingAuditLog.create({
    companyId, eventType:'recc_advance_lock_recovery', eventKey:'recc-lock-recovery:'+crypto.randomUUID(),
    fiscalYear:Number(String(invoice.fecha_emision||'').slice(0,4))||new Date().getUTCFullYear(),
    reason:clean(input.reason), actor, occurredAt:new Date().toISOString(),
    beforeJson:JSON.stringify({invoiceId,startedAt:started,documentId:invoice.recc_application_lock_document_id}),
    afterJson:JSON.stringify({status:'attempt_approved'}), schemaVersion:'pgc8-v1',
  });
  const result = await svc.entities.Invoice.updateMany(
    {id:invoiceId,company_id:companyId,recc_application_lock_token:token,recc_application_lock_started_at:started},
    {$set:{recc_application_lock_token:'',recc_application_lock_started_at:'',recc_application_lock_document_id:''}});
  if (!result?.success || Number(result.updated)!==1) throw Object.assign(new Error('El bloqueo cambió durante la revisión; no se ha forzado su liberación.'),{status:409});
  await svc.entities.AccountingAuditLog.update(audit.id,{afterJson:JSON.stringify({status:'released',invoiceId})});
  return {success:true,released:true,invoiceId};
}

// Una liquidación final sin saldo no genera otro cobro ni otra cuota: solo aplica el anticipo.
export function isZeroResidualReccFinal(invoice, input = metadata(invoice)) {
  const result = reccAdvanceMetadata(input);
  return result.documentKind === 'final' && result.advanceAllocations.length > 0
    && ['base_imponible','cuota_iva','total_factura','importe_retencion','cuota_recargo'].every(key => Number(invoice[key] || 0) === 0)
    && cents(result.finalOperationBase) === result.advanceAllocations.reduce((sum, row) => sum + cents(row.base), 0);
}
export async function validateReccAdvanceLinks(svc, companyId, invoice, input = metadata(invoice)) {
  const result = reccAdvanceMetadata(input);
  if (result.documentKind === 'ordinary') {
    if (invoice.es_rectificativa && clean(input.originalInvoiceId)) {
      const original = await svc.entities.Invoice.get(clean(input.originalInvoiceId));
      if (original?.company_id === companyId && reccAdvanceMetadata(metadata(original)).documentKind === 'advance')
        throw new Error('Una devolución de anticipo utiliza 438/407, no ingreso/gasto ordinario; confirma el documento como anticipo con el asesor.');
    }
    return { ...result, applications: [] };
  }
  if (invoice.es_rectificativa && result.documentKind === 'advance')
    return validateAdvanceCorrection(svc, companyId, invoice, input, result);
  if (invoice.es_rectificativa || (Number(invoice.base_imponible) <= 0 && !isZeroResidualReccFinal(invoice, result)) || clean(invoice.moneda || 'EUR') !== 'EUR')
    throw new Error('El circuito de anticipos requiere factura positiva en EUR. Las devoluciones deben revisar su rectificativa y ajuste contable.');
  if (!taxId(invoice)) throw new Error('Identifica fiscalmente al cliente/proveedor del anticipo.');
  if (result.documentKind === 'advance') return { ...result, applications: [] };
  if (cents(result.finalOperationBase) !== cents(invoice.base_imponible) + result.advanceAllocations.reduce((sum, row) => sum + cents(row.base), 0))
    throw new Error('La base de la factura final debe ser la base total menos los anticipos aplicados. No se duplica la base ni el IVA del anticipo.');
  const consumers = await all(svc.entities.Invoice, { company_id: companyId, fiscal_regime: 'criterio_caja' });
  const applications = [];
  for (const allocation of result.advanceAllocations) {
    if (allocation.invoiceId === invoice.id) throw new Error('Una factura no puede aplicarse a sí misma.');
    const advance = await svc.entities.Invoice.get(allocation.invoiceId);
    if (!advance || advance.company_id !== companyId || advance.tipo !== invoice.tipo || advance.anulada
      || advance.fiscal_review_status !== 'validado' || advance.fiscal_regime !== 'criterio_caja'
      || advance.es_rectificativa || taxId(advance) !== taxId(invoice)
      || reccAdvanceMetadata(metadata(advance)).documentKind !== 'advance'
      || Number(advance.base_imponible) <= 0 || !advance.linked_journal_entry_id)
      throw new Error('El anticipo debe estar validado y contabilizado, sin anular, en esta empresa y con la misma contraparte.');
    const advanceDate = clean(advance.fecha_operacion || advance.fecha_emision);
    const finalDate = clean(invoice.fecha_operacion || invoice.fecha_emision);
    if (advanceDate > finalDate) throw new Error('La factura final no puede preceder al anticipo.');
    const journal = await svc.entities.JournalEntry.get(advance.linked_journal_entry_id);
    if (!journal || journal.companyId !== companyId || journal.status !== 'confirmado' || journal.reversalEntryId)
      throw new Error('El asiento del anticipo no está confirmado o ha sido revertido.');
    const advanceCode = invoice.tipo === 'emitida' ? '43800000' : '40700000';
    const lines = await all(svc.entities.JournalEntryLine, { companyId, journalEntryId: journal.id }, 'lineNumber');
    const accountLine = lines.find(row => row.accountCode === advanceCode);
    const originalCost = Number(advance.base_imponible) + (invoice.tipo === 'recibida' ? Number(advance.non_deductible_tax_amount || 0) : 0);
    if (!accountLine || Math.abs(cents(invoice.tipo === 'emitida' ? accountLine.credit : accountLine.debit) - cents(originalCost)) > 1)
      throw new Error('El anticipo no tiene una contrapartida 438/407 coherente. No se modifica su asiento histórico.');
    const payments = await all(svc.entities.InvoicePayment, { company_id: companyId, invoice_id: advance.id }, 'payment_date');
    let paidCents = 0;
    for (const payment of payments) {
      if (payment.operation_status !== 'committed' || !payment.journal_entry_id) continue;
      const paymentEntry = await svc.entities.JournalEntry.get(payment.journal_entry_id);
      if (!paymentEntry || paymentEntry.companyId !== companyId || paymentEntry.status !== 'confirmado' || paymentEntry.reversalEntryId)
        throw new Error('El cobro/pago del anticipo no tiene un asiento confirmado.');
      if (payment.accounting_operation_id) {
        const operation = await svc.entities.AccountingPostingOperation.get(payment.accounting_operation_id);
        if (!operation || operation.companyId !== companyId || operation.status !== 'committed')
          throw new Error('La unidad de cobro/pago del anticipo aún no está confirmada.');
      }
      if (clean(payment.payment_date) > finalDate) throw new Error('El anticipo debe cobrarse/pagarse antes de su aplicación.');
      if (!Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0) throw new Error('Importe de anticipo no válido.');
      paidCents += cents(payment.amount);
    }
    let invoiceCents = cents(advance.total_factura), baseCents = cents(advance.base_imponible);
    if (invoiceCents <= 0 || paidCents > invoiceCents + 1) throw new Error('El saldo cobrado del anticipo no es coherente.');
    let correctedCost = cents(originalCost);
    for (const correction of advanceCorrections(consumers, advance.id)) {
      if (reccAdvanceMetadata(metadata(correction)).documentKind !== 'advance' || Number(correction.base_imponible) >= 0
        || !correction.linked_journal_entry_id) throw new Error('La devolución del anticipo necesita asiento y vínculo 438/407 revisados.');
      const correctionEntry = await svc.entities.JournalEntry.get(correction.linked_journal_entry_id);
      if (!correctionEntry || correctionEntry.companyId !== companyId || correctionEntry.status !== 'confirmado' || correctionEntry.reversalEntryId)
        throw new Error('El abono del anticipo no tiene un asiento confirmado.');
      const refunded = await confirmedCashCents(svc, companyId, correction, finalDate);
      if (refunded !== Math.abs(cents(correction.total_factura)))
        throw new Error('Completa la devolución confirmada del abono antes de aplicar el saldo del anticipo.');
      paidCents -= refunded;
      invoiceCents += cents(correction.total_factura);
      baseCents += cents(correction.base_imponible);
      correctedCost += cents(Number(correction.base_imponible) + (invoice.tipo === 'recibida' ? Number(correction.non_deductible_tax_amount || 0) : 0));
    }
    if (invoiceCents <= 0 || baseCents <= 0 || paidCents < 0 || paidCents > invoiceCents + 1 || correctedCost <= 0)
      throw new Error('El anticipo está devuelto o su saldo corregido requiere revisión; no puede volver a aplicarse.');
    const availableCents = paidCents >= invoiceCents ? baseCents : Math.floor(baseCents * paidCents / invoiceCents);
    let reservedCents = 0;
    for (const consumer of consumers) {
      if (consumer.id === invoice.id || consumer.anulada || consumer.fiscal_review_status !== 'validado') continue;
      const links = reccAdvanceMetadata(metadata(consumer));
      reservedCents += links.advanceAllocations.filter(row => row.invoiceId === advance.id).reduce((sum, row) => sum + cents(row.base), 0);
    }
    if (reservedCents + cents(allocation.base) > availableCents)
      throw new Error('El anticipo ya se ha aplicado o reservado, o la base supera el cobro/pago confirmado disponible.');
    const costCents = Math.round(correctedCost * (reservedCents + cents(allocation.base)) / baseCents)
      - Math.round(correctedCost * reservedCents / baseCents);
    applications.push({ ...allocation, accountingAmount: costCents / 100, advanceCode, advanceNumber: advance.numero_factura || advance.id });
  }
  return { ...result, applications };
}

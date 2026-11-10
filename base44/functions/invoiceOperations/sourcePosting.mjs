import { validateReceivedOcrAmounts } from './receivedOcrAmounts.mjs';

async function updatePendingExpenseAmounts(svc, companyId, invoice, form) {
  if (invoice.company_id !== companyId || invoice.tipo !== 'recibida' || invoice.anulada) {
    throw Object.assign(new Error('Esta corrección solo está disponible para facturas recibidas de la empresa activa.'), { status: 409 });
  }
  const values = validateReceivedOcrAmounts(form, invoice.cuota_recargo);
  if (Object.entries(values).every(([key,value]) => Number(invoice[key] ?? 0) === value)) return invoice;
  if (invoice.estado_contable === 'contabilizada' || invoice.linked_journal_entry_id || !invoice.accounting_migration_hold
    || Number(invoice.importe_pagado || 0) !== 0) {
    throw Object.assign(new Error('La factura ya tiene asiento o pago, o ya salió de revisión. Corrige el documento desde Facturas.'), { status: 409 });
  }
  if (values.base_imponible < 0 && !invoice.es_rectificativa) {
    throw Object.assign(new Error('Una base negativa requiere una factura rectificativa.'), { status: 422 });
  }
  const [entries, payments, taxLines] = await Promise.all([
    svc.entities.JournalEntry.filter({ companyId, documentId: invoice.id }, 'id', 1),
    svc.entities.InvoicePayment.filter({ company_id: companyId, invoice_id: invoice.id }, 'id', 1),
    svc.entities.InvoiceTaxLine.filter({ companyId, invoiceId: invoice.id }, 'lineNumber', 2),
  ]);
  if (entries.length || payments.length || taxLines.length > 1) {
    throw Object.assign(new Error('La factura ya tiene un asiento, un pago o un desglose fiscal. Revisa ese registro antes de cambiar los importes.'), { status: 409 });
  }
  const update = await svc.entities.Invoice.updateMany({
    id: invoice.id, company_id: companyId, tipo: 'recibida', anulada: { $ne: true },
    source_confirmation_lock_token: invoice.source_confirmation_lock_token,
    linked_journal_entry_id: { $in: [null, ''] }, fiscal_review_lock_token: { $in: [null, ''] },
    payment_lock_token: { $in: [null, ''] },
    ...(invoice.updated_date ? { updated_date: invoice.updated_date } : {}),
  }, { $set: {
    ...values,
    importe_pendiente: Math.abs(values.total_factura),
    fiscal_review_status: 'pendiente_revision',
  } });
  if (Number(update?.updated) !== 1) {
    throw Object.assign(new Error('La factura ha cambiado durante la revisión. Actualiza y vuelve a confirmar.'), { status: 409 });
  }
  return svc.entities.Invoice.get(invoice.id);
}

// Confirmar y contabilizar en un único paso del documento, con reintentos idempotentes.
export async function completeSourceInvoice(base44, user, companyId, invoice, criteria, dependencies, sourceAmounts = null) {
  const {postInvoice, buildAeatQrUrl, ensureInvoiceQrHash} = dependencies;
  const svc = base44.asServiceRole;
  if (invoice.company_id !== companyId || invoice.anulada) throw Object.assign(new Error('Factura ajena a la empresa o anulada.'), {status:409});
  const knownHolds = ['FISCAL_ADVISOR_REVIEW_PHASE1','FISCAL_POSTING_ERROR','SOURCE_CHECK_PENDING',
    'Falló el registro fiscal OCR.','No se pudo guardar la clasificación fiscal de la factura nueva.','Falló la línea fiscal de la emisión recurrente.'];
  if (invoice.accounting_migration_hold && !knownHolds.includes(invoice.accounting_migration_hold_reason))
    throw Object.assign(new Error('Esta factura tiene una incidencia contable independiente. No se levantará su retención automáticamente.'), {status:409});
  const token=crypto.randomUUID();
  let claimed=await svc.entities.Invoice.updateMany({id:invoice.id,company_id:companyId, anulada:{$ne:true},
    source_confirmation_lock_token:{$in:[null,'']}},{$set:{source_confirmation_lock_token:token,source_confirmation_lock_started_at:new Date().toISOString()}});
  if(Number(claimed?.updated)!==1) {
    const previous=await svc.entities.Invoice.get(invoice.id);
    const started=Date.parse(previous?.source_confirmation_lock_started_at || '');
    const previousToken=String(previous?.source_confirmation_lock_token || '');
    if(previousToken && Number.isFinite(started) && Date.now()-started>600000)
      claimed=await svc.entities.Invoice.updateMany({id:invoice.id,company_id:companyId, anulada:{$ne:true},
        source_confirmation_lock_token:previousToken,
        source_confirmation_lock_started_at:previous.source_confirmation_lock_started_at},
        {$set:{source_confirmation_lock_token:token,source_confirmation_lock_started_at:new Date().toISOString(),
          source_confirmation_lock_recovery:{previousToken,staleSince:previous.source_confirmation_lock_started_at,recoveredAt:new Date().toISOString()}}});
  }
  if(Number(claimed?.updated)!==1) throw Object.assign(new Error('Este documento ya está siendo confirmado. Espera a que termine antes de reintentar.'),{status:409});
  try {
  if (sourceAmounts) {
    invoice = await svc.entities.Invoice.get(invoice.id);
    if (invoice?.source_confirmation_lock_token !== token) throw Object.assign(new Error('La confirmación ya no tiene la reserva de esta factura.'), { status: 409 });
    if (invoice.accounting_migration_hold && !knownHolds.includes(invoice.accounting_migration_hold_reason))
      throw Object.assign(new Error('Esta factura tiene una incidencia contable independiente.'), { status: 409 });
    invoice = await updatePendingExpenseAmounts(svc, companyId, invoice, sourceAmounts);
  }
  if(criteria.accountCode && invoice.estado_contable!=='contabilizada' && !invoice.linked_journal_entry_id) {
    const raw=String(criteria.accountCode).trim(),group=invoice.tipo==='emitida'?'7':'6',type=invoice.tipo==='emitida'?'ingreso':'gasto';
    if(!/^\d{3,8}$/.test(raw) || !raw.startsWith(group)) throw Object.assign(new Error('La cuenta manual no corresponde al grupo de esta factura.'),{status:422});
    const code=raw.padEnd(8,'0'),rows=await svc.entities.AccountingAccount.filter({companyId,code});
    const account=rows.find(row=>row.status!=='inactiva' && row.type===type && row.companyId===companyId);
    if(!account) throw Object.assign(new Error('La cuenta manual debe existir y estar activa en el plan de esta empresa.'),{status:422});
    invoice=await svc.entities.Invoice.update(invoice.id,{revenue_expense_account_code:code,revenue_expense_account_id:account.id});
  }
  // Una factura ya contabilizada se reutiliza, nunca se reclasifica al repetir el check.
  if (invoice.estado_contable !== 'contabilizada' && !invoice.linked_journal_entry_id) {
    const response = await base44.functions.invoke('fiscalOperations', { ...criteria,
      ...(dependencies.fiscalExtra || {}), action:dependencies.fiscalAction || 'confirm_invoice_source', companyId, invoiceId:invoice.id, confirmReviewed:true });
    const result = response?.data ?? response;
    if (!result?.success || result.mode !== 'saved') throw Object.assign(new Error(result?.error || result?.warning || 'Revisa los datos fiscales en este mismo documento.'), {status:422});
    invoice = await svc.entities.Invoice.get(invoice.id);
  }
  if (invoice.fiscal_review_status !== 'validado') throw Object.assign(new Error('Falta confirmar el criterio de este documento.'), {status:422});
  if (invoice.tipo === 'emitida' && !invoice.qr_url) {
    const company = await svc.entities.Company.get(companyId);
    invoice = await svc.entities.Invoice.update(invoice.id,{qr_url:buildAeatQrUrl(company,invoice),qr_mode:'no_verifactu',qr_spec_version:'AEAT-QR-0.5.0'});
  }
  invoice = await ensureInvoiceQrHash(svc.entities.Invoice,invoice);
  try {
    const postOptions = 
      {status:'confirmado',source:invoice.ocr_document_id?'OCR':invoice.isRecurringGenerated?'recurring_invoice':'manual',...(invoice.ocr_document_id?{ocrDocumentId:invoice.ocr_document_id}:{})};
    let posting;
    try {posting=await postInvoice(svc,companyId,{...invoice,accounting_migration_hold:false},user.email,postOptions);}
    catch(error){
      // Solo una lectura incompleta conocida: repetir la confirmación del mismo
      // asiento enlazado. Nunca volver a crear líneas ni relajar su validación.
      if(error?.message!=='El asiento previo no tiene todas sus líneas persistidas; se mantiene pendiente para revisión sin duplicarlo.')throw error;
      await new Promise(resolve=>setTimeout(resolve,1000));
      const saved=await svc.entities.Invoice.get(invoice.id);
      if(saved?.company_id!==companyId||!saved.linked_journal_entry_id)throw error;
      posting=await postInvoice(svc,companyId,{...saved,accounting_migration_hold:false},user.email,postOptions);
      if(posting.entry.id!==saved.linked_journal_entry_id)throw new Error('La recuperación debe conservar el mismo asiento.');
    }
    const saved = await svc.entities.Invoice.update(invoice.id,{accounting_migration_hold:false,accounting_migration_hold_reason:'',source_last_error:''});
    if (saved.ocr_document_id) {
      const doc = await svc.entities.OcrInvoiceDocument.get(saved.ocr_document_id);
      if (!doc || doc.company_id !== companyId || (doc.linkedInvoiceId && doc.linkedInvoiceId !== saved.id))
        throw Object.assign(new Error('El asiento está confirmado, pero el vínculo OCR necesita corrección.'),{status:409});
      const now = new Date().toISOString();
      await svc.entities.OcrInvoiceDocument.update(doc.id,{status:'accounted',linkedInvoiceId:saved.id,
        linkedJournalEntryId:posting.entry.id,accountedAt:now,reviewedAt:now,lastStatusChangedAt:now,
        reviewedByAdminId:user.id,safeErrorMessage:'',duplicateWarning:'',
        auditTrail:[...(Array.isArray(doc.auditTrail)?doc.auditTrail:[]),JSON.stringify({
          action:'source_single_check',invoiceId:saved.id,journalEntryId:posting.entry.id,actor:user.email,at:now})]});
    }
    return {ok:true,success:true,review_required:false,invoice:{...saved,source_confirmation_lock_token:'',source_confirmation_lock_started_at:''},invoiceId:saved.id,
      journalEntryId:posting.entry.id,journal_entry:posting.entry,duplicate:Boolean(posting.alreadyPosted)};
  } catch(error) {
    if (invoice.estado_contable !== 'contabilizada' && !invoice.linked_journal_entry_id) await svc.entities.Invoice.update(invoice.id,
      {accounting_migration_hold:true,accounting_migration_hold_reason:'FISCAL_POSTING_ERROR'});
    error.invoiceId=invoice.id; throw error;
  }
  } finally {await svc.entities.Invoice.updateMany({id:invoice.id,company_id:companyId,source_confirmation_lock_token:token},
    {$set:{source_confirmation_lock_token:'',source_confirmation_lock_started_at:''}});}
}

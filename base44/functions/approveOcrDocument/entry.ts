import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { postInvoice, SCHEMA_VERSION, canonical8 } from './accountingEngine.ts';
import { buildAeatQrUrl } from './invoiceQr.ts';
import { acquireApprovalLease, resumeExistingOcr, findFinancialDuplicates } from './ocrRecovery.ts';

// Formulario corregido para el régimen de comerciante minorista IGIC (confirmado por asesor):
// el IGIC soportado no se cuenta como cuota deducible (mayor gasto), por lo que el total coincide con la base.
function buildBulkCorrectedForm(ex) {
  const base = Math.round((Number(ex?.base_imponible) || 0) * 100) / 100;
  const ret = Number(ex?.retencion_irpf) || 0;
  const importeRet = Math.round(((base * ret) / 100) * 100) / 100;
  return {
    proveedor_cliente: ex?.proveedor || '',
    nif_proveedor: ex?.nif_proveedor || '',
    email_proveedor: ex?.email_proveedor || ex?.proveedor_email || '',
    telefono_proveedor: ex?.telefono_proveedor || ex?.proveedor_telefono || '',
    direccion_proveedor: ex?.direccion_proveedor || ex?.proveedor_direccion || '',
    codigo_postal_proveedor: ex?.codigo_postal_proveedor || ex?.proveedor_codigo_postal || '',
    ciudad_proveedor: ex?.ciudad_proveedor || ex?.proveedor_ciudad || '',
    provincia_proveedor: ex?.provincia_proveedor || ex?.proveedor_provincia || '',
    pais_proveedor: ex?.pais_proveedor || ex?.proveedor_pais || '',
    concepto: ex?.concepto || ex?.motivo_clasificacion || '',
    fecha: ex?.fecha || '',
    fecha_recepcion: new Date().toISOString().slice(0, 10),
    base_imponible: base,
    tipo_impuesto: 0,
    cuota_impuesto: 0,
    retencion_irpf: ret,
    retencion_tipo: ex?.retencion_tipo || 'ninguna',
    importe_retencion: importeRet,
    total: ret > 0 ? Math.round((base - importeRet) * 100) / 100 : base,
    categoria: ex?.categoria_sugerida || 'otros',
    es_rectificativa: ex?.es_rectificativa === true,
  };
}

const ADMIN_ROLES = ['admin', 'super_admin', 'advisor', 'asesor'];

// Lógica de aprobación de un documento OCR (compartida entre el flujo individual y el masivo).
async function approveOne(base44, user, doc, form, invoiceType, extractedData, confirmFiscalReview, recoveryOnly = false) {
  const svc = base44.asServiceRole;
  const company = await svc.entities.Company.get(doc.company_id);
  const platformAdmin = ['admin', 'super_admin'].includes(user.role);
  if (!company || (!platformAdmin && company.owner_email !== user.email
    && !(Array.isArray(company.usuarios_autorizados) && company.usuarios_autorizados.includes(user.email)))) {
    return { status: 403, json: { error: 'No tienes acceso confirmado a la empresa de este OCR.' } };
  }
  const release = await acquireApprovalLease(svc, doc.company_id);
  try {
    doc = await svc.entities.OcrInvoiceDocument.get(doc.id);
    if (!doc || doc.company_id !== company.id) return { status: 409, json: { error: 'El documento cambió de empresa; no se procesará.' } };
    if (['rejected', 'cancelled_by_client', 'replacement_requested'].includes(doc.status)) {
      return { status: 409, json: { error: 'Documento archivado o rechazado: no se creará otra factura.' } };
    }
    const resumed = await resumeExistingOcr(svc, user, doc, invoiceType, confirmFiscalReview, postInvoice, SCHEMA_VERSION);
    if (resumed) return resumed;
    if (recoveryOnly) return { status: 409, json: { error: 'No existe factura enlazada para recuperar. No se creó ninguna.' } };
    return await approveNew(base44, user, doc, form, invoiceType, extractedData, confirmFiscalReview);
  } finally {
    await release().catch(error => console.warn('[approveOcrDocument] approval lease release failed:', error?.message));
  }
}

async function approveNew(base44, user, doc, form, invoiceType, extractedData, confirmFiscalReview) {

  // 3. Validate direction and any explicit PGC override before creating an invoice.
  const expectedType = doc.documentType === 'income_invoice' ? 'emitida'
    : doc.documentType === 'expense_invoice' ? 'recibida' : null;
  if (!expectedType || invoiceType !== expectedType) {
    return { status: 422, json: { error: 'El tipo de factura no coincide con el documento OCR.' } };
  }

  const manualAccountInput = String(form.cuenta_contable_manual || '').trim();
  let manualAccount = null;
  if (manualAccountInput) {
    const expectedGroup = invoiceType === 'emitida' ? '7' : '6';
    const expectedAccountType = invoiceType === 'emitida' ? 'ingreso' : 'gasto';
    if (!/^\d{3,8}$/.test(manualAccountInput) || !manualAccountInput.startsWith(expectedGroup)) {
      return { status: 422, json: { error: `La cuenta manual debe ser del grupo ${expectedGroup} y tener entre 3 y 8 dígitos.` } };
    }
    const accountCode = canonical8(manualAccountInput);
    const accounts = await base44.asServiceRole.entities.AccountingAccount.filter({ companyId: doc.company_id, code: accountCode });
    manualAccount = (accounts || []).find(account => account.companyId === doc.company_id && account.code === accountCode && account.status !== 'inactiva' && account.type === expectedAccountType);
    if (!manualAccount) {
      return { status: 422, json: { error: `La cuenta ${accountCode} no existe como cuenta activa de ${expectedAccountType} en el plan contable de esta empresa. Créala o actívala en Contabilidad antes de aprobar.` } };
    }
  }

  const numeroFactura = invoiceType === 'emitida'
    ? (form.numero_factura || extractedData?.numero_factura || '')
    : (extractedData?.numero_factura || form.numero_factura || '');

  if (!numeroFactura) {
    return { status: 400, json: { error: 'El numero de factura es obligatorio' } };
  }

  const fechaEmision = invoiceType === 'emitida' ? form.fecha_emision : form.fecha;
  if (!fechaEmision) {
    return { status: 400, json: { error: 'La fecha es obligatoria' } };
  }
  const fechaRecepcion = invoiceType === 'recibida'
    ? (form.fecha_recepcion || String(doc.uploadedAt || doc.created_date || new Date().toISOString()).slice(0, 10))
    : '';
  if (invoiceType === 'recibida' && fechaRecepcion < fechaEmision) {
    return { status: 400, json: { error: 'La fecha real de recepción no puede ser anterior a la fecha de emisión.' } };
  }

  const baseImponible = parseFloat(form.base_imponible) || 0;
  const esRectificativa = form.es_rectificativa === true || form.es_rectificativa === 'true' || extractedData?.es_rectificativa === true;
  if (baseImponible === 0) {
    return { status: 400, json: { error: 'La base imponible no puede ser 0' } };
  }
  if (baseImponible < 0 && !esRectificativa) {
    return { status: 400, json: { error: 'Base imponible negativa solo permitida en facturas rectificativas. Marca la opción es_rectificativa.' } };
  }

  // La aprobación OCR utiliza la misma evaluación que la factura manual.
  let fiscalAssessment;
  try {
    const fiscalResponse = await base44.functions.invoke('fiscalOperations', {
      action: 'evaluate', companyId: doc.company_id,
      requireValidatedProfile: true, requireExactActivity: true,
      activityId: form.fiscal_activity_id || undefined,
      direction: invoiceType === 'emitida' ? 'ingreso' : 'gasto',
      operationDate: fechaEmision,
      base: baseImponible,
      taxRate: Number(invoiceType === 'emitida' ? form.tipo_iva : form.tipo_impuesto),
      taxAmount: Number(invoiceType === 'emitida' ? form.cuota_iva : form.cuota_impuesto),
      withholdingRate: Number(form.retencion_irpf || 0),
      counterpartyIsWithholdingAgent: Number(form.retencion_irpf || 0) > 0,
    });
    fiscalAssessment = (fiscalResponse?.data || fiscalResponse)?.evaluation;
  } catch (fiscalError) {
    console.error('[approveOcrDocument] Fiscal check failed:', fiscalError.message);
    return { status: 503, json: { error: 'No se pudo verificar el encuadramiento fiscal. El documento OCR sigue pendiente y no se ha creado una factura.' } };
  }
  const pendingReview = !fiscalAssessment
    || !['ready', 'review_required'].includes(fiscalAssessment.status)
    || confirmFiscalReview !== true
    || !ADMIN_ROLES.includes(user.role);
  if (!pendingReview && (!['general', 'exenta_limitada', 'exenta_plena', 'pequeno_empresario_igic', 'comerciante_minorista_igic'].includes(fiscalAssessment.regime)
    || fiscalAssessment.accounting?.reverseCharge || !['iva', 'igic'].includes(fiscalAssessment.taxKind))) {
    return { status: 422, json: { error: 'Régimen u operación especial pendiente de revisión del asesor; el documento OCR se conserva sin contabilizar.' } };
  }
  if (!pendingReview && fiscalAssessment.operationType === 'exempt_limited' && (!fiscalAssessment.exemptionKey || !fiscalAssessment.legalBasis)) {
    return { status: 422, json: { error: 'Falta clave de exención o fundamento legal confirmado por el asesor.' } };
  }
  const sourceTotal = Number(invoiceType === 'emitida' ? form.total_factura : form.total);
  if (!Number.isFinite(sourceTotal)
    || (!pendingReview && Math.abs(sourceTotal - fiscalAssessment.total) > 0.02)
    || (!pendingReview && Math.abs(Number(invoiceType === 'emitida' ? form.tipo_iva : form.tipo_impuesto) - fiscalAssessment.taxRate) > 0.0001)
    || (!pendingReview && Math.abs(Number(invoiceType === 'emitida' ? form.cuota_iva : form.cuota_impuesto) - fiscalAssessment.taxAmount) > 0.02)) {
    return { status: 422, json: { error: 'Los importes OCR no coinciden con el perfil fiscal validado. Revisa base, tipo, cuota, retención y total antes de aprobar.' } };
  }

  // 4. Build invoice data
  const year = new Date(fechaEmision).getFullYear();
  const month = new Date(fechaEmision).getMonth() + 1;
  const trimestre = month <= 3 ? 'T1' : month <= 6 ? 'T2' : month <= 9 ? 'T3' : 'T4';

  let invoiceData;

  if (invoiceType === 'emitida') {
    invoiceData = {
      company_id: doc.company_id,
      numero_factura: numeroFactura,
      fecha_emision: form.fecha_emision,
      fecha_vencimiento: form.fecha_vencimiento || undefined,
      cliente_nombre: form.cliente_nombre || '',
      cliente_nif: form.cliente_nif || '',
      cliente_email: form.cliente_email || extractedData?.email_cliente || extractedData?.cliente_email || '',
      cliente_telefono: form.cliente_telefono || extractedData?.telefono_cliente || extractedData?.cliente_telefono || '',
      cliente_direccion: form.cliente_direccion || extractedData?.direccion_cliente || extractedData?.cliente_direccion || '',
      cliente_codigo_postal: form.cliente_codigo_postal || extractedData?.codigo_postal_cliente || extractedData?.cliente_codigo_postal || '',
      cliente_ciudad: form.cliente_ciudad || extractedData?.ciudad_cliente || extractedData?.cliente_ciudad || '',
      cliente_provincia: form.cliente_provincia || extractedData?.provincia_cliente || extractedData?.cliente_provincia || '',
      cliente_pais: form.cliente_pais || extractedData?.pais_cliente || extractedData?.cliente_pais || '',
      concepto: form.concepto || '',
      base_imponible: parseFloat(form.base_imponible) || 0,
      tipo_iva: Number(form.tipo_iva ?? 0),
      cuota_iva: parseFloat(form.cuota_iva) || 0,
      retencion_irpf: parseFloat(form.retencion_irpf) || 0,
      importe_retencion: parseFloat(form.importe_retencion) || Math.round(((parseFloat(form.base_imponible) || 0) * (parseFloat(form.retencion_irpf) || 0) / 100) * 100) / 100,
      total_factura: parseFloat(form.total_factura) || 0,
      estado_cobro: form.estado_cobro || 'pendiente',
      tipo: 'emitida',
      estado_contable: 'pendiente',
      anio: year,
      trimestre,
      archivo_url: doc.fileStorageUrl || '',
      subido_por: user.email || '',
      origin: 'ocr',
      es_rectificativa: esRectificativa,
      factura_rectificada: form.factura_rectificada || extractedData?.factura_rectificada || undefined,
    };
  } else {
    // recibida / gasto
    invoiceData = {
      company_id: doc.company_id,
      numero_factura: numeroFactura,
      fecha_emision: form.fecha,
      fecha_recepcion: fechaRecepcion,
      proveedor_nombre: form.proveedor_cliente || '',
      proveedor_nif: form.nif_proveedor || extractedData?.nif_proveedor || '',
      proveedor_email: form.email_proveedor || extractedData?.email_proveedor || extractedData?.proveedor_email || '',
      proveedor_telefono: form.telefono_proveedor || extractedData?.telefono_proveedor || extractedData?.proveedor_telefono || '',
      proveedor_direccion: form.direccion_proveedor || extractedData?.direccion_proveedor || extractedData?.proveedor_direccion || '',
      proveedor_codigo_postal: form.codigo_postal_proveedor || extractedData?.codigo_postal_proveedor || extractedData?.proveedor_codigo_postal || '',
      proveedor_ciudad: form.ciudad_proveedor || extractedData?.ciudad_proveedor || extractedData?.proveedor_ciudad || '',
      proveedor_provincia: form.provincia_proveedor || extractedData?.provincia_proveedor || extractedData?.proveedor_provincia || '',
      proveedor_pais: form.pais_proveedor || extractedData?.pais_proveedor || extractedData?.proveedor_pais || '',
      concepto: form.concepto || '',
      base_imponible: parseFloat(form.base_imponible) || 0,
      tipo_iva: Number(form.tipo_impuesto ?? 0),
      cuota_iva: parseFloat(form.cuota_impuesto) || 0,
      retencion_irpf: parseFloat(form.retencion_irpf) || 0,
      importe_retencion: parseFloat(form.importe_retencion) || Math.round(((parseFloat(form.base_imponible) || 0) * (parseFloat(form.retencion_irpf) || 0) / 100) * 100) / 100,
      total_factura: parseFloat(form.total) || 0,
      estado_cobro: 'pendiente',
      tipo: 'recibida',
      estado_contable: 'pendiente',
      anio: year,
      trimestre,
      categoria_gasto: form.categoria || 'otros',
      archivo_url: doc.fileStorageUrl || '',
      subido_por: user.email || '',
      origin: 'ocr',
      es_rectificativa: esRectificativa,
      factura_rectificada: form.factura_rectificada || extractedData?.factura_rectificada || undefined,
    };
  }

  if (!pendingReview) Object.assign(invoiceData, {
    indirect_tax_kind: fiscalAssessment.taxKind, fiscal_treatment: fiscalAssessment.operationType,
    fiscal_regime: fiscalAssessment.regime, fiscal_activity_id: fiscalAssessment.activityId,
    fiscal_rule_set_version: fiscalAssessment.ruleSetVersion, fiscal_review_status: 'validado',
    fiscal_reviewed_at: new Date().toISOString(), fiscal_reviewed_by: user.email,
    fiscal_exemption_key: fiscalAssessment.exemptionKey, fiscal_legal_basis: fiscalAssessment.legalBasis,
    deductible_tax_amount: fiscalAssessment.deductibleTax,
    non_deductible_tax_amount: fiscalAssessment.nonDeductibleTax,
  });
  invoiceData.ocr_document_id = doc.id;
  if (manualAccount) {
    invoiceData.revenue_expense_account_code = manualAccount.code;
    invoiceData.revenue_expense_account_id = manualAccount.id;
  }
  invoiceData.accounting_review_status = 'pendiente_revision';
  invoiceData.accounting_schema_version = SCHEMA_VERSION;
  if (pendingReview) Object.assign(invoiceData, {
    fiscal_review_status: 'pendiente_revision', estado_contable: 'en_revision',
    fiscal_activity_id: form.fiscal_activity_id || fiscalAssessment?.activityId || '',
    accounting_migration_hold: true, accounting_migration_hold_reason: 'FISCAL_ADVISOR_REVIEW_PHASE1',
  });

  // Remove undefined keys
  Object.keys(invoiceData).forEach(k => {
    if (invoiceData[k] === undefined) delete invoiceData[k];
  });

  // 5. Create the Invoice with service role (bypasses RLS)
  console.log('[approveOcrDocument] Creating invoice for company:', doc.company_id, 'type:', invoiceType, 'fiscalStatus:', fiscalAssessment?.status);
  invoiceData.fiscalAssessment = JSON.stringify({
    status: fiscalAssessment?.status || 'blocked',
    treatment: fiscalAssessment?.operationType || '',
    confidence: fiscalAssessment?.confidence || 0,
    alerts: fiscalAssessment?.alerts || [],
    appliedRules: fiscalAssessment?.reasons || [],
    explanation: 'Evaluación del motor fiscal unificado, revisada al aprobar el OCR.',
  });
  if (!pendingReview && invoiceType === 'emitida') {
    try {
      const issuer = await base44.asServiceRole.entities.Company.get(doc.company_id);
      invoiceData.qr_url = buildAeatQrUrl(issuer, invoiceData);
      invoiceData.qr_mode = 'no_verifactu';
      invoiceData.qr_spec_version = 'AEAT-QR-0.5.0';
    } catch (qrError) {
      return { status: 422, json: { error: qrError.message || 'No se pudo preparar el QR tributario.' } };
    }
  }
  const duplicates = await findFinancialDuplicates(base44.asServiceRole, doc, invoiceData);
  if (duplicates.length) {
    await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, {
      duplicateWarning: `Posible factura ya registrada: ${duplicates.map(row => row.id).join(', ')}`,
      safeErrorMessage: 'Coinciden empresa, número, fecha, tercero e importe. Revisar el documento existente; no se creó otra factura.',
    });
    return { status: 409, json: { error: 'La factura coincide con una ya registrada. Revisión de duplicado requerida.', duplicate: true, invoiceIds: duplicates.map(row => row.id) } };
  }
  invoiceData.creation_idempotency_key = `ocr:${doc.id}`;
  const inv = await base44.asServiceRole.entities.Invoice.create(invoiceData);

  if (!inv || !inv.id) {
    console.error('[approveOcrDocument] Invoice creation returned no id:', JSON.stringify(inv));
    return { status: 500, json: { error: 'No se pudo crear la factura en el core financiero' } };
  }

  // Persist the link before tax/contact/posting work. If this update fails, the
  // next request still finds the Invoice by its persisted ocr_document_id.
  await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, {
    linkedInvoiceId: inv.id, lastStatusChangedAt: new Date().toISOString(),
  });
  console.log('[approveOcrDocument] Invoice created:', inv.id);
  if (pendingReview) {
    await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, {
      status: 'review_required', linkedInvoiceId: inv.id,
      safeErrorMessage: 'Extracción OCR conservada; pendiente de validación fiscal del asesor. Sin QR ni asiento.',
      lastStatusChangedAt: new Date().toISOString(),
      auditTrail: [...(Array.isArray(doc.auditTrail) ? doc.auditTrail : []), JSON.stringify({
        action: 'pendiente_revision_fiscal', invoiceId: inv.id, userEmail: user.email,
        manualAccount: manualAccount?.code || 'none', timestamp: new Date().toISOString(),
      })],
    });
    return { status: 200, json: { success: true, review_required: true, invoiceId: inv.id,
      message: 'Factura guardada para revisión fiscal, sin emitir ni contabilizar.' } };
  }
  try {
    await base44.asServiceRole.entities.InvoiceTaxLine.create({
      companyId: doc.company_id, invoiceId: inv.id, lineNumber: 1,
      operationDate: fechaEmision, receiptDate: invoiceType === 'recibida' ? fechaRecepcion : undefined,
      taxKind: fiscalAssessment.taxKind, regime: fiscalAssessment.regime,
      operationType: fiscalAssessment.operationType, activityId: fiscalAssessment.activityId,
      exemptionKey: fiscalAssessment.exemptionKey, legalBasis: fiscalAssessment.legalBasis,
      base: fiscalAssessment.base, rate: fiscalAssessment.taxRate, quota: fiscalAssessment.taxAmount,
      deductibleQuota: fiscalAssessment.deductibleTax, nonDeductibleQuota: fiscalAssessment.nonDeductibleTax,
      deductiblePercent: fiscalAssessment.deductiblePercent,
      deductible: invoiceType === 'recibida' && fiscalAssessment.nonDeductibleTax === 0,
      source: 'ocr', reviewStatus: 'validado', reviewedAt: new Date().toISOString(),
      reviewedBy: user.email, ruleSetVersion: fiscalAssessment.ruleSetVersion, schemaVersion: SCHEMA_VERSION,
    });
  } catch (taxLineError) {
    await base44.asServiceRole.entities.Invoice.update(inv.id, { estado_contable: 'requiere_correccion', accounting_review_status: 'requiere_correccion', accounting_migration_hold: true, accounting_migration_hold_reason: 'Falló el registro fiscal OCR.' });
    await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, { status: 'review_required', linkedInvoiceId: inv.id, safeErrorMessage: 'Factura conservada sin contabilizar: falta su línea fiscal.' });
    return { status: 503, json: { error: 'La factura se conservó sin contabilizar; falta su línea fiscal y requiere revisión.', invoiceId: inv.id } };
  }

  await base44.asServiceRole.functions.invoke('syncInvoiceContacts', {
    action: 'sync_invoice',
    invoiceId: inv.id,
  }).catch((error) => console.warn('[approveOcrDocument] Contact sync failed:', error?.message || error));

  let posting;
  try {
    posting = await postInvoice(base44.asServiceRole, doc.company_id, inv, user.email, {
      ocrDocumentId: doc.id,
      source: 'OCR',
      status: 'confirmado',
    });
  } catch (postingError) {
    await base44.asServiceRole.entities.Invoice.update(inv.id, {
      estado_contable: 'requiere_correccion',
      accounting_review_status: 'requiere_correccion',
      comentarios: `Error al generar el asiento OCR: ${postingError.message}`,
    });
    await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, {
      status: 'review_required',
      linkedInvoiceId: inv.id,
      safeErrorMessage: `La factura se guardó, pero el asiento no pudo generarse: ${postingError.message}`,
      lastStatusChangedAt: new Date().toISOString(),
    });
    return {
      status: 422,
      json: {
        error: 'La factura se ha conservado, pero el asiento contable necesita corrección manual.',
        detail: postingError.message,
        invoiceId: inv.id,
      },
    };
  }

  // 6. Build audit trail entry
  const auditEntry = JSON.stringify({
    action: 'contabilizado',
    userId: user.id,
    userEmail: user.email,
    timestamp: new Date().toISOString(),
    prevStatus: doc.status,
    newStatus: 'accounted',
    detail: `invoice=${inv.id} journalEntry=${posting.entry.id} type=${invoiceType} schema=${SCHEMA_VERSION} manualAccount=${manualAccount?.code || 'none'}`,
    source: 'approveOcrDocument',
  });

  const existingTrail = Array.isArray(doc.auditTrail) ? doc.auditTrail : [];
  const now = new Date().toISOString();

  // 7. Update the OCR document with service role
  await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, {
    status: 'accounted',
    accountedAt: now,
    linkedInvoiceId: inv.id,
    linkedJournalEntryId: posting.entry.id,
    accountingSchemaVersion: SCHEMA_VERSION,
    reviewedAt: now,
    lastStatusChangedAt: now,
    reviewedByAdminId: user.id,
    auditTrail: [...existingTrail, auditEntry],
  });

  console.log('[approveOcrDocument] OCR document updated:', doc.id);

  // 8. Create timeline event
  try {
    await base44.asServiceRole.entities.TimelineEvent.create({
      company_id: doc.company_id,
      tipo: 'factura_contabilizada',
      titulo: invoiceType === 'emitida'
        ? `Factura emitida aprobada via OCR: ${numeroFactura}${esRectificativa ? ' (RECTIFICATIVA)' : ''}`
        : `Factura recibida aprobada via OCR: ${numeroFactura}${esRectificativa ? ' (RECTIFICATIVA)' : ''}`,
      descripcion: `Factura ${invoiceType === 'emitida' ? 'emitida' : 'recibida'} creada desde documento OCR. Total: ${invoiceData.total_factura} EUR${esRectificativa ? ' · Factura rectificativa (importes negativos)' : ''}`,
      color: 'verde',
      usuario_email: user.email || '',
      automatico: true,
      visibilidad: 'ambos',
    });
  } catch (e) {
    console.warn('[approveOcrDocument] Timeline event failed:', e.message);
  }

  return {
    status: 200,
    json: {
      success: true,
      invoiceId: inv.id,
      journalEntryId: posting.entry.id,
      accountCode: posting.proposal?.counterparty?.account?.code || '',
      message: 'Factura creada, validada y contabilizada con asiento de 8 dígitos'
    },
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || ['bloqueado', 'suspendido', 'eliminado'].includes(user.status) || user.is_deleted === true) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { docId, form, invoiceType, extractedData } = body;

    if (body.action === 'recover_existing') {
      if (!['admin', 'super_admin'].includes(user.role)) return Response.json({ error: 'Solo administradores pueden recuperar la contabilización existente.' }, { status: 403 });
      if (!body.companyId || !docId) return Response.json({ error: 'Faltan companyId y docId.' }, { status: 400 });
      const existingDoc = await base44.asServiceRole.entities.OcrInvoiceDocument.get(docId);
      if (!existingDoc || existingDoc.company_id !== body.companyId) return Response.json({ error: 'Documento ajeno a la empresa.' }, { status: 403 });
      const type = existingDoc.documentType === 'expense_invoice' ? 'recibida' : 'emitida';
      const result = await approveOne(base44, user, existingDoc, {}, type, {}, true, true);
      return Response.json(result.json, { status: result.status });
    }

    // Modo masivo: aprobación en cola con tratamiento fiscal corregido del asesor
    // (solo admin/super_admin, limitado a la empresa indicada y a facturas recibidas).
    if (body.action === 'bulk_approve') {
      if (!['admin', 'super_admin'].includes(user.role)) {
        return Response.json({ error: 'Forbidden: solo administradores' }, { status: 403 });
      }
      if (body.confirm_fiscal_review !== true) return Response.json({ error: 'La aprobación masiva requiere confirmación fiscal expresa del asesor.' }, { status: 422 });
      const { companyId, docIds } = body;
      if (!companyId) {
        return Response.json({ error: 'Falta el parametro companyId' }, { status: 400 });
      }
      let pendingDocIds = docIds;
      if (body.all === true) {
        const pendingDocs = await base44.asServiceRole.entities.OcrInvoiceDocument.filter({
          company_id: companyId,
          status: 'review_required',
        });
        pendingDocIds = (pendingDocs || [])
          .filter(d => !d.linkedInvoiceId && d.documentType === 'expense_invoice')
          .map(d => d.id);
      }
      if (!Array.isArray(pendingDocIds) || pendingDocIds.length === 0) {
        return Response.json({ success: true, approved: 0, review: 0, skipped: 0, failed: 0, errors: [], remaining: 0, note: 'No hay documentos pendientes en la cola.' });
      }
      const activities = await base44.asServiceRole.entities.FiscalActivity.filter({ company_id: companyId, active: true });
      const activityId = activities?.[0]?.id;

      const BATCH_LIMIT = 4;
      const totalPending = pendingDocIds.length;
      pendingDocIds = pendingDocIds.slice(0, BATCH_LIMIT);
      const summary = { approved: 0, review: 0, skipped: 0, failed: 0, errors: [], remaining: Math.max(0, totalPending - pendingDocIds.length) };
      const CHUNK = 1;
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let i = 0; i < pendingDocIds.length; i += CHUNK) {
        if (i > 0) await sleep(2500);
        const chunk = pendingDocIds.slice(i, i + CHUNK);
        const settled = await Promise.all(chunk.map(async (id) => {
          try {
            const doc = await base44.asServiceRole.entities.OcrInvoiceDocument.get(id);
            if (!doc || doc.company_id !== companyId) return { outcome: 'skipped', reason: 'Documento no encontrado o de otra empresa', id };
            let ex = null;
            try { ex = JSON.parse(doc.extractedData || 'null'); } catch { ex = null; }
            if (!ex || !(Number(ex.base_imponible) > 0)) return { outcome: 'skipped', reason: 'Sin datos extraídos o base 0; requiere reanálisis o rechazo manual', id, name: doc.originalFileName };
            if (doc.documentType !== 'expense_invoice') return { outcome: 'skipped', reason: 'Solo facturas recibidas en la cola masiva', id, name: doc.originalFileName };
            const form = buildBulkCorrectedForm(ex);
            if (!Number.isFinite(Number(ex.total)) || Math.abs(Math.round(form.total * 100) - Math.round(Number(ex.total) * 100)) > 2) {
              return { outcome: 'skipped', reason: 'El tratamiento automático cambiaría el total original. Revisar impuestos no deducibles y retenciones sin borrar cuotas del gasto.', id, name: doc.originalFileName };
            }
            form.fiscal_activity_id = activityId || undefined;
            const res = await approveOne(base44, user, doc, form, 'recibida', ex, true);
            if (res.status === 200 && res.json?.success && !res.json?.review_required) return { outcome: 'approved', invoiceId: res.json.invoiceId, name: doc.originalFileName };
            if (res.status === 200) return { outcome: 'review', reason: res.json?.message || 'Pendiente de revisión', id, name: doc.originalFileName };
            return { outcome: 'failed', reason: res.json?.error || 'Error', id, name: doc.originalFileName };
          } catch (e) {
            return { outcome: 'failed', reason: e.message || 'Error interno', id };
          }
        }));
        for (const r of settled) {
          if (r.outcome === 'approved') summary.approved++;
          else if (r.outcome === 'review') summary.review++;
          else if (r.outcome === 'skipped') { summary.skipped++; summary.errors.push({ docId: r.id, name: r.name, reason: r.reason }); }
          else { summary.failed++; summary.errors.push({ docId: r.id, name: r.name, reason: r.reason }); }
        }
      }
      console.log('[approveOcrDocument] bulk_approve summary:', JSON.stringify(summary));
      return Response.json({ success: true, ...summary });
    }

    if (!docId || !form || !invoiceType) {
      return Response.json({ error: 'Faltan parametros: docId, form, invoiceType' }, { status: 400 });
    }

    // 1. Fetch the OCR document with service role to get full data
    const doc = await base44.asServiceRole.entities.OcrInvoiceDocument.get(docId);
    if (!doc) {
      return Response.json({ error: 'Documento OCR no encontrado' }, { status: 404 });
    }

    // 1.5. Ownership check: non-admin users can only approve their own company's documents
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (!isAdmin && doc.company_id !== user.data?.company_id) {
      return Response.json({ error: 'Forbidden: document does not belong to your company' }, { status: 403 });
    }

    const res = await approveOne(base44, user, doc, form, invoiceType, extractedData, body.confirm_fiscal_review === true);
    return Response.json(res.json, { status: res.status });
  } catch (error) {
    console.error('[approveOcrDocument] Error:', error.message, error.stack);
    const status = Number(error?.status);
    return Response.json({ error: error.message || 'Error interno del servidor' }, { status: Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500 });
  }
});
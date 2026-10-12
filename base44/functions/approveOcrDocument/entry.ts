import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { postInvoice, SCHEMA_VERSION, canonical8 } from './accountingEngine.ts';
import { buildAeatQrUrl } from './invoiceQr.ts';
import { ensureInvoiceQrHash } from './invoiceQrHash.ts';
import { acquireApprovalLease, resumeExistingOcr, findFinancialDuplicates } from './ocrRecovery.ts';

// Preserve document amounts. A non-deductible quota is a cost, not a removed tax.
// Fiscal validation may reject this proposal; it must never rewrite the payable.
function buildBulkCorrectedForm(ex) {
  const base = Math.round((Number(ex?.base_imponible) || 0) * 100) / 100;
  const ret = Number(ex?.retencion_irpf) || 0;
  const importeRet = Number(ex?.importe_retencion ?? 0);
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
    fecha_recepcion: ex?.fecha_recepcion || new Date().toISOString().slice(0, 10),
    base_imponible: base,
    tipo_impuesto: Number(ex?.tipo_impuesto ?? 0),
    cuota_impuesto: Number(ex?.cuota_impuesto ?? 0),
    retencion_irpf: ret,
    retencion_tipo: ex?.retencion_tipo || 'ninguna',
    importe_retencion: importeRet,
    total: Number(ex?.total),
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
    let resumed;
    try { resumed = await resumeExistingOcr(svc, user, doc, invoiceType, confirmFiscalReview, postInvoice, SCHEMA_VERSION,
      !recoveryOnly ? async invoice => {
        const response = await base44.functions.invoke('invoiceOperations',{action:'confirm_source_invoice',
          company_id:doc.company_id,invoice_id:invoice.id,criteria:{...(form.fiscal_criteria || {}),
            activityId:form.fiscal_activity_id || undefined, accountCode:form.cuenta_contable_manual || undefined}});
        const result=response?.data??response;
        if(!result?.success) throw new Error(result?.error || 'No se pudo completar el documento.');
        return result.invoice;
      } : null); }
    catch(error) {
      const detail=String(error?.response?.data?.error || error.message || 'No se pudo completar el OCR.').slice(0,500);
      const current=await svc.entities.OcrInvoiceDocument.get(doc.id);
      if(current?.status!=='accounted') await svc.entities.OcrInvoiceDocument.update(doc.id,{status:'review_required',safeErrorMessage:detail,lastStatusChangedAt:new Date().toISOString()});
      return {status:Number(error?.response?.status || error.status)||422,json:{error:detail,invoiceId:doc.linkedInvoiceId || null}};
    }
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
  const suggestedAccountInput = !manualAccountInput ? String(form.cuenta_pgc || extractedData?.cuenta_pgc || '').trim() : '';
  const expectedGroup = invoiceType === 'emitida' ? '7' : '6';
  if (suggestedAccountInput && (!/^\d{3,8}$/.test(suggestedAccountInput) || !suggestedAccountInput.startsWith(expectedGroup))) {
    return { status: 422, json: { error: `La cuenta ${suggestedAccountInput} propuesta por el OCR no es una cuenta válida del grupo ${expectedGroup}. Revísala individualmente.` } };
  }
  const suggestedAccountCode = suggestedAccountInput ? canonical8(suggestedAccountInput) : '';
  if (suggestedAccountCode) {
    const existing = await base44.asServiceRole.entities.AccountingAccount.filter({ companyId: doc.company_id, code: suggestedAccountCode });
    if (existing?.some(account => account.status === 'inactiva' || account.type !== (invoiceType === 'emitida' ? 'ingreso' : 'gasto'))) {
      return { status: 422, json: { error: `La cuenta ${suggestedAccountCode} propuesta por el OCR está inactiva o tiene otro tipo. Revísala individualmente.` } };
    }
  }
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
    : (form.numero_factura || extractedData?.numero_factura || '');

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

  const sourceTotal = Number(invoiceType === 'emitida' ? form.total_factura : form.total);
  const sourceQuota = Number(invoiceType === 'emitida' ? form.cuota_iva : form.cuota_impuesto);
  const rate = Number(invoiceType === 'emitida' ? form.tipo_iva : form.tipo_impuesto);
  const withholding = Number(form.importe_retencion ?? Math.round(baseImponible * Number(form.retencion_irpf || 0)) / 100);
  if (![sourceTotal,sourceQuota,rate,withholding].every(Number.isFinite)
    || Math.abs(sourceTotal - Math.round((baseImponible + sourceQuota - withholding)*100)/100) > 0.02)
    return {status:422,json:{error:'Base, cuota, retención y total no cuadran. Corrige los importes en este mismo OCR.'}};

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
      retencion_tipo: form.retencion_tipo || 'ninguna',
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
      retencion_tipo: form.retencion_tipo || 'ninguna',
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

  invoiceData.ocr_document_id = doc.id;
  invoiceData.fiscal_activity_id = form.fiscal_activity_id || '';
  invoiceData.indirect_tax_kind = form.fiscal_criteria?.taxKind || undefined;
  if (manualAccount) {
    invoiceData.revenue_expense_account_code = manualAccount.code;
    invoiceData.revenue_expense_account_id = manualAccount.id;
  } else if (suggestedAccountCode) {
    // Cada OCR conserva su propia cuenta propuesta; nunca se copia la de otra factura del lote.
    invoiceData.revenue_expense_account_code = suggestedAccountCode;
  }
  invoiceData.accounting_review_status = 'pendiente_revision';
  invoiceData.accounting_schema_version = SCHEMA_VERSION;
  invoiceData.fiscal_review_status = 'pendiente_revision';
  invoiceData.accounting_migration_hold = true;
  invoiceData.accounting_migration_hold_reason = 'SOURCE_CHECK_PENDING';

  // Remove undefined keys
  Object.keys(invoiceData).forEach(k => {
    if (invoiceData[k] === undefined) delete invoiceData[k];
  });

  // 5. Create the Invoice with service role (bypasses RLS)
  console.log('[approveOcrDocument] Confirming source document:', doc.id);
  invoiceData.fiscalAssessment = JSON.stringify({source:'single_ocr_check'});
  const duplicates = await findFinancialDuplicates(base44.asServiceRole, doc, invoiceData);
  if (duplicates.length) {
    await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, {
      duplicateWarning: `Posible factura ya registrada: ${duplicates.map(row => row.id).join(', ')}`,
      safeErrorMessage: 'Coinciden empresa, dirección, tercero, número y fecha. Revisa la factura existente; no se creó otra.',
    });
    return { status: 409, json: { error: 'La factura coincide con una ya registrada. Revisión de duplicado requerida.', duplicate: true, invoiceIds: duplicates.map(row => row.id) } };
  }
  invoiceData.creation_idempotency_key = `ocr:${doc.id}`;
  const created = await base44.asServiceRole.entities.Invoice.create(invoiceData);
  if (!created || !created.id) {
    console.error('[approveOcrDocument] Invoice creation returned no id:', JSON.stringify(created));
    return { status: 500, json: { error: 'No se pudo crear la factura en el core financiero' } };
  }

  // Enlazar antes de la huella: un fallo se recupera por OCR sin crear otra factura.
  await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id, {
    linkedInvoiceId: created.id, lastStatusChangedAt: new Date().toISOString(),
  });
  const inv = await ensureInvoiceQrHash(base44.asServiceRole.entities.Invoice, created);
  console.log('[approveOcrDocument] Invoice created:', inv.id);
  let completed;
  try {
    const response=await base44.functions.invoke('invoiceOperations',{action:'confirm_source_invoice',
      company_id:doc.company_id,invoice_id:inv.id,
      criteria:{...(form.fiscal_criteria || {}),activityId:form.fiscal_activity_id || undefined, accountCode:form.cuenta_contable_manual || undefined}});
    completed=response?.data??response;
    if(!completed?.success) throw new Error(completed?.error || 'No se pudo completar el asiento.');
  } catch(error) {
    const detail=error?.response?.data?.error || error.message || 'Error al confirmar el documento.';
    await base44.asServiceRole.entities.OcrInvoiceDocument.update(doc.id,{status:'review_required',
      linkedInvoiceId:inv.id,safeErrorMessage:detail,lastStatusChangedAt:new Date().toISOString()});
    return {status:Number(error?.response?.status || error.status)||422,json:{error:detail,invoiceId:inv.id}};
  }

  const posting = {entry:{id:completed.journalEntryId},proposal:null};

  // The invoice and journal are already committed. Independent follow-up tasks run concurrently.
  const followUps = await Promise.allSettled([
    base44.asServiceRole.functions.invoke('syncInvoiceContacts', { action: 'sync_invoice', invoiceId: inv.id }),
    base44.asServiceRole.entities.TimelineEvent.create({
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
    }),
  ]);
  if (followUps[0].status === 'rejected') console.warn('[approveOcrDocument] Contact sync failed:', followUps[0].reason?.message || followUps[0].reason);
  if (followUps[1].status === 'rejected') console.warn('[approveOcrDocument] Timeline event failed:', followUps[1].reason?.message || followUps[1].reason);

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
        }, 'id', 5000);
        pendingDocIds = (pendingDocs || [])
          .filter(d => !d.linkedInvoiceId && d.documentType === 'expense_invoice')
          .map(d => d.id);
      }
      if (!Array.isArray(pendingDocIds) || pendingDocIds.length === 0) {
        return Response.json({ success: true, approved: 0, review: 0, skipped: 0, failed: 0, errors: [], remaining: 0, note: 'No hay documentos pendientes en la cola.' });
      }
      const activities = await base44.asServiceRole.entities.FiscalActivity.filter({ company_id: companyId, active: true });
      const selectedActivity = body.fiscal_activity_id ? activities?.find(row => row.id === body.fiscal_activity_id) : activities?.length === 1 ? activities[0] : null;
      if (!selectedActivity) return Response.json({ error: 'Selecciona una actividad fiscal exacta y activa antes de aprobar el lote.' }, { status: 422 });
      const activityId = selectedActivity.id;

      const BATCH_LIMIT = 8;
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

    // approveOne verifica acceso real a la empresa, también para usuarios autorizados.

    const res = await approveOne(base44, user, doc, form, invoiceType, extractedData, true);
    return Response.json(res.json, { status: res.status });
  } catch (error) {
    console.error('[approveOcrDocument] Error:', error.message, error.stack);
    const status = Number(error?.response?.status || error?.status);
    return Response.json({ error: error?.response?.data?.error || error.message || 'Error interno del servidor' }, { status: Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500 });
  }
});
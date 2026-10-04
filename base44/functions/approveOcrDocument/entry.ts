import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { postInvoice, SCHEMA_VERSION, canonical8 } from './accountingEngine.ts';
import { buildAeatQrUrl } from './invoiceQr.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { docId, form, invoiceType, extractedData } = body;

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

    // 2. Idempotency: if already linked, return existing
    if (doc.linkedInvoiceId) {
      return Response.json({
        success: true,
        invoiceId: doc.linkedInvoiceId,
        message: 'El documento ya estaba procesado',
        alreadyProcessed: true
      });
    }

    // 3. Validate direction and any explicit PGC override before creating an invoice.
    const expectedType = doc.documentType === 'income_invoice' ? 'emitida'
      : doc.documentType === 'expense_invoice' ? 'recibida' : null;
    if (!expectedType || invoiceType !== expectedType) {
      return Response.json({ error: 'El tipo de factura no coincide con el documento OCR.' }, { status: 422 });
    }

    const manualAccountInput = String(form.cuenta_contable_manual || '').trim();
    let manualAccount = null;
    if (manualAccountInput) {
      const expectedGroup = invoiceType === 'emitida' ? '7' : '6';
      const expectedAccountType = invoiceType === 'emitida' ? 'ingreso' : 'gasto';
      if (!/^\d{3,8}$/.test(manualAccountInput) || !manualAccountInput.startsWith(expectedGroup)) {
        return Response.json({ error: `La cuenta manual debe ser del grupo ${expectedGroup} y tener entre 3 y 8 dígitos.` }, { status: 422 });
      }
      const accountCode = canonical8(manualAccountInput);
      const accounts = await base44.asServiceRole.entities.AccountingAccount.filter({ companyId: doc.company_id, code: accountCode });
      manualAccount = (accounts || []).find(account => account.companyId === doc.company_id && account.code === accountCode && account.status !== 'inactiva' && account.type === expectedAccountType);
      if (!manualAccount) {
        return Response.json({ error: `La cuenta ${accountCode} no existe como cuenta activa de ${expectedAccountType} en el plan contable de esta empresa. Créala o actívala en Contabilidad antes de aprobar.` }, { status: 422 });
      }
    }

    const numeroFactura = invoiceType === 'emitida'
      ? (form.numero_factura || extractedData?.numero_factura || '')
      : (extractedData?.numero_factura || form.numero_factura || '');

    if (!numeroFactura) {
      return Response.json({ error: 'El numero de factura es obligatorio' }, { status: 400 });
    }

    const fechaEmision = invoiceType === 'emitida' ? form.fecha_emision : form.fecha;
    if (!fechaEmision) {
      return Response.json({ error: 'La fecha es obligatoria' }, { status: 400 });
    }
    const fechaRecepcion = invoiceType === 'recibida'
      ? (form.fecha_recepcion || String(doc.uploadedAt || doc.created_date || new Date().toISOString()).slice(0, 10))
      : '';
    if (invoiceType === 'recibida' && fechaRecepcion < fechaEmision) {
      return Response.json({ error: 'La fecha real de recepción no puede ser anterior a la fecha de emisión.' }, { status: 400 });
    }

    const baseImponible = parseFloat(form.base_imponible) || 0;
    const esRectificativa = form.es_rectificativa === true || form.es_rectificativa === 'true' || extractedData?.es_rectificativa === true;
    if (baseImponible === 0) {
      return Response.json({ error: 'La base imponible no puede ser 0' }, { status: 400 });
    }
    if (baseImponible < 0 && !esRectificativa) {
      return Response.json({ error: 'Base imponible negativa solo permitida en facturas rectificativas. Marca la opción es_rectificativa.' }, { status: 400 });
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
      return Response.json({ error: 'No se pudo verificar el encuadramiento fiscal. El documento OCR sigue pendiente y no se ha creado una factura.' }, { status: 503 });
    }
    if (!fiscalAssessment || fiscalAssessment.status === 'blocked') {
      return Response.json({ error: fiscalAssessment?.reasons?.join(' ') || 'Valida el perfil fiscal antes de aprobar el OCR.' }, { status: 422 });
    }
    if (!['general', 'exenta_limitada', 'exenta_plena', 'pequeno_empresario_igic'].includes(fiscalAssessment.regime)
      || fiscalAssessment.accounting?.reverseCharge || !['iva', 'igic'].includes(fiscalAssessment.taxKind)) {
      return Response.json({ error: 'Régimen u operación especial pendiente de revisión del asesor; el documento OCR se conserva sin contabilizar.' }, { status: 422 });
    }
    if (fiscalAssessment.operationType === 'exempt_limited' && (!fiscalAssessment.exemptionKey || !fiscalAssessment.legalBasis)) {
      return Response.json({ error: 'Falta clave de exención o fundamento legal confirmado por el asesor.' }, { status: 422 });
    }
    const sourceTotal = Number(invoiceType === 'emitida' ? form.total_factura : form.total);
    if (!Number.isFinite(sourceTotal)
      || Math.abs(sourceTotal - fiscalAssessment.total) > 0.02
      || Math.abs(Number(invoiceType === 'emitida' ? form.tipo_iva : form.tipo_impuesto) - fiscalAssessment.taxRate) > 0.0001
      || Math.abs(Number(invoiceType === 'emitida' ? form.cuota_iva : form.cuota_impuesto) - fiscalAssessment.taxAmount) > 0.02) {
      return Response.json({ error: 'Los importes OCR no coinciden con el perfil fiscal validado. Revisa base, tipo, cuota, retención y total antes de aprobar.' }, { status: 422 });
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
        tipo_iva: parseFloat(form.tipo_iva) || 21,
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
        tipo_iva: parseFloat(form.tipo_impuesto) || 21,
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

    invoiceData.ocr_document_id = docId;
    if (manualAccount) {
      invoiceData.revenue_expense_account_code = manualAccount.code;
      invoiceData.revenue_expense_account_id = manualAccount.id;
    }
    invoiceData.accounting_review_status = 'pendiente_revision';
    invoiceData.accounting_schema_version = SCHEMA_VERSION;

    // Remove undefined keys
    Object.keys(invoiceData).forEach(k => {
      if (invoiceData[k] === undefined) delete invoiceData[k];
    });

    // 5. Create the Invoice with service role (bypasses RLS)
    console.log('[approveOcrDocument] Creating invoice for company:', doc.company_id, 'type:', invoiceType, 'fiscalStatus:', fiscalAssessment?.status);
    if (fiscalAssessment) {
      invoiceData.fiscalAssessment = JSON.stringify({
        status: fiscalAssessment.status,
        treatment: fiscalAssessment.proposedTreatment,
        confidence: fiscalAssessment.confidence,
        alerts: fiscalAssessment.alerts,
        appliedRules: fiscalAssessment.appliedRules,
        explanation: fiscalAssessment.explanation,
      });
    }
    if (invoiceType === 'emitida') {
      try {
        const issuer = await base44.asServiceRole.entities.Company.get(doc.company_id);
        invoiceData.qr_url = buildAeatQrUrl(issuer, invoiceData);
        invoiceData.qr_mode = 'no_verifactu';
        invoiceData.qr_spec_version = 'AEAT-QR-0.5.0';
      } catch (qrError) {
        return Response.json({ error: qrError.message || 'No se pudo preparar el QR tributario.' }, { status: 422 });
      }
    }
    const inv = await base44.asServiceRole.entities.Invoice.create(invoiceData);

    if (!inv || !inv.id) {
      console.error('[approveOcrDocument] Invoice creation returned no id:', JSON.stringify(inv));
      return Response.json({ error: 'No se pudo crear la factura en el core financiero' }, { status: 500 });
    }

    console.log('[approveOcrDocument] Invoice created:', inv.id);

    await base44.asServiceRole.functions.invoke('syncInvoiceContacts', {
      action: 'sync_invoice',
      invoiceId: inv.id,
    }).catch((error) => console.warn('[approveOcrDocument] Contact sync failed:', error?.message || error));

    let posting;
    try {
      posting = await postInvoice(base44.asServiceRole, doc.company_id, inv, user.email, {
        ocrDocumentId: docId,
        source: 'OCR',
        status: 'confirmado',
      });
    } catch (postingError) {
      await base44.asServiceRole.entities.Invoice.update(inv.id, {
        estado_contable: 'requiere_correccion',
        accounting_review_status: 'requiere_correccion',
        comentarios: `Error al generar el asiento OCR: ${postingError.message}`,
      });
      await base44.asServiceRole.entities.OcrInvoiceDocument.update(docId, {
        status: 'review_required',
        safeErrorMessage: `La factura se guardó, pero el asiento no pudo generarse: ${postingError.message}`,
        lastStatusChangedAt: new Date().toISOString(),
      });
      return Response.json({
        error: 'La factura se ha conservado, pero el asiento contable necesita corrección manual.',
        detail: postingError.message,
        invoiceId: inv.id,
      }, { status: 422 });
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
    await base44.asServiceRole.entities.OcrInvoiceDocument.update(docId, {
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

    console.log('[approveOcrDocument] OCR document updated:', docId);

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

    return Response.json({
      success: true,
      invoiceId: inv.id,
      journalEntryId: posting.entry.id,
      accountCode: posting.proposal?.counterparty?.account?.code || '',
      message: 'Factura creada, validada y contabilizada con asiento de 8 dígitos'
    });

  } catch (error) {
    console.error('[approveOcrDocument] Error:', error.message, error.stack);
    return Response.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
});

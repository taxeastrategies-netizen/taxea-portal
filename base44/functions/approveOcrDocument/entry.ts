import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    // 2. Idempotency: if already linked, return existing
    if (doc.linkedInvoiceId) {
      return Response.json({
        success: true,
        invoiceId: doc.linkedInvoiceId,
        message: 'El documento ya estaba procesado',
        alreadyProcessed: true
      });
    }

    // 3. Validate required fields
    const required = invoiceType === 'emitida'
      ? ['numero_factura', 'fecha_emision', 'base_imponible']
      : ['fecha', 'base_imponible'];

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

    const baseImponible = parseFloat(form.base_imponible) || 0;
    const esRectificativa = form.es_rectificativa === true || form.es_rectificativa === 'true' || extractedData?.es_rectificativa === true;
    if (baseImponible === 0) {
      return Response.json({ error: 'La base imponible no puede ser 0' }, { status: 400 });
    }
    if (baseImponible < 0 && !esRectificativa) {
      return Response.json({ error: 'Base imponible negativa solo permitida en facturas rectificativas. Marca la opción es_rectificativa.' }, { status: 400 });
    }

    // 3.5. Fiscal engine check: evaluate treatment before allowing contabilización
    let fiscalAssessment = null;
    try {
      const direction = invoiceType === 'emitida' ? 'ingreso' : 'gasto';
      const counterpartyName = invoiceType === 'emitida' ? form.cliente_nombre : form.proveedor_cliente;
      const counterpartyTaxId = invoiceType === 'emitida' ? form.cliente_nif : extractedData?.nif_proveedor;
      const invoiceBase = parseFloat(form.base_imponible) || 0;
      const invoiceTaxRate = parseFloat(invoiceType === 'emitida' ? form.tipo_iva : form.tipo_impuesto) || 0;
      const invoiceTaxAmount = parseFloat(invoiceType === 'emitida' ? form.cuota_iva : form.cuota_impuesto) || 0;
      const invoiceWithholdingRate = parseFloat(form.retencion_irpf) || 0;
      const invoiceWithholdingAmount = parseFloat(form.importe_retencion) || 0;

      const profiles = await base44.asServiceRole.entities.FiscalProfile.filter({ company_id: doc.company_id, active: true });
      if (profiles && profiles.length > 0) {
        // Profile exists - run fiscal evaluation
        const assessmentRes = await base44.functions.invoke('evaluateFiscalTreatment', {
          ocrData: extractedData,
          companyId: doc.company_id,
          direction,
          counterpartyName,
          counterpartyTaxId,
          invoiceBase,
          invoiceTaxRate,
          invoiceTaxAmount,
          invoiceWithholdingRate,
          invoiceWithholdingAmount,
          esProveedorExtranjero: extractedData?.es_proveedor_extranjero,
          detectedOperationType: extractedData?.tipo_operacion,
          ocrDocumentId: docId,
        });
        fiscalAssessment = assessmentRes?.data || assessmentRes;

        // Block if fiscal engine says blocked
        if (fiscalAssessment?.status === 'blocked_conflict_ocr_vs_config') {
          return Response.json({
            error: 'BLOQUEO FISCAL: ' + (fiscalAssessment.alerts?.[0] || 'Conflicto entre datos OCR y configuración fiscal del cliente.'),
            fiscalStatus: fiscalAssessment.status,
            fiscalAlerts: fiscalAssessment.alerts,
          }, { status: 422 });
        }
        if (fiscalAssessment?.status === 'blocked_missing_fiscal_profile') {
          return Response.json({
            error: 'Falta configuración fiscal. Configura el perfil fiscal en Ajustes > Fiscalidad antes de contabilizar.',
            fiscalStatus: fiscalAssessment.status,
          }, { status: 422 });
        }
        // For review_required, log warning but allow approval (human reviewer decided)
        console.log('[approveOcrDocument] Fiscal assessment:', fiscalAssessment.status, 'confidence:', fiscalAssessment.confidence);
      }
    } catch (fiscalError) {
      console.warn('[approveOcrDocument] Fiscal check failed (non-blocking):', fiscalError.message);
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
        concepto: form.concepto || '',
        base_imponible: parseFloat(form.base_imponible) || 0,
        tipo_iva: parseFloat(form.tipo_iva) || 21,
        cuota_iva: parseFloat(form.cuota_iva) || 0,
        retencion_irpf: parseFloat(form.retencion_irpf) || 0,
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
        proveedor_nombre: form.proveedor_cliente || '',
        proveedor_nif: extractedData?.nif_proveedor || '',
        concepto: form.concepto || '',
        base_imponible: parseFloat(form.base_imponible) || 0,
        tipo_iva: parseFloat(form.tipo_impuesto) || 21,
        cuota_iva: parseFloat(form.cuota_impuesto) || 0,
        retencion_irpf: parseFloat(form.retencion_irpf) || 0,
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
    const inv = await base44.asServiceRole.entities.Invoice.create(invoiceData);

    if (!inv || !inv.id) {
      console.error('[approveOcrDocument] Invoice creation returned no id:', JSON.stringify(inv));
      return Response.json({ error: 'No se pudo crear la factura en el core financiero' }, { status: 500 });
    }

    console.log('[approveOcrDocument] Invoice created:', inv.id);

    // 6. Build audit trail entry
    const auditEntry = JSON.stringify({
      action: 'contabilizado',
      userId: user.id,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      prevStatus: doc.status,
      newStatus: 'accounted',
      detail: `invoice=${inv.id} type=${invoiceType}`,
      source: 'approveOcrDocument',
    });

    const existingTrail = Array.isArray(doc.auditTrail) ? doc.auditTrail : [];
    const now = new Date().toISOString();

    // 7. Update the OCR document with service role
    await base44.asServiceRole.entities.OcrInvoiceDocument.update(docId, {
      status: 'accounted',
      accountedAt: now,
      linkedInvoiceId: inv.id,
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
      message: 'Factura creada y documento contabilizado correctamente'
    });

  } catch (error) {
    console.error('[approveOcrDocument] Error:', error.message, error.stack);
    return Response.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
});
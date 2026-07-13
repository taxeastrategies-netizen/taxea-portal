import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ocrData, companyId, direction, counterpartyTaxId, counterpartyName, invoiceTotal, invoiceBase, invoiceTaxRate, invoiceTaxAmount, invoiceWithholdingRate, invoiceWithholdingAmount, esProveedorExtranjero, detectedOperationType } = body;

    if (!companyId || !direction) {
      return Response.json({ error: 'Faltan parametros: companyId, direction' }, { status: 400 });
    }

    // 1. Load fiscal profile for company
    const profiles = await base44.asServiceRole.entities.FiscalProfile.filter({ company_id: companyId, active: true });
    const profile = profiles?.[0] || null;

    if (!profile) {
      return Response.json({
        success: true,
        status: 'blocked_missing_fiscal_profile',
        confidence: 0,
        alerts: ['No hay perfil fiscal configurado para esta empresa. Configura Ajustes > Fiscalidad para activar el motor.'],
        explanation: 'Falta configuracion fiscal del cliente. No se puede clasificar fiscalmente.',
        proposedTreatment: 'sin_configuracion',
        proposedTaxRate: 0,
        proposedTaxAmount: 0,
        proposedWithholdingRate: 0,
        proposedWithholdingAmount: 0,
        deductibleAmount: 0,
        nonDeductibleAmount: 0,
        reviewReasons: ['Falta perfil fiscal del cliente'],
        appliedRules: [],
        reviewRequired: true,
      });
    }

    // 2. Load activities
    const activities = await base44.asServiceRole.entities.FiscalActivity.filter({ company_id: companyId, active: true });
    const primaryActivity = activities?.[0] || null;

    // 3. Load custom fiscal rules for this company
    const customRules = await base44.asServiceRole.entities.FiscalRule.filter({ company_id: companyId, active: true });

    // 4. Determine key context variables
    const territory = profile.mainTerritory; // peninsula_baleares, canarias, ceuta_melilla, ue, no_ue
    const indirectTax = primaryActivity?.indirectTax || profile.indirectTaxDefault || 'iva';
    const regime = primaryActivity?.indirectTaxRegime || 'general';
    const deductionRight = primaryActivity?.deductionRight || 'pleno';
    const proRataPercent = primaryActivity?.proRataPercent || 100;
    const isExempt = regime === 'exenta_limitada' || regime === 'exenta_plena';
    const isNotSubject = regime === 'no_sujeta';
    const isProfessionalIRPF = profile.isProfessionalWithRetention || (profile.subjectToIRPF && profile.irpfEstimation !== 'no_aplica' && profile.irpfEstimation !== 'objetiva_modulos');
    const isPropertyLessor = profile.isPropertyLessor;

    const isEmitida = direction === 'ingreso';
    const isRecibida = direction === 'gasto';

    // 5. Detect counterparty territory from NIF/taxId
    let counterpartyTerritory = 'desconocido';
    const ctId = (counterpartyTaxId || '').toUpperCase().trim();
    if (ctId) {
      if (/^[A-Z]/.test(ctId)) {
        const prefix = ctId[0];
        if (prefix === 'X' || prefix === 'Y' || prefix === 'Z' || /^[XYZ]/.test(ctId)) {
          counterpartyTerritory = 'extranjero_no_ue';
        } else if (ctId.startsWith('ES') || /^[ABCDEFGHJKLMNPQRSVW]/.test(ctId)) {
          counterpartyTerritory = 'peninsula_baleares';
        }
      }
      // Check for EU VAT patterns (common foreign providers)
      const foreignProviders = ['GOOGLE', 'META', 'FACEBOOK', 'AMAZON', 'MICROSOFT', 'STRIPE', 'AWS', 'ADOBE', 'ZOOM', 'SLACK', 'GITHUB', 'LINKEDIN', 'CLOUDFLARE', 'DROPBOX', 'NOTION', 'FIGMA'];
      const nameUpper = (counterpartyName || '').toUpperCase();
      if (foreignProviders.some(p => nameUpper.includes(p))) {
        counterpartyTerritory = 'extranjero_ue';
      }
    }
    if (esProveedorExtranjero) counterpartyTerritory = 'extranjero_ue';

    // 6. Detect operation type from OCR
    const opType = (detectedOperationType || ocrData?.tipo_operacion || 'interior').toLowerCase();

    // 7. Build assessment step by step
    const appliedRules = [];
    const alerts = [];
    const reviewReasons = [];
    let confidence = 70;
    let proposedTreatment = 'iva';
    let proposedTaxRate = invoiceTaxRate || (indirectTax === 'igic' ? profile.defaultIgicRate : profile.defaultVatRate) || 21;
    let proposedTaxAmount = invoiceTaxAmount || 0;
    let proposedWithholdingRate = invoiceWithholdingRate || 0;
    let proposedWithholdingAmount = invoiceWithholdingAmount || 0;
    let deductibleAmount = 0;
    let nonDeductibleAmount = 0;
    let reverseChargeAmount = 0;
    let status = 'ready_to_post';

    // ── RULE: Territory determines IVA vs IGIC ──
    if (territory === 'canarias') {
      proposedTreatment = 'igic';
      appliedRules.push('territorio_canarias_igic');
      if (indirectTax === 'iva') {
        alerts.push('Inconsistencia: el cliente esta en Canarias pero la actividad esta configurada como IVA. Revisar configuracion.');
        reviewReasons.push('Conflicto territorio IVA vs IGIC');
        status = 'blocked_conflict_ocr_vs_config';
        confidence -= 20;
      }
    } else {
      proposedTreatment = indirectTax === 'igic' ? 'igic' : 'iva';
      appliedRules.push('territorio_comun_iva');
    }

    // ── RULE: Exempt activity ──
    if (isExempt) {
      proposedTreatment = 'exento';
      proposedTaxRate = 0;
      proposedTaxAmount = 0;
      appliedRules.push(`actividad_exenta_${regime}`);
      if (isEmitida && invoiceTaxAmount && invoiceTaxAmount > 0) {
        alerts.push('CONFLICTO: La actividad del cliente es exenta pero el OCR detecto IVA/IGIC repercutido en factura emitida. No deberia llevar impuesto.');
        reviewReasons.push('Factura emitida con impuesto en actividad exenta');
        status = 'blocked_conflict_ocr_vs_config';
        confidence -= 30;
      }
      if (isRecibida && deductionRight === 'sin_derecho') {
        nonDeductibleAmount = invoiceTaxAmount || 0;
        deductibleAmount = 0;
        appliedRules.push('gasto_actividad_exenta_sin_deduccion');
      }
    }

    // ── RULE: Not subject ──
    if (isNotSubject) {
      proposedTreatment = 'no_sujeto';
      proposedTaxRate = 0;
      proposedTaxAmount = 0;
      appliedRules.push('actividad_no_sujeta');
    }

    // ── RULE: Intracomunitarian / Export / ISP detection ──
    if (opType === 'intracomunitaria' || opType === 'entrega_intracomunitaria') {
      if (territory === 'canarias') {
        alerts.push('Canarias NO es territorio IVA UE. Una operacion con Canarias no es intracomunitaria. Revisar localizacion.');
        reviewReasons.push('Operacion Canarias mal clasificada como intracomunitaria');
        status = 'review_required';
        confidence -= 25;
      } else {
        proposedTreatment = 'exento_intracomunitario';
        proposedTaxRate = 0;
        proposedTaxAmount = 0;
        appliedRules.push('entrega_intracomunitaria_exenta');
        if (!ctId || !/^[A-Z]{2}/.test(ctId)) {
          alerts.push('Entrega intracomunitaria sin NIF-IVA valido. Exige NIF-IVA con VIES.');
          reviewReasons.push('Falta NIF-IVA/VIES en operacion intracomunitaria');
          status = 'review_required';
          confidence -= 20;
        }
      }
    } else if (opType === 'exportacion') {
      proposedTreatment = 'exento_exportacion';
      proposedTaxRate = 0;
      proposedTaxAmount = 0;
      appliedRules.push('exportacion_exenta_plena');
    } else if (opType === 'adquisicion_intracomunitaria') {
      proposedTreatment = 'adquisicion_intracomunitaria';
      reverseChargeAmount = invoiceTaxAmount || 0;
      appliedRules.push('adquisicion_intracomunitaria_autorrepercutir');
      if (deductionRight === 'pleno') {
        deductibleAmount = invoiceTaxAmount || 0;
      }
      alerts.push('Adquisicion intracomunitaria: autorrepercutir IVA y deducir si procede. Modelo 349.');
    } else if (opType === 'inversion_sujeto_pasivo' || opType === 'isp') {
      proposedTreatment = 'inversion_sujeto_pasivo';
      reverseChargeAmount = invoiceTaxAmount || 0;
      appliedRules.push('inversion_sujeto_pasivo');
      alerts.push('Inversion del sujeto pasivo: el receptor autorrepercute el impuesto.');
    }

    // ── RULE: Foreign service provider (received) ──
    if (isRecibida && (counterpartyTerritory === 'extranjero_ue' || counterpartyTerritory === 'extranjero_no_ue' || esProveedorExtranjero)) {
      if (opType !== 'inversion_sujeto_pasivo' && opType !== 'isp') {
        const taxName = territory === 'canarias' ? 'IGIC' : 'IVA';
        alerts.push(`Proveedor extranjero de servicios: evaluar inversion del sujeto pasivo de ${taxName}. El servicio se localiza en destino.`);
        reviewReasons.push('Proveedor extranjero sin regla ISP evaluada');
        status = status === 'ready_to_post' ? 'review_required' : status;
        confidence -= 15;
      }
    }

    // ── RULE: Canarias operations with Peninsula ──
    if (territory === 'canarias' && counterpartyTerritory === 'peninsula_baleares') {
      alerts.push('Operacion Canarias-Peninsula: no es intracomunitaria. Revisar si es exportacion/importacion o localizacion de servicios.');
      reviewReasons.push('Operacion Canarias-Peninsula requiere clasificacion especifica');
      if (status === 'ready_to_post') status = 'review_required';
      confidence -= 15;
    }
    if (territory === 'peninsula_baleares' && counterpartyTerritory === 'canarias') {
      alerts.push('Operacion Peninsula-Canarias: no es intracomunitaria. Revisar tratamiento IVA/IGIC/importacion.');
      reviewReasons.push('Operacion Peninsula-Canarias requiere clasificacion especifica');
      if (status === 'ready_to_post') status = 'review_required';
      confidence -= 15;
    }

    // ── RULE: Deducibility for received invoices ──
    if (isRecibida && !isExempt && proposedTreatment !== 'no_sujeto' && proposedTreatment !== 'exento') {
      if (deductionRight === 'pleno') {
        deductibleAmount = invoiceTaxAmount || proposedTaxAmount;
        nonDeductibleAmount = 0;
        appliedRules.push('deduccion_plena');
      } else if (deductionRight === 'sin_derecho') {
        deductibleAmount = 0;
        nonDeductibleAmount = invoiceTaxAmount || proposedTaxAmount;
        appliedRules.push('sin_derecho_deduccion_mayor_gasto');
        alerts.push('Actividad sin derecho a deduccion: la cuota soportada va a mayor gasto, no es deducible.');
      } else if (deductionRight === 'limitado' || deductionRight === 'prorrata_general' || deductionRight === 'prorrata_especial') {
        const prorata = proRataPercent / 100;
        deductibleAmount = Math.round(((invoiceTaxAmount || proposedTaxAmount) * prorata) * 100) / 100;
        nonDeductibleAmount = (invoiceTaxAmount || proposedTaxAmount) - deductibleAmount;
        appliedRules.push(`prorrata_${deductionRight}_${proRataPercent}%`);
        alerts.push(`Actividad mixta con prorrata ${proRataPercent}%: deducible ${deductibleAmount}€, no deducible ${nonDeductibleAmount}€.`);
        if (status === 'ready_to_post') status = 'review_required';
        confidence -= 10;
      }
    }

    // ── RULE: IRPF retention for emitted invoices ──
    if (isEmitida && isProfessionalIRPF) {
      // Check if new professional (7%) vs general (15%)
      let defaultRetention = profile.defaultWithholdingRate || 15;
      if (profile.professionalActivityStartDate) {
        const startDate = new Date(profile.professionalActivityStartDate);
        const yearsSinceStart = (new Date() - startDate) / (365.25 * 24 * 60 * 60 * 1000);
        if (yearsSinceStart <= 2) {
          defaultRetention = 7;
          appliedRules.push('profesional_nuevo_inicio_7%');
        } else {
          appliedRules.push('profesional_general_15%');
        }
      } else {
        appliedRules.push('profesional_general_15%');
      }
      proposedWithholdingRate = defaultRetention;
      proposedWithholdingAmount = Math.round(((invoiceBase || 0) * defaultRetention / 100) * 100) / 100;

      // Alert if invoice doesn't include retention when it should
      if (!invoiceWithholdingRate || invoiceWithholdingRate === 0) {
        alerts.push(`Factura emitida por profesional persona fisica sin retencion IRPF. Deberia incluir ${defaultRetention}%.`);
        reviewReasons.push('Falta retencion IRPF en factura emitida profesional');
        if (status === 'ready_to_post') status = 'review_required';
        confidence -= 15;
      }
    }

    // ── RULE: Property lessor retention (19%) ──
    if (isEmitida && isPropertyLessor) {
      proposedWithholdingRate = 19;
      proposedWithholdingAmount = Math.round(((invoiceBase || 0) * 0.19) * 100) / 100;
      appliedRules.push('arrendamiento_inmueble_19%');
    }

    // ── RULE: Received invoice from professional without retention ──
    if (isRecibida && (ocrData?.retencion_tipo === 'profesional' || ocrData?.es_profesional_pf) && (!invoiceWithholdingRate || invoiceWithholdingRate === 0)) {
      alerts.push('Factura recibida de profesional persona fisica sin retencion IRPF. Podria ser obligatoria (15% o 7%).');
      reviewReasons.push('Posible retencion IRPF omitida en recibida');
      if (status === 'ready_to_post') status = 'review_required';
      confidence -= 15;
    }

    // ── RULE: Received invoice with retention for property rental ──
    if (isRecibida && (ocrData?.retencion_tipo === 'alquiler' || ocrData?.es_arrendamiento)) {
      if (!invoiceWithholdingRate || invoiceWithholdingRate === 0) {
        alerts.push('Factura de arrendamiento urbano sin retencion 19%. Modelo 115/180.');
        reviewReasons.push('Falta retencion 19% en arrendamiento');
        if (status === 'ready_to_post') status = 'review_required';
        confidence -= 15;
      }
    }

    // ── RULE: Society issuing - no IRPF expected ──
    if (isEmitida && profile.entityType === 'sociedad' && invoiceWithholdingRate && invoiceWithholdingRate > 0) {
      alerts.push('Factura emitida por sociedad mercantil con retencion IRPF. Las sociedades no suelen tener retencion en operaciones ordinarias. Revisar.');
      reviewReasons.push('Retencion IRPF en factura de sociedad');
      if (status === 'ready_to_post') status = 'review_required';
      confidence -= 10;
    }

    // ── RULE: Tax rate not allowed for activity ──
    if (primaryActivity?.defaultTaxRate && invoiceTaxRate && invoiceTaxRate !== primaryActivity.defaultTaxRate) {
      const allowedRates = [0, 4, 10, 21, 3, 5, 7, 9.5, 15, 20];
      if (!allowedRates.includes(invoiceTaxRate)) {
        alerts.push(`Tipo impositivo ${invoiceTaxRate}% no estandar. Verificar si es valido para la actividad/territorio.`);
        reviewReasons.push('Tipo impositivo no estandar');
        if (status === 'ready_to_post') status = 'review_required';
        confidence -= 10;
      }
    }

    // ── RULE: Recargo de equivalencia ──
    if (regime === 'recargo_equivalencia' && isEmitida) {
      alerts.push('Comercio en recargo de equivalencia: revisar si procede repercutir recargo en esta venta.');
      appliedRules.push('recargo_equivalencia_emitida');
    }

    // ── RULE: Apply custom company rules (highest priority) ──
    for (const rule of customRules || []) {
      if (!rule.active) continue;
      if (rule.direction && rule.direction !== 'ambos' && rule.direction !== direction) continue;
      if (rule.resultTreatment) {
        appliedRules.push(`regla_personalizada:${rule.resultTreatment}`);
        if (rule.autoApprovalAllowed) {
          status = 'ready_to_post';
          confidence += 10;
        }
        if (rule.severity === 'alta' || rule.severity === 'critica') {
          reviewReasons.push(`Regla critica: ${rule.resultTreatment}`);
          if (status === 'ready_to_post') status = 'review_required';
        }
      }
    }

    // ── RULE: No activity configured ──
    if (!primaryActivity) {
      status = 'blocked_missing_fiscal_profile';
      reviewReasons.push('No hay actividad fiscal configurada para este cliente');
      alerts.push('Falta actividad fiscal vinculada. No se puede contabilizar automaticamente.');
      confidence = 0;
    }

    // ── Automation level check ──
    if (primaryActivity?.automationLevel === 'siempre_revisar' && status === 'ready_to_post') {
      status = 'review_required';
      reviewReasons.push('Actividad configurada como revision siempre obligatoria');
    }
    if (primaryActivity?.automationLevel === 'automatico' && status === 'review_required' && reviewReasons.length === 0) {
      status = 'ready_to_post';
    }

    // Clamp confidence
    confidence = Math.max(0, Math.min(100, confidence));

    // Build explanation
    const taxLabel = proposedTreatment === 'igic' ? 'IGIC' : proposedTreatment === 'exento' ? 'exento' : proposedTreatment === 'no_sujeto' ? 'no sujeto' : 'IVA';
    let explanation = `Cliente en ${territory.replace('_', '/')}, actividad ${regime}. `;
    if (isEmitida) {
      explanation += `Tratamiento emitidas: ${taxLabel}${proposedTaxRate > 0 ? ` ${proposedTaxRate}%` : ''}`;
      if (proposedWithholdingRate > 0) explanation += ` + retencion IRPF ${proposedWithholdingRate}%`;
    } else {
      explanation += `Tratamiento recibidas: ${deductionRight === 'pleno' ? 'deduccion plena' : deductionRight === 'sin_derecho' ? 'sin derecho a deduccion' : `prorrata ${proRataPercent}%`}`;
    }
    if (appliedRules.length > 0) {
      explanation += `. Reglas aplicadas: ${appliedRules.join(', ')}.`;
    }

    // Persist assessment
    try {
      await base44.asServiceRole.entities.OCRTaxAssessment.create({
        company_id: companyId,
        ocrDocumentId: body.ocrDocumentId || 'eval_' + Date.now(),
        fiscalProfileId: profile.id,
        activityId: primaryActivity?.id || '',
        direction,
        detectedTax: ocrData?.impuesto_detectado || (indirectTax === 'igic' ? 'IGIC' : 'IVA'),
        proposedTreatment,
        proposedTaxRate,
        proposedTaxAmount,
        proposedWithholdingRate,
        proposedWithholdingAmount,
        deductibleAmount,
        nonDeductibleAmount,
        reverseChargeAmount,
        confidence,
        status,
        reviewReasons,
        appliedRules,
        alerts,
        explanation,
      });
    } catch (e) {
      console.warn('[evaluateFiscalTreatment] Assessment persist failed:', e.message);
    }

    return Response.json({
      success: true,
      status,
      confidence,
      proposedTreatment,
      proposedTaxRate,
      proposedTaxAmount,
      proposedWithholdingRate,
      proposedWithholdingAmount,
      deductibleAmount,
      nonDeductibleAmount,
      reverseChargeAmount,
      alerts,
      reviewReasons,
      appliedRules,
      explanation,
      reviewRequired: status !== 'ready_to_post',
      profileSummary: {
        territory: profile.mainTerritory,
        entityType: profile.entityType,
        indirectTax,
        regime,
        deductionRight,
        proRataPercent,
        activityName: primaryActivity?.name || null,
        isProfessionalIRPF,
        isPropertyLessor,
      },
    });

  } catch (error) {
    console.error('[evaluateFiscalTreatment] Error:', error.message, error.stack);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
});
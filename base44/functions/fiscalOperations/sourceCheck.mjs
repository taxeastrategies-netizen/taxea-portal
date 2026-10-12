// El único check es el del documento origen. Nunca altera importes ni el perfil.
const money = n => Math.round(Number(n || 0) * 100) / 100;
export function sourceDecision(invoice, input, activity, profile, professional) {
  if (!professional && profile?.profileStatus !== 'validado_asesor')
    throw new Error('El asesor debe confirmar el encuadramiento de la empresa antes de registrar facturas.');
  if (!activity || activity.active === false) throw new Error('Selecciona la actividad fiscal de esta factura.');
  let recc={},breakdown=[];
  try{recc=JSON.parse(invoice.recc_metadata || '{}');breakdown=JSON.parse(invoice.tax_breakdown || '[]');}catch{/* Datos especiales incompletos se validan en su circuito. */}
  input={...input,recc:input.recc || recc,...(input.taxBreakdown || breakdown.length?{taxBreakdown:input.taxBreakdown || breakdown}:{})};
  const direction = invoice.tipo === 'recibida' ? 'gasto' : 'ingreso';
  const body = { ...input, activityId: activity.id,
    base: Number(invoice.base_imponible), operationDate: invoice.fecha_operacion || invoice.fecha_emision,
    withholdingRate: Number(invoice.retencion_irpf || 0),
    counterpartyIsWithholdingAgent: Number(invoice.retencion_irpf || 0) > 0,
    taxKind: input.taxKind || invoice.indirect_tax_kind || activity.indirectTax || profile?.indirectTaxDefault,
    regime: input.regime || activity.indirectTaxRegime || 'general',
    taxRate: Number(invoice.tipo_iva || 0), taxAmount: Number(invoice.cuota_iva || 0),
    confirmReviewed: true };
  const noDeduction = activity.deductionRight === 'sin_derecho'
    || ['exenta_limitada','pequeno_empresario_igic','comerciante_minorista_igic','recargo_equivalencia','agricultura_ganaderia_pesca'].includes(body.regime);
  body.deductiblePercent = input.deductiblePercent ?? (noDeduction ? 0 : activity.proRataPercent ?? 100);
  if (!professional && noDeduction && Number(body.deductiblePercent) !== 0)
    throw new Error('Esta actividad no tiene derecho a deducir. Solo el asesor puede confirmar una excepción motivada.');
  body.operationType = input.operationType || (direction === 'gasto'
    ? (money(invoice.cuota_iva) === 0 ? 'subject_zero' : 'subject_taxed')
    : activity.incomeDefaultTreatment || 'subject_taxed');
  body.exemptionKey = input.exemptionKey || activity.exemptionKey || '';
  body.legalBasis = input.legalBasis || activity.exemptionLegalBasis || '';
  if (body.regime === 'comerciante_minorista_igic' && direction === 'ingreso' && !input.operationType) {
    body.operationType = 'exempt_limited';
    body.exemptionKey ||= 'IGIC_COMERCIANTE_MINORISTA';
    body.legalBasis ||= 'Entregas comerciales del comerciante minorista: artículo 27 del texto refundido del IGIC (DLeg 1/2025); verificar vigencia y naturaleza de la operación.';
  }
  if (direction === 'gasto' && ['intra_services','intra_goods_current','intra_goods_investment'].includes(input.deductionCategory)) body.operationType = 'intra_eu_acquisition';
  if (direction === 'gasto' && ['reverse_charge','intra_eu_acquisition'].includes(body.operationType)) {
    body.taxRate = Number(input.selfAssessmentRate ?? input.taxRate ?? invoice.self_assessed_tax_rate ?? 0);
    if (!Number.isFinite(body.taxRate) || body.taxRate <= 0) throw new Error('Indica el tipo de IVA/IGIC de autorrepercusión. La cuota original del proveedor se conserva.');
    body.taxAmount = money(body.base * body.taxRate / 100);
  }
  if (['exempt_limited','exempt_full','non_subject_article','non_subject_location','outside_scope'].includes(body.operationType)
    && !body.legalBasis) throw new Error('Indica el fundamento de la exención o no sujeción dentro de este mismo documento.');
  if (['exempt_limited','exempt_full'].includes(body.operationType) && !body.exemptionKey) throw new Error('Selecciona la clave de exención.');
  if (!Number.isFinite(Number(body.deductiblePercent)) || Number(body.deductiblePercent) < 0 || Number(body.deductiblePercent) > 100) throw new Error('La deducción debe estar entre 0 y 100 %.');
  body.manualOverride = true;
  body.manualOverrideReason = input.manualOverrideReason || 'Criterio confirmado en el único check del documento origen.';
  return body;
}
export function assertSourceAmounts(invoice, evaluation, selfAssessed = null) {
  const reverse = invoice.tipo === 'recibida' && ['reverse_charge','intra_eu_acquisition'].includes(evaluation.operationType);
  if (reverse && !selfAssessed) throw new Error('Falta el detalle separado de la autorrepercusión.');
  if (Math.abs(Number(invoice.base_imponible) - evaluation.base) > 0.02
    || (!reverse && (Math.abs(Number(invoice.tipo_iva || 0) - evaluation.taxRate) > 0.0001 || Math.abs(Number(invoice.cuota_iva || 0) - evaluation.taxAmount) > 0.02))
    || Math.abs(Number(invoice.importe_retencion || 0) - evaluation.withholdingAmount) > 0.02
    || Math.abs(Number(invoice.total_factura) - money(evaluation.total + Number(invoice.cuota_recargo || 0))) > 0.02)
    throw new Error('Base, cuota, retención o total no cuadran. Corrige los importes en este documento: el criterio fiscal no cambia el importe del proveedor/cliente.');
}

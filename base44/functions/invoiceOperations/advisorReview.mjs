// Confirmación profesional explícita; nunca cambia el perfil ni el documento origen.
export const REVIEW_REASONS = ['FISCAL_ADVISOR_REVIEW_PHASE1','FISCAL_POSTING_ERROR'];
export function advisorDecision(invoice, input, activity, actor) {
  const body = { ...input };
  if (invoice.tipo === 'recibida' && body.taxKind === 'iva' &&
      ['intra_services','intra_goods_current','intra_goods_investment'].includes(body.deductionCategory))
    body.operationType = 'intra_eu_acquisition';
  const defaultOperation = activity?.[invoice.tipo === 'recibida' ? 'expenseDefaultTreatment' : 'incomeDefaultTreatment'];
  const different = (body.operationType && body.operationType !== defaultOperation)
    || (body.regime && body.regime !== activity?.indirectTaxRegime)
    || (body.taxKind && body.taxKind !== activity?.indirectTax);
  // Elegir y confirmar un criterio ya es una decisión manual del profesional.
  body.manualOverride = true;
  body.manualOverrideReason = String(body.manualOverrideReason || '').trim()
    || `Criterio confirmado por asesor: ${body.taxKind || activity?.indirectTax}/${body.regime || activity?.indirectTaxRegime}/${body.operationType || defaultOperation}; ${actor}`;
  body.advisorDefaultDifference = Boolean(different);
  return body;
}
export function selfAssessment(invoice, decision, evaluation) {
  const reverse = ['reverse_charge','intra_eu_acquisition'].includes(evaluation.operationType);
  if (!reverse || invoice.tipo !== 'recibida') return null;
  if (!['iva','igic'].includes(evaluation.taxKind)) throw new Error('La autorrepercusión requiere IVA o IGIC explícito.');
  if (evaluation.operationType === 'intra_eu_acquisition' && evaluation.taxKind !== 'iva')
    throw new Error('Las adquisiciones intracomunitarias pertenecen al IVA; para IGIC revisa localización e inversión del sujeto pasivo.');
  if (Math.abs(Number(invoice.cuota_iva || 0)) > 0.01 || Math.abs(Number(invoice.cuota_recargo || 0)) > 0.01)
    throw new Error('La autorrepercusión no sustituye impuestos cobrados por el proveedor. Revisa el documento origen.');
  const rate = Number(decision.taxRate ?? invoice.self_assessed_tax_rate ?? 0);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100)
    throw new Error('Indica el tipo de IVA/IGIC de la autorrepercusión, no el 0 % de la factura extranjera.');
  const quota = Math.round(Number(evaluation.base) * rate) / 100;
  const deductible = Math.round(quota * Number(evaluation.deductiblePercent)) / 100;
  Object.assign(evaluation, { taxRate: rate, taxAmount: quota, deductibleTax: deductible,
    nonDeductibleTax: Math.round((quota - deductible) * 100) / 100,
    total: Math.round((Number(evaluation.base) - Number(evaluation.withholdingAmount)) * 100) / 100 });
  if (Math.abs(Number(invoice.total_factura) - evaluation.total) > 0.02)
    throw new Error('El total del proveedor no coincide con la base menos la retención. No se modifica su deuda para añadir la autorrepercusión.');
  return { self_assessed_tax_amount: quota, self_assessed_tax_rate: rate, self_assessed_tax_confirmed: true };
}
export function reviewFilter(companyId, filters = {}) {
  const query = { company_id: companyId, anulada: { $ne: true },
    accounting_migration_hold_reason: { $in: REVIEW_REASONS } };
  if (['emitida','recibida'].includes(filters.type)) query.tipo = filters.type;
  if (filters.from || filters.to) query.fecha_emision = {
    ...(filters.from ? { $gte: String(filters.from).slice(0,10) } : {}),
    ...(filters.to ? { $lte: String(filters.to).slice(0,10) } : {}) };
  return query;
}
export function commonReviewCriteria(input = {}) {
  const allowed = ['activityId','taxKind','regime','operationType','deductiblePercent',
    'deductionCategory','deductionUse','exemptionKey','legalBasis','manualOverrideReason'];
  if (input.applyTaxRate === true) allowed.push('taxRate');
  if (input.applyWithholding === true) allowed.push('withholdingRate','counterpartyIsWithholdingAgent');
  return Object.fromEntries(allowed.filter(key => input[key] !== undefined).map(key => [key,input[key]]));
}

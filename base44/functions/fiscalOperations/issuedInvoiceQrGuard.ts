/**
 * Bloquea cambios monetarios en facturas ya emitidas con QR.
 * Una reclasificación fiscal puede guardarse; una diferencia de importes
 * requiere rectificativa. Función pura para pruebas sin datos reales.
 */
const cents = value => Math.round(Number(value) * 100) / 100;
const difference = (a, b) => !Number.isFinite(Number(a)) || !Number.isFinite(Number(b))
  || Math.abs(cents(a) - cents(b)) > 0.01;
const rateDifference = (a, b) => !Number.isFinite(Number(a)) || !Number.isFinite(Number(b))
  || Math.abs(Number(a) - Number(b)) > 0.0001;

export function guardIssuedQrInvoiceTaxChange(invoice, evaluation, body = {}) {
  if (invoice?.tipo !== 'emitida' || !invoice?.qr_url) return evaluation;
  const changed = Number(body.lineNumber || 1) !== 1
    || difference(evaluation.base, invoice.base_imponible)
    || rateDifference(evaluation.taxRate, invoice.tipo_iva ?? 0)
    || difference(evaluation.taxAmount, invoice.cuota_iva ?? 0)
    || (body.withholdingRate != null && rateDifference(body.withholdingRate, invoice.retencion_irpf ?? 0))
    || (body.withholdingAmount != null && difference(body.withholdingAmount, invoice.importe_retencion ?? 0));
  if (changed) throw Object.assign(new Error(
    'No se pueden cambiar bases, cuotas o retenciones de una factura emitida con QR; emite una rectificativa. La clasificación fiscal sí puede revisarse sin alterar importes.'
  ), { status: 409 });
  return {
    ...evaluation,
    withholdingRate: Number(invoice.retencion_irpf ?? 0),
    withholdingAmount: cents(invoice.importe_retencion ?? 0),
    total: cents(Number(evaluation.base) + Number(evaluation.taxAmount) - Number(invoice.importe_retencion ?? 0)),
  };
}

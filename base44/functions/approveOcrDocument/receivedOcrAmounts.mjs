export class OcrAmountError extends Error {
  status = 422;
}

function decimal(value, label, { required = false, rate = false } = {}) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text && !required) return 0;
  const number = Number(text);
  const format = rate ? /^[+-]?\d+(?:\.\d{1,4})?$/ : /^[+-]?\d+(?:\.\d{1,2})?$/;
  if (!format.test(text) || !Number.isFinite(number) || !Number.isSafeInteger(Math.round(number * 100))
    || (rate && (number < 0 || number > 100))) {
    throw new OcrAmountError('Revisa el recuadro «' + label + '». Introduce ' + (rate ? 'un porcentaje entre 0 y 100.' : 'un importe con hasta dos decimales.'));
  }
  return number;
}

const cents = value => Math.sign(value) * Math.round(Math.abs(value) * 100);

export function readReceivedOcrAmounts(form, storedSurcharge = 0) {
  const base = decimal(form.base_imponible, 'Base imponible', { required: true });
  const quota = decimal(form.cuota_impuesto, 'Cuota del proveedor');
  const rate = decimal(form.tipo_impuesto, 'Tipo IVA/IGIC', { rate: true });
  const withholding = decimal(form.importe_retencion, 'Importe de retención');
  const withholdingRate = decimal(form.retencion_irpf, 'Retención IRPF', { rate: true });
  const total = decimal(form.total, 'Total del proveedor', { required: true });
  const c5 = form.fiscal_criteria?.c5;
  const surcharge = decimal(c5?.kind === 'minorista_import' ? c5.surcharge : storedSurcharge, 'Cuota de recargo');
  const expected = cents(base) + cents(quota) + cents(surcharge) - cents(withholding);
  return {
    fields: { base_imponible: base, tipo_iva: rate, cuota_iva: quota, retencion_irpf: withholdingRate, importe_retencion: withholding, total_factura: total },
    expectedTotal: expected / 100,
    difference: (cents(total) - expected) / 100,
    sameSign: [quota, withholding, surcharge, total].every(value => value === 0 || Math.sign(value) === Math.sign(base)),
  };
}

export function validateReceivedOcrAmounts(form, storedSurcharge = 0) {
  const result = readReceivedOcrAmounts(form, storedSurcharge);
  if (!result.fields.base_imponible) throw new OcrAmountError('Indica la base imponible del documento.');
  if (!result.sameSign) throw new OcrAmountError('Comprueba el signo de la base, cuota, retención y total. En un abono, registra los importes con su signo negativo.');
  if (result.difference !== 0) {
    const euros = value => value.toFixed(2).replace('.', ',') + ' €';
    throw new OcrAmountError('Con la base, cuota y retención de estos recuadros, el total es ' + euros(result.expectedTotal)
      + '. Has indicado ' + euros(result.fields.total_factura) + '. Revisa el original y corrige el recuadro que corresponda.');
  }
  return result.fields;
}

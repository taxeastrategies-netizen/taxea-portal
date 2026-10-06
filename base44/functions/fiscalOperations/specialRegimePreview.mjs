import { reccSchedule } from './reccRules.mjs';
// Cálculos de apoyo para revisión profesional; nunca contabilizan ni presentan modelos por sí solos.
const cents = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const EU_COUNTRIES = new Set(['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK']);
const finite = (value, label, { positive = false, allowZero = true } = {}) => {
  if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) {
    throw new Error(`Falta un importe numérico válido: ${label}.`);
  }
  const number = Number(value);
  if (number < 0 || (positive && number === 0) || (!allowZero && number === 0)) {
    throw new Error(`${label} debe ser positivo o cero según corresponda.`);
  }
  return cents(number);
};
const percent = (value, label) => {
  const number = finite(value, label);
  if (number > 100) throw new Error(`${label} no puede superar el 100 %.`);
  return number;
};
const date = (value, label) => {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || (!Number.isFinite(Date.parse(`${text}T00:00:00Z`)) || new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) !== text)) {
    throw new Error(`Indica una fecha válida para ${label}.`);
  }
  return text;
};

export function calculateSpecialRegimePreview(input) {
  const regime = String(input?.regime || '');
  const direction = input?.direction === 'gasto' ? 'gasto' : 'ingreso';
  const taxKind = String(input?.taxKind || '');
  const taxRate = input?.taxRate;
  if (['rebu', 'agencias_viajes'].includes(regime)) {
    if (direction !== 'ingreso') return { regime, status: 'requires_purchase_trace', reason: 'La compra y su vínculo con la venta deben quedar identificados; no se calcula margen en una factura de gasto aislada.' };
    if (!['iva', 'igic'].includes(taxKind)) throw new Error('El impuesto indirecto del margen debe estar identificado.');
    const saleGross = finite(input.saleGross, 'precio total cobrado al cliente', { positive: true });
    const directCostGross = finite(input.directCostGross, regime === 'rebu' ? 'coste de adquisición del bien' : 'costes directos en beneficio del viajero');
    const rate = percent(taxRate, 'tipo del impuesto');
    if (rate <= 0) throw new Error('El margen exige un tipo impositivo positivo confirmado para esta operación.');
    if (input.globalMargin === true) throw new Error('El método de margen global requiere opción censal y arrastre de existencias; no se calcula con una sola factura.');
    const marginGross = cents(saleGross - directCostGross);
    const taxableMarginGross = Math.max(0, marginGross);
    const taxableBase = cents(taxableMarginGross / (1 + rate / 100));
    const embeddedTax = cents(taxableMarginGross - taxableBase);
    return { regime, status: 'proposal_only', method: 'operacion_individual', saleGross, directCostGross,
      marginGross, taxableBase, embeddedTax, customerInvoiceTaxShownSeparately: false,
      purchaseLinkRequired: true, advisorConfirmationRequired: true,
      reason: marginGross < 0 ? 'Margen negativo: base y cuota cero en esta operación; revisar pérdida y rectificaciones.' : 'Base y cuota internas sobre el margen; la cuota no se desglosa en la factura al cliente.' };
  }
  if (regime === 'recargo_equivalencia') {
    if (taxKind !== 'iva') throw new Error('El recargo de equivalencia solo se aplica al IVA.');
    if (direction !== 'gasto') return { regime, status: 'proposal_only', reason: 'En las ventas minoristas se factura el IVA ordinario, pero no se liquida como IVA general del comerciante.' };
    const base = finite(input.base, 'base de la compra');
    const rate = percent(taxRate, 'tipo IVA');
    const surchargeRate = percent(input.surchargeRate, 'tipo de recargo');
    const standard = new Map([[21, 5.2], [10, 1.4], [4, 0.5]]);
    if (standard.has(rate) && Math.abs(surchargeRate - standard.get(rate)) > 0.001 && !input.advisorRateOverride) {
      throw new Error('El recargo no corresponde al tipo IVA ordinario. Debe revisar la excepción el asesor.');
    }
    const vat = cents(base * rate / 100);
    const surcharge = cents(base * surchargeRate / 100);
    return { regime, status: 'proposal_only', base, vat, surchargeRate, surcharge,
      supplierInvoiceTotal: cents(base + vat + surcharge), deductibleTax: 0,
      purchaseCost: cents(base + vat + surcharge), advisorConfirmationRequired: true,
      reason: 'IVA y recargo de la compra son mayor coste; no se trasladan a la deducción ordinaria del comerciante.' };
  }
  if (regime === 'criterio_caja') {
    const invoiceGross = finite(input.invoiceGross, 'total neto de la factura', { positive: true });
    const taxableBase = finite(input.base, 'base de la factura');
    const taxQuota = finite(input.taxAmount, 'cuota de impuesto de la factura');
    const withholding = finite(input.withholdingAmount ?? 0, 'retención');
    const surcharge = finite(input.surchargeAmount ?? 0, 'recargo repercutido');
    if (Math.abs(cents(taxableBase + taxQuota + surcharge - withholding) - invoiceGross) > 0.02) return {
      regime, status: 'requires_total_reconciliation', invoiceGross, taxableBase, taxQuota, advisorConfirmationRequired: true,
      reason: 'El precio neto no coincide con base, IVA, recargo y retención. Corrige el documento antes de repartir la cuota.',
    };
    const schedule = reccSchedule({ invoiceNet: invoiceGross, operationDate: input.operationDate, payments: input.payments,
      advanceConfirmed: input.advanceConfirmed, insolvencyDate: input.insolvencyDate });
    let factor = 0, allocatedBase = 0, allocatedQuota = 0, allocatedSurcharge = 0;
    const events = schedule.events.map(event => {
      factor = Math.min(1, factor + event.factor);
      const base = cents(cents(taxableBase * factor) - allocatedBase);
      const quota = cents(cents(taxQuota * factor) - allocatedQuota);
      const recargo = cents(cents(surcharge * factor) - allocatedSurcharge);
      allocatedBase = cents(allocatedBase + base); allocatedQuota = cents(allocatedQuota + quota); allocatedSurcharge = cents(allocatedSurcharge + recargo);
      return { ...event, taxableBase: base, taxQuota: quota, surchargeQuota: recargo };
    });
    return { regime, status: 'proposal_only', invoiceGross, taxableBase, taxQuota, ...schedule, events,
      advisorConfirmationRequired: true, reason: 'IVA por precio satisfecho (incluida retención proporcional), anticipos trazados y límite legal o auto de concurso confirmado. La contabilidad conserva el devengo de la factura.' };
  }
  if (['oss_union', 'oss_exterior_union', 'ioss_importacion'].includes(regime)) {
    if (direction !== 'ingreso') return { regime, status: 'requires_destination_trace', reason: 'La compra no se incorpora automáticamente al modelo 369 de ventas.' };
    const destinationCountry = String(input.destinationCountry || '').toUpperCase();
    if (!EU_COUNTRIES.has(destinationCountry)) throw new Error('Indica un Estado miembro de consumo válido con código ISO de dos letras.');
    if (regime === 'ioss_importacion') {
      const intrinsicValue = finite(input.consignmentIntrinsicValue, 'valor intrínseco del envío');
      if (intrinsicValue > 150) throw new Error('IOSS solo admite envíos cuyo valor intrínseco no supera 150 €; verifica aduana y régimen aplicable.');
      if (input.isExcise === true) throw new Error('IOSS no admite bienes sujetos a impuestos especiales.');
    }
    const base = finite(input.base, 'base de la venta');
    const rate = percent(input.destinationRate, 'tipo del Estado de consumo');
    if (!input.destinationRateConfirmed) throw new Error('El tipo aplicable en destino debe estar confirmado por el asesor; no se presume el tipo español.');
    return { regime, status: 'proposal_only', destinationCountry, base, rate, destinationTax: cents(base * rate / 100),
      destinationRateConfirmed: true, advisorConfirmationRequired: true, reason: destinationCountry === 'ES' ? 'España puede ser Estado de consumo en supuestos concretos; comprobar el tipo de operación y la inclusión en 369 antes de validar.' : 'Agrupar por Estado de consumo y tipo en modelo 369; no mezclar con 303/420.' };
  }
  if (regime === 'grupo_entidades') {
    const groupId = String(input.groupId || '').trim();
    const role = String(input.groupRole || '');
    if (!groupId || !['dominante', 'dependiente'].includes(role)) throw new Error('Indica grupo fiscal y rol de entidad dominante o dependiente validado por el asesor.');
    return { regime, status: 'proposal_only', groupId, groupRole: role, individualModel: taxKind === 'igic' ? '418' : '322',
      aggregateModel: role === 'dominante' ? taxKind === 'igic' ? '419' : '353' : null,
      reason: 'La autoliquidación individual se prepara por entidad; el agregado requiere las individuales presentadas y solo lo presenta la dominante.' };
  }
  return null;
}

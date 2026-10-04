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
    const invoiceGross = finite(input.invoiceGross, 'total de la factura', { positive: true });
    const operationDate = date(input.operationDate, 'fecha de operación');
    const forcedRecognitionDate = `${Number(operationDate.slice(0, 4)) + 1}-12-31`;
    const payments = Array.isArray(input.payments) ? input.payments : [];
    const seen = new Set();
    let applied = 0;
    let paidTotal = 0;
    const events = [];
    for (const row of payments) {
      const id = String(row?.id || '');
      if (!id || seen.has(id)) throw new Error('Cada cobro o pago necesita un identificador único.');
      seen.add(id);
      const paymentDate = date(row.date, 'fecha de cobro o pago');
      const amount = finite(row.amount, 'importe de cobro o pago', { positive: true });
      if (paymentDate < operationDate) throw new Error('Los anticipos anteriores a la operación necesitan su circuito fiscal propio.');
      paidTotal = cents(paidTotal + amount);
      if (paidTotal > invoiceGross + 0.01) throw new Error('Los cobros/pagos superan el total de la factura.');
      if (paymentDate <= forcedRecognitionDate) {
        events.push({ id, date: paymentDate, amount, factor: amount / invoiceGross, kind: 'payment' });
        applied = cents(applied + amount);
      }
    }
    const remaining = cents(invoiceGross - applied);
    if (remaining > 0) events.push({ id: 'forced_deadline', date: forcedRecognitionDate, amount: remaining, factor: remaining / invoiceGross, kind: 'forced_deadline' });
    return { regime, status: 'proposal_only', invoiceGross, operationDate, forcedRecognitionDate, events,
      advisorConfirmationRequired: true, reason: 'El impuesto se reconoce según cobros/pagos trazados y, por el saldo restante, en la fecha límite legal; el asiento exige cuentas transitorias y libro de cobros/pagos.' };
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
    const rate = percent(taxRate, 'tipo del Estado de consumo');
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

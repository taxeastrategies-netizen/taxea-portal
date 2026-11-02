// Circuito C4 extraído sin modificar para que modelo y prorrata compartan las mismas fechas, divisas y rectificaciones.
export function createCashTaxLineForPeriod(dependencies:any){
 const {clean,dateOf,money,isZeroResidualReccFinal,invoicePayable,reccMetadata,reccDate,reccSchedule,reccCorrections,taxModelValidation,unique,invoiceCurrency,taxFx,fxMoney}=dependencies;
 return function cashTaxLineForPeriod(line: any, data: any, selectedBounds: any) {
  const invoice = line.invoice;
  const operationDate = clean(line.date || dateOf(invoice)).slice(0, 10);
  const operationYear = Number(operationDate.slice(0, 4));
  if (!invoice?.id || !operationYear) return { line: null, review: { sourceId: line.sourceId, invoiceId: invoice?.id, reason: 'Falta la fecha de realización necesaria para aplicar el límite del criterio de caja.' } };
  const forcedRecognitionDate = `${operationYear + 1}-12-31`;
  const payments = (data.invoicePayments || []).filter((payment: any) => payment.invoice_id === invoice.id);
  const rawPayments = (data.rawInvoicePayments || data.invoicePayments || []).filter((payment: any) => payment.invoice_id === invoice.id);
  const review = (reason: string) => ({ line: null, review: { sourceId: line.sourceId, invoiceId: invoice.id, reason } });
  const invoiceLabel = clean(invoice.numero_factura) || invoice.id;
  // El cargador omite pagos con operaciones contables sin confirmar. En RECC no se puede
  // convertir esa omisión en un devengo forzoso o en una cuota inferior sin avisar.
  if (rawPayments.length !== payments.length) {
    return review(`La factura ${invoiceLabel} tiene cobros o pagos no confirmados u omitidos; reconcilia su estado antes de calcular el criterio de caja.`);
  }
  // El IVA está en los anticipos originales; la final totalmente anticipada no vuelve a liquidarlo.
  try {
    if (!invoice.es_rectificativa && invoice.fiscal_review_status === 'validado' && isZeroResidualReccFinal(invoice)
      && Number(line.base || 0) === 0 && Number(line.quota || 0) === 0 && rawPayments.length === 0) return { line: null };
  } catch (error) { return review(`Factura ${invoiceLabel}: ${error.message}`); }
  const payable = invoicePayable(invoice);
  const siblingLines = (data.taxLines || []).filter((candidate: any) => candidate.invoice?.id === invoice.id || candidate.invoiceId === invoice.id);
  const invoiceLines = siblingLines.length ? siblingLines : [line];
  if (invoiceLines.length > 1 && (invoiceLines.some((candidate: any) => clean(candidate.taxKind) !== clean(line.taxKind)
    || clean(candidate.regime || candidate.invoice?.fiscal_regime) !== 'criterio_caja'
    || !['subject_taxed','subject_zero'].includes(clean(candidate.operationType)))
    || !invoiceLines.some((candidate: any) => candidate.sourceId === line.sourceId))) {
    return review(`La factura ${invoiceLabel} combina líneas fiscales no homogéneas o incompletas; requiere revisión antes de repartir los pagos del criterio de caja.`);
  }
  const fiscalTotal = money(invoiceLines.reduce((sum: number, candidate: any) => sum + money(candidate.base) + money(candidate.quota), 0));
  const surcharge = money(invoice.cuota_recargo);
  if (!payable || Math.abs(Math.abs(fiscalTotal + surcharge - money(invoice.importe_retencion)) - payable) > 0.02) {
    return review(`La factura ${invoiceLabel} RECC no reconcilia precio, retención y recargo.`);
  }
  if (payments.some((payment: any) => (payment.operation_status && payment.operation_status !== 'committed')
    || (payment.accounting_operation_id && payment.operation_status !== 'committed'))) {
    return review(`La factura ${invoiceLabel} tiene cobros o pagos contables no confirmados.`);
  }
  if (!payments.length && ['cobrada', 'parcial'].includes(clean(invoice.estado_cobro))) {
    return review(`La factura ${invoiceLabel} consta cobrada o pagada sin movimientos InvoicePayment trazados.`);
  }
  let schedule: any;
  let events: any[];
  try {
    const metadata = reccMetadata(invoice);
    if (invoice.es_rectificativa === true) {
      const original = (data.invoices || []).find((row: any) => row.id === metadata.originalInvoiceId && !row.anulada && row.fiscal_review_status === 'validado');
      if (!original || !metadata.adjustmentDate || !metadata.reason) throw taxModelValidation('Rectificativa sin original y criterio temporal confirmado por asesor.');
      if (metadata.adjustmentMode === 'tax_adjustment') {
        schedule = { forcedRecognitionDate: metadata.adjustmentDate, cancelledFactor: 0 };
        events = [{ id: invoice.id, date: reccDate(metadata.adjustmentDate), factor: 1, kind: 'reviewed_tax_adjustment',
          sourceIds: [line.sourceId, `Invoice:${original.id}`, `Invoice:${invoice.id}`] }];
      } else if (money(invoice.base_imponible) < 0) {
        const originalPayments = (data.invoicePayments || []).filter((row: any) => row.invoice_id === original.id);
        const originalRawPayments = (data.rawInvoicePayments || data.invoicePayments || []).filter((row: any) => row.invoice_id === original.id);
        if (originalPayments.length !== originalRawPayments.length || originalPayments.some((row: any) => row.operation_status && row.operation_status !== 'committed')) throw taxModelValidation('La rectificativa depende de pagos originales no confirmados.');
        const originalLine = (data.taxLines || []).find((row: any) => (row.invoiceId || row.invoice?.id) === original.id && Number(row.rate) === Number(line.rate));
        if (!originalLine) throw taxModelValidation('No se localiza el tipo de IVA de la rectificativa en el desglose original.');
        const originalMetadata = reccMetadata(original);
        schedule = reccSchedule({ invoiceId: original.id, invoiceNet: invoicePayable(original),
          operationDate: clean(original.fecha_operacion || original.fecha_emision), advanceConfirmed: originalMetadata.advanceConfirmed,
          insolvencyDate: originalMetadata.insolvencyDate,
          payments: (data.invoicePayments || []).filter((row: any) => row.invoice_id === original.id).map((row: any) => ({ id: row.id, date: row.payment_date, amount: row.amount, status: row.operation_status })),
          corrections: reccCorrections(original, data.invoices, originalLine, data.taxLines) });
        const correction = schedule.correctionRecognitions.find((row: any) => row.id === invoice.id);
        if (!correction) throw taxModelValidation('La rectificativa no se ha podido relacionar con el saldo original.');
        events = [{ ...correction, sourceIds: unique([line.sourceId, `Invoice:${original.id}`, `Invoice:${invoice.id}`]), type: 'rectification' }];
      } else {
        if (metadata.adjustmentMode !== 'price_change') throw taxModelValidation('El asesor debe confirmar si el aumento de precio sigue cobros o exige ajuste de cuotas en un período revisado (artículos 89 y 114).');
        schedule = reccSchedule({ invoiceId: invoice.id, invoiceNet: payable,
          operationDate: clean(original.fecha_operacion || original.fecha_emision), advanceConfirmed: metadata.advanceConfirmed,
          insolvencyDate: metadata.insolvencyDate, payments: payments.map((row: any) => ({ id: row.id, date: row.payment_date, amount: row.amount, status: row.operation_status })) });
        events = schedule.events.map((event: any) => ({ ...event, type: event.kind }));
      }
    } else {
      schedule = reccSchedule({ invoiceId: invoice.id, invoiceNet: payable, operationDate,
        advanceConfirmed: metadata.advanceConfirmed, insolvencyDate: metadata.insolvencyDate,
        payments: payments.map((payment: any) => {
          if (clean(payment.currency||'EUR').toUpperCase()!==invoiceCurrency(invoice)) throw taxModelValidation('La divisa del pago no coincide con la factura.');
          return { id: payment.id, date: payment.payment_date, amount: payment.amount, status: payment.operation_status };
        }), corrections: reccCorrections(invoice, data.invoices, line, data.taxLines) });
      events = schedule.events.map((event: any) => ({ ...event, type: event.kind }));
    }
  } catch (error) { return review(`Factura ${invoiceLabel}: ${error.message}`); }
  const originalAmounts = { base: money(line.base), quota: money(line.quota), deductibleQuota: money(line.deductibleQuota ?? line.quota), nonDeductibleQuota: money(line.nonDeductibleQuota), surchargeQuota: money(line.surchargeQuota) };
  let cumulativeFactor = 0;
  const allocatedAmounts = { base: 0, quota: 0, deductibleQuota: 0, nonDeductibleQuota: 0, surchargeQuota: 0 };
  const allocatedEvents = events.map((event: any) => {
    cumulativeFactor = Math.min(1, cumulativeFactor + event.factor);
    const amounts: any = {};
    for (const key of Object.keys(originalAmounts)) {
      const cumulativeAmount = money(originalAmounts[key] * cumulativeFactor);
      amounts[key] = money(cumulativeAmount - allocatedAmounts[key]);
      allocatedAmounts[key] = cumulativeAmount;
    }
    return { ...event, amounts };
  });
  let selectedEvents;
  try{selectedEvents=allocatedEvents.filter((event: any) => event.date >= selectedBounds.start && event.date <= selectedBounds.end).map((event:any)=>{
    const rate=Number(reccMetadata(invoice).advanceCreditBook?.taxFiscalRate)||taxFx(invoice,event.date),amounts=Object.fromEntries(Object.entries(event.amounts).map(([key,value])=>[key,fxMoney(Number(value),rate)]));
    if(invoice.tipo==='recibida')amounts.nonDeductibleQuota=money(Number(amounts.quota)-Number(amounts.deductibleQuota));
    return {...event,originalAmounts:event.amounts,amounts,currency:invoiceCurrency(invoice),taxExchangeRate:rate};
  });}catch(error){return review(error.message);}
  const factor = selectedEvents.reduce((sum: number, event: any) => sum + event.factor, 0);
  if (factor <= 0) return { line: null, deferred: { sourceId: line.sourceId, invoiceId: invoice.id, operationDate, forcedRecognitionDate } };
  const selectedAmount = (key: string) => money(selectedEvents.reduce((sum: number, event: any) => sum + money(event.amounts[key]), 0));
  return {
    line: {
      ...line,
      base: selectedAmount('base'),
      quota: selectedAmount('quota'),
      deductibleQuota: selectedAmount('deductibleQuota'),
      nonDeductibleQuota: selectedAmount('nonDeductibleQuota'),
      surchargeQuota: selectedAmount('surchargeQuota'),
      fiscalSourceIds: unique([line.sourceId, ...selectedEvents.flatMap((event: any) => event.sourceIds)]),
      cashRecognition: { factor, events: selectedEvents, operationDate, forcedRecognitionDate: schedule.forcedRecognitionDate, cancelledFactor: schedule.cancelledFactor || 0 },
    },
    review: null,
  };
}
}

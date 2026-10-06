// RECC: reglas puras compartidas. No escribe entidades ni sustituye la confirmación del asesor.
const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export const reccDate = value => {
  const text = String(value || '').slice(0, 10);
  const time = Date.parse(text + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== text) throw new Error('Fecha RECC no válida.');
  return text;
};
export function reccMetadata(invoice) {
  if (!invoice?.recc_metadata) return {};
  try { return JSON.parse(invoice.recc_metadata); } catch { throw new Error('La información RECC guardada no es válida.'); }
}
export function checkReccEligibility(input, operationDate) {
  const year = Number(reccDate(operationDate).slice(0, 4));
  if (!input || input.confirmed !== true) throw new Error('El asesor debe confirmar los requisitos censales RECC del ejercicio.');
  if (Number(input.year) !== year) throw new Error('La confirmación RECC corresponde a otro ejercicio.');
  if (!input.newActivity) {
    const volume = Number(input.previousAnnualizedTurnover);
    const cash = Number(input.previousMaxCashPerRecipient);
    if (input.previousAnnualizedTurnover === '' || input.previousAnnualizedTurnover == null || input.previousMaxCashPerRecipient === '' || input.previousMaxCashPerRecipient == null || !Number.isFinite(volume) || volume < 0 || !Number.isFinite(cash) || cash < 0) throw new Error('Indica volumen anualizado y máximo de efectivo por destinatario del año anterior.');
    if (volume > 2000000 || cash > 100000) throw new Error('Los límites de 2 M€ o 100.000 € de efectivo por destinatario impiden aplicar RECC en este ejercicio.');
  }
  if (!input.censusOptionConfirmed) throw new Error('Confirma la opción censal RECC; cumplir el límite no equivale a haber optado.');
  if (input.effectiveFrom && reccDate(input.effectiveFrom) > operationDate) throw new Error('Operación anterior a la vigencia RECC.');
  if (input.effectiveUntil && reccDate(input.effectiveUntil) < operationDate) throw new Error('Operación posterior a la salida RECC; las facturas anteriores mantienen su tratamiento.');
  if (input.renunciationUntil && reccDate(input.renunciationUntil) >= operationDate) throw new Error('La renuncia de tres años todavía impide volver a RECC.');
  return { year, eligible: true };
}
export function reccSchedule(input) {
  const operationDate = reccDate(input.operationDate);
  const statutoryDate = String(Number(operationDate.slice(0, 4)) + 1) + '-12-31';
  const insolvencyDate = input.insolvencyDate ? reccDate(input.insolvencyDate) : '';
  const forcedRecognitionDate = insolvencyDate && insolvencyDate > operationDate && insolvencyDate < statutoryDate ? insolvencyDate : statutoryDate;
  const net = round(input.invoiceNet);
  if (!Number.isFinite(net) || net <= 0) throw new Error('RECC exige un precio pendiente neto positivo y reconciliado.');
  const payments = input.payments || [];
  const corrections = input.corrections || [];
  const seen = new Set();
  const timeline = [];
  let paid = 0;
  for (const row of payments) {
    const id = String(row.id || '');
    if (!id || seen.has('payment:' + id)) throw new Error('Cada pago RECC exige identificador único, no vacío ni duplicado.');
    seen.add('payment:' + id);
    const when = reccDate(row.date);
    const amount = round(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Importe de pago RECC no válido.');
    if (when < operationDate && input.advanceConfirmed !== true) throw new Error('Los anticipos anteriores a la operación deben estar identificados y confirmados por asesor.');
    if (row.status && row.status !== 'committed') throw new Error('Pago RECC pendiente de confirmación contable.');
    paid = round(paid + amount);
    if (paid > net + 0.01) throw new Error('Los pagos superan el precio de la factura.');
    timeline.push({ id, date: when, amount, kind: when < operationDate ? 'advance' : 'payment', sourceIds: ['InvoicePayment:' + id] });
  }
  for (const row of corrections) {
    const id = String(row.id || '');
    if (!id || seen.has('correction:' + id)) throw new Error('Rectificativa RECC duplicada o sin identificador.');
    seen.add('correction:' + id);
    const when = reccDate(row.date);
    const amount = round(row.amount);
    if (!Number.isFinite(amount) || amount <= 0 || when < operationDate) throw new Error('La reducción RECC exige fecha y precio positivos posteriores a la operación.');
    const lineRatio = row.lineRatio == null ? null : Number(row.lineRatio);
    if (lineRatio != null && (!Number.isFinite(lineRatio) || lineRatio < 0 || lineRatio > 1)) throw new Error('Desglose de rectificación RECC fuera del saldo de la línea original.');
    timeline.push({ id, date: when, amount, lineRatio, kind: 'correction', sourceIds: ['Invoice:' + id] });
  }
  timeline.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'correction' ? 1 : 0) - (b.kind === 'correction' ? 1 : 0) || a.id.localeCompare(b.id));
  let remainingNet = net;
  let effectiveNet = net;
  let remainingFactor = 1;
  let effectiveLineFactor = 1;
  let cancelledFactor = 0;
  const events = [];
  const correctionRecognitions = [];
  const force = () => {
    if (remainingFactor > 0.00000001) events.push({ id: 'forced_deadline', date: forcedRecognitionDate, amount: Math.max(0, remainingNet), factor: remainingFactor,
      kind: forcedRecognitionDate === insolvencyDate ? 'insolvency' : 'forced_deadline', sourceIds: input.invoiceId ? ['Invoice:' + input.invoiceId] : [] });
    remainingFactor = 0;
  };
  let forced = false;
  for (const row of timeline) {
    if (!forced && row.date > forcedRecognitionDate) { force(); forced = true; }
    if (row.kind === 'correction') {
      if (row.amount > effectiveNet + 0.01) throw new Error('Las rectificativas reducen más que el precio original.');
      const ratio = row.lineRatio == null ? row.amount / net : row.lineRatio;
      if (ratio > effectiveLineFactor + 0.000001) throw new Error('Las rectificativas superan la base original de este tipo de IVA.');
      const deferred = forced || !effectiveLineFactor ? 0 : remainingFactor * Math.min(1, ratio / effectiveLineFactor);
      effectiveLineFactor = Math.max(0, effectiveLineFactor - ratio);
      correctionRecognitions.push({ ...row, factor: ratio ? Math.max(0, Math.min(1, 1 - deferred / ratio)) : 0, deferredFactor: deferred });
      cancelledFactor += deferred;
      remainingFactor = Math.max(0, remainingFactor - deferred);
      remainingNet = Math.max(0, round(remainingNet - row.amount));
      effectiveNet = round(effectiveNet - row.amount);
    } else if (!forced) {
      if (row.amount > remainingNet + 0.01) throw new Error('El pago supera la deuda pendiente tras rectificación; registra la devolución en su abono, no sobre la factura original.');
      const factor = remainingNet <= 0 ? 0 : remainingFactor * Math.min(1, row.amount / remainingNet);
      events.push({ ...row, factor });
      remainingFactor = Math.max(0, remainingFactor - factor);
      remainingNet = Math.max(0, round(remainingNet - row.amount));
    }
  }
  if (!forced) force();
  return { operationDate, statutoryDate, forcedRecognitionDate, events, correctionRecognitions, cancelledFactor };
}
export function reccCorrections(invoice, invoices, line = null, taxLines = []) {
  return (invoices || []).filter(row => !row.anulada && row.es_rectificativa === true && row.fiscal_review_status === 'validado' && row.fiscal_regime === 'criterio_caja'
    && reccMetadata(row).originalInvoiceId === invoice.id && Number(row.base_imponible) < 0)
    .map(row => {
      const metadata = reccMetadata(row);
      if (metadata.adjustmentMode === 'tax_adjustment') return null;
      let lineRatio;
      if (line) {
        const parts = (taxLines || []).filter(part => (part.invoiceId || part.invoice?.id) === row.id && Number(part.rate) === Number(line.rate));
        const base = Math.abs(parts.reduce((sum, part) => sum + Number(part.base || 0), 0));
        if (!parts.length && Number(row.tipo_iva) === Number(line.rate)) lineRatio = Math.abs(Number(row.base_imponible)) / Math.abs(Number(line.base));
        else lineRatio = base / Math.abs(Number(line.base));
        if (!Number.isFinite(lineRatio) || lineRatio > 1 + 0.000001) throw new Error('La rectificativa supera el desglose del tipo de IVA original.');
      } else {
        const ratio = Math.abs(Number(row.base_imponible)) / Number(invoice.base_imponible);
        // Sin desglose, solo se acepta el caso proporcional comprobable.
        if (!(ratio > 0 && ratio <= 1) || Math.abs(round(Number(invoice.cuota_iva) * ratio) + Number(row.cuota_iva)) > 0.02
          || Math.abs(round(Number(invoice.importe_retencion || 0) * ratio) + Number(row.importe_retencion || 0)) > 0.02
          || Math.abs(round(Number(invoice.cuota_recargo || 0) * ratio) + Number(row.cuota_recargo || 0)) > 0.02) throw new Error('Rectificativa heterogénea: exige el desglose original y del abono por tipo de IVA.');
      }
      return { id: row.id, date: metadata.adjustmentDate, amount: Math.abs(Number(row.total_factura)), ...(line ? { lineRatio } : {}) };
    }).filter(Boolean);
}

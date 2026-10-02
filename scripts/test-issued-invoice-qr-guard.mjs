import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../base44/functions/fiscalOperations/issuedInvoiceQrGuard.ts', import.meta.url), 'utf8');
const { guardIssuedQrInvoiceTaxChange: guard } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const invoice = {
  tipo: 'emitida', qr_url: 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu',
  base_imponible: 100, tipo_iva: 21, cuota_iva: 21, retencion_irpf: 15, importe_retencion: 15,
};
const evaluation = { base: 100, taxRate: 21, taxAmount: 21, withholdingRate: 0, withholdingAmount: 0, total: 121, operationType: 'subject_taxed' };
const result = guard(invoice, evaluation, { operationType: 'subject_taxed' });
assert.equal(result.withholdingRate, 15);
assert.equal(result.withholdingAmount, 15);
assert.equal(result.total, 106);
assert.equal(result.operationType, 'subject_taxed');
assert.equal(evaluation.withholdingAmount, 0, 'El guard no debe mutar la evaluación original.');

for (const [proposal, body] of [
  [{ ...evaluation, base: 101 }, {}],
  [{ ...evaluation, taxRate: 10 }, {}],
  [{ ...evaluation, taxAmount: 20 }, {}],
  [evaluation, { withholdingRate: 7 }],
  [evaluation, { withholdingAmount: 7 }],
  [evaluation, { lineNumber: 2 }],
  [{ ...evaluation, taxAmount: Number.NaN }, {}],
]) {
  assert.throws(() => guard(invoice, proposal, body), error => error.status === 409 && /rectificativa/.test(error.message));
}
assert.strictEqual(guard({ ...invoice, tipo: 'recibida' }, evaluation), evaluation);
assert.strictEqual(guard({ ...invoice, qr_url: '' }, evaluation), evaluation);
console.log('Bloqueo fiscal QR: importes inmutables, reclasificación permitida y retención preservada.');

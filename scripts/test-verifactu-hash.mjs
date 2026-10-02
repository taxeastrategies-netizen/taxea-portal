import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

globalThis.crypto = webcrypto;
const source = await readFile(new URL('../base44/functions/invoiceOperations/verifactuHash.ts', import.meta.url), 'utf8');
const { calculateVerifactuHash } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const first = await calculateVerifactuHash('alta', {
  IDEmisorFactura: '89890001K',
  NumSerieFactura: '12345678/G33',
  FechaExpedicionFactura: '01-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '12.35',
  ImporteTotal: '123.45',
  Huella: '',
  FechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
});
assert.equal(first.hash, '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60');
assert.match(first.source, /&Huella=&FechaHoraHusoGenRegistro=/);

const second = await calculateVerifactuHash('alta', {
  IDEmisorFactura: '89890001K',
  NumSerieFactura: '12345679/G34',
  FechaExpedicionFactura: '01-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '12.35',
  ImporteTotal: '123.45',
  Huella: first.hash,
  FechaHoraHusoGenRegistro: '2024-01-01T19:20:35+01:00',
});
assert.equal(second.hash, 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97');

const cancellation = await calculateVerifactuHash('anulacion', {
  IDEmisorFacturaAnulada: '89890001K',
  NumSerieFacturaAnulada: '12345679/G34',
  FechaExpedicionFacturaAnulada: '01-01-2024',
  Huella: second.hash,
  FechaHoraHusoGenRegistro: '2024-01-01T19:20:40+01:00',
});
assert.equal(cancellation.hash, '177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68');
await assert.rejects(calculateVerifactuHash('alta', { IDEmisorFactura: '89890001K' }), /Falta/);
console.log('Huella AEAT: tres vectores oficiales de alta y anulación coinciden.');

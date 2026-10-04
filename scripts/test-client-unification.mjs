import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

async function bundle(file) {
  const result = await build({ entryPoints: [file], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const { buildCashForecast } = await bundle('src/lib/cashForecast.js');
const { suggestInvoiceMatches } = await bundle('src/lib/reconciliationSuggestions.js');
const current = '2026-10-04';
const bank = { connectedAccounts: 1, connectedEuroAccounts: 1, availableCash: 1000 };
const invoices = [
  { id: 'r1', company_id: 'A', tipo: 'emitida', total_factura: 200, importe_pendiente: 200, fecha_vencimiento: '2026-10-04', numero_factura: 'E-1' },
  { id: 'p1', company_id: 'A', tipo: 'recibida', total_factura: 100, importe_pendiente: 100, fecha_vencimiento: '2026-10-05', numero_factura: 'R-1' },
  { id: 'overdue', company_id: 'A', tipo: 'emitida', total_factura: 500, importe_pendiente: 500, fecha_vencimiento: '2026-09-30' },
  { id: 'void', company_id: 'A', tipo: 'emitida', total_factura: 999, importe_pendiente: 999, fecha_vencimiento: '2026-10-05', anulada: true },
];
const obligations = [{ id: 'tax', resultado: 'a_pagar', importe: 50, fecha_limite_presentacion: '2026-10-05', estado: 'pendiente_documentacion' }];
const events = [{ id: 'e1', tipo: 'pago_previsto', importe: 30, fecha_prevista: '2026-10-05', estado: 'pendiente', moneda: 'EUR' }];
const forecast = buildCashForecast({ invoices, obligations, events, treasury: bank, today: current, days: 7 });
assert.equal(forecast.opening, 1000);
assert.equal(forecast.projected, 1020);
assert.equal(forecast.inflows, 200);
assert.equal(forecast.outflows, 180);
assert.equal(forecast.undated, 1);
assert.equal(buildCashForecast({ invoices, today: current, days: 7 }).projected, null);
assert.equal(buildCashForecast({ invoices, treasury: { connectedAccounts: 1, connectedEuroAccounts: 0, availableCash: 0 }, today: current, days: 7 }).projected, null);
const linked = buildCashForecast({ invoices, treasury: bank, events: [{ id: 'linked', entidad_id: 'p1', tipo: 'pago_previsto', importe: 100, fecha_prevista: '2026-10-05', moneda: 'EUR' }], today: current, days: 7 });
assert.equal(linked.outflows, 100);
const tx = { id: 't', company_id: 'A', tipo: 'entrada', moneda: 'EUR', importe: 200, fecha_operacion: '2026-10-05', concepto: 'E-1 Cliente Acme' };
const candidates = suggestInvoiceMatches(tx, [{ ...invoices[0], cliente_nombre: 'Acme SA' }, { ...invoices[0], id: 'other', company_id: 'B' }]);
assert.equal(candidates.length, 1);
assert.equal(candidates[0]._conf, 'alta');
assert.ok(candidates[0]._reasons.includes('Número de factura en el banco'));
assert.equal(suggestInvoiceMatches({ ...tx, importe: 40 }, [{ ...invoices[0], cliente_nombre: 'Acme SA' }])[0]._partial, true);
assert.equal(suggestInvoiceMatches({ ...tx, importe: 300 }, [invoices[0]]).length, 0);
assert.equal(suggestInvoiceMatches({ ...tx, tipo: 'salida' }, [invoices[0]]).length, 0);
const watchSchema = JSON.parse(readFileSync('base44/entities/OpportunityWatch.jsonc', 'utf8'));
assert.equal(Object.hasOwn(watchSchema.properties, 'created_by'), false);
for (const permission of ['read', 'update', 'delete']) {
  const ownerRule = watchSchema.rls[permission].$or.find(rule => rule.$and);
  assert.ok(ownerRule?.$and.some(rule => rule.created_by === '{{user.email}}'));
  assert.ok(ownerRule?.$and.some(rule => rule['data.company_id'] === '{{user.data.company_id}}'));
}
const watchUi = readFileSync('src/components/OpportunityWatchPanel.jsx', 'utf8');
assert.ok(!/OpportunityWatch\.create\(\{[^}]*created_by/.test(watchUi));
console.log('Taxea client-unification synthetic checks: 22 assertions OK');

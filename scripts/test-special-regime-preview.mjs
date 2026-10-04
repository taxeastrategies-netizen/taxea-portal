import assert from 'node:assert/strict';
import { calculateSpecialRegimePreview as calculate } from '../base44/functions/fiscalOperations/specialRegimePreview.mjs';

const rebu = calculate({ regime: 'rebu', direction: 'ingreso', taxKind: 'iva', saleGross: 1210, directCostGross: 605, taxRate: 21 });
assert.equal(rebu.marginGross, 605);
assert.equal(rebu.taxableBase, 500);
assert.equal(rebu.embeddedTax, 105);
assert.equal(rebu.customerInvoiceTaxShownSeparately, false);
assert.equal(calculate({ regime: 'rebu', direction: 'ingreso', taxKind: 'iva', saleGross: 100, directCostGross: 120, taxRate: 21 }).embeddedTax, 0);
assert.throws(() => calculate({ regime: 'rebu', direction: 'ingreso', taxKind: 'iva', saleGross: 100, directCostGross: 80, taxRate: 21, globalMargin: true }), /margen global/);
assert.throws(() => calculate({ regime: 'rebu', direction: 'ingreso', taxKind: 'iva', saleGross: 100, directCostGross: '', taxRate: 21 }), /Falta un importe/);
const travel = calculate({ regime: 'agencias_viajes', direction: 'ingreso', taxKind: 'iva', saleGross: 1210, directCostGross: 605, taxRate: 21 });
assert.equal(travel.taxableBase, 500);
assert.equal(travel.embeddedTax, 105);
const surcharge = calculate({ regime: 'recargo_equivalencia', direction: 'gasto', taxKind: 'iva', base: 100, taxRate: 21, surchargeRate: 5.2 });
assert.equal(surcharge.vat, 21);
assert.equal(surcharge.surcharge, 5.2);
assert.equal(surcharge.purchaseCost, 126.2);
assert.equal(surcharge.deductibleTax, 0);
assert.throws(() => calculate({ regime: 'recargo_equivalencia', direction: 'gasto', taxKind: 'iva', base: 100, taxRate: 21, surchargeRate: 1.4 }), /no corresponde/);
const cash = calculate({ regime: 'criterio_caja', direction: 'ingreso', taxKind: 'iva', invoiceGross: 121,
  operationDate: '2026-01-15', payments: [{ id: 'p1', date: '2026-04-15', amount: 60.5 }] });
assert.deepEqual(cash.events.map(row => [row.date, row.amount, row.kind]), [
  ['2026-04-15', 60.5, 'payment'], ['2027-12-31', 60.5, 'forced_deadline'],
]);
assert.throws(() => calculate({ regime: 'criterio_caja', invoiceGross: 100, operationDate: '2026-01-15',
  payments: [{ id: 'p1', date: '2026-02-01', amount: 60 }, { id: 'p2', date: '2026-03-01', amount: 60 }] }), /superan/);
assert.throws(() => calculate({ regime: 'criterio_caja', invoiceGross: 100, operationDate: '2026-01-15',
  payments: [{ id: 'p1', date: '2026-02-01', amount: 60 }, { id: 'p1', date: '2026-03-01', amount: 20 }] }), /único/);
assert.throws(() => calculate({ regime: 'criterio_caja', invoiceGross: 100, operationDate: '2026-01-15',
  payments: [{ id: 'advance', date: '2025-12-30', amount: 20 }] }), /anticipos/);
const oss = calculate({ regime: 'oss_union', direction: 'ingreso', taxKind: 'iva', base: 100, taxRate: 20, destinationCountry: 'FR', destinationRateConfirmed: true });
assert.equal(oss.destinationTax, 20);
assert.throws(() => calculate({ regime: 'oss_union', direction: 'ingreso', taxKind: 'iva', base: 100, taxRate: 21, destinationCountry: 'ES', destinationRateConfirmed: true }), /Estado miembro/);
assert.throws(() => calculate({ regime: 'oss_union', direction: 'ingreso', taxKind: 'iva', base: 100, taxRate: 20, destinationCountry: 'FR' }), /confirmado/);
assert.equal(calculate({ regime: 'grupo_entidades', taxKind: 'iva', groupId: 'grupo-test', groupRole: 'dependiente' }).aggregateModel, null);
assert.equal(calculate({ regime: 'grupo_entidades', taxKind: 'iva', groupId: 'grupo-test', groupRole: 'dominante' }).aggregateModel, '353');
assert.equal(calculate({ regime: 'grupo_entidades', taxKind: 'igic', groupId: 'grupo-test', groupRole: 'dominante' }).aggregateModel, '419');
assert.throws(() => calculate({ regime: 'grupo_entidades', taxKind: 'iva', groupId: 'grupo-test', groupRole: '' }), /rol/);
console.log('special-regime-preview: 20 casos sintéticos superados; sin escrituras de entidades.');

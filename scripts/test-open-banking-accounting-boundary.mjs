import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const openBanking = read('base44/functions/openBanking/entry.ts');
const accounting = read('base44/functions/accountingOperations/entry.ts');
const engine = read('base44/functions/accountingOperations/accountingEngine.ts');
const reports = read('base44/functions/accountingOperations/accountingReportEngine.ts');

const autoStart = openBanking.indexOf('async function autoReconcileCompany');
const autoEnd = openBanking.indexOf('\nfunction syncAgeMs', autoStart);
assert.ok(autoStart >= 0 && autoEnd > autoStart, 'No se localiza la conciliación bancaria automática.');
const auto = openBanking.slice(autoStart, autoEnd);

assert.match(auto, /AccountingPostingOperation\.filter\(\{ companyId \}/, 'La conciliación automática debe conocer el estado de las operaciones contables.');
assert.match(auto, /paymentVisible\(/, 'Los pagos en recuperación no pueden reducir el saldo pendiente.');
assert.match(auto, /await postInvoice\(/, 'La factura debe contabilizarse antes del cobro o pago bancario.');
assert.match(auto, /await ensureBankPostingAccount\(/, 'Debe reutilizarse una única subcuenta 572 por cuenta bancaria estable.');
assert.match(auto, /await postBankReconciliation[\s\S]*deferCommit:\s*true/, 'El asiento bancario debe prepararse antes de enlazar los demás registros.');
assert.match(auto, /await commitJournalEntry\(/, 'La conciliación automática debe confirmar el asiento dentro de la unidad de trabajo.');
assert.match(auto, /operation_status:\s*'committed'/, 'El pago solo puede hacerse visible después de confirmar el asiento.');
assert.match(auto, /accounting_operation_id:\s*committedOperation\.id/, 'El movimiento bancario debe conservar la operación contable que lo hizo visible.');
assert.match(auto, /status:\s*'recovery_required'/, 'Un fallo parcial debe quedar recuperable e invisible para saldos.');

const pendingStart = accounting.indexOf('async function postPendingBankBatch');
const pendingEnd = accounting.indexOf('\nasync function', pendingStart + 20);
assert.ok(pendingStart >= 0 && pendingEnd > pendingStart, 'No se localiza el lote de movimientos pendientes.');
const pendingBatch = accounting.slice(pendingStart, pendingEnd);
assert.match(pendingBatch, /await postBankReconciliation[\s\S]*deferCommit:\s*true/, 'El lote 555/572 debe usar el motor contable atómico.');
assert.match(pendingBatch, /await commitJournalEntry\(/, 'El lote 555/572 debe confirmar el asiento antes de enlazar el banco.');
assert.doesNotMatch(accounting, /JournalEntry\.bulkCreate/, 'No puede existir una segunda vía directa de creación masiva de asientos.');
assert.doesNotMatch(accounting, /salida_pendiente_de_cuenta_contable/, 'Los pagos bancarios sin documento también deben quedar temporalmente en 555.');

assert.match(engine, /export async function ensureBankPostingAccount/, 'La identidad 572 debe resolverse en el motor contable canónico.');
assert.match(engine, /stableBankIdentity/, 'La identidad 572 debe usar una clave bancaria estable.');
assert.doesNotMatch(accounting, /function ensureBankPostingAccount/, 'accountingOperations no debe mantener otra implementación de la identidad 572.');
assert.match(reports, /const visiblePayments[\s\S]*operation_status[\s\S]*operationById\.get\(operationId\)\?\.status === 'committed'/, 'Los informes deben excluir pagos pertenecientes a unidades no confirmadas.');
assert.match(reports, /pendingPayments/, 'Los informes deben exponer cuántos pagos siguen en recuperación.');

console.log('OK: conciliación automática, movimientos 555/572 y pagos comparten la unidad contable recuperable.');

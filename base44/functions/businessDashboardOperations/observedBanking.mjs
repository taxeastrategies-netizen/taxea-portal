import { withinWindow, civilDay } from './reportingPeriods.mjs';
const money = value => Math.round((Number(value) || 0) * 100) / 100;
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const lower = value => String(value || '').trim().toLowerCase();
const accountKey = row => row.iban ? String(row.iban).replace(/\s/g, '').toUpperCase() : row.provider_account_id ? `${row.proveedor_integracion || ''}|${row.provider_account_id}` : row.id;

export function bankObservation(accounts = [], transactions = [], { now = new Date(), treasuryError = '', timeZone = 'Europe/Madrid' } = {}) {
  const connected = accounts.filter(row => row.activa !== false && row.es_demo !== true && ['conectado', 'conectada', 'connected'].includes(lower(row.estado_conexion)));
  const euro = connected.filter(row => String(row.moneda || '').toUpperCase() === 'EUR');
  const unique = new Map(), aliases = new Map(), reasons = [];
  if (treasuryError) reasons.push('No se pudo actualizar el snapshot bancario.');
  if (!euro.length) reasons.push('No hay cuentas EUR conectadas con saldo verificable.');
  let duplicateAccounts = 0;
  for (const account of euro) {
    const balance = account.saldo_disponible ?? account.saldo_actual ?? account.saldo_contable;
    const identityKeys = [account.iban ? 'iban:' + String(account.iban).replace(/\s/g, '').toUpperCase() : null, account.provider_account_id ? 'provider:' + String(account.proveedor_integracion || '') + '|' + account.provider_account_id : null].filter(Boolean);
    if (!identityKeys.length) identityKeys.push('row:' + account.id);
    const matches = [...new Set(identityKeys.map(key => aliases.get(key)).filter(Boolean))];
    if (matches.length > 1) reasons.push('Las identidades bancarias contienen vinculaciones ambiguas.');
    const groupKey = matches[0] || identityKeys[0];
    const previous = unique.get(groupKey);
    for (const identity of identityKeys) aliases.set(identity, groupKey);
    if (previous) {
      duplicateAccounts++;
      if (!finite(balance) || money(previous.balance) !== money(balance)) reasons.push('Hay saldos contradictorios para la misma cuenta.');
      previous.ids.add(account.id); continue;
    }
    const sync = account.fecha_ultima_sync || account.last_sync_at || account.ultima_sincronizacion;
    const ageHours = sync ? (new Date(now).getTime() - new Date(sync).getTime()) / 3600000 : NaN;
    if (!finite(balance)) reasons.push('Una cuenta conectada no informa un saldo numérico.');
    if (!Number.isFinite(ageHours) || ageHours > 72 || ageHours < -1) reasons.push('Una cuenta no tiene sincronización reciente verificable.');
    unique.set(groupKey, { ...account, balance: finite(balance) ? Number(balance) : null, ids: new Set([account.id]) });
  }
  const byId = new Map([...unique.values()].flatMap(account => [...account.ids].map(id => [id, account])));
  const seen = new Set(), rows = []; let duplicates = 0;
  for (const row of transactions) {
    const account = byId.get(row.bank_account_id || row.cuenta_bancaria_id || row.account_id);
    if (!account || row.es_demo === true || row.es_duplicado || row.duplicado || ['pending', 'pendiente', 'duplicado', 'duplicate'].includes(lower(row.estado_proveedor)) || ['duplicada', 'duplicado', 'duplicate', 'movimiento_interno'].includes(lower(row.estado_conciliacion)) || row.categoria_ia === 'transferencia_interna' || String(row.moneda || account.moneda).toUpperCase() !== 'EUR') continue;
    const day = civilDay(row.fecha_operacion || row.fecha_valor || row.fecha, timeZone);
    if (!day || day > civilDay(now, timeZone) || !finite(row.importe)) continue;
    const providerKey = row.clave_transaccion || row.proveedor_transaccion_id;
    const key = providerKey ? `${accountKey(account)}|${providerKey}` : row.id ? `row:${row.id}` : null;
    if (key && seen.has(key)) { duplicates++; continue; }
    if (key) seen.add(key);
    const direction = lower(row.tipo);
    const signedAmount = direction === 'salida' ? -Math.abs(Number(row.importe)) : direction === 'entrada' ? Math.abs(Number(row.importe)) : Number(row.importe);
    rows.push({ ...row, day, signedAmount });
  }
  return {
    bankKnown: unique.size > 0 && reasons.length === 0,
    cash: unique.size && reasons.length === 0 ? money([...unique.values()].reduce((sum, account) => sum + account.balance, 0)) : null,
    connected: unique.size, nonEuroAccounts: connected.length - euro.length,
    reasons: [...new Set(reasons)], duplicateAccounts, duplicateTransactions: duplicates, rows,
  };
}

export function bankFlows(observation, window) {
  const rows = observation.rows.filter(row => withinWindow(row.day, window));
  const inflows = money(rows.filter(row => row.signedAmount > 0).reduce((sum, row) => sum + row.signedAmount, 0));
  const outflows = money(-rows.filter(row => row.signedAmount < 0).reduce((sum, row) => sum + row.signedAmount, 0));
  return { inflows, outflows, net: money(inflows - outflows), count: rows.length, first: rows.map(row => row.day).sort()[0] || null };
}


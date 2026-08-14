export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function getWithholdingAmount(invoice) {
  if (invoice?.importe_retencion !== undefined && invoice?.importe_retencion !== null && invoice?.importe_retencion !== '') {
    return roundMoney(invoice.importe_retencion);
  }
  return roundMoney((Number(invoice?.base_imponible) || 0) * (Number(invoice?.retencion_irpf) || 0) / 100);
}

export function getAccountingYear(record) {
  if (Number(record?.ejercicio)) return Number(record.ejercicio);
  if (Number(record?.anio)) return Number(record.anio);
  const date = record?.date || record?.entryDate || record?.fecha_emision || record?.created_date;
  const year = date ? new Date(date).getFullYear() : NaN;
  return Number.isFinite(year) ? year : null;
}

export function classifyPgcAccount(code, saldo = 0) {
  const c = String(code || '');
  if (c.startsWith('1')) return 'patrimonio_pasivo';
  if (/^[23]/.test(c)) return 'activo';
  if (/^(40|41|475|476|477)/.test(c)) return 'patrimonio_pasivo';
  if (/^(43|44|46|470|471|472|473|474)/.test(c)) return 'activo';
  if (/^(50|51|52)/.test(c)) return 'patrimonio_pasivo';
  if (/^(53|54|57)/.test(c)) return 'activo';
  if (c.startsWith('6')) return 'gasto';
  if (c.startsWith('7')) return 'ingreso';
  return saldo >= 0 ? 'activo' : 'patrimonio_pasivo';
}

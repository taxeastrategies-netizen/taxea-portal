export const normalizedNumber = value => String(value ?? '').normalize('NFKC').trim().toUpperCase().replace(/\s+/g, '');
export const normalizedTaxId = value => String(value ?? '').normalize('NFKC').trim().toUpperCase().replace(/[\s.-]/g, '');
export const normalizedName = value => String(value ?? '').normalize('NFKC').trim().toUpperCase().replace(/\s+/g, ' ');
export function normalizedDate(value) {
  const raw = String(value ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(raw);
  const local = /^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(raw);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : local ? [Number(local[3]), Number(local[2]), Number(local[1])] : null;
  if (!parts) return '';
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
}
export function sameInvoiceIdentity(left, right) {
  if (left.companyId !== right.companyId || left.direction !== right.direction) return false;
  const number = normalizedNumber(left.number);
  const date = normalizedDate(left.date);
  if (!number || !date || number !== normalizedNumber(right.number) || date !== normalizedDate(right.date)) return false;
  const leftTax = normalizedTaxId(left.taxId);
  const rightTax = normalizedTaxId(right.taxId);
  if (leftTax && rightTax) return leftTax === rightTax;
  const leftName = normalizedName(left.name);
  return Boolean(leftName && leftName === normalizedName(right.name));
}
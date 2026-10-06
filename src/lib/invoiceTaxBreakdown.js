// Presentation only. Never changes fiscal lines, invoices or historical accounting.
export function invoiceTaxBreakdown(invoice) {
  try {
    const rows = typeof invoice?.tax_breakdown === 'string' ? JSON.parse(invoice.tax_breakdown) : invoice?.tax_breakdown;
    if (!Array.isArray(rows) || rows.length < 2 || rows.length > 20 || !Number.isFinite(Number(invoice.base_imponible)) || !Number.isFinite(Number(invoice.cuota_iva))) return [];
    const clean = rows.map(row => ({ rate: Number(row.rate), base: Number(row.base), quota: Number(row.quota) }));
    if (clean.some(row => !Number.isFinite(row.rate) || row.rate < 0 || row.rate > 100 || !Number.isFinite(row.base) || !Number.isFinite(row.quota))) return [];
    if (Math.abs(clean.reduce((sum,row)=>sum+row.base,0)-Number(invoice.base_imponible)) > 0.02 || Math.abs(clean.reduce((sum,row)=>sum+row.quota,0)-Number(invoice.cuota_iva)) > 0.02) return [];
    return clean;
  } catch { return []; }
}
export function invoiceTaxRateLabel(invoice) {
  const rows = invoiceTaxBreakdown(invoice);
  return rows.length ? rows.map(row=>`${row.rate}%`).join(' · ') : `${invoice?.tipo_iva ?? invoice?.tipo_impuesto ?? 0}%`;
}

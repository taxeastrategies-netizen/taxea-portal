export const RECC_INVOICE_LEGEND = 'Régimen especial del criterio de caja';

// La mención es obligatoria en la factura expedida por el emisor acogido al RECC.
// Una compra de un proveedor RECC no convierte la factura propia en RECC.
export function invoiceFiscalLegend(invoice) {
  const existing = String(invoice?.coletilla_fiscal || '').trim();
  const isIssuedRecc = invoice?.tipo === 'emitida'
    && invoice?.fiscal_regime === 'criterio_caja'
    && invoice?.indirect_tax_kind === 'iva'
    && invoice?.fiscal_review_status === 'validado';
  if (!isIssuedRecc || existing.toLocaleLowerCase('es-ES').includes(RECC_INVOICE_LEGEND.toLocaleLowerCase('es-ES'))) return existing;
  return [RECC_INVOICE_LEGEND, existing].filter(Boolean).join(' · ');
}

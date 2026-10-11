/**
 * Huella INTERNA de identidad+QR, no huella fiscal encadenada ni firma del PDF.
 * No modifica source_hash (idempotencia), QR, importes o numeración.
 */
export const QR_HASH_VERSION = 'taxea-qr-identity-v1';

export async function calculateInvoiceQrHash(invoice) {
  if (!invoice?.qr_url) return null;
  if (!invoice.id || !invoice.company_id || typeof invoice.qr_url !== 'string') {
    throw Object.assign(new Error('La huella QR requiere una factura persistida y su empresa.'), { status: 409 });
  }
  const source = JSON.stringify([QR_HASH_VERSION, invoice.company_id, invoice.id, invoice.qr_url]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function ensureInvoiceQrHash(entity, invoice) {
  const expected = await calculateInvoiceQrHash(invoice);
  if (!expected) return invoice;
  const validate = row => {
    if (!row || row.id !== invoice.id || row.company_id !== invoice.company_id || row.qr_url !== invoice.qr_url
      || row.qr_integrity_hash !== expected || row.qr_integrity_version !== QR_HASH_VERSION
      || row.qr_integrity_algorithm !== 'SHA-256' || !row.qr_integrity_created_at) {
      throw Object.assign(new Error('La huella interna no coincide con la factura y su QR. No se sobrescribe; requiere revisión.'), { status: 409 });
    }
    return row;
  };
  if (invoice.qr_integrity_hash) return validate(invoice);
  const fields = {
    qr_integrity_hash: expected, qr_integrity_version: QR_HASH_VERSION,
    qr_integrity_algorithm: 'SHA-256', qr_integrity_created_at: new Date().toISOString(),
  };
  // CAS: otro proceso o un cambio de QR nunca puede pisar una huella ya guardada.
  const result = await entity.updateMany({
    id: invoice.id, company_id: invoice.company_id, qr_url: invoice.qr_url,
    qr_integrity_hash: { $in: [null, ''] },
  }, { $set: fields });
  if (Number(result?.updated) === 1) return { ...invoice, ...fields };
  return validate(await entity.get(invoice.id));
}

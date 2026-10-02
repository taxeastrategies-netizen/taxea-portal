/**
 * AEAT QR tributario v0.5.0. Un QR no acredita remisión VERI*FACTU.
 * La URL se persiste en la emisión para que el PDF no dependa de datos posteriores.
 */
export function buildAeatQrUrl(company, invoice) {
  const nif = String(company?.nif_cif || '').toUpperCase().replace(/[\s.-]/g, '');
  const numserie = String(invoice?.numero_factura || '').trim();
  const isoDate = String(invoice?.fecha_emision || '');
  // ImporteTotal del RRSIF: base + impuesto repercutido, antes de retenciones o suplidos.
  const amount = Math.round((Number(invoice?.base_imponible) + Number(invoice?.cuota_iva)) * 100) / 100;
  if (!/^[A-Z0-9]{9}$/.test(nif)) throw new Error('El emisor necesita un NIF/CIF español válido para el QR tributario.');
  if (!numserie || numserie.length > 60) throw new Error('El número de factura no es válido para el QR tributario.');
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  const parsedDate = new Date(isoDate + 'T00:00:00Z');
  if (!dateMatch || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== isoDate) {
    throw new Error('La fecha de emisión no es válida para el QR tributario.');
  }
  if (!Number.isFinite(amount) || Math.abs(amount) >= 1e12) throw new Error('El importe fiscal no es válido para el QR tributario.');
  const payable = Number(invoice?.total_factura);
  const retention = Number(invoice?.importe_retencion || 0);
  if (!Number.isFinite(payable) || !Number.isFinite(retention) || Math.abs(amount - retention - payable) > 0.03) {
    throw new Error('La base, el impuesto, la retención y el total a pagar no cuadran; revisa la factura antes de emitirla.');
  }
  if (String(invoice?.moneda || 'EUR').toUpperCase() !== 'EUR') {
    throw new Error('El QR tributario requiere el importe en euros; revisa la conversión de la factura.');
  }
  const params = new URLSearchParams({
    nif,
    numserie,
    fecha: `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`,
    importe: amount.toFixed(2),
  });
  return `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?${params.toString()}`;
}
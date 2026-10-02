import QRCode from 'qrcode';

const AEAT_HOST = 'www2.agenciatributaria.gob.es';
const AEAT_PATHS = new Set(['/wlpl/TIKE-CONT/ValidarQRNoVerifactu', '/wlpl/TIKE-CONT/ValidarQR']);

export function getInvoiceQrUrl(invoice) {
  if (invoice?.tipo !== 'emitida' || !invoice?.qr_url) return '';
  try {
    const url = new URL(invoice.qr_url);
    if (url.protocol !== 'https:' || url.hostname !== AEAT_HOST || !AEAT_PATHS.has(url.pathname)) return '';
    const keys = [...url.searchParams.keys()];
    if (keys.length !== 4 || ['nif', 'numserie', 'fecha', 'importe'].some(key => !url.searchParams.has(key))) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export async function invoiceQrPng(invoice) {
  const url = getInvoiceQrUrl(invoice);
  if (!url) return null;
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 500,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

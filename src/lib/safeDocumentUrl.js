export function safeDocumentUrl(value, baseUrl = globalThis.location?.href || 'https://taxeaportal.com/') {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim(), baseUrl);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

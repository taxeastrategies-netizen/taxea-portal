/**
 * Huella AEAT para registros de alta/anulación (especificación 0.1.2).
 * Recibe los valores EXACTOS que se serializarán en XML, nunca los datos editables
 * de una factura. No crea registros, cadenas ni remisiones por sí mismo.
 */
const ALTA_FIELDS = [
  'IDEmisorFactura', 'NumSerieFactura', 'FechaExpedicionFactura',
  'TipoFactura', 'CuotaTotal', 'ImporteTotal', 'Huella',
  'FechaHoraHusoGenRegistro',
];
const ANULACION_FIELDS = [
  'IDEmisorFacturaAnulada', 'NumSerieFacturaAnulada',
  'FechaExpedicionFacturaAnulada', 'Huella', 'FechaHoraHusoGenRegistro',
];

async function sha256Upper(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function calculateVerifactuHash(kind, fields) {
  const names = kind === 'alta' ? ALTA_FIELDS : kind === 'anulacion' ? ANULACION_FIELDS : null;
  if (!names) throw new Error('Tipo de registro VERI*FACTU no admitido.');
  for (const name of names) {
    if (name !== 'Huella' && (fields?.[name] === undefined || fields?.[name] === null || String(fields[name]).trim() === '')) {
      throw new Error(`Falta ${name} en el registro.`);
    }
  }
  const previous = String(fields?.Huella || '').trim();
  if (previous && !/^[A-F0-9]{64}$/.test(previous)) throw new Error('La huella anterior no tiene formato SHA-256 válido.');
  const source = names.map(name => `${name}=${String(fields?.[name] ?? '').trim()}`).join('&');
  return { source, hash: await sha256Upper(source), algorithm: 'SHA-256', specVersion: 'AEAT-0.1.2' };
}

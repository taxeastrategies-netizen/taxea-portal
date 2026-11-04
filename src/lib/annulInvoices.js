import { base44 } from '@/api/base44Client';

export async function annulInvoices(companyId, invoiceIds, motivo) {
  const ids = [...new Set(invoiceIds)];
  const confirmed = new Set();
  const failures = new Map();
  for (let index = 0; index < ids.length; index += 4) {
    const batch = ids.slice(index, index + 4);
    let data;
    try {
      const response = await base44.functions.invoke('anularFacturas', { companyId, invoiceIds: batch, motivo });
      data = response?.data ?? response;
    } catch (error) {
      const message = error?.response?.data?.error || 'No se pudo confirmar el resultado. Actualiza la lista antes de reintentar.';
      for (const id of ids.slice(index)) failures.set(id, message);
      break;
    }
    const acknowledged = new Set(data?.annulledIds || []);
    for (const id of batch) {
      if (acknowledged.has(id)) confirmed.add(id);
      else {
        const item = data?.results?.find(row => row.invoiceId === id);
        failures.set(id, item?.error || 'El servidor no confirmó la anulación.');
      }
    }
  }
  return { confirmed, failures };
}

export async function annulOneInvoice(companyId, invoiceId, motivo) {
  const { failures } = await annulInvoices(companyId, [invoiceId], motivo);
  if (failures.has(invoiceId)) throw new Error(failures.get(invoiceId));
}

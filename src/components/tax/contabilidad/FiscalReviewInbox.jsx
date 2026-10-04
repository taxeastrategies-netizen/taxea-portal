import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import InvoiceFiscalReview from './InvoiceFiscalReview';

const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));

export default function FiscalReviewInbox({ companyId }) {
  const query = useQuery({
    queryKey: ['fiscal-review-inbox', companyId],
    enabled: Boolean(companyId),
    staleTime: 0,
    queryFn: async () => {
      const response = await base44.functions.invoke('invoiceOperations', { action: 'list_fiscal_review', company_id: companyId });
      const result = response?.data ?? response;
      if (!result?.ok) throw new Error(result?.error || 'No se pudo cargar la revisión fiscal.');
      return result;
    },
  });

  useEffect(() => {
    const refresh = () => query.refetch();
    window.addEventListener('financials:refresh', refresh);
    return () => window.removeEventListener('financials:refresh', refresh);
  }, [query.refetch]);

  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="mb-4">
      <h2 className="font-semibold text-slate-900">Revisión fiscal del asesor</h2>
      <p className="text-xs text-slate-600">Propuestas manuales, OCR y recurrentes. Hasta su confirmación no generan línea fiscal definitiva, QR, envío ni asiento.</p>
    </div>
    {query.isLoading && <p className="text-sm text-slate-500">Cargando pendientes…</p>}
    {query.isError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{query.error?.message || 'Error al cargar pendientes.'} <button type="button" onClick={() => query.refetch()} className="ml-2 underline">Reintentar</button></div>}
    {query.data?.truncated && <p className="mb-3 text-xs text-amber-700">Hay más de 500 pendientes; revisa esta bandeja por lotes.</p>}
    {query.data?.invoices?.length === 0 && <p className="text-sm text-slate-500">No hay propuestas pendientes en esta empresa.</p>}
    <div className="space-y-2">
      {(query.data?.invoices || []).map(invoice => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{invoice.numero_factura || 'Sin número'} · {invoice.tipo === 'recibida' ? 'Recibida' : 'Emitida'}</div>
          <div className="text-xs text-slate-600">{invoice.fecha_emision || 'Sin fecha'} · {invoice.proveedor_nombre || invoice.cliente_nombre || 'Sin tercero'} · {money(invoice.total_factura)} · {invoice.origin || 'manual'}</div>
          <div className="text-xs text-amber-800">{invoice.accounting_migration_hold_reason === 'FISCAL_POSTING_ERROR' ? 'Incidencia contable: clasificación validada, reintentar asiento tras revisar el error' : invoice.fiscal_review_status === 'validado' ? 'Clasificación guardada; falta finalizar asiento' : 'Pendiente de revisión profesional'}</div>
        </div>
        <InvoiceFiscalReview companyId={companyId} invoice={invoice} advisorAccess />
      </div>)}
    </div>
  </section>;
}

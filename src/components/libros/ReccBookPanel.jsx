import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const eur = value => Number(value || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const date = value => value ? String(value).slice(0, 10) : '—';

export default function ReccBookPanel({ companyId, year }) {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setBook(null);
    base44.functions.invoke('fiscalOperations', { action: 'recc_book', companyId, year: Number(year) })
      .then(response => {
        if (cancelled) return;
        const data = response?.data || response;
        if (!data?.success) throw new Error(data?.error || 'No se pudo consultar el libro RECC.');
        setBook(data);
      })
      .catch(reason => { if (!cancelled) setError(reason?.message || 'No se pudo consultar el libro RECC.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId, year, reloadKey]);

  const visible = useMemo(() => {
    if (!book) return [];
    const paymentsByInvoice = new Map();
    for (const payment of book.payments || []) {
      if (!paymentsByInvoice.has(payment.invoiceId)) paymentsByInvoice.set(payment.invoiceId, []);
      paymentsByInvoice.get(payment.invoiceId).push(payment);
    }
    return (book.invoices || []).map(invoice => ({
      invoice,
      payments: (paymentsByInvoice.get(invoice.id) || []).filter(payment => date(payment.date).startsWith(String(year))),
      issues: (book.issues || []).filter(issue => issue.invoiceId === invoice.id),
    })).filter(row => date(row.invoice.operationDate).startsWith(String(year))
      || date(row.invoice.forcedRecognitionDate).startsWith(String(year))
      || row.payments.length > 0);
  }, [book, year]);

  return <section className="space-y-4" aria-label="Libro auxiliar del criterio de caja">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="font-jakarta font-semibold text-foreground">Criterio de caja · {year}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Facturas y cobros o pagos trazados, incluido el límite legal del 31 de diciembre del año siguiente.
          Este libro es auxiliar: la liquidación se revisa en el modelo 303.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => setReloadKey(value => value + 1)} disabled={loading || !companyId}>
        {loading ? 'Actualizando…' : 'Actualizar libro'}
      </Button>
    </div>
    {loading && <p role="status" className="text-sm text-muted-foreground">Consultando facturas y pagos confirmados…</p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {book && <>
      {(book.issues || []).length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">{book.issues.length} incidencias para revisar con el asesor</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {book.issues.map((issue, index) => <li key={`${issue.invoiceId}-${issue.paymentId || index}`}>{issue.reason} <span className="text-amber-800">· factura {visible.find(row => row.invoice.id === issue.invoiceId)?.invoice.number || issue.invoiceId}</span></li>)}
        </ul>
      </div>}
      {visible.length === 0 ? <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No hay operaciones RECC para este ejercicio.</p>
        : <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground">
              <tr><th className="px-3 py-3 text-left">Factura / tercero</th><th className="px-3 py-3 text-left">Tipo</th><th className="px-3 py-3 text-left">Operación</th><th className="px-3 py-3 text-right">Base</th><th className="px-3 py-3 text-right">Cuota</th><th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-left">Cobros / pagos del año</th><th className="px-3 py-3 text-left">Límite</th><th className="px-3 py-3 text-left">Revisión</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map(({ invoice, payments, issues }) => <tr key={invoice.id} className="align-top">
                <td className="px-3 py-3"><span className="font-medium">{invoice.number || 'Sin número'}</span><br/><span className="text-xs text-muted-foreground">{invoice.counterpartyName || 'Sin tercero'}</span></td>
                <td className="px-3 py-3">{invoice.type === 'emitida' ? 'Emitida' : 'Recibida'}</td>
                <td className="px-3 py-3">{date(invoice.operationDate)}</td>
                <td className="px-3 py-3 text-right">{eur(invoice.base)}{invoice.taxBreakdown?.length > 1 && <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">{invoice.taxBreakdown.map(line => <div key={line.lineNumber}>{line.rate}% · {eur(line.base)}</div>)}</div>}</td>
                <td className="px-3 py-3 text-right">{eur(invoice.quota)}{invoice.taxBreakdown?.length > 1 && <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">{invoice.taxBreakdown.map(line => <div key={line.lineNumber}>{line.rate}% · {eur(line.quota)}</div>)}</div>}</td>
                <td className="px-3 py-3 text-right font-medium">{eur(invoice.total)}</td>
                <td className="px-3 py-3">{payments.length ? payments.map(payment =>
                  <div key={payment.id} className="mb-1 text-xs">{date(payment.date)} · {eur(payment.amount)} · {payment.method || 'Medio sin indicar'}{!payment.confirmed ? ' · pendiente de confirmar' : ''}</div>
                ) : <span className="text-xs text-muted-foreground">Sin cobro/pago registrado en {year}</span>}</td>
                <td className="px-3 py-3">{date(invoice.forcedRecognitionDate)}</td>
                <td className="px-3 py-3 text-xs">{issues.length ? <span className="text-amber-800">Revisar ({issues.length})</span> : invoice.reviewStatus === 'validado' ? 'Validado' : 'Pendiente'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      <p className="text-xs text-muted-foreground">Fuente: facturas, líneas fiscales y pagos registrados en esta empresa. Los movimientos no confirmados se muestran como incidencia y no sustituyen la revisión fiscal.</p>
    </>}
  </section>;
}

import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw } from 'lucide-react';
const fmt = value => Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function InvoicePostedEntry({ invoice }) {
  const [result, setResult] = useState(/** @type {any} */ (null)), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    base44.functions.invoke('invoiceOperations', { action: 'get_accounting_entry', company_id: invoice.company_id, invoice_id: invoice.id })
      .then(response => { const data = response?.data ?? response; if (!data?.ok) throw new Error(data?.error || 'No se pudo leer el asiento.'); if (!cancelled) setResult(data); })
      .catch(failure => { if (!cancelled) setError(failure?.response?.data?.error || failure?.message || 'No se pudo leer el asiento.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [invoice.id, invoice.company_id, invoice.linked_journal_entry_id, revision]);
  if (loading) return <p className="flex gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Leyendo asiento real…</p>;
  if (error) return <div className="space-y-2 text-xs text-red-700"><p>{error}</p><button onClick={() => setRevision(value => value + 1)} className="flex gap-1 rounded border px-2 py-1"><RefreshCw className="h-3 w-3" />Reintentar lectura</button></div>;
  if (!result?.entry) return <p className="text-xs text-muted-foreground">{result?.reason || 'No hay asiento contable vinculado.'}</p>;
  const { entry, lines } = result;
  return <div className="space-y-2">
    <p className="text-xs font-semibold">Asiento {entry.number || entry.id} · {entry.date} · {entry.status}{entry.reversed ? ' · revertido mediante contraasiento' : ''}</p>
    <table className="w-full text-[10px]"><thead><tr className="border-b"><th className="text-left">Cuenta real</th><th className="text-left">Descripción</th><th className="text-right">Debe</th><th className="text-right">Haber</th></tr></thead><tbody>{lines.map(row => <tr key={row.id} className="border-b border-border/40"><td className="py-1 font-mono">{row.accountCode}</td><td className="px-1" title={row.description}>{row.accountName}</td><td className="text-right">{row.debit ? fmt(row.debit) : '—'}</td><td className="text-right">{row.credit ? fmt(row.credit) : '—'}</td></tr>)}</tbody></table>
    <p className={entry.balanced ? 'text-xs text-emerald-700' : 'text-xs text-red-700'}>Debe {fmt(entry.totalDebit)} € · Haber {fmt(entry.totalCredit)} € · {entry.balanced ? 'Cuadrado' : 'Revisar líneas e importes'}</p>
    <p className="text-[10px] text-muted-foreground">Lectura del diario guardado. No genera ni modifica asientos, cuentas o facturas.</p>
  </div>;
}

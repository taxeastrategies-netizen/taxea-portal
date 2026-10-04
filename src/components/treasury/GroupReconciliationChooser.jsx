import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0);
const toCents = value => Math.round((Number(value) || 0) * 100);

export default function GroupReconciliationChooser({ transaction, candidates, allocations, onChange, confirmed, onConfirm }) {
  const [query, setQuery] = useState('');
  const amountCents = toCents(Math.abs(Number(transaction?.importe) || 0));
  const allocatedCents = Object.values(allocations).reduce((sum, value) => sum + toCents(value), 0);
  const selectedCount = Object.keys(allocations).length;
  const visible = useMemo(() => {
    const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const needle = normal(query.trim());
    return candidates.filter(invoice => !needle || normal([invoice.numero_factura, invoice.cliente_nombre, invoice.proveedor_nombre].join(' ')).includes(needle)).slice(0, 100);
  }, [candidates, query]);
  const toggle = invoice => {
    const next = { ...allocations };
    if (Object.hasOwn(next, invoice.id)) delete next[invoice.id];
    else {
      const remaining = Math.max(0, amountCents - allocatedCents) / 100;
      next[invoice.id] = Math.min(invoice._groupOutstanding, remaining || invoice._groupOutstanding).toFixed(2);
    }
    onChange(next);
    onConfirm(false);
  };
  return <div className="space-y-3">
    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-950">
      <p className="font-semibold">Un movimiento, varias facturas, un asiento bancario</p>
      <p className="mt-1">Elige al menos dos facturas y reparte el importe completo. Puedes aplicar pagos parciales sin exceder el pendiente de cada factura.</p>
    </div>
    <label className="relative block">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar factura o tercero" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm" />
    </label>
    <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
      {!visible.length && <p className="p-4 text-xs text-slate-500">No hay facturas EUR compatibles pendientes con estos filtros.</p>}
      {visible.map(invoice => {
        const selected = Object.hasOwn(allocations, invoice.id);
        const party = invoice.tipo === 'recibida' ? invoice.proveedor_nombre || invoice.cliente_nombre : invoice.cliente_nombre;
        return <div key={invoice.id} className="flex flex-wrap items-center gap-3 p-3">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-xs">
            <input type="checkbox" checked={selected} onChange={() => toggle(invoice)} />
            <span className="min-w-0"><span className="block truncate font-semibold">{invoice.numero_factura || 'Factura sin número'}</span><span className="block truncate text-slate-500">{party || 'Tercero sin identificar'} · pendiente {money(invoice._groupOutstanding)}</span></span>
          </label>
          {selected && <input type="number" min="0.01" max={invoice._groupOutstanding} step="0.01" aria-label={`Importe de ${invoice.numero_factura || invoice.id}`} value={allocations[invoice.id]} onChange={event => { onChange({ ...allocations, [invoice.id]: event.target.value }); onConfirm(false); }} className="h-9 w-28 rounded-lg border border-slate-200 px-2 text-right text-xs font-mono" />}
        </div>;
      })}
    </div>
    {candidates.length > 100 && <p className="text-[11px] text-slate-500">Mostrando hasta 100 facturas. Usa la búsqueda para localizar otras.</p>}
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
      <div className="flex justify-between"><span>{selectedCount} facturas seleccionadas</span><span>Movimiento: {money(amountCents / 100)}</span></div>
      <div className="mt-1 flex justify-between font-semibold"><span>Repartido: {money(allocatedCents / 100)}</span><span className={allocatedCents === amountCents ? 'text-emerald-700' : 'text-amber-700'}>Diferencia: {money((amountCents - allocatedCents) / 100)}</span></div>
    </div>
    <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <input type="checkbox" checked={confirmed} onChange={event => onConfirm(event.target.checked)} />
      He comprobado las facturas, terceros, importes y que este movimiento bancario corresponde a este reparto.
    </label>
    <p className="text-[11px] text-slate-500">Disponible para movimientos y facturas EUR. Si ya existe un asiento bancario para este movimiento (por ejemplo 555/572), debe revisarse o reclasificarse antes de evitar duplicar la cuenta 572.</p>
  </div>;
}

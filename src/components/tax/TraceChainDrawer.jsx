import { useQuery } from '@tanstack/react-query';
import { FileSearch, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const unwrap = response => response?.data || response || {};
const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));

export default function TraceChainDrawer({ input, onClose }) {
  const query = useQuery({
    queryKey: ['entity-trace-chain', input?.companyId, input?.entityType, input?.entityId],
    queryFn: async () => {
      const data = unwrap(await base44.functions.invoke('advisorWorkspaceOperations', { action: 'trace', ...input }));
      if (data.error || data.ok === false) throw new Error(data.error || 'No se pudo reconstruir la cadena documental.');
      return data.trace;
    },
    enabled: Boolean(input?.companyId && input?.entityType && input?.entityId),
  });
  if (!input) return null;
  const trace = query.data;
  return <div className="fixed inset-0 z-[95] flex justify-end bg-slate-950/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Cadena documental completa">
    <button type="button" className="min-w-0 flex-1 cursor-default" onClick={onClose} aria-label="Cerrar cadena documental" />
    <aside className="flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-2xl">
      <header className="border-b border-slate-800 bg-slate-950 px-5 py-4 text-white"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Trazabilidad integral</p><h3 className="mt-1 text-lg font-bold">{input.title || 'Cadena documental'}</h3><p className="mt-1 text-xs text-slate-300">Modelo → fuente fiscal → factura → asiento → pago → banco</p></div><Button size="icon" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={onClose}><X className="h-5 w-5" /></Button></div></header>
      <div className="flex-1 overflow-y-auto p-5">
        {query.isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-cyan-600" /></div>
          : query.isError ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{query.error.message}</div>
            : !trace?.nodes?.length ? <div className="rounded-xl border border-dashed p-12 text-center"><FileSearch className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm text-slate-500">No se han localizado relaciones adicionales.</p></div>
              : <div className="space-y-2">{trace.nodes.map(item => {
                const relations = (trace.edges || []).filter(edge => edge.from === item.id);
                return <div key={item.id}><article className={`rounded-xl border bg-white p-4 shadow-sm ${trace.root === item.id ? 'border-cyan-400 ring-2 ring-cyan-100' : 'border-slate-200'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge variant="outline">{item.type}</Badge>{item.status && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{String(item.status).replaceAll('_', ' ')}</span>}</div><p className="mt-2 text-sm font-semibold text-slate-900">{item.label}</p><p className="mt-0.5 text-xs text-slate-500">{[item.date, item.subtitle].filter(Boolean).join(' · ')}</p></div>{item.amount != null && <p className="shrink-0 text-sm font-bold text-slate-800">{money(item.amount)}</p>}</div></article>{relations.length > 0 && <div className="ml-6 border-l-2 border-dashed border-cyan-200 py-2 pl-4 text-[11px] font-medium text-cyan-700">{relations.map(edge => edge.relation).join(' · ')}</div>}</div>;
              })}</div>}
      </div>
    </aside>
  </div>;
}

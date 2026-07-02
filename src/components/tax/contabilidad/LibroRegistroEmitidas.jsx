import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpCircle, Search, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const fmt = (n) => n != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n) : '—';

const ESTADO_CFG = {
  pendiente:           'bg-slate-100 text-slate-600',
  asiento_propuesto:   'bg-amber-100 text-amber-700',
  contabilizada:       'bg-emerald-100 text-emerald-700',
  rechazada:           'bg-red-100 text-red-700',
  requiere_correccion: 'bg-orange-100 text-orange-700',
};
const ESTADO_LABEL = {
  pendiente: 'Pendiente', asiento_propuesto: 'Asiento propuesto',
  contabilizada: 'Contabilizada', rechazada: 'Rechazada', requiere_correccion: 'Requiere corrección',
};

export default function LibroRegistroEmitidas() {
  const { company } = useOutletContext() || {};
  const [search, setSearch] = useState('');
  const [filterAnio, setFilterAnio] = useState('todos');
  const [filterEstado, setFilterEstado] = useState('todos');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-emitidas', company?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getCompanyFinancials', { company_id: company.id });
      const finData = res?.data || res;
      return (finData?.invoices || []).filter(i => i.tipo === 'emitida');
    },
    enabled: !!company?.id,
  });

  const anios = [...new Set(invoices.map(i => i.anio).filter(Boolean))].sort((a, b) => b - a);

  const filtered = invoices.filter(inv => {
    const matchAnio = filterAnio === 'todos' || String(inv.anio) === filterAnio;
    const matchEstado = filterEstado === 'todos' || inv.estado_contable === filterEstado;
    const matchSearch = !search ||
      inv.numero_factura?.toLowerCase().includes(search.toLowerCase()) ||
      inv.cliente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      inv.cliente_nif?.toLowerCase().includes(search.toLowerCase());
    return matchAnio && matchEstado && matchSearch;
  });

  const totales = filtered.reduce((acc, inv) => ({
    base: acc.base + (inv.base_imponible || 0),
    iva: acc.iva + (inv.cuota_iva || 0),
    retencion: acc.retencion + (inv.retencion_irpf || 0),
    total: acc.total + (inv.total_factura || 0),
  }), { base: 0, iva: 0, retencion: 0, total: 0 });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground text-sm">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowUpCircle className="w-5 h-5 text-blue-600" />
          <div>
            <p className="font-jakarta font-semibold">Libro registro de facturas emitidas</p>
            <p className="text-xs text-muted-foreground">Se alimenta exclusivamente de facturas de ingreso registradas.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Buscar por nº, cliente, NIF..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterAnio} onValueChange={setFilterAnio}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {anios.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {Object.entries(ESTADO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center space-y-3">
          <ArrowUpCircle className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold">No hay facturas emitidas registradas</p>
          <p className="text-sm text-muted-foreground">Sube facturas de ingresos para alimentar este registro.</p>
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl overflow-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Fecha</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Nº Factura</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Cliente</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">NIF/CIF</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Base imp.</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Tipo IVA</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Cuota IVA</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Retención</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Total</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Estado cont.</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Doc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono">{inv.fecha_emision}</td>
                    <td className="px-3 py-2 font-mono font-medium">{inv.numero_factura}</td>
                    <td className="px-3 py-2">{inv.cliente_nombre || '—'}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{inv.cliente_nif || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(inv.base_imponible)}</td>
                    <td className="px-3 py-2 text-right">{inv.tipo_iva != null ? `${inv.tipo_iva}%` : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(inv.cuota_iva)}</td>
                    <td className="px-3 py-2 text-right font-mono">{inv.retencion_irpf ? fmt(inv.retencion_irpf) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(inv.total_factura)}</td>
                    <td className="px-3 py-2">
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', ESTADO_CFG[inv.estado_contable] || 'bg-slate-100 text-slate-500')}>
                        {ESTADO_LABEL[inv.estado_contable] || inv.estado_contable}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {inv.archivo_url ? (
                        <a href={inv.archivo_url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0"><Eye className="w-3 h-3" /></Button>
                        </a>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/20 border-t-2 border-border">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-xs font-bold">TOTAL ({filtered.length} facturas)</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{fmt(totales.base)}</td>
                  <td />
                  <td className="px-3 py-2 text-right font-mono font-bold">{fmt(totales.iva)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{totales.retencion ? fmt(totales.retencion) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{fmt(totales.total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDownCircle, Search, Eye, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const fmt = (n) => n != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n) : '—';

const ESTADO_CFG = {
  pendiente: 'bg-slate-100 text-slate-600', asiento_propuesto: 'bg-amber-100 text-amber-700',
  contabilizada: 'bg-emerald-100 text-emerald-700', rechazada: 'bg-red-100 text-red-700',
  requiere_correccion: 'bg-orange-100 text-orange-700',
};
const ESTADO_LABEL = {
  pendiente: 'Pendiente', asiento_propuesto: 'Asiento propuesto',
  contabilizada: 'Contabilizada', rechazada: 'Rechazada', requiere_correccion: 'Requiere corrección',
};
const CAT_LABEL = {
  ventas_servicios: 'Ventas/Servicios', compras: 'Compras', suministros: 'Suministros',
  alquiler: 'Alquiler', publicidad_marketing: 'Publicidad', servicios_profesionales: 'Serv. profesionales',
  software: 'Software', transporte: 'Transporte', dietas: 'Dietas',
  gastos_financieros: 'Gastos financieros', seguros: 'Seguros', otros: 'Otros',
};

export default function LibroRegistroRecibidas() {
  const { company, fiscalProfile } = useOutletContext() || {};
  const [search, setSearch] = useState('');
  const [filterAnio, setFilterAnio] = useState('todos');

  // Comerciante minorista en Canarias: sin derecho a deducción de IGIC
  // El IGIC soportado en facturas recibidas NO es deducible → se trata como mayor gasto
  const isComercianteMinorista = fiscalProfile?.indirectTaxDefault === 'igic'
    && fiscalProfile?.mainTerritory === 'canarias'
    && fiscalProfile?.activities?.some(a => a.indirectTaxRegime === 'comerciante_minorista_igic' || a.deductionRight === 'sin_derecho');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-recibidas', company?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getCompanyFinancials', { company_id: company.id });
      const finData = res?.data || res;
      return (finData?.invoices || []).filter(i => i.tipo === 'recibida');
    },
    enabled: !!company?.id,
  });

  const anios = [...new Set(invoices.map(i => i.anio).filter(Boolean))].sort((a, b) => b - a);

  const filtered = invoices.filter(inv => {
    const matchAnio = filterAnio === 'todos' || String(inv.anio) === filterAnio;
    const matchSearch = !search ||
      inv.numero_factura?.toLowerCase().includes(search.toLowerCase()) ||
      inv.proveedor_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      inv.proveedor_nif?.toLowerCase().includes(search.toLowerCase()) ||
      inv.concepto?.toLowerCase().includes(search.toLowerCase());
    return matchAnio && matchSearch;
  });

  const totales = filtered.reduce((acc, inv) => {
    const base = inv.base_imponible || 0;
    const cuota = inv.cuota_iva || 0;
    return {
      base: acc.base + base,
      iva: acc.iva + cuota,
      // Mayor gasto: base + IGIC no deducible
      gastoTotal: acc.gastoTotal + (isComercianteMinorista ? base + cuota : base),
      total: acc.total + (inv.total_factura || 0),
    };
  }, { base: 0, iva: 0, gastoTotal: 0, total: 0 });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground text-sm">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ArrowDownCircle className="w-5 h-5 text-purple-600" />
        <div>
          <p className="font-jakarta font-semibold">Libro registro de facturas recibidas</p>
          <p className="text-xs text-muted-foreground">Se alimenta exclusivamente de facturas de gasto registradas.</p>
        </div>
      </div>

      {isComercianteMinorista && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-semibold">Régimen especial de comerciante minorista (IGIC)</p>
            <p className="mt-0.5">El IGIC soportado en facturas recibidas <strong>no es deducible</strong>. Se trata como <strong>mayor gasto contable</strong>: el coste real de cada factura = Base + Cuota IGIC.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Buscar por nº, proveedor, NIF, concepto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterAnio} onValueChange={setFilterAnio}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {anios.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center space-y-3">
          <ArrowDownCircle className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold">No hay facturas recibidas registradas</p>
          <p className="text-sm text-muted-foreground">Sube facturas de gastos para alimentar este registro.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-auto">
          <table className={cn("w-full text-xs", isComercianteMinorista ? "min-w-[1100px]" : "min-w-[1000px]")}>
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Fecha</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Nº / Ref.</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Proveedor</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">NIF/CIF</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Concepto</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Base</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">IGIC %</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Cuota IGIC</th>
                {isComercianteMinorista && (
                  <th className="px-3 py-2.5 text-right font-semibold text-amber-700">Gasto total</th>
                )}
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Total</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Categoría</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Estado</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Doc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono">{inv.fecha_emision}</td>
                  <td className="px-3 py-2 font-mono font-medium">{inv.numero_factura}</td>
                  <td className="px-3 py-2">{inv.proveedor_nombre || inv.cliente_nombre || '—'}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{inv.proveedor_nif || inv.cliente_nif || '—'}</td>
                  <td className="px-3 py-2 max-w-32 truncate text-muted-foreground">{inv.concepto || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(inv.base_imponible)}</td>
                  <td className="px-3 py-2 text-right">{inv.tipo_iva != null ? `${inv.tipo_iva}%` : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmt(inv.cuota_iva)}</td>
                  {isComercianteMinorista && (
                    <td className="px-3 py-2 text-right font-mono font-semibold text-amber-700">
                      {fmt((inv.base_imponible || 0) + (inv.cuota_iva || 0))}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(inv.total_factura)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{CAT_LABEL[inv.categoria_gasto] || inv.categoria_gasto || '—'}</td>
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
                <td colSpan={5} className="px-3 py-2 text-xs font-bold">TOTAL ({filtered.length} facturas)</td>
                <td className="px-3 py-2 text-right font-mono font-bold">{fmt(totales.base)}</td>
                <td />
                <td className="px-3 py-2 text-right font-mono font-bold text-muted-foreground">{fmt(totales.iva)}</td>
                {isComercianteMinorista && (
                  <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">{fmt(totales.gastoTotal)}</td>
                )}
                <td className="px-3 py-2 text-right font-mono font-bold">{fmt(totales.total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
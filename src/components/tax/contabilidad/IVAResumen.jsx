import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { Receipt, AlertTriangle } from 'lucide-react';

const fmt = (n) => n != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n) : '—';

export default function IVAResumen() {
  const [filterAnio, setFilterAnio] = useState('todos');
  const [filterTrimestre, setFilterTrimestre] = useState('todos');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-iva'],
    queryFn: () => base44.entities.Invoice.filter({ estado_contable: 'contabilizada' }, '-fecha_emision', 1000),
  });

  const anios = [...new Set(invoices.map(i => i.anio).filter(Boolean))].sort((a, b) => b - a);

  const filtered = invoices.filter(inv => {
    const matchAnio = filterAnio === 'todos' || String(inv.anio) === filterAnio;
    const matchT = filterTrimestre === 'todos' || inv.trimestre === filterTrimestre;
    return matchAnio && matchT;
  });

  const emitidas = filtered.filter(i => i.tipo === 'emitida');
  const recibidas = filtered.filter(i => i.tipo === 'recibida');

  const ivaRepercutido = emitidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const ivaSoportado = recibidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const resultado = ivaRepercutido - ivaSoportado;

  if (isLoading) return <div className="p-10 text-center text-muted-foreground text-sm">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-primary" />
        <div>
          <p className="font-jakarta font-semibold">Resumen IVA / IGIC</p>
          <p className="text-xs text-muted-foreground">Basado exclusivamente en facturas contabilizadas. No es un modelo fiscal definitivo.</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2 text-xs text-amber-800">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <p>Este resumen es orientativo e interno. Solo se incluyen facturas con estado <strong>Contabilizada</strong>. Para calcular modelos fiscales definitivos consulta con tu asesor.</p>
      </div>

      <div className="flex gap-2">
        <Select value={filterAnio} onValueChange={setFilterAnio}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {anios.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTrimestre} onValueChange={setFilterTrimestre}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Trimestre" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {['T1', 'T2', 'T3', 'T4'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center space-y-3">
          <Receipt className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold">No hay datos de IVA disponibles</p>
          <p className="text-sm text-muted-foreground">El resumen de IVA se genera cuando existen facturas contabilizadas.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-medium">IVA repercutido (emitidas)</p>
              <p className="text-2xl font-bold font-jakarta text-blue-700 mt-1">{fmt(ivaRepercutido)}</p>
              <p className="text-[11px] text-blue-500 mt-1">{emitidas.length} facturas emitidas contabilizadas</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-xs text-purple-600 font-medium">IVA soportado (recibidas)</p>
              <p className="text-2xl font-bold font-jakarta text-purple-700 mt-1">{fmt(ivaSoportado)}</p>
              <p className="text-[11px] text-purple-500 mt-1">{recibidas.length} facturas recibidas contabilizadas</p>
            </div>
            <div className={`${resultado >= 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'} border rounded-xl p-4`}>
              <p className={`text-xs font-medium ${resultado >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                Resultado IVA ({resultado >= 0 ? 'A pagar' : 'A compensar'})
              </p>
              <p className={`text-2xl font-bold font-jakarta mt-1 ${resultado >= 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {fmt(Math.abs(resultado))}
              </p>
              <p className={`text-[11px] mt-1 ${resultado >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>Orientativo — pendiente de revisión</p>
            </div>
          </div>

          {/* Por tipo de IVA */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">Desglose por tipo impositivo</p>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Tipo</th>
                  <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Base emitidas</th>
                  <th className="px-4 py-2 text-right font-semibold text-muted-foreground">IVA repercutido</th>
                  <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Base recibidas</th>
                  <th className="px-4 py-2 text-right font-semibold text-muted-foreground">IVA soportado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...new Set(filtered.map(i => i.tipo_iva).filter(t => t != null))].sort().map(tipo => {
                  const em = filtered.filter(i => i.tipo === 'emitida' && i.tipo_iva === tipo);
                  const re = filtered.filter(i => i.tipo === 'recibida' && i.tipo_iva === tipo);
                  return (
                    <tr key={tipo} className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium">{tipo}%</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(em.reduce((s, i) => s + (i.base_imponible || 0), 0))}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(em.reduce((s, i) => s + (i.cuota_iva || 0), 0))}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(re.reduce((s, i) => s + (i.base_imponible || 0), 0))}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(re.reduce((s, i) => s + (i.cuota_iva || 0), 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
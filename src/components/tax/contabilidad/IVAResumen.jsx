import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Receipt } from 'lucide-react';

const fmt = (value) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));

export default function IVAResumen() {
  const { company } = useOutletContext() || {};
  const [year, setYear] = useState('todos');
  const [quarter, setQuarter] = useState('todos');
  const query = useQuery({
    queryKey: ['accounting-tax-summary', company?.id, year, quarter],
    enabled: Boolean(company?.id),
    queryFn: async () => {
      const response = await base44.functions.invoke('accountingOperations', {
        action: 'tax_summary',
        companyId: company.id,
        year,
        quarter,
      });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
  });

  if (query.isLoading) return <div className="p-10 text-center text-sm text-muted-foreground">Cargando resumen fiscal…</div>;
  if (query.isError) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{query.error.message}</div>;

  const data = query.data || {};
  const totals = data.totals || {};
  const quality = data.quality || {};
  const label = data.taxKind === 'igic' ? 'IGIC' : 'IVA';
  const result = Number(totals.result || 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="h-5 w-5 text-primary" />
        <div>
          <p className="font-semibold">Resumen {label}</p>
          <p className="text-xs text-muted-foreground">Cuotas repercutidas, soportadas, deducibles y no deducibles de facturas contabilizadas.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos</SelectItem>{(data.years || []).map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={quarter} onValueChange={setQuarter}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Trimestre" /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos</SelectItem>{['T1', 'T2', 'T3', 'T4'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          [`${label} repercutido`, totals.outputQuota, 'text-blue-700'],
          [`${label} soportado`, totals.inputQuota, 'text-purple-700'],
          [`${label} deducible`, totals.deductibleQuota, 'text-emerald-700'],
          [`${label} no deducible`, totals.nonDeductibleQuota, 'text-amber-700'],
        ].map(([title, value, color]) => (
          <div key={title} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{title}</p><p className={`mt-1 text-xl font-semibold ${color}`}>{fmt(value)}</p></div>
        ))}
      </div>

      <div className={`rounded-xl border p-4 ${result >= 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
        <p className="text-xs font-medium">Resultado interno · {result >= 0 ? 'a ingresar' : 'a compensar'}</p>
        <p className="mt-1 text-2xl font-bold">{fmt(Math.abs(result))}</p>
      </div>

      {(quality.legacyAggregateInvoices > 0 || quality.pendingReviewLines > 0) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>{quality.legacyAggregateInvoices || 0} facturas históricas usan el agregado de cabecera y {quality.pendingReviewLines || 0} líneas siguen pendientes de revisión fiscal. No deben darse por listas para presentar.</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3"><p className="text-sm font-semibold">Desglose por impuesto y tipo</p><p className="text-xs text-muted-foreground">{quality.invoices || 0} facturas · {quality.detailedInvoices || 0} con detalle fiscal estructurado</p></div>
        {(data.rows || []).length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No hay facturas contabilizadas en el periodo.</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted/40"><tr>{['Tipo', 'Base emitida', 'Repercutido', 'Base recibida', 'Soportado', 'Deducible', 'No deducible'].map((title) => <th key={title} className="px-4 py-2 text-right first:text-left">{title}</th>)}</tr></thead><tbody className="divide-y divide-border">{data.rows.map((row) => <tr key={`${row.taxKind}-${row.rate}`}><td className="px-4 py-2 font-medium">{String(row.taxKind).toUpperCase()} {row.rate}%</td><td className="px-4 py-2 text-right font-mono">{fmt(row.issuedBase)}</td><td className="px-4 py-2 text-right font-mono">{fmt(row.outputQuota)}</td><td className="px-4 py-2 text-right font-mono">{fmt(row.receivedBase)}</td><td className="px-4 py-2 text-right font-mono">{fmt(row.inputQuota)}</td><td className="px-4 py-2 text-right font-mono">{fmt(row.deductibleQuota)}</td><td className="px-4 py-2 text-right font-mono">{fmt(row.nonDeductibleQuota)}</td></tr>)}</tbody></table></div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{data.notice}</p>
    </div>
  );
}


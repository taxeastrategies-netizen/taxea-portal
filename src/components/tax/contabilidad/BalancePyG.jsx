import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, BarChart2, CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n || 0));

function AccountsSection({ title, rows, total, tone = 'neutral' }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/25">
        <p className="text-sm font-semibold">{title}</p>
        <p className={cn('font-mono text-sm font-bold', tone === 'positive' && 'text-emerald-700', tone === 'negative' && 'text-red-600')}>{fmt(total)}</p>
      </div>
      <div className="max-h-72 overflow-auto divide-y divide-border/60">
        {rows.filter(row => Math.abs(Number(row.amount ?? row.balance)) > 0.004).length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">Sin movimientos en este bloque.</p>
        ) : rows.filter(row => Math.abs(Number(row.amount ?? row.balance)) > 0.004).map(row => (
          <div key={row.code} className="grid grid-cols-[90px_1fr_auto] gap-3 px-4 py-2 text-xs hover:bg-muted/20">
            <span className="font-mono font-semibold text-primary">{row.code}</span>
            <span className="truncate text-muted-foreground">{row.name}</span>
            <span className="font-mono text-foreground">{fmt(row.amount ?? row.balance)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function downloadCsv(report) {
  const rows = [['Cuenta', 'Nombre', 'Debe', 'Haber', 'Saldo']];
  report.accounts.forEach(row => rows.push([row.code, row.name, row.debit, row.credit, row.balance]));
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `balance-sumas-saldos-${report.year}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BalancePyG({ companyId }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [scope, setScope] = useState('confirmed');
  const query = useQuery({
    queryKey: ['accounting-reports-v2', companyId, year, scope],
    queryFn: async () => {
      const response = await base44.functions.invoke('accountingOperations', { action: 'reports', companyId, year: Number(year), scope });
      return response?.data || response;
    },
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
  const report = query.data?.report;
  const quality = query.data?.quality;
  const years = useMemo(() => {
    const values = report?.years?.length ? report.years : [new Date().getFullYear()];
    return [...new Set([...values, Number(year)])].sort((a, b) => b - a);
  }, [report?.years, year]);

  if (query.isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Calculando estados contables desde el diario...</div>;
  if (query.isError || !report) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
      No se pudieron calcular los estados contables. {query.error?.response?.data?.error || query.error?.message || ''}
    </div>
  );

  const bs = report.balanceSheet;
  const pl = report.profitAndLoss;
  const trialOk = Math.abs(report.trialBalance.difference) <= 0.01;
  const balanceOk = Math.abs(bs.difference) <= 0.01;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 mr-auto">
          <BarChart2 className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-jakarta font-bold">Estados contables</h2>
            <p className="text-xs text-muted-foreground">Balance, PyG y sumas y saldos calculados en servidor desde asientos cuadrados.</p>
          </div>
        </div>
        <Select value={year} onValueChange={setYear}><SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent>{years.map(item => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent></Select>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="confirmed">Solo confirmados</SelectItem><SelectItem value="provisional">Confirmados + revisión</SelectItem></SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8" onClick={() => query.refetch()}><RefreshCw className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => downloadCsv(report)}><Download className="w-3.5 h-3.5" />CSV</Button>
      </div>

      {scope === 'provisional' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          Vista provisional: incluye asientos importados pendientes de revisión. Sirve para análisis y no equivale a cierre contable validado.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Asientos incluidos', report.includedEntries],
          ['Facturas con asiento sano', `${quality.healthyInvoicePostings}/${quality.activeInvoices}`],
          ['Pendientes de contabilizar', quality.pendingInvoicePostings],
          ['Asientos en revisión', quality.reviewEntries],
          ['Pagos con asiento', `${quality.paymentsWithEntry}/${quality.payments}`],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="font-mono text-lg font-bold mt-1">{value}</p></div>)}
      </div>

      {(report.excludedEntries > 0 || quality.unresolvedLines > 0) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          Se han excluido {report.excludedEntries} asientos sin integridad suficiente. Líneas históricas sin cabecera localizable: {quality.unresolvedLines}. No se incorporan a los estados hasta corregirlos.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={cn('rounded-xl border p-4', trialOk ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50')}>
          <div className="flex items-center gap-2">{trialOk ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}<p className="text-xs font-semibold">Balance de sumas y saldos</p></div>
          <div className="grid grid-cols-2 gap-3 mt-3 text-xs"><div><p className="text-muted-foreground">Debe</p><p className="font-mono font-bold">{fmt(report.trialBalance.debit)}</p></div><div><p className="text-muted-foreground">Haber</p><p className="font-mono font-bold">{fmt(report.trialBalance.credit)}</p></div></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Resultado del ejercicio</p><p className={cn('font-mono text-xl font-bold mt-2', pl.result >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(pl.result)}</p><p className="text-[11px] text-muted-foreground mt-1">Ingresos {fmt(pl.totalIncome)} · Gastos {fmt(pl.totalExpenses)}</p></div>
        <div className={cn('rounded-xl border p-4', balanceOk ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')}><p className="text-xs text-muted-foreground">Cuadre del balance</p><p className="font-mono text-xl font-bold mt-2">{fmt(bs.difference)}</p><p className="text-[11px] text-muted-foreground mt-1">Activo menos patrimonio neto y pasivo</p></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide">Balance de situación</h3>
          <AccountsSection title="Activo" rows={bs.assets} total={bs.totalAssets} />
          <AccountsSection title="Patrimonio neto" rows={bs.equity} total={bs.totalEquityBeforeResult} />
          {Math.abs(bs.result) > 0.004 && <AccountsSection title="Resultado del ejercicio" rows={[{ code: '129', name: 'Resultado del ejercicio', amount: bs.result }]} total={bs.result} tone={bs.result >= 0 ? 'positive' : 'negative'} />}
          <AccountsSection title="Pasivo" rows={bs.liabilities} total={bs.totalLiabilities} />
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide">Pérdidas y ganancias</h3>
          <AccountsSection title="Ingresos" rows={pl.income} total={pl.totalIncome} tone="positive" />
          <AccountsSection title="Gastos" rows={pl.expenses} total={pl.totalExpenses} tone="negative" />
          <div className={cn('flex items-center justify-between rounded-xl border-2 px-5 py-4 font-bold', pl.result >= 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800')}><span>Resultado del ejercicio</span><span className="font-mono">{fmt(pl.result)}</span></div>
        </div>
      </div>

      <AccountsSection title="Balance de sumas y saldos" rows={report.accounts} total={report.trialBalance.difference} />
    </div>
  );
}


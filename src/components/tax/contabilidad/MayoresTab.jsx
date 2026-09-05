import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Search, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = n => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MayoresTab({ companyId }) {
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [scope, setScope] = useState('confirmed');
  const query = useQuery({
    queryKey: ['accounting-ledger-v2', companyId, year, scope, selectedCode],
    queryFn: async () => {
      const response = await base44.functions.invoke('accountingOperations', { action: 'ledger', companyId, year: Number(year), scope, accountCode: selectedCode });
      return (response?.data || response)?.ledger;
    },
    enabled: Boolean(companyId),
    staleTime: 30_000,
  });
  const accounts = query.data?.accounts || [];
  const years = query.data?.years?.length ? query.data.years : [new Date().getFullYear()];
  const selected = accounts.find(account => account.code === selectedCode);
  const movements = query.data?.movements || [];
  const filtered = useMemo(() => accounts.filter(account => !search || account.code.includes(search) || account.name.toLowerCase().includes(search.toLowerCase())), [accounts, search]);

  if (query.isLoading && !query.data) return <div className="p-10 text-center text-sm text-muted-foreground">Calculando mayores...</div>;
  if (query.isError) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">No se pudo calcular el mayor. {query.error?.response?.data?.error || query.error?.message}</div>;
  if (!accounts.length) return <div className="bg-card border border-border rounded-xl p-16 text-center space-y-3"><TrendingUp className="w-10 h-10 text-muted-foreground/40 mx-auto" /><p className="font-semibold">No hay mayores para este ejercicio</p><p className="text-sm text-muted-foreground">Confirma asientos o cambia a la vista provisional para revisar la importación.</p></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div><h2 className="font-jakarta font-bold">Libro mayor</h2><p className="text-xs text-muted-foreground">Movimientos y saldo acumulado por subcuenta.</p></div>
        <Select value={year} onValueChange={value => { setYear(value); setSelectedCode(''); }}><SelectTrigger className="ml-auto h-8 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent>{years.map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select>
        <Select value={scope} onValueChange={value => { setScope(value); setSelectedCode(''); }}><SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="confirmed">Solo confirmados</SelectItem><SelectItem value="provisional">Confirmados + revisión</SelectItem></SelectContent></Select>
      </div>
      {scope === 'provisional' && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Vista provisional: incluye asientos pendientes de validación contable.</div>}
      <div className="flex gap-4 h-[70vh]">
        <div className="w-80 flex-shrink-0 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border"><div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" /><Input className="pl-7 h-8 text-xs" placeholder="Buscar cuenta..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filtered.map(account => <button key={account.code} onClick={() => setSelectedCode(account.code)} className={cn('w-full text-left px-3 py-2.5 hover:bg-muted/50', selectedCode === account.code && 'bg-primary/8 border-l-2 border-primary')}><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-primary">{account.code}</span><span className={cn('text-[10px] font-mono', account.balance >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(account.balance)}</span></div><p className="text-[11px] text-muted-foreground truncate mt-0.5">{account.name}</p></button>)}
          </div>
        </div>
        <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          {!selected ? <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2"><ArrowRight className="w-8 h-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Selecciona una subcuenta para abrir su mayor</p></div> : <>
            <div className="px-5 py-3 border-b border-border"><p className="font-jakarta font-bold text-sm">{selected.code} — {selected.name}</p><div className="flex gap-6 mt-1 text-xs"><span className="text-muted-foreground">Debe: <span className="font-mono text-foreground">{fmt(selected.debit)}</span></span><span className="text-muted-foreground">Haber: <span className="font-mono text-foreground">{fmt(selected.credit)}</span></span><span className="text-muted-foreground">Saldo: <span className="font-mono font-semibold">{fmt(selected.balance)}</span></span></div></div>
            <div className="flex-1 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-muted/50"><tr>{['Fecha','Asiento','Documento','Descripción','Debe','Haber','Saldo'].map(header => <th key={header} className={cn('px-3 py-2 text-left font-semibold text-muted-foreground', ['Debe','Haber','Saldo'].includes(header) && 'text-right')}>{header}</th>)}</tr></thead><tbody className="divide-y divide-border">{query.isFetching ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Cargando movimientos...</td></tr> : movements.map(movement => <tr key={movement.id} className="hover:bg-muted/20"><td className="px-3 py-2 font-mono text-muted-foreground">{movement.date || '—'}</td><td className="px-3 py-2 font-mono text-primary">{movement.entryNumber || '—'}</td><td className="px-3 py-2 font-mono text-muted-foreground">{movement.documentId ? movement.documentId.slice(-8) : '—'}</td><td className="px-3 py-2 text-muted-foreground">{movement.description || '—'}</td><td className="px-3 py-2 text-right font-mono">{movement.debit ? fmt(movement.debit) : ''}</td><td className="px-3 py-2 text-right font-mono">{movement.credit ? fmt(movement.credit) : ''}</td><td className="px-3 py-2 text-right font-mono font-medium">{fmt(movement.runningBalance)}</td></tr>)}</tbody></table></div>
          </>}
        </div>
      </div>
    </div>
  );
}


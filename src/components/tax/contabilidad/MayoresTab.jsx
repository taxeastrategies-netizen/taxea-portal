import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { TrendingUp, Search, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = n => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MayoresTab() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['journal-lines-mayores'],
    queryFn: () => base44.entities.JournalEntryLine.filter({ entryStatus: 'confirmado' }, 'lineNumber', 2000),
  });

  // Build accounts dynamically from confirmed lines
  const accountMap = {};
  lines.forEach(l => {
    if (!l.accountCode) return;
    if (!accountMap[l.accountCode]) {
      accountMap[l.accountCode] = { code: l.accountCode, name: l.accountName || l.accountCode, debit: 0, credit: 0, lines: [] };
    }
    accountMap[l.accountCode].debit += Number(l.debit) || 0;
    accountMap[l.accountCode].credit += Number(l.credit) || 0;
    accountMap[l.accountCode].lines.push(l);
  });

  const accounts = Object.values(accountMap).sort((a, b) => a.code.localeCompare(b.code));

  const filtered = accounts.filter(a =>
    !search || a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="p-10 text-center text-muted-foreground text-sm">Cargando mayores...</div>;

  if (accounts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-16 text-center space-y-3">
        <TrendingUp className="w-10 h-10 text-muted-foreground/40 mx-auto" />
        <p className="font-semibold text-foreground">No hay datos de mayor disponibles</p>
        <p className="text-sm text-muted-foreground">Los mayores se generan desde asientos confirmados. Contabiliza facturas para ver los movimientos por cuenta.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[70vh]">
      {/* Account list */}
      <div className="w-72 flex-shrink-0 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input className="pl-7 h-7 text-xs" placeholder="Buscar cuenta..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {filtered.map(acc => {
            const saldo = acc.debit - acc.credit;
            return (
              <button
                key={acc.code}
                onClick={() => setSelected(acc)}
                className={cn(
                  'w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors',
                  selected?.code === acc.code && 'bg-primary/8 border-l-2 border-primary'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-primary">{acc.code}</span>
                  <span className={cn('text-[10px] font-mono', saldo >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(saldo)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{acc.name}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mayor detail */}
      <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2">
            <ArrowRight className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Selecciona una cuenta para ver sus movimientos</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-border">
              <p className="font-jakarta font-bold text-sm">{selected.code} — {selected.name}</p>
              <div className="flex gap-6 mt-1 text-xs">
                <span className="text-muted-foreground">Debe: <span className="font-mono text-foreground">{fmt(selected.debit)}</span></span>
                <span className="text-muted-foreground">Haber: <span className="font-mono text-foreground">{fmt(selected.credit)}</span></span>
                <span className="text-muted-foreground">Saldo: <span className={cn('font-mono font-semibold', (selected.debit - selected.credit) >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(selected.debit - selected.credit)}</span></span>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Descripción</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Debe</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Haber</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Saldo acum.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    let runningBalance = 0;
                    return selected.lines.map((line, i) => {
                      runningBalance += (Number(line.debit) || 0) - (Number(line.credit) || 0);
                      return (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-2 text-muted-foreground">{line.description || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono">{Number(line.debit) > 0 ? fmt(line.debit) : ''}</td>
                          <td className="px-3 py-2 text-right font-mono">{Number(line.credit) > 0 ? fmt(line.credit) : ''}</td>
                          <td className={cn('px-3 py-2 text-right font-mono font-medium', runningBalance >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(runningBalance)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
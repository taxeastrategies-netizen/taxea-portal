import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, ExternalLink, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = n => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MayorCuenta({ account, onClose }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (account) load();
  }, [account]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.JournalEntryLine.filter(
      { accountCode: account.code },
      'lineNumber',
      200
    ).catch(() => []);
    // Only confirmed entries
    const confirmed = (data || []).filter(l => l.entryStatus === 'confirmado' || l.entryStatus === 'pendiente_revision');
    // Sort by date (we don't have date on line, use created_date)
    const sorted = confirmed.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    // Compute running balance
    let balance = Number(account.openingDebit || 0) - Number(account.openingCredit || 0);
    const withBalance = sorted.map(l => {
      balance += Number(l.debit || 0) - Number(l.credit || 0);
      return { ...l, runningBalance: balance };
    });
    setLines(withBalance);
    setLoading(false);
  };

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const saldo = totalDebit - totalCredit;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-background border-l border-border shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="font-jakarta font-bold text-foreground">{account.code} — {account.name}</h2>
          <p className="text-xs text-muted-foreground capitalize">{account.type} · {account.group}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-px bg-border">
        {[
          { label: 'Total Debe', value: totalDebit, color: 'text-foreground' },
          { label: 'Total Haber', value: totalCredit, color: 'text-foreground' },
          { label: 'Saldo', value: saldo, color: saldo >= 0 ? 'text-emerald-600' : 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('font-mono font-bold text-sm mt-0.5', color)}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : lines.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Sin movimientos registrados para esta cuenta.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-secondary/50">
              <tr>
                {['Asiento','Descripción','Debe','Haber','Saldo acum.','Contr.','✓'].map(h => (
                  <th key={h} className={cn('px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide', ['Debe','Haber','Saldo acum.'].includes(h) && 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-secondary/20">
                  <td className="px-3 py-2 font-mono text-primary">{line.journalEntryId?.slice(-6)}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate text-foreground">{line.description || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{Number(line.debit) > 0 ? fmt(line.debit) : ''}</td>
                  <td className="px-3 py-2 text-right font-mono">{Number(line.credit) > 0 ? fmt(line.credit) : ''}</td>
                  <td className={cn('px-3 py-2 text-right font-mono font-medium', Number(line.runningBalance) >= 0 ? 'text-emerald-700' : 'text-red-700')}>{fmt(line.runningBalance)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{line.counterpartyAccountCode || '—'}</td>
                  <td className="px-3 py-2">
                    {line.isReconciled && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Download, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import MayorCuenta from './MayorCuenta';
import JournalEntryForm from './JournalEntryForm';

const fmt = n => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_COLORS = {
  activo: 'bg-blue-100 text-blue-700', pasivo: 'bg-purple-100 text-purple-700',
  patrimonio: 'bg-indigo-100 text-indigo-700', ingreso: 'bg-emerald-100 text-emerald-700',
  gasto: 'bg-red-100 text-red-700', banco: 'bg-cyan-100 text-cyan-700',
  cliente: 'bg-amber-100 text-amber-700', proveedor: 'bg-orange-100 text-orange-700',
  impuesto: 'bg-pink-100 text-pink-700',
};

export default function CuadrosCuentas() {
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('activa');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showNewEntry, setShowNewEntry] = useState(false);

  const load = async () => {
    setLoading(true);
    const [accs, lns] = await Promise.all([
      base44.entities.AccountingAccount.list('code', 300).catch(() => []),
      base44.entities.JournalEntryLine.list('created_date', 1000).catch(() => []),
    ]);
    setAccounts(accs || []);
    setLines(lns || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const accountsWithBalances = useMemo(() => {
    return accounts.map(acc => {
      const accLines = lines.filter(l => l.accountCode === acc.code && l.entryStatus === 'confirmado');
      const debe = accLines.reduce((s, l) => s + Number(l.debit || 0), 0) + Number(acc.openingDebit || 0);
      const haber = accLines.reduce((s, l) => s + Number(l.credit || 0), 0) + Number(acc.openingCredit || 0);
      return { ...acc, debe, haber, saldo: debe - haber, movCount: accLines.length };
    });
  }, [accounts, lines]);

  const filtered = accountsWithBalances.filter(a => {
    const matchSearch = !search || a.code?.includes(search) || a.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || a.type === filterType;
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  }).sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">Cuadro de cuentas</h2>
          <p className="text-xs text-muted-foreground">El cuadro se construye desde las cuentas usadas en facturas contabilizadas y asientos confirmados. No se crean cuentas artificiales.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} className="h-8 gap-1.5"><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" onClick={() => setShowNewEntry(true)} className="h-8 gap-1.5"><Plus className="w-3.5 h-3.5" />Nuevo asiento</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar cuenta..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {['activo','pasivo','patrimonio','ingreso','gasto','banco','cliente','proveedor','impuesto'].map(t => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="activa">Activas</SelectItem>
            <SelectItem value="inactiva">Inactivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50">
              <tr>
                {['Cuenta','Nombre','Tipo','Grupo','Debe','Haber','Saldo','Movs.',''].map((h, i) => (
                  <th key={i} className={cn('px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide', ['Debe','Haber','Saldo'].includes(h) && 'text-right')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center">
                  {accounts.length === 0 ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">El cuadro de cuentas se alimentará de las cuentas usadas en facturas y asientos</p>
                      <p className="text-muted-foreground text-sm">Contabiliza facturas desde la pestaña "Facturas pendientes" para ver cuentas aquí.</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No hay cuentas que coincidan con los filtros.</p>
                  )}
                </td></tr>
              ) : filtered.map(acc => (
                <tr key={acc.id} className="hover:bg-secondary/20 cursor-pointer group" onClick={() => setSelectedAccount(acc)}>
                  <td className="px-3 py-2.5 font-mono font-semibold text-primary">{acc.code}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground max-w-[200px] truncate">{acc.name}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize', TYPE_COLORS[acc.type] || 'bg-secondary text-foreground')}>{acc.type}</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{acc.group || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{acc.debe > 0 ? fmt(acc.debe) : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{acc.haber > 0 ? fmt(acc.haber) : '—'}</td>
                  <td className={cn('px-3 py-2.5 text-right font-mono font-semibold', acc.saldo >= 0 ? 'text-emerald-700' : 'text-red-600')}>{fmt(acc.saldo)}</td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{acc.movCount}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">Ver mayor →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAccount && <MayorCuenta account={selectedAccount} onClose={() => setSelectedAccount(null)} />}
      {showNewEntry && <JournalEntryForm open accounts={accounts} onClose={() => setShowNewEntry(false)} onSaved={load} />}
    </div>
  );
}
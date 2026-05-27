import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, RefreshCw } from 'lucide-react';
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

// Infer account type from PGC code
function inferType(code) {
  const c = String(code || '');
  const g = c.charAt(0);
  if (g === '1' || g === '2') return 'activo';
  if (g === '3') return 'activo'; // existencias
  if (c.startsWith('4')) {
    if (c.startsWith('40')) return 'proveedor';
    if (c.startsWith('43')) return 'cliente';
    if (c.startsWith('47')) return 'impuesto';
    return 'pasivo';
  }
  if (g === '5') return 'banco';
  if (g === '6') return 'gasto';
  if (g === '7') return 'ingreso';
  return 'otro';
}

export default function CuadrosCuentas() {
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([]);
  const [confirmedIds, setConfirmedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showNewEntry, setShowNewEntry] = useState(false);

  const load = async () => {
    setLoading(true);
    const [accs, lns, entries] = await Promise.all([
      base44.entities.AccountingAccount.list('code', 500).catch(() => []),
      base44.entities.JournalEntryLine.list('-created_date', 2000).catch(() => []),
      base44.entities.JournalEntry.list('-date', 1000).catch(() => []),
    ]);

    // Confirmed = entries with status confirmado OR contabilizada (some may use different value)
    const confirmed = (entries || []).filter(e => e.status === 'confirmado' || e.status === 'contabilizada');
    const ids = new Set(confirmed.map(e => e.id));

    setAccounts(accs || []);
    setLines(lns || []);
    setConfirmedIds(ids);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Build combined account list: real AccountingAccount records + synthesized from journal lines
  const accountsWithBalances = useMemo(() => {
    // Confirmed lines (by journal entry status)
    const confirmedLines = lines.filter(l => confirmedIds.has(l.journalEntryId));
    // ALL lines for activity count (includes drafts)
    const allLinesByCode = {};
    lines.forEach(l => {
      if (!l.accountCode) return;
      if (!allLinesByCode[l.accountCode]) allLinesByCode[l.accountCode] = [];
      allLinesByCode[l.accountCode].push(l);
    });

    // Start with real AccountingAccount entities
    const result = {};
    accounts.forEach(acc => {
      const accLines = confirmedLines.filter(l => l.accountCode === acc.code);
      const debe = accLines.reduce((s, l) => s + Number(l.debit || 0), 0) + Number(acc.openingDebit || 0);
      const haber = accLines.reduce((s, l) => s + Number(l.credit || 0), 0) + Number(acc.openingCredit || 0);
      result[acc.code] = {
        ...acc,
        debe, haber, saldo: debe - haber,
        movCount: (allLinesByCode[acc.code] || []).length,
        isVirtual: false,
      };
    });

    // Synthesize accounts from journal lines that don't have an AccountingAccount record
    const usedCodes = new Set(Object.keys(result));
    Object.entries(allLinesByCode).forEach(([code, codeLines]) => {
      if (usedCodes.has(code)) return;
      const confirmed = codeLines.filter(l => confirmedIds.has(l.journalEntryId));
      const debe = confirmed.reduce((s, l) => s + Number(l.debit || 0), 0);
      const haber = confirmed.reduce((s, l) => s + Number(l.credit || 0), 0);
      const sample = codeLines[0];
      result[code] = {
        id: `virtual_${code}`,
        code,
        name: sample.accountName || code,
        type: inferType(code),
        group: code.charAt(0),
        status: 'activa',
        debe, haber, saldo: debe - haber,
        movCount: codeLines.length,
        isVirtual: true,
      };
    });

    return Object.values(result);
  }, [accounts, lines, confirmedIds]);

  const filtered = accountsWithBalances.filter(a => {
    const matchSearch = !search || a.code?.includes(search) || a.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || a.type === filterType;
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  }).sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  const hasAnyActivity = accountsWithBalances.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">Cuadro de cuentas</h2>
          <p className="text-xs text-muted-foreground">
            Se construye automáticamente desde facturas contabilizadas y asientos.
            {accountsWithBalances.some(a => a.isVirtual) && ' Incluye cuentas sintetizadas desde asientos.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} className="h-8 gap-1.5"><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" onClick={() => setShowNewEntry(true)} className="h-8 gap-1.5"><Plus className="w-3.5 h-3.5" />Nuevo asiento</Button>
        </div>
      </div>

      {/* Summary by group */}
      {hasAnyActivity && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: 'Ingresos', types: ['ingreso'], color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { label: 'Gastos', types: ['gasto'], color: 'text-red-700 bg-red-50 border-red-200' },
            { label: 'Clientes (Cobrar)', types: ['cliente'], color: 'text-amber-700 bg-amber-50 border-amber-200' },
            { label: 'Proveedores (Pagar)', types: ['proveedor'], color: 'text-purple-700 bg-purple-50 border-purple-200' },
          ].map(g => {
            const total = accountsWithBalances.filter(a => g.types.includes(a.type)).reduce((s, a) => s + Math.abs(a.saldo), 0);
            return (
              <div key={g.label} className={cn('rounded-lg border px-3 py-2.5', g.color)}>
                <p className="text-xs font-medium">{g.label}</p>
                <p className="text-base font-bold font-jakarta">{fmt(total)} €</p>
              </div>
            );
          })}
        </div>
      )}

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
                  {!hasAnyActivity ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground">El cuadro de cuentas se alimentará de facturas contabilizadas y asientos</p>
                      <p className="text-muted-foreground text-sm">Contabiliza facturas o crea asientos manuales para ver cuentas aquí.</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No hay cuentas que coincidan con los filtros.</p>
                  )}
                </td></tr>
              ) : filtered.map(acc => (
                <tr key={acc.id} className="hover:bg-secondary/20 cursor-pointer group" onClick={() => setSelectedAccount(acc)}>
                  <td className="px-3 py-2.5 font-mono font-semibold text-primary">{acc.code}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground max-w-[200px] truncate">
                    {acc.name}
                    {acc.isVirtual && <span className="ml-1 text-[9px] text-muted-foreground">(auto)</span>}
                  </td>
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
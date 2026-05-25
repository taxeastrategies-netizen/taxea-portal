import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, RefreshCw, CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import JournalEntryForm from './JournalEntryForm';

const fmt = n => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—';

const STATUS_CFG = {
  confirmado:        { label: 'Confirmado',        icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  pendiente_revision:{ label: 'Pdte. revisión',    icon: Clock,       color: 'text-amber-600 bg-amber-50 border-amber-200' },
  borrador:          { label: 'Borrador',           icon: Clock,       color: 'text-slate-500 bg-slate-50 border-slate-200' },
  anulado:           { label: 'Anulado',            icon: XCircle,     color: 'text-red-600 bg-red-50 border-red-200' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.borrador;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', cfg.color)}>
      <Icon className="w-2.5 h-2.5" />{cfg.label}
    </span>
  );
}

export default function LibroDiario() {
  const [entries, setEntries] = useState([]);
  const [lines, setLines] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState(null);

  const load = async () => {
    setLoading(true);
    const [ents, lns, accs] = await Promise.all([
      base44.entities.JournalEntry.list('-date', 200).catch(() => []),
      base44.entities.JournalEntryLine.list('lineNumber', 1000).catch(() => []),
      base44.entities.AccountingAccount.list('code', 300).catch(() => []),
    ]);
    setEntries(ents || []);
    setLines(lns || []);
    setAccounts(accs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleConfirm = async (entry) => {
    const entryLines = lines.filter(l => l.journalEntryId === entry.id);
    const td = entryLines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const tc = entryLines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(td - tc) > 0.01) { alert('El asiento no cuadra. Debe = Haber.'); return; }
    await base44.entities.JournalEntry.update(entry.id, { status: 'confirmado', confirmedAt: new Date().toISOString() });
    await Promise.all(entryLines.map(l => base44.entities.JournalEntryLine.update(l.id, { entryStatus: 'confirmado' })));
    load();
  };

  const handleAnular = async (entry) => {
    if (!confirm('¿Anular este asiento? No podrá deshacerse.')) return;
    await base44.entities.JournalEntry.update(entry.id, { status: 'anulado' });
    load();
  };

  const filtered = entries.filter(e => {
    const matchSearch = !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.entryNumber?.includes(search);
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchType = filterType === 'all' || e.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">Libro diario</h2>
          <p className="text-xs text-muted-foreground">Gestiona asientos manuales, movimientos generados por OCR, facturas y bancos.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} className="h-8"><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" onClick={() => setShowNewEntry(true)} className="h-8 gap-1.5"><Plus className="w-3.5 h-3.5" />Nuevo asiento</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar asiento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(STATUS_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {['manual','gasto','ingreso','pago','cobro','banco','nomina','apertura','cierre'].map(t => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Entries */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Sin asientos registrados.</p>
            <Button size="sm" onClick={() => setShowNewEntry(true)} className="mt-3 gap-1.5"><Plus className="w-3.5 h-3.5" />Crear primer asiento</Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(entry => {
              const entryLines = lines.filter(l => l.journalEntryId === entry.id);
              const isExpanded = expandedEntry === entry.id;
              const isUnbalanced = Math.abs(Number(entry.totalDebit) - Number(entry.totalCredit)) > 0.01 && entry.status !== 'borrador';

              return (
                <div key={entry.id}>
                  <div
                    className="flex flex-wrap items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors"
                    onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">{entry.entryNumber || '—'}</span>
                        <span className="text-sm font-medium text-foreground truncate">{entry.description}</span>
                        <StatusBadge status={entry.status} />
                        {isUnbalanced && <AlertTriangle className="w-3.5 h-3.5 text-red-500" title="Asiento descuadrado" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {fmtDate(entry.date)} · <span className="capitalize">{entry.type}</span> · {entry.source}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono flex-shrink-0">
                      <span className="text-muted-foreground">D: {fmt(entry.totalDebit)}</span>
                      <span className="text-muted-foreground">H: {fmt(entry.totalCredit)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {entry.status === 'borrador' || entry.status === 'pendiente_revision' ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleConfirm(entry)}>Confirmar</Button>
                      ) : null}
                      {entry.status !== 'anulado' && entry.status !== 'confirmado' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => handleAnular(entry)}>Anular</Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && entryLines.length > 0 && (
                    <div className="bg-secondary/10 border-t border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-secondary/30">
                          <tr>
                            {['Línea','Cuenta','Nombre','Descripción','Debe','Haber','✓'].map(h => (
                              <th key={h} className={cn('px-3 py-1.5 text-left text-[10px] font-semibold text-muted-foreground uppercase', ['Debe','Haber'].includes(h) && 'text-right')}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {entryLines.map((line, i) => (
                            <tr key={i} className="hover:bg-secondary/20">
                              <td className="px-3 py-1.5 text-muted-foreground">{line.lineNumber}</td>
                              <td className="px-3 py-1.5 font-mono font-semibold text-primary">{line.accountCode}</td>
                              <td className="px-3 py-1.5 text-foreground">{line.accountName || '—'}</td>
                              <td className="px-3 py-1.5 text-muted-foreground max-w-[200px] truncate">{line.description || '—'}</td>
                              <td className="px-3 py-1.5 text-right font-mono">{Number(line.debit) > 0 ? fmt(line.debit) : ''}</td>
                              <td className="px-3 py-1.5 text-right font-mono">{Number(line.credit) > 0 ? fmt(line.credit) : ''}</td>
                              <td className="px-3 py-1.5">{line.isReconciled && <CheckCircle className="w-3 h-3 text-emerald-500" />}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNewEntry && <JournalEntryForm open accounts={accounts} onClose={() => setShowNewEntry(false)} onSaved={load} />}
    </div>
  );
}
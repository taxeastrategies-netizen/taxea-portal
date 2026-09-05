import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, BookOpen, CheckCircle, ChevronLeft, ChevronRight, Clock, Plus, RefreshCw, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import JournalEntryForm from './JournalEntryForm';

const fmt = n => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_CFG = {
  confirmado: { label: 'Confirmado', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  pendiente_revision: { label: 'Pdte. revisión', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  borrador: { label: 'Borrador', icon: Clock, color: 'text-slate-500 bg-slate-50 border-slate-200' },
  anulado: { label: 'Anulado', icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' },
};
function StatusBadge({ status }) { const cfg = STATUS_CFG[status] || STATUS_CFG.borrador; const Icon = cfg.icon; return <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', cfg.color)}><Icon className="w-2.5 h-2.5" />{cfg.label}</span>; }

export default function LibroDiario({ companyId, user }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState('');
  const [showNewEntry, setShowNewEntry] = useState(false);
  const query = useQuery({
    queryKey: ['journal-v2', companyId, year, status, type, search, page],
    queryFn: async () => {
      const response = await base44.functions.invoke('accountingOperations', { action: 'journal', companyId, year, status, type, search, page, pageSize: 100 });
      return response?.data || response;
    },
    enabled: Boolean(companyId), staleTime: 15_000,
  });
  const journal = query.data?.journal;
  const quality = query.data?.quality;
  const entries = journal?.entries || [];
  const accountsQuery = useQuery({ queryKey: ['accounting-accounts-form', companyId], queryFn: () => base44.entities.AccountingAccount.filter({ companyId, status: 'activa' }, 'code', 5000), enabled: Boolean(companyId), staleTime: 60_000 });
  const refresh = () => { query.refetch(); qc.invalidateQueries({ queryKey: ['accounting-reports-v2', companyId] }); qc.invalidateQueries({ queryKey: ['accounting-ledger-v2', companyId] }); };
  const changeFilter = setter => value => { setter(value); setPage(1); setExpanded(''); };

  const confirmEntry = async entry => {
    try { await base44.functions.invoke('accountingOperations', { action: 'confirm', companyId, entryId: entry.id }); refresh(); }
    catch (error) { alert(error?.response?.data?.error || error?.message || 'No se pudo confirmar el asiento.'); }
  };
  const annulEntry = async entry => {
    const reason = prompt('Motivo de anulación del asiento:');
    if (!reason?.trim()) return;
    try { await base44.functions.invoke('accountingOperations', { action: 'annul', companyId, entryId: entry.id, reason: reason.trim() }); refresh(); }
    catch (error) { alert(error?.response?.data?.error || error?.message || 'No se pudo anular el asiento.'); }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <div className="mr-auto"><h2 className="text-lg font-jakarta font-bold">Libro diario</h2><p className="text-xs text-muted-foreground">Facturas, cobros, pagos, bancos, importaciones y asientos manuales con trazabilidad completa.</p></div>
      <Button size="sm" variant="outline" className="h-8" onClick={refresh}><RefreshCw className="w-3.5 h-3.5" /></Button>
      <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowNewEntry(true)}><Plus className="w-3.5 h-3.5" />Nuevo asiento</Button>
    </div>
    {quality && <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{[['Asientos', quality.entries], ['Confirmados', quality.confirmedEntries], ['En revisión', quality.reviewEntries], ['Facturas con asiento sano', `${quality.healthyInvoicePostings}/${quality.activeInvoices}`]].map(([label,value]) => <div key={label} className="rounded-lg border border-border bg-card px-3 py-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="font-mono text-sm font-bold">{value}</p></div>)}</div>}
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-56"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><Input className="h-8 pl-8 text-xs" placeholder="Buscar número, concepto o documento..." value={search} onChange={e => changeFilter(setSearch)(e.target.value)} /></div>
      <Select value={year} onValueChange={changeFilter(setYear)}><SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{(journal?.years || [new Date().getFullYear()]).map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={changeFilter(setStatus)}><SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem>{Object.entries(STATUS_CFG).map(([key,value]) => <SelectItem key={key} value={key}>{value.label}</SelectItem>)}</SelectContent></Select>
      <Select value={type} onValueChange={changeFilter(setType)}><SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los tipos</SelectItem>{['manual','gasto','ingreso','pago','cobro','banco','nomina','amortizacion','apertura','cierre','regularizacion','impuesto','ajuste'].map(value => <SelectItem key={value} value={value} className="capitalize">{value}</SelectItem>)}</SelectContent></Select>
    </div>
    {quality && (quality.entriesWithoutLines > 0 || quality.unbalancedEntries > 0 || quality.unresolvedLines > 0) && <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />Control de integridad: {quality.entriesWithoutLines} asientos sin líneas, {quality.unbalancedEntries} descuadrados y {quality.unresolvedLines} líneas históricas sin cabecera. Se mantienen fuera de estados contables.</div>}
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {query.isLoading ? <div className="p-12 text-center text-sm text-muted-foreground">Cargando diario...</div> : query.isError ? <div className="p-6 text-sm text-red-700">{query.error?.response?.data?.error || query.error?.message}</div> : !entries.length ? <div className="p-12 text-center space-y-2"><BookOpen className="w-9 h-9 mx-auto text-muted-foreground/40" /><p className="font-semibold">No hay asientos con estos filtros</p></div> : <div className="divide-y divide-border">{entries.map(entry => <div key={entry.id}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/20 cursor-pointer" onClick={() => setExpanded(expanded === entry.id ? '' : entry.id)}>
          <div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-semibold text-primary">{entry.entryNumber || '—'}</span><span className="text-sm font-medium truncate">{entry.description}</span><StatusBadge status={entry.status} />{!entry.isBalanced && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}</div><p className="text-[11px] text-muted-foreground mt-0.5">{entry.date || '—'} · {entry.type || 'manual'} · {entry.source || 'manual'}{entry.documentId ? ` · doc. ${entry.documentId.slice(-8)}` : ''}</p></div>
          <div className="text-right text-xs font-mono"><p>D {fmt(entry.totalDebit)}</p><p>H {fmt(entry.totalCredit)}</p></div>
          <div className="flex gap-1" onClick={event => event.stopPropagation()}>{['borrador','pendiente_revision'].includes(entry.status) && entry.isBalanced && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => confirmEntry(entry)}>Confirmar</Button>}{entry.status !== 'anulado' && <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => annulEntry(entry)}>Anular</Button>}</div>
        </div>
        {expanded === entry.id && <div className="overflow-x-auto border-t border-border bg-muted/10"><table className="w-full text-xs"><thead className="bg-muted/30"><tr>{['Línea','Cuenta','Nombre','Descripción','Debe','Haber','Conc.'].map(header => <th key={header} className={cn('px-3 py-2 text-left text-[10px] uppercase text-muted-foreground', ['Debe','Haber'].includes(header) && 'text-right')}>{header}</th>)}</tr></thead><tbody className="divide-y divide-border/60">{entry.lines.map(line => <tr key={line.id}><td className="px-3 py-2">{line.lineNumber}</td><td className="px-3 py-2 font-mono font-semibold text-primary">{line.accountCode}</td><td className="px-3 py-2">{line.accountName || '—'}</td><td className="px-3 py-2 text-muted-foreground">{line.description || '—'}</td><td className="px-3 py-2 text-right font-mono">{line.debit ? fmt(line.debit) : ''}</td><td className="px-3 py-2 text-right font-mono">{line.credit ? fmt(line.credit) : ''}</td><td className="px-3 py-2">{line.isReconciled ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : ''}</td></tr>)}</tbody></table></div>}
      </div>)}</div>}
    </div>
    {journal && journal.total > journal.pageSize && <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{journal.total} asientos · página {journal.page}</span><div className="flex gap-1"><Button size="sm" variant="outline" className="h-8" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button><Button size="sm" variant="outline" className="h-8" disabled={page * journal.pageSize >= journal.total} onClick={() => setPage(value => value + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button></div></div>}
    {showNewEntry && <JournalEntryForm open accounts={accountsQuery.data || []} companyId={companyId} user={user} onClose={() => setShowNewEntry(false)} onSaved={refresh} />}
  </div>;
}


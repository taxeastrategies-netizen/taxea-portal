import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Download, RefreshCw, Clock, Search, ChevronDown, Loader2, History, Building2, ArrowDownToLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportarLibros } from '@/components/libros/ExportExcel.jsx';
import AccountingExportHistoryModal from '@/components/admin/AccountingExportHistoryModal';

const CURRENT_YEAR = new Date().getFullYear();

export default function LibrosExportTab({ user }) {
  const [clients, setClients] = useState([]);
  const [snapshots, setSnapshots] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState({});
  const [historyClient, setHistoryClient] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cls, snaps] = await Promise.all([
        base44.entities.Company.list('-created_date', 200).catch(err => { console.error('[LibrosExport] Company list error:', err); return []; }),
        base44.entities.AccountingExportSnapshot.list('-exportedAt', 500).catch(err => { console.error('[LibrosExport] Snapshot list error:', err); return []; }),
      ]);
      const latest = {};
      (snaps || []).forEach(s => {
        const k = `${s.clientAccountId}-${s.exportYear}`;
        if (!latest[k] || new Date(s.exportedAt) > new Date(latest[k].exportedAt)) {
          latest[k] = s;
        }
      });
      setClients(cls || []);
      setSnapshots(latest);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const fetchClientData = async (client) => {
    const res = await base44.functions.invoke('getCompanyFinancials', {
      company_id: client.id,
      anio: Number(year),
    });
    const data = res?.data || res;
    return {
      invoices: (data.invoices || []).filter(i => !i.anulada),
      expenses: (data.expenses || []).filter(e => !e.anulada),
    };
  };

  const handleExport = async (client, opts = {}) => {
    const { onlyNew = false } = opts;
    const key = client.id;
    setExporting(prev => ({ ...prev, [key]: true }));
    setOpenDropdown(null);

    try {
      const { invoices, expenses } = await fetchClientData(client);
      const snap = snapshots[`${client.id}-${year}`];

      const lastEmittedIds = new Set(snap?.emittedInvoiceIds || []);
      const lastReceivedIds = new Set(snap?.receivedInvoiceIds || []);
      const lastExpenseIds = new Set(snap?.expenseIds || []);

      const newInvoiceIds = new Set([
        ...invoices.filter(i => i.tipo === 'emitida' && !lastEmittedIds.has(i.id)).map(i => i.id),
        ...invoices.filter(i => i.tipo === 'recibida' && !lastReceivedIds.has(i.id)).map(i => i.id),
      ]);
      const newExpenseIds = new Set(expenses.filter(e => !lastExpenseIds.has(e.id)).map(e => e.id));

      const companyName = client.razon_social || client.nombre_comercial || 'Empresa';
      await exportarLibros({
        invoices: onlyNew ? invoices.filter(i => newInvoiceIds.has(i.id)) : invoices,
        expenses: onlyNew ? expenses.filter(e => newExpenseIds.has(e.id)) : expenses,
        year,
        companyName,
        newInvoiceIds,
        newExpenseIds,
        lastExportDate: snap?.exportedAt,
      });

      // Save snapshot
      const exportedAt = new Date().toISOString();
      const emittedIds = invoices.filter(i => i.tipo === 'emitida').map(i => i.id);
      const receivedIds = invoices.filter(i => i.tipo === 'recibida').map(i => i.id);
      const expIds = expenses.map(e => e.id);
      await base44.entities.AccountingExportSnapshot.create({
        clientAccountId: client.id,
        clientName: companyName,
        exportYear: Number(year),
        exportPeriod: 'all',
        exportedAt,
        exportedBy: user?.email || 'admin',
        emittedInvoiceIds: emittedIds,
        receivedInvoiceIds: receivedIds,
        expenseIds: expIds,
        totalEmitted: emittedIds.length,
        totalReceived: receivedIds.length,
        newEmittedCount: invoices.filter(i => i.tipo === 'emitida' && !lastEmittedIds.has(i.id)).length,
        newReceivedCount: invoices.filter(i => i.tipo === 'recibida' && !lastReceivedIds.has(i.id)).length,
        newExpenseCount: expenses.filter(e => !lastExpenseIds.has(e.id)).length,
        status: 'ok',
      }).catch(err => { console.error('[LibrosExport] Snapshot save error:', err); return null; });

      setSnapshots(prev => ({
        ...prev,
        [`${client.id}-${year}`]: {
          exportedAt,
          emittedInvoiceIds: emittedIds,
          receivedInvoiceIds: receivedIds,
          expenseIds: expIds,
          newEmittedCount: invoices.filter(i => i.tipo === 'emitida' && !lastEmittedIds.has(i.id)).length,
          newReceivedCount: invoices.filter(i => i.tipo === 'recibida' && !lastReceivedIds.has(i.id)).length,
          newExpenseCount: expenses.filter(e => !lastExpenseIds.has(e.id)).length,
        },
      }));
    } catch (err) {
      console.error('[LibrosExport] Error:', err);
    }
    setExporting(prev => ({ ...prev, [key]: false }));
  };

  const filtered = clients.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.razon_social?.toLowerCase().includes(q) ||
           c.nombre_comercial?.toLowerCase().includes(q) ||
           c.email?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">Libros Registro por Cliente</h2>
          <p className="text-sm text-muted-foreground">Exporta libros completos · Las facturas nuevas se resaltan en verde</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing} className="gap-1.5 h-8">
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} /> Actualizar
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
      </div>

      {/* Client list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Sin clientes</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <div className="hidden lg:grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-2 bg-secondary/30">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cliente</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-32 text-right">Última descarga</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-24 text-center">Nuevos</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-48 text-right">Acciones</p>
            </div>

            {filtered.map(client => {
              const snap = snapshots[`${client.id}-${year}`];
              const isExporting = exporting[client.id];
              const newCount = (snap?.newEmittedCount || 0) + (snap?.newReceivedCount || 0) + (snap?.newExpenseCount || 0);
              const hasExported = !!snap?.exportedAt;

              return (
                <div key={client.id} className="px-5 py-3.5 flex flex-wrap lg:grid lg:grid-cols-[1fr_auto_auto_auto] gap-3 lg:gap-4 items-center hover:bg-secondary/20 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {client.razon_social || client.nombre_comercial || 'Sin nombre'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{client.email || client.id}</p>
                  </div>

                  <div className="w-32 text-right hidden lg:block">
                    <p className="text-xs text-muted-foreground">
                      {snap?.exportedAt ? new Date(snap.exportedAt).toLocaleDateString('es-ES') : 'Nunca'}
                    </p>
                  </div>

                  <div className="w-24 text-center hidden lg:block">
                    {hasExported && newCount > 0 ? (
                      <span className="bg-green-100 text-green-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        +{newCount} nuevos
                      </span>
                    ) : hasExported ? (
                      <span className="text-[11px] text-emerald-600 font-medium">Al día</span>
                    ) : (
                      <span className="text-[11px] text-amber-600 font-medium">Sin exportar</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 lg:w-48 lg:justify-end">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setHistoryClient(client)} title="Historial">
                      <History className="w-3.5 h-3.5" />
                    </Button>

                    <div className="relative flex items-stretch">
                      <Button
                        size="sm"
                        onClick={() => handleExport(client)}
                        disabled={isExporting}
                        className={cn(
                          'h-7 px-3 text-xs rounded-r-none gap-1.5',
                          hasExported && newCount > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''
                        )}
                      >
                        {isExporting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        {hasExported && newCount > 0 ? `Libro (+${newCount})` : `Libro ${year}`}
                      </Button>
                      <Button
                        size="sm"
                        variant={hasExported && newCount > 0 ? 'default' : 'outline'}
                        className={cn('h-7 px-1.5 rounded-l-none border-l-0 text-xs',
                          hasExported && newCount > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400' : ''
                        )}
                        onClick={() => setOpenDropdown(openDropdown === client.id ? null : client.id)}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>

                      {openDropdown === client.id && (
                        <div className="absolute right-0 top-8 z-50 bg-white border border-border rounded-xl shadow-xl min-w-[200px] py-1.5">
                          {[
                            { label: `Descargar libro ${year}`, onClick: () => handleExport(client) },
                            hasExported && newCount > 0
                              ? { label: `Solo nuevas (${newCount})`, onClick: () => handleExport(client, { onlyNew: true }), highlight: true }
                              : null,
                            { label: 'Ver historial', onClick: () => { setHistoryClient(client); setOpenDropdown(null); }, icon: History },
                          ].filter(Boolean).map((item, i) => (
                            <button key={i} onClick={item.onClick}
                              className={cn(
                                'w-full text-left px-4 py-2 text-xs hover:bg-secondary/50 transition-colors flex items-center gap-2',
                                item.highlight && 'text-emerald-700 font-semibold'
                              )}>
                              {item.icon && <item.icon className="w-3 h-3" />}
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {openDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
      )}

      {/* History modal */}
      {historyClient && (
        <AccountingExportHistoryModal
          client={historyClient}
          open={!!historyClient}
          onClose={() => setHistoryClient(null)}
        />
      )}
    </div>
  );
}
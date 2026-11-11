import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Download, RefreshCw, Search, ChevronDown, Loader2, History, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportarLibros } from '@/components/libros/ExportExcel.jsx';
import AccountingExportHistoryModal from '@/components/admin/AccountingExportHistoryModal';

import { compareBookExport, readBookExportReference, readBookExportReferences, saveBookExportReference } from '@/lib/bookExportReferences.mjs';

const exportSnapshots = base44.entities.AccountingExportSnapshot;
const CURRENT_YEAR = new Date().getFullYear();

export default function LibrosExportTab({ user }) {
  const [clients, setClients] = useState([]);
  const [snapshots, setSnapshots] = useState({});
  const [liveStatus, setLiveStatus] = useState({}); // { 'clientId-year': { newCount, newEmitted, newReceived, newExpense } }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState({});
  const [historyClient, setHistoryClient] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [exportAlert, setExportAlert] = useState(null);

  const inProgress = useRef(new Set());
  const loadRequest = useRef(0);
  const userId = user?.id;

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    setLoading(true);
    try {
      const companies = await base44.entities.Company.list('-created_date', 200);
      const clientIds = companies.map(company => company.id);
      const [references, response] = await Promise.all([
        readBookExportReferences(exportSnapshots, userId, clientIds, year),
        clientIds.length ? base44.functions.invoke('getClientExportStatus', { clientIds, anio: year }).catch(() => null) : null,
      ]);
      if (request !== loadRequest.current) return;
      const data = response?.data?.clients || response?.clients || {};
      const latest = {};
      const status = {};
      for (const [companyId, reference] of Object.entries(references)) {
        const key = `${companyId}-${year}`;
        latest[key] = reference;
        const live = data[companyId];
        if (!live) continue;
        const unseen = (ids, previousIds) => {
          const previous = new Set(previousIds);
          return (ids || []).filter(id => !previous.has(id)).length;
        };
        status[key] = { newCount: unseen(live.emittedInvoiceIds, reference.emittedInvoiceIds)
          + unseen(live.receivedInvoiceIds, reference.receivedInvoiceIds) + unseen(live.expenseIds, reference.expenseIds) };
      }
      setClients(companies);
      setSnapshots(latest);
      setLiveStatus(status);
    } catch {
      if (request === loadRequest.current) setExportAlert({ type: 'error', message: 'No se pudieron consultar las referencias de tu perfil. Pulsa Actualizar para volver a intentarlo.' });
    } finally {
      if (request === loadRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [year, userId]);

  useEffect(() => {
    load();
    return () => { loadRequest.current += 1; };
  }, [load]);

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
    const { onlyNew = false, onlyInvoiceBooks = false } = opts;
    const key = client.id;
    if (!userId || inProgress.current.has(key)) return;
    inProgress.current.add(key);
    setExporting(prev => ({ ...prev, [key]: true }));
    setOpenDropdown(null);
    setExportAlert(null);

    try {
      const exportedAt = new Date().toISOString();
      const [{ invoices, expenses }, reference] = await Promise.all([
        fetchClientData(client), readBookExportReference(exportSnapshots, userId, client.id, year),
      ]);
      const { newInvoiceIds, newExpenseIds, count, fields } = compareBookExport(invoices, expenses, reference);
      if (onlyNew && (!reference || count === 0)) {
        setExportAlert({ type: 'warning', message: reference ? 'No hay registros nuevos desde tu última descarga.' : 'Descarga primero el libro completo para crear la referencia de tu perfil.' });
        return;
      }

      const companyName = client.razon_social || client.nombre_comercial || 'Empresa';
      const exportResult = await exportarLibros({
        invoices: onlyNew ? invoices.filter(i => newInvoiceIds.has(i.id)) : invoices,
        expenses: onlyNew ? expenses.filter(e => newExpenseIds.has(e.id)) : expenses,
        year,
        companyId: client.id,
        companyName,
        onlyNew,
        onlyInvoiceBooks,
        newInvoiceIds,
        newExpenseIds,
        lastExportDate: reference?.exportedAt,
      });
      const notices = [exportResult?.warning];
      try {
        const saved = await saveBookExportReference(exportSnapshots, user, client, year, exportedAt, fields);
        setSnapshots(prev => ({ ...prev, [`${client.id}-${year}`]: saved }));
        setLiveStatus(prev => ({ ...prev, [`${client.id}-${year}`]: { newCount: 0 } }));
      } catch {
        notices.push('Se generó el Excel, pero no se pudo guardar la referencia de tu perfil. La próxima descarga puede volver a resaltar estas filas.');
      }
      if (notices.some(Boolean)) setExportAlert({ type: 'warning', message: notices.filter(Boolean).join(' ') });
    } catch (err) {
      console.error('[LibrosExport] Error:', err);
      setExportAlert({type:'error',message:err?.response?.data?.error || err?.message || 'No se pudo descargar el Excel.'});
    } finally {
      inProgress.current.delete(key);
      setExporting(prev => ({ ...prev, [key]: false }));
    }
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
          <p className="text-sm text-muted-foreground">El Excel resalta en verde las facturas nuevas desde tu última descarga.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))} disabled={Object.values(exporting).some(Boolean)}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => { setExportAlert(null); setRefreshing(true); load(); }} disabled={loading || refreshing || Object.values(exporting).some(Boolean)} className="gap-1.5 h-8">
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} /> Actualizar
          </Button>
        </div>
      </div>

      {exportAlert && <p role={exportAlert.type==='error'?'alert':'status'} className={cn('rounded-lg border p-3 text-sm',exportAlert.type==='error'?'border-red-200 bg-red-50 text-red-800':'border-amber-200 bg-amber-50 text-amber-900')}>{exportAlert.message}</p>}

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
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-32 text-right">Tu última descarga</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-24 text-center">Nuevos</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-48 text-right">Acciones</p>
            </div>

            {filtered.map(client => {
              const snap = snapshots[`${client.id}-${year}`];
              const isExporting = exporting[client.id];
              const live = liveStatus[`${client.id}-${year}`];
              const newCount = live?.newCount;
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
                      <span className="bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-amber-300">
                        +{newCount} nuevos
                      </span>
                    ) : hasExported && newCount === 0 ? (
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
                        {hasExported && newCount > 0 ? `Libro (+${newCount} nuevos)` : `Libro ${year}`}
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
                            { label: 'Solo libros de facturas', onClick: () => handleExport(client, { onlyInvoiceBooks: true }) },
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
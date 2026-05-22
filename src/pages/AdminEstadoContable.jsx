import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import * as XLSX from 'xlsx';
import {
  RefreshCw, Download, ChevronDown, AlertTriangle, CheckCircle,
  Clock, XCircle, FileText, Users, BarChart2, Filter, Search,
  History, ArrowDownToLine, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import AccountingExportHistoryModal from '@/components/admin/AccountingExportHistoryModal';

const CURRENT_YEAR = new Date().getFullYear();

const PERIODS = [
  { value: 'all', label: 'Todo el año' },
  { value: '1T', label: '1T (Ene–Mar)' },
  { value: '2T', label: '2T (Abr–Jun)' },
  { value: '3T', label: '3T (Jul–Sep)' },
  { value: '4T', label: '4T (Oct–Dic)' },
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' }, { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

function getPeriodMonths(period) {
  if (period === 'all') return [1,2,3,4,5,6,7,8,9,10,11,12];
  if (period === '1T') return [1,2,3];
  if (period === '2T') return [4,5,6];
  if (period === '3T') return [7,8,9];
  if (period === '4T') return [10,11,12];
  const m = parseInt(period);
  return isNaN(m) ? [1,2,3,4,5,6,7,8,9,10,11,12] : [m];
}

function makeFingerprint(inv, type) {
  if (type === 'emitted') {
    return [inv.invoice_number || inv.number || '', inv.date || '', inv.client_tax_id || inv.nif || '', inv.base || 0, inv.tax_amount || inv.iva || 0, inv.irpf_amount || inv.irpf || 0].join('|');
  }
  return [inv.invoice_number || inv.number || '', inv.date || '', inv.supplier_tax_id || inv.nif || '', inv.base || 0, inv.tax_amount || inv.iva || 0, inv.irpf_amount || inv.irpf || 0].join('|');
}

function calcAccountingStatus(client, emitted, received, lastSnapshot, lastMovement) {
  const newEmitted = lastSnapshot
    ? emitted.filter(i => !lastSnapshot.emittedInvoiceIds?.includes(i.id) && !lastSnapshot.emittedInvoiceFingerprints?.includes(makeFingerprint(i, 'emitted')))
    : emitted;
  const newReceived = lastSnapshot
    ? received.filter(i => !lastSnapshot.receivedInvoiceIds?.includes(i.id) && !lastSnapshot.receivedInvoiceFingerprints?.includes(makeFingerprint(i, 'received')))
    : received;
  const unconfirmed = received.filter(i => i.status === 'draft' || i.status === 'pendiente' || i.status === 'pending');

  const inactiveDays = lastMovement
    ? Math.floor((Date.now() - new Date(lastMovement).getTime()) / 86400000)
    : null;

  let status = 'sin_movimientos';
  if (client.accessStatus === 'suspendida' || client.accessStatus === 'bloqueada') {
    status = 'suspendida';
  } else if (unconfirmed.length > 0) {
    status = 'gastos_sin_confirmar';
  } else if (newEmitted.length > 0 || newReceived.length > 0) {
    status = lastSnapshot ? 'pendiente_exportar' : 'nunca_exportado';
  } else if (!lastSnapshot && emitted.length === 0 && received.length === 0) {
    status = inactiveDays !== null && inactiveDays > 30 ? 'inactivo' : 'sin_movimientos';
  } else if (inactiveDays !== null && inactiveDays > 30) {
    status = 'inactivo';
  } else if (lastSnapshot) {
    status = 'al_dia';
  } else {
    status = 'nunca_exportado';
  }

  return { status, newEmitted, newReceived, unconfirmed, inactiveDays, totalEmitted: emitted.length, totalReceived: received.length };
}

const STATUS_CONFIG = {
  al_dia:             { label: 'Al día',               color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pendiente_exportar: { label: 'Pendiente exportar',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  gastos_sin_confirmar:{ label: 'Gastos sin confirmar',color: 'bg-red-100 text-red-700 border-red-200' },
  inactivo:           { label: 'Inactivo',             color: 'bg-orange-100 text-orange-700 border-orange-200' },
  sin_movimientos:    { label: 'Sin movimientos',       color: 'bg-slate-100 text-slate-500 border-slate-200' },
  nunca_exportado:    { label: 'Nunca exportado',       color: 'bg-slate-100 text-slate-400 border-slate-200' },
  suspendida:         { label: 'Cuenta suspendida',     color: 'bg-red-100 text-red-600 border-red-200' },
};

function StatusBadge({ status, newCount, inactiveDays }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.sin_movimientos;
  const label = status === 'pendiente_exportar' && newCount > 0
    ? `+${newCount} nuevos`
    : status === 'inactivo' && inactiveDays
      ? `Inactivo ${inactiveDays}d`
      : cfg.label;
  return (
    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', cfg.color)}>
      {label}
    </span>
  );
}

function ClientAvatar({ name }) {
  const initials = (name || 'C').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-primary">{initials}</span>
    </div>
  );
}

function generateExcel({ client, emitted, received, newEmittedSet, newReceivedSet, year, period, exportedAt, onlyNew }) {
  const wb = XLSX.utils.book_new();
  const GREEN_FILL = { patternType: 'solid', fgColor: { rgb: 'DCFCE7' } };
  const GREEN_FONT = { color: { rgb: '14532D' }, bold: true };
  const HEADER_FILL = { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } };
  const HEADER_FONT = { bold: true, color: { rgb: '1E293B' } };

  const makeCell = (v, isNew = false, isHeader = false) => {
    const cell = { v, t: typeof v === 'number' ? 'n' : 's' };
    if (isHeader) cell.s = { fill: HEADER_FILL, font: HEADER_FONT, border: { bottom: { style: 'thin', color: { rgb: 'CBD5E1' } } } };
    else if (isNew) cell.s = { fill: GREEN_FILL, font: GREEN_FONT };
    return cell;
  };

  const toRow = (vals, isNew, isHeader = false) => vals.map(v => makeCell(v, isNew, isHeader));

  // Sheet 1: Facturas Emitidas
  const emitRows = onlyNew ? emitted.filter(i => newEmittedSet.has(i.id)) : emitted;
  const emitData = [
    toRow(['Nº Factura','F. Expedición','NIF Cliente','Cliente','Descripción','Base','% IVA','Cuota IVA','% Retención','Cuota IRPF','Tipo','Cta. Ingreso','Cta. Cliente (430)','Estado'], false, true),
    ...emitRows.map(inv => {
      const isNew = newEmittedSet.has(inv.id);
      return toRow([
        inv.invoice_number || inv.number || '',
        inv.date ? new Date(inv.date).toLocaleDateString('es-ES') : '',
        inv.client_tax_id || inv.contact_tax_id || '',
        inv.client_name || inv.contact_name || '',
        inv.description || inv.notes || '',
        Number(inv.base || inv.subtotal || 0),
        Number(inv.tax_rate || inv.iva_rate || 21),
        Number(inv.tax_amount || inv.iva_amount || 0),
        Number(inv.irpf_rate || 0),
        Number(inv.irpf_amount || 0),
        inv.invoice_type || 'F',
        inv.income_account || '700',
        inv.client_account || '430',
        isNew ? 'Nueva' : (inv.accounting_status || 'Exportada'),
      ], isNew);
    }),
  ];
  const ws1 = sheetFromAoA(emitData);
  ws1['!cols'] = [10,12,12,20,25,10,7,10,10,10,6,10,14,10].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Facturas Emitidas');

  // Sheet 2: Facturas Recibidas
  const recvRows = onlyNew ? received.filter(i => newReceivedSet.has(i.id)) : received;
  const recvData = [
    toRow(['Nº Factura','F. Expedición','NIF Proveedor','Proveedor','Descripción','Base','% IVA','Cuota IVA','% Retención','Cuota IRPF','Categoría','Cta. Gasto (6xx)','Cta. Prov. (40x/41x)','Tipo','Estado'], false, true),
    ...recvRows.map(inv => {
      const isNew = newReceivedSet.has(inv.id);
      return toRow([
        inv.invoice_number || inv.number || '',
        inv.date ? new Date(inv.date).toLocaleDateString('es-ES') : '',
        inv.supplier_tax_id || inv.contact_tax_id || '',
        inv.supplier_name || inv.contact_name || inv.name || '',
        inv.description || inv.notes || '',
        Number(inv.base || inv.subtotal || inv.amount || 0),
        Number(inv.tax_rate || inv.iva_rate || 21),
        Number(inv.tax_amount || inv.iva_amount || 0),
        Number(inv.irpf_rate || 0),
        Number(inv.irpf_amount || 0),
        inv.category || '',
        inv.expense_account || '629',
        inv.supplier_account || '410',
        inv.invoice_type || 'F',
        isNew ? 'Nueva' : (inv.accounting_status || 'Exportada'),
      ], isNew);
    }),
  ];
  const ws2 = sheetFromAoA(recvData);
  ws2['!cols'] = [10,12,12,20,25,10,7,10,10,10,15,14,14,6,10].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws2, 'Facturas Recibidas');

  // Sheet 3: Resumen
  const periodLabel = PERIODS.find(p => p.value === period)?.label || period;
  const balanceIva = emitRows.reduce((s, i) => s + Number(i.tax_amount || i.iva_amount || 0), 0)
    - recvRows.reduce((s, i) => s + Number(i.tax_amount || i.iva_amount || 0), 0);
  const summaryData = [
    [{ v: 'Concepto', s: { fill: HEADER_FILL, font: HEADER_FONT } }, { v: 'Valor', s: { fill: HEADER_FILL, font: HEADER_FONT } }],
    [{ v: 'Cliente', t: 's' }, { v: client.legalName || '', t: 's' }],
    [{ v: 'NIF/CIF', t: 's' }, { v: client.taxId || '', t: 's' }],
    [{ v: 'Año exportado', t: 's' }, { v: year, t: 'n' }],
    [{ v: 'Período exportado', t: 's' }, { v: periodLabel, t: 's' }],
    [{ v: 'Fecha exportación', t: 's' }, { v: new Date(exportedAt).toLocaleString('es-ES'), t: 's' }],
    [{ v: 'Total Facturas Emitidas (registros)', t: 's' }, { v: emitRows.length, t: 'n' }],
    [{ v: 'Total Facturas Recibidas (registros)', t: 's' }, { v: recvRows.length, t: 'n' }],
    [{ v: 'Nuevas Emitidas desde última exportación', t: 's' }, { v: newEmittedSet.size, t: 'n' }],
    [{ v: 'Nuevas Recibidas desde última exportación', t: 's' }, { v: newReceivedSet.size, t: 'n' }],
    [{ v: 'Balance IVA/IGIC', t: 's' }, { v: Math.round(balanceIva * 100) / 100, t: 'n' }],
  ];
  const ws3 = sheetFromAoA(summaryData);
  ws3['!cols'] = [{ wch: 38 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Resumen');

  const slug = (client.legalName || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
  const periodSlug = period === 'all' ? '' : `-${period}`;
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `libro-registros-${slug}-${year}${periodSlug}-${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
  return fileName;
}

function sheetFromAoA(data) {
  if (!data || data.length === 0) return XLSX.utils.aoa_to_sheet([]);
  const ws = {};
  const range = { s: { r: 0, c: 0 }, e: { r: data.length - 1, c: 0 } };
  data.forEach((row, R) => {
    if (row.length - 1 > range.e.c) range.e.c = row.length - 1;
    row.forEach((cell, C) => {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      ws[addr] = cell;
    });
  });
  ws['!ref'] = XLSX.utils.encode_range(range);
  return ws;
}

export default function AdminEstadoContable() {
  const { isAdmin, user } = useOutletContext() || {};

  const [clients, setClients] = useState([]);
  const [clientStats, setClientStats] = useState({});
  const [snapshots, setSnapshots] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [period, setPeriod] = useState('all');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [exporting, setExporting] = useState({});
  const [historyClient, setHistoryClient] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cls, snaps] = await Promise.all([
      base44.entities.ClientAccount.list('-created_date', 100).catch(() => []),
      base44.entities.AccountingExportSnapshot.list('-exportedAt', 500).catch(() => []),
    ]);

    const latestSnapshots = {};
    (snaps || []).forEach(s => {
      const k = `${s.clientAccountId}-${s.exportYear}-${s.exportPeriod}`;
      if (!latestSnapshots[k] || new Date(s.exportedAt) > new Date(latestSnapshots[k].exportedAt)) {
        latestSnapshots[k] = s;
      }
    });

    const months = getPeriodMonths(period);
    const stats = {};

    await Promise.all((cls || []).map(async (client) => {
      const [emitted, received] = await Promise.all([
        base44.entities.Invoice.filter({ created_by: client.email, type: 'income' }).catch(() =>
          base44.entities.Invoice.filter({ company_id: client.id }).catch(() => [])),
        base44.entities.Expense.filter({ created_by: client.email }).catch(() => []),
      ]);

      const filteredEmitted = (emitted || []).filter(i => {
        if (!i.date) return true;
        const d = new Date(i.date);
        return d.getFullYear() === year && months.includes(d.getMonth() + 1);
      });
      const filteredReceived = (received || []).filter(i => {
        if (!i.date) return true;
        const d = new Date(i.date);
        return d.getFullYear() === year && months.includes(d.getMonth() + 1);
      });

      const snapshotKey = `${client.id}-${year}-${period}`;
      const lastSnap = latestSnapshots[snapshotKey];

      const allDates = [...(emitted || []), ...(received || [])].map(i => i.updated_date || i.created_date).filter(Boolean);
      const lastMovement = allDates.length > 0 ? allDates.sort().reverse()[0] : null;

      const computed = calcAccountingStatus(client, filteredEmitted, filteredReceived, lastSnap, lastMovement);
      stats[client.id] = {
        ...computed,
        lastSnapshot: lastSnap,
        lastMovement,
        allEmitted: filteredEmitted,
        allReceived: filteredReceived,
      };
    }));

    setClients(cls || []);
    setClientStats(stats);
    setSnapshots(latestSnapshots);
    setLoading(false);
    setRefreshing(false);
  }, [year, period]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, year, period]);

  const handleExport = async (client, opts = {}) => {
    const { onlyNew = false } = opts;
    const stats = clientStats[client.id];
    if (!stats) return;

    const key = client.id;
    setExporting(prev => ({ ...prev, [key]: true }));
    setOpenDropdown(null);

    const { allEmitted, allReceived, newEmitted, newReceived, lastSnapshot } = stats;

    const newEmittedSet = new Set((newEmitted || []).map(i => i.id));
    const newReceivedSet = new Set((newReceived || []).map(i => i.id));

    const exportedAt = new Date().toISOString();
    const fileName = generateExcel({
      client, emitted: allEmitted, received: allReceived,
      newEmittedSet, newReceivedSet, year, period, exportedAt, onlyNew,
    });

    // Save snapshot
    const snap = {
      clientAccountId: client.id,
      clientName: client.legalName,
      exportYear: year,
      exportPeriod: period,
      exportedAt,
      exportedBy: user?.email || 'admin',
      emittedInvoiceIds: allEmitted.map(i => i.id),
      receivedInvoiceIds: allReceived.map(i => i.id),
      emittedInvoiceFingerprints: allEmitted.map(i => makeFingerprint(i, 'emitted')),
      receivedInvoiceFingerprints: allReceived.map(i => makeFingerprint(i, 'received')),
      fileName,
      totalEmitted: allEmitted.length,
      totalReceived: allReceived.length,
      newEmittedCount: newEmittedSet.size,
      newReceivedCount: newReceivedSet.size,
      status: 'ok',
    };

    await Promise.all([
      base44.entities.AccountingExportSnapshot.create(snap).catch(() => null),
      base44.entities.AccountingExportHistory.create({ ...snap, onlyNew }).catch(() => null),
    ]);

    setExporting(prev => ({ ...prev, [key]: false }));
    // Refresh stats for this client
    load();
  };

  if (!isAdmin) return (
    <div className="p-12 text-center">
      <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
      <p className="font-medium">Acceso denegado</p>
    </div>
  );

  // KPIs
  const total = clients.length;
  const pendientes = clients.filter(c => ['pendiente_exportar', 'nunca_exportado'].includes(clientStats[c.id]?.status)).length;
  const sinConfirmar = clients.filter(c => clientStats[c.id]?.status === 'gastos_sin_confirmar').length;
  const alDia = clients.filter(c => clientStats[c.id]?.status === 'al_dia').length;
  const inactivos = clients.filter(c => clientStats[c.id]?.status === 'inactivo').length;

  const filtered = clients.filter(c => {
    const s = clientStats[c.id];
    const matchSearch = !search ||
      c.legalName?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.taxId?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || s?.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const periodLabel = PERIODS.find(p => p.value === period)?.label || period;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-jakarta font-bold text-foreground">Estado contable</h1>
          <p className="text-sm text-muted-foreground">Exportaciones y actividad contable de clientes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Exportará {year} — {periodLabel}
          </span>
          <Button size="sm" variant="outline" onClick={() => { setRefreshing(true); load(); }} disabled={refreshing} className="gap-1.5 h-8">
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          { label: 'Clientes', value: total, color: 'text-foreground', icon: Users },
          { label: 'Pendiente exportar', value: pendientes, color: pendientes > 0 ? 'text-amber-600' : 'text-foreground', icon: Clock },
          { label: 'Gastos sin confirmar', value: sinConfirmar, color: sinConfirmar > 0 ? 'text-red-600' : 'text-foreground', icon: AlertTriangle },
          { label: 'Al día', value: alDia, color: 'text-emerald-600', icon: CheckCircle },
          { label: 'Inactivos', value: inactivos, color: inactivos > 0 ? 'text-orange-500' : 'text-muted-foreground', icon: XCircle },
        ]).map(({ label, value, color, icon: KpiIcon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <KpiIcon className={cn('w-4 h-4 opacity-60', color)} />
            </div>
            <p className={cn('text-2xl font-bold font-jakarta', color)}>{loading ? '–' : value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Estado contable" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Client list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Sin clientes</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Table header */}
            <div className="hidden lg:grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-2 bg-secondary/30">
              <div className="w-9" />
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cliente</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-28 text-center">Estado</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-28 text-right">Último mov.</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-28 text-right">Última export.</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-40 text-right">Acciones</p>
            </div>

            {filtered.map(client => {
              const s = clientStats[client.id] || {};
              const newCount = (s.newEmitted?.length || 0) + (s.newReceived?.length || 0);
              const isExporting = exporting[client.id];
              const hasNew = newCount > 0;

              return (
                <div key={client.id} className="px-5 py-3.5 flex flex-wrap lg:grid lg:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 lg:gap-4 items-center hover:bg-secondary/20 transition-colors">
                  <ClientAvatar name={client.legalName} />

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{client.legalName}</p>
                    <p className="text-[11px] text-muted-foreground">{client.taxId} · {client.email}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <StatusBadge status={s.status} newCount={newCount} inactiveDays={s.inactiveDays} />
                      {s.totalEmitted > 0 && <span className="text-[10px] text-muted-foreground">{s.totalEmitted} emit.</span>}
                      {s.totalReceived > 0 && <span className="text-[10px] text-muted-foreground">{s.totalReceived} recib.</span>}
                      {s.unconfirmed?.length > 0 && (
                        <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">{s.unconfirmed.length} sin confirmar</span>
                      )}
                    </div>
                  </div>

                  <div className="w-28 text-right hidden lg:block">
                    <p className="text-xs text-muted-foreground">
                      {s.lastMovement ? new Date(s.lastMovement).toLocaleDateString('es-ES') : '—'}
                    </p>
                  </div>

                  <div className="w-28 text-right hidden lg:block">
                    <p className="text-xs text-muted-foreground">
                      {s.lastSnapshot?.exportedAt ? new Date(s.lastSnapshot.exportedAt).toLocaleDateString('es-ES') : 'Nunca'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 lg:w-40 lg:justify-end">
                    {/* History button */}
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setHistoryClient(client)} title="Historial">
                      <History className="w-3.5 h-3.5" />
                    </Button>

                    {/* Main export button + dropdown */}
                    <div className="relative flex items-stretch">
                      <Button
                        size="sm"
                        onClick={() => handleExport(client)}
                        disabled={isExporting}
                        className={cn(
                          'h-7 px-3 text-xs rounded-r-none gap-1.5',
                          hasNew ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''
                        )}
                      >
                        {isExporting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        {hasNew ? `Todo (+${newCount} nuevos)` : `Año ${year}`}
                      </Button>
                      <Button
                        size="sm"
                        variant={hasNew ? 'default' : 'outline'}
                        className={cn('h-7 px-1.5 rounded-l-none border-l-0 text-xs',
                          hasNew ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400' : ''
                        )}
                        onClick={() => setOpenDropdown(openDropdown === client.id ? null : client.id)}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>

                      {openDropdown === client.id && (
                        <div className="absolute right-0 top-8 z-50 bg-white border border-border rounded-xl shadow-xl min-w-[200px] py-1.5">
                          {[
                            { label: `Descargar año ${year}`, onClick: () => handleExport(client) },
                            { label: `Descargar 1T`, onClick: () => handleExport(client, { period: '1T' }) },
                            { label: `Descargar 2T`, onClick: () => handleExport(client, { period: '2T' }) },
                            { label: `Descargar 3T`, onClick: () => handleExport(client, { period: '3T' }) },
                            { label: `Descargar 4T`, onClick: () => handleExport(client, { period: '4T' }) },
                            hasNew ? { label: `Descargar solo nuevas (${newCount})`, onClick: () => handleExport(client, { onlyNew: true }), highlight: true } : null,
                            { label: 'Ver historial de exportaciones', onClick: () => { setHistoryClient(client); setOpenDropdown(null); }, icon: History },
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
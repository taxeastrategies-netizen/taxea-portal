import { useState, useMemo } from 'react';
import { differenceInDays, parseISO, isBefore } from 'date-fns';
import { Search, CheckCircle, AlertCircle, Clock, Zap, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);
}

function getStatus(inv) {
  const now = new Date();
  if (inv.estado_cobro === 'cobrada') return 'pagada';
  if (!inv.fecha_vencimiento) return 'pendiente';
  const dias = differenceInDays(now, parseISO(inv.fecha_vencimiento));
  if (dias > 0) return 'vencida';
  if (dias >= -7) return 'urgente';
  return 'pendiente';
}

const STATUS_CFG = {
  pagada:   { label: 'Pagada',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  pendiente:{ label: 'Pendiente',color: 'bg-slate-50 text-slate-600 border-slate-200',       icon: Clock },
  urgente:  { label: 'Urgente',  color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: Zap },
  vencida:  { label: 'Vencida',  color: 'bg-red-50 text-red-700 border-red-200',             icon: AlertCircle },
};

const PRIORITY_CFG = {
  urgente:    { label: 'Urgente',    badge: 'bg-red-50 text-red-700 border-red-200' },
  alta:       { label: 'Alta',       badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  normal:     { label: 'Normal',     badge: 'bg-slate-50 text-slate-600 border-slate-200' },
  diferible:  { label: 'Diferible',  badge: 'bg-blue-50 text-blue-600 border-blue-200' },
};

export default function APInvoiceTable({ invoices, expenses, contacts, onRefresh }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('pendiente');
  const [markingPaid, setMarkingPaid] = useState(null);

  // Calcular prioridad automática
  const getPriority = (inv) => {
    const now = new Date();
    if (!inv.fecha_vencimiento) return 'normal';
    const d = differenceInDays(parseISO(inv.fecha_vencimiento), now);
    if (d < 0) return 'urgente';
    if (d <= 5) return 'alta';
    if (d > 30) return 'diferible';
    return 'normal';
  };

  const filtered = useMemo(() => {
    let list = invoices.filter(i => i.estado_cobro !== 'cobrada');
    if (filterStatus !== 'todas') list = list.filter(i => getStatus(i) === filterStatus);
    if (search) list = list.filter(i =>
      (i.numero_factura || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.cliente_nombre || '').toLowerCase().includes(search.toLowerCase())
    );
    return list.sort((a, b) => {
      const order = { urgente: 0, vencida: 1, pendiente: 2 };
      const sa = order[getStatus(a)] ?? 3;
      const sb = order[getStatus(b)] ?? 3;
      if (sa !== sb) return sa - sb;
      return (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || '');
    });
  }, [invoices, filterStatus, search]);

  const handleMarkPaid = async (inv) => {
    setMarkingPaid(inv.id);
    await base44.entities.Invoice.update(inv.id, { estado_cobro: 'cobrada' });
    setMarkingPaid(null);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar factura o proveedor..."
            className="w-full pl-9 h-9 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-taxea-red/20" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['todas', 'vencida', 'urgente', 'pendiente'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn("px-3 h-9 rounded-lg text-xs font-medium border transition-all",
                filterStatus === s ? "bg-taxea-red text-white border-taxea-red" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
              {s === 'todas' ? 'Todas' : STATUS_CFG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Factura', 'Proveedor', 'Emisión', 'Vencimiento', 'Importe', 'Estado', 'Prioridad', 'Acciones'].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-xs text-slate-400 py-12">No hay facturas en este estado</td></tr>
              )}
              {filtered.map(inv => {
                const status = getStatus(inv);
                const cfg = STATUS_CFG[status];
                const StatusIcon = cfg.icon;
                const priority = getPriority(inv);
                const prioCfg = PRIORITY_CFG[priority];
                const now = new Date();
                const diasRetraso = inv.fecha_vencimiento ? differenceInDays(now, parseISO(inv.fecha_vencimiento)) : 0;

                return (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-semibold text-foreground">{inv.numero_factura || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-foreground">{inv.cliente_nombre || '—'}</p>
                      <p className="text-[10px] text-slate-400">{inv.cliente_nif || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{inv.fecha_emision || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium", diasRetraso > 0 ? "text-red-600" : "text-slate-500")}>
                        {inv.fecha_vencimiento || '—'}
                      </span>
                      {diasRetraso > 0 && <p className="text-[10px] text-red-500 font-medium">+{diasRetraso}d vencida</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-foreground">{fmt(inv.total_factura)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border", cfg.color)}>
                        <StatusIcon className="w-3 h-3" />{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-lg border", prioCfg.badge)}>{prioCfg.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleMarkPaid(inv)} disabled={markingPaid === inv.id}
                        title="Marcar como pagada"
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all disabled:opacity-40">
                        {markingPaid === inv.id
                          ? <div className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                          : <CheckCircle className="w-3 h-3" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alertas IA */}
      {filtered.filter(i => getStatus(i) === 'vencida').length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-xs font-semibold text-red-700">Pagos vencidos detectados</p>
            <p className="text-xs text-red-600 mt-0.5">
              Tienes {filtered.filter(i => getStatus(i) === 'vencida').length} facturas de proveedores vencidas. Los retrasos en pagos pueden afectar tu relación con proveedores clave y generar recargos.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">{filtered.length} facturas · Pendientes de pago a proveedores</p>
    </div>
  );
}
import { useState, useMemo } from 'react';
import { differenceInDays, parseISO, isBefore } from 'date-fns';
import { Search, Filter, Send, Phone, CheckCircle, AlertCircle, Clock, XCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);
}

function getStatus(inv) {
  const now = new Date();
  if (inv.estado_cobro === 'cobrada') return 'cobrada';
  if (!inv.fecha_vencimiento) return 'pendiente';
  const diasRetraso = differenceInDays(now, parseISO(inv.fecha_vencimiento));
  if (diasRetraso > 60) return 'riesgo';
  if (diasRetraso > 0) return 'vencida';
  return 'pendiente';
}

const STATUS_CFG = {
  cobrada:   { label: 'Cobrada',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  pendiente: { label: 'Pendiente', color: 'bg-blue-50 text-blue-700 border-blue-200',         icon: Clock },
  vencida:   { label: 'Vencida',   color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: AlertCircle },
  riesgo:    { label: 'Riesgo impago', color: 'bg-red-50 text-red-700 border-red-200',         icon: XCircle },
};

const RISK_CFG = {
  alta:  { label: 'Alta',  dot: 'bg-emerald-500' },
  media: { label: 'Media', dot: 'bg-amber-500' },
  baja:  { label: 'Baja',  dot: 'bg-red-500' },
};

export default function ARInvoiceTable({ invoices, contacts, onRefresh }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todas');
  const [sending, setSending] = useState(null);

  const filtered = useMemo(() => {
    let list = invoices.filter(i => i.estado_cobro !== 'cobrada');
    if (filterStatus !== 'todas') list = list.filter(i => getStatus(i) === filterStatus);
    if (search) list = list.filter(i =>
      (i.numero_factura || '').toLowerCase().includes(search.toLowerCase()) ||
      (i.cliente_nombre || '').toLowerCase().includes(search.toLowerCase())
    );
    return list.sort((a, b) => {
      const da = getStatus(a); const db = getStatus(b);
      const order = { riesgo: 0, vencida: 1, pendiente: 2, cobrada: 3 };
      return (order[da] ?? 4) - (order[db] ?? 4);
    });
  }, [invoices, filterStatus, search]);

  const handleSendReminder = async (inv) => {
    setSending(inv.id);
    await base44.integrations.Core.SendEmail({
      to: inv.cliente_email || '',
      subject: `Recordatorio de pago — Factura ${inv.numero_factura}`,
      body: `Estimado ${inv.cliente_nombre},\n\nLe recordamos que la factura ${inv.numero_factura} por importe de ${fmt(inv.total_factura)} se encuentra pendiente de pago.\n\nFecha de vencimiento: ${inv.fecha_vencimiento || 'N/D'}\n\nSi ya ha realizado el pago, por favor ignore este mensaje.\n\nGracias por su confianza.\n\nEquipo Taxea`,
    }).catch(() => {});
    setSending(null);
  };

  const handleMarkPaid = async (inv) => {
    await base44.entities.Invoice.update(inv.id, { estado_cobro: 'cobrada' });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar factura o cliente..."
            className="w-full pl-9 h-9 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-taxea-red/20" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['todas', 'riesgo', 'vencida', 'pendiente'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn("px-3 h-9 rounded-lg text-xs font-medium border transition-all",
                filterStatus === s
                  ? "bg-taxea-red text-white border-taxea-red"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
              {s === 'todas' ? 'Todas' : STATUS_CFG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Factura', 'Cliente', 'Emisión', 'Vencimiento', 'Importe', 'Estado', 'Riesgo', 'Acciones'].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-xs text-slate-400 py-12">No hay facturas pendientes</td></tr>
              )}
              {filtered.map(inv => {
                const status = getStatus(inv);
                const cfg = STATUS_CFG[status];
                const StatusIcon = cfg.icon;
                const now = new Date();
                const diasRetraso = inv.fecha_vencimiento
                  ? differenceInDays(now, parseISO(inv.fecha_vencimiento))
                  : 0;
                const riesgo = diasRetraso > 60 ? 'baja' : diasRetraso > 20 ? 'media' : 'alta';
                const riskCfg = RISK_CFG[riesgo];

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
                      {diasRetraso > 0 && (
                        <p className="text-[10px] text-red-500 font-medium">+{diasRetraso}d retraso</p>
                      )}
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
                      <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
                        <span className={cn("w-2 h-2 rounded-full", riskCfg.dot)} />
                        {riskCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleSendReminder(inv)} disabled={!!sending}
                          title="Enviar recordatorio email"
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all disabled:opacity-40">
                          {sending === inv.id ? <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
                        </button>
                        <button onClick={() => handleMarkPaid(inv)}
                          title="Marcar como cobrada"
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all">
                          <CheckCircle className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400">{filtered.length} facturas · Mostrando solo pendientes de cobro</p>
    </div>
  );
}
import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { differenceInDays, parseISO, isBefore } from 'date-fns';
import ARKpiBar from './ARKpiBar';
import ARInvoiceTable from './ARInvoiceTable';
import ARAgingChart from './ARAgingChart';
import ARForecast from './ARForecast';
import ARRiskRadar from './ARRiskRadar';
import { TrendingDown, Users, BarChart2, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFinancialData } from '@/hooks/useFinancialData';
import { getOutstandingAmount } from '@/lib/financialCore';
import InvoicePaymentReconciliationModal from '@/components/facturas/InvoicePaymentReconciliationModal';

const TABS = [
  { id: 'facturas',  label: 'Facturas pendientes', icon: Calendar },
  { id: 'aging',     label: 'Aging clientes',      icon: BarChart2 },
  { id: 'riesgo',    label: 'Riesgo clientes',     icon: AlertTriangle },
  { id: 'forecast',  label: 'Forecast cobros',     icon: TrendingDown },
  { id: 'dso',       label: 'DSO',                 icon: Clock },
];

export default function AccountsReceivable() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;

  const [tab, setTab] = useState('facturas');
  const [invoiceToReconcile, setInvoiceToReconcile] = useState(null);
  const { invoices, treasury, loading: financialLoading, refresh } = useFinancialData(companyId);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const pageLoading = loading || financialLoading;

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    base44.entities.Contact.filter({ company_id: companyId }, 'nombre', 5000, 0)
      .then(con => setContacts(con || []))
      .finally(() => setLoading(false));
  }, [companyId]);

  const emitidas = useMemo(() => invoices.filter(i => i.tipo === 'emitida'), [invoices]);

  const kpis = useMemo(() => {
    const now = new Date();
    const pendientes = emitidas.filter(i => ['pendiente', 'parcial', 'vencida'].includes(i.estado_cobro));
    const vencidas = emitidas.filter(i => {
      if (i.estado_cobro === 'cobrada') return false;
      if (!i.fecha_vencimiento) return false;
      return isBefore(parseISO(i.fecha_vencimiento), now);
    });
    const total_pendiente = pendientes.reduce((s, i) => s + getOutstandingAmount(i), 0);
    const total_vencido = vencidas.reduce((s, i) => s + getOutstandingAmount(i), 0);
    const total_riesgo = emitidas
      .filter(i => i.estado_cobro !== 'cobrada')
      .filter(i => {
        if (!i.fecha_vencimiento) return false;
        const dias = differenceInDays(now, parseISO(i.fecha_vencimiento));
        return dias > 30;
      })
      .reduce((s, i) => s + getOutstandingAmount(i), 0);

    const observedCollections = emitidas
      .filter(i => i.estado_cobro === 'cobrada' && i.fecha_emision && i.ultimo_pago_at)
      .map(i => {
        try { return Math.max(0, differenceInDays(parseISO(i.ultimo_pago_at), parseISO(i.fecha_emision))); }
        catch { return null; }
      })
      .filter(value => value !== null);
    const dso = observedCollections.length
      ? observedCollections.reduce((sum, value) => sum + value, 0) / observedCollections.length
      : 0;

    return { total_pendiente, total_vencido, total_riesgo, dso: Math.round(dso), count_pendientes: pendientes.length, count_vencidas: vencidas.length };
  }, [emitidas]);

  if (!companyId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-400">Selecciona una empresa para ver Accounts Receivable.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-jakarta font-bold text-foreground">Accounts Receivable</h2>
          <p className="text-sm text-slate-400 mt-0.5">Control de cobros, clientes y riesgo financiero</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 flex items-center gap-1.5">
            <BarChart2 className="w-3 h-3" /> {treasury.connectedAccounts} bancos · {treasury.unreconciledTransactions} movimientos por conciliar
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> {contacts.filter(c => c.tipo !== 'proveedor').length} clientes activos
          </span>
        </div>
      </div>

      {/* KPIs */}
      {!pageLoading && <ARKpiBar kpis={kpis} />}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all",
                tab === t.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {pageLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'facturas' && <ARInvoiceTable invoices={emitidas} contacts={contacts} onReconcile={setInvoiceToReconcile} />}
          {tab === 'aging' && <ARAgingChart invoices={emitidas} contacts={contacts} />}
          {tab === 'riesgo' && <ARRiskRadar invoices={emitidas} contacts={contacts} />}
          {tab === 'forecast' && <ARForecast invoices={emitidas} />}
          {tab === 'dso' && <ARDSOPanel invoices={emitidas} dso={kpis.dso} />}
        </>
      )}

      <InvoicePaymentReconciliationModal
        open={Boolean(invoiceToReconcile)}
        mode="reconcile"
        invoice={invoiceToReconcile}
        company={company}
        onOpenChange={nextOpen => { if (!nextOpen) setInvoiceToReconcile(null); }}
        onChanged={refresh}
      />
    </motion.div>
  );
}

function ARDSOPanel({ invoices, dso }) {
  const observedCount = invoices.filter(i => i.estado_cobro === 'cobrada' && i.fecha_emision && i.ultimo_pago_at).length;
  const statusColor = observedCount > 0 ? 'text-blue-600' : 'text-slate-400';
  const statusBg = observedCount > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200';

  const byMonth = useMemo(() => {
    const map = {};
    invoices.filter(i => i.estado_cobro === 'cobrada' && i.fecha_emision && i.ultimo_pago_at).forEach(i => {
      const m = i.ultimo_pago_at.substring(0, 7);
      if (!map[m]) map[m] = { total: 0, count: 0 };
      const d = differenceInDays(parseISO(i.ultimo_pago_at), parseISO(i.fecha_emision));
      map[m].total += Math.max(0, d);
      map[m].count++;
    });
    return Object.entries(map).sort().slice(-6).map(([m, v]) => ({ month: m, dso: Math.round(v.total / v.count) }));
  }, [invoices]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={cn("bg-white border rounded-2xl p-5 shadow-sm", statusBg)}>
          <p className="text-xs text-slate-400 mb-1">DSO Actual</p>
          <p className={cn("text-4xl font-jakarta font-bold", statusColor)}>{observedCount > 0 ? dso : '—'} {observedCount > 0 && <span className="text-lg font-normal text-slate-400">días</span>}</p>
          <p className="text-xs text-slate-400 mt-1">Days Sales Outstanding</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Cobros observados</p>
          <p className="text-4xl font-jakarta font-bold text-slate-700">{observedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Con fecha real de cobro</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Método</p>
          <p className="text-lg font-jakarta font-bold text-slate-700">Dato conciliado</p>
          <p className="text-xs text-slate-400 mt-1">Emisión → último cobro registrado</p>
        </div>
      </div>

      {/* Evolución */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-4">Evolución DSO — últimos 6 meses</p>
        {byMonth.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">No hay suficientes datos de cobros.</p>
        ) : (
          <div className="flex items-end gap-3 h-32">
            {byMonth.map(({ month, dso: d }) => {
              const h = Math.min(100, (d / 90) * 100);
              const col = d <= 30 ? 'bg-emerald-400' : d <= 50 ? 'bg-amber-400' : 'bg-red-400';
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-500 font-medium">{d}d</span>
                  <div className={cn("w-full rounded-t-lg", col)} style={{ height: `${h}%` }} />
                  <span className="text-[9px] text-slate-400">{month.substring(5)}/{month.substring(0, 4).slice(2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* IA insight */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">🤖</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-blue-800 mb-0.5">Calidad del dato DSO</p>
          <p className="text-xs text-blue-700">
            {observedCount > 0
              ? `Calculado con ${observedCount} cobros que tienen fecha real registrada. No se usan vencimientos ni referencias sectoriales inventadas.`
              : 'Todavía no hay cobros con fecha real suficiente para calcular el DSO.'}
          </p>
        </div>
      </div>
    </div>
  );
}
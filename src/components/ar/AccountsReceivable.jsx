import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { differenceInDays, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import ARKpiBar from './ARKpiBar';
import ARInvoiceTable from './ARInvoiceTable';
import ARAgingChart from './ARAgingChart';
import ARForecast from './ARForecast';
import ARRiskRadar from './ARRiskRadar';
import { TrendingDown, Users, BarChart2, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [invoices, setInvoices] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    Promise.all([
      base44.entities.Invoice.filter({ company_id: companyId }),
      base44.entities.Contact.filter({ company_id: companyId }),
    ]).then(([inv, con]) => {
      setInvoices(inv || []);
      setContacts(con || []);
    }).finally(() => setLoading(false));
  }, [companyId]);

  const emitidas = useMemo(() => invoices.filter(i => i.tipo === 'emitida'), [invoices]);

  const kpis = useMemo(() => {
    const now = new Date();
    const pendientes = emitidas.filter(i => i.estado_cobro === 'pendiente');
    const vencidas = emitidas.filter(i => {
      if (i.estado_cobro === 'cobrada') return false;
      if (!i.fecha_vencimiento) return false;
      return isBefore(parseISO(i.fecha_vencimiento), now);
    });
    const total_pendiente = pendientes.reduce((s, i) => s + (i.total_factura || 0), 0);
    const total_vencido = vencidas.reduce((s, i) => s + (i.total_factura || 0), 0);
    const total_riesgo = emitidas
      .filter(i => i.estado_cobro !== 'cobrada')
      .filter(i => {
        if (!i.fecha_vencimiento) return false;
        const dias = differenceInDays(now, parseISO(i.fecha_vencimiento));
        return dias > 30;
      })
      .reduce((s, i) => s + (i.total_factura || 0), 0);

    const cobradas30 = emitidas.filter(i => i.estado_cobro === 'cobrada').slice(0, 20);
    const dso = cobradas30.length > 0
      ? cobradas30.reduce((s, i) => {
          if (!i.fecha_emision || !i.fecha_vencimiento) return s + 30;
          const d = differenceInDays(parseISO(i.fecha_vencimiento), parseISO(i.fecha_emision));
          return s + Math.max(0, d);
        }, 0) / cobradas30.length
      : 45;

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
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> {contacts.filter(c => c.tipo !== 'proveedor').length} clientes activos
          </span>
        </div>
      </div>

      {/* KPIs */}
      {!loading && <ARKpiBar kpis={kpis} />}

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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'facturas' && <ARInvoiceTable invoices={emitidas} contacts={contacts} onRefresh={() => {}} />}
          {tab === 'aging' && <ARAgingChart invoices={emitidas} contacts={contacts} />}
          {tab === 'riesgo' && <ARRiskRadar invoices={emitidas} contacts={contacts} />}
          {tab === 'forecast' && <ARForecast invoices={emitidas} />}
          {tab === 'dso' && <ARDSOPanel invoices={emitidas} dso={kpis.dso} />}
        </>
      )}
    </motion.div>
  );
}

function ARDSOPanel({ invoices, dso }) {
  const benchmark = 35;
  const status = dso <= 30 ? 'good' : dso <= 50 ? 'medium' : 'bad';
  const statusColor = status === 'good' ? 'text-emerald-600' : status === 'medium' ? 'text-amber-500' : 'text-red-600';
  const statusBg = status === 'good' ? 'bg-emerald-50 border-emerald-200' : status === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  const byMonth = useMemo(() => {
    const map = {};
    invoices.filter(i => i.estado_cobro === 'cobrada' && i.fecha_emision).forEach(i => {
      const m = i.fecha_emision.substring(0, 7);
      if (!map[m]) map[m] = { total: 0, count: 0 };
      const d = i.fecha_vencimiento ? differenceInDays(parseISO(i.fecha_vencimiento), parseISO(i.fecha_emision)) : 30;
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
          <p className={cn("text-4xl font-jakarta font-bold", statusColor)}>{dso} <span className="text-lg font-normal text-slate-400">días</span></p>
          <p className="text-xs text-slate-400 mt-1">Days Sales Outstanding</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Benchmark sector</p>
          <p className="text-4xl font-jakarta font-bold text-slate-700">{benchmark} <span className="text-lg font-normal text-slate-400">días</span></p>
          <p className="text-xs text-slate-400 mt-1">Media Pymes España</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Diferencia vs benchmark</p>
          <p className={cn("text-4xl font-jakarta font-bold", dso > benchmark ? "text-red-500" : "text-emerald-600")}>
            {dso > benchmark ? '+' : ''}{dso - benchmark} <span className="text-lg font-normal text-slate-400">días</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">{dso > benchmark ? 'Por encima del sector' : 'Por debajo del sector'}</p>
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
          <p className="text-xs font-semibold text-blue-800 mb-0.5">Análisis IA — DSO</p>
          <p className="text-xs text-blue-700">
            {dso <= 30
              ? `Tu DSO de ${dso} días es excelente. Cobras antes que la media del sector. Mantén esta política de cobros.`
              : dso <= 50
              ? `Tu DSO de ${dso} días está dentro de la media. Considera activar recordatorios automáticos para reducirlo a menos de 35 días.`
              : `Tu DSO de ${dso} días es elevado. Cada día de retraso bloquea capital. Activa recordatorios automáticos y revisa los clientes con +60 días de retraso.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}
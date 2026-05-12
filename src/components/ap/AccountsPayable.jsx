import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { differenceInDays, parseISO, isBefore } from 'date-fns';
import APKpiBar from './APKpiBar';
import APInvoiceTable from './APInvoiceTable';
import APAgingChart from './APAgingChart';
import APForecast from './APForecast';
import APCalendar from './APCalendar';
import { Wallet, BarChart2, TrendingDown, CalendarDays, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'facturas',   label: 'Facturas pendientes', icon: Wallet },
  { id: 'aging',      label: 'Aging proveedores',   icon: BarChart2 },
  { id: 'forecast',   label: 'Forecast pagos',      icon: TrendingDown },
  { id: 'calendario', label: 'Calendario pagos',    icon: CalendarDays },
  { id: 'dpo',        label: 'DPO',                 icon: Clock },
];

export default function AccountsPayable() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;

  const [tab, setTab] = useState('facturas');
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    Promise.all([
      base44.entities.Invoice.filter({ company_id: companyId }),
      base44.entities.Expense.filter({ company_id: companyId }),
      base44.entities.TaxObligation.filter({ company_id: companyId }),
      base44.entities.Contact.filter({ company_id: companyId }),
    ]).then(([inv, exp, obl, con]) => {
      setInvoices(inv || []);
      setExpenses(exp || []);
      setObligations(obl || []);
      setContacts(con || []);
    }).finally(() => setLoading(false));
  }, [companyId]);

  // Facturas recibidas pendientes de pago
  const recibidas = useMemo(() => invoices.filter(i => i.tipo === 'recibida'), [invoices]);

  const kpis = useMemo(() => {
    const now = new Date();
    const pendientes = recibidas.filter(i => i.estado_cobro === 'pendiente');
    const vencidas = recibidas.filter(i => {
      if (i.estado_cobro === 'cobrada') return false;
      if (!i.fecha_vencimiento) return false;
      return isBefore(parseISO(i.fecha_vencimiento), now);
    });
    const total_pendiente = pendientes.reduce((s, i) => s + (i.total_factura || 0), 0);
    const total_vencido = vencidas.reduce((s, i) => s + (i.total_factura || 0), 0);
    const proximos7 = recibidas
      .filter(i => i.estado_cobro === 'pendiente' && i.fecha_vencimiento)
      .filter(i => {
        const d = differenceInDays(parseISO(i.fecha_vencimiento), now);
        return d >= 0 && d <= 7;
      })
      .reduce((s, i) => s + (i.total_factura || 0), 0);

    // DPO
    const pagadas = recibidas.filter(i => i.estado_cobro === 'cobrada').slice(0, 20);
    const dpo = pagadas.length > 0
      ? pagadas.reduce((s, i) => {
          if (!i.fecha_emision || !i.fecha_vencimiento) return s + 30;
          return s + Math.max(0, differenceInDays(parseISO(i.fecha_vencimiento), parseISO(i.fecha_emision)));
        }, 0) / pagadas.length
      : 45;

    return { total_pendiente, total_vencido, proximos7, dpo: Math.round(dpo), count_pendientes: pendientes.length, count_vencidas: vencidas.length };
  }, [recibidas]);

  if (!companyId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-400">Selecciona una empresa para ver Accounts Payable.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-jakarta font-bold text-foreground">Accounts Payable</h2>
          <p className="text-sm text-slate-400 mt-0.5">Control de pagos, proveedores y liquidez</p>
        </div>
        <div className="flex items-center gap-2">
          {kpis.total_vencido > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> {kpis.count_vencidas} vencidas
            </span>
          )}
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700 flex items-center gap-1.5">
            <Wallet className="w-3 h-3" /> {contacts.filter(c => c.tipo !== 'cliente').length} proveedores
          </span>
        </div>
      </div>

      {/* KPIs */}
      {!loading && <APKpiBar kpis={kpis} />}

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
          {tab === 'facturas' && <APInvoiceTable invoices={recibidas} expenses={expenses} contacts={contacts} onRefresh={() => {}} />}
          {tab === 'aging' && <APAgingChart invoices={recibidas} />}
          {tab === 'forecast' && <APForecast invoices={recibidas} expenses={expenses} obligations={obligations} />}
          {tab === 'calendario' && <APCalendar invoices={recibidas} expenses={expenses} obligations={obligations} />}
          {tab === 'dpo' && <APDPOPanel invoices={recibidas} dpo={kpis.dpo} />}
        </>
      )}
    </motion.div>
  );
}

function APDPOPanel({ invoices, dpo }) {
  const benchmark = 30;
  const statusColor = dpo >= 45 ? 'text-emerald-600' : dpo >= 25 ? 'text-amber-600' : 'text-red-600';

  const byMonth = useMemo(() => {
    const map = {};
    invoices.filter(i => i.estado_cobro === 'cobrada' && i.fecha_emision).forEach(i => {
      const m = i.fecha_emision.substring(0, 7);
      if (!map[m]) map[m] = { total: 0, count: 0 };
      const d = i.fecha_vencimiento ? differenceInDays(parseISO(i.fecha_vencimiento), parseISO(i.fecha_emision)) : 30;
      map[m].total += Math.max(0, d);
      map[m].count++;
    });
    return Object.entries(map).sort().slice(-6).map(([m, v]) => ({ month: m, dpo: Math.round(v.total / v.count) }));
  }, [invoices]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">DPO Actual</p>
          <p className={cn("text-4xl font-jakarta font-bold", statusColor)}>{dpo} <span className="text-lg font-normal text-slate-400">días</span></p>
          <p className="text-xs text-slate-400 mt-1">Days Payable Outstanding</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Benchmark sector</p>
          <p className="text-4xl font-jakarta font-bold text-slate-700">{benchmark} <span className="text-lg font-normal text-slate-400">días</span></p>
          <p className="text-xs text-slate-400 mt-1">Media Pymes España</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Diferencia vs benchmark</p>
          <p className={cn("text-4xl font-jakarta font-bold", dpo >= benchmark ? "text-emerald-600" : "text-amber-600")}>
            {dpo >= benchmark ? '+' : ''}{dpo - benchmark} <span className="text-lg font-normal text-slate-400">días</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">{dpo >= benchmark ? 'Mayor margen que el sector' : 'Paga antes que el sector'}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-4">Evolución DPO — últimos 6 meses</p>
        {byMonth.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">No hay suficientes datos de pagos.</p>
        ) : (
          <div className="flex items-end gap-3 h-32">
            {byMonth.map(({ month, dpo: d }) => {
              const h = Math.min(100, (d / 90) * 100);
              const col = d >= 45 ? 'bg-emerald-400' : d >= 25 ? 'bg-amber-400' : 'bg-red-400';
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

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <span className="text-lg flex-shrink-0">🤖</span>
        <div>
          <p className="text-xs font-semibold text-blue-800 mb-0.5">Análisis IA — DPO</p>
          <p className="text-xs text-blue-700">
            {dpo >= 45
              ? `Tu DPO de ${dpo} días es favorable. Estás usando bien el crédito de proveedores para gestionar tu liquidez.`
              : dpo >= 25
              ? `Tu DPO de ${dpo} días está dentro de la media. Puedes negociar plazos más largos con tus principales proveedores para mejorar tu cashflow.`
              : `Tu DPO de ${dpo} días es bajo. Estás pagando antes de lo necesario. Renegocia plazos de pago para liberar capital de trabajo.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}
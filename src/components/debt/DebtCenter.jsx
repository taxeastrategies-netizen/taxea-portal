import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { differenceInDays, parseISO } from 'date-fns';
import { Layers, Plus, RefreshCw, TrendingDown, AlertTriangle, BarChart2, Calendar, DollarSign, Sliders, Activity, Bell, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import DebtKpiBar from './DebtKpiBar';
import DebtList from './DebtList';
import DebtCalendar from './DebtCalendar';
import DebtCostPanel from './DebtCostPanel';
import DebtRatios from './DebtRatios';
import DebtSimulator from './DebtSimulator';
import DebtAlerts from './DebtAlerts';
import DebtFormModal from './DebtFormModal';
import DebtOCR from './DebtOCR';

const TABS = [
  { id: 'overview',    label: 'Resumen',          icon: Layers },
  { id: 'instruments', label: 'Instrumentos',     icon: BarChart2 },
  { id: 'calendar',    label: 'Calendario deuda', icon: Calendar },
  { id: 'cost',        label: 'Coste financiero', icon: DollarSign },
  { id: 'ratios',      label: 'Ratios',           icon: Activity },
  { id: 'simulator',  label: 'Simulador',         icon: Sliders },
  { id: 'alerts',     label: 'Alertas IA',        icon: Bell },
  { id: 'ocr',        label: 'OCR Financiero',    icon: Zap },
];

export default function DebtCenter() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;

  const [tab, setTab] = useState('overview');
  const [debts, setDebts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);

  const loadData = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const [dbs, inv, exp] = await Promise.all([
      base44.entities.DebtInstrument.filter({ company_id: companyId }),
      base44.entities.Invoice.filter({ company_id: companyId }),
      base44.entities.Expense.filter({ company_id: companyId }),
    ]);
    setDebts(dbs || []);
    setInvoices(inv || []);
    setExpenses(exp || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [companyId]);

  const kpis = useMemo(() => {
    const active = debts.filter(d => d.estado === 'activo');
    const deudaTotal = active.reduce((s, d) => s + (d.capital_pendiente || d.importe_inicial || 0), 0);
    const cuotaMensual = active
      .filter(d => d.periodicidad === 'mensual')
      .reduce((s, d) => s + (d.cuota || 0), 0);
    const interesesAnuales = active.reduce((s, d) => {
      const cap = d.capital_pendiente || d.importe_inicial || 0;
      const tin = (d.tin || 0) / 100;
      return s + cap * tin;
    }, 0);
    const lineasCredito = active.filter(d => d.tipo === 'linea_credito' || d.tipo === 'poliza');
    const limiteTotal = lineasCredito.reduce((s, d) => s + (d.limite_credito || 0), 0);
    const dispuestoTotal = lineasCredito.reduce((s, d) => s + (d.dispuesto || 0), 0);
    const ingresos = invoices.filter(i => i.tipo === 'emitida').reduce((s, i) => s + (i.total_factura || 0), 0);
    const gastos = expenses.filter(e => e.tipo === 'gasto').reduce((s, e) => s + (e.total || 0), 0);
    const ebitda = Math.max(0, ingresos - gastos * 0.85);

    const now = new Date();
    const vencimientosCercanos = active.filter(d => {
      if (!d.fecha_vencimiento) return false;
      const dias = differenceInDays(parseISO(d.fecha_vencimiento), now);
      return dias >= 0 && dias <= 90;
    }).length;

    return { deudaTotal, cuotaMensual, interesesAnuales, limiteTotal, dispuestoTotal, ebitda, vencimientosCercanos, count: active.length };
  }, [debts, invoices, expenses]);

  if (!companyId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-400">Selecciona una empresa para acceder a Debt & Financing.</p>
      </div>
    );
  }

  const alertCount = debts.filter(d => {
    if (d.estado !== 'activo') return false;
    if (!d.fecha_vencimiento) return false;
    const dias = differenceInDays(parseISO(d.fecha_vencimiento), new Date());
    return dias >= 0 && dias <= 60;
  }).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Debt & Financing</h2>
            <p className="text-sm text-slate-400 mt-0.5">Control total de deuda, financiación y pasivos empresariales</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
          <button onClick={() => { setEditingDebt(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Añadir deuda
          </button>
        </div>
      </div>

      {/* KPIs */}
      {!loading && <DebtKpiBar kpis={kpis} />}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          const isBadge = t.id === 'alerts' && alertCount > 0;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all",
                tab === t.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              <Icon className="w-3.5 h-3.5" />{t.label}
              {isBadge && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-taxea-red text-white text-[9px] flex items-center justify-center font-bold">{alertCount > 9 ? '9+' : alertCount}</span>}
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
          {tab === 'overview' && <DebtOverview debts={debts} kpis={kpis} onAddDebt={() => setShowForm(true)} onEdit={d => { setEditingDebt(d); setShowForm(true); }} />}
          {tab === 'instruments' && <DebtList debts={debts} onEdit={d => { setEditingDebt(d); setShowForm(true); }} onRefresh={loadData} />}
          {tab === 'calendar' && <DebtCalendar debts={debts} />}
          {tab === 'cost' && <DebtCostPanel debts={debts} kpis={kpis} />}
          {tab === 'ratios' && <DebtRatios debts={debts} kpis={kpis} invoices={invoices} expenses={expenses} />}
          {tab === 'simulator' && <DebtSimulator debts={debts} kpis={kpis} />}
          {tab === 'alerts' && <DebtAlerts debts={debts} kpis={kpis} />}
          {tab === 'ocr' && <DebtOCR companyId={companyId} onImported={loadData} />}
        </>
      )}

      {showForm && (
        <DebtFormModal
          debt={editingDebt}
          companyId={companyId}
          onClose={() => { setShowForm(false); setEditingDebt(null); }}
          onSaved={() => { setShowForm(false); setEditingDebt(null); loadData(); }}
        />
      )}
    </motion.div>
  );
}

// ── Overview inline ──────────────────────────────────────────────────────────
function DebtOverview({ debts, kpis, onAddDebt, onEdit }) {
  const active = debts.filter(d => d.estado === 'activo');

  const byType = useMemo(() => {
    const map = {};
    active.forEach(d => {
      if (!map[d.tipo]) map[d.tipo] = 0;
      map[d.tipo] += d.capital_pendiente || d.importe_inicial || 0;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [active]);

  const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

  const TYPE_LABELS = {
    prestamo_bancario: 'Préstamo bancario', prestamo_socio: 'Préstamo socio', prestamo_participativo: 'Part.',
    ico: 'ICO', leasing: 'Leasing', renting: 'Renting', linea_credito: 'Línea crédito',
    poliza: 'Póliza', deuda_convertible: 'Conv.', financiacion_puente: 'Puente', otro: 'Otro'
  };
  const TYPE_COLORS = {
    prestamo_bancario: 'bg-blue-500', ico: 'bg-taxea-red', leasing: 'bg-violet-500',
    renting: 'bg-slate-400', linea_credito: 'bg-emerald-500', poliza: 'bg-amber-500',
    prestamo_socio: 'bg-indigo-400', otro: 'bg-slate-300'
  };

  if (active.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
          <TrendingDown className="w-8 h-8 text-blue-300" />
        </div>
        <p className="text-base font-semibold text-foreground mb-1">Sin instrumentos de deuda</p>
        <p className="text-sm text-slate-400 max-w-xs mb-6">Añade préstamos, leasings, ICOs o líneas de crédito para controlar toda tu deuda.</p>
        <button onClick={onAddDebt}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Añadir primer instrumento
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Estructura deuda */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-4">Estructura de financiación</p>
          <div className="space-y-3">
            {byType.map(([tipo, total]) => {
              const pct = kpis.deudaTotal > 0 ? (total / kpis.deudaTotal) * 100 : 0;
              const col = TYPE_COLORS[tipo] || 'bg-slate-400';
              return (
                <div key={tipo} className="flex items-center gap-3">
                  <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", col)} />
                  <span className="text-xs text-slate-500 w-36 flex-shrink-0">{TYPE_LABELS[tipo] || tipo}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", col)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-24 text-right">{fmt(total)}</span>
                  <span className="text-[10px] text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumen ejecutivo */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-xs text-blue-200 mb-1 uppercase tracking-wider font-semibold">Deuda total activa</p>
          <p className="text-4xl font-jakarta font-bold mb-4">{fmt(kpis.deudaTotal)}</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-blue-200 text-xs">Cuota mensual</span><span className="font-semibold text-xs">{fmt(kpis.cuotaMensual)}</span></div>
            <div className="flex justify-between"><span className="text-blue-200 text-xs">Intereses anuales</span><span className="font-semibold text-xs">{fmt(kpis.interesesAnuales)}</span></div>
            <div className="flex justify-between"><span className="text-blue-200 text-xs">Instrumentos activos</span><span className="font-semibold text-xs">{kpis.count}</span></div>
          </div>
        </div>
      </div>

      {/* Lista resumida */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Instrumentos activos</p>
          <button onClick={onAddDebt} className="text-xs text-taxea-red hover:underline font-medium flex items-center gap-1">
            <Plus className="w-3 h-3" /> Añadir
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {active.slice(0, 8).map(d => {
            const cap = d.capital_pendiente || d.importe_inicial || 0;
            const pct = d.importe_inicial > 0 ? ((d.capital_amortizado || 0) / d.importe_inicial) * 100 : 0;
            const col = TYPE_COLORS[d.tipo] || 'bg-slate-300';
            const now = new Date();
            const diasVenc = d.fecha_vencimiento ? differenceInDays(parseISO(d.fecha_vencimiento), now) : null;
            return (
              <div key={d.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => onEdit(d)}>
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", col)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-foreground truncate">{d.nombre}</p>
                    <span className="text-[10px] text-slate-400">{d.entidad || ''}</span>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                    <div className={cn("h-full rounded-full", col)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-foreground">{fmt(cap)}</p>
                  {diasVenc !== null && (
                    <p className={cn("text-[10px] font-medium", diasVenc < 30 ? "text-red-500" : diasVenc < 90 ? "text-amber-500" : "text-slate-400")}>
                      {diasVenc < 0 ? `Vencido ${Math.abs(diasVenc)}d` : `${diasVenc}d`}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
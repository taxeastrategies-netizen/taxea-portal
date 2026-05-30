import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  FileText, Calendar, AlertTriangle, CheckCircle2, Clock,
  Zap, ScanLine, ScanText, BookOpen, Plus, ChevronRight,
  Activity, BarChart3, Brain, Sparkles, CircleDollarSign,
  Receipt, Target, AlertCircle, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from 'recharts';
import NoCompanyState from '@/components/ui/NoCompanyState';
import GastosPorCategoria from './GastosPorCategoria';

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function TaxDashboard({ onNavigate }) {
  const { company, isAdmin, loadingCompany } = useOutletContext() || {};
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiAlerts, setAiAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const currentMonthLabel = MONTHS_ES[currentMonth];

  useEffect(() => {
    if (company?.id) loadData();
    else if (!loadingCompany) setLoading(false);
  }, [company?.id, loadingCompany]);

  const loadData = async () => {
    setLoading(true);
    const [invData, expData, oblData, qData] = await Promise.all([
      base44.entities.Invoice.filter({ company_id: company.id }),
      base44.entities.Expense.filter({ company_id: company.id }),
      base44.entities.TaxObligation.filter({ company_id: company.id }),
      base44.entities.Quote.filter({ company_id: company.id }).catch(() => []),
    ]);
    setInvoices(invData || []);
    setExpenses(expData || []);
    setObligations(oblData || []);
    setQuotes(qData || []);
    setLoading(false);
  };

  const generateAiAlerts = async () => {
    if (loadingAlerts || aiAlerts.length > 0) return;
    setLoadingAlerts(true);
    const now = new Date();
    const oblPendientes = obligations.filter(o => !['finalizado','presentado','pagado','domiciliado'].includes(o.estado));
    const oblVencidas = oblPendientes.filter(o => o.fecha_limite && new Date(o.fecha_limite) < now);
    const factVencidas = invoices.filter(i => i.estado_cobro === 'vencida' || (i.estado_cobro === 'pendiente' && i.fecha_vencimiento && new Date(i.fecha_vencimiento) < now));
    const gastosSinCat = expenses.filter(e => !e.categoria);
    const factSinContabilizar = invoices.filter(i => i.estado_contable === 'pendiente');

    const staticAlerts = [];
    if (oblVencidas.length > 0) staticAlerts.push({ tipo: 'rojo', texto: `${oblVencidas.length} obligación(es) fiscal(es) vencida(s) sin presentar.`, accion: 'obligaciones' });
    if (factVencidas.length > 0) staticAlerts.push({ tipo: 'rojo', texto: `${factVencidas.length} factura(s) vencidas pendientes de cobro.`, accion: 'facturas' });
    if (gastosSinCat.length > 0) staticAlerts.push({ tipo: 'amarillo', texto: `${gastosSinCat.length} gasto(s) sin categoría contable asignada.`, accion: 'ingresos-gastos' });
    if (factSinContabilizar.length > 5) staticAlerts.push({ tipo: 'amarillo', texto: `${factSinContabilizar.length} facturas pendientes de contabilizar.`, accion: 'facturas' });

    // Check for next obligation
    const proxObl = oblPendientes
      .filter(o => o.fecha_limite && new Date(o.fecha_limite) > now)
      .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))[0];
    if (proxObl) {
      const dias = Math.ceil((new Date(proxObl.fecha_limite) - now) / 86400000);
      if (dias <= 15) staticAlerts.push({ tipo: 'amarillo', texto: `Próximo vencimiento fiscal en ${dias} días: ${proxObl.modelo?.replace('modelo_', 'Modelo ').replace(/_/g, ' ')}.`, accion: 'obligaciones' });
    }

    if (staticAlerts.length === 0) staticAlerts.push({ tipo: 'verde', texto: 'Todo en orden. No se detectan alertas fiscales urgentes.', accion: null });

    setAiAlerts(staticAlerts);
    setLoadingAlerts(false);
  };

  // KPIs
  const kpis = useMemo(() => {
    const thisMonthInvoices = invoices.filter(i => {
      const d = new Date(i.fecha_emision || i.created_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth && i.tipo === 'emitida';
    });
    const thisMonthExpenses = expenses.filter(e => {
      const d = new Date(e.fecha || e.created_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const ingresosMes = thisMonthInvoices.reduce((s, i) => s + (i.base_imponible || 0), 0);
    const gastosMes = thisMonthExpenses.filter(e => e.tipo === 'gasto').reduce((s, e) => s + (e.base_imponible || e.total || 0), 0);
    const beneficioMes = ingresosMes - gastosMes;
    const ivaMes = thisMonthInvoices.reduce((s, i) => s + (i.cuota_iva || 0), 0);
    const irpfMes = thisMonthInvoices.reduce((s, i) => s + (i.retencion_irpf ? (i.base_imponible * i.retencion_irpf / 100) : 0), 0);
    const factPendientes = invoices.filter(i => i.estado_cobro === 'pendiente' && i.tipo === 'emitida');
    const factVencidas = invoices.filter(i => i.estado_cobro === 'vencida' && i.tipo === 'emitida');
    const oblPendientes = obligations.filter(o => !['finalizado','presentado','pagado','domiciliado'].includes(o.estado));
    const proxObl = oblPendientes.filter(o => o.fecha_limite && new Date(o.fecha_limite) > new Date())
      .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))[0];

    const thisMonthRecibidas = invoices.filter(i => {
      const d = new Date(i.fecha_emision || i.created_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth && i.tipo === 'recibida';
    });
    const ivaRepercutido = thisMonthInvoices.reduce((s, i) => s + (i.cuota_iva || 0), 0);
    const ivaSoportado = thisMonthRecibidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
    const irpfIngresos = thisMonthInvoices.reduce((s, i) => s + (i.retencion_irpf ? (i.base_imponible || 0) * (i.retencion_irpf / 100) : 0), 0);
    const irpfGastos = thisMonthRecibidas.reduce((s, i) => s + (i.retencion_irpf ? (i.base_imponible || 0) * (i.retencion_irpf / 100) : 0), 0);
    const quotesPendientes = quotes.filter(q => ['pendiente','enviado','borrador'].includes(q.estado) || !q.estado);
    return {
      ingresosMes, gastosMes, beneficioMes, ivaMes: ivaRepercutido, irpfMes,
      ivaRepercutido, ivaSoportado, irpfIngresos, irpfGastos,
      factPendientes: factPendientes.length,
      factPendientesImporte: factPendientes.reduce((s, i) => s + (i.total_factura || 0), 0),
      factVencidas: factVencidas.length,
      oblPendientes: oblPendientes.length,
      proxObl,
      quotesPendientes: quotesPendientes.length,
      quotesPendientesImporte: quotesPendientes.reduce((s, q) => s + (q.total || q.importe_total || 0), 0),
    };
  }, [invoices, expenses, obligations, quotes, currentYear, currentMonth]);

  // Cashflow chart data (last 6 months)
  const cashflowData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(currentYear, currentMonth - 5 + i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      const ing = invoices.filter(inv => {
        const fd = new Date(inv.fecha_emision || inv.created_date);
        return fd.getMonth() === m && fd.getFullYear() === y && inv.tipo === 'emitida';
      }).reduce((s, inv) => s + (inv.base_imponible || 0), 0);
      const gas = expenses.filter(e => {
        const fd = new Date(e.fecha || e.created_date);
        return fd.getMonth() === m && fd.getFullYear() === y && e.tipo === 'gasto';
      }).reduce((s, e) => s + (e.base_imponible || e.total || 0), 0);
      return { mes: MONTHS_ES[m], ingresos: Math.round(ing), gastos: Math.round(gas), beneficio: Math.round(ing - gas) };
    });
  }, [invoices, expenses, currentYear, currentMonth]);

  // Recent activity
  const recentActivity = useMemo(() => {
    const items = [
      ...invoices.slice(0, 20).map(i => ({ tipo: 'factura', label: `Factura ${i.numero_factura || ''}`, sub: `${i.cliente_nombre || '—'} · ${i.total_factura?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, date: new Date(i.created_date), color: 'text-blue-500', bg: 'bg-blue-50', icon: FileText })),
      ...expenses.slice(0, 10).map(e => ({ tipo: 'gasto', label: e.concepto || 'Gasto', sub: `${e.proveedor_cliente || '—'} · ${e.total?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, date: new Date(e.created_date), color: 'text-red-500', bg: 'bg-red-50', icon: TrendingDown })),
      ...obligations.slice(0, 5).map(o => ({ tipo: 'obligacion', label: o.modelo?.replace('modelo_', 'Modelo ').replace(/_/g, ' '), sub: `${o.periodo || ''} · ${o.estado}`, date: new Date(o.created_date), color: 'text-amber-500', bg: 'bg-amber-50', icon: Calendar })),
    ];
    return items.sort((a, b) => b.date - a.date).slice(0, 8);
  }, [invoices, expenses, obligations]);

  if (loadingCompany || loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!company) return <NoCompanyState pageName="Tax & Accounting" />;

  const fmt = (n) => n?.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-jakarta font-bold text-foreground">Tax &amp; Accounting</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{company.razon_social} · {currentMonthLabel} {currentYear}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onNavigate('facturas')} className="hidden sm:flex gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nueva factura
          </Button>
          <Button size="sm" className="bg-taxea-red hover:bg-taxea-red-dark gap-1.5" onClick={() => onNavigate('obligaciones')}>
            <Calendar className="w-3.5 h-3.5" /> Obligaciones
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div onClick={() => onNavigate('ingresos-gastos')} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-taxea-red/30 hover:shadow-card-hover transition-all">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-foreground">{fmt(kpis.ingresosMes)} &#8364;</p>
          <p className="text-xs text-muted-foreground mt-0.5">Ingresos mes</p>
          <div className="mt-2 space-y-0.5 border-t border-border/50 pt-2">
            <p className="text-xs text-muted-foreground">IVA repercutido: <span className="font-medium text-foreground">{fmt(kpis.ivaRepercutido)} &#8364;</span></p>
            <p className="text-xs text-muted-foreground">IRPF de ingresos: <span className="font-medium text-foreground">{fmt(kpis.irpfIngresos)} &#8364;</span></p>
          </div>
        </div>
        <div onClick={() => onNavigate('ingresos-gastos')} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-taxea-red/30 hover:shadow-card-hover transition-all">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-400/10 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-lg font-bold text-foreground">{fmt(kpis.gastosMes)} &#8364;</p>
          <p className="text-xs text-muted-foreground mt-0.5">Gastos mes</p>
          <div className="mt-2 space-y-0.5 border-t border-border/50 pt-2">
            <p className="text-xs text-muted-foreground">IVA soportado: <span className="font-medium text-foreground">{fmt(kpis.ivaSoportado)} &#8364;</span></p>
            <p className="text-xs text-muted-foreground">IRPF de gastos: <span className="font-medium text-foreground">{fmt(kpis.irpfGastos)} &#8364;</span></p>
          </div>
        </div>
        <KPICard
          label="Beneficio estimado"
          value={`${fmt(kpis.beneficioMes)} €`}
          icon={BarChart3}
          color={kpis.beneficioMes >= 0 ? "text-emerald-500" : "text-red-500"}
          bg={kpis.beneficioMes >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
          onClick={() => onNavigate('ingresos-gastos')}
        />
        <KPICard
          label="IVA estimado"
          value={`${fmt(kpis.ivaMes)} €`}
          icon={CircleDollarSign}
          color="text-blue-400"
          bg="bg-blue-400/10"
          onClick={() => onNavigate('obligaciones')}
        />
        <KPICard
          label="Obligaciones pdte."
          value={kpis.oblPendientes}
          icon={Calendar}
          color={kpis.oblPendientes > 0 ? "text-amber-400" : "text-emerald-500"}
          bg={kpis.oblPendientes > 0 ? "bg-amber-400/10" : "bg-emerald-500/10"}
          alert={kpis.oblPendientes > 0}
          onClick={() => onNavigate('obligaciones')}
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div
          onClick={() => onNavigate('facturas')}
          className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-taxea-red/30 hover:shadow-card-hover transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-500" />
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-taxea-red transition-colors" />
          </div>
          <p className="text-xl font-bold text-foreground">{fmt(kpis.factPendientesImporte)} €</p>
          <p className="text-xs text-muted-foreground mt-0.5">{kpis.factPendientes} facturas pendientes cobro</p>
          {kpis.factVencidas > 0 && (
            <p className="text-xs text-red-500 mt-1 font-medium">{kpis.factVencidas} vencidas</p>
          )}
        </div>

        <div
          onClick={() => onNavigate('presupuestos')}
          className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-taxea-red/30 hover:shadow-card-hover transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <Receipt className="w-4 h-4 text-amber-500" />
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-taxea-red transition-colors" />
          </div>
          <p className="text-xl font-bold text-foreground">{fmt(kpis.quotesPendientesImporte)} &#8364;</p>
          <p className="text-xs text-muted-foreground mt-0.5">{kpis.quotesPendientes} presupuesto{kpis.quotesPendientes !== 1 ? 's' : ''} pendiente{kpis.quotesPendientes !== 1 ? 's' : ''}</p>
          <p className="text-xs text-amber-500 mt-1 font-medium">Por aceptar</p>
        </div>

        <div className="bg-gradient-to-br from-taxea-red/5 to-taxea-red/10 border border-taxea-red/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-taxea-red/20 rounded-md flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-taxea-red" />
            </div>
            <p className="text-xs font-semibold text-taxea-red uppercase tracking-wide">IA Fiscal</p>
          </div>
          <p className="text-xs text-foreground/70 leading-relaxed">Centro de gestión fiscal automatizado. Tu asesor supervisa cada detalle.</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cashflow Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-jakarta font-semibold text-foreground">Cashflow — Últimos 6 meses</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Ingresos vs Gastos vs Beneficio</p>
            </div>
            <button onClick={() => onNavigate('libros')} className="text-xs text-taxea-red hover:underline flex items-center gap-1">
              Libros <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cashflowData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                formatter={(v, n) => [`${v.toLocaleString('es-ES')} €`, n === 'ingresos' ? 'Ingresos' : n === 'gastos' ? 'Gastos' : 'Beneficio']}
              />
              <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} fill="url(#ingGrad)" />
              <Area type="monotone" dataKey="gastos" stroke="#f87171" strokeWidth={2} fill="url(#gasGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Gastos por categoría */}
        <GastosPorCategoria invoices={invoices} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* AI Alerts */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-taxea-red/10 rounded-md flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-taxea-red" />
              </div>
              <h3 className="font-jakarta font-semibold text-foreground text-sm">Alertas IA</h3>
            </div>
            {aiAlerts.length === 0 && (
              <button
                onClick={generateAiAlerts}
                disabled={loadingAlerts}
                className="text-xs text-taxea-red hover:underline flex items-center gap-1"
              >
                {loadingAlerts ? 'Analizando...' : 'Analizar'}
                <Zap className="w-3 h-3" />
              </button>
            )}
          </div>
          {aiAlerts.length === 0 && !loadingAlerts && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Brain className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Pulsa "Analizar" para detectar alertas fiscales.</p>
            </div>
          )}
          {loadingAlerts && (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className="space-y-2">
            {aiAlerts.map((alert, i) => (
              <div
                key={i}
                onClick={() => alert.accion && onNavigate(alert.accion)}
                className={cn(
                  "flex items-start gap-2.5 p-2.5 rounded-lg text-xs",
                  alert.tipo === 'rojo' ? "bg-red-50 text-red-700 cursor-pointer hover:bg-red-100" :
                  alert.tipo === 'amarillo' ? "bg-amber-50 text-amber-700 cursor-pointer hover:bg-amber-100" :
                  "bg-emerald-50 text-emerald-700"
                )}
              >
                {alert.tipo === 'rojo' ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> :
                 alert.tipo === 'amarillo' ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> :
                 <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                <span className="leading-relaxed">{alert.texto}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-jakarta font-semibold text-foreground">Actividad reciente</h3>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Sin actividad registrada</p>
          ) : (
            <div className="space-y-1">
              {recentActivity.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", item.bg)}>
                      <Icon className={cn("w-3.5 h-3.5", item.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {item.date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Obligaciones */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-jakarta font-semibold text-foreground">Obligaciones</h3>
          <button onClick={() => onNavigate('obligaciones')} className="text-xs text-taxea-red hover:underline flex items-center gap-1">
            Ver todas <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {obligations.length === 0 ? (
          <div className="flex items-center justify-center py-4">
            <p className="text-xs text-muted-foreground">Sin obligaciones registradas</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {obligations.slice(0, 6).map(obl => {
              const now = new Date();
              const isOk = ['finalizado','presentado','pagado','domiciliado'].includes(obl.estado);
              const isVencida = !isOk && obl.fecha_limite && new Date(obl.fecha_limite) < now;
              const isProxima = !isOk && !isVencida && obl.fecha_limite && (new Date(obl.fecha_limite) - now) / 86400000 <= 15;
              return (
                <div key={obl.id} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg border border-border/60 bg-secondary/20">
                  {isOk ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> :
                   isVencida ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> :
                   isProxima ? <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" /> :
                   <div className="w-4 h-4 rounded-full border-2 border-muted flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {obl.modelo?.replace('modelo_', 'Modelo ').replace(/_/g, ' ')}
                    </p>
                    <p className={cn("text-xs truncate", isVencida ? "text-red-500" : isProxima ? "text-amber-500" : "text-muted-foreground")}>
                      {obl.periodo} {obl.fecha_limite && `· ${new Date(obl.fecha_limite).toLocaleDateString('es-ES')}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Access Modules */}
      <div>
        <h3 className="font-jakarta font-semibold text-foreground mb-3">Acceso rápido</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { id: 'lector-gastos', label: 'OCR Gastos', icon: ScanLine, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { id: 'lector-ingresos', label: 'OCR Ingresos', icon: ScanText, color: 'text-violet-500', bg: 'bg-violet-500/10' },
            { id: 'facturas', label: 'Facturas', icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { id: 'presupuestos', label: 'Presupuestos', icon: Receipt, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { id: 'libros', label: 'Libros', icon: BookOpen, color: 'text-taxea-red', bg: 'bg-taxea-red/10' },
            { id: 'obligaciones', label: 'Obligaciones', icon: Calendar, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2.5 hover:border-taxea-red/30 hover:shadow-card-hover transition-all group text-center"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.bg)}>
                  <Icon className={cn("w-5 h-5", item.color)} />
                </div>
                <span className="text-xs font-medium text-foreground group-hover:text-taxea-red transition-colors">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon: Icon, color, bg, alert, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-taxea-red/30 hover:shadow-card-hover transition-all group"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", bg)}>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        {alert && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
      </div>
      <p className="text-lg font-bold text-foreground truncate">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
    </div>
  );
}
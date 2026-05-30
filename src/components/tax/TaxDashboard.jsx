import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, FileText, Calendar, AlertTriangle, CheckCircle2, Clock,
  Zap, ScanLine, ScanText, BookOpen, ChevronRight,
  Activity, BarChart3, Brain, Receipt, AlertCircle, Users, RefreshCw
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import NoCompanyState from '@/components/ui/NoCompanyState';

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PERIODOS = [
  { value: 'todo', label: 'Todo el año' },
  { value: 'T1', label: '1er Trimestre' },
  { value: 'T2', label: '2º Trimestre' },
  { value: 'T3', label: '3er Trimestre' },
  { value: 'T4', label: '4º Trimestre' },
  { value: 'M1', label: 'Enero' }, { value: 'M2', label: 'Febrero' }, { value: 'M3', label: 'Marzo' },
  { value: 'M4', label: 'Abril' }, { value: 'M5', label: 'Mayo' }, { value: 'M6', label: 'Junio' },
  { value: 'M7', label: 'Julio' }, { value: 'M8', label: 'Agosto' }, { value: 'M9', label: 'Septiembre' },
  { value: 'M10', label: 'Octubre' }, { value: 'M11', label: 'Noviembre' }, { value: 'M12', label: 'Diciembre' },
];

function fmtEur(n) {
  return (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BigKpiCard({ icon, iconBg, title, subtitle, amount, amountColor, details = [], link, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all flex flex-col gap-1"
    >
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-1', iconBg)}>
        {icon}
      </div>
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      <p className="text-xs text-gray-400">{subtitle}</p>
      <p className={cn('text-2xl font-bold mt-1', amountColor)}>{amount}</p>
      <div className="mt-1 space-y-0.5">
        {details.map((d, i) => (
          <p key={i} className="text-xs text-gray-500">{d}</p>
        ))}
      </div>
      {link && (
        <button
          onClick={e => { e.stopPropagation(); link.onClick(); }}
          className="text-xs text-blue-600 hover:underline mt-1 text-left"
        >
          {link.label} ↗
        </button>
      )}
    </div>
  );
}

export default function TaxDashboard({ onNavigate }) {
  const { company, loadingCompany } = useOutletContext() || {};
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiAlerts, setAiAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secsSince, setSecsSince] = useState(0);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedPeriod, setSelectedPeriod] = useState('todo');
  const yearOptions = [String(currentYear - 1), String(currentYear), String(currentYear + 1)];

  useEffect(() => {
    const id = setInterval(() => setSecsSince(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (company?.id) loadData();
    else if (!loadingCompany) setLoading(false);
  }, [company?.id, loadingCompany]);

  const loadData = async () => {
    setLoading(true);
    const [invData, expData, oblData, qtData] = await Promise.all([
      base44.entities.Invoice.filter({ company_id: company.id }),
      base44.entities.Expense.filter({ company_id: company.id }),
      base44.entities.TaxObligation.filter({ company_id: company.id }),
      base44.entities.Quote.filter({ company_id: company.id }).catch(() => []),
    ]);
    setInvoices(invData || []);
    setExpenses(expData || []);
    setObligations(oblData || []);
    setQuotes(qtData || []);
    setLastUpdated(new Date());
    setSecsSince(0);
    setLoading(false);
  };

  const timeSince = () => {
    if (!lastUpdated) return '—';
    if (secsSince < 60) return `hace ${secsSince}s`;
    return `hace ${Math.floor(secsSince / 60)}m`;
  };

  const filterByPeriod = useCallback((items, dateField) => {
    const yr = parseInt(selectedYear);
    return items.filter(item => {
      const d = new Date(item[dateField] || item.created_date);
      if (isNaN(d) || d.getFullYear() !== yr) return false;
      if (selectedPeriod === 'todo') return true;
      const m = d.getMonth() + 1;
      if (selectedPeriod === 'T1') return m <= 3;
      if (selectedPeriod === 'T2') return m >= 4 && m <= 6;
      if (selectedPeriod === 'T3') return m >= 7 && m <= 9;
      if (selectedPeriod === 'T4') return m >= 10;
      if (selectedPeriod.startsWith('M')) return m === parseInt(selectedPeriod.slice(1));
      return true;
    });
  }, [selectedYear, selectedPeriod]);

  const kpis = useMemo(() => {
    const filtInv = filterByPeriod(invoices, 'fecha_emision');
    const filtExp = filterByPeriod(expenses, 'fecha');
    const emitidas = filtInv.filter(i => i.tipo === 'emitida' && !i.anulada);
    const recibidas = filtInv.filter(i => i.tipo === 'recibida' && !i.anulada);

    const ingresosBase = emitidas.reduce((s, i) => s + (i.base_imponible || 0), 0);
    const gastosBase = recibidas.reduce((s, i) => s + (i.base_imponible || 0), 0)
      + filtExp.filter(e => e.tipo === 'gasto').reduce((s, e) => s + (e.base_imponible || e.total || 0), 0);
    const ivaRepercutido = emitidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
    const ivaSoportado = recibidas.reduce((s, i) => s + (i.cuota_iva || 0), 0);
    const irpfIngresos = emitidas.reduce((s, i) => s + (i.retencion_irpf ? (i.base_imponible * i.retencion_irpf / 100) : 0), 0);
    const irpfGastos = recibidas.reduce((s, i) => s + (i.retencion_irpf ? (i.base_imponible * i.retencion_irpf / 100) : 0), 0);

    const clientMap = {};
    emitidas.forEach(i => {
      const k = i.cliente_nombre || i.cliente_nif || 'Sin nombre';
      clientMap[k] = (clientMap[k] || 0) + (i.total_factura || 0);
    });
    const top5 = Object.entries(clientMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const factPend = invoices.filter(i => i.estado_cobro === 'pendiente' && i.tipo === 'emitida');
    const factVenc = invoices.filter(i => i.estado_cobro === 'vencida' && i.tipo === 'emitida');
    const presupPend = quotes.filter(q => !q.estado || ['enviado', 'pendiente', 'draft'].includes(q.estado));
    const oblPend = obligations.filter(o => !['finalizado', 'presentado', 'pagado', 'domiciliado'].includes(o.estado));
    const proxObl = oblPend.filter(o => o.fecha_limite && new Date(o.fecha_limite) > new Date())
      .sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))[0];

    return {
      ingresosBase, gastosBase, resumenFiscal: ingresosBase - gastosBase,
      ivaRepercutido, ivaSoportado, ivaAIngresar: ivaRepercutido - ivaSoportado,
      irpfIngresos, irpfGastos, top5,
      factPendientes: factPend.length,
      factPendientesImporte: factPend.reduce((s, i) => s + (i.total_factura || 0), 0),
      factVencidas: factVenc.length,
      presupPendientes: presupPend.length,
      presupPendientesImporte: presupPend.reduce((s, q) => s + (q.total || 0), 0),
      oblPendientes: oblPend.length, proxObl,
    };
  }, [invoices, expenses, obligations, quotes, filterByPeriod]);

  const cashflowData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(currentYear, currentMonth - 5 + i, 1);
      const m = d.getMonth(); const y = d.getFullYear();
      const ing = invoices.filter(inv => { const fd = new Date(inv.fecha_emision || inv.created_date); return fd.getMonth() === m && fd.getFullYear() === y && inv.tipo === 'emitida'; }).reduce((s, inv) => s + (inv.base_imponible || 0), 0);
      const gas = expenses.filter(e => { const fd = new Date(e.fecha || e.created_date); return fd.getMonth() === m && fd.getFullYear() === y && e.tipo === 'gasto'; }).reduce((s, e) => s + (e.base_imponible || e.total || 0), 0);
      return { mes: MONTHS_ES[m], ingresos: Math.round(ing), gastos: Math.round(gas) };
    });
  }, [invoices, expenses, currentYear, currentMonth]);

  const recentActivity = useMemo(() => {
    const items = [
      ...invoices.slice(0, 20).map(i => ({ label: `Factura ${i.numero_factura || ''}`, sub: `${i.cliente_nombre || '—'} · ${(i.total_factura || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, date: new Date(i.created_date), color: 'text-blue-500', bg: 'bg-blue-50', icon: FileText })),
      ...expenses.slice(0, 10).map(e => ({ label: e.concepto || 'Gasto', sub: `${e.proveedor_cliente || '—'} · ${(e.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, date: new Date(e.created_date), color: 'text-red-500', bg: 'bg-red-50', icon: TrendingDown })),
      ...obligations.slice(0, 5).map(o => ({ label: o.modelo?.replace('modelo_', 'Modelo ').replace(/_/g, ' '), sub: `${o.periodo || ''} · ${o.estado}`, date: new Date(o.created_date), color: 'text-amber-500', bg: 'bg-amber-50', icon: Calendar })),
    ];
    return items.sort((a, b) => b.date - a.date).slice(0, 8);
  }, [invoices, expenses, obligations]);

  const generateAiAlerts = async () => {
    if (loadingAlerts || aiAlerts.length > 0) return;
    setLoadingAlerts(true);
    const now = new Date();
    const oblPend = obligations.filter(o => !['finalizado', 'presentado', 'pagado', 'domiciliado'].includes(o.estado));
    const staticAlerts = [];
    const oblVenc = oblPend.filter(o => o.fecha_limite && new Date(o.fecha_limite) < now);
    const factVenc = invoices.filter(i => i.estado_cobro === 'vencida');
    const sinCat = expenses.filter(e => !e.categoria);
    const sinCont = invoices.filter(i => i.estado_contable === 'pendiente');
    if (oblVenc.length > 0) staticAlerts.push({ tipo: 'rojo', texto: `${oblVenc.length} obligación(es) vencida(s) sin presentar.`, accion: 'obligaciones' });
    if (factVenc.length > 0) staticAlerts.push({ tipo: 'rojo', texto: `${factVenc.length} factura(s) vencidas sin cobrar.`, accion: 'facturas' });
    if (sinCat.length > 0) staticAlerts.push({ tipo: 'amarillo', texto: `${sinCat.length} gasto(s) sin categoría contable.`, accion: 'ingresos-gastos' });
    if (sinCont.length > 5) staticAlerts.push({ tipo: 'amarillo', texto: `${sinCont.length} facturas pendientes de contabilizar.`, accion: 'facturas' });
    const proxObl = oblPend.filter(o => o.fecha_limite && new Date(o.fecha_limite) > now).sort((a, b) => new Date(a.fecha_limite) - new Date(b.fecha_limite))[0];
    if (proxObl) {
      const dias = Math.ceil((new Date(proxObl.fecha_limite) - now) / 86400000);
      if (dias <= 15) staticAlerts.push({ tipo: 'amarillo', texto: `Vencimiento en ${dias} días: ${proxObl.modelo?.replace('modelo_', 'Modelo ').replace(/_/g, ' ')}.`, accion: 'obligaciones' });
    }
    if (staticAlerts.length === 0) staticAlerts.push({ tipo: 'verde', texto: 'Todo en orden. Sin alertas fiscales urgentes.', accion: null });
    setAiAlerts(staticAlerts);
    setLoadingAlerts(false);
  };

  if (loadingCompany || loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!company) return <NoCompanyState pageName="Tax Accounting" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-jakarta font-bold text-foreground">Tax Accounting</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{company.legalName || company.displayName || company.razon_social}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            {`Última actualización: ${timeSince()}`}
          </span>
          <button onClick={loadData} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <BigKpiCard
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-100"
          title="Ingresos"
          subtitle="Base imponible (sin IVA)"
          amount={`${fmtEur(kpis.ingresosBase)} €`}
          amountColor="text-emerald-600"
          details={[
            `IVA repercutido: ${fmtEur(kpis.ivaRepercutido)} €`,
            `IRPF de ingresos: ${fmtEur(kpis.irpfIngresos)} €`,
          ]}
          onClick={() => onNavigate('ingresos-gastos')}
        />
        <BigKpiCard
          icon={<TrendingDown className="w-5 h-5 text-red-500" />}
          iconBg="bg-red-100"
          title="Gastos Deducibles"
          subtitle="Base imponible deducible"
          amount={`${fmtEur(kpis.gastosBase)} €`}
          amountColor="text-red-500"
          details={[
            `IVA soportado: ${fmtEur(kpis.ivaSoportado)} €`,
            `IRPF de gastos: ${fmtEur(kpis.irpfGastos)} €`,
          ]}
          onClick={() => onNavigate('ingresos-gastos')}
        />
        {/* Top 5 clientes */}
        <div
          className="bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
          onClick={() => onNavigate('facturas')}
        >
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center mb-1">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm font-semibold text-gray-800 mt-2">Top 5 clientes</p>
          <p className="text-xs text-gray-400 mb-3">Por facturación en el periodo</p>
          {kpis.top5.length === 0 ? (
            <p className="text-xs text-gray-400">Sin facturas cobradas en el periodo</p>
          ) : (
            <div className="space-y-1.5">
              {kpis.top5.map(([name, total], i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-700 truncate max-w-[60%]">{name}</span>
                  <span className="text-xs font-semibold text-gray-800 flex-shrink-0">{fmtEur(total)} €</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <BigKpiCard
          icon={<FileText className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-100"
          title="Facturas pendientes"
          subtitle="Por cobrar"
          amount={`${fmtEur(kpis.factPendientesImporte)} €`}
          amountColor="text-violet-600"
          details={[`${kpis.factPendientes} facturas${kpis.factVencidas > 0 ? ` · ${kpis.factVencidas} vencidas` : ''}`]}
          link={{ label: 'Ver facturas', onClick: () => onNavigate('facturas') }}
          onClick={() => onNavigate('facturas')}
        />
        <BigKpiCard
          icon={<Receipt className="w-5 h-5 text-amber-600" />}
          iconBg="bg-amber-100"
          title="Presupuestos pendientes"
          subtitle="Por aceptar"
          amount={`${fmtEur(kpis.presupPendientesImporte)} €`}
          amountColor="text-amber-600"
          details={[`${kpis.presupPendientes} presupuestos`]}
          link={{ label: 'Ver presupuestos', onClick: () => onNavigate('presupuestos') }}
          onClick={() => onNavigate('presupuestos')}
        />
        <BigKpiCard
          icon={<BarChart3 className="w-5 h-5 text-teal-600" />}
          iconBg="bg-teal-100"
          title="Resumen Fiscal"
          subtitle="Ingresos menos Gastos deducibles"
          amount={`${fmtEur(Math.abs(kpis.resumenFiscal))} €`}
          amountColor={kpis.resumenFiscal >= 0 ? 'text-teal-600' : 'text-red-500'}
          details={[
            `IVA a ingresar: ${fmtEur(kpis.ivaAIngresar)} €`,
            `IRPF de gastos: ${fmtEur(kpis.irpfGastos)} €`,
            `IRPF adelantado: ${fmtEur(kpis.irpfIngresos)} €`,
          ]}
          onClick={() => onNavigate('libros')}
        />
      </div>

      {/* Cashflow + Obligaciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-jakarta font-semibold text-foreground">Cashflow — Últimos 6 meses</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Ingresos vs Gastos</p>
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
              <YAxis tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                formatter={(v, n) => [`${v.toLocaleString('es-ES')} €`, n === 'ingresos' ? 'Ingresos' : 'Gastos']}
              />
              <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} fill="url(#ingGrad)" />
              <Area type="monotone" dataKey="gastos" stroke="#f87171" strokeWidth={2} fill="url(#gasGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-jakarta font-semibold text-foreground">Obligaciones</h3>
            <button onClick={() => onNavigate('obligaciones')} className="text-xs text-taxea-red hover:underline flex items-center gap-1">
              Ver todas <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {obligations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-muted-foreground text-center">Sin obligaciones registradas</p>
            </div>
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto">
              {obligations.slice(0, 6).map(obl => {
                const now = new Date();
                const isOk = ['finalizado', 'presentado', 'pagado', 'domiciliado'].includes(obl.estado);
                const isVenc = !isOk && obl.fecha_limite && new Date(obl.fecha_limite) < now;
                const isProx = !isOk && !isVenc && obl.fecha_limite && (new Date(obl.fecha_limite) - now) / 86400000 <= 15;
                return (
                  <div key={obl.id} className="flex items-center gap-2.5 py-1.5">
                    {isOk ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> :
                      isVenc ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> :
                        isProx ? <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" /> :
                          <div className="w-4 h-4 rounded-full border-2 border-muted flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {obl.modelo?.replace('modelo_', 'Modelo ').replace(/_/g, ' ')}
                      </p>
                      <p className={cn('text-xs truncate', isVenc ? 'text-red-500' : isProx ? 'text-amber-500' : 'text-muted-foreground')}>
                        {obl.periodo}{obl.fecha_limite ? ` · ${new Date(obl.fecha_limite).toLocaleDateString('es-ES')}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AI Alerts + Actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-taxea-red/10 rounded-md flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-taxea-red" />
              </div>
              <h3 className="font-jakarta font-semibold text-foreground text-sm">Alertas IA</h3>
            </div>
            {aiAlerts.length === 0 && (
              <button onClick={generateAiAlerts} disabled={loadingAlerts} className="text-xs text-taxea-red hover:underline flex items-center gap-1">
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
              <div key={i} onClick={() => alert.accion && onNavigate(alert.accion)}
                className={cn('flex items-start gap-2.5 p-2.5 rounded-lg text-xs',
                  alert.tipo === 'rojo' ? 'bg-red-50 text-red-700 cursor-pointer hover:bg-red-100' :
                    alert.tipo === 'amarillo' ? 'bg-amber-50 text-amber-700 cursor-pointer hover:bg-amber-100' :
                      'bg-emerald-50 text-emerald-700')}>
                {alert.tipo === 'rojo' ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> :
                  alert.tipo === 'amarillo' ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> :
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                <span className="leading-relaxed">{alert.texto}</span>
              </div>
            ))}
          </div>
        </div>
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
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', item.bg)}>
                      <Icon className={cn('w-3.5 h-3.5', item.color)} />
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

      {/* Acceso rápido */}
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
              <button key={item.id} onClick={() => onNavigate(item.id)}
                className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2.5 hover:border-taxea-red/30 hover:shadow-card-hover transition-all group text-center">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', item.bg)}>
                  <Icon className={cn('w-5 h-5', item.color)} />
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
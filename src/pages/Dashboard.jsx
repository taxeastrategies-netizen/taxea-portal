import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  TrendingUp, TrendingDown, FileText, Calendar, AlertTriangle,
  Clock, CheckCircle, Euro, BarChart3, Bell, CheckSquare, Upload,
  Calculator, Wallet, Heart, Users, ChevronRight, ArrowRight,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import StatusBadge from '@/components/ui/StatusBadge';
import EstadoFiscal from '@/components/EstadoFiscal';
import { calcularHealthScore } from '@/lib/healthScoreCalc';
import { calculateFinancialKPIs, calculateMonthlyData, activeInvoices } from '@/lib/financialCore';
import { useFinancialData, triggerFinancialRefresh } from '@/hooks/useFinancialData';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const TAX_TOOLS = [
  { label: 'Obligaciones', to: '/tax-accounting/obligaciones', icon: Calendar },
  { label: 'Facturas', to: '/tax-accounting/facturas', icon: FileText },
  { label: 'Lector gastos', to: '/tax-accounting/lector-gastos', icon: Upload },
  { label: 'Asistente IA', to: '/tax-accounting/asistente', icon: CheckCircle },
];
const FIN_TOOLS = [
  { label: 'Tesoreria', to: '/finance/cashflow', icon: TrendingUp },
  { label: 'Cobros', to: '/finance/ar', icon: TrendingUp },
  { label: 'Pagos', to: '/finance/ap', icon: TrendingDown },
  { label: 'Informes', to: '/finance/reporting', icon: BarChart3 },
];
const HR_TOOLS = [
  { label: 'Empleados', to: '/people/employees', icon: Users },
  { label: 'Ausencias', to: '/people/absences', icon: Calendar },
  { label: 'Documentos', to: '/people/documents', icon: FileText },
  { label: 'Control horario', to: '/people/time', icon: Clock },
];

function KpiBlock({ label, value, sub, alert, warn, trend }) {
  const color = alert ? 'text-red-600' : warn ? 'text-amber-600' : 'text-foreground';
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';
  return (
    <div className="bg-card px-5 py-4">
      <div className="flex items-start justify-between gap-1">
        <p className={cn('text-2xl font-bold leading-none', color)}>{value}</p>
        {trend && <TrendIcon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', trendColor)} />}
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

function DeptCard({ color, bgLight, border, icon: DeptIcon, title, to, kpis, tools }) {
  return (
    <div className={cn('bg-card rounded-xl border overflow-hidden flex flex-col', border)}>
      <div className={cn('flex items-center justify-between px-5 py-3.5 border-b', bgLight, border)}>
        <div className="flex items-center gap-2.5">
          <DeptIcon className={cn('w-4 h-4', color)} />
          <span className={cn('font-jakarta font-bold text-sm', color)}>{title}</span>
        </div>
        <Link to={to} className={cn('flex items-center gap-0.5 text-xs font-medium hover:underline', color)}>
          Ver todo <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border flex-1">
        {kpis.map((kpi, i) => <KpiBlock key={i} {...kpi} />)}
      </div>
      <div className="px-5 py-3 border-t border-border bg-secondary/30 flex flex-wrap gap-x-4 gap-y-1.5">
        {tools.map((t, i) => {
          const ToolIcon = t.icon;
          return (
            <Link key={i} to={t.to} className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
              <ToolIcon className="w-3 h-3" />{t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ScoreRing({ score }) {
  const color = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="flex-shrink-0">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>{score}</text>
      <text x="50" y="60" textAnchor="middle" fontSize="10" fill="#9ca3af">/ 100</text>
    </svg>
  );
}

export default function Dashboard() {
  const { user, company, isAdmin, loadingCompany } = useOutletContext() || {};
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const { invoices, expenses, loading: finLoading } = useFinancialData(company?.id, { year: selectedYear });
  const [obligations, setObligations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [errors, setErrors] = useState([]);
  const [crmData, setCrmData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [hrDocuments, setHrDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2].map(String);

  useEffect(() => {
    if (company?.id) loadData();
    else if (!loadingCompany) setLoading(false);
  }, [company?.id, loadingCompany]);

  const loadData = async () => {
    setLoading(true);
    const [obl, notif] = await Promise.all([
      base44.entities.TaxObligation.filter({ company_id: company.id }, '-fecha_limite', 20),
      base44.entities.Notification.filter({ destinatario_email: user?.email, leida: false }, '-created_date', 5),
    ]);
    setObligations(obl || []);
    setNotifications(notif || []);

    const [tsk, errs, crm, emp, abs, hrdocs] = await Promise.all([
      base44.entities.Task.filter({ company_id: company.id }, '-updated_date', 30),
      base44.entities.FiscalError.filter({ company_id: company.id }, '-created_date', 20),
      base44.entities.ClientCRM.filter({ company_id: company.id }, '-created_date', 1),
      base44.entities.Employee.filter({ company_id: company.id }, '-created_date', 50).catch(() => []),
      base44.entities.HRAbsence.filter({ company_id: company.id }, '-created_date', 20).catch(() => []),
      base44.entities.HRDocument.filter({ company_id: company.id }, '-created_date', 20).catch(() => []),
    ]);
    setTasks(isAdmin ? tsk || [] : (tsk || []).filter(t => !t.interna));
    setErrors(errs || []);
    setCrmData(crm?.[0] || null);
    setEmployees(emp || []);
    setAbsences(abs || []);
    setHrDocuments(hrdocs || []);
    setLoading(false);
  };

  const derived = useMemo(() => {
    // ── KPIs financieros unificados (excluyen anuladas, metricas consistentes) ──
    const finKPIs = calculateFinancialKPIs(invoices, expenses, { year: selectedYear });
    const totalIngresos = finKPIs.totalIngresos;
    const totalGastos = finKPIs.totalGastos;
    const resultado = finKPIs.resultado;
    const ivaRepercutido = finKPIs.ivaRepercutido;
    const ivaSoportado = finKPIs.ivaSoportado;
    const facturasPendientes = finKPIs.facturasPendientesContabilizar;
    const tareasVencidas = tasks.filter(t => t.fecha_limite && new Date(t.fecha_limite) < new Date() && !['completada', 'cancelada'].includes(t.estado));
    const erroresCriticos = errors.filter(e => e.severidad === 'critica' && !['resuelto', 'ignorado'].includes(e.estado));
    const now = new Date();
    const oblUrgentes = obligations.filter(o => {
      if (!o.fecha_limite) return false;
      const diff = (new Date(o.fecha_limite) - now) / 86400000;
      return diff >= 0 && diff <= 15;
    });
    const facturasCobrar = finKPIs.emitidas.filter(i => ['pendiente', 'enviada'].includes(i.estado_contable));
    const facturasVencidas = finKPIs.facturasVencidasList;
    const estadoFiscal = (() => {
      if (erroresCriticos.length > 0 || tareasVencidas.length > 0) return 'rojo';
      if (facturasPendientes > 0 || obligations.some(o => o.estado === 'pendiente_documentacion')) return 'amarillo';
      if (invoices.length > 0 || expenses.length > 0) return 'verde';
      return 'gris';
    })();
    const { score: healthScore, motivos: healthMotivos } = calcularHealthScore({ errors, tasks, obligations, invoices });
    const margen = totalIngresos > 0 ? Math.round((resultado / totalIngresos) * 100) : 0;
    const recentActivity = [...invoices.slice(-3), ...expenses.slice(-3)]
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);
    const monthlyChart = calculateMonthlyData(invoices, expenses, selectedYear);
    const empleadosActivos = employees.filter(e => !e.estado || e.estado === 'activo');
    const ausenciasPendientes = absences.filter(a => ['pendiente', 'solicitada'].includes(a.estado));
    const hrDocsPendientes = hrDocuments.filter(d => ['pendiente', 'revision'].includes(d.estado));
    return {
      totalIngresos, totalGastos, resultado, ivaRepercutido, ivaSoportado,
      facturasPendientes, tareasVencidas, erroresCriticos, oblUrgentes,
      facturasCobrar, facturasVencidas, estadoFiscal, healthScore, healthMotivos,
      margen, recentActivity, monthlyChart, empleadosActivos, ausenciasPendientes, hrDocsPendientes
    };
  }, [invoices, expenses, obligations, tasks, errors, employees, absences, hrDocuments, selectedYear]);

  if (loading || loadingCompany || finLoading) return <DashboardSkeleton />;

  if (!company) return (
    <div className="animate-fade-in max-w-xl mx-auto mt-16 text-center">
      <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Upload className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-lg font-jakarta font-bold mb-2">Configura tu empresa</h2>
      <p className="text-sm text-muted-foreground mb-6">Necesitas configurar los datos de tu empresa para activar el portal.</p>
      <Button asChild><Link to="/ajustes">Configurar empresa</Link></Button>
    </div>
  );

  const {
    totalIngresos, totalGastos, resultado, ivaRepercutido, ivaSoportado,
    facturasPendientes, tareasVencidas, erroresCriticos, oblUrgentes,
    facturasCobrar, facturasVencidas, estadoFiscal, healthScore, healthMotivos,
    margen, recentActivity, monthlyChart, empleadosActivos, ausenciasPendientes, hrDocsPendientes
  } = derived;

  const now = new Date();

  return (
    <div className="animate-fade-in space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-jakarta font-bold text-foreground">
            {isAdmin ? (company?.razon_social || 'Dashboard') : `Hola, ${user?.full_name?.split(' ')[0] || 'Cliente'}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
              : company?.razon_social}
          </p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Alertas urgentes */}
      {(erroresCriticos.length > 0 || tareasVencidas.length > 0 || oblUrgentes.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {erroresCriticos.length > 0 && (
            <Link to="/errores" className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />{erroresCriticos.length} error{erroresCriticos.length > 1 ? 'es' : ''} critico{erroresCriticos.length > 1 ? 's' : ''}
            </Link>
          )}
          {tareasVencidas.length > 0 && (
            <Link to="/tareas" className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
              <Clock className="w-3.5 h-3.5" />{tareasVencidas.length} tarea{tareasVencidas.length > 1 ? 's' : ''} vencida{tareasVencidas.length > 1 ? 's' : ''}
            </Link>
          )}
          {oblUrgentes.length > 0 && (
            <Link to="/tax-accounting/obligaciones" className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors">
              <Calendar className="w-3.5 h-3.5" />{oblUrgentes.length} vencimiento{oblUrgentes.length > 1 ? 's' : ''} proximo{oblUrgentes.length > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      )}

      {/* Notificaciones */}
      {notifications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {notifications.slice(0, 2).map(n => (
            <div key={n.id} className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3 flex-1 min-w-[260px]">
              <Bell className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{n.titulo}</p>
                <p className="text-xs text-muted-foreground">{n.mensaje}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fila 1: Health Score + 3 KPIs financieros */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-4 col-span-2 lg:col-span-1">
          <ScoreRing score={healthScore} />
          <div>
            <p className="text-sm font-jakarta font-bold text-foreground">Health Score</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {healthScore >= 80 ? 'Estado optimo' : healthScore >= 50 ? 'Requiere atencion' : 'Estado critico'}
            </p>
            {healthMotivos?.[0] && (
              <p className="text-[11px] text-amber-600 mt-1 font-medium leading-snug">{healthMotivos[0]}</p>
            )}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <p className="text-2xl font-bold text-emerald-600">{totalIngresos.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Ingresos {selectedYear}</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <p className={cn('text-2xl font-bold', resultado >= 0 ? 'text-primary' : 'text-destructive')}>
            {resultado >= 0 ? '+' : ''}{resultado.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
          </p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Euro className="w-3 h-3" />Resultado neto</p>
          <p className={cn('text-[10px] font-medium mt-0.5', margen >= 0 ? 'text-emerald-600' : 'text-red-500')}>Margen {margen}%</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <p className="text-2xl font-bold text-foreground">
            {empleadosActivos.length > 0 ? empleadosActivos.length : obligations.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            {empleadosActivos.length > 0
              ? <><Users className="w-3 h-3" />Empleados activos</>
              : <><Calendar className="w-3 h-3" />Obligaciones</>}
          </p>
          {empleadosActivos.length > 0 && (
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{employees.length} total plantilla</p>
          )}
        </div>
      </div>

      {/* Fila 2: Grafica mensual + Semaforo + Indicadores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h3 className="text-sm font-jakarta font-semibold">Ingresos vs Gastos — {selectedYear}</h3>
            <Link to="/tax-accounting/ingresos-gastos" className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver detalle <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="px-4 py-4">
            {monthlyChart.some(m => m.ingresos > 0 || m.gastos > 0) ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyChart} barSize={10} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip formatter={(val) => `${val.toLocaleString('es-ES')} €`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="ingresos" fill="#16a34a" radius={[3,3,0,0]} name="Ingresos" />
                  <Bar dataKey="gastos" fill="#dc2626" radius={[3,3,0,0]} name="Gastos" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Sin datos para {selectedYear}</p>
              </div>
            )}
            <div className="flex items-center gap-4 mt-1 justify-center">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" />Ingresos</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block opacity-70" />Gastos</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <EstadoFiscal estado={estadoFiscal} />
          <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Indicadores clave</p>
            {[
              { label: 'Facturas por cobrar', val: facturasCobrar.length, barColor: 'bg-amber-400' },
              { label: 'Cobros vencidos', val: facturasVencidas.length, barColor: 'bg-red-500' },
              { label: 'Obligaciones urgentes', val: oblUrgentes.length, barColor: 'bg-orange-400' },
              { label: 'Errores criticos', val: erroresCriticos.length, barColor: 'bg-red-600' },
            ].map((ind, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-foreground">{ind.label}</span>
                  <span className={cn('text-xs font-bold', ind.val > 0 ? 'text-amber-600' : 'text-emerald-600')}>{ind.val}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div
                    className={cn('h-1.5 rounded-full transition-all', ind.val > 0 ? ind.barColor : 'bg-emerald-500')}
                    style={{ width: ind.val === 0 ? '4px' : `${Math.min(ind.val * 20, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fila 3: Cards de departamento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DeptCard
          icon={Calculator} color="text-taxea-red" bgLight="bg-red-50/60" border="border-red-100"
          title="Tax &amp; Accounting" to="/tax-accounting/dashboard"
          kpis={[
            { label: 'Obligaciones urgentes', value: oblUrgentes.length, alert: oblUrgentes.length > 0, trend: oblUrgentes.length > 0 ? 'up' : 'down' },
            { label: 'Docs sin validar', value: facturasPendientes, warn: facturasPendientes > 0 },
            { label: 'Obligaciones totales', value: obligations.length },
            { label: 'Errores criticos', value: erroresCriticos.length, alert: erroresCriticos.length > 0 },
          ]}
          tools={TAX_TOOLS}
        />
        <DeptCard
          icon={Wallet} color="text-emerald-700" bgLight="bg-emerald-50/60" border="border-emerald-100"
          title="Finance" to="/finance/dashboard"
          kpis={[
            { label: 'Cobros vencidos', value: facturasVencidas.length, alert: facturasVencidas.length > 0, trend: facturasVencidas.length > 0 ? 'up' : null },
            { label: 'Cobros pendientes', value: facturasCobrar.length, warn: facturasCobrar.length > 0 },
            { label: 'Total gastos ' + selectedYear, value: totalGastos.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €' },
            { label: 'IVA estimado', value: (ivaRepercutido - ivaSoportado).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €' },
          ]}
          tools={FIN_TOOLS}
        />
        <DeptCard
          icon={Heart} color="text-rose-700" bgLight="bg-rose-50/60" border="border-rose-100"
          title="People &amp; HR" to="/people/dashboard"
          kpis={[
            { label: 'Empleados activos', value: empleadosActivos.length },
            { label: 'Total plantilla', value: employees.length },
            { label: 'Ausencias pendientes', value: ausenciasPendientes.length, warn: ausenciasPendientes.length > 0 },
            { label: 'Docs laborales pend.', value: hrDocsPendientes.length, warn: hrDocsPendientes.length > 0 },
          ]}
          tools={HR_TOOLS}
        />
      </div>

      {/* Fila 4: Obligaciones + Equipo + Actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Obligaciones */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="text-sm font-jakarta font-semibold flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />Obligaciones
            </h3>
            <Link to="/tax-accounting/obligaciones" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          <div className="divide-y divide-border/60">
            {obligations.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Sin obligaciones registradas</p>
              </div>
            ) : obligations.slice(0, 5).map((obl) => (
              <div key={obl.id} className="px-5 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground capitalize">
                    {obl.modelo?.replace(/_/g, ' ').replace('modelo ', 'Mod. ') || 'Obligacion'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{obl.periodo} · {obl.fecha_limite}</p>
                </div>
                <StatusBadge status={obl.estado} />
              </div>
            ))}
          </div>
          {tasks.filter(t => t.estado === 'pendiente_cliente').length > 0 && (
            <div className="px-5 py-2.5 border-t border-border bg-amber-50/50 flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-xs font-medium text-amber-700 flex-1">
                {tasks.filter(t => t.estado === 'pendiente_cliente').length} tarea(s) pendiente(s)
              </p>
              <Link to="/tareas" className="text-xs text-amber-700 hover:underline font-medium">Ver</Link>
            </div>
          )}
        </div>

        {/* Equipo */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="text-sm font-jakarta font-semibold flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />Equipo
            </h3>
            <Link to="/people/employees" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-border/60">
            {empleadosActivos.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Users className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-xs text-muted-foreground">Sin empleados registrados</p>
              </div>
            ) : empleadosActivos.slice(0, 5).map((e, i) => (
              <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-rose-700">
                    {(e.full_name || e.nombre || '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{e.full_name || e.nombre || 'Empleado'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{e.departamento || e.puesto || '—'}</p>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">Activo</span>
              </div>
            ))}
            {empleadosActivos.length > 5 && (
              <div className="px-5 py-2 text-center">
                <Link to="/people/employees" className="text-xs text-muted-foreground hover:text-primary">
                  +{empleadosActivos.length - 5} mas
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="text-sm font-jakarta font-semibold flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />Actividad reciente
            </h3>
            <Link to="/tax-accounting/libros" className="text-xs text-primary hover:underline">Ver todo</Link>
          </div>
          <div className="divide-y divide-border/60">
            {recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <BarChart3 className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-xs text-muted-foreground">Sin movimientos recientes</p>
              </div>
            ) : recentActivity.map((item, i) => (
              <div key={i} className="px-5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', item.tipo === 'emitida' ? 'bg-emerald-500' : 'bg-red-400')} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {item.numero_factura || item.concepto || 'Movimiento'}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.cliente_nombre || item.proveedor_cliente || '—'}
                    </p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-foreground flex-shrink-0 ml-2">
                  {((item.total_factura || item.total) || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded-lg" />
          <div className="h-4 w-32 bg-muted/60 rounded" />
        </div>
        <div className="h-8 w-24 bg-muted rounded-lg" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-64 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-52 bg-muted rounded-xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-muted rounded-xl" />)}
      </div>
    </div>
  );
}
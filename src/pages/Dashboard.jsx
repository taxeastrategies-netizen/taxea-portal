import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  TrendingUp, TrendingDown, FileText, Calendar, AlertTriangle,
  Clock, CheckCircle, Euro, BarChart3, Bell, CheckSquare, Upload,
  Calculator, Wallet, Heart, Users, ChevronRight, ArrowRight
} from 'lucide-react';
import FiscalDashboard from '@/components/dashboard/FiscalDashboard';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import EstadoFiscal from '@/components/EstadoFiscal';
import HealthScore from '@/components/HealthScore';
import SummaryCards from '@/components/dashboard/SummaryCards';
import CashFlowChart from '@/components/dashboard/CashFlowChart';
import { calcularHealthScore } from '@/lib/healthScoreCalc';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ── Quick access tools per department ──
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

function DeptCard({ color, bgLight, border, icon: Icon, title, to, kpis, tools }) {
  return (
    <div className={cn('bg-card rounded-xl border overflow-hidden flex flex-col', border)}>
      {/* Header */}
      <div className={cn('flex items-center justify-between px-5 py-3.5 border-b', bgLight, border)}>
        <div className="flex items-center gap-2.5">
          <Icon className={cn('w-4 h-4', color)} />
          <span className={cn('font-jakarta font-bold text-sm', color)}>{title}</span>
        </div>
        <Link to={to} className={cn('flex items-center gap-0.5 text-xs font-medium hover:underline', color)}>
          Ver todo <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-px bg-border flex-1">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-card px-5 py-4">
            <p className={cn('text-2xl font-bold leading-none', kpi.alert ? 'text-red-600' : kpi.warn ? 'text-amber-600' : 'text-foreground')}>
              {kpi.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Quick tools */}
      <div className="px-5 py-3 border-t border-border bg-secondary/30 flex flex-wrap gap-x-3 gap-y-1.5">
        {tools.map((t, i) => (
          <Link key={i} to={t.to} className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
            <t.icon className="w-3 h-3" />{t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, company, isAdmin, loadingCompany } = useOutletContext() || {};
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [errors, setErrors] = useState([]);
  const [crmData, setCrmData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [hrDocuments, setHrDocuments] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedQuarter, setSelectedQuarter] = useState('anual');
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2].map(String);

  useEffect(() => {
    if (company?.id) loadData();
    else if (!loadingCompany) setLoading(false);
  }, [company?.id, selectedYear, loadingCompany]);

  const loadData = async () => {
    setLoading(true);
    const [inv, exp, obl, notif] = await Promise.all([
      base44.entities.Invoice.filter({ company_id: company.id, anio: parseInt(selectedYear) }),
      base44.entities.Expense.filter({ company_id: company.id, anio: parseInt(selectedYear) }),
      base44.entities.TaxObligation.filter({ company_id: company.id }, '-fecha_limite', 20),
      base44.entities.Notification.filter({ destinatario_email: user?.email, leida: false }, '-created_date', 5),
    ]);
    setInvoices(inv || []);
    setExpenses(exp || []);
    setObligations(obl || []);
    setNotifications(notif || []);
    setLoading(false);

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
  };

  const {
    totalIngresos, totalGastos, resultado, ivaRepercutido, ivaSoportado,
    facturasPendientes, obligacionesProximas, tareasVencidas, erroresCriticos,
    estadoFiscal, healthScore, healthMotivos, recentActivity
  } = useMemo(() => {
    const totalIngresos = invoices.filter(i => i.tipo === 'emitida').reduce((s, i) => s + (i.total_factura || 0), 0);
    const totalGastos = expenses.filter(e => e.tipo === 'gasto').reduce((s, e) => s + (e.total || 0), 0);
    const resultado = totalIngresos - totalGastos;
    const ivaRepercutido = invoices.filter(i => i.tipo === 'emitida').reduce((s, i) => s + (i.cuota_iva || 0), 0);
    const ivaSoportado = invoices.filter(i => i.tipo === 'recibida').reduce((s, i) => s + (i.cuota_iva || 0), 0);
    const facturasPendientes = invoices.filter(i => i.estado_contable === 'pendiente').length;
    const obligacionesProximas = obligations.filter(o => ['pendiente_documentacion', 'en_preparacion'].includes(o.estado)).length;
    const tareasVencidas = tasks.filter(t => t.fecha_limite && new Date(t.fecha_limite) < new Date() && !['completada', 'cancelada'].includes(t.estado));
    const erroresCriticos = errors.filter(e => e.severidad === 'critica' && !['resuelto', 'ignorado'].includes(e.estado));
    const estadoFiscal = (() => {
      if (erroresCriticos.length > 0 || tareasVencidas.length > 0) return 'rojo';
      if (facturasPendientes > 0 || obligations.some(o => o.estado === 'pendiente_documentacion')) return 'amarillo';
      if (invoices.length > 0 || expenses.length > 0) return 'verde';
      return 'gris';
    })();
    const { score: healthScoreCalc, motivos: healthMotivos } = calcularHealthScore({ errors, tasks, obligations, invoices });
    const healthScore = crmData?.health_score || healthScoreCalc;
    const recentActivity = [...invoices.slice(-3), ...expenses.slice(-3)]
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);
    return {
      totalIngresos, totalGastos, resultado, ivaRepercutido, ivaSoportado,
      facturasPendientes, obligacionesProximas, tareasVencidas, erroresCriticos,
      estadoFiscal, healthScore, healthMotivos, recentActivity
    };
  }, [invoices, expenses, obligations, tasks, errors, crmData]);

  if (loading || loadingCompany) return <DashboardSkeleton />;

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

  // ── Admin-only metrics ──
  const now = new Date();
  const empleadosActivos = employees.filter(e => !e.estado || e.estado === 'activo');
  const ausenciasPendientes = absences.filter(a => ['pendiente', 'solicitada'].includes(a.estado));
  const hrDocsPendientes = hrDocuments.filter(d => ['pendiente', 'revision'].includes(d.estado));
  const oblUrgentes = obligations.filter(o => {
    if (!o.fecha_limite) return false;
    const diff = (new Date(o.fecha_limite) - now) / 86400000;
    return diff >= 0 && diff <= 15;
  });
  const facturasCobrar = invoices.filter(i => i.tipo === 'emitida' && ['pendiente', 'enviada'].includes(i.estado_contable));
  const facturasVencidas = invoices.filter(i => i.tipo === 'emitida' && i.fecha_vencimiento && new Date(i.fecha_vencimiento) < now && !['cobrada', 'anulada'].includes(i.estado_contable));

  // ── ADMIN VIEW ──
  if (isAdmin) {
    return (
      <div className="animate-fade-in space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-jakarta font-bold text-foreground">{company?.razon_social || 'Dashboard'}</h1>
            <p className="text-sm text-muted-foreground">{now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {/* Alertas urgentes — solo si hay */}
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

        {/* Tres cards de departamento */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DeptCard
            icon={Calculator}
            color="text-taxea-red"
            bgLight="bg-red-50/60"
            border="border-red-100"
            title="Tax &amp; Accounting"
            to="/tax-accounting/dashboard"
            kpis={[
              { label: 'Obligaciones urgentes', value: oblUrgentes.length, alert: oblUrgentes.length > 0 },
              { label: 'Docs sin validar', value: facturasPendientes, warn: facturasPendientes > 0 },
              { label: 'Obligaciones totales', value: obligations.length },
              { label: 'Errores criticos', value: erroresCriticos.length, alert: erroresCriticos.length > 0 },
            ]}
            tools={TAX_TOOLS}
          />
          <DeptCard
            icon={Wallet}
            color="text-emerald-700"
            bgLight="bg-emerald-50/60"
            border="border-emerald-100"
            title="Finance"
            to="/finance/dashboard"
            kpis={[
              { label: 'Cobros vencidos', value: facturasVencidas.length, alert: facturasVencidas.length > 0 },
              { label: 'Cobros pendientes', value: facturasCobrar.length, warn: facturasCobrar.length > 0 },
              { label: 'Ingresos ' + selectedYear, value: totalIngresos.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €' },
              { label: 'Resultado neto', value: (resultado >= 0 ? '+' : '') + resultado.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €' },
            ]}
            tools={FIN_TOOLS}
          />
          <DeptCard
            icon={Heart}
            color="text-rose-700"
            bgLight="bg-rose-50/60"
            border="border-rose-100"
            title="People &amp; HR"
            to="/people/dashboard"
            kpis={[
              { label: 'Empleados activos', value: empleadosActivos.length },
              { label: 'Total plantilla', value: employees.length },
              { label: 'Ausencias pendientes', value: ausenciasPendientes.length, warn: ausenciasPendientes.length > 0 },
              { label: 'Docs laborales pend.', value: hrDocsPendientes.length, warn: hrDocsPendientes.length > 0 },
            ]}
            tools={HR_TOOLS}
          />
        </div>

        {/* Obligaciones proximas */}
        {obligations.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-sm font-jakarta font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />Proximas obligaciones fiscales
              </h3>
              <Link to="/tax-accounting/obligaciones" className="text-xs text-primary hover:underline flex items-center gap-1">
                Ver todas <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-border/60">
              {obligations.slice(0, 4).map((obl) => (
                <div key={obl.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{obl.modelo?.replace(/_/g, ' ').replace('modelo ', 'Mod. ') || 'Obligacion'}</p>
                    <p className="text-xs text-muted-foreground">{obl.periodo} · Limite: {obl.fecha_limite}</p>
                  </div>
                  <StatusBadge status={obl.estado} />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    );
  }

  // ── USER VIEW ──
  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-jakarta font-bold text-foreground">
            Hola, {user?.full_name?.split(' ')[0] || 'Cliente'}
          </h1>
          <p className="text-sm text-muted-foreground">{company?.razon_social}</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="anual">Ano completo</SelectItem>
              <SelectItem value="T1">T1 Ene-Mar</SelectItem>
              <SelectItem value="T2">T2 Abr-Jun</SelectItem>
              <SelectItem value="T3">T3 Jul-Sep</SelectItem>
              <SelectItem value="T4">T4 Oct-Dic</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {(erroresCriticos.length > 0 || tareasVencidas.length > 0) && (
        <div className="mb-5 space-y-2">
          {erroresCriticos.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-red-700 flex-1">{erroresCriticos.length} error{erroresCriticos.length > 1 ? 'es' : ''} critico{erroresCriticos.length > 1 ? 's' : ''}</p>
              <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" asChild>
                <Link to="/errores">Ver</Link>
              </Button>
            </div>
          )}
          {tareasVencidas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-amber-700 flex-1">{tareasVencidas.length} tarea{tareasVencidas.length > 1 ? 's' : ''} vencida{tareasVencidas.length > 1 ? 's' : ''}</p>
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100" asChild>
                <Link to="/tareas">Ver</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      {notifications.length > 0 && (
        <div className="mb-5 space-y-2">
          {notifications.slice(0, 2).map(n => (
            <div key={n.id} className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4">
              <Bell className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{n.titulo}</p>
                <p className="text-sm text-muted-foreground">{n.mensaje}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2"><EstadoFiscal estado={estadoFiscal} /></div>
        <HealthScore score={healthScore} motivos={healthMotivos} />
      </div>

      <SummaryCards invoices={invoices} expenses={expenses} obligations={obligations} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Total Ingresos" value={totalIngresos} icon={TrendingUp} colorClass="text-emerald-600" bgClass="bg-emerald-50" accent="bg-emerald-400" />
        <StatCard title="Total Gastos" value={totalGastos} icon={TrendingDown} colorClass="text-red-500" bgClass="bg-red-50" accent="bg-red-400" />
        <StatCard title="Resultado Neto" value={resultado} icon={Euro} colorClass={resultado >= 0 ? "text-primary" : "text-destructive"} bgClass={resultado >= 0 ? "bg-accent" : "bg-red-50"} accent={resultado >= 0 ? "bg-taxea-red" : "bg-red-400"} />
        <StatCard title="IVA Estimado" value={ivaRepercutido - ivaSoportado} icon={BarChart3} colorClass="text-amber-600" bgClass="bg-amber-50" accent="bg-amber-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Facturas Pendientes" value={facturasPendientes} icon={FileText} suffix="" colorClass="text-amber-600" bgClass="bg-amber-50" accent="bg-amber-400" />
        <StatCard title="Obligaciones" value={obligacionesProximas} icon={Calendar} suffix="" colorClass="text-red-500" bgClass="bg-red-50" accent="bg-red-400" />
        <StatCard title="Tareas activas" value={tasks.filter(t => !['completada', 'cancelada'].includes(t.estado)).length} icon={CheckSquare} suffix="" colorClass="text-blue-600" bgClass="bg-blue-50" accent="bg-blue-400" />
        <StatCard title="Errores activos" value={errors.filter(e => !['resuelto', 'ignorado'].includes(e.estado)).length} icon={AlertTriangle} suffix="" colorClass="text-orange-500" bgClass="bg-orange-50" accent="bg-orange-400" />
      </div>

      <div className="mb-5">
        <CashFlowChart invoices={invoices} expenses={expenses} />
      </div>

      <div className="mb-5">
        <h2 className="text-sm font-jakarta font-semibold text-foreground mb-3">
          Estimacion Fiscal · {selectedQuarter === 'anual' ? `Ano ${selectedYear}` : `${selectedQuarter} ${selectedYear}`}
        </h2>
        <FiscalDashboard invoices={invoices} expenses={expenses} company={company} quarter={selectedQuarter} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-jakarta font-semibold text-foreground text-sm">Ultimos movimientos</h3>
            <Link to="/tax-accounting/libros" className="text-xs text-primary hover:underline">Ver todo</Link>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Sin movimientos registrados</p>
              </div>
            ) : recentActivity.map((item, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.numero_factura || item.concepto || 'Movimiento'}</p>
                  <p className="text-xs text-muted-foreground">{item.cliente_nombre || item.proveedor_cliente || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{((item.total_factura || item.total) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
                  <StatusBadge status={item.estado_contable || item.estado} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-jakarta font-semibold text-foreground text-sm">Obligaciones Fiscales</h3>
            <Link to="/tax-accounting/obligaciones" className="text-xs text-primary hover:underline">Ver todo</Link>
          </div>
          <div className="divide-y divide-border">
            {obligations.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle className="w-7 h-7 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin obligaciones registradas</p>
              </div>
            ) : obligations.slice(0, 4).map((obl) => (
              <div key={obl.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">{obl.modelo?.replace(/_/g, ' ').replace('modelo ', 'Mod. ') || 'Obligacion'}</p>
                  <p className="text-xs text-muted-foreground">{obl.periodo} · Limite: {obl.fecha_limite}</p>
                </div>
                <StatusBadge status={obl.estado} />
              </div>
            ))}
          </div>
          {tasks.filter(t => t.estado === 'pendiente_cliente').length > 0 && (
            <div className="px-5 py-3 border-t border-border bg-amber-50/50 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-700 flex-1">
                {tasks.filter(t => t.estado === 'pendiente_cliente').length} tarea{tasks.filter(t => t.estado === 'pendiente_cliente').length > 1 ? 's' : ''} pendiente{tasks.filter(t => t.estado === 'pendiente_cliente').length > 1 ? 's' : ''}
              </p>
              <Link to="/tareas" className="text-xs text-amber-700 hover:underline font-medium">Ver</Link>
            </div>
          )}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-muted rounded-xl" />)}
      </div>
      <div className="h-40 bg-muted rounded-xl" />
    </div>
  );
}
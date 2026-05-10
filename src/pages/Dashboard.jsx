import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  TrendingUp, TrendingDown, FileText, Calendar, AlertTriangle,
  Clock, CheckCircle, Euro, BarChart3, Bell, CheckSquare, Upload
} from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/ui/PageHeader';
import EstadoFiscal from '@/components/EstadoFiscal';
import HealthScore from '@/components/HealthScore';
import SummaryCards from '@/components/dashboard/SummaryCards';
import CashFlowChart from '@/components/dashboard/CashFlowChart';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { user, company, isAdmin } = useOutletContext() || {};
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [errors, setErrors] = useState([]);
  const [crmData, setCrmData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2].map(String);

  useEffect(() => { if (company?.id) loadData(); }, [company?.id, selectedYear]);

  const loadData = async () => {
    setLoading(true);
    const [inv, exp, obl, notif, tsk, errs, crm] = await Promise.all([
      base44.entities.Invoice.filter({ company_id: company.id, anio: parseInt(selectedYear) }),
      base44.entities.Expense.filter({ company_id: company.id, anio: parseInt(selectedYear) }),
      base44.entities.TaxObligation.filter({ company_id: company.id }),
      base44.entities.Notification.filter({ destinatario_email: user?.email, leida: false }),
      base44.entities.Task.filter({ company_id: company.id }),
      base44.entities.FiscalError.filter({ company_id: company.id }),
      base44.entities.ClientCRM.filter({ company_id: company.id }),
    ]);
    setInvoices(inv || []);
    setExpenses(exp || []);
    setObligations(obl || []);
    setNotifications(notif || []);
    setTasks(isAdmin ? tsk || [] : (tsk || []).filter(t => !t.interna));
    setErrors(errs || []);
    setCrmData(crm?.[0] || null);
    setLoading(false);
  };

  const totalIngresos = invoices.filter(i => i.tipo === 'emitida').reduce((s, i) => s + (i.total_factura || 0), 0);
  const totalGastos = expenses.filter(e => e.tipo === 'gasto').reduce((s, e) => s + (e.total || 0), 0);
  const resultado = totalIngresos - totalGastos;
  const ivaRepercutido = invoices.filter(i => i.tipo === 'emitida').reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const ivaSoportado = invoices.filter(i => i.tipo === 'recibida').reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const facturasPendientes = invoices.filter(i => i.estado_contable === 'pendiente').length;
  const obligacionesProximas = obligations.filter(o => ['pendiente_documentacion', 'en_preparacion'].includes(o.estado)).length;
  const tareasVencidas = tasks.filter(t => t.fecha_limite && new Date(t.fecha_limite) < new Date() && !['completada', 'cancelada'].includes(t.estado));
  const erroresCriticos = errors.filter(e => e.severidad === 'critica' && !['resuelto', 'ignorado'].includes(e.estado));

  // Calcular estado fiscal dinámico
  const estadoFiscal = (() => {
    if (erroresCriticos.length > 0 || tareasVencidas.length > 0) return 'rojo';
    if (facturasPendientes > 0 || obligations.some(o => o.estado === 'pendiente_documentacion')) return 'amarillo';
    if (invoices.length > 0 || expenses.length > 0) return 'verde';
    return 'gris';
  })();

  const healthScore = crmData?.health_score || (estadoFiscal === 'verde' ? 85 : estadoFiscal === 'amarillo' ? 62 : estadoFiscal === 'rojo' ? 35 : 75);

  const recentActivity = [...invoices.slice(-3), ...expenses.slice(-3)]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 5);

  if (loading) return (
    <div className="flex justify-center items-center py-24">
      <div className="w-8 h-8 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={isAdmin ? 'Panel de Control' : `Hola, ${user?.full_name?.split(' ')[0] || 'Cliente'}`}
        subtitle={company?.razon_social || 'Configura tu empresa en Ajustes'}
      >
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </PageHeader>

      {/* Avisos urgentes */}
      {(erroresCriticos.length > 0 || tareasVencidas.length > 0) && (
        <div className="mb-5 space-y-2">
          {erroresCriticos.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700">{erroresCriticos.length} error{erroresCriticos.length > 1 ? 'es' : ''} crítico{erroresCriticos.length > 1 ? 's' : ''} detectado{erroresCriticos.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-red-600">Requieren revisión inmediata</p>
              </div>
              <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" asChild>
                <a href="/errores">Ver errores</a>
              </Button>
            </div>
          )}
          {tareasVencidas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700">{tareasVencidas.length} tarea{tareasVencidas.length > 1 ? 's' : ''} vencida{tareasVencidas.length > 1 ? 's' : ''}</p>
              </div>
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100" asChild>
                <a href="/tareas">Ver tareas</a>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Notificaciones del asesor */}
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
        {/* Estado fiscal semáforo */}
        <div className="lg:col-span-2">
          <EstadoFiscal estado={estadoFiscal} />
        </div>
        {/* Health Score */}
        <HealthScore score={healthScore} />
      </div>

      {/* Tarjetas resumen clave */}
      <SummaryCards invoices={invoices} expenses={expenses} obligations={obligations} />

      {/* Stats grid anual */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Total Ingresos" value={totalIngresos} icon={TrendingUp} colorClass="text-green-600" bgClass="bg-green-50" />
        <StatCard title="Total Gastos" value={totalGastos} icon={TrendingDown} colorClass="text-red-600" bgClass="bg-red-50" />
        <StatCard title="Resultado" value={resultado} icon={Euro} colorClass={resultado >= 0 ? "text-green-600" : "text-destructive"} bgClass={resultado >= 0 ? "bg-green-50" : "bg-red-50"} />
        <StatCard title="IVA Estimado" value={ivaRepercutido - ivaSoportado} icon={BarChart3} colorClass="text-primary" bgClass="bg-accent" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Facturas Pendientes" value={facturasPendientes} icon={FileText} suffix="" colorClass="text-amber-600" bgClass="bg-amber-50" />
        <StatCard title="Obligaciones" value={obligacionesProximas} icon={Calendar} suffix="" colorClass="text-red-600" bgClass="bg-red-50" />
        <StatCard title="Tareas activas" value={tasks.filter(t => !['completada', 'cancelada'].includes(t.estado)).length} icon={CheckSquare} suffix="" colorClass="text-blue-600" bgClass="bg-blue-50" />
        <StatCard title="Errores activos" value={errors.filter(e => !['resuelto', 'ignorado'].includes(e.estado)).length} icon={AlertTriangle} suffix="" colorClass="text-orange-600" bgClass="bg-orange-50" />
      </div>

      {/* Gráfico flujo de caja */}
      <div className="mb-5">
        <CashFlowChart invoices={invoices} expenses={expenses} />
      </div>

      {/* No hay empresa configurada */}
      {!company && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-jakarta font-semibold text-foreground">Bienvenido a Taxea Portal</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Configura los datos de tu empresa para empezar</p>
          <Button className="bg-taxea-red hover:bg-taxea-accent text-white" asChild>
            <a href="/ajustes">Configurar empresa</a>
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Actividad reciente */}
        <div className="bg-card rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-jakarta font-semibold text-foreground text-sm">Últimos movimientos</h3>
            <a href="/libro-registros" className="text-xs text-primary hover:underline">Ver todo →</a>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Sin movimientos registrados</p>
                <Button size="sm" className="mt-3 bg-taxea-red hover:bg-taxea-accent text-white" asChild>
                  <a href="/lector-gastos">Subir primera factura</a>
                </Button>
              </div>
            ) : recentActivity.map((item, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.numero_factura || item.concepto || 'Movimiento'}</p>
                  <p className="text-xs text-muted-foreground">{item.cliente_nombre || item.proveedor_cliente || '—'} · {item.fecha_emision || item.fecha || ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{((item.total_factura || item.total) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
                  <StatusBadge status={item.estado_contable || item.estado} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Obligaciones + Tareas */}
        <div className="bg-card rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-jakarta font-semibold text-foreground text-sm">Obligaciones Fiscales</h3>
            <a href="/obligaciones" className="text-xs text-primary hover:underline">Ver todo →</a>
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
                  <p className="text-sm font-medium text-foreground capitalize">
                    {obl.modelo?.replace(/_/g, ' ').replace('modelo ', 'Mod. ') || 'Obligación'}
                  </p>
                  <p className="text-xs text-muted-foreground">{obl.periodo} · Límite: {obl.fecha_limite}</p>
                </div>
                <StatusBadge status={obl.estado} />
              </div>
            ))}
          </div>
          {/* Tareas pendientes */}
          {tasks.filter(t => t.estado === 'pendiente_cliente').length > 0 && (
            <div className="px-5 py-3 border-t border-border bg-amber-50/50">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-medium text-amber-700">
                  {tasks.filter(t => t.estado === 'pendiente_cliente').length} tarea{tasks.filter(t => t.estado === 'pendiente_cliente').length > 1 ? 's' : ''} pendiente{tasks.filter(t => t.estado === 'pendiente_cliente').length > 1 ? 's' : ''} de tu parte
                </p>
                <a href="/tareas" className="ml-auto text-xs text-amber-700 hover:underline font-medium">Ver →</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
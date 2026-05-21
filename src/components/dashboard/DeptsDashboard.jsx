import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Calculator, Wallet, Heart, AlertTriangle, Clock, FileText,
  CheckSquare, Calendar, ChevronRight, ArrowRight, RefreshCw,
  TrendingUp, Users, Shield, Activity, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRIORITY_COLORS = {
  urgente: 'bg-red-100 text-red-700 border-red-200',
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  revision: 'bg-blue-100 text-blue-700 border-blue-200',
  bloqueado: 'bg-orange-100 text-orange-700 border-orange-200',
  completado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const PERIOD_LABELS = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes', trimestre: 'Este trimestre' };
const STATUS_FILTERS = ['todo', 'urgente', 'pendiente', 'revision', 'completado'];

function KpiTile({ label, value, color = 'text-foreground', sub, icon: Icon }) {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
      {Icon && <Icon className={cn('w-4 h-4 flex-shrink-0', color)} />}
      <div>
        <p className={cn('text-xl font-bold leading-none', color)}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize', PRIORITY_COLORS[status] || 'bg-secondary text-muted-foreground border-border')}>
      {status}
    </span>
  );
}

function QuickLink({ to, label, icon: Icon }) {
  return (
    <Link to={to} className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
      <Icon className="w-3 h-3" />{label}
    </Link>
  );
}

function DeptCard({ icon: Icon, color, bgColor, borderColor, title, kpis, quickLinks, alerts = [], emptyMsg }) {
  return (
    <div className={cn('bg-card border rounded-xl overflow-hidden', borderColor)}>
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-3 border-b', bgColor, borderColor)}>
        <div className="flex items-center gap-2">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', bgColor)}>
            <Icon className={cn('w-4 h-4', color)} />
          </div>
          <p className={cn('font-jakarta font-bold text-sm', color)}>{title}</p>
        </div>
        {quickLinks[0] && (
          <Link to={quickLinks[0].to} className={cn('flex items-center gap-1 text-xs font-medium hover:underline', color)}>
            Ver detalle <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-px bg-border p-0">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-card px-4 py-3">
            <p className={cn('text-lg font-bold leading-none', kpi.urgent ? 'text-red-600' : kpi.warn ? 'text-amber-600' : 'text-foreground')}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 ? (
        <div className="divide-y divide-border/60">
          {alerts.slice(0, 3).map((a, i) => (
            <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
              <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', a.priority === 'urgente' ? 'bg-red-500' : a.priority === 'pendiente' ? 'bg-amber-400' : 'bg-blue-400')} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{a.title}</p>
                {a.sub && <p className="text-[11px] text-muted-foreground">{a.sub}</p>}
              </div>
              <StatusPill status={a.priority} />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">{emptyMsg || 'Sin alertas activas'}</p>
        </div>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 border-t border-border bg-secondary/20">
        {quickLinks.map((ql, i) => <QuickLink key={i} {...ql} />)}
      </div>
    </div>
  );
}

function CrossPriorityItem({ depts, priority, title, deadline, owner, action }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/60 last:border-0">
      <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', priority === 'urgente' ? 'bg-red-500' : priority === 'pendiente' ? 'bg-amber-400' : 'bg-blue-400')} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          {depts.map(d => <span key={d} className="text-[10px] bg-secondary/80 px-1.5 py-0.5 rounded font-medium">{d}</span>)}
          {deadline && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{deadline}</span>}
          {owner && <span className="text-[10px] text-muted-foreground">{owner}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <StatusPill status={priority} />
        {action && <p className="text-[10px] text-primary font-medium text-right max-w-[100px]">{action}</p>}
      </div>
    </div>
  );
}

export default function DeptsDashboard({ invoices = [], expenses = [], obligations = [], tasks = [], errors = [], company }) {
  const [period, setPeriod] = useState('mes');
  const [statusFilter, setStatusFilter] = useState('todo');
  const [hrData, setHrData] = useState({ employees: [], absences: [], documents: [] });
  const [loading, setLoading] = useState(false);
  const now = new Date();

  useEffect(() => {
    if (!company?.id) return;
    setLoading(true);
    Promise.all([
      base44.entities.Employee.filter({ company_id: company.id }, '-created_date', 10).catch(() => []),
      base44.entities.HRAbsence.filter({ company_id: company.id }, '-created_date', 10).catch(() => []),
      base44.entities.HRDocument.filter({ company_id: company.id }, '-created_date', 10).catch(() => []),
    ]).then(([employees, absences, documents]) => {
      setHrData({ employees: employees || [], absences: absences || [], documents: documents || [] });
      setLoading(false);
    });
  }, [company?.id]);

  // ── TAX KPIs ──
  const oblPending = obligations.filter(o => ['pendiente_documentacion', 'en_preparacion'].includes(o.estado));
  const oblUrgent = obligations.filter(o => {
    if (!o.fecha_limite) return false;
    const d = new Date(o.fecha_limite);
    const diff = (d - now) / 86400000;
    return diff >= 0 && diff <= 7;
  });
  const docsUnvalidated = invoices.filter(i => i.estado_contable === 'pendiente').length;
  const errActive = errors.filter(e => !['resuelto', 'ignorado'].includes(e.estado));
  const taxAlerts = [
    ...oblUrgent.map(o => ({ title: `${o.modelo?.replace(/_/g, ' ')} — vence ${o.fecha_limite}`, sub: o.periodo, priority: 'urgente' })),
    ...oblPending.slice(0, 2).map(o => ({ title: `${o.modelo?.replace(/_/g, ' ')} — pendiente documentación`, sub: o.periodo, priority: 'pendiente' })),
    ...errActive.slice(0, 2).map(e => ({ title: e.descripcion || 'Error fiscal detectado', sub: e.tipo || '', priority: e.severidad === 'critica' ? 'urgente' : 'pendiente' })),
  ];

  // ── FINANCE KPIs ──
  const invoicesPending = invoices.filter(i => i.tipo === 'emitida' && ['pendiente', 'enviada'].includes(i.estado_contable));
  const invoicesOverdue = invoices.filter(i => i.tipo === 'emitida' && i.fecha_vencimiento && new Date(i.fecha_vencimiento) < now && !['cobrada', 'anulada'].includes(i.estado_contable));
  const expensesPending = expenses.filter(e => e.estado === 'pendiente' || e.estado === 'revision');
  const finAlerts = [
    ...invoicesOverdue.slice(0, 2).map(i => ({ title: `Factura ${i.numero_factura || ''} — vencida`, sub: `${i.cliente_nombre || ''} · ${(i.total_factura || 0).toLocaleString('es-ES')}€`, priority: 'urgente' })),
    ...invoicesPending.slice(0, 2).map(i => ({ title: `${i.numero_factura || 'Factura'} — cobro pendiente`, sub: `${i.cliente_nombre || ''}`, priority: 'pendiente' })),
  ];

  // ── HR KPIs ──
  const absencesPending = hrData.absences.filter(a => a.estado === 'pendiente' || a.estado === 'solicitada');
  const docsPendingHR = hrData.documents.filter(d => d.estado === 'pendiente' || d.estado === 'revision');
  const hrAlerts = [
    ...absencesPending.slice(0, 2).map(a => ({ title: `Ausencia pendiente de aprobación`, sub: a.employee_name || '', priority: 'pendiente' })),
    ...docsPendingHR.slice(0, 2).map(d => ({ title: `Documento pendiente — ${d.tipo || d.nombre || 'RRHH'}`, sub: d.employee_name || '', priority: 'revision' })),
  ];

  // ── GLOBAL KPIs ──
  const tareasCriticas = tasks.filter(t => t.prioridad === 'critica' && !['completada', 'cancelada', 'finalizado'].includes(t.estado));
  const vencimientosProximos = oblUrgent.length + invoicesOverdue.length;
  const docsPendingTotal = docsUnvalidated + docsPendingHR.length;
  const incidenciasActivas = errActive.length + absencesPending.length;

  // ── CROSS PRIORITIES (static + dynamic) ──
  const crossItems = [
    ...(oblUrgent.length > 0 && invoicesOverdue.length > 0 ? [{ depts: ['Tax', 'Finance'], priority: 'urgente', title: `Vencimientos próximos requieren revisión documental y cobros`, deadline: 'Esta semana', action: 'Revisar docs' }] : []),
    ...(docsUnvalidated > 3 ? [{ depts: ['Tax', 'Finance'], priority: 'pendiente', title: `${docsUnvalidated} facturas sin validar contablemente`, deadline: 'Pendiente', action: 'Validar' }] : []),
    ...(docsPendingHR.length > 0 ? [{ depts: ['HR', 'Tax'], priority: 'revision', title: `Documentación laboral pendiente con impacto fiscal`, deadline: '', action: 'Ver HR docs' }] : []),
  ];

  // Static cross items if not enough real ones
  const staticCross = [
    { depts: ['Tax', 'Finance'], priority: 'pendiente', title: 'Cierre contable mensual — pendiente validación', deadline: 'Fin de mes', owner: 'Asesor', action: 'Ver cierres' },
    { depts: ['HR', 'Finance'], priority: 'revision', title: 'Nóminas mes en curso — en preparación', deadline: '30 de mes', owner: 'RRHH', action: 'Ver nóminas' },
    { depts: ['Tax', 'HR'], priority: 'pendiente', title: 'Contratos recientes con impacto fiscal pendiente', deadline: 'Esta semana', owner: 'Legal', action: 'Ver contratos' },
  ];
  const allCross = [...crossItems, ...staticCross].slice(0, 5);

  // ── RECENT ACTIVITY ──
  const recentActivity = [
    ...invoices.slice(-2).map(i => ({ title: `Factura ${i.numero_factura || ''}`, sub: i.cliente_nombre || '', date: i.updated_date || i.created_date, dept: 'Tax', type: 'factura' })),
    ...expenses.slice(-2).map(e => ({ title: e.concepto || 'Gasto', sub: e.proveedor_cliente || '', date: e.updated_date || e.created_date, dept: 'Finance', type: 'gasto' })),
    ...hrData.absences.slice(-1).map(a => ({ title: 'Ausencia registrada', sub: a.employee_name || '', date: a.created_date, dept: 'HR', type: 'ausencia' })),
  ].filter(a => a.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  const lastUpdated = now.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-jakarta font-bold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-muted-foreground" />Departamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vista general del estado operativo por área</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden bg-card">
            {Object.entries(PERIOD_LABELS).map(([k, l]) => (
              <button key={k} onClick={() => setPeriod(k)} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', period === k ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-secondary/60')}>{l}</button>
            ))}
          </div>
          <select className="h-8 rounded-lg border border-border bg-card px-3 text-xs text-muted-foreground focus:outline-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map(s => <option key={s} value={s} className="capitalize">{s === 'todo' ? 'Todos los estados' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <Link to="/tax-accounting/dashboard">
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs">Ver departamentos <ArrowRight className="w-3 h-3" /></Button>
          </Link>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <KpiTile label="Tareas críticas" value={tareasCriticas.length} color={tareasCriticas.length > 0 ? 'text-red-600' : 'text-emerald-600'} icon={AlertTriangle} />
        <KpiTile label="Vencimientos próximos" value={vencimientosProximos} color={vencimientosProximos > 0 ? 'text-amber-600' : 'text-emerald-600'} icon={Clock} />
        <KpiTile label="Docs pendientes" value={docsPendingTotal} color={docsPendingTotal > 0 ? 'text-amber-600' : 'text-foreground'} icon={FileText} />
        <KpiTile label="Incidencias activas" value={incidenciasActivas} color={incidenciasActivas > 0 ? 'text-orange-600' : 'text-foreground'} icon={Shield} />
        <KpiTile label="Carga operativa" value={`${tasks.filter(t => !['completada','cancelada','finalizado'].includes(t.estado)).length} tareas`} icon={Activity} />
        <KpiTile label="Actualizado" value={lastUpdated} color="text-muted-foreground" icon={RefreshCw} />
      </div>

      {/* Department Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tax & Accounting */}
        <DeptCard
          icon={Calculator}
          color="text-taxea-red"
          bgColor="bg-red-50/60"
          borderColor="border-red-100"
          title="Tax & Accounting"
          kpis={[
            { label: 'Obligaciones próximas', value: oblUrgent.length, urgent: oblUrgent.length > 0 },
            { label: 'Modelos pendientes', value: oblPending.length, warn: oblPending.length > 0 },
            { label: 'Docs sin validar', value: docsUnvalidated, warn: docsUnvalidated > 0 },
            { label: 'Incidencias activas', value: errActive.length, urgent: errActive.length > 0 },
          ]}
          alerts={taxAlerts}
          emptyMsg="Sin obligaciones urgentes ni incidencias activas"
          quickLinks={[
            { to: '/tax-accounting/obligaciones', label: 'Obligaciones', icon: Calendar },
            { to: '/tax-accounting/facturas', label: 'Cierres', icon: FileText },
            { to: '/tax-accounting/lector-gastos', label: 'Documentación', icon: FileText },
            { to: '/errores', label: 'Incidencias', icon: AlertTriangle },
          ]}
        />

        {/* Finance */}
        <DeptCard
          icon={Wallet}
          color="text-emerald-700"
          bgColor="bg-emerald-50/60"
          borderColor="border-emerald-100"
          title="Finance"
          kpis={[
            { label: 'Cobros pendientes', value: invoicesPending.length, warn: invoicesPending.length > 0 },
            { label: 'Cobros vencidos', value: invoicesOverdue.length, urgent: invoicesOverdue.length > 0 },
            { label: 'Gastos en revisión', value: expensesPending.length, warn: expensesPending.length > 0 },
            { label: 'Conciliaciones abiertas', value: '—', },
          ]}
          alerts={finAlerts}
          emptyMsg="Sin alertas financieras activas"
          quickLinks={[
            { to: '/finance/treasury', label: 'Tesorería', icon: TrendingUp },
            { to: '/finance/ar', label: 'Cobros', icon: TrendingUp },
            { to: '/finance/ap', label: 'Pagos', icon: Wallet },
            { to: '/finance/cashflow', label: 'Conciliaciones', icon: Activity },
          ]}
        />

        {/* People & HR */}
        <DeptCard
          icon={Heart}
          color="text-rose-700"
          bgColor="bg-rose-50/60"
          borderColor="border-rose-100"
          title="People & HR"
          kpis={[
            { label: 'Empleados activos', value: hrData.employees.filter(e => e.estado === 'activo' || !e.estado).length || '—' },
            { label: 'Ausencias pendientes', value: absencesPending.length, warn: absencesPending.length > 0 },
            { label: 'Docs laborales pend.', value: docsPendingHR.length, warn: docsPendingHR.length > 0 },
            { label: 'Incidencias HR', value: hrAlerts.length, urgent: hrAlerts.length > 2 },
          ]}
          alerts={hrAlerts}
          emptyMsg="Sin incidencias de personal activas"
          quickLinks={[
            { to: '/people/employees', label: 'Personas', icon: Users },
            { to: '/people/documents', label: 'Documentación', icon: FileText },
            { to: '/people/absences', label: 'Ausencias', icon: Calendar },
            { to: '/people/onboarding', label: 'Incidencias', icon: AlertTriangle },
          ]}
        />
      </div>

      {/* Cross-dept priorities + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Cross priorities */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/20">
            <h3 className="text-sm font-jakarta font-semibold flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-muted-foreground" />Prioridades interdepartamentales</h3>
            <span className="text-[10px] text-muted-foreground">{allCross.length} items</span>
          </div>
          <div className="px-4 pt-1 pb-2">
            {allCross.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Sin prioridades cruzadas activas</p>
            ) : allCross.map((item, i) => <CrossPriorityItem key={i} {...item} />)}
          </div>
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/20">
            <h3 className="text-sm font-jakarta font-semibold flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-muted-foreground" />Actividad reciente</h3>
          </div>
          <div className="divide-y divide-border/60">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center px-4">Sin actividad reciente registrada</p>
            ) : recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', item.dept === 'Tax' ? 'bg-red-400' : item.dept === 'Finance' ? 'bg-emerald-400' : 'bg-rose-400')} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">{item.sub}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-medium text-muted-foreground">{item.dept}</span>
                  {item.date && <span className="text-[10px] text-muted-foreground/60">{new Date(item.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
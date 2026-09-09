import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Bell,
  Calendar, Calculator, CheckCircle, ChevronRight, Clock, Database,
  Euro, FileText, Heart, Landmark, RefreshCw, TrendingDown, TrendingUp,
  Upload, Users, Wallet,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EstadoFiscal from '@/components/EstadoFiscal';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { computeBusinessHealth } from '@/lib/businessHealthScore';

const currentYear = new Date().getFullYear();
const DEFAULT_YEARS = [currentYear, currentYear - 1, currentYear - 2];
const CLOSED_FISCAL = new Set(['presentado', 'pagado', 'completado', 'cerrado', 'no_aplica']);
const LIVE_ENTITIES = [
  'Invoice', 'InvoicePayment', 'Expense', 'JournalEntry', 'JournalEntryLine',
  'BankAccount', 'BankTransaction', 'TaxModel', 'TaxObligation', 'TaxPeriod',
  'TaxFiling', 'Document', 'Employee', 'HRAbsence', 'HRDocument',
  'LaborOcrDocument', 'PayrollExtraction', 'SocialSecurityExtraction',
  'Task', 'FiscalError', 'Notification',
];

const TAX_TOOLS = [
  { label: 'Contabilidad', to: '/tax-accounting/contabilidad', icon: Calculator },
  { label: 'Obligaciones', to: '/tax-accounting/obligaciones', icon: Calendar },
  { label: 'Facturas', to: '/tax-accounting/facturas', icon: FileText },
  { label: 'Ingresos y gastos', to: '/tax-accounting/ingresos-gastos', icon: BarChart3 },
];
const FIN_TOOLS = [
  { label: 'Tesorería', to: '/finance/treasury', icon: Landmark },
  { label: 'Cobros', to: '/finance/ar', icon: TrendingUp },
  { label: 'Pagos', to: '/finance/ap', icon: TrendingDown },
  { label: 'Centro de tesorería', to: '/finance/cashflow', icon: Activity },
];
const HR_TOOLS = [
  { label: 'Empleados', to: '/people/employees', icon: Users },
  { label: 'Ausencias', to: '/people/absences', icon: Calendar },
  { label: 'Documentos', to: '/people/documents', icon: FileText },
  { label: 'Nóminas', to: '/people/payroll', icon: Euro },
];

const currency = (value) => Number(value || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const shortDate = (value) => value ? new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'Sin fecha';
const timeOnly = (value) => value ? new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—';
const fiscalOpen = (item) => !CLOSED_FISCAL.has(String(item?.state || '').toLowerCase());

function KpiBlock({ label, value, sub, alert, warn }) {
  return (
    <div className="bg-card px-5 py-4 min-w-0">
      <p className={cn('text-xl font-bold leading-tight truncate', alert ? 'text-red-600' : warn ? 'text-amber-600' : 'text-foreground')} title={String(value)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate" title={sub}>{sub}</p>}
    </div>
  );
}

function DeptCard({ color, bgLight, border, icon: DeptIcon, title, to, kpis, tools }) {
  return (
    <section className={cn('bg-card rounded-xl border overflow-hidden flex flex-col', border)}>
      <div className={cn('flex items-center justify-between px-5 py-3.5 border-b', bgLight, border)}>
        <div className="flex items-center gap-2.5"><DeptIcon className={cn('w-4 h-4', color)} /><h2 className={cn('font-jakarta font-bold text-sm', color)}>{title}</h2></div>
        <Link to={to} className={cn('flex items-center gap-0.5 text-xs font-medium hover:underline', color)}>Ver todo <ChevronRight className="w-3.5 h-3.5" /></Link>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border flex-1">{kpis.map((kpi) => <KpiBlock key={kpi.label} {...kpi} />)}</div>
      <div className="px-5 py-3 border-t border-border bg-secondary/30 flex flex-wrap gap-x-4 gap-y-1.5">
        {tools.map(({ label, to: toolTo, icon: ToolIcon }) => <Link key={label} to={toolTo} className="text-xs text-primary hover:underline font-medium flex items-center gap-1"><ToolIcon className="w-3 h-3" />{label}</Link>)}
      </div>
    </section>
  );
}

function ScoreRing({ score }) {
  const hasScore = Number.isFinite(score);
  const safeScore = hasScore ? score : 0;
  const color = !hasScore ? '#94a3b8' : safeScore >= 80 ? '#16a34a' : safeScore >= 55 ? '#d97706' : '#dc2626';
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="flex-shrink-0" aria-label={hasScore ? `Health Score ${score} sobre 100` : 'Health Score sin datos'}>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${(safeScore / 100) * circumference} ${circumference}`} strokeDashoffset={circumference / 4} strokeLinecap="round" className="transition-all duration-500" />
      <text x="50" y="47" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>{hasScore ? score : '—'}</text>
      <text x="50" y="61" textAnchor="middle" fontSize="10" fill="#9ca3af">{hasScore ? '/ 100' : 'sin datos'}</text>
    </svg>
  );
}

function HealthDimensions({ health }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3">
      {health.dimensions.map((dimension) => (
        <div key={dimension.key} className="rounded-lg border border-border bg-background/60 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground truncate">{dimension.label}</span>
            <span className={cn('text-xs font-bold', dimension.score === null ? 'text-muted-foreground' : dimension.score >= 80 ? 'text-emerald-600' : dimension.score >= 55 ? 'text-amber-600' : 'text-red-600')}>{dimension.score ?? 'N/D'}</span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden"><div className={cn('h-full rounded-full', dimension.score === null ? 'bg-slate-300' : dimension.score >= 80 ? 'bg-emerald-500' : dimension.score >= 55 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${dimension.score ?? 8}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function SourcePulse({ label, value, ok = true }) {
  return <div className="flex items-center justify-between gap-3 py-2"><span className="text-xs text-muted-foreground">{label}</span><span className={cn('text-[11px] font-medium text-right', ok ? 'text-foreground' : 'text-amber-600')}>{value || 'Sin datos'}</span></div>;
}

export default function Dashboard() {
  const { user, company, isAdmin, loadingCompany } = useOutletContext() || {};
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [summary, setSummary] = useState(null);
  const [fiscal, setFiscal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const refreshTimer = useRef(null);

  const loadDashboard = useCallback(async ({ quiet = false } = {}) => {
    if (!company?.id) return;
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const [businessResponse, fiscalResponse] = await Promise.all([
        base44.functions.invoke('businessDashboardOperations', { action: 'summary', companyId: company.id, year: Number(selectedYear) }),
        base44.functions.invoke('fiscalCalendarOperations', { action: 'bundle', companyId: company.id, fiscalYear: Number(selectedYear) }),
      ]);
      const businessData = businessResponse?.data || businessResponse;
      const fiscalData = fiscalResponse?.data || fiscalResponse;
      if (businessData?.error) throw new Error(businessData.error);
      if (fiscalData?.error) throw new Error(fiscalData.error);
      setSummary(businessData);
      setFiscal(fiscalData);
      setError('');
    } catch (loadError) {
      console.error('[Dashboard] live load failed', loadError);
      setError(loadError?.message || 'No se han podido actualizar todos los indicadores.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [company?.id, selectedYear]);

  const scheduleRefresh = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => loadDashboard({ quiet: true }), 600);
  }, [loadDashboard]);

  useEffect(() => {
    if (company?.id) loadDashboard();
    else if (!loadingCompany) setLoading(false);
  }, [company?.id, loadingCompany, loadDashboard]);

  useEffect(() => {
    if (!company?.id) return undefined;
    const interval = window.setInterval(() => loadDashboard({ quiet: true }), 60000);
    const onFocus = () => loadDashboard({ quiet: true });
    window.addEventListener('focus', onFocus);
    const unsubscribers = LIVE_ENTITIES.map((name) => {
      try { return base44.entities[name]?.subscribe?.(scheduleRefresh); }
      catch { return null; }
    }).filter(Boolean);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(refreshTimer.current);
      window.removeEventListener('focus', onFocus);
      unsubscribers.forEach((unsubscribe) => { try { unsubscribe(); } catch { /* noop */ } });
    };
  }, [company?.id, loadDashboard, scheduleRefresh]);

  const derived = useMemo(() => {
    const items = fiscal?.items || [];
    const today = new Date().toISOString().slice(0, 10);
    const openObligations = items.filter(fiscalOpen);
    const overdueObligations = openObligations.filter((item) => item.filingDeadline && item.filingDeadline < today);
    const urgentObligations = openObligations.filter((item) => item.filingDeadline && item.filingDeadline >= today && (new Date(item.filingDeadline) - new Date(today)) / 86400000 <= 15);
    const health = computeBusinessHealth(summary, fiscal);
    const fiscalStatus = overdueObligations.length || summary?.operations?.criticalErrors ? 'rojo' : urgentObligations.length || !fiscal?.profile || fiscal?.unlinkedDocuments?.length ? 'amarillo' : items.length ? 'verde' : 'gris';
    const years = [...new Set([...(summary?.accounting?.report?.years || []), ...DEFAULT_YEARS, Number(selectedYear)])].sort((a, b) => b - a);
    return { items, openObligations, overdueObligations, urgentObligations, health, fiscalStatus, years };
  }, [summary, fiscal, selectedYear]);

  if (loading || loadingCompany) return <DashboardSkeleton />;
  if (!company) return (
    <div className="animate-fade-in max-w-xl mx-auto mt-16 text-center">
      <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><Upload className="w-7 h-7 text-primary" /></div>
      <h2 className="text-lg font-jakarta font-bold mb-2">Configura tu empresa</h2>
      <p className="text-sm text-muted-foreground mb-6">Necesitas configurar los datos de tu empresa para activar el portal y sus indicadores.</p>
      <Button asChild><Link to="/ajustes">Configurar empresa</Link></Button>
    </div>
  );

  const accounting = summary?.accounting || {};
  const pnl = accounting.pnl || {};
  const quality = accounting.quality || {};
  const finance = summary?.finance || {};
  const receivables = finance.receivables || {};
  const payables = finance.payables || {};
  const treasury = summary?.treasury || {};
  const people = summary?.people || {};
  const operations = summary?.operations || {};
  const documents = summary?.documents || {};
  const notifications = operations.unreadNotifications || [];

  return (
    <main className="taxea-command-center animate-fade-in space-y-5">
      <header className="taxea-command-hero">
        <div className="relative z-10 min-w-0">
          <p className="taxea-command-kicker"><span />Taxea Business OS · datos reales</p>
          <h1>{isAdmin ? company?.razon_social || 'Dashboard' : `Hola, ${user?.full_name?.split(' ')[0] || 'Cliente'}`}</h1>
          <p className="mt-2 text-sm">{company?.razon_social} · ejercicio {selectedYear}</p>
        </div>
        <div className="taxea-hero-controls relative z-10 flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background/80 border border-border rounded-lg px-2.5 h-9"><Database className="w-3.5 h-3.5 text-emerald-500" />Actualizado {timeOnly(summary?.generatedAt)}</div>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => loadDashboard({ quiet: true })} disabled={refreshing} aria-label="Actualizar dashboard"><RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} /><span className="hidden sm:inline ml-1.5">Actualizar</span></Button>
          <Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger className="w-24 h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{derived.years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select>
        </div>
      </header>

      {error && <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /><div className="flex-1"><p className="font-semibold">Actualización incompleta</p><p className="text-xs mt-0.5">{error} Se mantiene la última información disponible.</p></div><Button variant="outline" size="sm" onClick={() => loadDashboard({ quiet: true })}>Reintentar</Button></div>}

      {(operations.criticalErrors > 0 || operations.overdueTasks > 0 || derived.overdueObligations.length > 0 || derived.urgentObligations.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {operations.criticalErrors > 0 && <Link to="/errores" className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg"><AlertTriangle className="w-3.5 h-3.5" />{operations.criticalErrors} incidencia(s) crítica(s)</Link>}
          {operations.overdueTasks > 0 && <Link to="/tareas" className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-lg"><Clock className="w-3.5 h-3.5" />{operations.overdueTasks} tarea(s) vencida(s)</Link>}
          {derived.overdueObligations.length > 0 && <Link to="/tax-accounting/obligaciones" className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg"><Calendar className="w-3.5 h-3.5" />{derived.overdueObligations.length} obligación(es) vencida(s)</Link>}
          {derived.urgentObligations.length > 0 && <Link to="/tax-accounting/obligaciones" className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold px-3 py-1.5 rounded-lg"><Calendar className="w-3.5 h-3.5" />{derived.urgentObligations.length} vencimiento(s) en 15 días</Link>}
        </div>
      )}

      {notifications.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{notifications.slice(0, 2).map((notification) => <div key={notification.id} className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3"><Bell className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /><div><p className="text-sm font-semibold">{notification.titulo}</p><p className="text-xs text-muted-foreground">{notification.mensaje}</p></div></div>)}</div>}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl px-5 py-4 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-4"><ScoreRing score={derived.health.score} /><div className="min-w-0"><p className="text-sm font-jakarta font-bold">Health Score real</p><p className="text-xs text-muted-foreground mt-0.5">Cobertura {derived.health.coverage}% de áreas aplicables</p>{derived.health.reasons[0] && <p className="text-[11px] text-amber-600 mt-1 font-medium leading-snug">{derived.health.reasons[0]}</p>}</div></div>
          <HealthDimensions health={derived.health} />
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4"><p className="text-2xl font-bold text-emerald-600">{currency(pnl.income)}</p><p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Ingresos contables confirmados</p><p className="text-[10px] text-muted-foreground/70 mt-0.5">Solo asientos cuadrados · {selectedYear}</p></div>
        <div className="bg-card border border-border rounded-xl px-5 py-4"><p className={cn('text-2xl font-bold', pnl.result >= 0 ? 'text-primary' : 'text-red-600')}>{currency(pnl.result)}</p><p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Euro className="w-3 h-3" />Resultado contable confirmado</p><p className={cn('text-[10px] font-medium mt-0.5', pnl.margin === null ? 'text-muted-foreground' : pnl.margin >= 0 ? 'text-emerald-600' : 'text-red-600')}>Margen {pnl.margin === null ? 'N/D' : `${pnl.margin}%`}</p></div>
        <div className="bg-card border border-border rounded-xl px-5 py-4"><p className={cn('text-2xl font-bold', derived.overdueObligations.length ? 'text-red-600' : 'text-foreground')}>{derived.openObligations.length}</p><p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" />Obligaciones pendientes {selectedYear}</p><p className="text-[10px] text-muted-foreground/70 mt-0.5">{derived.overdueObligations.length} vencidas · {derived.urgentObligations.length} próximas</p></div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border"><div><h2 className="text-sm font-jakarta font-semibold">Ingresos y gastos contables · {selectedYear}</h2><p className="text-[10px] text-muted-foreground mt-0.5">Asientos confirmados, cuadrados y clasificados por cuentas 7/6</p></div><Link to="/tax-accounting/contabilidad" className="text-xs text-primary hover:underline flex items-center gap-1">Ver contabilidad <ArrowRight className="w-3 h-3" /></Link></div>
          <div className="px-4 py-4">
            {(accounting.monthly || []).some((row) => row.ingresos || row.gastos) ? <ResponsiveContainer width="100%" height={205}><BarChart data={accounting.monthly} barSize={10} barGap={2}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : value} /><Tooltip formatter={(value) => currency(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} /><Bar dataKey="ingresos" fill="#16a34a" radius={[3, 3, 0, 0]} name="Ingresos" /><Bar dataKey="gastos" fill="#dc2626" radius={[3, 3, 0, 0]} name="Gastos" opacity={0.72} /></BarChart></ResponsiveContainer> : <div className="h-[205px] flex items-center justify-center text-center"><div><BarChart3 className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" /><p className="text-xs text-muted-foreground">No hay asientos confirmados con cuentas 6/7 en {selectedYear}</p></div></div>}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <EstadoFiscal estado={derived.fiscalStatus} />
          <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Indicadores clave reales</h2>
            {[
              { label: 'Tesorería disponible EUR', value: currency(treasury.cashEur), warn: !treasury.connectedAccounts },
              { label: 'Pendiente de cobro', value: currency(receivables.outstanding), warn: receivables.overdue > 0 },
              { label: 'Pendiente de pago', value: currency(payables.outstanding), warn: payables.overdue > 0 },
              { label: 'Conciliación bancaria', value: treasury.reconciliationRate === null || treasury.reconciliationRate === undefined ? 'N/D' : `${treasury.reconciliationRate}%`, warn: treasury.unreconciled > 0 },
              { label: 'Facturas sin asiento válido', value: quality.pendingInvoicePostings || 0, warn: quality.pendingInvoicePostings > 0 },
              { label: 'Revisión laboral pendiente', value: people.laborDocumentsReview || 0, warn: people.laborDocumentsReview > 0 },
            ].map((indicator) => <div key={indicator.label} className="flex items-center justify-between gap-3 border-b border-border/60 last:border-0 pb-2 last:pb-0"><span className="text-xs text-foreground">{indicator.label}</span><span className={cn('text-xs font-bold text-right', indicator.warn ? 'text-amber-600' : 'text-emerald-600')}>{indicator.value}</span></div>)}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DeptCard icon={Calculator} color="text-taxea-red" bgLight="bg-red-50/60" border="border-red-100" title="Tax & Accounting" to="/tax-accounting/dashboard" kpis={[
          { label: 'Asientos confirmados', value: quality.confirmedEntries || 0, sub: `${accounting.report?.excludedEntries || 0} excluidos del informe` },
          { label: 'Facturas sin asiento válido', value: quality.pendingInvoicePostings || 0, alert: quality.pendingInvoicePostings > 0 },
          { label: 'Obligaciones abiertas', value: derived.openObligations.length, warn: derived.urgentObligations.length > 0 },
          { label: 'Incidencias contables/fiscales', value: operations.openErrors || 0, alert: operations.criticalErrors > 0 },
        ]} tools={TAX_TOOLS} />
        <DeptCard icon={Wallet} color="text-emerald-700" bgLight="bg-emerald-50/60" border="border-emerald-100" title="Finance" to="/finance/dashboard" kpis={[
          { label: 'Saldo disponible EUR', value: currency(treasury.cashEur), sub: `${treasury.connectedAccounts || 0} cuenta(s) conectada(s)` },
          { label: 'Sin conciliar', value: treasury.unreconciled || 0, warn: treasury.unreconciled > 0, sub: treasury.reconciliationRate === null ? 'Sin movimientos' : `${treasury.reconciliationRate}% conciliado` },
          { label: 'Cobros vencidos', value: currency(receivables.overdueAmount), alert: receivables.overdue > 0, sub: `${receivables.overdue || 0} factura(s)` },
          { label: 'Pagos vencidos', value: currency(payables.overdueAmount), alert: payables.overdue > 0, sub: `${payables.overdue || 0} factura(s)` },
        ]} tools={FIN_TOOLS} />
        <DeptCard icon={Heart} color="text-rose-700" bgLight="bg-rose-50/60" border="border-rose-100" title="People & HR" to="/people/dashboard" kpis={[
          { label: 'Empleados activos', value: people.activeEmployees || 0, sub: `${people.employees || 0} total plantilla` },
          { label: 'Ausencias actuales', value: people.currentAbsences || 0, sub: `${people.pendingAbsences || 0} pendientes` },
          { label: 'Docs pendientes de firma', value: people.pendingSignature || 0, warn: people.pendingSignature > 0, sub: `${people.expiredDocuments || 0} expirados` },
          { label: 'Extracciones a revisar', value: people.laborDocumentsReview || 0, warn: people.laborDocumentsReview > 0, sub: `${people.payrollWarnings || 0} advertencias` },
        ]} tools={HR_TOOLS} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border"><h2 className="text-sm font-jakarta font-semibold flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />Próximas obligaciones</h2><Link to="/tax-accounting/obligaciones" className="text-xs text-primary hover:underline">Ver calendario</Link></div>
          <div className="divide-y divide-border/60">
            {derived.items.length === 0 ? <EmptyState icon={CheckCircle} text={fiscal?.profile ? 'Sin obligaciones para este ejercicio' : 'Configura el perfil fiscal para generar el calendario'} /> : derived.items.filter(fiscalOpen).slice(0, 5).map((item) => <div key={item.calendarKey || item.key} className="px-5 py-2.5 flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium truncate">Modelo {item.code} · {item.name}</p><p className="text-[11px] text-muted-foreground">{item.period} · Presentación {shortDate(item.filingDeadline)}{item.domicileDeadline ? ` · Domiciliación ${shortDate(item.domicileDeadline)}` : ''}</p></div><StatusBadge status={item.state || 'pendiente_documentacion'} /></div>)}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border"><h2 className="text-sm font-jakarta font-semibold flex items-center gap-2"><Users className="w-3.5 h-3.5 text-muted-foreground" />Equipo en tiempo real</h2><Link to="/people/employees" className="text-xs text-primary hover:underline">Ver todos</Link></div>
          <div className="divide-y divide-border/60">{!people.team?.length ? <EmptyState icon={Users} text="Sin empleados activos registrados" /> : people.team.slice(0, 5).map((employee) => <div key={employee.id} className="px-5 py-2.5 flex items-center gap-3"><div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0"><span className="text-[11px] font-bold text-rose-700">{employee.name.charAt(0).toUpperCase()}</span></div><div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{employee.name}</p><p className="text-[11px] text-muted-foreground truncate">{employee.department || 'Sin departamento informado'}</p></div><span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">Activo</span></div>)}</div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border"><h2 className="text-sm font-jakarta font-semibold flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-muted-foreground" />Actividad reciente</h2><span className="text-[10px] text-muted-foreground">Multidepartamento</span></div>
          <div className="divide-y divide-border/60">{!summary?.activity?.length ? <EmptyState icon={Activity} text="Sin actividad reciente" /> : summary.activity.slice(0, 6).map((event) => <Link key={event.id} to={event.route || '/'} className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-secondary/40"><div className="flex items-center gap-2.5 min-w-0"><span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', event.type === 'bank' ? 'bg-blue-500' : event.type === 'entry' ? 'bg-violet-500' : event.type === 'labor' ? 'bg-rose-500' : event.type === 'expense' ? 'bg-red-400' : 'bg-emerald-500')} /><div className="min-w-0"><p className="text-xs font-medium truncate">{event.title}</p><p className="text-[11px] text-muted-foreground truncate">{event.detail || shortDate(event.date)}</p></div></div><div className="text-right flex-shrink-0">{Number.isFinite(event.amount) && event.amount !== 0 && <p className={cn('text-xs font-semibold', event.amount < 0 ? 'text-red-600' : 'text-foreground')}>{currency(event.amount)}</p>}<p className="text-[10px] text-muted-foreground">{shortDate(event.date)}</p></div></Link>)}</div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border"><div><h2 className="text-sm font-jakarta font-semibold flex items-center gap-2"><Database className="w-3.5 h-3.5 text-muted-foreground" />Fuentes y frescura del dashboard</h2><p className="text-[10px] text-muted-foreground mt-0.5">Ninguna cifra se estima desde tarjetas estáticas</p></div><span className="text-[10px] text-muted-foreground">Generado {summary?.generatedAt ? new Date(summary.generatedAt).toLocaleString('es-ES') : '—'}</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 px-5 divide-y sm:divide-y-0">
          <SourcePulse label="Contabilidad" value={accounting.freshness || shortDate(summary?.freshness?.accounting)} ok={quality.unbalancedEntries === 0} />
          <SourcePulse label="Facturación" value={shortDate(summary?.freshness?.invoices)} ok={quality.pendingInvoicePostings === 0} />
          <SourcePulse label="Banca" value={treasury.lastSync ? new Date(treasury.lastSync).toLocaleString('es-ES') : 'Sin sincronización'} ok={treasury.connectedAccounts > 0 && !treasury.stale} />
          <SourcePulse label="Fiscalidad" value={fiscal?.profile ? `${fiscal.models?.length || 0} modelos activos` : 'Perfil sin validar'} ok={Boolean(fiscal?.profile)} />
          <SourcePulse label="Laboral y documentos" value={shortDate(summary?.freshness?.labor || summary?.freshness?.documents)} ok={(people.laborDocumentsReview || 0) + (documents.rejected || 0) === 0} />
        </div>
      </section>
    </main>
  );
}

function EmptyState({ icon: Icon, text }) {
  return <div className="px-5 py-8 text-center"><Icon className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" /><p className="text-xs text-muted-foreground">{text}</p></div>;
}

function DashboardSkeleton() {
  return <div className="space-y-5 animate-pulse"><div className="h-28 bg-muted rounded-2xl" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 bg-muted rounded-xl" />)}</div><div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><div className="lg:col-span-2 h-72 bg-muted rounded-xl" /><div className="h-72 bg-muted rounded-xl" /></div><div className="grid grid-cols-1 lg:grid-cols-3 gap-4">{[0, 1, 2].map((item) => <div key={item} className="h-52 bg-muted rounded-xl" />)}</div></div>;
}


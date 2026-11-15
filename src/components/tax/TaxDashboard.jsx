import { useState, useEffect, useMemo } from 'react';
import { useOutletContext,Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown,
  FileText, Calendar, AlertTriangle, CheckCircle2, Clock,
  Zap, ScanLine, ScanText, BookOpen, Plus, ChevronRight,
  Activity, BarChart3, Brain, Sparkles, CircleDollarSign,
  Receipt, AlertCircle, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NativeSelect from '@/components/ui/NativeSelect';
import CashflowChart from '@/components/finance/CashflowChart';
import { useFinancePeriod, useFinanceObligations } from '@/hooks/useFinanceReporting';
import { buildFinanceDashboardModel, confirmEmptyReportingPeriod } from '@/lib/financeDashboardModel.mjs';
import { classifyObligations, obligationOpen, daysBetween, civilDay } from '@/lib/reportingPeriods.mjs';
import NoCompanyState from '@/components/ui/NoCompanyState';
import GastosPorCategoria from './GastosPorCategoria';
import { calculateFinancialKPIs, getOutstandingAmount } from '@/lib/financialCore';
import { useFinancialData } from '@/hooks/useFinancialData';

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const formatPeriodDate = day => day.split('-').reverse().join('/');
const fiscalInvoiceDate = invoice => invoice.fiscal_document_type === 'F2' && invoice.fecha_operacion
  ? invoice.fecha_operacion
  : invoice.fecha_emision;

export default function TaxDashboard({ onNavigate }) {
  const { company, loadingCompany } = useOutletContext() || {};
  const [selectedPeriod, setSelectedPeriod] = useState('mtd');
  const timeZone = company?.timezone === 'Atlantic/Canary' ? 'Atlantic/Canary' : 'Europe/Madrid';
  const today = civilDay(new Date(), timeZone);
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const currentQuarter = Math.ceil(currentMonth / 3);
  const monthOptions = MONTHS_ES.slice(0, currentMonth).map((month, index) => {
    const monthNumber = index + 1;
    return {
      value: monthNumber === currentMonth ? 'mtd' : currentYear + '-' + String(monthNumber).padStart(2, '0'),
      label: month + ' ' + currentYear + (monthNumber === currentMonth ? ' · en curso' : ''),
    };
  }).reverse();
  const quarterOptions = Array.from({ length: currentQuarter }, (_, index) => {
    const quarter = currentQuarter - index;
    return {
      value: currentYear + '-T' + quarter,
      label: quarter + '.º trimestre ' + currentYear + (quarter === currentQuarter ? ' · en curso' : ''),
    };
  });
  const period = selectedPeriod === 'ytd' || [...monthOptions, ...quarterOptions].some(option => option.value === selectedPeriod)
    ? selectedPeriod
    : 'mtd';
  const financialData = useFinancialData(company?.id);
  const { invoices, expenses, treasury, loading: finLoading } = financialData;
  const calendar = useFinanceObligations(company?.id);
  const accounting = useFinancePeriod(company?.id, period);
  const obligations = calendar.data?.rows || [];
  const financials = useMemo(() => {
    const model = buildFinanceDashboardModel({
      ...financialData, obligations, accountingPeriod: accounting.data, period, timeZone,
      invoiceDate: fiscalInvoiceDate, financialError: financialData.error,
      accountingError: accounting.isError ? 'PyG del periodo no disponible' : '',
    });
    const hasHistory = accounting.data?.monthly?.some(row => row.includedEntries > 0)
      || accounting.data?.previous?.includedEntries > 0;
    return confirmEmptyReportingPeriod(model, accounting.data?.current, hasHistory, accounting.isSuccess);
  }, [financialData.invoices, financialData.expenses, financialData.bankAccounts, financialData.bankTransactions, financialData.error,
    financialData.treasuryError, accounting.data, accounting.isError, accounting.isSuccess, calendar.data, period, timeZone, today]);
  const [quoteScope, setQuoteScope] = useState({companyId:null,rows:[]});
  const quotes = quoteScope.companyId === company?.id ? quoteScope.rows : [];
  const [loading, setLoading] = useState(true);
  const fiscalProfile = calendar.data?.profile || null;
  const [supportError, setSupportError] = useState('');
  const [aiAlerts, setAiAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  useEffect(() => {
    let active = true; setQuoteScope({companyId:company?.id || null,rows:[]}); setAiAlerts([]); setSupportError('');
    if (!company?.id) { setLoading(false); return; }
    setLoading(true);
    base44.entities.Quote.filter({company_id:company.id}).then(rows => { if(active)setQuoteScope({companyId:company.id,rows:rows || []}); }).catch(() => { if(active)setSupportError('No se pudieron leer los presupuestos.'); }).finally(() => { if(active)setLoading(false); });
    return () => { active = false; };
  }, [company?.id]);
  useEffect(() => { setAiAlerts([]); }, [company?.id, financialData.lastSync, calendar.data, period]);

  const generateAiAlerts = async () => {
    if (loadingAlerts || aiAlerts.length > 0) return;
    setLoadingAlerts(true);
    const dates = classifyObligations(obligations, {horizon:15});
    const oblVencidas = dates.overdue;
    const factVencidas = financials.vencidas;
    const gastosSinCat = expenses.filter(e => !e.categoria);
    const factSinContabilizar = invoices.filter(i => i.estado_contable === 'pendiente');

    const staticAlerts = [];
    if (oblVencidas.length > 0) staticAlerts.push({ tipo: 'rojo', texto: `${oblVencidas.length} obligación(es) fiscal(es) vencida(s) sin presentar.`, accion: 'obligaciones' });
    if (factVencidas.length > 0) staticAlerts.push({ tipo: 'rojo', texto: `${factVencidas.length} factura(s) vencidas pendientes de cobro.`, accion: 'facturas' });
    if (gastosSinCat.length > 0) staticAlerts.push({ tipo: 'amarillo', texto: `${gastosSinCat.length} gasto(s) sin categoría contable asignada.`, accion: 'ingresos-gastos' });
    if (factSinContabilizar.length > 5) staticAlerts.push({ tipo: 'amarillo', texto: `${factSinContabilizar.length} facturas pendientes de contabilizar.`, accion: 'facturas' });

    const proxObl = dates.upcoming[0];
    if(proxObl)staticAlerts.push({tipo:'amarillo',texto:'Próximo vencimiento: modelo '+proxObl.modelo+' en '+daysBetween(dates.today,proxObl.fecha_limite)+' días.',accion:'obligaciones'});
    if(dates.undated.length)staticAlerts.push({tipo:'amarillo',texto:'Hay obligaciones sin fecha verificable.',accion:'obligaciones'});
    if(calendar.isError || financialData.error || accounting.isError)staticAlerts.push({tipo:'amarillo',texto:'No se han podido actualizar todas las fuentes. Revisa la cobertura.',accion:null});
    if(fiscalProfile?.profileStatus!=='validado_asesor' || !calendar.data?.configuredModels)staticAlerts.push({tipo:'amarillo',texto:'Falta validar el perfil fiscal o sus modelos con el asesor.',accion:null});
    if(staticAlerts.length===0)staticAlerts.push({tipo:'verde',texto:'Sin alertas de estas reglas en los datos registrados. No sustituye la revisión del asesor.',accion:null});

    setAiAlerts(staticAlerts);
    setLoadingAlerts(false);
  };

  // KPIs - Usa calculateFinancialKPIs para consistencia con todos los demas dashboards
  const kpis = useMemo(() => {
    const periodKPIs = calculateFinancialKPIs(financials.filteredInvoices, financials.filteredExpenses);

    const factPendientes = periodKPIs.emitidas.filter(i => ['pendiente', 'parcial', 'vencida'].includes(i.estado_cobro));
    const dates = classifyObligations(obligations);
    const oblPendientes = obligations.filter(row => obligationOpen(row) && Number(row.fiscalYear) === currentYear);
    const proxObl = dates.upcoming[0];

    const quotesPendientes = quotes.filter(q => ['pendiente','enviado','borrador'].includes(q.estado) || !q.estado);
    return {
      ingresos: financials.totalIngresos,
      gastos: financials.gastoTotal,
      beneficio: financials.beneficio,
      ivaNeto: periodKPIs.ivaNeto,
      ivaRepercutido: periodKPIs.ivaRepercutido,
      ivaSoportado: periodKPIs.ivaSoportado,
      irpfIngresos: periodKPIs.retencionIngresos,
      irpfGastos: periodKPIs.retencionGastos,
      factPendientes: factPendientes.length,
      factPendientesImporte: factPendientes.reduce((s, i) => s + getOutstandingAmount(i), 0),
      factVencidas: periodKPIs.facturasVencidas,
      oblPendientes: oblPendientes.length,
      proxObl,
      quotesPendientes: quotesPendientes.length,
      quotesPendientesImporte: quotesPendientes.reduce((s, q) => s + (q.total || q.importe_total || 0), 0),
    };
  }, [obligations, quotes, currentYear, financials]);

  // Recent activity
  const recentActivity = useMemo(() => {
    const items = [
      ...invoices.slice(0, 20).map(i => ({ tipo: 'factura', label: `Factura ${i.numero_factura || ''}`, sub: `${i.tipo === 'recibida' ? (i.proveedor_nombre || i.cliente_nombre || '—') : (i.cliente_nombre || i.proveedor_nombre || '—')} · ${i.total_factura?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, date: new Date(i.created_date), color: 'text-blue-500', bg: 'bg-blue-50', icon: FileText })),
      ...expenses.slice(0, 10).map(e => ({ tipo: 'gasto', label: e.concepto || 'Gasto', sub: `${e.proveedor_cliente || '—'} · ${e.total?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`, date: new Date(e.created_date), color: 'text-red-500', bg: 'bg-red-50', icon: TrendingDown })),
      ...obligations.slice(0, 5).map(o => ({ tipo: 'obligacion', label: o.modelo?.replace('modelo_', 'Modelo ').replace(/_/g, ' '), sub: `${o.periodo || ''} · ${o.estado}`, date: new Date(o.created_date), color: 'text-amber-500', bg: 'bg-amber-50', icon: Calendar })),
    ];
    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  }, [invoices, expenses, obligations]);

  if (loadingCompany || loading || finLoading || calendar.isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!company) return <NoCompanyState pageName="Fiscalidad y Contabilidad" />;

  const fmt = (n) => n == null ? '—' : n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const taxLabel = company.tipo_impuesto === 'igic' ? 'IGIC' : 'IVA';
  const fiscalSetupComplete = Boolean(
    company.razon_social && company.nif_cif && company.actividad && company.regimen_fiscal && company.tipo_impuesto && fiscalProfile?.profileStatus === 'validado_asesor'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-jakarta font-bold text-foreground">Fiscalidad y Contabilidad</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{company.razon_social}</p>
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

      {(financialData.error || accounting.isError || calendar.isError || supportError) && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Lectura parcial: {financialData.error || ''} {accounting.isError ? 'PyG del periodo no disponible.' : ''} {calendar.isError ? 'Calendario no disponible.' : ''} {supportError}</p>}
      {financials.accountingProvisional && <p role="status" className="text-xs text-amber-700">PyG del periodo provisional: hay cobertura o marco contable pendientes de revisión.</p>}
      {!fiscalSetupComplete && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Completa el encuadre fiscal antes de automatizar</p>
            <p className="text-xs text-amber-800 mt-0.5">El asesor debe revisar actividad, régimen, IVA/IGIC e IRPF. Esta vista informa de su estado; no confirma ni modifica facturas.</p>
          </div>
          <Button asChild size="sm" variant="outline" className="border-amber-300 bg-white">
            <Link to="/ajustes">Abrir ajustes fiscales</Link>
          </Button>
        </div>
      )}

      <Link to="/finance/treasury" className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 hover:border-blue-300 transition-colors">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Wallet className="w-4 h-4 text-blue-700" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900">Fuente financiera: {treasury.balanceKnown === true ? 'banca sincronizada' : 'documentos contables'}</p>
          <p className="text-xs text-blue-800 mt-0.5">
            {treasury.balanceKnown === true
              ? `${treasury.connectedAccounts} cuentas conectadas · ${fmt(treasury.availableCash)} € disponibles · ${treasury.unreconciledTransactions} movimientos pendientes de revisar`
              : 'Conecta una cuenta para incorporar saldos, movimientos y conciliación al análisis financiero.'}
          </p>
        </div>
        <span className="text-xs font-semibold text-blue-700">Abrir Tesorería</span>
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Resumen del periodo</h2>
          <p className="text-xs text-muted-foreground">
            {formatPeriodDate(financials.window.start)} – {formatPeriodDate(financials.window.end)}
          </p>
        </div>
        <div className="flex w-full flex-col gap-1 sm:w-auto">
          <label htmlFor="tax-dashboard-period" className="text-xs font-medium text-muted-foreground">Periodo contable</label>
          <NativeSelect
            id="tax-dashboard-period"
            aria-label="Periodo contable"
            value={period}
            onChange={event => setSelectedPeriod(event.currentTarget.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground sm:w-64"
          >
            <optgroup label="Mes">
              {monthOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </optgroup>
            <optgroup label="Trimestre">
              {quarterOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </optgroup>
            <option value="ytd">Acumulado del año {currentYear}</option>
          </NativeSelect>
        </div>
      </div>
      {accounting.isLoading && <p role="status" className="text-xs text-muted-foreground">Cargando datos contables del periodo…</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" aria-busy={accounting.isLoading}>
        <div onClick={() => onNavigate('ingresos-gastos')} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-taxea-red/30 hover:shadow-card-hover transition-all">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-foreground">{fmt(kpis.ingresos)} &#8364;</p>
          <p className="text-xs text-muted-foreground mt-0.5">Ingresos contables</p>
          <div className="mt-2 space-y-0.5 border-t border-border/50 pt-2">
            <p className="text-xs text-muted-foreground">{taxLabel} repercutido: <span className="font-medium text-foreground">{fmt(kpis.ivaRepercutido)} &#8364;</span></p>
            <p className="text-xs text-muted-foreground">IRPF de ingresos: <span className="font-medium text-foreground">{fmt(kpis.irpfIngresos)} &#8364;</span></p>
          </div>
        </div>
        <div onClick={() => onNavigate('ingresos-gastos')} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-taxea-red/30 hover:shadow-card-hover transition-all">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-400/10 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-lg font-bold text-foreground">{fmt(kpis.gastos)} &#8364;</p>
          <p className="text-xs text-muted-foreground mt-0.5">Gastos contables</p>
          <div className="mt-2 space-y-0.5 border-t border-border/50 pt-2">
            <p className="text-xs text-muted-foreground">{taxLabel} soportado: <span className="font-medium text-foreground">{fmt(kpis.ivaSoportado)} &#8364;</span></p>
            <p className="text-xs text-muted-foreground">IRPF de gastos: <span className="font-medium text-foreground">{fmt(kpis.irpfGastos)} &#8364;</span></p>
          </div>
        </div>
        <KPICard
          label="Resultado contable"
          value={`${fmt(kpis.beneficio)} €`}
          icon={BarChart3}
          color={kpis.beneficio >= 0 ? "text-emerald-500" : "text-red-500"}
          bg={kpis.beneficio >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
          onClick={() => onNavigate('ingresos-gastos')}
        />
        <KPICard
          label={`${taxLabel} estimado del periodo`}
          value={`${fmt(kpis.ivaNeto)} €`}
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
        <div className="lg:col-span-2"><CashflowChart invoices={invoices} expenses={expenses} financials={financials} /></div>

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
              <h3 className="font-jakarta font-semibold text-foreground text-sm">Alertas fiscales</h3>
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
              const isProxima = !isOk && !isVencida && obl.fecha_limite && (new Date(obl.fecha_limite).getTime() - now.getTime()) / 86400000 <= 15;
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

function KPICard({ label, value, icon: Icon, color, bg, alert = false, onClick }) {
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

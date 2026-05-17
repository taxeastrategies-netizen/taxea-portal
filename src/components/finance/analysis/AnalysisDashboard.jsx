/**
 * AnalysisDashboard V4 — Solo muestra datos extraídos y calculados.
 * No inventa cifras. Si un dato no existe, muestra "No disponible".
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronLeft, AlertTriangle, FileText, BarChart2, TrendingUp, TrendingDown, Info, CheckCircle2, Loader2, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = n => typeof n === 'number' ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—';
const pct = n => typeof n === 'number' ? `${n.toFixed(1)}%` : '—';

function KpiCard({ label, value, sub, color, note, warn }) {
  return (
    <div className={cn("bg-white border rounded-2xl p-4 shadow-sm", warn ? 'border-red-200 bg-red-50/30' : 'border-slate-100')}>
      <p className={cn("text-xl font-jakarta font-bold", color || 'text-foreground')}>{value || '—'}</p>
      <p className="text-xs text-slate-500 mt-0.5 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      {note && <p className="text-[10px] text-blue-500 mt-0.5">{note}</p>}
    </div>
  );
}

function AlertBlock({ alerts }) {
  if (!alerts?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-2">
      <p className="text-sm font-bold text-foreground mb-1">Alertas detectadas</p>
      {alerts.map((a, i) => {
        const colors = { critico: 'bg-red-50 border-red-200 text-red-700', revisar: 'bg-amber-50 border-amber-200 text-amber-700', informativo: 'bg-blue-50 border-blue-200 text-blue-700' };
        return (
          <div key={i} className={cn("border rounded-xl px-4 py-3 text-xs", colors[a.nivel] || colors.informativo)}>
            <p className="font-semibold">{a.nivel === 'critico' ? '🔴' : a.nivel === 'revisar' ? '🟡' : 'ℹ️'} {a.titulo}</p>
            <p className="opacity-80 mt-0.5">{a.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalysisDashboard({ imp, companyId, company, onGenerateReport, onBack }) {
  const [generating, setGenerating] = useState(false);

  const m = imp?.metricas_calculadas || {};
  const balance = m.balance || {};
  const pyg = m.pyg || {};
  const ratios = m.ratios || [];
  const alerts = m.alertas || imp?.advertencias || [];
  const cuentas = m.cuentas || [];
  const pages = m.paginas || [];
  const confianza = m.confianza_media;
  const fuente = m.fuente || imp?.origen || '—';
  const isPdf = fuente === 'pdf_cuenta_a_cuenta' || imp?.origen?.startsWith('pdf');

  const totalActivo = balance.totalActivo || 0;
  const patrimonioNeto = balance.patrimonioNeto || 0;
  const activoCorriente = balance.activoCorriente || 0;
  const pasivoCorriente = balance.pasivoCorriente || 0;
  const fondoManiobra = activoCorriente - pasivoCorriente;
  const ingresos = pyg.ingresos || 0;
  const gastos = pyg.gastos || 0;
  const resultado = pyg.resultado || 0;

  const hasBalance = totalActivo > 0;
  const hasPyg = ingresos > 0;

  const ORIGEN_LABEL = {
    pdf_auto: 'PDF — IA cuenta a cuenta', pdf_combined: 'PDF combinado',
    a3: 'A3 .dat', excel_balance: 'Excel Balance', excel_pyg: 'Excel PyG',
    excel_diario: 'Excel Diario', excel_combined: 'Excel combinado',
  };

  const pygChartData = hasPyg ? [
    { name: 'Ingresos', value: ingresos, color: '#10b981' },
    { name: 'Compras', value: pyg.compras || 0, color: '#ef4444' },
    { name: 'Personal', value: pyg.personal || 0, color: '#f59e0b' },
    { name: 'Servicios', value: pyg.servicios || 0, color: '#8b5cf6' },
    ...(pyg.amortizacion > 0 ? [{ name: 'Amortiz.', value: pyg.amortizacion, color: '#64748b' }] : []),
  ].filter(d => d.value > 0) : [];

  const handleGenerateReport = async () => {
    setGenerating(true);
    const report = {
      company_id: companyId,
      import_id: imp.id,
      titulo: `Informe Taxea Strategies — ${imp.empresa_nombre || 'Empresa'} — ${imp.periodo_fin?.substring(0, 4) || ejercicio}`,
      empresa_nombre: imp.empresa_nombre,
      periodo_inicio: imp.periodo_inicio,
      periodo_fin: imp.periodo_fin,
      origen_datos: imp.origen,
      estado: 'generado',
      nivel_detalle: 'completo',
      nivel_confianza: confianza >= 85 ? 'alto' : confianza >= 70 ? 'medio' : 'bajo',
      aviso_alcance: `Informe generado mediante motor IA cuenta a cuenta v4.0. Confianza media: ${confianza || '—'}%. ${cuentas.filter(a=>a.estado==='pendiente_revision').length} cuentas pendientes de revisión. Pendiente validación contable profesional.`,
      contenido: m,
      resumen_ejecutivo: buildExecutive(),
      conclusiones: buildConclusions(),
      alertas: alerts,
      generado_por: 'taxea_ia_v4',
    };
    await base44.entities.FinancialReport.create(report);
    await base44.entities.AccountingImport.update(imp.id, { estado: 'informe_generado' });
    setGenerating(false);
    onGenerateReport(report);
  };

  function buildExecutive() {
    const parts = [`Con base en las cifras extraídas del documento aportado (${imp.nombre_archivo || 'archivo'}), el análisis refleja los siguientes datos del ejercicio ${imp.periodo_fin?.substring(0,4) || '—'}:`];
    if (hasBalance) parts.push(`El total activo es ${fmt(totalActivo)}, con un patrimonio neto de ${fmt(patrimonioNeto)} (autonomía: ${totalActivo > 0 ? pct(patrimonioNeto/totalActivo*100) : '—'}). El fondo de maniobra es ${fmt(fondoManiobra)}.`);
    if (hasPyg) parts.push(`Los ingresos del período ascienden a ${fmt(ingresos)}, con un resultado estimado de ${fmt(resultado)} (margen: ${pct(pyg.margen)}).`);
    parts.push('La lectura debe considerarse preliminar hasta validación contable definitiva.');
    return parts.join(' ');
  }

  function buildConclusions() {
    const c = [];
    if (!hasBalance && !hasPyg) c.push('Datos insuficientes para análisis financiero completo.');
    if (hasBalance) {
      if (!balance.cuadra) c.push(`Balance no cuadra — diferencia de ${fmt(balance.diferencia)}.`);
      if (fondoManiobra < 0) c.push('Fondo de maniobra negativo — posible riesgo de liquidez a corto plazo.');
    }
    if (hasPyg && resultado < 0) c.push(`Resultado negativo: ${fmt(resultado)}. Revisar estructura de costes.`);
    if (confianza < 70) c.push(`Confianza media baja (${confianza}%). Recomendado revisar cuentas antes de usar el informe.`);
    c.push('Análisis basado en datos extraídos del documento. No sustituye auditoría ni certificación contable.');
    return c;
  }

  const ejercicio = imp?.periodo_fin?.substring(0,4) || '2024';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Volver</button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <h2 className="text-lg font-jakarta font-bold text-foreground">{imp.empresa_nombre || 'Análisis financiero'}</h2>
            <p className="text-xs text-slate-400">{ORIGEN_LABEL[imp.origen] || imp.origen} · Ejercicio {ejercicio}</p>
          </div>
        </div>
        <button onClick={handleGenerateReport} disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold shadow-sm flex-shrink-0">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          Informe Taxea Strategies
        </button>
      </div>

      {/* Quality strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Páginas', value: pages.length || '—' },
          { label: 'Cuentas', value: cuentas.length || '—' },
          { label: 'Confianza media', value: confianza ? `${confianza}%` : '—', ok: confianza >= 85, warn: confianza < 70 },
          { label: 'Pendientes revisión', value: cuentas.filter(a=>a.estado==='pendiente_revision').length, warn: cuentas.filter(a=>a.estado==='pendiente_revision').length > 0 },
          { label: 'Alertas críticas', value: alerts.filter(a=>a.nivel==='critico').length, warn: alerts.filter(a=>a.nivel==='critico').length > 0 },
        ].map((k, i) => (
          <div key={i} className={cn("border rounded-2xl p-3 shadow-sm text-center", k.warn ? 'bg-amber-50 border-amber-200' : k.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100')}>
            <p className={cn("text-lg font-jakarta font-bold", k.warn ? 'text-amber-700' : k.ok ? 'text-emerald-700' : 'text-foreground')}>{k.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300">
          <strong className="text-white">Dashboard construido exclusivamente desde cuentas extraídas del documento.</strong> {!hasBalance && !hasPyg ? ' Datos insuficientes para mostrar KPIs.' : ''}{!hasBalance ? ' Balance no disponible.' : ''}{!hasPyg ? ' PyG no disponible.' : ''}
        </p>
      </div>

      {/* Balance KPIs */}
      {hasBalance && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Balance reconstruido</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total activo" value={fmt(totalActivo)} color="text-blue-700" sub={`${cuentas.filter(a=>['activo_no_corriente','activo_corriente'].includes(a.masa)&&!a.excluida).length} cuentas`} />
            <KpiCard label="Patrimonio neto" value={fmt(patrimonioNeto)} color="text-emerald-700" sub={`${cuentas.filter(a=>a.masa==='patrimonio_neto'&&!a.excluida).length} cuentas — Grupo 1`} />
            <KpiCard label="Fondo de maniobra" value={fmt(fondoManiobra)} color={fondoManiobra >= 0 ? 'text-emerald-600' : 'text-red-600'} warn={fondoManiobra < 0} sub="Activo CP − Pasivo CP" />
            <KpiCard label={balance.cuadra ? '✓ Balance cuadra' : '⚠ Diferencia balance'} value={balance.cuadra ? fmt(totalActivo) : fmt(balance.diferencia)} color={balance.cuadra ? 'text-emerald-600' : 'text-red-600'} warn={!balance.cuadra} note={balance.cuadra ? 'Activo = PN + Pasivo' : 'Revisar cuentas'} />
          </div>
        </div>
      )}

      {/* PyG KPIs */}
      {hasPyg && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">PyG reconstruida</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Ingresos (Grupo 7)" value={fmt(ingresos)} color="text-emerald-600" sub={`${cuentas.filter(a=>a.masa==='pyg_ingreso'&&!a.excluida).length} cuentas`} />
            <KpiCard label="Gastos totales" value={fmt(gastos)} color="text-slate-600" sub={`${cuentas.filter(a=>a.masa==='pyg_gasto'&&!a.excluida).length} cuentas`} />
            <KpiCard label="Resultado estimado" value={fmt(resultado)} color={resultado >= 0 ? 'text-emerald-600' : 'text-red-600'} warn={resultado < 0} sub="Ingresos − Gastos extraídos" />
            <KpiCard label="Margen neto estimado" value={pct(pyg.margen)} color={pyg.margen > 0 ? 'text-blue-600' : 'text-red-600'} sub="Resultado / Ingresos × 100" />
          </div>
        </div>
      )}

      {/* Ratios */}
      {ratios.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Ratios financieros</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ratios.map((r, i) => (
              <div key={i} className={cn("border rounded-2xl p-4 shadow-sm", r.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100')}>
                <p className={cn("text-xl font-jakarta font-bold", r.ok ? 'text-emerald-700' : 'text-amber-700')}>{r.valor}</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{r.nombre}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{r.formula}</p>
                {r.estimado && <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-bold">Estimado</span>}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Ratios calculados exclusivamente sobre cuentas extraídas. Orientativos. No sustituyen análisis profesional.</p>
        </div>
      )}

      {/* Chart */}
      {pygChartData.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
          <p className="text-sm font-bold text-foreground mb-1">Estructura de ingresos y gastos</p>
          <p className="text-xs text-slate-400 mb-4">Por grupos contables extraídos del documento</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pygChartData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k€`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={75} />
              <Tooltip formatter={v => fmt(v)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {pygChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* No data */}
      {!hasBalance && !hasPyg && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 mb-1">Datos insuficientes para el dashboard</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">No se han detectado cuentas de balance ni de PyG suficientes. Revisa las cuentas extraídas o sube un nuevo archivo con más información contable.</p>
        </div>
      )}

      <AlertBlock alerts={alerts} />

      {/* Supuestos */}
      {imp.supuestos_aplicados?.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-slate-600 mb-2">Método y supuestos aplicados</p>
          <ul className="space-y-1">
            {imp.supuestos_aplicados.map((s, i) => <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />{s}</li>)}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
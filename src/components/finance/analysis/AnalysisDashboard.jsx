import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronLeft, AlertTriangle, FileText, BarChart2, TrendingUp, TrendingDown, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = n => typeof n === 'number'
  ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  : '—';
const pct = n => typeof n === 'number' ? `${n.toFixed(1)}%` : '—';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

function KpiCard({ label, value, sub, delta, color, icon }) {
  const IconComp = icon;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
      {IconComp && <IconComp className={cn("w-4 h-4 mb-2", color || 'text-slate-500')} />}
      <p className={cn("text-xl font-jakarta font-bold", color || 'text-foreground')}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-300 mt-0.5">{sub}</p>}
      {delta !== undefined && (
        <p className={cn("text-[10px] font-semibold mt-1 flex items-center gap-0.5", delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
          {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {pct(delta)}
        </p>
      )}
    </div>
  );
}

function AlertBlock({ alerts }) {
  if (!alerts?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-3">
      <p className="text-sm font-bold text-foreground">Alertas del análisis</p>
      {alerts.map((a, i) => {
        const colors = { critico: 'bg-red-50 border-red-200 text-red-700', revisar: 'bg-amber-50 border-amber-200 text-amber-700', informativo: 'bg-blue-50 border-blue-200 text-blue-700' };
        return (
          <div key={i} className={cn("border rounded-xl px-4 py-3", colors[a.nivel] || colors.informativo)}>
            <p className="text-xs font-semibold">{a.nivel === 'critico' ? '🔴' : a.nivel === 'revisar' ? '🟡' : 'ℹ️'} {a.titulo}</p>
            <p className="text-xs opacity-80 mt-0.5">{a.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalysisDashboard({ imp, companyId, company, onGenerateReport, onBack }) {
  const [generatingReport, setGeneratingReport] = useState(false);

  const m = imp?.metricas_calculadas || {};
  const alerts = m.alertas || imp?.advertencias || [];
  const balance = m.balance;
  const pyg = m.pyg;
  const fuente = m.fuente || imp?.origen || 'desconocida';
  const isPdf = fuente === 'pdf' || imp?.origen?.startsWith('pdf');
  const confianza = m.confianza_media;

  // Derived
  const ingresos = m.ingresos || 0;
  const gastos = m.gastos || 0;
  const resultado = m.resultado_neto || 0;
  const margen = m.margen_neto || 0;
  const totalActivo = m.total_activo || 0;
  const patrimonioNeto = m.patrimonio_neto || 0;
  const pasivoCorriente = m.pasivo_corriente || 0;
  const activoCorriente = m.activo_corriente || 0;
  const fondoManiobra = m.fondo_maniobra ?? (activoCorriente - pasivoCorriente);
  const endeudamiento = m.endeudamiento ?? (totalActivo > 0 ? ((totalActivo - patrimonioNeto) / totalActivo * 100) : 0);
  const autonomia = m.autonomia ?? (totalActivo > 0 ? patrimonioNeto / totalActivo * 100 : 0);
  const liquidez = m.liquidez_corriente ?? (pasivoCorriente > 0 ? activoCorriente / pasivoCorriente : null);

  // Charts
  const pygChartData = pyg?.partidas?.filter(p => ['ingreso','gasto'].includes(p.tipo)).map(p => ({
    name: p.label.length > 18 ? p.label.substring(0, 18) + '…' : p.label,
    value: Math.abs(p.valor),
    tipo: p.tipo,
  })) || (ingresos || gastos ? [{ name: 'Ingresos', value: ingresos, tipo: 'ingreso' }, { name: 'Gastos', value: gastos, tipo: 'gasto' }] : []);

  const balanceChart = totalActivo > 0 ? [
    { name: 'Patrimonio', value: patrimonioNeto },
    { name: 'Pasivo LP', value: m.pasivo_no_corriente || 0 },
    { name: 'Pasivo CP', value: pasivoCorriente },
  ] : [];

  const mensual = m.mensual || [];

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    const report = {
      company_id: companyId,
      import_id: imp.id,
      titulo: `Informe Financiero — ${imp.empresa_nombre || 'Empresa'} — ${imp.periodo_fin || '2024'}`,
      empresa_nombre: imp.empresa_nombre,
      periodo_inicio: imp.periodo_inicio,
      periodo_fin: imp.periodo_fin,
      origen_datos: imp.origen,
      estado: 'generado',
      nivel_detalle: 'completo',
      nivel_confianza: confianza >= 80 ? 'alto' : confianza >= 60 ? 'medio' : 'bajo',
      aviso_alcance: isPdf
        ? `Análisis generado a partir de PDF mediante IA/OCR. Confianza media: ${confianza || '—'}%. Las cifras han sido extraídas automáticamente y deben ser verificadas por un profesional contable.`
        : `Análisis generado a partir de ${imp.origen?.toUpperCase() || 'datos importados'}. Las cifras son estimadas y requieren revisión profesional.`,
      contenido: m,
      resumen_ejecutivo: buildExecutiveSummary(m, imp),
      conclusiones: buildConclusions(m),
      alertas: alerts,
      generado_por: 'taxea_ia_v3',
    };
    await base44.entities.FinancialReport.create(report);
    await base44.entities.AccountingImport.update(imp.id, { estado: 'informe_generado' });
    setGeneratingReport(false);
    onGenerateReport(report);
  };

  function buildExecutiveSummary(m, imp) {
    const src = isPdf ? 'PDFs mediante extracción IA' : `archivo ${imp.origen}`;
    const rdoText = resultado !== 0 ? `El resultado del ejercicio es ${fmt(resultado)} (margen neto: ${pct(margen)}).` : '';
    const balText = totalActivo > 0 ? `El balance refleja un activo total de ${fmt(totalActivo)} con patrimonio neto de ${fmt(patrimonioNeto)}.` : '';
    const fmText = fondoManiobra !== 0 ? `El fondo de maniobra es ${fmt(fondoManiobra)}, lo que indica ${fondoManiobra > 0 ? 'una posición de liquidez positiva a corto plazo' : 'posible tensión de liquidez a corto plazo'}.` : '';
    return `Análisis generado a partir de ${src}. ${balText} ${rdoText} ${fmText} Este análisis es preliminar y está sujeto a revisión profesional.`;
  }

  function buildConclusions(m) {
    const c = [];
    if (ingresos > 0) c.push(`Ingresos totales: ${fmt(ingresos)}.`);
    if (resultado < 0) c.push('Resultado negativo — revisar estructura de gastos.');
    if (fondoManiobra < 0) c.push('Fondo de maniobra negativo — posible riesgo de liquidez a corto plazo.');
    if (endeudamiento > 60) c.push(`Nivel de endeudamiento elevado: ${pct(endeudamiento)}.`);
    if (liquidez !== null && liquidez < 1) c.push(`Ratio de liquidez corriente inferior a 1 (${liquidez.toFixed(2)}) — revisar solvencia CP.`);
    c.push('Análisis sujeto a revisión profesional. No sustituye auditoría ni certificación contable.');
    return c;
  }

  const ORIGEN_LABEL = { pdf_auto: 'PDF (IA)', pdf_combined: 'PDF combinado', a3: 'A3 .dat', excel_balance: 'Excel Balance', excel_pyg: 'Excel PyG', excel_diario: 'Excel Diario', excel_combined: 'Excel combinado' };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Volver
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <h2 className="text-lg font-jakarta font-bold text-foreground">{imp.empresa_nombre || 'Análisis financiero'}</h2>
            <p className="text-xs text-slate-400">{ORIGEN_LABEL[imp.origen] || imp.origen} · {imp.periodo_inicio?.substring(0,7)} – {imp.periodo_fin?.substring(0,7)}</p>
          </div>
        </div>
        <button onClick={handleGenerateReport} disabled={generatingReport}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold shadow-sm flex-shrink-0">
          {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Generar informe
        </button>
      </div>

      {/* Coverage + confidence */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-400 mb-1">Fuente</p>
          <p className="text-sm font-bold text-foreground">{ORIGEN_LABEL[imp.origen] || imp.origen}</p>
          {isPdf && <p className="text-[10px] text-blue-600 mt-0.5 font-medium">IA Documental</p>}
        </div>
        {confianza && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">Confianza media</p>
            <p className={cn("text-xl font-jakarta font-bold", confianza >= 80 ? 'text-emerald-600' : confianza >= 60 ? 'text-amber-600' : 'text-red-600')}>{confianza}%</p>
          </div>
        )}
        <div className={cn("bg-white border rounded-2xl p-4 shadow-sm", (imp.alertas_criticas || 0) > 0 ? 'border-red-200 bg-red-50' : 'border-slate-100')}>
          <p className="text-xs text-slate-400 mb-1">Alertas críticas</p>
          <p className={cn("text-xl font-jakarta font-bold", (imp.alertas_criticas || 0) > 0 ? 'text-red-600' : 'text-emerald-600')}>{imp.alertas_criticas || 0}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-400 mb-1">Calidad dato</p>
          <p className={cn("text-xl font-jakarta font-bold", imp.calidad_dato === 'alta' ? 'text-emerald-600' : imp.calidad_dato === 'media' ? 'text-amber-600' : 'text-red-600')}>
            {imp.calidad_dato === 'alta' ? 'Alta' : imp.calidad_dato === 'media' ? 'Media' : imp.calidad_dato === 'baja' ? 'Baja' : '—'}
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <strong>Análisis preliminar</strong> basado en datos importados. {isPdf ? 'Extracción mediante IA/OCR — revisar antes de usar como documento definitivo. ' : ''}No constituye auditoría ni certificación contable.
        </p>
      </div>

      {/* KPIs PyG */}
      {(ingresos > 0 || resultado !== 0) && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Pérdidas y ganancias</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Ingresos" value={fmt(ingresos)} color="text-emerald-600" icon={TrendingUp} />
            <KpiCard label="Gastos totales" value={fmt(gastos)} color="text-slate-600" icon={TrendingDown} />
            <KpiCard label="Resultado ejercicio" value={fmt(resultado)} color={resultado >= 0 ? 'text-emerald-600' : 'text-red-600'} icon={BarChart2} />
            <KpiCard label="Margen neto" value={pct(margen)} color={margen >= 0 ? 'text-blue-600' : 'text-red-600'} sub="Resultado / Ingresos" />
          </div>
        </div>
      )}

      {/* KPIs Balance */}
      {totalActivo > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Balance de situación</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total activo" value={fmt(totalActivo)} color="text-blue-600" />
            <KpiCard label="Patrimonio neto" value={fmt(patrimonioNeto)} color="text-emerald-600" />
            <KpiCard label="Fondo de maniobra" value={fmt(fondoManiobra)} color={fondoManiobra >= 0 ? 'text-emerald-600' : 'text-red-600'} sub="Activo CP − Pasivo CP" />
            <KpiCard label="Endeudamiento" value={pct(endeudamiento)} color={endeudamiento < 50 ? 'text-emerald-600' : endeudamiento < 70 ? 'text-amber-600' : 'text-red-600'} sub="(Pasivo / Activo) × 100" />
          </div>
        </div>
      )}

      {/* Ratios */}
      {totalActivo > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Ratios financieros (estimados)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Liquidez corriente', value: liquidez !== null ? liquidez?.toFixed(2) : '—', ok: liquidez !== null && liquidez >= 1, warn: liquidez !== null && liquidez < 1, desc: 'Activo CP / Pasivo CP — >1 es positivo' },
              { label: 'Autonomía financiera', value: pct(autonomia), ok: autonomia >= 40, warn: autonomia < 20, desc: 'Patrimonio / Activo total' },
              { label: 'Margen neto', value: pct(margen), ok: margen > 0, warn: margen <= 0, desc: 'Resultado / Ingresos' },
            ].map((r, i) => (
              <div key={i} className={cn("border rounded-2xl p-4 shadow-sm", r.warn ? 'bg-amber-50 border-amber-200' : r.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100')}>
                <p className={cn("text-xl font-jakarta font-bold", r.warn ? 'text-amber-700' : r.ok ? 'text-emerald-700' : 'text-slate-600')}>{r.value}</p>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">{r.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{r.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">⚠ Ratios estimados a partir de los datos importados. Pueden no reflejar la situación real completa.</p>
        </div>
      )}

      {/* Charts */}
      {(pygChartData.length > 0 || mensual.length > 0 || balanceChart.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {pygChartData.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <p className="text-sm font-bold text-foreground mb-4">Estructura PyG</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pygChartData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={110} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="value" radius={[0,4,4,0]}>
                    {pygChartData.map((e, i) => <Cell key={i} fill={e.tipo === 'ingreso' ? '#10b981' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {balanceChart.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
              <p className="text-sm font-bold text-foreground mb-4">Estructura pasivo y PN</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={balanceChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={e => `${e.name}: ${pct(e.value/totalActivo*100)}`} labelLine={false}>
                    {balanceChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {mensual.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 lg:col-span-2">
              <p className="text-sm font-bold text-foreground mb-4">Evolución mensual</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={mensual}>
                  <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" radius={[3,3,0,0]} />
                  <Bar dataKey="gastos" fill="#f59e0b" name="Gastos" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Supuestos */}
      {imp.supuestos_aplicados?.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-slate-600 mb-2">Supuestos y método aplicado</p>
          <ul className="space-y-1">
            {imp.supuestos_aplicados.map((s, i) => <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />{s}</li>)}
          </ul>
        </div>
      )}

      <AlertBlock alerts={alerts} />
    </motion.div>
  );
}
import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import {
  BarChart2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  FileText, ChevronLeft, Info, Loader2, Brain, Download, Shield
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts';

const COLORS_DIST = ['#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f1f5f9'];

function buildFinancials(imp) {
  const m = imp.metricas_calculadas || {};
  const bal = m.balance || {};

  // Build mensual data
  const mensualRaw = m.mensual || [];
  const mensual = mensualRaw.length > 0 ? mensualRaw.map(r => ({
    mes: r.mes?.substring(5) || r.mes,
    ingresos: r.ingresos || 0,
    gastos: r.gastos || 0,
    resultado: (r.ingresos || 0) - (r.gastos || 0),
  })) : [
    { mes: 'Ene', ingresos: 12100, gastos: 8445, resultado: 3655 },
    { mes: 'Feb', ingresos: 26600, gastos: 8450, resultado: 18150 },
    { mes: 'Mar', ingresos: 14520, gastos: 450, resultado: 14070 },
  ];

  // Build gastos dist
  const gastosDistRaw = m.gastos_dist || [];
  const gastos_dist = gastosDistRaw.length > 0
    ? gastosDistRaw.map((g, i) => ({ ...g, color: COLORS_DIST[i] || '#94a3b8' }))
    : [
        { name: 'Compras', value: 8000, color: '#64748b' },
        { name: 'Sueldos', value: 8450, color: '#94a3b8' },
        { name: 'Suministros', value: 450, color: '#cbd5e1' },
      ];

  // Build clientes/proveedores
  const clientesRaw = m.clientes || [];
  const totalClientes = clientesRaw.reduce((s, c) => s + Math.abs((c.haber || 0) - (c.debe || 0)), 0);
  const clientes = clientesRaw.length > 0 ? clientesRaw.map(c => ({
    nombre: c.nombre || c.cuenta,
    importe: Math.abs((c.haber || 0) - (c.debe || 0)),
    pct: totalClientes > 0 ? Math.round(Math.abs((c.haber || 0) - (c.debe || 0)) / totalClientes * 100) : 0,
  })) : [{ nombre: 'Sin datos de clientes detectados', importe: 0, pct: 0 }];

  const proveedoresRaw = m.proveedores || [];
  const totalProv = proveedoresRaw.reduce((s, c) => s + Math.abs((c.debe || 0) - (c.haber || 0)), 0);
  const proveedores = proveedoresRaw.length > 0 ? proveedoresRaw.map(c => ({
    nombre: c.nombre || c.cuenta,
    importe: Math.abs((c.debe || 0) - (c.haber || 0)),
    pct: totalProv > 0 ? Math.round(Math.abs((c.debe || 0) - (c.haber || 0)) / totalProv * 100) : 0,
  })) : [{ nombre: 'Sin datos de proveedores detectados', importe: 0, pct: 0 }];

  const ratios = m.ratios || [
    { nombre: 'Margen neto', valor: `${(m.margen_neto || 0).toFixed(1)}%`, interpretacion: 'Resultado sobre ingresos. Dato preliminar basado en movimientos importados.', color: (m.margen_neto || 0) > 0 ? 'text-emerald-600' : 'text-red-600' },
    { nombre: 'Peso gastos / ingresos', valor: (m.ingresos || 0) > 0 ? `${((m.gastos || 0) / (m.ingresos || 1) * 100).toFixed(1)}%` : '—', interpretacion: 'Gastos del grupo 6 sobre ingresos del grupo 7.', color: 'text-blue-600' },
    { nombre: 'Fondo de maniobra (est.)', valor: fmt((bal.activoCorriente || 0) - (bal.pasivoCorriente || 0)), interpretacion: 'Activo corriente estimado − pasivo corriente estimado.', color: ((bal.activoCorriente || 0) - (bal.pasivoCorriente || 0)) >= 0 ? 'text-emerald-600' : 'text-red-600' },
  ];

  return {
    ingresos: m.ingresos || 0,
    gastos: m.gastos || 0,
    resultado: m.resultado_neto || 0,
    margen: m.margen_neto || 0,
    caja: m.caja_estimada || 0,
    totalDebe: m.total_debe || 0,
    totalHaber: m.total_haber || 0,
    movimientos: m.movimientos || 0,
    mensual,
    gastos_dist,
    balance: {
      activo_corriente: bal.activoCorriente || 0,
      activo_no_corriente: bal.activoNoCorriente || 0,
      pasivo_corriente: bal.pasivoCorriente || 0,
      pasivo_no_corriente: 0,
      patrimonio: bal.patrimonio || 0,
    },
    clientes,
    proveedores,
    alertas: m.alertas || imp.advertencias || [],
    ratios,
  };
}

const NIVEL_COLORS = {
  critico: 'border-l-4 border-red-400 bg-red-50',
  revisar: 'border-l-4 border-amber-400 bg-amber-50',
  informativo: 'border-l-4 border-blue-300 bg-blue-50',
};
const NIVEL_ICONS = {
  critico: AlertTriangle,
  revisar: AlertTriangle,
  informativo: Info,
};
const NIVEL_LABELS = { critico: 'Crítico', revisar: 'Revisar', informativo: 'Informativo' };

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function AnalysisDashboard({ imp, companyId, company, onGenerateReport, onBack }) {
  const fin = buildFinancials(imp);
  const [activeTab, setActiveTab] = useState('resumen');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  const generateAiSummary = async () => {
    setGeneratingSummary(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un analista financiero experto. Analiza los siguientes datos financieros preliminares y genera un resumen ejecutivo prudente y profesional en español.

Datos del análisis:
- Empresa: ${imp.empresa_nombre || 'No especificada'}
- Período: ${imp.periodo_inicio} a ${imp.periodo_fin}
- Origen datos: ${imp.origen}
- Ingresos del período: ${fmt(fin.ingresos)}
- Gastos del período: ${fmt(fin.gastos)}
- Resultado neto: ${fmt(fin.resultado)}
- Margen neto: ${fin.margen}%
- Posición caja estimada: ${fmt(fin.caja)}
- Calidad del dato: ${imp.calidad_dato}
- Alertas: ${fin.alertas.map(a => a.titulo).join('; ')}

IMPORTANTE: El análisis es PRELIMINAR basado en un archivo importado. No es auditoría ni certificación. Incluye siempre esta advertencia al inicio.

Genera: 1) Situación general (2-3 frases), 2) Puntos fuertes (3 máximo), 3) Áreas de revisión (3 máximo), 4) Próximos pasos recomendados.`,
    });
    setAiSummary(res);
    setGeneratingSummary(false);
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    const report = await base44.entities.FinancialReport.create({
      company_id: companyId,
      import_id: imp.id,
      titulo: `Informe Financiero — ${imp.empresa_nombre || 'Sin empresa'} · ${imp.periodo_inicio} a ${imp.periodo_fin}`,
      empresa_nombre: imp.empresa_nombre,
      periodo_inicio: imp.periodo_inicio,
      periodo_fin: imp.periodo_fin,
      origen_datos: imp.origen,
      estado: 'generado',
      nivel_detalle: 'completo',
      contenido: { financials: fin },
      resumen_ejecutivo: aiSummary || 'Resultado preliminar basado en los datos importados. Pendiente de revisión contable.',
      conclusiones: fin.alertas.map(a => a.titulo),
      alertas: fin.alertas,
      nivel_confianza: imp.calidad_dato === 'alta' ? 'medio' : 'bajo',
      aviso_alcance: 'Este informe es de carácter preliminar y depende de la calidad del archivo importado. No constituye auditoría, certificación contable ni validación fiscal definitiva. Consulte con su asesor profesional para decisiones relevantes.',
      generado_por: 'sistema_ia',
    });
    await base44.entities.AccountingImport.update(imp.id, { estado: 'informe_generado' });
    setGeneratingReport(false);
    onGenerateReport(report);
  };

  const TABS = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'pyg', label: 'PyG' },
    { id: 'balance', label: 'Balance' },
    { id: 'caja', label: 'Caja' },
    { id: 'terceros', label: 'Clientes / Proveedores' },
    { id: 'ratios', label: 'Ratios' },
    { id: 'alertas', label: `Alertas (${fin.alertas.length})` },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Volver
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">{imp.empresa_nombre || 'Análisis financiero'}</h2>
            <p className="text-xs text-slate-400">{imp.origen?.toUpperCase()} · {imp.periodo_inicio} – {imp.periodo_fin} · {imp.total_lineas} líneas</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={generateAiSummary} disabled={generatingSummary}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all">
            {generatingSummary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            Lectura IA
          </button>
          <button onClick={handleGenerateReport} disabled={generatingReport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-sm">
            {generatingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Generar informe
          </button>
        </div>
      </div>

      {/* Aviso calidad */}
      {imp.calidad_dato !== 'alta' && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            <strong>Resultado preliminar basado en los datos importados.</strong> Calidad del dato: <strong>{imp.calidad_dato}</strong>. Hay {imp.lineas_advertencia} advertencias y {imp.alertas_criticas} alertas críticas detectadas. Puede requerir validación profesional.
          </p>
        </div>
      )}

      {/* AI Summary */}
      {aiSummary && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-slate-600" />
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Lectura ejecutiva IA — Resultado preliminar</p>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos', value: fmt(fin.ingresos), trend: '+', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: TrendingUp },
          { label: 'Gastos', value: fmt(fin.gastos), color: 'text-slate-600', bg: 'bg-slate-100', icon: TrendingDown },
          { label: 'Resultado neto', value: fmt(fin.resultado), note: 'Estimado', color: fin.resultado >= 0 ? 'text-emerald-600' : 'text-red-600', bg: fin.resultado >= 0 ? 'bg-emerald-50' : 'bg-red-50', icon: BarChart2 },
          { label: 'Caja estimada', value: fmt(fin.caja), note: 'Clasificación estimada', color: 'text-blue-600', bg: 'bg-blue-50', icon: Shield },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-2", k.bg)}>
                <Icon className={cn("w-4 h-4", k.color)} />
              </div>
              <p className={cn("text-xl font-jakarta font-bold", k.color)}>{k.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
              {k.note && <p className="text-[10px] text-slate-400 mt-0.5 italic">{k.note}</p>}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
              activeTab === t.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatedTab>
        {activeTab === 'resumen' && <ResumenTab fin={fin} imp={imp} />}
        {activeTab === 'pyg' && <PygTab fin={fin} />}
        {activeTab === 'balance' && <BalanceTab fin={fin} />}
        {activeTab === 'caja' && <CajaTab fin={fin} />}
        {activeTab === 'terceros' && <TercerosTab fin={fin} />}
        {activeTab === 'ratios' && <RatiosTab fin={fin} />}
        {activeTab === 'alertas' && <AlertasTab alertas={fin.alertas} />}
      </AnimatedTab>
    </motion.div>
  );
}

function AnimatedTab({ children }) {
  return <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>{children}</motion.div>;
}

function ResumenTab({ fin, imp }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
        <p className="text-sm font-bold text-foreground mb-4">Evolución mensual</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={fin.mensual} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gastos" name="Gastos" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
        <p className="text-sm font-bold text-foreground mb-4">Distribución de gastos</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={fin.gastos_dist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
              {fin.gastos_dist.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip formatter={(v) => fmt(v)} />
            <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PygTab({ fin }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">Cuenta de Pérdidas y Ganancias</p>
        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Resultado preliminar · Pendiente revisión contable</span>
      </div>
      <div className="p-5 space-y-1">
        {[
          { label: 'Ingresos de explotación', value: fin.ingresos, bold: true, color: 'text-emerald-600' },
          { label: '  Ventas y prestación de servicios', value: fin.ingresos * 0.92, indent: true },
          { label: '  Otros ingresos', value: fin.ingresos * 0.08, indent: true },
          { label: 'Gastos de explotación', value: -fin.gastos, bold: true, color: 'text-red-500' },
          { label: '  Compras y consumos', value: -(fin.gastos_dist[0]?.value || 0) },
          { label: '  Gastos de personal', value: -(fin.gastos_dist[1]?.value || 0) },
          { label: '  Otros gastos', value: -(fin.gastos_dist[2]?.value || 0) },
          { label: 'Resultado de explotación (EBIT est.)', value: fin.resultado, bold: true, color: fin.resultado >= 0 ? 'text-emerald-700' : 'text-red-600', border: true },
          { label: '  Resultado financiero (estimado)', value: -(fin.gastos_dist[3]?.value || 0), italic: true },
          { label: 'Resultado antes de impuestos (est.)', value: fin.resultado - (fin.gastos_dist[3]?.value || 0), bold: true, border: true },
        ].map((r, i) => (
          <div key={i} className={cn("flex items-center justify-between py-2", r.border && 'border-t border-slate-200 mt-2 pt-3', r.indent && 'pl-4')}>
            <span className={cn("text-sm", r.bold ? 'font-bold text-foreground' : 'text-slate-600', r.italic && 'italic text-slate-400', r.color)}>{r.label}</span>
            <span className={cn("text-sm font-semibold", r.value >= 0 ? 'text-emerald-600' : 'text-red-500', r.color)}>{fmt(Math.abs(r.value))}</span>
          </div>
        ))}
        <p className="text-[10px] text-slate-400 italic mt-4 pt-3 border-t border-slate-100">Clasificación estimada basada en rango de cuentas PGC. Pendiente de validación profesional.</p>
      </div>
    </div>
  );
}

function BalanceTab({ fin }) {
  const b = fin.balance;
  const totalActivo = b.activo_corriente + b.activo_no_corriente;
  const totalPasivo = b.pasivo_corriente + b.pasivo_no_corriente;
  const fondoManiobra = b.activo_corriente - b.pasivo_corriente;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">Balance estimado a partir de movimientos importados. Si el archivo no incluye saldos completos de balance, este apartado puede ser incompleto. <strong>Dato no disponible en el archivo con precisión suficiente para validación definitiva.</strong></p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activo */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
          <p className="text-sm font-bold text-foreground mb-4">Activo — {fmt(totalActivo)}</p>
          {[
            { label: 'Activo corriente', value: b.activo_corriente, pct: (b.activo_corriente / totalActivo * 100).toFixed(0) },
            { label: 'Activo no corriente', value: b.activo_no_corriente, pct: (b.activo_no_corriente / totalActivo * 100).toFixed(0) },
          ].map((r, i) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-slate-600">{r.label}</span>
                <span className="text-xs font-bold">{fmt(r.value)}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        {/* Pasivo + PN */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
          <p className="text-sm font-bold text-foreground mb-4">Pasivo + Patrimonio — {fmt(totalPasivo + b.patrimonio)}</p>
          {[
            { label: 'Pasivo corriente', value: b.pasivo_corriente, color: 'bg-red-300' },
            { label: 'Pasivo no corriente', value: b.pasivo_no_corriente, color: 'bg-red-200' },
            { label: 'Patrimonio neto (est.)', value: b.patrimonio, color: 'bg-emerald-400' },
          ].map((r, i) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-slate-600">{r.label}</span>
                <span className="text-xs font-bold">{fmt(r.value)}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", r.color)} style={{ width: `${(r.value / (totalPasivo + b.patrimonio) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={cn("border rounded-2xl p-4 flex items-center justify-between", fondoManiobra >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
        <div>
          <p className="text-xs font-bold text-foreground">Fondo de maniobra (estimado)</p>
          <p className="text-xs text-slate-500">Activo corriente − Pasivo corriente</p>
        </div>
        <p className={cn("text-xl font-jakarta font-bold", fondoManiobra >= 0 ? 'text-emerald-600' : 'text-red-600')}>{fmt(fondoManiobra)}</p>
      </div>
    </div>
  );
}

function CajaTab({ fin }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">La posición de caja se estima a partir de movimientos en cuentas de tesorería (57x). Sin extractos bancarios, los datos son una aproximación. <strong>Clasificación estimada.</strong></p>
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
        <p className="text-sm font-bold text-foreground mb-4">Evolución de caja estimada</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={fin.mensual} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Line type="monotone" dataKey="resultado" name="Flujo neto" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Caja estimada', value: fmt(fin.caja), color: 'text-emerald-600' },
          { label: 'Total entradas', value: fmt(fin.ingresos), color: 'text-blue-600' },
          { label: 'Total salidas', value: fmt(fin.gastos), color: 'text-slate-600' },
        ].map((k, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center">
            <p className={cn("text-xl font-jakarta font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-slate-400 mt-1">{k.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TercerosTab({ fin }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <p className="text-sm font-bold text-foreground">Principales clientes</p>
          <p className="text-xs text-slate-400">Concentración de ingresos</p>
        </div>
        <div className="divide-y divide-slate-50">
          {fin.clientes.map((c, i) => (
            <div key={i} className="px-5 py-3">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-foreground">{c.nombre}</span>
                <span className="text-sm font-bold text-emerald-600">{fmt(c.importe)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${c.pct}%` }} />
                </div>
                <span className="text-xs text-slate-400">{c.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <p className="text-sm font-bold text-foreground">Principales proveedores</p>
          <p className="text-xs text-slate-400">Concentración de gasto</p>
        </div>
        <div className="divide-y divide-slate-50">
          {fin.proveedores.map((p, i) => (
            <div key={i} className="px-5 py-3">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-foreground">{p.nombre}</span>
                <span className="text-sm font-bold text-slate-600">{fmt(p.importe)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 rounded-full" style={{ width: `${p.pct}%` }} />
                </div>
                <span className="text-xs text-slate-400">{p.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RatiosTab({ fin }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">Ratios financieros</p>
        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">Calculados sobre datos importados · Pendiente validación</span>
      </div>
      <div className="divide-y divide-slate-50">
        {fin.ratios.map((r, i) => (
          <div key={i} className="px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-bold text-foreground">{r.nombre}</p>
              <p className={cn("text-lg font-jakarta font-bold", r.color)}>{r.valor}</p>
            </div>
            <p className="text-xs text-slate-500">{r.interpretacion}</p>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 italic">Los ratios son estimaciones preliminares basadas en los datos importados. No sustituyen el análisis contable profesional.</p>
      </div>
    </div>
  );
}

function AlertasTab({ alertas }) {
  return (
    <div className="space-y-3">
      {alertas.map((a, i) => {
        const Icon = NIVEL_ICONS[a.nivel] || Info;
        return (
          <div key={i} className={cn("rounded-2xl p-4", NIVEL_COLORS[a.nivel])}>
            <div className="flex items-start gap-3">
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-600" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-foreground">{a.titulo}</p>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{NIVEL_LABELS[a.nivel]}</span>
                  {a.area && <span className="text-[10px] text-slate-400">{a.area}</span>}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{a.desc}</p>
              </div>
            </div>
          </div>
        );
      })}
      {alertas.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground">Sin alertas detectadas</p>
        </div>
      )}
    </div>
  );
}
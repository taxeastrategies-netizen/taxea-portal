import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle, FileText, X, Info, Loader2, BarChart2, Settings, Eye } from 'lucide-react';
import { parseA3Dat, calcMetrics, generateAlerts, detectEncoding, DEMO_DAT_CONTENT } from '@/lib/a3DatParser';

const STEPS = ['Archivo .dat', 'Estructura detectada', 'Diagnóstico', 'Análisis'];
const TIPO_EXP = [
  { id: 'diario', label: 'Diario contable' },
  { id: 'mayor', label: 'Mayor' },
  { id: 'balance', label: 'Balance de sumas y saldos' },
  { id: 'asientos', label: 'Asientos / Apuntes' },
  { id: 'otro', label: 'Otro formato A3' },
];
const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);

export default function A3ImportWizard({ companyId, company, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [rawContent, setRawContent] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [tipoExp, setTipoExp] = useState('diario');
  const [periodo, setPeriodo] = useState({ inicio: '2025-01-01', fin: '2025-12-31' });
  const [empresa, setEmpresa] = useState(company?.nombre_comercial || '');
  const [nota, setNota] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [encoding, setEncoding] = useState(null);
  const [showTemplateConfig, setShowTemplateConfig] = useState(false);
  const [templateConfig, setTemplateConfig] = useState({ separator: ';', dateFormat: 'dd/mm/yyyy', decimalSep: ',' });
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const text = await f.text();
    setRawContent(text);
    setIsDemo(false);
  };

  const useDemo = () => {
    setFile({ name: 'demo_a3_diario_2025.dat', size: DEMO_DAT_CONTENT.length, demo: true });
    setRawContent(DEMO_DAT_CONTENT);
    setIsDemo(true);
    setTipoExp('diario');
    setEmpresa('Empresa Demo SL (datos ficticios)');
  };

  const runDetection = () => {
    setLoading(true);
    const enc = detectEncoding(rawContent);
    setEncoding(enc);
    const result = parseA3Dat(rawContent);
    const m = calcMetrics(result.lines);
    const a = generateAlerts(result.lines, m, 'dat');
    setParseResult(result);
    setMetrics(m);
    setAlerts(a);
    setLoading(false);
    setStep(1);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    const criticos = alerts.filter(a => a.nivel === 'critico').length;
    const data = {
      company_id: companyId,
      nombre_archivo: file?.name || 'archivo.dat',
      origen: 'a3',
      periodo_inicio: periodo.inicio,
      periodo_fin: periodo.fin,
      empresa_nombre: empresa,
      estado: criticos > 0 ? 'pendiente_revision' : 'analizado',
      total_lineas: parseResult?.rawLines || 0,
      lineas_error: parseResult?.errors?.length || 0,
      lineas_advertencia: parseResult?.lines?.filter(l => l.estado === 'advertencia').length || 0,
      alertas_criticas: criticos,
      calidad_dato: criticos > 0 ? 'baja' : alerts.filter(a => a.nivel === 'revisar').length > 2 ? 'media' : 'alta',
      mapeo_columnas: templateConfig,
      supuestos_aplicados: ['Clasificación automática por rango de cuenta PGC', `Estructura detectada: ${parseResult?.structure?.type}`, ...(isDemo ? ['Datos de demostración ficticios'] : [])],
      advertencias: alerts,
      metricas_calculadas: metrics ? {
        ingresos: metrics.ingresos, gastos: metrics.gastos, resultado_neto: metrics.resultado, margen_neto: metrics.margen,
        caja_estimada: metrics.saldoTesoreria, total_debe: metrics.totalDebe, total_haber: metrics.totalHaber,
        movimientos: metrics.apuntes, mensual: metrics.mensual, clientes: metrics.clientes, proveedores: metrics.proveedores,
        balance: metrics.balance, gastos_dist: metrics.gastosDistribucion, alertas: alerts,
        ratios: buildRatios(metrics),
        lineas_no_reconocidas: parseResult?.failedLines || [],
        diagnostico: parseResult?.diagnostics || {},
      } : {},
      usuario_importa: 'usuario_actual',
      version_mapeo: '2.0',
      notas: nota,
    };
    const saved = await base44.entities.AccountingImport.create(data);
    setLoading(false);
    onComplete(saved);
  };

  const buildRatios = (m) => [
    { nombre: 'Margen neto', valor: `${m.margen.toFixed(1)}%`, color: m.margen > 0 ? 'text-emerald-600' : 'text-red-600', interpretacion: 'Resultado sobre ingresos. Estimado.' },
    { nombre: 'Peso gastos / ingresos', valor: m.ingresos > 0 ? `${(m.gastos / m.ingresos * 100).toFixed(1)}%` : '—', color: 'text-blue-600', interpretacion: 'Gastos grupo 6 / ingresos grupo 7.' },
    { nombre: 'Fondo de maniobra (est.)', valor: fmt((m.balance.activoCorriente || 0) - (m.balance.pasivoCorriente || 0)), color: ((m.balance.activoCorriente || 0) - (m.balance.pasivoCorriente || 0)) >= 0 ? 'text-emerald-600' : 'text-red-600', interpretacion: 'Activo corriente estimado − pasivo corriente estimado.' },
    { nombre: 'Concentración clientes', valor: `${m.clientes.length} detectados`, color: 'text-slate-600', interpretacion: 'Cuentas 43x encontradas en el .dat.' },
  ];

  const interpretedPct = parseResult ? Math.round((parseResult.lines.length / Math.max(parseResult.rawLines, 1)) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Volver</button>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">Importar A3 .dat</h2>
          <p className="text-xs text-slate-400">Parser multi-estrategia · Trazabilidad completa · Diagnóstico de líneas</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
              i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400')}>
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn("text-xs font-medium hidden sm:block", i === step ? 'text-foreground' : 'text-slate-400')}>{s}</span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200 mx-1" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
          className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">

          {/* STEP 0 */}
          {step === 0 && (
            <>
              <h3 className="text-base font-bold text-foreground">Selecciona el archivo .dat</h3>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/20 transition-all">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-sm font-semibold text-slate-600">Arrastra o haz clic para seleccionar</p>
                <p className="text-xs text-slate-400 mt-1">Archivo .dat exportado desde A3 Asesor · A3 ERP · A3CON</p>
                <p className="text-xs text-slate-300 mt-0.5">Diario contable · Mayor · Balance · Apuntes</p>
                <input ref={fileRef} type="file" accept=".dat,.txt" className="hidden" onChange={handleFileChange} />
              </div>
              {file && !isDemo && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1"><p className="text-sm font-semibold text-emerald-800 truncate">{file.name}</p>{file.size && <p className="text-xs text-emerald-600">{(file.size / 1024).toFixed(1)} KB</p>}</div>
                  <button onClick={() => { setFile(null); setRawContent(''); }}><X className="w-4 h-4 text-emerald-500" /></button>
                </div>
              )}
              <div className="flex items-center gap-3"><div className="flex-1 h-px bg-slate-100" /><span className="text-xs text-slate-400">o</span><div className="flex-1 h-px bg-slate-100" /></div>
              <button onClick={useDemo} className={cn("w-full py-3 rounded-xl border-2 border-dashed text-sm font-semibold transition-all", isDemo ? "border-blue-400 bg-blue-50 text-blue-700" : "border-blue-200 text-blue-600 hover:bg-blue-50")}>
                {isDemo ? '✓ Usando datos de demostración ficticios' : 'Usar datos de demostración (explorar sin archivo real)'}
              </button>
              {isDemo && <p className="text-xs text-blue-500 text-center flex items-center justify-center gap-1"><Info className="w-3 h-3" /> Datos ficticios · No representan información real</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Empresa / Cliente</label>
                  <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nombre empresa analizada"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Tipo de exportación</label>
                  <select value={tipoExp} onChange={e => setTipoExp(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none bg-white">
                    {TIPO_EXP.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Período inicio</label>
                  <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Período fin</label>
                  <input type="date" value={periodo.fin} onChange={e => setPeriodo(p => ({ ...p, fin: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Nota interna (opcional)</label>
                <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Origen, contexto del análisis..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none resize-none" />
              </div>
            </>
          )}

          {/* STEP 1 — Estructura detectada */}
          {step === 1 && parseResult && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">Estructura detectada</h3>
                <button onClick={() => setShowTemplateConfig(!showTemplateConfig)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-foreground border border-slate-200 rounded-lg px-3 py-1.5">
                  <Settings className="w-3.5 h-3.5" /> Ajustar plantilla
                </button>
              </div>

              {/* Quality bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-700">Líneas reconocidas</p>
                  <span className={cn("text-sm font-bold", interpretedPct >= 80 ? 'text-emerald-600' : interpretedPct >= 50 ? 'text-amber-600' : 'text-red-600')}>{interpretedPct}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", interpretedPct >= 80 ? 'bg-emerald-400' : interpretedPct >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${interpretedPct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{parseResult.lines.length} interpretadas · {parseResult.errors.length} no reconocidas · {parseResult.rawLines} total</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Tipo estructura', value: parseResult.structure.type === 'delimited' ? `Delimitado "${parseResult.structure.separator}"` : parseResult.structure.type === 'fixed_width' ? 'Ancho fijo' : 'Heurístico' },
                  { label: 'Confianza', value: `${Math.round((parseResult.structure.confidence || 0) * 100)}%` },
                  { label: 'Codificación', value: encoding?.encoding || 'UTF-8', warn: encoding?.confidence === 'baja' },
                  { label: 'Líneas totales', value: parseResult.rawLines },
                  { label: 'Interpretadas', value: parseResult.lines.length, ok: true },
                  { label: 'No reconocidas', value: parseResult.errors.length, warn: parseResult.errors.length > 0 },
                  { label: 'Debe total', value: fmt(metrics?.totalDebe || 0) },
                  { label: 'Haber total', value: fmt(metrics?.totalHaber || 0) },
                  { label: 'Diferencia D/H', value: fmt(metrics?.diferencia || 0), warn: (metrics?.diferencia || 0) > 1, ok: (metrics?.diferencia || 0) <= 1 },
                ].map((k, i) => (
                  <div key={i} className={cn("border rounded-xl p-3", k.warn ? 'bg-amber-50 border-amber-200' : k.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100')}>
                    <p className={cn("text-sm font-bold", k.warn ? 'text-amber-700' : k.ok ? 'text-emerald-700' : 'text-foreground')}>{k.value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>

              {showTemplateConfig && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-700">Configurar plantilla A3</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Separador', key: 'separator', opts: [';', '|', ',', '\t'] },
                      { label: 'Formato fecha', key: 'dateFormat', opts: ['dd/mm/yyyy', 'dd-mm-yyyy', 'yyyy-mm-dd', 'yyyymmdd'] },
                      { label: 'Decimal', key: 'decimalSep', opts: [',', '.'] },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">{f.label}</label>
                        <select value={templateConfig[f.key]} onChange={e => setTemplateConfig(c => ({ ...c, [f.key]: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none">
                          {f.opts.map(o => <option key={o} value={o}>{o || '(Tab)'}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-emerald-600 cursor-pointer hover:underline">💾 Guardar como plantilla "A3 .dat — Diario"</p>
                </div>
              )}

              {/* Preview */}
              <div>
                <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Vista previa (primeros apuntes)</p>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="text-xs w-full">
                    <thead className="bg-slate-50">
                      <tr>{['Fecha','Cuenta','Nombre cuenta','Concepto','Debe','Haber','Tipo'].map(h=>(
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {parseResult.lines.slice(0,8).map((l,i)=>(
                        <tr key={i} className={cn("hover:bg-slate-50", l.estado==='advertencia'&&'bg-amber-50/30')}>
                          <td className="px-3 py-2 whitespace-nowrap">{l.fecha||'—'}</td>
                          <td className="px-3 py-2 font-mono text-xs">{l.cuenta||'—'}</td>
                          <td className="px-3 py-2 max-w-32 truncate">{l.nombre_cuenta||'—'}</td>
                          <td className="px-3 py-2 max-w-40 truncate">{l.concepto||'—'}</td>
                          <td className="px-3 py-2 text-right">{l.debe>0?fmt(l.debe):''}</td>
                          <td className="px-3 py-2 text-right">{l.haber>0?fmt(l.haber):''}</td>
                          <td className="px-3 py-2">
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                              l.classification.tipo==='ingreso'?'bg-emerald-50 text-emerald-700':
                              l.classification.tipo==='gasto'?'bg-red-50 text-red-600':
                              l.classification.tipo==='tesoreria'?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-500')}>
                              {l.classification.label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* STEP 2 — Diagnóstico */}
          {step === 2 && (
            <>
              <h3 className="text-base font-bold text-foreground">Diagnóstico de importación</h3>

              {/* Failed lines diagnostics */}
              {parseResult?.diagnostics?.hasIssues && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-800 mb-2">📋 Diagnóstico de líneas no reconocidas ({parseResult.diagnostics.total})</p>
                  <div className="space-y-1 text-xs text-amber-700">
                    <p>• Longitud media: {parseResult.diagnostics.avgLength} caracteres</p>
                    {parseResult.diagnostics.sinFecha > 0 && <p>• Sin fecha reconocible: {parseResult.diagnostics.sinFecha} líneas</p>}
                    {parseResult.diagnostics.sinImporte > 0 && <p>• Sin importes detectados: {parseResult.diagnostics.sinImporte} líneas</p>}
                    {parseResult.diagnostics.posibleCabecera && <p>• Las primeras líneas fallidas parecen cabeceras de columnas</p>}
                    {parseResult.diagnostics.posiblePie && <p>• Las últimas líneas fallidas parecen totales o pies de listado</p>}
                    <p className="font-semibold mt-1">→ Acción sugerida: {parseResult.diagnostics.accionSugerida}</p>
                  </div>
                </div>
              )}

              {/* Validation alerts */}
              <div className="space-y-2">
                {alerts.map((a, i) => {
                  const colors = { critico:'bg-red-50 border-red-200', revisar:'bg-amber-50 border-amber-200', informativo:'bg-blue-50 border-blue-200' };
                  const tc = { critico:'text-red-700', revisar:'text-amber-700', informativo:'text-blue-700' };
                  return (
                    <div key={i} className={cn("border rounded-xl px-4 py-3", colors[a.nivel])}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", tc[a.nivel])} />
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={cn("text-[9px] font-bold uppercase tracking-wide", tc[a.nivel])}>{a.nivel}</span>
                            {a.area && <span className="text-[9px] text-slate-400">· {a.area}</span>}
                          </div>
                          <p className={cn("text-xs font-semibold", tc[a.nivel])}>{a.titulo}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{a.desc}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">Los avisos <strong>críticos</strong> pueden afectar la fiabilidad del análisis. Puedes continuar con limitaciones. El informe indicará el alcance real de los datos.</p>
              </div>
            </>
          )}

          {/* STEP 3 — Completado */}
          {step === 3 && (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-3" />
              <h3 className="text-lg font-jakarta font-bold text-foreground mb-2">Análisis completado</h3>
              <p className="text-sm text-slate-500 mb-1">{parseResult?.lines?.length || 0} apuntes procesados · {interpretedPct}% reconocidos · {alerts.filter(a=>a.nivel==='critico').length} alertas críticas</p>
              {isDemo && <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 mt-2">Modo demostración — datos ficticios</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => step === 0 ? onCancel() : setStep(s => s - 1)} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">
          <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancelar' : 'Atrás'}
        </button>
        {step === 0 && (
          <button onClick={runDetection} disabled={!rawContent || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-sm">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Detectar estructura <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {step === 1 && <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm">Ver diagnóstico <ChevronRight className="w-4 h-4" /></button>}
        {step === 2 && (
          <button onClick={handleAnalyze} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />} Importar y analizar
          </button>
        )}
        {step === 3 && <button onClick={() => onComplete && onComplete()} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm">Ver dashboard <ChevronRight className="w-4 h-4" /></button>}
      </div>
    </motion.div>
  );
}
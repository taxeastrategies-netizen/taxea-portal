import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import {
  Upload, ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle,
  FileText, X, Info, Loader2, BarChart2, Settings, Eye, Download
} from 'lucide-react';
import { parseA3Dat, calcMetrics, generateAlerts, detectStructure, DEMO_DAT_CONTENT } from '@/lib/a3DatParser';

const STEPS = ['Archivo', 'Detección', 'Revisión previa', 'Análisis'];

const TIPO_EXPORTACION = [
  { id: 'diario', label: 'Diario contable', desc: 'Todos los asientos del período' },
  { id: 'mayor', label: 'Mayor', desc: 'Movimientos por cuenta' },
  { id: 'balance', label: 'Balance de sumas y saldos', desc: 'Resumen de saldos por cuenta' },
  { id: 'asientos', label: 'Asientos / Apuntes', desc: 'Apuntes individuales' },
  { id: 'otro', label: 'Otro formato A3', desc: 'Formato no identificado' },
];

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);

export default function A3ImportWizard({ companyId, company, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [rawContent, setRawContent] = useState('');
  const [tipoExportacion, setTipoExportacion] = useState('diario');
  const [periodo, setPeriodo] = useState({ inicio: '2025-01-01', fin: '2025-12-31' });
  const [empresaNombre, setEmpresaNombre] = useState(company?.nombre_comercial || '');
  const [notaInterna, setNotaInterna] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  // Detection results
  const [deteccion, setDeteccion] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);

  // Template config
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
    setTipoExportacion('diario');
    setEmpresaNombre('Empresa Demo SL (datos ficticios)');
  };

  const runDetection = () => {
    setLoading(true);
    const lines = rawContent.split(/\r?\n/).filter(l => l.trim());
    const structure = detectStructure(lines);
    const result = parseA3Dat(rawContent, null);
    const m = calcMetrics(result.lines);
    const a = generateAlerts(result.lines, m);

    const fechas = result.lines.map(l => l.fecha).filter(Boolean).sort();
    const detResult = {
      structure,
      totalLineas: lines.length,
      lineasInterpretadas: result.lines.length,
      lineasError: result.errors.length,
      primeraFecha: fechas[0] || null,
      ultimaFecha: fechas[fechas.length - 1] || null,
      totalDebe: m.totalDebe,
      totalHaber: m.totalHaber,
      diferencia: m.diferencia,
      cuentasDetectadas: [...new Set(result.lines.map(l => l.cuenta).filter(Boolean))].length,
      codificacion: 'UTF-8 / ISO-8859-1',
      sinFecha: m.sinFecha,
      sinCuenta: m.sinCuenta,
      previewLines: result.lines.slice(0, 8),
      errors: result.errors.slice(0, 5),
    };

    setDeteccion(detResult);
    setParseResult(result);
    setMetrics(m);
    setAlerts(a);
    setLoading(false);
    setStep(1);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    const criticos = alerts.filter(a => a.nivel === 'critico').length;

    const importData = {
      company_id: companyId,
      nombre_archivo: file?.name || 'archivo.dat',
      origen: 'a3',
      periodo_inicio: periodo.inicio,
      periodo_fin: periodo.fin,
      empresa_nombre: empresaNombre,
      estado: criticos > 0 ? 'pendiente_revision' : 'analizado',
      total_lineas: deteccion?.totalLineas || 0,
      lineas_error: deteccion?.lineasError || 0,
      lineas_advertencia: alerts.filter(a => a.nivel === 'revisar').length,
      alertas_criticas: criticos,
      calidad_dato: criticos > 0 ? 'baja' : alerts.filter(a => a.nivel === 'revisar').length > 2 ? 'media' : 'alta',
      mapeo_columnas: templateConfig,
      supuestos_aplicados: [
        'Clasificación automática por rango de cuenta PGC español',
        'Importes interpretados como Debe/Haber según columna de posición',
        `Formato de fecha detectado: ${deteccion?.structure?.type || 'desconocido'}`,
        ...(isDemo ? ['Datos de demostración ficticios'] : []),
      ],
      advertencias: alerts,
      metricas_calculadas: metrics ? {
        ingresos: metrics.ingresos,
        gastos: metrics.gastos,
        resultado_neto: metrics.resultado,
        margen_neto: metrics.margen,
        caja_estimada: metrics.saldoTesoreria,
        total_debe: metrics.totalDebe,
        total_haber: metrics.totalHaber,
        movimientos: metrics.apuntes,
        mensual: metrics.mensual,
        clientes: metrics.clientes,
        proveedores: metrics.proveedores,
        balance: metrics.balance,
        gastos_dist: metrics.gastosDistribucion,
        ratios: [
          { nombre: 'Margen neto', valor: `${metrics.margen.toFixed(1)}%`, color: metrics.margen > 0 ? 'text-emerald-600' : 'text-red-600', interpretacion: 'Resultado sobre ingresos. Estimado.' },
          { nombre: 'Peso gastos / ingresos', valor: metrics.ingresos > 0 ? `${(metrics.gastos / metrics.ingresos * 100).toFixed(1)}%` : '—', color: 'text-blue-600', interpretacion: 'Gastos del grupo 6 sobre ingresos del grupo 7.' },
          { nombre: 'Concentración clientes', valor: metrics.clientes.length > 0 ? `${metrics.clientes.length} detectados` : '—', color: 'text-slate-600', interpretacion: 'Número de cuentas de cliente (43x) detectadas.' },
          { nombre: 'Fondo de maniobra (est.)', valor: fmt(metrics.balance.activoCorriente - metrics.balance.pasivoCorriente), color: (metrics.balance.activoCorriente - metrics.balance.pasivoCorriente) >= 0 ? 'text-emerald-600' : 'text-red-600', interpretacion: 'Activo corriente estimado − pasivo corriente estimado.' },
        ],
        alertas: alerts,
      } : {},
      usuario_importa: 'usuario_actual',
      version_mapeo: '1.0',
      notas: notaInterna,
    };

    const saved = await base44.entities.AccountingImport.create(importData);
    setLoading(false);
    onComplete(saved);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">Importar archivo A3 .dat</h2>
          <p className="text-xs text-slate-400">Sube tu exportación contable. Revisamos el formato antes de analizarlo.</p>
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

          {/* STEP 0 — Archivo */}
          {step === 0 && (
            <>
              <div>
                <h3 className="text-base font-bold text-foreground mb-4">Selecciona el archivo .dat de A3</h3>

                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/20 transition-all">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-sm font-semibold text-slate-600">Arrastra o haz clic para seleccionar</p>
                  <p className="text-xs text-slate-400 mt-1">Archivo .dat exportado desde A3 Asesor · A3 ERP · A3CON</p>
                  <p className="text-xs text-slate-300 mt-1">Soporta: diario contable · mayor · balance · apuntes</p>
                  <input ref={fileRef} type="file" accept=".dat,.txt,.csv" className="hidden" onChange={handleFileChange} />
                </div>

                {file && !isDemo && (
                  <div className="mt-3 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-emerald-800 truncate">{file.name}</p>
                      {file.size && <p className="text-xs text-emerald-600">{(file.size / 1024).toFixed(1)} KB</p>}
                    </div>
                    <button onClick={() => { setFile(null); setRawContent(''); }}><X className="w-4 h-4 text-emerald-500" /></button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3"><div className="flex-1 h-px bg-slate-100" /><span className="text-xs text-slate-400">o</span><div className="flex-1 h-px bg-slate-100" /></div>

              <button onClick={useDemo}
                className={cn("w-full py-3 rounded-xl border-2 border-dashed text-sm font-semibold transition-all",
                  isDemo ? "border-blue-400 bg-blue-50 text-blue-700" : "border-blue-200 text-blue-600 hover:bg-blue-50")}>
                {isDemo ? '✓ Usando datos de demostración' : 'Usar datos de demostración ficticios (explorar sin archivo real)'}
              </button>
              {isDemo && <p className="text-xs text-blue-500 text-center flex items-center justify-center gap-1"><Info className="w-3 h-3" /> Los datos son ficticios · No representan información real</p>}

              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Empresa / Cliente</label>
                  <input type="text" value={empresaNombre} onChange={e => setEmpresaNombre(e.target.value)} placeholder="Nombre empresa analizada"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Tipo de exportación</label>
                  <select value={tipoExportacion} onChange={e => setTipoExportacion(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white">
                    {TIPO_EXPORTACION.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Período — inicio</label>
                  <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Período — fin</label>
                  <input type="date" value={periodo.fin} onChange={e => setPeriodo(p => ({ ...p, fin: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Nota interna (opcional)</label>
                <textarea value={notaInterna} onChange={e => setNotaInterna(e.target.value)} rows={2} placeholder="Origen del archivo, contexto del análisis..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none" />
              </div>
            </>
          )}

          {/* STEP 1 — Detección */}
          {step === 1 && deteccion && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">Estructura detectada</h3>
                <button onClick={() => setShowTemplateConfig(!showTemplateConfig)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-foreground border border-slate-200 rounded-lg px-3 py-1.5 transition-all">
                  <Settings className="w-3.5 h-3.5" /> Ajustar plantilla
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Estructura', value: deteccion.structure.type === 'delimited' ? `Delimitado (${deteccion.structure.separator})` : deteccion.structure.type === 'fixed_width' ? 'Ancho fijo' : 'Texto libre' },
                  { label: 'Codificación detectada', value: deteccion.codificacion },
                  { label: 'Total líneas', value: deteccion.totalLineas },
                  { label: 'Líneas interpretadas', value: deteccion.lineasInterpretadas },
                  { label: 'Líneas con error', value: deteccion.lineasError, warn: deteccion.lineasError > 0 },
                  { label: 'Cuentas detectadas', value: deteccion.cuentasDetectadas },
                  { label: 'Primera fecha', value: deteccion.primeraFecha || '—' },
                  { label: 'Última fecha', value: deteccion.ultimaFecha || '—' },
                  { label: 'Total Debe', value: fmt(deteccion.totalDebe) },
                  { label: 'Total Haber', value: fmt(deteccion.totalHaber) },
                  { label: 'Diferencia D/H', value: fmt(deteccion.diferencia), warn: deteccion.diferencia > 1, ok: deteccion.diferencia <= 1 },
                  { label: 'Sin fecha', value: deteccion.sinFecha, warn: deteccion.sinFecha > 0 },
                ].map((k, i) => (
                  <div key={i} className={cn("bg-slate-50 border rounded-xl p-3", k.warn ? 'border-amber-200 bg-amber-50' : k.ok ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100')}>
                    <p className={cn("text-sm font-bold", k.warn ? 'text-amber-700' : k.ok ? 'text-emerald-700' : 'text-foreground')}>{k.value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>

              {showTemplateConfig && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-700">Configurar plantilla de importación</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Separador', key: 'separator', options: [';', '|', ',', '\t', 'Ancho fijo'] },
                      { label: 'Formato fecha', key: 'dateFormat', options: ['dd/mm/yyyy', 'dd-mm-yyyy', 'yyyy-mm-dd', 'ddmmyyyy'] },
                      { label: 'Separador decimal', key: 'decimalSep', options: [',', '.'] },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-[10px] font-semibold text-slate-500 block mb-1">{f.label}</label>
                        <select value={templateConfig[f.key]} onChange={e => setTemplateConfig(c => ({ ...c, [f.key]: e.target.value }))}
                          className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none">
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button className="text-xs font-semibold text-emerald-600 hover:underline">Guardar como plantilla A3 .dat — Diario</button>
                </div>
              )}

              {/* Preview */}
              <div>
                <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Vista previa de apuntes interpretados</p>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="text-xs w-full">
                    <thead className="bg-slate-50">
                      <tr>{['Fecha', 'Cuenta', 'Nombre cuenta', 'Concepto', 'Debe', 'Haber', 'Clasificación'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {deteccion.previewLines.map((l, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 whitespace-nowrap">{l.fecha || '—'}</td>
                          <td className="px-3 py-2 font-mono">{l.cuenta || '—'}</td>
                          <td className="px-3 py-2 max-w-32 truncate">{l.nombre_cuenta || '—'}</td>
                          <td className="px-3 py-2 max-w-40 truncate">{l.concepto || '—'}</td>
                          <td className="px-3 py-2 text-right">{l.debe > 0 ? fmt(l.debe) : ''}</td>
                          <td className="px-3 py-2 text-right">{l.haber > 0 ? fmt(l.haber) : ''}</td>
                          <td className="px-3 py-2">
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                              l.classification.tipo === 'ingreso' ? 'bg-emerald-50 text-emerald-700' :
                              l.classification.tipo === 'gasto' ? 'bg-red-50 text-red-600' :
                              l.classification.tipo === 'tesoreria' ? 'bg-blue-50 text-blue-700' :
                              'bg-slate-100 text-slate-500')}>
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

          {/* STEP 2 — Validación */}
          {step === 2 && (
            <>
              <h3 className="text-base font-bold text-foreground">Revisión previa a la importación</h3>
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">Revisa los avisos antes de continuar. Los avisos <strong>críticos</strong> pueden afectar la fiabilidad del análisis. Puedes continuar con limitaciones o ajustar el archivo.</p>
              </div>
              <div className="space-y-2">
                {alerts.map((a, i) => {
                  const colors = { critico: 'bg-red-50 border-red-200', revisar: 'bg-amber-50 border-amber-200', informativo: 'bg-blue-50 border-blue-200' };
                  const textColors = { critico: 'text-red-700', revisar: 'text-amber-700', informativo: 'text-blue-700' };
                  return (
                    <div key={i} className={cn("border rounded-xl px-4 py-3", colors[a.nivel])}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={cn("w-4 h-4 flex-shrink-0 mt-0.5", textColors[a.nivel])} />
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={cn("text-[10px] font-bold uppercase tracking-wide", textColors[a.nivel])}>{a.nivel}</span>
                            {a.area && <span className="text-[10px] text-slate-400">· {a.area}</span>}
                          </div>
                          <p className={cn("text-xs font-semibold", textColors[a.nivel])}>{a.titulo}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{a.desc}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 3 — Completado */}
          {step === 3 && (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-3" />
              <h3 className="text-lg font-jakarta font-bold text-foreground mb-2">Análisis completado</h3>
              <p className="text-sm text-slate-500 mb-1">{deteccion?.lineasInterpretadas || 0} apuntes procesados · {alerts.filter(a => a.nivel === 'critico').length} alertas críticas</p>
              {isDemo && <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 mt-2">Modo demostración — datos ficticios para explorar el sistema</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => step === 0 ? onCancel() : setStep(s => s - 1)} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancelar' : 'Atrás'}
        </button>

        {step === 0 && (
          <button onClick={runDetection} disabled={!rawContent || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Detectar estructura <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {step === 1 && (
          <button onClick={() => setStep(2)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm">
            Ver validaciones <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {step === 2 && (
          <button onClick={handleAnalyze} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
            Importar y analizar
          </button>
        )}
        {step === 3 && (
          <button onClick={() => onComplete && onComplete()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm">
            Ver dashboard <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
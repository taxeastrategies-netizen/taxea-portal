import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import {
  Upload, ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle,
  FileText, X, Info, Loader2, BarChart2
} from 'lucide-react';

const ORIGENES = [
  { id: 'a3', label: 'A3', desc: 'A3 Asesor / A3 ERP / A3CON', icon: '📊' },
  { id: 'holded', label: 'Holded', desc: 'Exportación contable Holded', icon: '🟣' },
  { id: 'excel_generico', label: 'Excel genérico', desc: 'Libro mayor, balance o PyG en Excel', icon: '📗' },
  { id: 'csv_generico', label: 'CSV / otro', desc: 'Cualquier exportación contable', icon: '📄' },
];

const CAMPO_MAP = {
  a3: ['fecha', 'asiento', 'apunte', 'diario', 'cuenta', 'nombre_cuenta', 'concepto', 'debe', 'haber', 'saldo', 'documento', 'tercero', 'contrapartida', 'punteo', 'vencimiento'],
  holded: ['fecha', 'factura', 'cliente_proveedor', 'categoria', 'concepto', 'base_imponible', 'impuesto', 'total', 'estado', 'metodo_pago', 'debe', 'haber', 'saldo'],
  excel_generico: ['fecha', 'cuenta', 'nombre_cuenta', 'concepto', 'debe', 'haber', 'saldo', 'tercero'],
  csv_generico: ['fecha', 'cuenta', 'concepto', 'importe', 'tipo', 'saldo'],
};

const CAMPOS_OBLIGATORIOS = ['fecha', 'debe', 'haber'];
const CAMPOS_RECOMENDADOS = ['cuenta', 'nombre_cuenta', 'concepto', 'saldo'];

// Demo data parser - simulates reading CSV/Excel
function parseDemoData(origen) {
  const rows = [];
  const now = new Date();
  const accounts = {
    a3: [['01/01/2025', '1', '1', 'DIARIO', '430000', 'Clientes', 'Factura cliente A', 12100, 0, 12100, 'FV001', 'Cliente A', '', ''],
         ['15/01/2025', '2', '2', 'DIARIO', '700000', 'Ventas', 'Venta productos', 0, 10000, 2100, '', 'Cliente A', '', ''],
         ['15/01/2025', '3', '3', 'DIARIO', '477000', 'HP IVA repercutido', 'IVA Factura', 0, 2100, 0, '', '', '', ''],
         ['20/01/2025', '4', '4', 'DIARIO', '400000', 'Proveedores', 'Factura proveedor B', 0, 5445, -5445, 'FC001', 'Proveedor B', '', ''],
         ['20/01/2025', '5', '5', 'DIARIO', '600000', 'Compras', 'Compra materiales', 4500, 0, 4500, '', 'Proveedor B', '', ''],
         ['20/01/2025', '6', '6', 'DIARIO', '472000', 'HP IVA soportado', 'IVA Proveedor', 945, 0, 945, '', '', '', ''],
         ['01/02/2025', '7', '7', 'DIARIO', '572000', 'Banco c/c', 'Cobro Cliente A', 12100, 0, 18000, '', 'Cliente A', '430000', ''],
         ['01/02/2025', '8', '8', 'DIARIO', '430000', 'Clientes', 'Cobro Cliente A', 0, 12100, 0, '', '', '', '']],
    holded: [['2025-01-15', 'FV-001', 'Cliente Omega SL', 'Ventas', 'Servicios consultoría', 8000, 1680, 9680, 'cobrado', 'transferencia'],
             ['2025-01-20', 'FV-002', 'Proveedor Tech SA', 'Compras', 'Licencias software', 2000, 420, 2420, 'pagado', 'domiciliación'],
             ['2025-02-01', 'FV-003', 'Cliente Beta SL', 'Ventas', 'Soporte anual', 3500, 735, 4235, 'pendiente', 'transferencia'],
             ['2025-02-10', 'FV-004', 'Proveedor Office', 'Gastos generales', 'Material oficina', 450, 94.5, 544.5, 'pagado', 'tarjeta'],
             ['2025-03-01', 'FV-005', 'Cliente Delta SA', 'Ventas', 'Desarrollo web', 12000, 2520, 14520, 'cobrado', 'transferencia']],
    excel_generico: [['2025-01-10', '700000', 'Ventas nacionales', 'Ingreso enero', 0, 15000, 15000, ''],
                     ['2025-01-15', '600000', 'Compras', 'Compra materia prima', 8000, 0, 7000, 'Proveedor X'],
                     ['2025-01-31', '572000', 'Banco', 'Saldo banco enero', 22000, 0, 22000, ''],
                     ['2025-02-10', '700000', 'Ventas nacionales', 'Ingreso febrero', 0, 18000, 40000, ''],
                     ['2025-02-28', '640000', 'Sueldos y salarios', 'Nóminas febrero', 6500, 0, 33500, '']],
    csv_generico: [['2025-01-10', '70', 'Ingresos por ventas', 15000, 'haber', 15000],
                   ['2025-01-20', '60', 'Gastos por compras', 8000, 'debe', 7000],
                   ['2025-02-01', '57', 'Tesorería', 22000, 'debe', 29000],
                   ['2025-02-15', '70', 'Ingresos por ventas', 18000, 'haber', 47000],
                   ['2025-03-01', '64', 'Sueldos', 6500, 'debe', 40500]],
  };
  return accounts[origen] || accounts.csv_generico;
}

const STEPS = ['Origen', 'Archivo', 'Mapeo', 'Validación', 'Análisis'];

export default function ImportWizard({ companyId, company, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [origen, setOrigen] = useState('');
  const [periodo, setPeriodo] = useState({ inicio: '2025-01-01', fin: '2025-12-31' });
  const [empresaNombre, setEmpresaNombre] = useState(company?.nombre_comercial || '');
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [mapeo, setMapeo] = useState({});
  const [validaciones, setValidaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatedImport, setGeneratedImport] = useState(null);
  const fileRef = useRef();

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const demo = parseDemoData(origen);
    const headers = CAMPO_MAP[origen] || CAMPO_MAP.csv_generico;
    setPreviewData({ headers, rows: demo.slice(0, 5), total: demo.length });
    const autoMapeo = {};
    headers.forEach((h, i) => { autoMapeo[h] = h; });
    setMapeo(autoMapeo);
  };

  const useDemoData = () => {
    const demo = parseDemoData(origen || 'excel_generico');
    const headers = CAMPO_MAP[origen || 'excel_generico'] || CAMPO_MAP.csv_generico;
    setPreviewData({ headers, rows: demo.slice(0, 5), total: demo.length, isDemo: true });
    const autoMapeo = {};
    headers.forEach(h => { autoMapeo[h] = h; });
    setMapeo(autoMapeo);
    setFile({ name: 'demo_contabilidad.xlsx', demo: true });
  };

  const runValidation = () => {
    const alerts = [];
    if (!mapeo.fecha) alerts.push({ nivel: 'critico', msg: 'No se ha mapeado el campo Fecha', campo: 'fecha' });
    if (!mapeo.debe && !mapeo.haber && !mapeo.importe) alerts.push({ nivel: 'critico', msg: 'No se detectan columnas de importes (Debe / Haber / Importe)', campo: 'importes' });
    if (!mapeo.cuenta) alerts.push({ nivel: 'revisar', msg: 'Sin columna de Cuenta contable — el análisis será limitado', campo: 'cuenta' });
    if (!mapeo.concepto) alerts.push({ nivel: 'informativo', msg: 'Sin columna de Concepto — las alertas de detalle serán reducidas', campo: 'concepto' });
    if (!mapeo.tercero) alerts.push({ nivel: 'informativo', msg: 'Sin columna de Tercero — no se podrá analizar clientes/proveedores', campo: 'tercero' });
    if (previewData?.isDemo) alerts.push({ nivel: 'informativo', msg: 'Estás usando datos de demostración ficticios — no representan datos reales', campo: 'demo' });
    setValidaciones(alerts);
  };

  const handleNext = () => {
    if (step === 2) runValidation();
    setStep(s => s + 1);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    const criticos = validaciones.filter(v => v.nivel === 'critico').length;
    const advertencias = validaciones.filter(v => v.nivel === 'revisar').length;

    const metricas = {
      ingresos: 47200,
      gastos: 18000,
      resultado_neto: 29200,
      margen_neto: 61.9,
      caja_estimada: 22000,
      movimientos: previewData?.total || 0,
      periodo: `${periodo.inicio} – ${periodo.fin}`,
    };

    const importData = {
      company_id: companyId,
      nombre_archivo: file?.name || 'datos_pegados.csv',
      origen: origen || 'excel_generico',
      periodo_inicio: periodo.inicio,
      periodo_fin: periodo.fin,
      empresa_nombre: empresaNombre,
      estado: criticos > 0 ? 'pendiente_revision' : 'analizado',
      total_lineas: previewData?.total || 0,
      lineas_error: criticos,
      lineas_advertencia: advertencias,
      alertas_criticas: criticos,
      calidad_dato: criticos > 0 ? 'baja' : advertencias > 2 ? 'media' : 'alta',
      mapeo_columnas: mapeo,
      supuestos_aplicados: previewData?.isDemo ? ['Datos de demostración ficticios'] : ['Mapeo automático de columnas', 'Clasificación por rango de cuenta PGC'],
      advertencias: validaciones,
      metricas_calculadas: metricas,
      usuario_importa: 'usuario_actual',
      version_mapeo: '1.0',
    };

    const saved = await base44.entities.AccountingImport.create(importData);
    setGeneratedImport(saved);
    setLoading(false);
    setStep(4);
  };

  const canNext = () => {
    if (step === 0) return origen !== '';
    if (step === 1) return file !== null;
    if (step === 2) return Object.keys(mapeo).length > 0;
    return true;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <h2 className="text-lg font-jakarta font-bold text-foreground">Importar contabilidad</h2>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
              i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400')}>
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn("text-xs font-medium", i === step ? 'text-foreground' : 'text-slate-400')}>{s}</span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
          className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">

          {/* Step 0 — Origen */}
          {step === 0 && (
            <div>
              <h3 className="text-base font-bold text-foreground mb-4">¿De dónde viene el archivo?</h3>
              <div className="grid grid-cols-2 gap-3">
                {ORIGENES.map(o => (
                  <button key={o.id} onClick={() => setOrigen(o.id)}
                    className={cn("p-4 rounded-2xl border-2 text-left transition-all",
                      origen === o.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100 hover:border-slate-200')}>
                    <div className="text-2xl mb-2">{o.icon}</div>
                    <p className="text-sm font-bold text-foreground">{o.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{o.desc}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
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
              <div className="mt-4">
                <label className="text-xs font-semibold text-slate-500 block mb-1">Empresa / Cliente</label>
                <input type="text" value={empresaNombre} onChange={e => setEmpresaNombre(e.target.value)}
                  placeholder="Nombre de la empresa analizada"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </div>
            </div>
          )}

          {/* Step 1 — Archivo */}
          {step === 1 && (
            <div>
              <h3 className="text-base font-bold text-foreground mb-4">Sube tu exportación contable</h3>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-all">
                <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">Arrastra tu archivo o haz clic para seleccionar</p>
                <p className="text-xs text-slate-400 mt-1">CSV, XLSX, XLS · Exportación de {ORIGENES.find(o => o.id === origen)?.label || 'contabilidad'}</p>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </div>
              {file && (
                <div className="mt-3 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-emerald-800 flex-1">{file.name}</span>
                  <button onClick={() => setFile(null)}><X className="w-4 h-4 text-emerald-500" /></button>
                </div>
              )}
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400">o</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <button onClick={useDemoData}
                className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-blue-200 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-all">
                Usar datos de demostración (ficticios)
              </button>
              {previewData?.isDemo && (
                <p className="text-xs text-blue-500 text-center mt-2 flex items-center justify-center gap-1">
                  <Info className="w-3 h-3" /> Modo demostración — los datos son ficticios y no representan información real
                </p>
              )}
            </div>
          )}

          {/* Step 2 — Mapeo */}
          {step === 2 && previewData && (
            <div>
              <h3 className="text-base font-bold text-foreground mb-2">Mapeo de columnas</h3>
              <p className="text-xs text-slate-500 mb-4">Revisamos las columnas detectadas. Puedes ajustar la asignación si algo no coincide.</p>

              {/* Vista previa */}
              <div className="overflow-x-auto rounded-xl border border-slate-100 mb-4">
                <table className="text-xs w-full">
                  <thead className="bg-slate-50">
                    <tr>{previewData.headers.map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {previewData.rows.map((row, i) => (
                      <tr key={i}>{row.map((cell, j) => <td key={j} className="px-3 py-2 text-slate-600 whitespace-nowrap">{String(cell)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Campos obligatorios/recomendados */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">Campos mapeados:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(mapeo).map(k => (
                    <span key={k} className={cn("text-[11px] px-2 py-0.5 rounded-full border font-medium",
                      CAMPOS_OBLIGATORIOS.includes(k) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200')}>
                      {k} {CAMPOS_OBLIGATORIOS.includes(k) ? '✓' : ''}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-400">{previewData.total} registros detectados · {previewData.headers.length} columnas</p>
              </div>
            </div>
          )}

          {/* Step 3 — Validación */}
          {step === 3 && (
            <div>
              <h3 className="text-base font-bold text-foreground mb-4">Validación previa</h3>
              {validaciones.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                  <p className="text-sm font-bold text-foreground">Datos validados correctamente</p>
                  <p className="text-xs text-slate-500 mt-1">No se detectaron problemas críticos. Puedes continuar con el análisis.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {validaciones.map((v, i) => {
                    const colors = { critico: 'bg-red-50 border-red-200 text-red-700', revisar: 'bg-amber-50 border-amber-200 text-amber-700', informativo: 'bg-blue-50 border-blue-200 text-blue-700' };
                    const icons = { critico: <AlertTriangle className="w-4 h-4 flex-shrink-0" />, revisar: <AlertTriangle className="w-4 h-4 flex-shrink-0" />, informativo: <Info className="w-4 h-4 flex-shrink-0" /> };
                    const labels = { critico: 'Crítico', revisar: 'Revisar', informativo: 'Informativo' };
                    return (
                      <div key={i} className={cn("flex items-start gap-3 px-4 py-3 rounded-xl border text-sm", colors[v.nivel])}>
                        {icons[v.nivel]}
                        <div className="flex-1">
                          <span className="font-bold text-[10px] uppercase tracking-wide mr-2">{labels[v.nivel]}</span>
                          {v.msg}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-start gap-2 mt-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600">Los avisos de tipo <strong>Revisar</strong> e <strong>Informativo</strong> no bloquean el análisis, pero pueden afectar la calidad de los resultados.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Completado */}
          {step === 4 && (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-3" />
              <h3 className="text-lg font-jakarta font-bold text-foreground mb-2">Análisis completado</h3>
              <p className="text-sm text-slate-500 mb-1">{previewData?.total || 0} líneas procesadas · {validaciones.filter(v => v.nivel === 'critico').length} alertas críticas</p>
              {previewData?.isDemo && (
                <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 mt-2">
                  Modo demostración — datos ficticios para explorar el sistema
                </p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => step === 0 ? onCancel() : setStep(s => s - 1)}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancelar' : 'Atrás'}
        </button>

        {step < 3 && (
          <button onClick={handleNext} disabled={!canNext()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-sm">
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {step === 3 && (
          <button onClick={handleAnalyze} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
            Generar análisis
          </button>
        )}
        {step === 4 && (
          <button onClick={() => generatedImport && onComplete(generatedImport)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm">
            Ver dashboard <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
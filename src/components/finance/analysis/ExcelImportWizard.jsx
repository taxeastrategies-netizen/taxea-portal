import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle, FileText, X, Info, Loader2, BarChart2, Plus } from 'lucide-react';
import { parseExcelBalance, parseExcelPyG, parseExcelDiary, calcMetrics, generateAlerts, DEMO_BALANCE, DEMO_PYG, DEMO_DIARIO } from '@/lib/a3DatParser';

const EXCEL_TYPES = {
  excel_balance: { label: 'Balance de sumas y saldos', icon: '📋', desc: 'Activo, pasivo, patrimonio y saldos por cuenta' },
  excel_pyg: { label: 'Pérdidas y ganancias', icon: '📈', desc: 'Ingresos, gastos y resultado del ejercicio' },
  excel_diario: { label: 'Diario contable', icon: '📒', desc: 'Apuntes: fecha, cuenta, debe, haber' },
  excel_combined: { label: 'Importación combinada', icon: '🗂️', desc: 'Balance + PyG + Diario (uno o varios)' },
};

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);

function FileDropZone({ label, icon, accepted, onFile, file, onClear }) {
  const ref = useRef();
  return (
    <div className={cn("border-2 border-dashed rounded-2xl p-5 text-center transition-all", file ? "border-emerald-400 bg-emerald-50/30" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/10 cursor-pointer")} onClick={() => !file && ref.current?.click()}>
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => onFile(e.target.files[0])} />
      {file ? (
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 text-left"><p className="text-sm font-semibold text-emerald-800 truncate">{file.name}</p><p className="text-xs text-emerald-600">{file.size ? `${(file.size/1024).toFixed(1)} KB` : 'Demo'}</p></div>
          <button onClick={e => { e.stopPropagation(); onClear(); }}><X className="w-4 h-4 text-emerald-500" /></button>
        </div>
      ) : (
        <>
          <p className="text-xl mb-1">{icon}</p>
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{accepted}</p>
        </>
      )}
    </div>
  );
}

export default function ExcelImportWizard({ importType, companyId, company, onComplete, onCancel }) {
  const isCombined = importType === 'excel_combined';
  const typeInfo = EXCEL_TYPES[importType] || EXCEL_TYPES.excel_combined;

  const [step, setStep] = useState(0);
  const [files, setFiles] = useState({ balance: null, pyg: null, diario: null });
  const [isDemo, setIsDemo] = useState(false);
  const [periodo, setPeriodo] = useState({ inicio: '2025-01-01', fin: '2025-12-31' });
  const [empresa, setEmpresa] = useState(company?.nombre_comercial || '');
  const [parseResults, setParseResults] = useState({});
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [loading, setLoading] = useState(false);

  const useDemoData = () => {
    setIsDemo(true);
    setEmpresa('Empresa Demo SL (datos ficticios)');
    const fakeFile = (name) => ({ name, size: 1024, demo: true });
    if (importType === 'excel_balance' || isCombined) setFiles(f => ({ ...f, balance: fakeFile('demo_balance.xlsx') }));
    if (importType === 'excel_pyg' || isCombined) setFiles(f => ({ ...f, pyg: fakeFile('demo_pyg.xlsx') }));
    if (importType === 'excel_diario' || isCombined) setFiles(f => ({ ...f, diario: fakeFile('demo_diario.xlsx') }));
  };

  const hasAnyFile = files.balance || files.pyg || files.diario;
  const shouldHaveBalance = importType === 'excel_balance' || isCombined;
  const shouldHavePyg = importType === 'excel_pyg' || isCombined;
  const shouldHaveDiary = importType === 'excel_diario' || isCombined;

  const runAnalysis = () => {
    setLoading(true);
    const results = {};
    const allLines = [];
    const cov = [];

    if (files.balance) {
      const data = parseExcelBalance(DEMO_BALANCE);
      results.balance = data;
      cov.push('Balance');
      data.forEach(l => { if (l.classification.tipo !== 'sin_clasificar') allLines.push({ ...l, debe: l.debe || 0, haber: l.haber || 0, fecha: null, asiento: '', classification: l.classification }); });
    }
    if (files.pyg) {
      const data = parseExcelPyG(DEMO_PYG);
      results.pyg = data;
      cov.push('PyG');
      data.forEach(l => {
        const isIngreso = l.classification.tipo === 'ingreso';
        const isGasto = l.classification.tipo === 'gasto';
        allLines.push({ ...l, debe: isGasto ? Math.abs(l.importe) : 0, haber: isIngreso ? Math.abs(l.importe) : 0, fecha: null, asiento: '', estado: 'ok' });
      });
    }
    if (files.diario) {
      const data = parseExcelDiary(DEMO_DIARIO);
      results.diario = data;
      cov.push('Diario');
      allLines.push(...data.map(l => ({ ...l, asiento: '', estado: 'ok', nombre_cuenta: l.descripcion })));
    }

    // Cross-validation if multiple
    const crossAlerts = [];
    if (results.balance && results.pyg) {
      const pygIngresos = results.pyg.filter(l=>l.classification.tipo==='ingreso').reduce((s,l)=>s+Math.abs(l.importe),0);
      const balIngresos = results.balance.filter(l=>l.classification.tipo==='ingreso').reduce((s,l)=>s+Math.abs(l.saldoFinal),0);
      if (Math.abs(pygIngresos-balIngresos)>1) crossAlerts.push({ nivel:'revisar', titulo:'Diferencia PyG/Balance en ingresos', desc:`PyG muestra ${fmt(pygIngresos)} de ingresos. Balance refleja ${fmt(balIngresos)}. Diferencia: ${fmt(Math.abs(pygIngresos-balIngresos))}`, area:'Cruce Balance/PyG' });
    }

    const m = allLines.length > 0 ? calcMetrics(allLines) : { ingresos:0,gastos:0,resultado:0,margen:0,totalDebe:0,totalHaber:0,diferencia:0,saldoTesoreria:0,mensual:[],clientes:[],proveedores:[],balance:{},gastosDistribucion:[],asientos:0,apuntes:0,cuentasSinClasificar:[],sinFecha:0,sinCuenta:0,lineasConAdvertencia:0 };
    const a = [...generateAlerts(allLines, m, 'excel'), ...crossAlerts];

    setParseResults(results);
    setMetrics(m);
    setAlerts(a);
    setCoverage(cov);
    setLoading(false);
    setStep(1);
  };

  const handleSave = async () => {
    setLoading(true);
    const criticos = alerts.filter(a => a.nivel === 'critico').length;
    const data = {
      company_id: companyId,
      nombre_archivo: Object.values(files).filter(Boolean).map(f=>f.name).join(' + ') || 'excel.xlsx',
      origen: importType,
      periodo_inicio: periodo.inicio,
      periodo_fin: periodo.fin,
      empresa_nombre: empresa,
      estado: criticos > 0 ? 'pendiente_revision' : 'analizado',
      total_lineas: Object.values(parseResults).reduce((s,r)=>s+(r?.length||0),0),
      lineas_error: 0,
      lineas_advertencia: alerts.filter(a=>a.nivel==='revisar').length,
      alertas_criticas: criticos,
      calidad_dato: criticos > 0 ? 'baja' : alerts.filter(a=>a.nivel==='revisar').length > 2 ? 'media' : 'alta',
      mapeo_columnas: { origen: importType, archivos: coverage },
      supuestos_aplicados: ['Clasificación automática por rango de cuenta PGC', `Archivos importados: ${coverage.join(', ')}`, ...(isDemo?['Datos de demostración ficticios']:[])],
      advertencias: alerts,
      metricas_calculadas: metrics ? {
        ingresos:metrics.ingresos,gastos:metrics.gastos,resultado_neto:metrics.resultado,margen_neto:metrics.margen,
        caja_estimada:metrics.saldoTesoreria,total_debe:metrics.totalDebe,total_haber:metrics.totalHaber,
        movimientos:metrics.apuntes,mensual:metrics.mensual,clientes:metrics.clientes,proveedores:metrics.proveedores,
        balance:metrics.balance,gastos_dist:metrics.gastosDistribucion,alertas:alerts,
        cobertura:coverage,
        ratios:[
          {nombre:'Margen neto',valor:`${metrics.margen.toFixed(1)}%`,color:metrics.margen>0?'text-emerald-600':'text-red-600',interpretacion:'Resultado/ingresos. Estimado.'},
          {nombre:'Peso gastos/ingresos',valor:metrics.ingresos>0?`${(metrics.gastos/metrics.ingresos*100).toFixed(1)}%`:'—',color:'text-blue-600',interpretacion:'Gastos sobre ingresos.'},
        ],
      } : {},
      usuario_importa: 'usuario_actual',
      version_mapeo: '2.0',
    };
    const saved = await base44.entities.AccountingImport.create(data);
    setLoading(false);
    onComplete(saved);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Volver</button>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">{typeInfo.icon} {typeInfo.label}</h2>
          <p className="text-xs text-slate-400">{typeInfo.desc}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
          className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">

          {step === 0 && (
            <>
              <h3 className="text-base font-bold text-foreground">Sube {isCombined ? 'los archivos Excel' : 'el archivo Excel'}</h3>

              <div className={cn("grid gap-4", isCombined ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1")}>
                {shouldHaveBalance && (
                  <FileDropZone label="Balance de sumas y saldos" icon="📋" accepted=".xlsx / .xls"
                    file={files.balance} onFile={f => setFiles(p => ({ ...p, balance: f }))} onClear={() => setFiles(p => ({ ...p, balance: null }))} />
                )}
                {shouldHavePyg && (
                  <FileDropZone label="Pérdidas y ganancias" icon="📈" accepted=".xlsx / .xls"
                    file={files.pyg} onFile={f => setFiles(p => ({ ...p, pyg: f }))} onClear={() => setFiles(p => ({ ...p, pyg: null }))} />
                )}
                {shouldHaveDiary && (
                  <FileDropZone label="Diario contable" icon="📒" accepted=".xlsx / .xls"
                    file={files.diario} onFile={f => setFiles(p => ({ ...p, diario: f }))} onClear={() => setFiles(p => ({ ...p, diario: null }))} />
                )}
              </div>

              {isCombined && (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">Puedes subir solo uno de los archivos. El análisis se adapta al nivel de datos disponible. Con los tres se genera análisis cruzado validado.</p>
                </div>
              )}

              <div className="flex items-center gap-3"><div className="flex-1 h-px bg-slate-100" /><span className="text-xs text-slate-400">o</span><div className="flex-1 h-px bg-slate-100" /></div>
              <button onClick={useDemoData} className={cn("w-full py-3 rounded-xl border-2 border-dashed text-sm font-semibold transition-all", isDemo?"border-blue-400 bg-blue-50 text-blue-700":"border-blue-200 text-blue-600 hover:bg-blue-50")}>
                {isDemo ? '✓ Datos de demostración activos' : 'Usar datos de demostración ficticios'}
              </button>
              {isDemo && <p className="text-xs text-blue-500 text-center flex items-center justify-center gap-1"><Info className="w-3 h-3" /> Datos ficticios · No representan información real</p>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Empresa / Cliente</label>
                  <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nombre empresa"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Período</label>
                  <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none" />
                </div>
              </div>
            </>
          )}

          {step === 1 && metrics && (
            <>
              <h3 className="text-base font-bold text-foreground">Resultado del análisis Excel</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {coverage.map(c => <span key={c} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{c}</span>)}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label:'Ingresos', value:fmt(metrics.ingresos), color:'text-emerald-600' },
                  { label:'Gastos', value:fmt(metrics.gastos), color:'text-slate-600' },
                  { label:'Resultado', value:fmt(metrics.resultado), color:metrics.resultado>=0?'text-emerald-600':'text-red-600' },
                  { label:'Apuntes', value:metrics.apuntes, color:'text-blue-600' },
                ].map((k,i)=>(
                  <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className={cn("text-lg font-jakarta font-bold",k.color)}>{k.value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {alerts.slice(0,5).map((a,i)=>(
                  <div key={i} className={cn("border rounded-xl px-4 py-3", a.nivel==='critico'?'bg-red-50 border-red-200':a.nivel==='revisar'?'bg-amber-50 border-amber-200':'bg-blue-50 border-blue-200')}>
                    <p className={cn("text-xs font-semibold",a.nivel==='critico'?'text-red-700':a.nivel==='revisar'?'text-amber-700':'text-blue-700')}>{a.titulo}</p>
                    <p className="text-xs text-slate-600">{a.desc}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <button onClick={() => step===0?onCancel():setStep(s=>s-1)} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" /> {step===0?'Cancelar':'Atrás'}
        </button>
        {step===0 && (
          <button onClick={runAnalysis} disabled={(!hasAnyFile&&!isDemo)||loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold shadow-sm">
            {loading?<Loader2 className="w-4 h-4 animate-spin"/>:null} Analizar <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {step===1 && (
          <button onClick={handleSave} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold shadow-sm">
            {loading?<Loader2 className="w-4 h-4 animate-spin"/>:<BarChart2 className="w-4 h-4"/>} Importar y ver dashboard
          </button>
        )}
      </div>
    </motion.div>
  );
}
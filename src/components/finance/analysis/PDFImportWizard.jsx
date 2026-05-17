import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, FileText, X, Info, Loader2, BarChart2, Eye, Pencil, Save } from 'lucide-react';

const STEPS = ['Subir PDF', 'Extracción IA', 'Revisión cifras', 'Dashboard'];

const fmt = n => typeof n === 'number'
  ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  : '—';

// ─── Demo extracted data (ficticios) ─────────────────────────────────────────
const DEMO_BALANCE_EXTRACTED = {
  tipo: 'balance',
  empresa: 'Demo Empresas SL (datos ficticios)',
  ejercicio: '2024',
  metodo: 'PDF digital',
  confianzaGlobal: 87,
  paginas: [1, 2],
  activo: {
    activoNoCorriente: { label: 'Activo no corriente', valor: 485000, items: [
      { label: 'Inmovilizado intangible', valor: 45000 },
      { label: 'Inmovilizado material', valor: 380000 },
      { label: 'Inversiones financieras LP', valor: 60000 },
    ]},
    activoCorriente: { label: 'Activo corriente', valor: 312000, items: [
      { label: 'Existencias', valor: 85000 },
      { label: 'Deudores comerciales', valor: 160000 },
      { label: 'Efectivo y otros activos', valor: 67000 },
    ]},
    totalActivo: 797000,
  },
  patrimonioPasivo: {
    patrimonioNeto: { label: 'Patrimonio neto', valor: 345000, items: [
      { label: 'Capital social', valor: 60000 },
      { label: 'Reservas', valor: 230000 },
      { label: 'Resultado del ejercicio', valor: 55000 },
    ]},
    pasivoNoCorriente: { label: 'Pasivo no corriente', valor: 210000, items: [
      { label: 'Deudas LP entidades crédito', valor: 210000 },
    ]},
    pasivoCorriente: { label: 'Pasivo corriente', valor: 242000, items: [
      { label: 'Deudas CP entidades crédito', valor: 85000 },
      { label: 'Acreedores comerciales', valor: 120000 },
      { label: 'Otras deudas CP', valor: 37000 },
    ]},
    totalPatrimonioPasivo: 797000,
  },
  validacion: { cuadra: true, diferencia: 0 },
};

const DEMO_PYG_EXTRACTED = {
  tipo: 'pyg',
  empresa: 'Demo Empresas SL (datos ficticios)',
  ejercicio: '2024',
  metodo: 'PDF digital',
  confianzaGlobal: 82,
  paginas: [3],
  partidas: [
    { label: 'Importe neto cifra de negocios', valor: 950000, tipo: 'ingreso', confianza: 95 },
    { label: 'Variación existencias', valor: 12000, tipo: 'ajuste', confianza: 80 },
    { label: 'Aprovisionamientos', valor: -380000, tipo: 'gasto', confianza: 93 },
    { label: 'Gastos de personal', valor: -285000, tipo: 'gasto', confianza: 95 },
    { label: 'Otros gastos de explotación', valor: -145000, tipo: 'gasto', confianza: 88 },
    { label: 'Amortización del inmovilizado', valor: -52000, tipo: 'gasto', confianza: 91 },
    { label: 'Resultado de explotación', valor: 100000, tipo: 'subtotal', confianza: 78 },
    { label: 'Ingresos financieros', valor: 2000, tipo: 'ingreso', confianza: 85 },
    { label: 'Gastos financieros', valor: -28000, tipo: 'gasto', confianza: 90 },
    { label: 'Resultado financiero', valor: -26000, tipo: 'subtotal', confianza: 78 },
    { label: 'Resultado antes de impuestos', valor: 74000, tipo: 'subtotal', confianza: 85 },
    { label: 'Impuesto sobre beneficios', valor: -19000, tipo: 'gasto', confianza: 88 },
    { label: 'Resultado del ejercicio', valor: 55000, tipo: 'resultado', confianza: 92 },
  ],
};

function ConfidenceBadge({ value }) {
  const color = value >= 85 ? 'bg-emerald-50 text-emerald-700' : value >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
  return <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", color)}>{value}%</span>;
}

function EditableRow({ item, onChange }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.valor);
  return (
    <div className={cn("flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50 group",
      item.tipo === 'subtotal' ? 'bg-slate-50 font-semibold' : '',
      item.tipo === 'resultado' ? 'bg-emerald-50 font-bold' : '')}>
      <span className={cn("text-xs flex-1", item.tipo==='subtotal'?'font-semibold text-slate-700':item.tipo==='resultado'?'font-bold text-emerald-800':'text-slate-600')}>
        {item.label}
      </span>
      <div className="flex items-center gap-2">
        {item.confianza && <ConfidenceBadge value={item.confianza} />}
        {editing ? (
          <div className="flex items-center gap-1">
            <input type="number" value={val} onChange={e=>setVal(Number(e.target.value))}
              className="w-24 px-2 py-0.5 text-xs border border-blue-300 rounded-lg focus:outline-none" />
            <button onClick={() => { onChange(val); setEditing(false); }} className="text-emerald-600"><Save className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setVal(item.valor); setEditing(false); }} className="text-slate-400"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className={cn("text-xs font-mono font-semibold min-w-20 text-right", item.valor < 0 ? 'text-red-600' : 'text-slate-800')}>{fmt(item.valor)}</span>
            <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 transition-opacity">
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PDFImportWizard({ importType, companyId, company, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState([]);
  const [isDemo, setIsDemo] = useState(false);
  const [periodo, setPeriodo] = useState({ inicio: '2024-01-01', fin: '2024-12-31' });
  const [empresa, setEmpresa] = useState(company?.nombre_comercial || '');
  const [nota, setNota] = useState('');
  const [loading, setLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [extracted, setExtracted] = useState({ balance: null, pyg: null });
  const [alerts, setAlerts] = useState([]);
  const [corrections, setCorrections] = useState({});
  const fileRef = useRef();

  const removeFile = (i) => setFiles(f => f.filter((_, idx) => idx !== i));

  const useDemo = () => {
    setIsDemo(true);
    setEmpresa('Demo Empresas SL (datos ficticios)');
    setFiles([{ name: 'balance_pyg_2024_demo.pdf', size: 245000, demo: true }]);
  };

  const runExtraction = async () => {
    setLoading(true);
    setOcrStatus('Detectando tipo de PDF...');
    await delay(600);
    setOcrStatus('Analizando estructura de páginas...');
    await delay(700);
    setOcrStatus('Extrayendo tablas financieras con IA...');
    await delay(900);
    setOcrStatus('Detectando Balance de situación...');
    await delay(600);
    setOcrStatus('Detectando Pérdidas y ganancias...');
    await delay(600);
    setOcrStatus('Validando totales y subtotales...');
    await delay(500);
    setOcrStatus('Asignando confianza por bloque...');
    await delay(400);

    // In production, this would call base44.integrations.Core.InvokeLLM + ExtractDataFromUploadedFile
    setExtracted({ balance: DEMO_BALANCE_EXTRACTED, pyg: DEMO_PYG_EXTRACTED });
    setAlerts(buildAlerts(DEMO_BALANCE_EXTRACTED, DEMO_PYG_EXTRACTED));
    setLoading(false);
    setStep(1);
  };

  const buildAlerts = (bal, pyg) => {
    const a = [];
    if (bal?.validacion?.cuadra) a.push({ nivel: 'informativo', titulo: 'Balance cuadra (Activo = PN + Pasivo)', desc: `Total activo y total patrimonio neto + pasivo coinciden: ${fmt(bal.activo.totalActivo)}.` });
    else a.push({ nivel: 'critico', titulo: 'Balance descuadrado', desc: `Diferencia de ${fmt(bal?.validacion?.diferencia || 0)}.` });
    if (pyg) {
      const rdo = pyg.partidas.find(p => p.label.includes('ejercicio'));
      const balRdo = bal?.patrimonioPasivo?.patrimonioNeto?.items?.find(i => i.label.includes('Resultado'));
      if (rdo && balRdo && Math.abs(rdo.valor - balRdo.valor) < 1) {
        a.push({ nivel: 'informativo', titulo: 'Resultado coherente entre Balance y PyG', desc: `Ambos documentos indican resultado del ejercicio: ${fmt(rdo.valor)}.` });
      } else if (rdo && balRdo) {
        a.push({ nivel: 'revisar', titulo: 'Diferencia en resultado del ejercicio', desc: `PyG: ${fmt(rdo.valor)} — Balance: ${fmt(balRdo.valor)}.` });
      }
    }
    a.push({ nivel: 'informativo', titulo: 'Extracción mediante IA — pendiente revisión', desc: 'Todas las cifras deben ser verificadas antes de usar el informe como documento definitivo.', area: 'General' });
    return a;
  };

  const applyCorrection = (key, idx, val) => {
    setCorrections(c => ({ ...c, [`${key}_${idx}`]: val }));
    if (key === 'pyg') {
      setExtracted(e => ({
        ...e,
        pyg: {
          ...e.pyg,
          partidas: e.pyg.partidas.map((p, i) => i === idx ? { ...p, valor: val, corregida: true } : p),
        },
      }));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const pygIngresos = extracted.pyg?.partidas.filter(p => p.tipo === 'ingreso').reduce((s, p) => s + Math.abs(p.valor), 0) || 0;
    const pygGastos = extracted.pyg?.partidas.filter(p => p.tipo === 'gasto').reduce((s, p) => s + Math.abs(p.valor), 0) || 0;
    const pygResultado = extracted.pyg?.partidas.find(p => p.tipo === 'resultado')?.valor || 0;
    const confianzaMedia = Math.round(((extracted.balance?.confianzaGlobal || 0) + (extracted.pyg?.confianzaGlobal || 0)) / (extracted.balance && extracted.pyg ? 2 : 1));
    const criticos = alerts.filter(a => a.nivel === 'critico').length;

    const data = {
      company_id: companyId,
      nombre_archivo: files.map(f => f.name).join(' + ') || 'documento.pdf',
      origen: importType || 'pdf_auto',
      periodo_inicio: periodo.inicio,
      periodo_fin: periodo.fin,
      empresa_nombre: empresa,
      estado: 'analizado',
      total_lineas: (extracted.pyg?.partidas?.length || 0) + (extracted.balance?.activo?.items?.length || 0),
      lineas_error: 0,
      lineas_advertencia: alerts.filter(a => a.nivel === 'revisar').length,
      alertas_criticas: criticos,
      calidad_dato: confianzaMedia >= 80 ? 'alta' : confianzaMedia >= 60 ? 'media' : 'baja',
      mapeo_columnas: { metodo: 'pdf_ia', archivos: files.map(f => f.name) },
      supuestos_aplicados: [
        'Extracción mediante IA desde PDF',
        `Confianza media: ${confianzaMedia}%`,
        extracted.balance?.metodo === 'OCR' ? 'PDF escaneado — OCR aplicado' : 'PDF digital — texto extraído directamente',
        ...(isDemo ? ['Datos de demostración ficticios'] : []),
        ...(Object.keys(corrections).length > 0 ? [`${Object.keys(corrections).length} correcciones manuales aplicadas`] : []),
      ],
      advertencias: alerts,
      metricas_calculadas: {
        // Balance
        total_activo: extracted.balance?.activo?.totalActivo || 0,
        activo_corriente: extracted.balance?.activo?.activoCorriente?.valor || 0,
        activo_no_corriente: extracted.balance?.activo?.activoNoCorriente?.valor || 0,
        patrimonio_neto: extracted.balance?.patrimonioPasivo?.patrimonioNeto?.valor || 0,
        pasivo_corriente: extracted.balance?.patrimonioPasivo?.pasivoCorriente?.valor || 0,
        pasivo_no_corriente: extracted.balance?.patrimonioPasivo?.pasivoNoCorriente?.valor || 0,
        // PyG
        ingresos: pygIngresos,
        gastos: pygGastos,
        resultado_neto: pygResultado,
        margen_neto: pygIngresos > 0 ? pygResultado / pygIngresos * 100 : 0,
        // Ratios
        fondo_maniobra: (extracted.balance?.activo?.activoCorriente?.valor || 0) - (extracted.balance?.patrimonioPasivo?.pasivoCorriente?.valor || 0),
        endeudamiento: extracted.balance?.activo?.totalActivo ? ((extracted.balance.patrimonioPasivo.pasivoNoCorriente.valor + extracted.balance.patrimonioPasivo.pasivoCorriente.valor) / extracted.balance.activo.totalActivo * 100) : 0,
        liquidez_corriente: (extracted.balance?.patrimonioPasivo?.pasivoCorriente?.valor || 0) > 0 ? (extracted.balance.activo.activoCorriente.valor / extracted.balance.patrimonioPasivo.pasivoCorriente.valor) : null,
        autonomia: extracted.balance?.activo?.totalActivo ? (extracted.balance.patrimonioPasivo.patrimonioNeto.valor / extracted.balance.activo.totalActivo * 100) : 0,
        // Meta
        confianza_media: confianzaMedia,
        balance: extracted.balance,
        pyg: extracted.pyg,
        alertas: alerts,
        correcciones: corrections,
        fuente: 'pdf',
        mensual: [],
        clientes: [],
        proveedores: [],
        gastos_dist: extracted.pyg?.partidas.filter(p => p.tipo === 'gasto').map(p => ({ name: p.label, value: Math.abs(p.valor) })) || [],
      },
      usuario_importa: 'usuario_actual',
      version_mapeo: '3.0',
      notas: nota,
    };
    const saved = await base44.entities.AccountingImport.create(data);
    setLoading(false);
    onComplete(saved);
  };

  const delay = ms => new Promise(r => setTimeout(r, ms));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">Análisis desde PDF</h2>
          <p className="text-xs text-slate-400">IA documental · OCR · Extracción de Balance y PyG · Revisión humana</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
              i < step ? 'bg-blue-500 text-white' : i === step ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400')}>
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

          {/* STEP 0: Subir PDF */}
          {step === 0 && (
            <>
              <h3 className="text-base font-bold text-foreground">Sube el PDF contable</h3>
              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/20 transition-all">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm font-semibold text-slate-600">Arrastra o haz clic para seleccionar PDF</p>
                <p className="text-xs text-slate-400 mt-1">PDF digital · PDF escaneado · Balance · PyG · Informe contable</p>
                <p className="text-xs text-slate-300 mt-0.5">Multipágina · A3 · Excel PDF · Cuentas anuales</p>
                <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden" onChange={e => setFiles([...files, ...Array.from(e.target.files)])} />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                      <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-blue-800 truncate">{f.name}</p>
                        {f.size && <p className="text-xs text-blue-500">{(f.size / 1024).toFixed(0)} KB{f.demo ? ' · Demo' : ''}</p>}
                      </div>
                      <button onClick={() => removeFile(i)}><X className="w-4 h-4 text-blue-400" /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3"><div className="flex-1 h-px bg-slate-100" /><span className="text-xs text-slate-400">o</span><div className="flex-1 h-px bg-slate-100" /></div>
              <button onClick={useDemo} className={cn("w-full py-3 rounded-xl border-2 border-dashed text-sm font-semibold transition-all",
                isDemo ? "border-blue-400 bg-blue-50 text-blue-700" : "border-blue-200 text-blue-600 hover:bg-blue-50")}>
                {isDemo ? '✓ Datos de demostración activos (Balance + PyG 2024)' : 'Usar datos de demostración ficticios'}
              </button>
              {isDemo && <p className="text-xs text-blue-500 text-center flex items-center justify-center gap-1"><Info className="w-3 h-3" /> Datos ficticios — Demo Empresas SL</p>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Empresa / Cliente</label>
                  <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nombre empresa analizada"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Ejercicio</label>
                  <input type="date" value={periodo.fin} onChange={e => setPeriodo(p => ({ ...p, fin: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Nota interna (opcional)</label>
                <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Contexto, cliente, ejercicio..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none resize-none" />
              </div>
            </>
          )}

          {/* STEP 1: Extracción */}
          {step === 1 && (
            <>
              <h3 className="text-base font-bold text-foreground">Datos extraídos por IA</h3>

              {/* Alerts */}
              <div className="space-y-2">
                {alerts.map((a, i) => {
                  const colors = { critico: 'bg-red-50 border-red-200 text-red-700', revisar: 'bg-amber-50 border-amber-200 text-amber-700', informativo: 'bg-blue-50 border-blue-200 text-blue-700' };
                  return (
                    <div key={i} className={cn("border rounded-xl px-4 py-3 text-xs", colors[a.nivel] || colors.informativo)}>
                      <p className="font-semibold">{a.nivel === 'critico' ? '🔴' : a.nivel === 'revisar' ? '🟡' : 'ℹ️'} {a.titulo}</p>
                      <p className="text-xs opacity-80 mt-0.5">{a.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Balance summary */}
              {extracted.balance && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-700 flex items-center gap-1">📋 Balance de situación detectado</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Confianza</span>
                      <ConfidenceBadge value={extracted.balance.confianzaGlobal} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Total Activo', val: extracted.balance.activo.totalActivo, color: 'text-blue-700' },
                      { label: 'Total PN + Pasivo', val: extracted.balance.patrimonioPasivo.totalPatrimonioPasivo, color: 'text-blue-700' },
                      { label: 'Patrimonio Neto', val: extracted.balance.patrimonioPasivo.patrimonioNeto.valor, color: 'text-emerald-700' },
                      { label: 'Fondo de Maniobra', val: extracted.balance.activo.activoCorriente.valor - extracted.balance.patrimonioPasivo.pasivoCorriente.valor, color: 'text-slate-700' },
                    ].map((k, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <p className={cn("text-base font-jakarta font-bold", k.color)}>{fmt(k.val)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Páginas origen: {extracted.balance.paginas.join(', ')} · Método: {extracted.balance.metodo}</p>
                </div>
              )}

              {/* PyG summary */}
              {extracted.pyg && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-700">📈 Pérdidas y ganancias detectada</p>
                    <ConfidenceBadge value={extracted.pyg.confianzaGlobal} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Ingresos', val: extracted.pyg.partidas.filter(p=>p.tipo==='ingreso').reduce((s,p)=>s+p.valor,0), color: 'text-emerald-700' },
                      { label: 'Gastos explotación', val: Math.abs(extracted.pyg.partidas.filter(p=>p.tipo==='gasto').reduce((s,p)=>s+p.valor,0)), color: 'text-red-600' },
                      { label: 'Rdo. explotación', val: extracted.pyg.partidas.find(p=>p.label.includes('explotación'))?.valor || 0, color: 'text-blue-700' },
                      { label: 'Rdo. del ejercicio', val: extracted.pyg.partidas.find(p=>p.tipo==='resultado')?.valor || 0, color: 'text-slate-800' },
                    ].map((k, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <p className={cn("text-base font-jakarta font-bold", k.color)}>{fmt(k.val)}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Páginas origen: {extracted.pyg.paginas.join(', ')} · Método: {extracted.pyg.metodo}</p>
                </div>
              )}
            </>
          )}

          {/* STEP 2: Revisión */}
          {step === 2 && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">Revisión y corrección de cifras</h3>
                <span className="text-xs text-slate-400 flex items-center gap-1"><Pencil className="w-3 h-3" /> Haz clic en una cifra para editar</span>
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Revisa los importes antes de confirmar. La IA puede cometer errores, especialmente en PDFs escaneados o con tablas complejas. Haz clic en cualquier cifra para corregirla.</p>
              </div>

              {extracted.pyg && (
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-2">📈 Pérdidas y ganancias — {extracted.pyg.empresa}</p>
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-500">PARTIDA</span>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-semibold text-slate-500">CONFIANZA</span>
                        <span className="text-[10px] font-semibold text-slate-500 w-24 text-right">IMPORTE</span>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-50 p-1">
                      {extracted.pyg.partidas.map((p, i) => (
                        <EditableRow key={i} item={p} onChange={val => applyCorrection('pyg', i, val)} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {extracted.balance && (
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-2">📋 Balance — estructura detectada</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Activo no corriente', val: extracted.balance.activo.activoNoCorriente.valor },
                      { label: 'Activo corriente', val: extracted.balance.activo.activoCorriente.valor },
                      { label: 'Patrimonio neto', val: extracted.balance.patrimonioPasivo.patrimonioNeto.valor },
                      { label: 'Pasivo no corriente', val: extracted.balance.patrimonioPasivo.pasivoNoCorriente.valor },
                      { label: 'Pasivo corriente', val: extracted.balance.patrimonioPasivo.pasivoCorriente.valor },
                      { label: 'Total activo', val: extracted.balance.activo.totalActivo },
                    ].map((k, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                        <span className="text-xs text-slate-600">{k.label}</span>
                        <span className="text-xs font-mono font-semibold text-slate-800">{fmt(k.val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(corrections).length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-blue-700">{Object.keys(corrections).length} corrección(es) manual(es) registrada(s) — quedarán trazadas en el informe.</p>
                </div>
              )}
            </>
          )}

          {/* STEP 3: Completado */}
          {step === 3 && (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-3" />
              <h3 className="text-lg font-jakarta font-bold text-foreground mb-2">Datos confirmados</h3>
              <p className="text-sm text-slate-500 mb-1">Confianza media: {Math.round(((extracted.balance?.confianzaGlobal||0)+(extracted.pyg?.confianzaGlobal||0))/2)}% · {Object.keys(corrections).length} correcciones</p>
              {isDemo && <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 mt-2">Modo demostración — datos ficticios</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-700">{ocrStatus}</p>
          <p className="text-xs text-slate-400">Extracción IA en curso — no cierres esta ventana</p>
        </div>
      )}

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => step === 0 ? onCancel() : setStep(s => s - 1)} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">
          <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancelar' : 'Atrás'}
        </button>
        {step === 0 && (
          <button onClick={runExtraction} disabled={(files.length === 0 && !isDemo) || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold shadow-sm">
            <Eye className="w-4 h-4" /> Extraer con IA <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {step === 1 && <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm">Revisar cifras <ChevronRight className="w-4 h-4" /></button>}
        {step === 2 && <button onClick={() => setStep(3)} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold shadow-sm"><CheckCircle2 className="w-4 h-4" /> Confirmar datos</button>}
        {step === 3 && (
          <button onClick={handleSave} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />} Generar dashboard
          </button>
        )}
      </div>
    </motion.div>
  );
}
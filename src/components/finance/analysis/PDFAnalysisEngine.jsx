/**
 * PDFAnalysisEngine — Motor de análisis PDF cuenta a cuenta V5
 * Soporta múltiples PDFs de distintos tipos en el mismo análisis
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import {
  ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle,
  FileText, X, Info, Loader2, Eye, Pencil, Save, Filter, Shield, Plus, Trash2
} from 'lucide-react';

// ─── PGC classifier ───────────────────────────────────────────────────────────
const PGC_MAP = [
  [['100','101','102','110','112','113','114','118','119','120','121','129'], 'patrimonio_neto', 'patrimonio'],
  [['170','171','172','173','174','175','176','177','179','180','181','182'], 'pasivo_no_corriente', 'pasivo'],
  [['200','201','202','203','204','205','206','207','208','209','210','211','212','213','214','215','216','217','218','219','220','221','222','223','228','229','240','241','242','243','244','245','246','248','249','250','251','252','253','254','255','256','257','258','259','260','261','262','265','266','267','268','269','280','281','282','290','291','292','293','294','295','296','297','298','299'], 'activo_no_corriente', 'activo'],
  [['300','301','302','303','304','305','306','307','308','309','310','311','312','313','314','315','320','321','322','325','326','327','328','330','331','332','333','334','335','340','341','342','343','344','345','346','347','348','349','350','351','352','353','354','355','356','357','358','360','365','390','391','392','393','394','395','396','397','398','399'], 'activo_corriente', 'activo'],
  [['430','431','432','433','434','435','436','437','438','439'], 'activo_corriente', 'activo'],
  [['440','441','442','443','444','445','446','447','448','449','460','461','470','471','472','473','474'], 'activo_corriente', 'activo'],
  [['400','401','402','403','404','405','406','407','408','409'], 'pasivo_corriente', 'pasivo'],
  [['410','411','412','413','419'], 'pasivo_corriente', 'pasivo'],
  [['465','466','475','476','477','478','479','480','481','485','490','491','493','494','495','496','497','498','499'], 'pasivo_corriente', 'pasivo'],
  [['520','521','522','523','524','525','526','527','528','529','530','531','532','533','534','540','541','542','543','544','545','546','547','548','549','550','551','552','553','554','555','556','557','558','559','560','561','562','563','564','565','566','567','568','569'], 'pasivo_corriente', 'pasivo'],
  [['570','571','572','573','574','575','576','577','578','579'], 'activo_corriente', 'activo'],
  [['600','601','602','606','607','608','609','610','611','612','620','621','622','623','624','625','626','627','628','629'], 'pyg_gasto', 'gasto'],
  [['630','631','632','633','634','635','636','637','638','639','640','641','642','643','644','649','650','651','659'], 'pyg_gasto', 'gasto'],
  [['660','661','662','663','664','665','666','667','668','669','670','671','672','678','679','680','681','682','690','691','692'], 'pyg_gasto', 'gasto'],
  [['700','701','702','703','704','705','706','708','709','710','711','712','713'], 'pyg_ingreso', 'ingreso'],
  [['720','721','722','723','724','725','726','727','728','729','730','731','732','733','740','741','746','747','748','749'], 'pyg_ingreso', 'ingreso'],
  [['750','751','752','753','754','755','759','760','761','762','763','764','765','766','768','769','770','771','772','773','774','775','778','779'], 'pyg_ingreso', 'ingreso'],
];

function classifyAccount(cuenta) {
  const c = String(cuenta || '').trim().replace(/[^0-9].*/, '');
  if (!c) return { masa: 'sin_clasificar', tipo: 'otro' };
  for (const [prefixes, masa, tipo] of PGC_MAP) {
    for (const p of prefixes) {
      if (c.startsWith(p)) return { masa, tipo };
    }
  }
  const g = c[0];
  if (g === '1') return { masa: 'patrimonio_neto', tipo: 'patrimonio' };
  if (g === '2') return { masa: 'activo_no_corriente', tipo: 'activo' };
  if (g === '3') return { masa: 'activo_corriente', tipo: 'activo' };
  if (g === '4') return { masa: 'varios', tipo: 'varios' };
  if (g === '5') return { masa: 'activo_corriente', tipo: 'activo' };
  if (g === '6') return { masa: 'pyg_gasto', tipo: 'gasto' };
  if (g === '7') return { masa: 'pyg_ingreso', tipo: 'ingreso' };
  return { masa: 'sin_clasificar', tipo: 'otro' };
}

function parseSpanishAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return raw;
  let s = String(raw).trim().replace(/[€$£\s%]/g, '');
  if (!s || s === '-' || s === '—') return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.replace(/[()]/g, ''); }
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  if (/\d\.\d{3}(,\d*)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d{1,4}$/.test(s)) s = s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

const fmt = n => typeof n === 'number'
  ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  : '—';

const PDF_TYPES = [
  { value: 'balance_situacion', label: 'Balance de situación', emoji: '📊', desc: 'Activo, Pasivo y Patrimonio Neto' },
  { value: 'pyg', label: 'Cuenta de Pérdidas y Ganancias', emoji: '📈', desc: 'Ingresos y gastos del ejercicio' },
  { value: 'balance_comparativo', label: 'Balance comparativo (2 ejercicios)', emoji: '📋', desc: 'Balance con año anterior' },
  { value: 'libro_diario', label: 'Libro diario / Mayor', emoji: '📒', desc: 'Asientos contables detallados' },
  { value: 'extracto_bancario', label: 'Extracto bancario', emoji: '🏦', desc: 'Movimientos de cuenta bancaria' },
  { value: 'cuentas_anuales', label: 'Cuentas anuales completas', emoji: '📑', desc: 'Memoria, balance y PyG' },
  { value: 'otro', label: 'Otro documento', emoji: '📄', desc: 'Cualquier documento financiero' },
];

const STEPS = ['Subir PDFs', 'Análisis IA', 'Tabla de cuentas', 'Revisión', 'Confirmar'];
const MASA_LABEL = {
  activo_no_corriente: 'Activo NC', activo_corriente: 'Activo C',
  patrimonio_neto: 'Patrimonio',   pasivo_no_corriente: 'Pasivo NC',
  pasivo_corriente: 'Pasivo C',    pyg_ingreso: 'Ingreso',
  pyg_gasto: 'Gasto',             sin_clasificar: '—', varios: 'Varios',
};

function ConfBadge({ v }) {
  const color = v >= 85 ? 'bg-emerald-50 text-emerald-700' : v >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600';
  return <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", color)}>{v}%</span>;
}

function EditableCell({ value, onSave, type = 'text' }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  return editing ? (
    <div className="flex items-center gap-1">
      <input type={type === 'number' ? 'number' : 'text'} value={val}
        onChange={e => setVal(type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-24 px-1.5 py-0.5 text-xs border border-blue-300 rounded focus:outline-none" autoFocus />
      <button onClick={() => { onSave(val); setEditing(false); }}><Save className="w-3 h-3 text-emerald-600" /></button>
      <button onClick={() => { setVal(value); setEditing(false); }}><X className="w-3 h-3 text-slate-400" /></button>
    </div>
  ) : (
    <span className="group flex items-center gap-1 cursor-pointer" onClick={() => setEditing(true)}>
      <span className="text-xs">{type === 'number' && typeof value === 'number' ? fmt(value) : (value ?? '—')}</span>
      <Pencil className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100" />
    </span>
  );
}

export default function PDFAnalysisEngine({ importType, companyId, company, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [pdfFiles, setPdfFiles] = useState([]); // [{file, type, label}]
  const [empresa, setEmpresa] = useState(company?.nombre_comercial || '');
  const [ejercicio, setEjercicio] = useState('2024');
  const [nota, setNota] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [pages, setPages] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filterMasa, setFilterMasa] = useState('all');
  const [filterConf, setFilterConf] = useState('all');
  const [approvalMode, setApprovalMode] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef();
  const [pendingFileType, setPendingFileType] = useState('balance_situacion');

  const setMsg = async (msg, progress, ms = 400) => {
    setLoadingMsg(msg);
    setLoadingProgress(progress);
    await new Promise(r => setTimeout(r, ms));
  };

  const addFile = (file) => {
    setPdfFiles(prev => [...prev, { file, type: pendingFileType, id: Date.now() }]);
    setError('');
  };

  const removeFile = (id) => setPdfFiles(prev => prev.filter(f => f.id !== id));
  const updateFileType = (id, type) => setPdfFiles(prev => prev.map(f => f.id === id ? { ...f, type } : f));

  const runExtraction = async () => {
    if (pdfFiles.length === 0) { setError('Añade al menos un PDF para analizar.'); return; }
    setLoading(true);
    setError('');

    try {
      // Upload all PDFs
      await setMsg(`Subiendo ${pdfFiles.length} PDF(s)…`, 5, 300);
      const uploadedUrls = [];
      for (let i = 0; i < pdfFiles.length; i++) {
        await setMsg(`Subiendo PDF ${i + 1}/${pdfFiles.length}: ${pdfFiles[i].file.name}…`, Math.round(5 + (i / pdfFiles.length) * 25), 200);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: pdfFiles[i].file });
        uploadedUrls.push({ url: file_url, type: pdfFiles[i].type, nombre: pdfFiles[i].file.name });
      }

      await setMsg(`Analizando ${uploadedUrls.length} documento(s) uno a uno…`, 35, 300);

      const schema = {
        type: 'object',
        properties: {
          paginas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                documento: { type: 'string' },
                pagina: { type: 'number' },
                tipo: { type: 'string' },
                confianza: { type: 'number' },
                razon: { type: 'string' },
                cuentas_detectadas: { type: 'number' },
              },
            },
          },
          cuentas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                documento: { type: 'string' },
                pagina: { type: 'number' },
                bloque: { type: 'string' },
                cuenta: { type: 'string' },
                descripcion: { type: 'string' },
                importe_actual: { type: 'number' },
                importe_anterior: { type: 'number' },
                signo: { type: 'string' },
                confianza: { type: 'number' },
              },
            },
          },
        },
      };

      // Analizar cada PDF individualmente para evitar límite de contexto
      const allPages = [];
      const allRawAccounts = [];

      for (let i = 0; i < uploadedUrls.length; i++) {
        const u = uploadedUrls[i];
        const tipoInfo = PDF_TYPES.find(t => t.value === u.type);
        await setMsg(`Analizando ${i + 1}/${uploadedUrls.length}: ${u.nombre}…`, Math.round(35 + (i / uploadedUrls.length) * 45), 200);

        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Eres un experto contable español (PGC 2007). Analiza este documento financiero de la empresa "${empresa}" (ejercicio ${ejercicio}).

TIPO DE DOCUMENTO: ${tipoInfo?.label || u.type}
ARCHIVO: ${u.nombre}

Extrae de forma exhaustiva:

1. Para cada PÁGINA:
- documento: "${u.nombre}"
- pagina: número de página
- tipo: (balance/pyg/diario/extracto_bancario/portada/no_reconocida)
- confianza: 0-100
- razon: breve explicación
- cuentas_detectadas: número estimado

2. Para cada CUENTA/SUBCUENTA/PARTIDA:
- documento: "${u.nombre}"
- pagina: número
- bloque: sección contable (ej: "Activo No Corriente", "Gastos de personal", etc.)
- cuenta: código PGC (ej: "211000"). Vacío si no aparece.
- descripcion: nombre de la partida
- importe_actual: número. FORMATO ESPAÑOL: punto=miles, coma=decimal. "1.234,56" → 1234.56
- importe_anterior: si existe año anterior
- signo: "+" o "-"
- confianza: 0-100

REGLAS: Extrae TODAS las subcuentas, no solo totales. NO inventes importes. Formato numérico español.`,
          file_urls: [u.url],
          response_json_schema: schema,
          model: 'claude_sonnet_4_6',
        });

        if (result?.paginas) allPages.push(...result.paginas);
        if (result?.cuentas) allRawAccounts.push(...result.cuentas);
      }

      await setMsg('Fusionando y clasificando cuentas…', 82, 300);

      const rawPages = allPages;
      const rawAccounts = allRawAccounts;

      if (rawAccounts.length === 0) {
        setError('No se han podido extraer cuentas de los PDFs. Comprueba que los archivos son documentos contables legibles.');
        setLoading(false);
        return;
      }

      const processedPages = rawPages.map((p, i) => ({
        pagina: p.pagina || i + 1,
        documento: p.documento || '',
        tipo: p.tipo || 'no_reconocida',
        confianza: p.confianza || 80,
        razon: p.razon || 'Detectada por IA',
        cuentas: p.cuentas_detectadas || 0,
      }));

      const processedAccounts = rawAccounts.map((a, i) => {
        const cuentaStr = String(a.cuenta || '').trim();
        const cls = classifyAccount(cuentaStr);
        const importeActual = parseSpanishAmount(a.importe_actual);
        const importeAnterior = parseSpanishAmount(a.importe_anterior);
        const conf = a.confianza ?? 85;
        return {
          id: `pdf_${i}`,
          pagina: a.pagina || 1,
          documento: a.documento || '',
          bloque: a.bloque || 'Sin clasificar',
          cuenta: cuentaStr,
          descripcion: String(a.descripcion || '').trim(),
          importe_actual: importeActual,
          importe_anterior: importeAnterior,
          signo_detectado: a.signo || '+',
          masa: cls.masa,
          tipo_cuenta: cls.tipo,
          metodo: 'pdf_ia',
          confianza: conf,
          estado: conf < 70 ? 'pendiente_revision' : 'extraida',
          excluida: false,
        };
      });

      await setMsg('Procesando y construyendo tabla de cuentas…', 95, 300);

      setPages(processedPages);
      setAccounts(processedAccounts);
      setStep(1);
    } catch (e) {
      setError(`Error al procesar los PDFs: ${e.message}`);
    }
    setLoading(false);
    setLoadingProgress(0);
  };

  const updateAccount = (id, field, value) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, [field]: value, estado: 'corregida' } : a));
  };

  const toggleExclude = (id) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, excluida: !a.excluida } : a));
  };

  const validateAccount = (id) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, estado: 'validada' } : a));
  };

  const filteredAccounts = accounts.filter(a => {
    if (filterMasa !== 'all' && a.masa !== filterMasa) return false;
    if (filterConf === 'alta' && a.confianza < 85) return false;
    if (filterConf === 'media' && (a.confianza >= 85 || a.confianza < 70)) return false;
    if (filterConf === 'baja' && a.confianza >= 70) return false;
    return true;
  });

  const validAccounts = accounts.filter(a => !a.excluida);
  const pendingRevision = validAccounts.filter(a => a.estado === 'pendiente_revision').length;
  const lowConf = validAccounts.filter(a => a.confianza < 70).length;
  const avgConf = validAccounts.length > 0
    ? Math.round(validAccounts.reduce((s, a) => s + a.confianza, 0) / validAccounts.length)
    : 0;

  const buildMetrics = () => {
    const sum = (masa) => validAccounts.filter(a => a.masa === masa).reduce((s, a) => s + (a.importe_actual || 0), 0);
    const ingresos = validAccounts.filter(a => a.masa === 'pyg_ingreso').reduce((s, a) => s + Math.abs(a.importe_actual || 0), 0);
    const gastos   = validAccounts.filter(a => a.masa === 'pyg_gasto').reduce((s, a) => s + Math.abs(a.importe_actual || 0), 0);
    const resultado = ingresos - gastos;
    const totalActivo = sum('activo_no_corriente') + sum('activo_corriente');
    const patrimonioNeto = sum('patrimonio_neto');
    const pasivoCorriente = sum('pasivo_corriente');
    const pasivoNoCorriente = sum('pasivo_no_corriente');
    const activoCorriente = sum('activo_corriente');
    const totalPNPasivo = patrimonioNeto + pasivoCorriente + pasivoNoCorriente;
    const amortizacion = validAccounts.filter(a => String(a.cuenta).startsWith('68')).reduce((s, a) => s + Math.abs(a.importe_actual || 0), 0);
    return {
      ingresos, gastos, resultado,
      margen: ingresos > 0 ? resultado / ingresos * 100 : null,
      totalActivo, patrimonioNeto, pasivoCorriente, pasivoNoCorriente, activoCorriente,
      totalPNPasivo, amortizacion, ebitda: resultado + amortizacion,
      fondo_maniobra: activoCorriente - pasivoCorriente,
      balance: { totalActivo, patrimonioNeto, activoCorriente, pasivoCorriente, pasivoNoCorriente, totalPNPasivo, cuadra: Math.abs(totalActivo - totalPNPasivo) < 1, diferencia: Math.abs(totalActivo - totalPNPasivo) },
      pyg: { ingresos, gastos, resultado, margen: ingresos > 0 ? resultado / ingresos * 100 : null, amortizacion, ebitda: resultado + amortizacion },
    };
  };

  const handleSave = async () => {
    setLoading(true);
    setLoadingMsg('Guardando análisis…');
    const m = buildMetrics();
    const alerts = [];
    if (!m.balance.cuadra && m.totalActivo > 0) alerts.push({ nivel: 'critico', titulo: 'Balance descuadrado', desc: `Diferencia: ${fmt(m.balance.diferencia)}`, area: 'Balance' });
    if (lowConf > 0) alerts.push({ nivel: 'revisar', titulo: `${lowConf} cifra(s) con confianza baja`, desc: 'Revisar antes de usar el informe.', area: 'OCR' });
    if (pendingRevision > 0) alerts.push({ nivel: 'revisar', titulo: `${pendingRevision} cuenta(s) pendientes`, desc: 'No validadas por el usuario.', area: 'Revisión' });
    alerts.push({ nivel: 'informativo', titulo: `${pdfFiles.length} PDF(s) analizados`, desc: pdfFiles.map(f => f.file.name).join(', '), area: 'General' });

    const data = {
      company_id: companyId,
      nombre_archivo: pdfFiles.map(f => f.file.name).join(' + '),
      origen: 'pdf_auto',
      periodo_inicio: `${ejercicio}-01-01`,
      periodo_fin: `${ejercicio}-12-31`,
      empresa_nombre: empresa,
      estado: 'analizado',
      total_lineas: accounts.length,
      lineas_error: lowConf,
      lineas_advertencia: pendingRevision,
      alertas_criticas: alerts.filter(a => a.nivel === 'critico').length,
      calidad_dato: avgConf >= 85 ? 'alta' : avgConf >= 70 ? 'media' : 'baja',
      mapeo_columnas: { metodo: 'pdf_ia_v5', paginas: pages.length, cuentas: accounts.length, documentos: pdfFiles.length },
      supuestos_aplicados: [
        `${pdfFiles.length} PDF(s) analizados: ${pdfFiles.map(f => f.file.name).join(', ')}`,
        `Tipos de documento: ${pdfFiles.map(f => PDF_TYPES.find(t => t.value === f.type)?.label || f.type).join(', ')}`,
        `${pages.length} páginas procesadas · ${accounts.length} cuentas extraídas`,
        `Confianza media: ${avgConf}%`,
        `${accounts.filter(a => a.estado === 'corregida').length} correcciones manuales`,
        approvalMode === 'con_advertencias' ? 'Aprobado con advertencias' : 'Datos validados por el usuario',
      ],
      advertencias: alerts,
      metricas_calculadas: {
        cuentas: validAccounts,
        paginas: pages,
        balance: m.balance,
        pyg: m.pyg,
        total_activo: m.totalActivo,
        activo_corriente: m.activoCorriente,
        activo_no_corriente: m.totalActivo - m.activoCorriente,
        patrimonio_neto: m.patrimonioNeto,
        pasivo_corriente: m.pasivoCorriente,
        pasivo_no_corriente: m.pasivoNoCorriente,
        ingresos: m.ingresos,
        gastos: m.gastos,
        resultado_neto: m.resultado,
        margen_neto: m.margen,
        ebitda: m.ebitda,
        amortizacion: m.amortizacion,
        fondo_maniobra: m.fondo_maniobra,
        confianza_media: avgConf,
        fuente: 'pdf_multi_ia_v5',
        correcciones: accounts.filter(a => a.estado === 'corregida').length,
        pendientes: pendingRevision,
        alertas: alerts,
        ratios: [],
        mensual: [],
        gastos_dist: [],
      },
      usuario_importa: 'usuario_actual',
      version_mapeo: '5.0',
      notas: nota,
    };
    const saved = await base44.entities.AccountingImport.create(data);
    setLoading(false);
    onComplete(saved);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <h2 className="text-lg font-jakarta font-bold">Motor IA — Análisis multi-PDF</h2>
          <p className="text-xs text-slate-400">Sube todos los documentos necesarios · Extracción trazable · Cero cifras inventadas</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1 flex-shrink-0">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
              i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400')}>
              {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={cn("text-xs font-medium hidden md:block mr-2", i === step ? 'text-foreground' : 'text-slate-400')}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
          className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">

          {/* STEP 0 — Multi PDF upload */}
          {step === 0 && (
            <>
              <h3 className="text-base font-bold">Sube todos los documentos del análisis</h3>
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700"><strong>Puedes subir tantos PDFs como necesites:</strong> Balance de situación, PyG, balance comparativo, libro diario, extractos bancarios, cuentas anuales… La IA los analiza todos de forma integrada.</p>
              </div>

              {/* PDF list */}
              {pdfFiles.length > 0 && (
                <div className="space-y-2">
                  {pdfFiles.map(pf => {
                    const tipoInfo = PDF_TYPES.find(t => t.value === pf.type);
                    return (
                      <div key={pf.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                        <span className="text-lg flex-shrink-0">{tipoInfo?.emoji || '📄'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{pf.file.name}</p>
                          <select value={pf.type} onChange={e => updateFileType(pf.id, e.target.value)}
                            className="text-[10px] text-slate-500 bg-transparent border-none focus:outline-none cursor-pointer mt-0.5">
                            {PDF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <p className="text-[10px] text-slate-400 flex-shrink-0">{(pf.file.size / 1024).toFixed(0)} KB</p>
                        <button onClick={() => removeFile(pf.id)}><Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" /></button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add PDF area */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={pendingFileType} onChange={e => setPendingFileType(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 flex-1 min-w-0">
                    {PDF_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                  </select>
                </div>
                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/20 transition-all">
                  <Plus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-500">Añadir PDF</p>
                  <p className="text-xs text-slate-400 mt-0.5">Haz clic para seleccionar · Repite para añadir más</p>
                  <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                    onChange={e => { if (e.target.files[0]) addFile(e.target.files[0]); e.target.value = ''; }} />
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3"><p className="text-xs font-semibold text-red-700">{error}</p></div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Empresa / Cliente</label>
                  <input type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nombre empresa"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Ejercicio</label>
                  <input type="number" value={ejercicio} onChange={e => setEjercicio(e.target.value)} min={2015} max={2030}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Nota interna</label>
                <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Contexto, cliente, observaciones…"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none resize-none" />
              </div>

              {/* Type grid reference */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PDF_TYPES.map(t => (
                  <div key={t.value} className="flex items-start gap-2 bg-slate-50 rounded-xl p-2.5">
                    <span className="text-base flex-shrink-0">{t.emoji}</span>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-700">{t.label}</p>
                      <p className="text-[9px] text-slate-400">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* STEP 1: Pages summary */}
          {step === 1 && (
            <>
              <h3 className="text-base font-bold">Resultado del análisis IA</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Documentos analizados', value: pdfFiles.length },
                  { label: 'Páginas procesadas', value: pages.length },
                  { label: 'Cuentas detectadas', value: accounts.length },
                  { label: 'Confianza media', value: `${avgConf}%`, warn: avgConf < 70 },
                  { label: 'Baja confianza', value: lowConf, warn: lowConf > 0 },
                  { label: 'Pendientes revisión', value: pendingRevision, warn: pendingRevision > 0 },
                ].map((k, i) => (
                  <div key={i} className={cn("border rounded-xl p-3", k.warn ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100')}>
                    <p className={cn("text-lg font-bold font-jakarta", k.warn ? 'text-amber-700' : 'text-foreground')}>{k.value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>
              {pages.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {pages.map((p, i) => (
                    <div key={i} className="border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-slate-600">{p.pagina}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-bold capitalize", p.tipo === 'balance' ? 'text-blue-700' : p.tipo === 'pyg' ? 'text-emerald-700' : 'text-slate-500')}>{p.tipo}</span>
                          <ConfBadge v={p.confianza} />
                          {p.documento && <span className="text-[9px] text-slate-400 truncate max-w-[100px]">{p.documento}</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{p.razon}</p>
                      </div>
                      <p className="text-xs text-slate-500 flex-shrink-0">{p.cuentas} cuentas</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* STEP 2: Accounts table */}
          {step === 2 && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-base font-bold">Tabla de cuentas extraídas</h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select value={filterMasa} onChange={e => setFilterMasa(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                    <option value="all">Todas</option>
                    {Object.entries(MASA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={filterConf} onChange={e => setFilterConf(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                    <option value="all">Toda confianza</option>
                    <option value="alta">Alta (≥85%)</option>
                    <option value="media">Media (70-84%)</option>
                    <option value="baja">Baja (&lt;70%)</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-slate-400">{filteredAccounts.length} de {accounts.length} · Clic en celda para editar</p>
              <div className="overflow-x-auto rounded-xl border border-slate-100 max-h-96 overflow-y-auto">
                <table className="text-xs w-full min-w-[700px]">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {['Doc.','Pág.','Cuenta','Descripción','Masa','Importe actual','Importe ant.','Conf.','Acc.'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredAccounts.map(a => (
                      <tr key={a.id} className={cn("hover:bg-slate-50/50",
                        a.excluida && 'opacity-40 line-through',
                        a.confianza < 70 && 'bg-red-50/20',
                        a.estado === 'pendiente_revision' && 'bg-amber-50/20')}>
                        <td className="px-3 py-2 text-slate-400 text-[10px] truncate max-w-[60px]">{a.documento || '—'}</td>
                        <td className="px-3 py-2 text-slate-400 font-mono">{a.pagina}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-slate-800">{a.cuenta || '—'}</td>
                        <td className="px-3 py-2 max-w-36">
                          <EditableCell value={a.descripcion} onSave={v => updateAccount(a.id, 'descripcion', v)} />
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">{MASA_LABEL[a.masa] || a.masa}</span>
                        </td>
                        <td className="px-3 py-2">
                          <EditableCell value={a.importe_actual} onSave={v => updateAccount(a.id, 'importe_actual', Number(v))} type="number" />
                        </td>
                        <td className="px-3 py-2 text-slate-400 font-mono text-xs">{a.importe_anterior !== null && a.importe_anterior !== undefined ? fmt(a.importe_anterior) : '—'}</td>
                        <td className="px-3 py-2"><ConfBadge v={a.confianza} /></td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            {!a.excluida && a.estado !== 'validada' && (
                              <button onClick={() => validateAccount(a.id)} title="Validar"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 hover:text-emerald-700" /></button>
                            )}
                            <button onClick={() => toggleExclude(a.id)} title={a.excluida ? 'Incluir' : 'Excluir'}
                              className={cn("hover:opacity-70", a.excluida ? 'text-slate-400' : 'text-red-400')}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* STEP 3: Review */}
          {step === 3 && (() => {
            const m = buildMetrics();
            return (
              <>
                <h3 className="text-base font-bold">Validación previa al análisis</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Total activo', value: fmt(m.totalActivo), ok: m.totalActivo > 0 },
                    { label: 'PN + Pasivo', value: fmt(m.totalPNPasivo), ok: m.balance.cuadra },
                    { label: m.balance.cuadra ? '✓ Balance cuadra' : '⚠ Diferencia', value: m.balance.cuadra ? '—' : fmt(m.balance.diferencia), ok: m.balance.cuadra, warn: !m.balance.cuadra },
                    { label: 'Ingresos', value: fmt(m.ingresos), ok: m.ingresos > 0 },
                    { label: 'Gastos', value: fmt(m.gastos), ok: true },
                    { label: 'Resultado', value: fmt(m.resultado), ok: m.resultado >= 0, warn: m.resultado < 0 },
                  ].map((k, i) => (
                    <div key={i} className={cn("border rounded-xl p-3", k.warn ? 'bg-amber-50 border-amber-200' : k.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100')}>
                      <p className={cn("text-sm font-bold", k.warn ? 'text-amber-700' : k.ok ? 'text-emerald-700' : 'text-slate-600')}>{k.value}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
                    </div>
                  ))}
                </div>
                {(pendingRevision > 0 || lowConf > 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-amber-800 mb-1">⚠ Hay cifras pendientes de revisión</p>
                    {pendingRevision > 0 && <p className="text-xs text-amber-700">• {pendingRevision} cuenta(s) en estado "Pendiente"</p>}
                    {lowConf > 0 && <p className="text-xs text-amber-700">• {lowConf} cuenta(s) con confianza inferior al 70%</p>}
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">Modo de aprobación:</p>
                  {[
                    { id: 'validado', icon: Shield, label: 'Datos validados', desc: 'He revisado y confirmado todas las cuentas.' },
                    { id: 'con_advertencias', icon: AlertTriangle, label: 'Analizar con advertencias', desc: 'Continuar aunque hay cuentas pendientes.' },
                    { id: 'sin_informe', icon: Eye, label: 'Guardar sin informe', desc: 'Guardar para revisión posterior.' },
                  ].map(opt => { const Icon = opt.icon; return (
                    <button key={opt.id} onClick={() => setApprovalMode(opt.id)}
                      className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all",
                        approvalMode === opt.id ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50')}>
                      <Icon className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      <div><p className="text-xs font-bold text-foreground">{opt.label}</p><p className="text-[10px] text-slate-500">{opt.desc}</p></div>
                    </button>
                  ); })}
                </div>
              </>
            );
          })()}

          {/* STEP 4: Done */}
          {step === 4 && (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-3" />
              <h3 className="text-lg font-jakarta font-bold mb-2">Cuentas confirmadas</h3>
              <p className="text-sm text-slate-500">{validAccounts.length} cuentas · confianza media {avgConf}% · {pdfFiles.length} PDF(s) analizados</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-700 text-center max-w-xs">{loadingMsg}</p>
          {loadingProgress > 0 && (
            <div className="w-48 bg-slate-200 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${loadingProgress}%` }} />
            </div>
          )}
          <p className="text-xs text-slate-400">Motor IA en curso — no cierres esta ventana</p>
        </div>
      )}

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => step === 0 ? onCancel() : setStep(s => s - 1)} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancelar' : 'Atrás'}
        </button>
        {step === 0 && (
          <button onClick={runExtraction} disabled={pdfFiles.length === 0 || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold shadow-sm">
            <Eye className="w-4 h-4" /> Analizar {pdfFiles.length > 0 ? `${pdfFiles.length} PDF${pdfFiles.length > 1 ? 's' : ''}` : 'PDFs'} <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {step === 1 && <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm">Ver cuentas <ChevronRight className="w-4 h-4" /></button>}
        {step === 2 && <button onClick={() => setStep(3)} className="flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold shadow-sm">Validar <ChevronRight className="w-4 h-4" /></button>}
        {step === 3 && (
          <button onClick={() => setStep(4)} disabled={!approvalMode}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-sm font-semibold shadow-sm">
            <CheckCircle2 className="w-4 h-4" /> Confirmar revisión
          </button>
        )}
        {step === 4 && (
          <button onClick={handleSave} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Generar dashboard
          </button>
        )}
      </div>
    </motion.div>
  );
}
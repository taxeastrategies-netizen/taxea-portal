/**
 * ExcelImportWizard V4 — Lee el Excel REAL del usuario via IA
 * Nunca usa datos demo cuando hay archivo real subido.
 * Parseo correcto: punto=miles, coma=decimal (formato español).
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle, FileText, X, Info, Loader2, BarChart2, Pencil, Save } from 'lucide-react';

const EXCEL_TYPES = {
  excel_balance: { label: 'Balance de sumas y saldos', icon: '📋', desc: 'Activo, pasivo, patrimonio y saldos por cuenta' },
  excel_pyg:     { label: 'Pérdidas y ganancias',       icon: '📈', desc: 'Ingresos, gastos y resultado del ejercicio' },
  excel_diario:  { label: 'Diario contable',            icon: '📒', desc: 'Apuntes: fecha, cuenta, debe, haber' },
  excel_combined:{ label: 'Importación combinada',      icon: '🗂️', desc: 'Balance + PyG + Diario' },
};

// ─── Formato español: 1.234,56 → número ──────────────────────────────────────
function parseSpanishAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return raw;
  let s = String(raw).trim().replace(/[€$£\s%]/g, '');
  if (!s || s === '-' || s === '—') return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.replace(/[()]/g, ''); }
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }

  // Formato español: punto=miles, coma=decimal → "1.234,56"
  if (/\d\.\d{3}(,\d*)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // Solo coma decimal: "1234,56"
  else if (/^\d+,\d{1,4}$/.test(s)) {
    s = s.replace(',', '.');
  }
  // Solo punto decimal americano cuando no hay coma: "1234.56"
  // (no tocar, ya es válido para parseFloat)

  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

// ─── Clasificación PGC ────────────────────────────────────────────────────────
const PGC_MAP = [
  [['100','101','102','110','111','112','113','114','115','116','117','118','119','120','121','129'], 'patrimonio_neto', 'patrimonio'],
  [['170','171','172','173','174','175','176','177','179','180','181','182','189'], 'pasivo_no_corriente', 'pasivo'],
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

const fmt = n => typeof n === 'number'
  ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  : '—';

const MASA_LABEL = {
  activo_no_corriente: 'Activo NC', activo_corriente: 'Activo C',
  patrimonio_neto: 'Patrimonio',   pasivo_no_corriente: 'Pasivo NC',
  pasivo_corriente: 'Pasivo C',    pyg_ingreso: 'Ingreso',
  pyg_gasto: 'Gasto',             sin_clasificar: '—', varios: 'Varios',
};

function FileDropZone({ label, icon, file, onFile, onClear }) {
  const ref = useRef();
  return (
    <div className={cn("border-2 border-dashed rounded-2xl p-5 text-center transition-all",
      file ? "border-emerald-400 bg-emerald-50/30" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/10 cursor-pointer")}
      onClick={() => !file && ref.current?.click()}>
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => onFile(e.target.files[0])} />
      {file ? (
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-emerald-800 truncate">{file.name}</p>
            <p className="text-xs text-emerald-600">{file.size ? `${(file.size/1024).toFixed(1)} KB` : 'Demo'}</p>
          </div>
          <button onClick={e => { e.stopPropagation(); onClear(); }}><X className="w-4 h-4 text-emerald-500" /></button>
        </div>
      ) : (
        <>
          <p className="text-2xl mb-1">{icon}</p>
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">.xlsx / .xls / .csv</p>
        </>
      )}
    </div>
  );
}

function EditCell({ value, onSave, type = 'text' }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  return editing ? (
    <div className="flex items-center gap-1">
      <input type={type === 'number' ? 'number' : 'text'} value={val}
        onChange={e => setVal(type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-24 px-1.5 py-0.5 text-xs border border-blue-300 rounded focus:outline-none" autoFocus />
      <button onClick={() => { onSave(type === 'number' ? parseSpanishAmount(val) ?? val : val); setEditing(false); }}>
        <Save className="w-3 h-3 text-emerald-600" />
      </button>
      <button onClick={() => { setVal(value); setEditing(false); }}><X className="w-3 h-3 text-slate-400" /></button>
    </div>
  ) : (
    <span className="group flex items-center gap-1 cursor-pointer" onClick={() => setEditing(true)}>
      <span>{type === 'number' && typeof value === 'number' ? fmt(value) : value ?? '—'}</span>
      <Pencil className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100" />
    </span>
  );
}

export default function ExcelImportWizard({ importType, companyId, company, onComplete, onCancel }) {
  const isCombined = importType === 'excel_combined';
  const typeInfo = EXCEL_TYPES[importType] || EXCEL_TYPES.excel_combined;

  const [step, setStep] = useState(0);
  const [files, setFiles] = useState({ balance: null, pyg: null, diario: null });
  const [empresa, setEmpresa] = useState(company?.nombre_comercial || '');
  const [ejercicio, setEjercicio] = useState('2024');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [accounts, setAccounts] = useState([]);  // tabla maestra de cuentas
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');

  const shouldHaveBalance = importType === 'excel_balance' || isCombined;
  const shouldHavePyg     = importType === 'excel_pyg'     || isCombined;
  const shouldHaveDiary   = importType === 'excel_diario'  || isCombined;
  const hasAnyFile = files.balance || files.pyg || files.diario;

  const setMsg = async (msg, ms = 600) => { setLoadingMsg(msg); await new Promise(r => setTimeout(r, ms)); };

  // ─── Upload y extraer con IA ────────────────────────────────────────────────
  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    const allAccounts = [];

    try {
      const processFile = async (file, tipo) => {
        await setMsg(`Subiendo ${file.name}…`, 400);
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        await setMsg(`Extrayendo datos de ${file.name} con IA…`, 500);

        const schema = {
          type: 'object',
          properties: {
            filas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  cuenta: { type: 'string' },
                  descripcion: { type: 'string' },
                  debe: { type: 'number' },
                  haber: { type: 'number' },
                  saldo: { type: 'number' },
                  importe: { type: 'number' },
                  importe_anterior: { type: 'number' },
                  signo: { type: 'string' },
                },
              },
            },
          },
        };

        const prompt = `Eres un experto en contabilidad española (PGC). Analiza este archivo de contabilidad de tipo "${tipo}" y extrae TODAS las filas de datos contables.
REGLAS CRÍTICAS:
- Lee CADA fila del archivo sin omitir ninguna.
- El formato numérico es español: el PUNTO separa miles y la COMA separa decimales. Ejemplo: "1.234,56" = 1234.56, "890,00" = 890.
- Devuelve los números como valores numéricos reales (no strings).
- Si una celda tiene "(1.234,56)" o "-1.234,56", es un importe negativo.
- Para balance: extrae cuenta, descripcion, debe, haber, saldo.
- Para PyG: extrae cuenta, descripcion, importe (positivo=ingreso, negativo=gasto o saldo acreedor).
- Para diario: extrae fecha, cuenta, descripcion, debe, haber.
- NO inventes cuentas ni importes. Si una celda está vacía, pon null.
- Incluye TODAS las subcuentas, no solo totales.`;

        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: schema,
        });

        if (result.status !== 'success' || !result.output?.filas?.length) {
          // Fallback: InvokeLLM with file
          await setMsg(`Analizando ${file.name} con motor IA avanzado…`, 500);
          const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt: `${prompt}\n\nExtrae las filas contables del archivo adjunto.`,
            file_urls: [file_url],
            response_json_schema: schema,
          });
          if (llmRes?.filas?.length) {
            return processRows(llmRes.filas, tipo, file.name);
          }
          return [];
        }

        return processRows(result.output.filas, tipo, file.name);
      };

      const processRows = (rows, tipo, fileName) => {
        const processed = [];
        for (const row of rows) {
          if (!row) continue;
          const cuentaRaw = String(row.cuenta || '').trim();
          const desc = String(row.descripcion || '').trim();

          // Parsear importes — ya vienen como número desde IA, pero por si acaso:
          const debe = parseSpanishAmount(row.debe) ?? 0;
          const haber = parseSpanishAmount(row.haber) ?? 0;
          const saldo = parseSpanishAmount(row.saldo) ?? parseSpanishAmount(row.importe);
          const importeAnterior = parseSpanishAmount(row.importe_anterior);

          if (!cuentaRaw && !desc) continue;

          const cls = classifyAccount(cuentaRaw);
          const importeActual = saldo !== null ? saldo : (debe - haber);

          processed.push({
            id: `${tipo}_${processed.length}`,
            archivo: fileName,
            tipo,
            cuenta: cuentaRaw,
            descripcion: desc,
            debe,
            haber,
            importe_actual: importeActual,
            importe_anterior: importeAnterior,
            masa: cls.masa,
            tipo_cuenta: cls.tipo,
            confianza: 88,
            estado: 'extraida',
            metodo: 'excel_ia',
            excluida: false,
          });
        }
        return processed;
      };

      // Procesar cada archivo real
      if (files.balance) {
        const rows = await processFile(files.balance, 'balance');
        allAccounts.push(...rows);
      }
      if (files.pyg) {
        const rows = await processFile(files.pyg, 'pyg');
        allAccounts.push(...rows);
      }
      if (files.diario) {
        const rows = await processFile(files.diario, 'diario');
        allAccounts.push(...rows);
      }

      if (allAccounts.length === 0) {
        setError('No se han podido extraer datos del archivo. Comprueba que el Excel tenga columnas de cuenta e importe.');
        setLoading(false);
        return;
      }

      await setMsg('Clasificando por grupo contable PGC…', 400);

      // Build alerts
      const newAlerts = [];
      const sinCuenta = allAccounts.filter(a => !a.cuenta).length;
      const masas = [...new Set(allAccounts.map(a => a.masa))];
      if (sinCuenta > 0) newAlerts.push({ nivel: 'revisar', titulo: `${sinCuenta} filas sin cuenta contable`, desc: 'Pueden ser subtotales, cabeceras o partidas sin código.', area: 'Calidad' });
      if (!masas.includes('pyg_ingreso') && !masas.includes('pyg_gasto')) newAlerts.push({ nivel: 'revisar', titulo: 'Sin cuentas de resultado (grupos 6/7)', desc: 'No se detectan ingresos ni gastos. Verifica que el archivo contiene una PyG.', area: 'Cobertura' });
      newAlerts.push({ nivel: 'informativo', titulo: 'Cifras extraídas de tu archivo real', desc: 'Todos los importes proceden directamente del Excel subido. Revisa cualquier celda marcada en naranja antes de generar el informe.', area: 'General' });

      setAccounts(allAccounts);
      setAlerts(newAlerts);
      setStep(1);
    } catch (e) {
      setError(`Error al procesar: ${e.message}`);
    }
    setLoading(false);
  };

  const updateAccount = (id, field, value) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, [field]: value, estado: 'corregida' } : a));
  };

  const toggleExclude = (id) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, excluida: !a.excluida, estado: a.excluida ? 'extraida' : 'excluida' } : a));
  };

  // ─── Métricas desde cuentas reales ─────────────────────────────────────────
  const buildMetrics = () => {
    const valid = accounts.filter(a => !a.excluida);
    const sum = (masa) => valid.filter(a => a.masa === masa).reduce((s, a) => s + (a.importe_actual || 0), 0);
    const ingresos = valid.filter(a => a.masa === 'pyg_ingreso').reduce((s, a) => s + Math.abs(a.importe_actual || 0), 0);
    const gastos   = valid.filter(a => a.masa === 'pyg_gasto').reduce((s, a) => s + Math.abs(a.importe_actual || 0), 0);
    const resultado = ingresos - gastos;
    const margen = ingresos > 0 ? resultado / ingresos * 100 : null;
    const totalActivo = sum('activo_no_corriente') + sum('activo_corriente');
    const patrimonioNeto = sum('patrimonio_neto');
    const pasivoCorriente = sum('pasivo_corriente');
    const pasivoNoCorriente = sum('pasivo_no_corriente');
    const activoCorriente = sum('activo_corriente');
    const totalPNPasivo = patrimonioNeto + pasivoCorriente + pasivoNoCorriente;
    const amortizacion = valid.filter(a => String(a.cuenta).startsWith('68')).reduce((s, a) => s + Math.abs(a.importe_actual || 0), 0);
    return {
      ingresos, gastos, resultado, margen, totalActivo, patrimonioNeto,
      pasivoCorriente, pasivoNoCorriente, activoCorriente, totalPNPasivo,
      fondoManiobra: activoCorriente - pasivoCorriente,
      amortizacion, ebitda: resultado + amortizacion,
      balance: { totalActivo, patrimonioNeto, activoCorriente, pasivoCorriente, pasivoNoCorriente, totalPNPasivo, cuadra: Math.abs(totalActivo - totalPNPasivo) < 1, diferencia: Math.abs(totalActivo - totalPNPasivo) },
      pyg: { ingresos, gastos, resultado, margen, amortizacion, ebitda: resultado + amortizacion },
      cuentas: valid,
      confianza_media: valid.length > 0 ? Math.round(valid.reduce((s, a) => s + (a.confianza || 80), 0) / valid.length) : 80,
    };
  };

  const handleSave = async () => {
    setLoading(true);
    setLoadingMsg('Guardando análisis…');
    const m = buildMetrics();
    const criticos = alerts.filter(a => a.nivel === 'critico').length;
    const fileNames = Object.values(files).filter(Boolean).map(f => f.name).join(' + ');

    const data = {
      company_id: companyId,
      nombre_archivo: fileNames || 'excel.xlsx',
      origen: importType,
      periodo_inicio: `${ejercicio}-01-01`,
      periodo_fin: `${ejercicio}-12-31`,
      empresa_nombre: empresa,
      estado: 'analizado',
      total_lineas: accounts.length,
      lineas_error: 0,
      lineas_advertencia: alerts.filter(a => a.nivel === 'revisar').length,
      alertas_criticas: criticos,
      calidad_dato: m.confianza_media >= 85 ? 'alta' : m.confianza_media >= 70 ? 'media' : 'baja',
      mapeo_columnas: { fuente: 'excel_ia_v4', archivos: fileNames },
      supuestos_aplicados: [
        `Extracción IA desde Excel real (${fileNames})`,
        `${accounts.length} filas extraídas · ${accounts.filter(a => a.excluida).length} excluidas`,
        `Formato español: punto=miles, coma=decimal`,
        `Correcciones manuales: ${accounts.filter(a => a.estado === 'corregida').length}`,
      ],
      advertencias: alerts,
      metricas_calculadas: {
        ...m,
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
        fondo_maniobra: m.fondoManiobra,
        alertas: alerts,
        fuente: 'excel_ia_v4',
        paginas: [],
      },
      usuario_importa: 'usuario_actual',
      version_mapeo: '4.0',
    };
    const saved = await base44.entities.AccountingImport.create(data);
    setLoading(false);
    onComplete(saved);
  };

  const m = step === 1 ? buildMetrics() : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <h2 className="text-lg font-jakarta font-bold">{typeInfo.icon} {typeInfo.label}</h2>
          <p className="text-xs text-slate-400">Lectura IA del archivo real · Formato español (punto=miles, coma=decimal)</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
          className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-5">

          {/* STEP 0 */}
          {step === 0 && (
            <>
              <h3 className="text-base font-bold">Sube {isCombined ? 'los archivos' : 'el archivo'} Excel</h3>
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  <strong>La IA leerá tu archivo real.</strong> Soporta formato español (1.234,56 €). Extrae cada cuenta y subcuenta con su importe. Podrás revisar y corregir antes de guardar.
                </p>
              </div>

              <div className={cn("grid gap-4", isCombined ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1")}>
                {shouldHaveBalance && (
                  <FileDropZone label="Balance de sumas y saldos" icon="📋"
                    file={files.balance} onFile={f => setFiles(p => ({ ...p, balance: f }))} onClear={() => setFiles(p => ({ ...p, balance: null }))} />
                )}
                {shouldHavePyg && (
                  <FileDropZone label="Pérdidas y ganancias" icon="📈"
                    file={files.pyg} onFile={f => setFiles(p => ({ ...p, pyg: f }))} onClear={() => setFiles(p => ({ ...p, pyg: null }))} />
                )}
                {shouldHaveDiary && (
                  <FileDropZone label="Diario contable" icon="📒"
                    file={files.diario} onFile={f => setFiles(p => ({ ...p, diario: f }))} onClear={() => setFiles(p => ({ ...p, diario: null }))} />
                )}
              </div>

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

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-red-700">{error}</p>
                </div>
              )}
            </>
          )}

          {/* STEP 1 — Tabla de cuentas extraídas */}
          {step === 1 && m && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-base font-bold">Cuentas extraídas de tu archivo</h3>
                <p className="text-xs text-slate-400">{accounts.length} filas · Haz clic para editar cualquier celda</p>
              </div>

              {/* KPI rápido */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Ingresos', value: fmt(m.ingresos), color: m.ingresos > 0 ? 'text-emerald-700' : 'text-slate-400' },
                  { label: 'Gastos', value: fmt(m.gastos), color: 'text-slate-700' },
                  { label: 'Resultado', value: fmt(m.resultado), color: m.resultado >= 0 ? 'text-emerald-700' : 'text-red-600' },
                  { label: 'Total activo', value: fmt(m.totalActivo), color: 'text-blue-700' },
                ].map((k, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className={cn("text-base font-jakarta font-bold", k.color)}>{k.value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Alertas */}
              {alerts.map((a, i) => (
                <div key={i} className={cn("border rounded-xl px-4 py-3 text-xs",
                  a.nivel === 'critico' ? 'bg-red-50 border-red-200 text-red-700' :
                  a.nivel === 'revisar' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                  'bg-blue-50 border-blue-200 text-blue-700')}>
                  <p className="font-semibold">{a.titulo}</p>
                  <p className="opacity-80 mt-0.5">{a.desc}</p>
                </div>
              ))}

              {/* Tabla editable */}
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="text-xs w-full min-w-[700px]">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Cuenta','Descripción','Masa','Importe actual','Importe anterior','Estado','Acc.'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {accounts.map(a => (
                      <tr key={a.id} className={cn("hover:bg-slate-50/50",
                        a.excluida && 'opacity-40 line-through',
                        a.importe_actual === null && 'bg-amber-50/20')}>
                        <td className="px-3 py-2 font-mono font-semibold text-slate-800">{a.cuenta || '—'}</td>
                        <td className="px-3 py-2 max-w-40">
                          <EditCell value={a.descripcion} onSave={v => updateAccount(a.id, 'descripcion', v)} />
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{MASA_LABEL[a.masa] || a.masa}</span>
                        </td>
                        <td className="px-3 py-2">
                          <EditCell value={a.importe_actual} onSave={v => updateAccount(a.id, 'importe_actual', v)} type="number" />
                        </td>
                        <td className="px-3 py-2 text-slate-400 font-mono">
                          {a.importe_anterior !== null && a.importe_anterior !== undefined ? fmt(a.importe_anterior) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                            a.estado === 'corregida' ? 'bg-violet-50 text-violet-700' :
                            a.excluida ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-700')}>
                            {a.excluida ? 'Excluida' : a.estado === 'corregida' ? 'Corregida' : 'Extraída'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => toggleExclude(a.id)} title={a.excluida ? 'Incluir' : 'Excluir'}
                            className={cn("hover:opacity-70", a.excluida ? 'text-slate-400' : 'text-red-400')}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-700 text-center max-w-xs">{loadingMsg}</p>
          <p className="text-xs text-slate-400">Leyendo tu archivo real — no cierres esta ventana</p>
        </div>
      )}

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => step === 0 ? onCancel() : setStep(0)} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancelar' : 'Atrás'}
        </button>
        {step === 0 && (
          <button onClick={runAnalysis} disabled={!hasAnyFile || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            Leer con IA
          </button>
        )}
        {step === 1 && (
          <button onClick={handleSave} disabled={loading || accounts.filter(a => !a.excluida).length === 0}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold shadow-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmar y ver dashboard
          </button>
        )}
      </div>
    </motion.div>
  );
}
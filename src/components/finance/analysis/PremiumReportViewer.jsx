/**
 * PremiumReportViewer — Informe Financiero Premium Taxea Strategies
 * Generación IA + Exportación PDF con logo corporativo
 */
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import {
  ChevronLeft, Shield, FileText, BarChart2, AlertTriangle,
  CheckCircle2, TrendingUp, TrendingDown, Info, Download,
  Loader2, Sparkles, RefreshCw, Circle, ChevronRight
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = n => typeof n === 'number'
  ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : '—';
const fmtDec = n => typeof n === 'number'
  ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) : '—';
const pct = n => typeof n === 'number' ? `${n.toFixed(1)}%` : '—';
const today = () => new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

// ─── Logo Taxea Strategies (SVG inline) ───────────────────────────────────────
const TAXEA_LOGO_URL = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';

// ─── Semáforo ──────────────────────────────────────────────────────────────────
function Semaforo({ label, estado, comentario }) {
  const cfg = {
    verde:   { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Favorable' },
    ambar:   { bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-400',   text: 'text-amber-700',   label: 'Revisar'    },
    rojo:    { bg: 'bg-red-50',     border: 'border-red-200',     dot: 'bg-red-500',     text: 'text-red-700',     label: 'Alerta'     },
    gris:    { bg: 'bg-slate-50',   border: 'border-slate-200',   dot: 'bg-slate-400',   text: 'text-slate-600',   label: 'Sin datos'  },
  };
  const c = cfg[estado] || cfg.gris;
  return (
    <div className={cn('border rounded-xl p-3', c.bg, c.border)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', c.dot)} />
        <p className="text-xs font-bold text-slate-800">{label}</p>
        <span className={cn('ml-auto text-[10px] font-bold', c.text)}>{c.label}</span>
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">{comentario}</p>
    </div>
  );
}

// ─── Alert card ───────────────────────────────────────────────────────────────
function AlertCard({ nivel, titulo, desc, area, recomendacion }) {
  const cfg = {
    critico:     { bg: 'bg-red-50',    border: 'border-red-300',   badge: 'bg-red-600 text-white',     icon: '🔴' },
    alta:        { bg: 'bg-red-50',    border: 'border-red-200',   badge: 'bg-red-100 text-red-700',    icon: '🟠' },
    media:       { bg: 'bg-amber-50',  border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700',icon: '🟡' },
    baja:        { bg: 'bg-blue-50',   border: 'border-blue-200',  badge: 'bg-blue-100 text-blue-700',  icon: 'ℹ️' },
    informativo: { bg: 'bg-slate-50',  border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600',icon: '💡' },
    revisar:     { bg: 'bg-amber-50',  border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700',icon: '🟡' },
  };
  const c = cfg[nivel] || cfg.informativo;
  return (
    <div className={cn('border rounded-xl px-4 py-3', c.bg, c.border)}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span>{c.icon}</span>
        <p className="text-xs font-bold text-slate-800 flex-1">{titulo}</p>
        <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full uppercase', c.badge)}>{nivel}</span>
        {area && <span className="text-[9px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">{area}</span>}
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
      {recomendacion && <p className="text-[10px] text-slate-500 mt-1 italic">{recomendacion}</p>}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({ title, subtitle, children, accent }) {
  return (
    <div className={cn('bg-white border rounded-2xl shadow-sm p-6 space-y-4', accent ? 'border-slate-300' : 'border-slate-100')}>
      <div className="border-b border-slate-100 pb-3">
        <p className="text-sm font-bold text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function KpiRow({ label, value, color, note, indent }) {
  return (
    <div className={cn('flex items-center justify-between py-2 border-b border-slate-50 last:border-0', indent && 'pl-4')}>
      <div>
        <p className={cn('text-xs font-medium', indent ? 'text-slate-500' : 'text-slate-700')}>{label}</p>
        {note && <p className="text-[10px] text-slate-400 mt-0.5">{note}</p>}
      </div>
      <p className={cn('text-sm font-bold', color || 'text-foreground')}>{value}</p>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { label: 'Resumen ejecutivo' },
  { label: 'Balance' },
  { label: 'PyG' },
  { label: 'Ratios' },
  { label: 'Alertas' },
  { label: 'Fiscalidad' },
  { label: 'Plan de acción' },
  { label: 'Trazabilidad' },
];

export default function PremiumReportViewer({ imp, onBack }) {
  const [tab, setTab] = useState(0);
  const [report, setReport] = useState(null);
  const [aiContent, setAiContent] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    if (!imp?.id) return;
    base44.entities.FinancialReport.filter({ import_id: imp.id }, '-created_date', 1)
      .then(results => {
        if (results?.length > 0) {
          setReport(results[0]);
          if (results[0].contenido?.narrativa) setAiContent(results[0].contenido.narrativa);
        }
      });
  }, [imp?.id]);

  // ─── Data derivation ───────────────────────────────────────────────────────
  const m = report?.contenido || imp?.metricas_calculadas || {};
  const balance = m.balance || {};
  const pyg = m.pyg || {};
  const cuentas = m.cuentas || [];
  const alertasBase = m.alertas || report?.alertas || imp?.advertencias || [];
  const supuestos = imp?.supuestos_aplicados || [];
  const confianza = m.confianza_media;
  const ejercicio = imp?.periodo_fin?.substring(0, 4) || new Date().getFullYear();
  const empresa = imp?.empresa_nombre || 'Sociedad analizada';

  const totalActivo = balance.totalActivo || 0;
  const patrimonioNeto = balance.patrimonioNeto || 0;
  const activoCorriente = balance.activoCorriente || 0;
  const activoNoCorriente = totalActivo - activoCorriente;
  const pasivoCorriente = balance.pasivoCorriente || 0;
  const pasivoNoCorriente = balance.pasivoNoCorriente || 0;
  const totalPasivo = pasivoCorriente + pasivoNoCorriente;
  const ingresos = pyg.ingresos || 0;
  const gastos = pyg.gastos || 0;
  const resultado = pyg.resultado || 0;
  const ebitda = pyg.ebitda || 0;
  const fondoManiobra = activoCorriente - pasivoCorriente;

  // Detect special account categories
  const cuentas555 = cuentas.filter(a => String(a.cuenta).startsWith('555'));
  const cuentasVinculadas = cuentas.filter(a => ['551','552','553','1635','1636'].some(p => String(a.cuenta).startsWith(p)));
  const cuentasIntangibles = cuentas.filter(a => ['200','201','202','203','206'].some(p => String(a.cuenta).startsWith(p)));
  const cuentasFiscales = cuentas.filter(a => ['472','474','475','476','477'].some(p => String(a.cuenta).startsWith(p)));
  const tesoreria = cuentas.filter(a => String(a.cuenta).startsWith('57')).reduce((s, a) => s + Math.abs(a.importe_actual || 0), 0);

  // Ratios
  const ratios = [
    { grupo: 'Liquidez', nombre: 'Liquidez corriente', formula: 'Activo C / Pasivo C', valor: pasivoCorriente > 0 ? (activoCorriente / pasivoCorriente).toFixed(2) : '—', ok: pasivoCorriente > 0 && activoCorriente / pasivoCorriente >= 1, ref: '≥ 1,0', interpretacion: pasivoCorriente > 0 && activoCorriente / pasivoCorriente >= 1 ? 'Posición de liquidez favorable.' : 'Riesgo de tensión de liquidez a corto plazo.' },
    { grupo: 'Liquidez', nombre: 'Fondo de maniobra', formula: 'Activo C − Pasivo C', valor: fmt(fondoManiobra), ok: fondoManiobra >= 0, ref: '> 0', interpretacion: fondoManiobra >= 0 ? 'Fondo de maniobra positivo.' : 'Fondo de maniobra negativo — revisar.' },
    { grupo: 'Liquidez', nombre: 'Tesorería / Pasivo C', formula: 'Tesorería / Pasivo C', valor: pasivoCorriente > 0 ? pct(tesoreria / pasivoCorriente * 100) : '—', ok: pasivoCorriente > 0 && tesoreria / pasivoCorriente >= 0.2, ref: '≥ 20%', interpretacion: 'Cobertura de tesorería sobre deuda a corto.' },
    { grupo: 'Endeudamiento', nombre: 'Autonomía financiera', formula: 'PN / Total Activo', valor: totalActivo > 0 ? pct(patrimonioNeto / totalActivo * 100) : '—', ok: totalActivo > 0 && patrimonioNeto / totalActivo >= 0.3, ref: '≥ 30%', interpretacion: totalActivo > 0 && patrimonioNeto / totalActivo >= 0.3 ? 'Estructura patrimonial sólida.' : 'Dependencia financiera elevada.' },
    { grupo: 'Endeudamiento', nombre: 'Endeudamiento total', formula: 'Pasivo / PN', valor: patrimonioNeto > 0 ? (totalPasivo / patrimonioNeto).toFixed(2) : '—', ok: patrimonioNeto > 0 && totalPasivo / patrimonioNeto < 2, ref: '< 2,0', interpretacion: 'Relación entre deuda y recursos propios.' },
    { grupo: 'Rentabilidad', nombre: 'ROA', formula: 'Resultado / Total Activo', valor: totalActivo > 0 ? pct(resultado / totalActivo * 100) : '—', ok: resultado > 0, ref: '> 0%', interpretacion: 'Rentabilidad sobre activos totales.' },
    { grupo: 'Rentabilidad', nombre: 'ROE', formula: 'Resultado / PN', valor: patrimonioNeto > 0 ? pct(resultado / patrimonioNeto * 100) : '—', ok: resultado > 0, ref: '> 0%', interpretacion: 'Rentabilidad sobre recursos propios.' },
    { grupo: 'Rentabilidad', nombre: 'Margen neto', formula: 'Resultado / Ingresos', valor: ingresos > 0 ? pct(resultado / ingresos * 100) : '—', ok: resultado > 0, ref: '> 0%', interpretacion: 'Porcentaje de beneficio sobre ingresos.' },
    { grupo: 'Rentabilidad', nombre: 'Margen explotación', formula: 'Resultado / Ingresos (sin financiero)', valor: ingresos > 0 ? pct(resultado / ingresos * 100) : '—', ok: resultado > 0, ref: '> 0%', interpretacion: 'Aproximación margen de explotación.' },
  ];

  // Semáforo state derivation
  const semaforos = [
    {
      label: 'Liquidez',
      estado: pasivoCorriente <= 0 ? 'gris' : activoCorriente / pasivoCorriente >= 1.2 ? 'verde' : activoCorriente / pasivoCorriente >= 1 ? 'ambar' : 'rojo',
      comentario: pasivoCorriente <= 0 ? 'Sin datos suficientes de pasivo corriente.' : activoCorriente / pasivoCorriente >= 1.2 ? `Ratio de liquidez de ${(activoCorriente/pasivoCorriente).toFixed(2)}x. La sociedad dispone de activo corriente suficiente para cubrir sus obligaciones a corto plazo.` : `Ratio de liquidez de ${(activoCorriente/pasivoCorriente).toFixed(2)}x. Revisar gestión de pagos y cobros.`,
    },
    {
      label: 'Endeudamiento',
      estado: patrimonioNeto <= 0 ? 'rojo' : totalPasivo / patrimonioNeto < 1.5 ? 'verde' : totalPasivo / patrimonioNeto < 2.5 ? 'ambar' : 'rojo',
      comentario: patrimonioNeto <= 0 ? 'Patrimonio neto negativo o insuficiente. Riesgo mercantil.' : `Ratio de endeudamiento de ${patrimonioNeto > 0 ? (totalPasivo/patrimonioNeto).toFixed(2) : '—'}x.${cuentasVinculadas.length > 0 ? ' Se identifican posibles deudas con partes vinculadas que requieren análisis.' : ''}`,
    },
    {
      label: 'Rentabilidad',
      estado: resultado > 0 ? 'verde' : resultado === 0 ? 'gris' : 'rojo',
      comentario: resultado > 0 ? `Resultado positivo de ${fmt(resultado)}. Margen neto estimado: ${ingresos > 0 ? pct(resultado/ingresos*100) : '—'}.` : resultado < 0 ? `Resultado negativo de ${fmt(resultado)}. Revisar estructura de costes e ingresos.` : 'Sin datos de resultado.',
    },
    {
      label: 'Calidad contable',
      estado: !balance.cuadra && totalActivo > 0 ? 'rojo' : cuentas.filter(a => a.estado === 'pendiente_revision').length > 3 ? 'ambar' : cuentas.filter(a => a.confianza < 70).length > 0 ? 'ambar' : 'verde',
      comentario: !balance.cuadra && totalActivo > 0 ? `Balance con diferencia de ${fmt(balance.diferencia)}. Revisar antes de considerar definitivo el cierre.` : 'Calidad del cierre contable aparentemente razonable, pendiente de contraste documental.',
    },
    {
      label: 'Fiscalidad',
      estado: cuentasFiscales.length > 0 ? 'ambar' : 'gris',
      comentario: cuentasFiscales.length > 0 ? 'Se identifican cuentas fiscales (IVA, retenciones, impuestos). Revisar coherencia con modelos tributarios presentados.' : 'No se dispone de información fiscal suficiente para emitir diagnóstico. Aportar modelos fiscales para análisis completo.',
    },
    {
      label: 'Riesgo mercantil',
      estado: patrimonioNeto < 0 ? 'rojo' : patrimonioNeto < totalActivo * 0.1 ? 'ambar' : 'verde',
      comentario: patrimonioNeto < 0 ? 'Patrimonio neto negativo. Posible causa de disolución. Análisis jurídico-mercantil recomendado.' : patrimonioNeto < totalActivo * 0.1 ? 'Patrimonio neto reducido en relación al activo. Revisar situación patrimonial y aportaciones de socios.' : 'Situación patrimonial aparentemente favorable.',
    },
  ];

  // Alertas enriquecidas
  const alertasEnriquecidas = [
    ...alertasBase,
    ...(!balance.cuadra && totalActivo > 0 ? [{ nivel: 'critico', titulo: 'Descuadre balance activo/pasivo', desc: `El total activo (${fmt(totalActivo)}) no coincide con el total de patrimonio neto más pasivo (${fmt(totalPasivo + patrimonioNeto)}). Diferencia: ${fmt(balance.diferencia)}. Revisar antes de considerar definitivo el cierre contable.`, area: 'Contable', recomendacion: 'Contrastar con el mayor contable y conciliar cuenta a cuenta.' }] : []),
    ...(cuentasVinculadas.length > 0 ? [{ nivel: 'alta', titulo: 'Operaciones con partes vinculadas', desc: `Se identifican ${cuentasVinculadas.length} cuenta(s) con posibles saldos con socios, administradores o partes vinculadas. Requieren soporte documental, análisis de condiciones de mercado y revisión de su tratamiento fiscal.`, area: 'Fiscal / Vinculadas', recomendacion: 'Aportar contratos, cuadros de amortización e intereses pactados.' }] : []),
    ...(cuentasIntangibles.length > 0 ? [{ nivel: 'alta', titulo: 'Activos intangibles de importe relevante', desc: `Se detectan activos intangibles activados. En caso de corresponder a desarrollo web, aplicaciones informáticas o proyectos de I+D, revisar criterios de activación, vida útil y plan de amortización.`, area: 'Contable', recomendacion: 'Aportar facturas soporte, contrato con desarrollador y criterio de activación aplicado.' }] : []),
    ...(tesoreria > totalActivo * 0.4 && tesoreria > 0 ? [{ nivel: 'media', titulo: 'Tesorería elevada en proporción al activo', desc: `La posición de tesorería (${fmt(tesoreria)}) representa más del 40% del activo total. Verificar si incluye fondos de terceros, procesadores de pago u otros conceptos pendientes de liquidación.`, area: 'Tesorería', recomendacion: 'Conciliar con extractos bancarios y plataformas de pago (Stripe, Redsys, Paycomet, Revolut, etc.).' }] : []),
    ...(cuentas555.length > 0 ? [{ nivel: 'media', titulo: 'Saldo en cuentas de socios/admin (555)', desc: 'Se identifican partidas en cuentas 555 (partidas pendientes de aplicación). Clasificar y documentar su naturaleza antes del cierre definitivo.', area: 'Contable', recomendacion: 'Revisar si corresponden a anticipos, dividendos pendientes o aportaciones no formalizadas.' }] : []),
    ...(!balance.cuadra || (resultado < 0) || patrimonioNeto < 0 ? [] : [{ nivel: 'informativo', titulo: 'Análisis fiscal preliminar', desc: 'El presente análisis fiscal tiene carácter exclusivamente preliminar. Para emitir conclusiones definitivas es necesario contrastar con modelos tributarios presentados, declaraciones del IS y libros registro.', area: 'Fiscal' }]),
  ];

  // Plan de actuación
  const planActuacion = [
    { prioridad: 1, color: 'border-red-300 bg-red-50', labelColor: 'bg-red-600 text-white', label: 'Crítica', items: [
      !balance.cuadra && totalActivo > 0 ? 'Conciliar balance — diferencia detectada entre activo y pasivo+PN' : null,
      Math.abs(resultado - (m.resultado_balance || resultado)) > 100 ? 'Verificar coherencia entre resultado de balance y resultado de PyG' : null,
      'Conciliar saldos bancarios y procesadores de pago con la contabilidad',
      'Revisar IVA/IGIC repercutido y soportado frente a modelos presentados',
      cuentas.filter(a => a.importe_actual < 0 && ['activo_corriente','activo_no_corriente'].includes(a.masa)).length > 0 ? 'Revisar saldos negativos detectados en cuentas de activo' : null,
    ].filter(Boolean) },
    { prioridad: 2, color: 'border-amber-300 bg-amber-50', labelColor: 'bg-amber-500 text-white', label: 'Contable', items: [
      cuentasIntangibles.length > 0 ? 'Revisar activación y amortización de activos intangibles' : null,
      'Revisar clientes y proveedores pendientes de cobro/pago y antigüedad',
      'Revisar facturas pendientes de recibir y partidas pendientes de aplicación',
      'Revisar ingresos y gastos de carácter excepcional o no recurrente',
      'Contrastar existencias y amortizaciones con inventario físico',
    ].filter(Boolean) },
    { prioridad: 3, color: 'border-blue-300 bg-blue-50', labelColor: 'bg-blue-600 text-white', label: 'Fiscal', items: [
      cuentasVinculadas.length > 0 ? 'Documentar operaciones vinculadas con socios o partes relacionadas' : null,
      'Revisar deducibilidad fiscal de gastos registrados',
      'Verificar bases imponibles negativas y activos por impuesto diferido',
      'Revisar Impuesto sobre Sociedades y pagos fraccionados',
      'Comprobar retenciones practicadas a profesionales y arrendadores',
    ].filter(Boolean) },
    { prioridad: 4, color: 'border-emerald-300 bg-emerald-50', labelColor: 'bg-emerald-600 text-white', label: 'Estratégica', items: [
      'Implementar cuadro de mando financiero mensual',
      'Definir KPIs de seguimiento: margen, tesorería, DSO, DPO',
      'Revisar estructura de costes y margen por línea de negocio',
      'Elaborar forecast de tesorería a 12 meses',
      'Valorar estructuración de deuda financiera y coste de capital',
    ] },
  ];

  // Documentación recomendada
  const docRecomendada = [
    'Balance de sumas y saldos completo',
    'Mayor contable de cuentas 400, 410, 430, 472, 477, 555, 118, 121, 129',
    ...(cuentasVinculadas.length > 0 ? ['Contratos de préstamo socio-sociedad e intereses pactados', 'Actas de junta relativas a aportaciones o préstamos de socios'] : []),
    ...(cuentasIntangibles.length > 0 ? ['Facturas y contratos de desarrollo web o aplicaciones informáticas', 'Plan de amortización de activos intangibles'] : []),
    'Modelos 303/390 o 420/425 del ejercicio',
    'Modelo 200 (Impuesto sobre Sociedades) de ejercicios anteriores',
    'Extractos bancarios de todas las cuentas',
    'Conciliación de procesadores de pago (Stripe, Redsys, Paycomet, etc.)',
    'Libro diario y libro mayor del ejercicio',
    'Facturas pendientes de recibir',
    'Escrituras societarias y estatutos vigentes',
  ];

  // ─── AI Report Generation ────────────────────────────────────────────────────
  const generateAIReport = async () => {
    setLoadingAI(true);
    const prompt = `Actúa como socio senior de una firma Big Four española especializado en análisis de estados financieros de sociedades españolas.

Analiza los siguientes datos financieros de la sociedad "${empresa}" para el ejercicio ${ejercicio} y genera un informe ejecutivo premium completo con el tono y criterio de una Big Four / despacho de primer nivel.

DATOS FINANCIEROS EXTRAÍDOS:
- Total Activo: ${fmt(totalActivo)}
- Activo No Corriente: ${fmt(activoNoCorriente)}
- Activo Corriente: ${fmt(activoCorriente)}
- Patrimonio Neto: ${fmt(patrimonioNeto)}
- Pasivo No Corriente: ${fmt(pasivoNoCorriente)}
- Pasivo Corriente: ${fmt(pasivoCorriente)}
- Ingresos (Grupo 7): ${fmt(ingresos)}
- Gastos (Grupo 6): ${fmt(gastos)}
- Resultado estimado: ${fmt(resultado)}
- EBITDA estimado: ${fmt(ebitda)}
- Tesorería (cuentas 57x): ${fmt(tesoreria)}
- Fondo de maniobra: ${fmt(fondoManiobra)}
- Balance cuadra: ${balance.cuadra ? 'SÍ' : `NO — diferencia de ${fmt(balance.diferencia)}`}
- Cuentas intangibles (20x/206): ${cuentasIntangibles.length > 0 ? `SÍ — ${cuentasIntangibles.length} cuenta(s)` : 'No detectadas'}
- Cuentas vinculadas (551/552/553/1635): ${cuentasVinculadas.length > 0 ? `SÍ — ${cuentasVinculadas.length} cuenta(s)` : 'No detectadas'}
- Cuentas fiscales (47x): ${cuentasFiscales.length > 0 ? `SÍ — ${cuentasFiscales.length} cuenta(s)` : 'No detectadas'}
- Fuente documental: ${imp?.origen || 'PDF contable'}
- Confianza media extracción: ${confianza ? `${confianza}%` : 'N/D'}

INSTRUCCIONES DE REDACCIÓN:
1. Tono: profesional, ejecutivo, técnico pero comprensible, prudente, orientado a decisiones.
2. NO inventar cifras ni datos no presentes arriba.
3. Si hay descuadres o inconsistencias, señalarlos claramente.
4. Usar expresiones como "A la vista de la información aportada…", "Con carácter preliminar…", "Se recomienda revisar…".
5. NO usar emojis.
6. Estructura OBLIGATORIA del JSON de respuesta.

Genera la respuesta en JSON con esta estructura exacta:
{
  "diagnostico_ejecutivo": "Párrafo ejecutivo completo de 4-6 frases con diagnóstico general de la situación financiera, solvencia, liquidez, rentabilidad y riesgos principales.",
  "analisis_balance": {
    "activo_no_corriente": "Análisis 2-3 frases del activo no corriente, composición y riesgos.",
    "activo_corriente": "Análisis 2-3 frases del activo corriente, liquidez y aspectos a revisar.",
    "patrimonio_neto": "Análisis 2-3 frases del patrimonio neto, solvencia y posibles riesgos mercantiles.",
    "pasivo_no_corriente": "Análisis 2-3 frases del pasivo no corriente, estructura de deuda y operaciones vinculadas.",
    "pasivo_corriente": "Análisis 2-3 frases del pasivo corriente, tensión de liquidez y saldos a revisar."
  },
  "analisis_pyg": {
    "ingresos": "Análisis 2 frases de la cifra de negocios y calidad de ingresos.",
    "gastos": "Análisis 2 frases de la estructura de costes y gastos relevantes.",
    "resultado": "Análisis 2 frases del resultado, margen y comparativa si procede."
  },
  "analisis_fiscal": "Párrafo 3-4 frases de análisis fiscal preliminar, indicando carácter provisional.",
  "conclusion_final": "Párrafo de cierre ejecutivo de 3-5 frases con recomendación profesional.",
  "alertas_narrativas": [
    { "titulo": "...", "texto": "..." }
  ]
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          diagnostico_ejecutivo: { type: 'string' },
          analisis_balance: { type: 'object', properties: { activo_no_corriente: { type: 'string' }, activo_corriente: { type: 'string' }, patrimonio_neto: { type: 'string' }, pasivo_no_corriente: { type: 'string' }, pasivo_corriente: { type: 'string' } } },
          analisis_pyg: { type: 'object', properties: { ingresos: { type: 'string' }, gastos: { type: 'string' }, resultado: { type: 'string' } } },
          analisis_fiscal: { type: 'string' },
          conclusion_final: { type: 'string' },
          alertas_narrativas: { type: 'array', items: { type: 'object', properties: { titulo: { type: 'string' }, texto: { type: 'string' } } } },
        },
      },
      model: 'claude_sonnet_4_6',
    });

    setAiContent(result);

    // Save to FinancialReport
    if (report?.id) {
      await base44.entities.FinancialReport.update(report.id, {
        contenido: { ...m, narrativa: result },
        resumen_ejecutivo: result.diagnostico_ejecutivo,
        conclusiones: [result.conclusion_final],
      });
    }
    setLoadingAI(false);
  };

  // ─── PDF Export ───────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    setExportingPdf(true);
    await new Promise(r => setTimeout(r, 200));

    // Build print-friendly HTML
    const content = buildPrintHTML();
    const printWindow = window.open('', '_blank');
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setExportingPdf(false);
    }, 800);
  };

  const buildPrintHTML = () => {
    const semColores = { verde: '#059669', ambar: '#d97706', rojo: '#dc2626', gris: '#6b7280' };
    const semLabels = { verde: 'FAVORABLE', ambar: 'REVISAR', rojo: 'ALERTA', gris: 'SIN DATOS' };
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe Financiero Premium — ${empresa} — ${ejercicio}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; background: white; font-size: 10pt; line-height: 1.5; }
  @page { margin: 18mm 15mm; size: A4; }
  @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

  /* Portada */
  .portada { min-height: 95vh; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; border-bottom: 3px solid #1e293b; padding-bottom: 24px; }
  .portada-top { display: flex; justify-content: space-between; align-items: flex-start; padding-top: 8px; }
  .portada-logo img { height: 64px; object-fit: contain; }
  .portada-tagline { font-size: 8pt; color: #94a3b8; text-align: right; margin-top: 4px; letter-spacing: 1px; text-transform: uppercase; }
  .portada-titulo { text-align: center; padding: 40px 0 24px; }
  .portada-titulo h1 { font-size: 22pt; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; margin-bottom: 6px; }
  .portada-titulo h2 { font-size: 13pt; color: #64748b; font-weight: 400; }
  .portada-datos { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px 24px; margin: 0 0 24px; }
  .portada-datos table { width: 100%; border-collapse: collapse; }
  .portada-datos td { padding: 5px 0; font-size: 9.5pt; }
  .portada-datos td:first-child { color: #64748b; width: 160px; }
  .portada-datos td:last-child { font-weight: 600; color: #0f172a; }
  .portada-disclaimer { background: #0f172a; color: #94a3b8; font-size: 7.5pt; padding: 10px 14px; border-radius: 6px; line-height: 1.6; }
  .portada-disclaimer strong { color: white; }
  .portada-footer { text-align: center; color: #94a3b8; font-size: 8pt; margin-top: 20px; }

  /* Contenido */
  h2 { font-size: 13pt; font-weight: 700; color: #0f172a; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; page-break-after: avoid; }
  h3 { font-size: 10.5pt; font-weight: 600; color: #1e293b; margin: 16px 0 8px; }
  p { margin-bottom: 8px; color: #334155; line-height: 1.65; }

  /* KPI Grid */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
  .kpi-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; background: white; }
  .kpi-card .val { font-size: 13pt; font-weight: 700; color: #0f172a; }
  .kpi-card .lbl { font-size: 7.5pt; color: #94a3b8; margin-top: 2px; }
  .kpi-card.positivo .val { color: #059669; }
  .kpi-card.negativo .val { color: #dc2626; }
  .kpi-card.neutro .val { color: #1d4ed8; }

  /* Semáforo */
  .semaforo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
  .sem-card { border-radius: 6px; padding: 10px 12px; border-left: 3px solid; }
  .sem-card .sem-label { font-size: 8.5pt; font-weight: 700; margin-bottom: 4px; }
  .sem-card .sem-text { font-size: 7.5pt; color: #475569; line-height: 1.4; }

  /* Tabla */
  table.data { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 8.5pt; }
  table.data th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; }
  table.data td { padding: 5px 8px; border-bottom: 1px solid #f8fafc; color: #334155; }
  table.data tr:last-child td { border-bottom: none; }
  table.data .mono { font-family: 'Courier New', monospace; text-align: right; }

  /* Alertas */
  .alert { border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; page-break-inside: avoid; }
  .alert-titulo { font-size: 9pt; font-weight: 700; margin-bottom: 4px; }
  .alert-desc { font-size: 8pt; color: #475569; line-height: 1.5; }
  .alert-rec { font-size: 7.5pt; color: #64748b; margin-top: 4px; font-style: italic; }
  .critico { background: #fef2f2; border-left: 3px solid #dc2626; }
  .alta { background: #fef2f2; border-left: 3px solid #f97316; }
  .media { background: #fffbeb; border-left: 3px solid #f59e0b; }
  .baja, .informativo { background: #f0f9ff; border-left: 3px solid #3b82f6; }

  /* Plan */
  .plan-block { border-radius: 6px; padding: 12px 16px; margin-bottom: 10px; page-break-inside: avoid; }
  .plan-badge { display: inline-block; font-size: 7pt; font-weight: 700; padding: 2px 8px; border-radius: 10px; margin-bottom: 6px; letter-spacing: 0.5px; text-transform: uppercase; }
  .plan-items { list-style: none; }
  .plan-items li { font-size: 8.5pt; color: #334155; padding: 2px 0; display: flex; gap: 6px; }
  .plan-items li::before { content: "→"; color: #94a3b8; flex-shrink: 0; }

  /* Ratio table */
  .ratio-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 10px 0; }
  .ratio-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; }
  .ratio-card .rv { font-size: 12pt; font-weight: 700; }
  .ratio-card .rn { font-size: 8pt; font-weight: 600; color: #1e293b; }
  .ratio-card .rf { font-size: 7pt; color: #94a3b8; }
  .ratio-card.ok .rv { color: #059669; }
  .ratio-card.ko .rv { color: #d97706; }

  /* Footer línea */
  .page-footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; }
  .frase-cierre { background: #0f172a; color: #94a3b8; border-radius: 8px; padding: 14px 18px; margin-top: 24px; font-size: 8pt; line-height: 1.65; }
  .frase-cierre strong { color: white; }

  .section-page-break { page-break-before: always; }
  .avoid-break { page-break-inside: avoid; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
</style>
</head>
<body>

<!-- ═══════════════ PORTADA ════════════════ -->
<div class="portada">
  <div class="portada-top">
    <div class="portada-logo">
      <img src="${TAXEA_LOGO_URL}" alt="Taxea Strategies" />
    </div>
    <div class="portada-tagline">
      Análisis Financiero Premium<br/>Confidencial
    </div>
  </div>

  <div class="portada-titulo">
    <h1>INFORME FINANCIERO PREMIUM</h1>
    <h2>Taxea Strategies · Análisis Integral de Estados Financieros</h2>
  </div>

  <div class="portada-datos">
    <table>
      <tr><td>Sociedad analizada:</td><td>${empresa}</td></tr>
      <tr><td>Período analizado:</td><td>${imp?.periodo_inicio || ejercicio + '-01-01'} — ${imp?.periodo_fin || ejercicio + '-12-31'}</td></tr>
      <tr><td>Fuente documental:</td><td>${imp?.origen || 'Documentación contable aportada'} · ${imp?.nombre_archivo || '—'}</td></tr>
      <tr><td>Fecha de generación:</td><td>${today()}</td></tr>
      <tr><td>Nivel de revisión:</td><td>Preliminar — pendiente de validación contable definitiva</td></tr>
      <tr><td>Confianza extracción IA:</td><td>${confianza ? `${confianza}%` : 'N/D'}</td></tr>
      <tr><td>Motor análisis:</td><td>Taxea IA V4 — Big Four Grade</td></tr>
    </table>
  </div>

  <div class="portada-disclaimer">
    <strong>Aviso de alcance:</strong> El presente informe ha sido elaborado por Taxea Strategies con base en la documentación facilitada y tiene carácter preliminar. Las conclusiones deberán contrastarse con la documentación soporte, modelos fiscales presentados y libros contables. No constituye auditoría, certificación contable ni asesoramiento jurídico definitivo.
  </div>

  <div class="portada-footer">
    © ${new Date().getFullYear()} Taxea Strategies · Todos los derechos reservados · Documento confidencial
  </div>
</div>

<!-- ═══════════════ 1. RESUMEN EJECUTIVO ════════════════ -->
<div class="section-page-break">
<h2>1. Resumen ejecutivo</h2>

<h3>1.1. Foto financiera rápida</h3>
<div class="kpi-grid">
  <div class="kpi-card neutro"><div class="val">${fmt(totalActivo)}</div><div class="lbl">Total Activo</div></div>
  <div class="kpi-card ${patrimonioNeto >= 0 ? 'positivo' : 'negativo'}"><div class="val">${fmt(patrimonioNeto)}</div><div class="lbl">Patrimonio Neto</div></div>
  <div class="kpi-card ${fondoManiobra >= 0 ? 'positivo' : 'negativo'}"><div class="val">${fmt(fondoManiobra)}</div><div class="lbl">Fondo de Maniobra</div></div>
  <div class="kpi-card positivo"><div class="val">${fmt(ingresos)}</div><div class="lbl">Cifra de Negocios</div></div>
  <div class="kpi-card ${resultado >= 0 ? 'positivo' : 'negativo'}"><div class="val">${fmt(resultado)}</div><div class="lbl">Resultado del Ejercicio</div></div>
  <div class="kpi-card neutro"><div class="val">${fmt(ebitda)}</div><div class="lbl">EBITDA Estimado</div></div>
  <div class="kpi-card neutro"><div class="val">${fmt(tesoreria)}</div><div class="lbl">Tesorería (Cuentas 57x)</div></div>
  <div class="kpi-card neutro"><div class="val">${fmt(activoCorriente)}</div><div class="lbl">Activo Corriente</div></div>
  <div class="kpi-card neutro"><div class="val">${fmt(pasivoCorriente)}</div><div class="lbl">Pasivo Corriente</div></div>
</div>

<h3>1.2. Diagnóstico ejecutivo</h3>
<p>${aiContent?.diagnostico_ejecutivo || `A la vista de la información aportada, ${empresa} presenta un total activo de ${fmt(totalActivo)} para el ejercicio ${ejercicio}, con un patrimonio neto de ${fmt(patrimonioNeto)} y un resultado estimado de ${fmt(resultado)}. ${!balance.cuadra ? 'Se identifica una diferencia de cuadre en el balance que requiere revisión prioritaria antes de considerar definitivos los estados financieros. ' : ''}${fondoManiobra < 0 ? 'El fondo de maniobra negativo advierte de una posible tensión de liquidez a corto plazo. ' : 'La posición de liquidez es aparentemente favorable con un fondo de maniobra positivo. '}Con carácter preliminar y pendiente de contraste documental, la situación financiera requiere la atención de los aspectos señalados en el presente informe.`}</p>

<h3>1.3. Semáforo financiero Taxea Strategies</h3>
<div class="semaforo-grid">
  ${semaforos.map(s => `
  <div class="sem-card" style="border-color:${semColores[s.estado]||'#6b7280'};background:${s.estado==='verde'?'#f0fdf4':s.estado==='ambar'?'#fffbeb':s.estado==='rojo'?'#fef2f2':'#f8fafc'}">
    <div class="sem-label" style="color:${semColores[s.estado]||'#6b7280'}">● ${s.label} · ${semLabels[s.estado]||'—'}</div>
    <div class="sem-text">${s.comentario}</div>
  </div>`).join('')}
</div>
</div>

<!-- ═══════════════ 2. BALANCE ════════════════ -->
<div class="section-page-break">
<h2>2. Análisis del balance de situación</h2>

<table class="data avoid-break">
  <tr><th>Masa patrimonial</th><th style="text-align:right">Importe</th><th style="text-align:right">% s/Activo</th></tr>
  <tr><td><strong>ACTIVO NO CORRIENTE</strong></td><td class="mono">${fmt(activoNoCorriente)}</td><td class="mono">${totalActivo > 0 ? pct(activoNoCorriente/totalActivo*100) : '—'}</td></tr>
  <tr><td><strong>ACTIVO CORRIENTE</strong></td><td class="mono">${fmt(activoCorriente)}</td><td class="mono">${totalActivo > 0 ? pct(activoCorriente/totalActivo*100) : '—'}</td></tr>
  <tr style="background:#f1f5f9"><td><strong>TOTAL ACTIVO</strong></td><td class="mono"><strong>${fmt(totalActivo)}</strong></td><td class="mono"><strong>100%</strong></td></tr>
  <tr><td><strong>PATRIMONIO NETO</strong></td><td class="mono">${fmt(patrimonioNeto)}</td><td class="mono">${totalActivo > 0 ? pct(patrimonioNeto/totalActivo*100) : '—'}</td></tr>
  <tr><td><strong>PASIVO NO CORRIENTE</strong></td><td class="mono">${fmt(pasivoNoCorriente)}</td><td class="mono">${totalActivo > 0 ? pct(pasivoNoCorriente/totalActivo*100) : '—'}</td></tr>
  <tr><td><strong>PASIVO CORRIENTE</strong></td><td class="mono">${fmt(pasivoCorriente)}</td><td class="mono">${totalActivo > 0 ? pct(pasivoCorriente/totalActivo*100) : '—'}</td></tr>
  <tr style="background:${balance.cuadra?'#f0fdf4':'#fef2f2'}"><td><strong>TOTAL PN + PASIVO</strong></td><td class="mono"><strong>${fmt(patrimonioNeto + totalPasivo)}</strong></td><td class="mono">${balance.cuadra ? '<span style="color:#059669">✓ CUADRA</span>' : `<span style="color:#dc2626">⚠ Δ ${fmt(balance.diferencia)}</span>`}</td></tr>
</table>

${aiContent?.analisis_balance ? `
<h3>2.1. Activo no corriente</h3><p>${aiContent.analisis_balance.activo_no_corriente}</p>
<h3>2.2. Activo corriente</h3><p>${aiContent.analisis_balance.activo_corriente}</p>
<h3>2.3. Patrimonio neto</h3><p>${aiContent.analisis_balance.patrimonio_neto}</p>
<h3>2.4. Pasivo no corriente</h3><p>${aiContent.analisis_balance.pasivo_no_corriente}</p>
<h3>2.5. Pasivo corriente</h3><p>${aiContent.analisis_balance.pasivo_corriente}</p>
` : `<p>Con carácter preliminar, a la vista de la información extraída, el balance de situación refleja una estructura patrimonial con total activo de ${fmt(totalActivo)}, de los cuales ${fmt(activoNoCorriente)} corresponden a activo no corriente y ${fmt(activoCorriente)} a activo corriente. El patrimonio neto asciende a ${fmt(patrimonioNeto)}, representando el ${totalActivo > 0 ? pct(patrimonioNeto/totalActivo*100) : '—'} del activo total.</p>`}

${cuentas.filter(a => !a.excluida && ['activo_no_corriente','activo_corriente','patrimonio_neto','pasivo_no_corriente','pasivo_corriente'].includes(a.masa)).length > 0 ? `
<h3>Detalle de cuentas de balance extraídas</h3>
<table class="data">
  <tr><th>Cuenta</th><th>Descripción</th><th>Masa</th><th style="text-align:right">Importe</th></tr>
  ${cuentas.filter(a => !a.excluida && ['activo_no_corriente','activo_corriente','patrimonio_neto','pasivo_no_corriente','pasivo_corriente'].includes(a.masa))
    .map(a => `<tr><td style="font-family:monospace">${a.cuenta||'—'}</td><td>${a.descripcion||'—'}</td><td>${a.masa?.replace(/_/g,' ')||'—'}</td><td class="mono">${fmtDec(a.importe_actual)}</td></tr>`).join('')}
</table>` : ''}
</div>

<!-- ═══════════════ 3. PyG ════════════════ -->
<div class="section-page-break">
<h2>3. Análisis de la cuenta de pérdidas y ganancias</h2>

<table class="data avoid-break">
  <tr><th>Concepto</th><th style="text-align:right">Importe</th><th style="text-align:right">% s/Ingresos</th></tr>
  <tr><td>Ingresos — Cifra de negocios (Grupo 7)</td><td class="mono" style="color:#059669"><strong>${fmt(ingresos)}</strong></td><td class="mono">100%</td></tr>
  <tr><td>Gastos de explotación (Grupo 6)</td><td class="mono" style="color:#dc2626">${fmt(gastos)}</td><td class="mono">${ingresos > 0 ? pct(gastos/ingresos*100) : '—'}</td></tr>
  <tr style="background:#f1f5f9"><td><strong>Resultado estimado del ejercicio</strong></td><td class="mono"><strong style="color:${resultado>=0?'#059669':'#dc2626'}">${fmt(resultado)}</strong></td><td class="mono"><strong>${ingresos > 0 ? pct(resultado/ingresos*100) : '—'}</strong></td></tr>
  <tr><td>Amortizaciones estimadas (Grupo 68x)</td><td class="mono">${fmt(pyg.amortizacion || 0)}</td><td class="mono">—</td></tr>
  <tr><td><strong>EBITDA estimado</strong></td><td class="mono"><strong>${fmt(ebitda)}</strong></td><td class="mono">${ingresos > 0 ? pct(ebitda/ingresos*100) : '—'}</td></tr>
</table>

${aiContent?.analisis_pyg ? `
<h3>3.1. Ingresos</h3><p>${aiContent.analisis_pyg.ingresos}</p>
<h3>3.2. Gastos</h3><p>${aiContent.analisis_pyg.gastos}</p>
<h3>3.3. Resultado</h3><p>${aiContent.analisis_pyg.resultado}</p>
` : `<p>Los ingresos del ejercicio ascienden a ${fmt(ingresos)}, con unos gastos de explotación de ${fmt(gastos)}, resultando un resultado estimado de ${fmt(resultado)}, equivalente a un margen neto del ${ingresos > 0 ? pct(resultado/ingresos*100) : '—'}. El análisis detallado requiere contrastar las partidas con el libro diario y el mayor contable.</p>`}

${cuentas.filter(a => !a.excluida && ['pyg_ingreso','pyg_gasto'].includes(a.masa)).length > 0 ? `
<h3>Detalle de cuentas PyG extraídas</h3>
<table class="data">
  <tr><th>Cuenta</th><th>Descripción</th><th>Tipo</th><th style="text-align:right">Importe</th></tr>
  ${cuentas.filter(a => !a.excluida && ['pyg_ingreso','pyg_gasto'].includes(a.masa))
    .map(a => `<tr><td style="font-family:monospace">${a.cuenta||'—'}</td><td>${a.descripcion||'—'}</td><td style="color:${a.masa==='pyg_ingreso'?'#059669':'#dc2626'}">${a.masa==='pyg_ingreso'?'Ingreso':'Gasto'}</td><td class="mono">${fmtDec(a.importe_actual)}</td></tr>`).join('')}
</table>` : ''}
</div>

<!-- ═══════════════ 4. RATIOS ════════════════ -->
<div class="section-page-break">
<h2>4. Ratios financieros automáticos</h2>
<p style="font-size:8pt;color:#64748b;margin-bottom:12px">Calculados exclusivamente sobre cuentas extraídas del documento. Con carácter orientativo. Pendiente de contraste con información contable definitiva.</p>

<div class="ratio-grid">
  ${ratios.map(r => `
  <div class="ratio-card ${r.ok ? 'ok' : 'ko'} avoid-break">
    <div class="rv">${r.valor}</div>
    <div class="rn">${r.nombre}</div>
    <div class="rf">${r.formula} · Ref: ${r.ref}</div>
    <div style="font-size:7pt;color:#64748b;margin-top:3px">${r.interpretacion}</div>
  </div>`).join('')}
</div>
</div>

<!-- ═══════════════ 5. ALERTAS ════════════════ -->
<div class="section-page-break">
<h2>5. Alertas detectadas</h2>
${alertasEnriquecidas.length === 0 ? '<p>No se han detectado alertas relevantes en los datos analizados.</p>' :
  alertasEnriquecidas.map(a => `
  <div class="alert ${a.nivel || 'informativo'} avoid-break">
    <div class="alert-titulo">${a.titulo || ''}</div>
    <div class="alert-desc">${a.desc || ''}</div>
    ${a.recomendacion ? `<div class="alert-rec">Recomendación: ${a.recomendacion}</div>` : ''}
    ${a.area ? `<div style="font-size:7pt;color:#94a3b8;margin-top:4px">Área: ${a.area}</div>` : ''}
  </div>`).join('')}

${aiContent?.alertas_narrativas?.length > 0 ? `
<h3 style="margin-top:16px">Análisis narrativo de riesgos</h3>
${aiContent.alertas_narrativas.map(a => `<div class="alert baja avoid-break"><div class="alert-titulo">${a.titulo}</div><div class="alert-desc">${a.texto}</div></div>`).join('')}` : ''}
</div>

<!-- ═══════════════ 6. FISCALIDAD ════════════════ -->
<div class="section-page-break">
<h2>6. Análisis fiscal preliminar</h2>

<div class="alert baja avoid-break" style="margin-bottom:12px">
  <div class="alert-titulo">Alcance del análisis fiscal</div>
  <div class="alert-desc">El presente análisis fiscal tiene carácter exclusivamente preliminar y se basa en la información contable aportada. Para emitir una conclusión fiscal definitiva es necesario contrastar la contabilidad con los modelos tributarios presentados, declaraciones del Impuesto sobre Sociedades, libros registro, facturas soporte y documentación mercantil correspondiente.</div>
</div>

${aiContent?.analisis_fiscal ? `<p>${aiContent.analisis_fiscal}</p>` : `
<p>A la vista de la información contable extraída, se identifican las siguientes cuentas fiscales relevantes: ${cuentasFiscales.length > 0 ? `${cuentasFiscales.length} cuenta(s) del grupo 47x (IVA, retenciones, hacienda pública)` : 'no se dispone de información fiscal suficiente'}. ${cuentasVinculadas.length > 0 ? 'Adicionalmente, la existencia de saldos con socios o partes vinculadas exige un análisis de operaciones vinculadas desde la perspectiva del artículo 18 de la LIS.' : ''} Se recomienda aportar los modelos fiscales del ejercicio para completar el análisis.</p>`}

<h3>Documentación fiscal adicional recomendada</h3>
<ul style="list-style:none;margin:8px 0">
  ${docRecomendada.map(d => `<li style="font-size:8.5pt;padding:2px 0;color:#334155">→ ${d}</li>`).join('')}
</ul>
</div>

<!-- ═══════════════ 7. PLAN DE ACTUACIÓN ════════════════ -->
<div class="section-page-break">
<h2>7. Plan de actuación recomendado</h2>

${planActuacion.map(p => `
<div class="plan-block avoid-break" style="background:${p.color.includes('red')?'#fef2f2':p.color.includes('amber')?'#fffbeb':p.color.includes('blue')?'#eff6ff':'#f0fdf4'};border:1px solid ${p.color.includes('red')?'#fca5a5':p.color.includes('amber')?'#fcd34d':p.color.includes('blue')?'#93c5fd':'#86efac'}">
  <span class="plan-badge" style="background:${p.color.includes('red')?'#dc2626':p.color.includes('amber')?'#d97706':p.color.includes('blue')?'#2563eb':'#16a34a'};color:white">Prioridad ${p.prioridad} — ${p.label}</span>
  <ul class="plan-items">
    ${p.items.map(i => `<li>${i}</li>`).join('')}
  </ul>
</div>`).join('')}

<h3 style="margin-top:20px">Conclusión profesional</h3>
<p>${aiContent?.conclusion_final || `A la vista de la información aportada, ${empresa} presenta una estructura financiera que requiere atención en los aspectos señalados en el presente informe, con especial énfasis en la conciliación del balance${!balance.cuadra ? ', dado el descuadre detectado' : ''}, la revisión de los saldos con partes vinculadas${cuentasVinculadas.length > 0 ? ' identificados' : ''} y el contraste fiscal con los modelos tributarios correspondientes. Se recomienda proceder a las actuaciones descritas en el plan de acción antes de considerar definitivo el cierre contable del ejercicio ${ejercicio}.`}</p>
</div>

<!-- ═══════════════ CIERRE ════════════════ -->
<div class="frase-cierre">
  <strong>El presente informe ha sido elaborado por Taxea Strategies</strong> con base en la documentación facilitada y tiene por objeto ofrecer una visión financiera, contable y fiscal preliminar de la sociedad analizada. Las conclusiones deberán ser contrastadas con la documentación soporte, modelos fiscales presentados, libros contables y, en su caso, documentación mercantil y contractual correspondiente. Taxea Strategies no asume responsabilidad por decisiones adoptadas exclusivamente sobre la base de este informe sin el contraste documental adecuado.
</div>

<div class="page-footer">
  <span>Taxea Strategies · Informe Financiero Premium · ${empresa} · Ejercicio ${ejercicio}</span>
  <span>Generado el ${today()} · Motor Taxea IA V4</span>
</div>

</body>
</html>`;
  };

  // ─── UI ───────────────────────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Volver al dashboard
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-800" />
              <h2 className="text-lg font-jakarta font-bold">Informe Financiero Premium</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white">Taxea Strategies</span>
            </div>
            <p className="text-xs text-slate-400">{empresa} · Ejercicio {ejercicio}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generateAIReport} disabled={loadingAI}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            {loadingAI ? <Loader2 className="w-4 h-4 animate-spin text-violet-600" /> : <Sparkles className="w-4 h-4 text-violet-600" />}
            {aiContent ? 'Regenerar análisis IA' : 'Generar análisis IA'}
          </button>
          <button onClick={exportPDF} disabled={exportingPdf}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm disabled:opacity-40">
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar PDF
          </button>
        </div>
      </div>

      {/* AI loading banner */}
      {loadingAI && (
        <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 text-violet-600 animate-spin flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-violet-800">Generando análisis Big Four con IA avanzada...</p>
            <p className="text-[10px] text-violet-600">Analizando balance, PyG, ratios y riesgos · Modelo claude_sonnet · ~20-30s</p>
          </div>
        </div>
      )}

      {/* AI ready banner */}
      {aiContent && !loadingAI && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="text-xs text-emerald-700 font-medium">Análisis narrativo IA generado e integrado en el informe PDF.</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300">
          <strong className="text-white">Informe preliminar basado exclusivamente en datos extraídos del documento aportado.</strong>{' '}
          Confianza media IA: <span className="text-blue-300">{confianza ? `${confianza}%` : '—'}</span>.
          No constituye auditoría ni certificación contable. Pendiente validación profesional.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-100">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            className={cn('px-3 py-2 text-xs font-medium transition-all whitespace-nowrap rounded-t-lg',
              tab === i ? 'bg-white border border-b-white border-slate-200 text-foreground font-semibold -mb-px' : 'text-slate-400 hover:text-slate-600')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 0: Resumen ─── */}
      {tab === 0 && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total activo', v: fmt(totalActivo), color: 'text-slate-800' },
              { label: 'Patrimonio neto', v: fmt(patrimonioNeto), color: patrimonioNeto >= 0 ? 'text-emerald-700' : 'text-red-600' },
              { label: 'Fondo de maniobra', v: fmt(fondoManiobra), color: fondoManiobra >= 0 ? 'text-emerald-700' : 'text-red-600' },
              { label: 'Ingresos', v: fmt(ingresos), color: 'text-emerald-700' },
              { label: 'Resultado', v: fmt(resultado), color: resultado >= 0 ? 'text-emerald-700' : 'text-red-600' },
              { label: 'EBITDA est.', v: fmt(ebitda), color: 'text-blue-700' },
              { label: 'Tesorería', v: fmt(tesoreria), color: 'text-slate-700' },
              { label: 'Pasivo C', v: fmt(pasivoCorriente), color: 'text-slate-700' },
              { label: 'Margen neto', v: ingresos > 0 ? pct(resultado/ingresos*100) : '—', color: resultado >= 0 ? 'text-blue-600' : 'text-red-600' },
            ].map((k, i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm">
                <p className={cn('text-base font-jakarta font-bold', k.color)}>{k.v}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Semáforo */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
            <p className="text-sm font-bold text-foreground mb-3">Semáforo financiero Taxea Strategies</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {semaforos.map((s, i) => <Semaforo key={i} {...s} />)}
            </div>
          </div>

          {/* Diagnóstico IA */}
          {aiContent?.diagnostico_ejecutivo && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-violet-600" />
                <p className="text-sm font-bold text-foreground">Diagnóstico ejecutivo · Taxea IA</p>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{aiContent.diagnostico_ejecutivo}</p>
            </div>
          )}

          {!aiContent && (
            <div className="bg-violet-50 border border-violet-200 border-dashed rounded-2xl p-8 text-center">
              <Sparkles className="w-8 h-8 text-violet-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-violet-800 mb-1">Análisis narrativo Big Four no generado</p>
              <p className="text-xs text-violet-600 mb-4">Genera el análisis narrativo con IA avanzada para obtener diagnóstico ejecutivo, análisis por secciones y conclusiones profesionales.</p>
              <button onClick={generateAIReport} disabled={loadingAI}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold shadow-sm">
                <Sparkles className="w-4 h-4" /> Generar análisis IA Big Four
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 1: Balance ─── */}
      {tab === 1 && (
        <div className="space-y-4">
          <Section title="Balance de situación reconstruido" subtitle="Cifras extraídas del documento. Pendiente contraste con mayor contable.">
            <KpiRow label="Total Activo" value={fmt(totalActivo)} color="text-blue-700" />
            <KpiRow label="Activo No Corriente" value={fmt(activoNoCorriente)} indent note={totalActivo > 0 ? `${pct(activoNoCorriente/totalActivo*100)} del activo` : ''} />
            <KpiRow label="Activo Corriente" value={fmt(activoCorriente)} indent note={totalActivo > 0 ? `${pct(activoCorriente/totalActivo*100)} del activo` : ''} />
            <div className="h-px bg-slate-100 my-1" />
            <KpiRow label="Total PN + Pasivo" value={fmt(patrimonioNeto + totalPasivo)} color={balance.cuadra ? 'text-emerald-700' : 'text-red-600'} note={balance.cuadra ? '✓ Cuadra con activo' : `⚠ Diferencia: ${fmt(balance.diferencia)}`} />
            <KpiRow label="Patrimonio Neto" value={fmt(patrimonioNeto)} color={patrimonioNeto >= 0 ? 'text-emerald-700' : 'text-red-600'} indent />
            <KpiRow label="Pasivo No Corriente" value={fmt(pasivoNoCorriente)} indent />
            <KpiRow label="Pasivo Corriente" value={fmt(pasivoCorriente)} indent />
            <div className="h-px bg-slate-100 my-1" />
            <KpiRow label="Fondo de maniobra" value={fmt(fondoManiobra)} color={fondoManiobra >= 0 ? 'text-emerald-600' : 'text-red-600'} note="Activo C − Pasivo C" />
          </Section>
          {aiContent?.analisis_balance && (
            <Section title="Análisis narrativo del balance · Taxea IA">
              {Object.entries({ 'Activo no corriente': aiContent.analisis_balance.activo_no_corriente, 'Activo corriente': aiContent.analisis_balance.activo_corriente, 'Patrimonio neto': aiContent.analisis_balance.patrimonio_neto, 'Pasivo no corriente': aiContent.analisis_balance.pasivo_no_corriente, 'Pasivo corriente': aiContent.analisis_balance.pasivo_corriente }).map(([k, v]) => v && (
                <div key={k}><p className="text-xs font-bold text-slate-700 mb-1">{k}</p><p className="text-xs text-slate-600 leading-relaxed mb-3">{v}</p></div>
              ))}
            </Section>
          )}
          {cuentas.filter(a => !a.excluida && ['activo_no_corriente','activo_corriente','patrimonio_neto','pasivo_no_corriente','pasivo_corriente'].includes(a.masa)).length > 0 && (
            <Section title="Cuentas de balance extraídas">
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead><tr className="border-b border-slate-100">{['Cuenta','Descripción','Masa','Importe','Conf.'].map(h => <th key={h} className="py-2 px-3 text-left font-semibold text-slate-500">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {cuentas.filter(a => !a.excluida && ['activo_no_corriente','activo_corriente','patrimonio_neto','pasivo_no_corriente','pasivo_corriente'].includes(a.masa)).map((a, i) => {
                      const ml = { activo_no_corriente:'Activo NC', activo_corriente:'Activo C', patrimonio_neto:'PN', pasivo_no_corriente:'Pasivo NC', pasivo_corriente:'Pasivo C' };
                      const mc = { activo_no_corriente:'bg-blue-50 text-blue-700', activo_corriente:'bg-cyan-50 text-cyan-700', patrimonio_neto:'bg-emerald-50 text-emerald-700', pasivo_no_corriente:'bg-amber-50 text-amber-700', pasivo_corriente:'bg-orange-50 text-orange-700' };
                      return <tr key={i} className="hover:bg-slate-50"><td className="py-2 px-3 font-mono font-semibold">{a.cuenta||'—'}</td><td className="py-2 px-3 text-slate-600 max-w-48 truncate">{a.descripcion}</td><td className="py-2 px-3"><span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', mc[a.masa]||'bg-slate-100 text-slate-500')}>{ml[a.masa]||a.masa}</span></td><td className="py-2 px-3 font-mono text-right">{fmtDec(a.importe_actual)}</td><td className="py-2 px-3"><span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', a.confianza>=85?'bg-emerald-50 text-emerald-700':a.confianza>=70?'bg-amber-50 text-amber-700':'bg-red-50 text-red-600')}>{a.confianza}%</span></td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ─── TAB 2: PyG ─── */}
      {tab === 2 && (
        <div className="space-y-4">
          <Section title="Cuenta de pérdidas y ganancias reconstruida">
            <KpiRow label="Ingresos — Cifra de negocios (Grupo 7)" value={fmt(ingresos)} color="text-emerald-700" />
            <KpiRow label="Gastos de explotación (Grupo 6)" value={fmt(gastos)} color="text-slate-600" />
            <KpiRow label="Resultado estimado" value={fmt(resultado)} color={resultado >= 0 ? 'text-emerald-600' : 'text-red-600'} />
            <KpiRow label="Margen neto estimado" value={ingresos > 0 ? pct(resultado/ingresos*100) : '—'} color={resultado >= 0 ? 'text-blue-600' : 'text-red-600'} note="Resultado / Ingresos × 100" />
            <KpiRow label="Amortizaciones (68x)" value={fmt(pyg.amortizacion || 0)} />
            <KpiRow label="EBITDA estimado" value={fmt(ebitda)} color="text-blue-700" note="Resultado + Amortizaciones" />
          </Section>
          {aiContent?.analisis_pyg && (
            <Section title="Análisis narrativo PyG · Taxea IA">
              {Object.entries({ 'Ingresos': aiContent.analisis_pyg.ingresos, 'Gastos': aiContent.analisis_pyg.gastos, 'Resultado': aiContent.analisis_pyg.resultado }).map(([k, v]) => v && (
                <div key={k}><p className="text-xs font-bold text-slate-700 mb-1">{k}</p><p className="text-xs text-slate-600 leading-relaxed mb-3">{v}</p></div>
              ))}
            </Section>
          )}
          {cuentas.filter(a => !a.excluida && ['pyg_ingreso','pyg_gasto'].includes(a.masa)).length > 0 && (
            <Section title="Cuentas PyG extraídas">
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead><tr className="border-b border-slate-100">{['Cuenta','Descripción','Tipo','Importe','Conf.'].map(h => <th key={h} className="py-2 px-3 text-left font-semibold text-slate-500">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {cuentas.filter(a => !a.excluida && ['pyg_ingreso','pyg_gasto'].includes(a.masa)).map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-semibold">{a.cuenta||'—'}</td>
                        <td className="py-2 px-3 text-slate-600 max-w-48 truncate">{a.descripcion}</td>
                        <td className="py-2 px-3"><span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', a.masa==='pyg_ingreso'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700')}>{a.masa==='pyg_ingreso'?'Ingreso':'Gasto'}</span></td>
                        <td className="py-2 px-3 font-mono text-right">{fmtDec(a.importe_actual)}</td>
                        <td className="py-2 px-3"><span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', a.confianza>=85?'bg-emerald-50 text-emerald-700':a.confianza>=70?'bg-amber-50 text-amber-700':'bg-red-50 text-red-600')}>{a.confianza}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ─── TAB 3: Ratios ─── */}
      {tab === 3 && (
        <Section title="Ratios financieros automáticos" subtitle="Calculados sobre cuentas extraídas. Carácter orientativo. Contrastar con datos definitivos.">
          {['Liquidez','Endeudamiento','Rentabilidad'].map(grupo => (
            <div key={grupo}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{grupo}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {ratios.filter(r => r.grupo === grupo).map((r, i) => (
                  <div key={i} className={cn('border rounded-xl p-4', r.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100')}>
                    <p className={cn('text-xl font-jakarta font-bold', r.ok ? 'text-emerald-700' : 'text-amber-700')}>{r.valor}</p>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">{r.nombre}</p>
                    <p className="text-[10px] text-slate-400">{r.formula}</p>
                    <p className="text-[10px] text-slate-500 mt-1 italic">{r.interpretacion}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Ref: {r.ref}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* ─── TAB 4: Alertas ─── */}
      {tab === 4 && (
        <Section title="Alertas detectadas" subtitle="Clasificadas por severidad y área funcional.">
          {alertasEnriquecidas.length === 0 ? (
            <div className="text-center py-6"><CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" /><p className="text-sm text-slate-500">Sin alertas registradas</p></div>
          ) : (
            <div className="space-y-2">
              {alertasEnriquecidas.map((a, i) => <AlertCard key={i} {...a} />)}
              {aiContent?.alertas_narrativas?.map((a, i) => (
                <div key={`ai-${i}`} className="border border-violet-200 bg-violet-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-1"><Sparkles className="w-3 h-3 text-violet-500" /><p className="text-xs font-bold text-violet-800">{a.titulo}</p></div>
                  <p className="text-xs text-slate-600 leading-relaxed">{a.texto}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ─── TAB 5: Fiscalidad ─── */}
      {tab === 5 && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">Análisis fiscal de carácter <strong>exclusivamente preliminar</strong>. Basado únicamente en la información contable aportada. Para conclusiones definitivas es necesario contrastar con modelos fiscales, declaraciones y documentación soporte.</p>
          </div>
          {aiContent?.analisis_fiscal && (
            <Section title="Análisis fiscal · Taxea IA">
              <p className="text-sm text-slate-600 leading-relaxed">{aiContent.analisis_fiscal}</p>
            </Section>
          )}
          {cuentasFiscales.length > 0 && (
            <Section title="Cuentas fiscales identificadas (Grupo 47x)">
              <div className="space-y-1">
                {cuentasFiscales.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <div><p className="text-xs font-mono font-semibold text-slate-700">{a.cuenta}</p><p className="text-[10px] text-slate-500">{a.descripcion}</p></div>
                    <p className="text-xs font-bold text-slate-700">{fmtDec(a.importe_actual)}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
          <Section title="Documentación fiscal adicional recomendada">
            <ul className="space-y-1.5">
              {docRecomendada.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600"><ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />{d}</li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {/* ─── TAB 6: Plan de acción ─── */}
      {tab === 6 && (
        <div className="space-y-4">
          {planActuacion.map(p => (
            <div key={p.prioridad} className={cn('border rounded-2xl p-5', p.color)}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn('text-[10px] font-bold px-3 py-1 rounded-full', p.labelColor)}>
                  Prioridad {p.prioridad} — {p.label}
                </span>
              </div>
              <ul className="space-y-1.5">
                {p.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {aiContent?.conclusion_final && (
            <Section title="Conclusión profesional · Taxea IA">
              <p className="text-sm text-slate-600 leading-relaxed">{aiContent.conclusion_final}</p>
            </Section>
          )}
          <div className="bg-slate-900 rounded-2xl px-5 py-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-white">El presente informe ha sido elaborado por Taxea Strategies</strong> con base en la documentación facilitada y tiene por objeto ofrecer una visión financiera, contable y fiscal preliminar de la sociedad analizada. Las conclusiones deberán ser contrastadas con la documentación soporte, modelos fiscales presentados, libros contables y, en su caso, documentación mercantil y contractual correspondiente.
            </p>
          </div>
        </div>
      )}

      {/* ─── TAB 7: Trazabilidad ─── */}
      {tab === 7 && (
        <div className="space-y-4">
          <Section title="Origen y trazabilidad">
            <KpiRow label="Archivo" value={imp?.nombre_archivo || '—'} />
            <KpiRow label="Origen" value={imp?.origen || '—'} />
            <KpiRow label="Empresa" value={empresa} />
            <KpiRow label="Período" value={`${imp?.periodo_inicio||'—'} → ${imp?.periodo_fin||'—'}`} />
            <KpiRow label="Total cuentas" value={cuentas.length} />
            <KpiRow label="Confianza media" value={confianza ? `${confianza}%` : '—'} color={confianza>=85?'text-emerald-600':confianza>=70?'text-amber-600':'text-red-600'} />
            <KpiRow label="Motor" value="Taxea IA V4 — Análisis cuenta a cuenta" />
            <KpiRow label="Correcciones manuales" value={cuentas.filter(a => a.estado==='corregida').length} />
            <KpiRow label="Análisis IA narrativo" value={aiContent ? 'Generado' : 'No generado'} color={aiContent ? 'text-emerald-600' : 'text-slate-400'} />
          </Section>
          {supuestos.length > 0 && (
            <Section title="Supuestos y método">
              <ul className="space-y-1">
                {supuestos.map((s, i) => <li key={i} className="flex items-start gap-2 text-xs text-slate-600"><CheckCircle2 className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />{s}</li>)}
              </ul>
            </Section>
          )}
        </div>
      )}
    </motion.div>
  );
}
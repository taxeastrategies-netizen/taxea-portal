/**
 * PremiumReportViewerV5 — Visor integrado multipágina
 * Informe visible dentro de la app, scroll vertical, índice lateral, exportar PDF
 * Principio: no sale de la app, no abre pantalla completa
 */
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import {
  ChevronLeft, Download, Settings2, Sparkles, Loader2,
  CheckCircle2, RefreshCw, Eye, List, X
} from 'lucide-react';

import { calcularMetricas, generarAlertas, generarRecomendaciones, SOURCE } from './ReportEngine';
import {
  PagePortada, PageResumen, PageAlcance, PageBalance, PagePyG,
  PageLiquidez, PageEndeudamiento, PageRentabilidad, PageCashflow,
  PageMA, PageCalidadContable, PageFiscalidad, PageAlertas, PagePlan
} from './ReportPages';
import ReportSupuestos from './ReportSupuestos';
import { buildPDFHTML } from './ReportPDFExport';

const TODAY = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

const SECTIONS = [
  { id: 'page-portada',    label: '01 Portada', n: '01' },
  { id: 'page-resumen',    label: '02 Resumen ejecutivo', n: '02' },
  { id: 'page-alcance',    label: '03 Alcance y limitaciones', n: '03' },
  { id: 'page-balance',    label: '04 Balance', n: '04' },
  { id: 'page-pyg',        label: '05 PyG', n: '05' },
  { id: 'page-liquidez',   label: '06 Liquidez & runway', n: '06' },
  { id: 'page-deuda',      label: '07 Endeudamiento', n: '07' },
  { id: 'page-rentabilidad', label: '08 Rentabilidad', n: '08' },
  { id: 'page-cashflow',   label: '09 Cashflow', n: '09' },
  { id: 'page-ma',         label: '10 M&A', n: '10' },
  { id: 'page-calidad',    label: '11 Calidad contable', n: '11' },
  { id: 'page-fiscal',     label: '12 Fiscalidad', n: '12' },
  { id: 'page-alertas',    label: '13 Alertas', n: '13' },
  { id: 'page-plan',       label: '14 Plan de acción', n: '14' },
];

const ESTADO_LABELS = { borrador: 'Borrador', pendiente_revision: 'Pendiente revisión', validado: 'Validado' };
const ESTADO_COLORS = { borrador: 'bg-slate-100 text-slate-600', pendiente_revision: 'bg-amber-100 text-amber-700', validado: 'bg-emerald-100 text-emerald-700' };

export default function PremiumReportViewerV5({ imp, onBack }) {
  const [supuestos, setSupuestos] = useState({});
  const [aiContent, setAiContent] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showSupuestos, setShowSupuestos] = useState(false);
  const [showIndex, setShowIndex] = useState(true);
  const [activeSection, setActiveSection] = useState('page-portada');
  const [estado, setEstado] = useState('borrador');
  const [report, setReport] = useState(null);
  const scrollRef = useRef(null);

  // Load existing report
  useEffect(() => {
    if (!imp?.id) return;
    base44.entities.FinancialReport.filter({ import_id: imp.id }, '-created_date', 1)
      .then(results => {
        if (results?.length > 0) {
          setReport(results[0]);
          if (results[0].contenido?.narrativa) setAiContent(results[0].contenido.narrativa);
          if (results[0].contenido?.supuestos) setSupuestos(results[0].contenido.supuestos);
        }
      });
  }, [imp?.id]);

  // Track active section on scroll
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handler = () => {
      const sections = SECTIONS.map(s => ({ id: s.id, el: document.getElementById(s.id) })).filter(s => s.el);
      const containerTop = container.scrollTop + 100;
      let current = sections[0]?.id;
      for (const s of sections) {
        if (s.el.offsetTop <= containerTop) current = s.id;
      }
      setActiveSection(current);
    };
    container.addEventListener('scroll', handler, { passive: true });
    return () => container.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - 20, behavior: 'smooth' });
    }
  };

  // Calculate everything
  const calc = calcularMetricas(imp, supuestos);
  const alertas = generarAlertas(calc);
  const recs = generarRecomendaciones(calc);

  // AI generation
  const generateAI = async () => {
    setLoadingAI(true);
    const prompt = `Eres director senior de finanzas corporativas y M&A. Analiza los siguientes datos financieros y genera un informe ejecutivo premium en español. Tono: profesional, ejecutivo, prudente, sin humo, sin frases vacías. No inventar datos. Si falta información, indicarlo.

Datos empresa: ${calc.empresa}, ejercicio ${calc.ejercicio}
Balance: Activo total ${calc.totalActivo}€, PN ${calc.patrimonioNeto}€, Activo C ${calc.activoCorriente}€, Pasivo C ${calc.pasivoCorriente}€, Pasivo NC ${calc.pasivoNoCorriente}€, Balance cuadra: ${calc.balanceCuadra ? 'SÍ' : 'NO (diferencia ' + calc.diferencia + '€)'}
PyG disponible: ${calc.hasPyG ? 'SÍ' : 'NO'}
${calc.hasPyG ? `Ingresos ${calc.ingresos}€, Gastos ${calc.gastos}€, Resultado ${calc.resultado}€, EBITDA ${calc.ebitda}€` : ''}
Tesorería: ${calc.tesoreria}€, DFN: ${calc.deudaFinancieraNeta}€
Fondo de maniobra: ${calc.fondoManiobra}€
Calidad contable: ${calc.calidadLabel} (score ${calc.calidadScore}/100)
${Object.keys(supuestos).length > 0 ? 'Supuestos usuario: ' + JSON.stringify(supuestos) : ''}

Genera JSON con: diagnostico_ejecutivo (4-6 frases, diagnóstico general prudente y accionable), analisis_balance {activo_no_corriente, activo_corriente, patrimonio_neto, pasivo_no_corriente, pasivo_corriente} (2-3 frases cada uno), analisis_pyg {ingresos, gastos, resultado} (2 frases cada uno, solo si hasPyG=true, si no pon null), analisis_fiscal (3-4 frases preliminares), conclusion_final (3-5 frases con recomendación profesional).`;

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
        },
      },
      model: 'claude_sonnet_4_6',
    });

    setAiContent(result);

    // Save
    const contenido = { ...imp?.metricas_calculadas, narrativa: result, supuestos };
    if (report?.id) {
      await base44.entities.FinancialReport.update(report.id, { contenido, resumen_ejecutivo: result.diagnostico_ejecutivo || '', conclusiones: result.conclusion_final ? [result.conclusion_final] : [], estado });
    } else {
      const newReport = await base44.entities.FinancialReport.create({
        company_id: imp?.company_id,
        import_id: imp?.id,
        titulo: `Informe V5 — ${calc.empresa} — ${calc.ejercicio}`,
        empresa_nombre: calc.empresa,
        periodo_inicio: imp?.periodo_inicio,
        periodo_fin: imp?.periodo_fin,
        origen_datos: imp?.origen,
        estado: 'generado',
        nivel_detalle: 'completo',
        contenido,
        resumen_ejecutivo: result.diagnostico_ejecutivo,
        conclusiones: [result.conclusion_final].filter(Boolean),
        generado_por: 'taxea_ia_v5',
      });
      setReport(newReport);
    }
    setLoadingAI(false);
  };

  // PDF Export
  const exportPDF = async () => {
    setExportingPDF(true);
    await new Promise(r => setTimeout(r, 100));
    const html = buildPDFHTML(calc, alertas, recs, aiContent, imp);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); setExportingPDF(false); }, 800);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ─── Barra superior fija ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-100 flex-shrink-0 flex-wrap gap-y-2">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-500 hover:text-foreground mr-1">
          <ChevronLeft className="w-3.5 h-3.5" /> Volver
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">Informe Premium V5</span>
          <span className="text-[10px] text-slate-400">{calc.empresa} · {calc.ejercicio}</span>
        </div>
        <div className="flex items-center gap-1 ml-0.5">
          {Object.keys(ESTADO_LABELS).map(e => (
            <button key={e} onClick={() => setEstado(e)}
              className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all', estado === e ? ESTADO_COLORS[e] + ' border-transparent' : 'border-slate-200 text-slate-400 hover:bg-slate-50')}>
              {ESTADO_LABELS[e]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setShowIndex(!showIndex)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            <List className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowSupuestos(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200">
            <Settings2 className="w-3.5 h-3.5" /> Supuestos
          </button>
          <button onClick={generateAI} disabled={loadingAI}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 disabled:opacity-40">
            {loadingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiContent ? 'Regenerar IA' : 'Generar análisis IA'}
          </button>
          <button onClick={exportPDF} disabled={exportingPDF}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-lg disabled:opacity-40">
            {exportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Exportar PDF
          </button>
        </div>
      </div>

      {/* ─── AI banner ─────────────────────────────────────────────────────────── */}
      {loadingAI && (
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border-b border-violet-200 flex-shrink-0">
          <Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin" />
          <p className="text-xs text-violet-700 font-medium">Generando análisis narrativo con IA avanzada (Claude Sonnet) · 20-40s</p>
        </div>
      )}
      {aiContent && !loadingAI && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border-b border-emerald-200 flex-shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <p className="text-xs text-emerald-700 font-medium">Análisis IA integrado en el informe. Se incluirá en el PDF exportado.</p>
        </div>
      )}

      {/* ─── Layout principal ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Índice lateral */}
        {showIndex && (
          <div className="w-44 flex-shrink-0 bg-slate-50 border-r border-slate-100 overflow-y-auto py-3 px-2">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Índice</p>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => scrollTo(s.id)}
                className={cn('w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all mb-0.5',
                  activeSection === s.id ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60')}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Contenedor de páginas — scroll vertical con páginas A4 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-slate-100 py-6 px-4"
          style={{ scrollBehavior: 'smooth' }}>
          <div style={{ maxWidth: '240mm', margin: '0 auto' }}>
            <PagePortada calc={calc} imp={imp} today={TODAY} />
            <PageResumen calc={calc} aiContent={aiContent} />
            <PageAlcance calc={calc} imp={imp} />
            <PageBalance calc={calc} aiContent={aiContent} />
            <PagePyG calc={calc} aiContent={aiContent} />
            <PageLiquidez calc={calc} />
            <PageEndeudamiento calc={calc} />
            <PageRentabilidad calc={calc} />
            <PageCashflow calc={calc} />
            <PageMA calc={calc} aiContent={aiContent} />
            <PageCalidadContable calc={calc} />
            <PageFiscalidad calc={calc} />
            <PageAlertas alertas={alertas} />
            <PagePlan recs={recs} aiContent={aiContent} />
          </div>
        </div>
      </div>

      {/* Modal supuestos */}
      {showSupuestos && (
        <ReportSupuestos
          supuestos={supuestos}
          onChange={setSupuestos}
          onClose={() => setShowSupuestos(false)}
        />
      )}
    </div>
  );
}
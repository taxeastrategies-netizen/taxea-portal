import { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Brain, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const ANALYSIS_TYPES = [
  { id: 'full', label: 'Análisis completo CFO', icon: Brain, desc: 'Evaluación 360° como Director Financiero', color: 'bg-slate-800 text-white' },
  { id: 'cashflow', label: 'Análisis Cashflow', icon: TrendingUp, desc: 'Profundidad en liquidez y flujo de caja', color: 'bg-blue-600 text-white' },
  { id: 'risk', label: 'Análisis de Riesgos', icon: AlertTriangle, desc: 'Detección de tensiones y riesgos financieros', color: 'bg-red-600 text-white' },
  { id: 'performance', label: 'Performance Review', icon: CheckCircle2, desc: 'Eficiencia, márgenes y rentabilidad', color: 'bg-emerald-600 text-white' },
];

export default function FinancialIntelligenceAI({ financials, company, invoices, expenses, debts, bankAccounts }) {
  const [selected, setSelected] = useState('full');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const f = financials || {};

  const buildContext = () => `
Empresa: ${company?.nombre_comercial || company?.razon_social || 'N/A'}
Régimen fiscal: ${company?.regimen_fiscal || 'N/A'}

MÉTRICAS FINANCIERAS:
- Ingresos totales: ${fmt(f.ingresos)}
- Gastos totales: ${fmt(f.gastoTotal)}
- Beneficio neto: ${fmt(f.beneficio)}
- Margen neto: ${f.margen?.toFixed(1)}%
- EBITDA estimado: ${fmt(f.ebitda)}
- Caja disponible: ${fmt(f.cashTotal)}
- Burn rate mensual: ${fmt(f.burnRate)}
- Runway: ${f.runway ? f.runway.toFixed(1) + ' meses' : 'N/A'}
- Deuda total activa: ${fmt(f.deudaTotal)}
- Cuotas mensuales deuda: ${fmt(f.cuotasMensuales)}
- Intereses anuales: ${fmt(f.interesesAnuales)}
- Cobros pendientes (AR): ${fmt(f.cobrosPendientes)}
- Pagos pendientes (AP): ${fmt(f.pagosPendientes)}
- Working Capital: ${fmt(f.workingCapital)}
- DSO estimado: ~${f.dso || 0} días
- DPO estimado: ~${f.dpo || 0} días
- Nº facturas emitidas: ${invoices.filter(i => i.tipo === 'emitida').length}
- Nº instrumentos deuda activos: ${debts.filter(d => d.estado === 'activo').length}
- Cuentas bancarias: ${bankAccounts.length}
  `.trim();

  const PROMPTS = {
    full: (ctx) => `Eres un Director Financiero (CFO) con experiencia en Big4 (Deloitte/KPMG). 
Analiza en profundidad el perfil financiero de esta empresa. 
Genera un análisis ejecutivo profesional en español estructurado así:

1. RESUMEN EJECUTIVO (3-4 líneas, visión global)
2. FORTALEZAS FINANCIERAS (bullet points)
3. ÁREAS DE RIESGO Y MEJORA (bullet points)
4. ANÁLISIS DE LIQUIDEZ Y CASHFLOW
5. ANÁLISIS DE ENDEUDAMIENTO
6. EFICIENCIA OPERATIVA (DSO, DPO, WC)
7. PERSPECTIVAS Y RECOMENDACIONES ORIENTATIVAS
8. CONCLUSIÓN ESTRATÉGICA

Usa lenguaje corporativo, profesional y sofisticado. Sé analítico y preciso.

Datos:
${ctx}`,
    cashflow: (ctx) => `Eres un especialista en tesorería y cashflow de Big4.
Analiza el flujo de caja y liquidez de esta empresa en español:

1. POSICIÓN DE LIQUIDEZ ACTUAL
2. ANÁLISIS BURN RATE Y RUNWAY
3. CALIDAD DEL CASHFLOW (DSO, cobros)
4. RIESGOS DE LIQUIDEZ DETECTADOS
5. OPTIMIZACIÓN DE TESORERÍA
6. RECOMENDACIONES ORIENTATIVAS DE CASHFLOW

Datos:
${ctx}`,
    risk: (ctx) => `Eres un auditor de riesgos financieros senior de una Big4.
Detecta y analiza todos los riesgos financieros de esta empresa en español:

1. MAPA DE RIESGOS (semáforo: alto/medio/bajo)
2. RIESGO DE LIQUIDEZ
3. RIESGO DE ENDEUDAMIENTO
4. RIESGO OPERATIVO (márgenes, gastos)
5. RIESGO DE CASHFLOW
6. ALERTAS PRIORITARIAS
7. PLAN DE CONTINGENCIA ORIENTATIVO

Datos:
${ctx}`,
    performance: (ctx) => `Eres un controller financiero experto de consultoría estratégica.
Evalúa el performance financiero de esta empresa en español:

1. KPIs DE RENDIMIENTO
2. ANÁLISIS DE MÁRGENES
3. EFICIENCIA OPERATIVA
4. BENCHMARK SECTORIAL (estimado)
5. EVOLUCIÓN Y TENDENCIAS
6. OPORTUNIDADES DE MEJORA
7. CONCLUSIÓN EJECUTIVA

Datos:
${ctx}`,
  };

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    const ctx = buildContext();
    const prompt = PROMPTS[selected](ctx);
    const res = await base44.integrations.Core.InvokeLLM({ prompt, model: 'claude_sonnet_4_6' });
    setResult(typeof res === 'string' ? res : res?.result || res?.text || '');
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-jakarta font-bold">Financial Intelligence AI</h3>
            <p className="text-slate-400 text-xs">Motor de análisis financiero — nivel CFO / Big4</p>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          La IA actúa como analista financiero senior, detectando tensiones, oportunidades y riesgos con el rigor de una consultoría estratégica.
        </p>
        <p className="text-[10px] text-slate-500 mt-2">Nota: usa modelo premium (claude_sonnet). Consume más créditos de integración.</p>
      </div>

      {/* Analysis type selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ANALYSIS_TYPES.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setSelected(t.id)}
              className={cn("p-4 rounded-xl border-2 text-left transition-all",
                selected === t.id ? "border-taxea-red ring-2 ring-taxea-red/20" : "border-slate-200 hover:border-slate-300")}>
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", t.color)}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-foreground">{t.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{t.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Context summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-slate-500 mb-2">Datos que se analizarán:</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><span className="text-slate-400">Ingresos</span><br /><span className="font-bold text-foreground">{fmt(f.ingresos)}</span></div>
          <div><span className="text-slate-400">EBITDA</span><br /><span className="font-bold text-foreground">{fmt(f.ebitda)}</span></div>
          <div><span className="text-slate-400">Caja</span><br /><span className="font-bold text-foreground">{fmt(f.cashTotal)}</span></div>
          <div><span className="text-slate-400">Deuda</span><br /><span className="font-bold text-foreground">{fmt(f.deudaTotal)}</span></div>
        </div>
      </div>

      {/* Generate */}
      <button onClick={analyze} disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-slate-800 to-slate-700 text-white hover:from-slate-700 hover:to-slate-600 transition-all disabled:opacity-60 shadow-md">
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
        {loading ? 'Analizando con IA…' : 'Generar análisis financiero'}
      </button>

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-white/70" />
            <p className="text-sm font-semibold text-white">Análisis Financiero — {ANALYSIS_TYPES.find(t => t.id === selected)?.label}</p>
          </div>
          <div className="p-5 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {result}
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">⚠ Análisis orientativo. No constituye asesoramiento financiero regulado. Generado por IA — {new Date().toLocaleDateString('es-ES')}.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
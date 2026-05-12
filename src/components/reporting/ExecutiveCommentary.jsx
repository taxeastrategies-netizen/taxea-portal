import { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { FileText, RefreshCw, Brain, Copy, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const STYLES = [
  { id: 'deloitte', label: 'Deloitte', desc: 'Rigor técnico, precisión contable', color: 'bg-green-700' },
  { id: 'kpmg', label: 'KPMG', desc: 'Visión holística, estratégica', color: 'bg-blue-700' },
  { id: 'ey', label: 'EY', desc: 'Orientado a crecimiento y oportunidad', color: 'bg-yellow-600' },
  { id: 'mckinsey', label: 'McKinsey', desc: 'Ejecutivo, directo, orientado a acción', color: 'bg-slate-800' },
];

const AUDIENCES = [
  { id: 'board', label: 'Consejo de Administración' },
  { id: 'investors', label: 'Inversores / Fondos' },
  { id: 'banks', label: 'Entidades Bancarias' },
  { id: 'management', label: 'Equipo Directivo' },
  { id: 'partners', label: 'Socios / Accionistas' },
];

export default function ExecutiveCommentary({ financials, company }) {
  const [style, setStyle] = useState('deloitte');
  const [audience, setAudience] = useState('board');
  const [tone, setTone] = useState('neutral');
  const [loading, setLoading] = useState(false);
  const [commentary, setCommentary] = useState('');
  const [copied, setCopied] = useState(false);
  const f = financials || {};

  const generate = async () => {
    setLoading(true);
    setCommentary('');
    const styleDescriptions = {
      deloitte: 'Deloitte (rigor técnico contable, lenguaje financiero preciso, estructura clara)',
      kpmg: 'KPMG (visión estratégica holística, análisis balanced, perspectiva de negocio)',
      ey: 'EY (orientado a crecimiento, oportunidades, forward-looking)',
      mckinsey: 'McKinsey (ejecutivo, directo, orientado a decisión y acción)',
    };
    const audienceDescriptions = {
      board: 'Consejo de Administración (alta dirección, visión estratégica)',
      investors: 'Inversores y Fondos (retorno, crecimiento, riesgos)',
      banks: 'Entidades bancarias (solvencia, capacidad pago, garantías)',
      management: 'Equipo directivo interno (operativo, KPIs, mejoras)',
      partners: 'Socios y accionistas (rentabilidad, dividendos, evolución)',
    };
    const toneDescriptions = {
      positive: 'optimista pero honesto, destacando fortalezas',
      neutral: 'objetivo y equilibrado, presentando realidad con rigor',
      cautious: 'prudente y conservador, destacando riesgos y medidas',
    };

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un consultor ejecutivo con estilo ${styleDescriptions[style]}.
Escribe un executive commentary financiero en español (200-280 palabras) para: ${audienceDescriptions[audience]}.
Tono: ${toneDescriptions[tone]}.

Empresa: ${company?.nombre_comercial || company?.razon_social || 'N/A'}
Período: ${format(new Date(), 'MMMM yyyy', { locale: es })}

DATOS FINANCIEROS:
- Ingresos: ${fmt(f.ingresos)} | EBITDA: ${fmt(f.ebitda)} (${f.margen?.toFixed(1)}% margen)
- Beneficio neto: ${fmt(f.beneficio)}
- Caja disponible: ${fmt(f.cashTotal)} | Runway: ${f.runway ? f.runway.toFixed(1) + ' meses' : 'N/A'}
- Burn rate: ${fmt(f.burnRate)}/mes
- Deuda activa: ${fmt(f.deudaTotal)}
- Working Capital: ${fmt(f.workingCapital)}
- DSO: ~${f.dso} días | DPO: ~${f.dpo} días
- Cobros pendientes: ${fmt(f.cobrosPendientes)}

Estructura:
1. APERTURA EJECUTIVA (1-2 líneas impactantes)
2. EVOLUCIÓN FINANCIERA (situación actual)
3. ANÁLISIS DE RENDIMIENTO (métricas clave interpretadas)
4. GESTIÓN DEL RIESGO (tensiones y medidas)
5. PERSPECTIVAS (forward-looking, orientativo)
6. CIERRE ESTRATÉGICO (1 línea poderosa)

Genera texto fluido, narrativo, NO bullets. Usa números del informe. Estilo corporativo premium, sofisticado y profesional.`,
      model: 'claude_sonnet_4_6',
    });
    setCommentary(typeof res === 'string' ? res : res?.result || res?.text || '');
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(commentary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-jakarta font-bold">Executive Commentary Engine</h3>
            <p className="text-purple-300 text-sm mt-0.5">Narrativa ejecutiva estilo Big4 generada con IA</p>
          </div>
        </div>
        <p className="text-purple-200 text-sm mt-4 leading-relaxed">
          Genera comentarios ejecutivos financieros profesionales adaptados a tu audiencia, con el estilo y rigor de las principales firmas de consultoría estratégica.
        </p>
        <p className="text-[10px] text-purple-400 mt-2">Usa modelo premium (claude_sonnet). Consume más créditos de integración.</p>
      </div>

      {/* Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Style */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Estilo consultora</p>
          <div className="space-y-2">
            {STYLES.map(s => (
              <button key={s.id} onClick={() => setStyle(s.id)}
                className={cn("w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all",
                  style === s.id ? "border-taxea-red ring-1 ring-taxea-red/20" : "border-slate-200 hover:border-slate-300")}>
                <div className={cn("w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-black flex-shrink-0", s.color)}>
                  {s.label[0]}
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{s.label}</p>
                  <p className="text-[11px] text-slate-400">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Audience */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Audiencia objetivo</p>
          <div className="space-y-2">
            {AUDIENCES.map(a => (
              <button key={a.id} onClick={() => setAudience(a.id)}
                className={cn("w-full text-left px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all",
                  audience === a.id ? "border-taxea-red bg-taxea-red/5 text-taxea-red" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tone */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tono narrativo</p>
          <div className="space-y-2">
            {[
              { id: 'positive', label: 'Optimista', desc: 'Destaca fortalezas y oportunidades', color: 'text-emerald-600' },
              { id: 'neutral', label: 'Equilibrado', desc: 'Objetivo y técnico, sin sesgos', color: 'text-slate-600' },
              { id: 'cautious', label: 'Conservador', desc: 'Prudente, destaca riesgos', color: 'text-amber-600' },
            ].map(t => (
              <button key={t.id} onClick={() => setTone(t.id)}
                className={cn("w-full text-left p-3 rounded-xl border-2 transition-all",
                  tone === t.id ? "border-taxea-red ring-1 ring-taxea-red/20" : "border-slate-200 hover:border-slate-300")}>
                <p className={cn("text-xs font-semibold", t.color)}>{t.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate */}
      <button onClick={generate} disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-700 to-purple-600 text-white hover:from-purple-600 hover:to-purple-500 transition-all disabled:opacity-60 shadow-md">
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
        {loading ? 'Generando commentary ejecutivo…' : 'Generar Executive Commentary'}
      </button>

      {/* Result */}
      {commentary && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className={cn("w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-black", STYLES.find(s => s.id === style)?.color)}>
                {STYLES.find(s => s.id === style)?.label[0]}
              </div>
              <p className="text-sm font-semibold text-foreground">Executive Commentary — {STYLES.find(s => s.id === style)?.label} · {AUDIENCES.find(a => a.id === audience)?.label}</p>
            </div>
            <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
              {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div className="p-6 text-sm text-slate-700 leading-[1.85] font-inter">
            {commentary}
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">⚠ Generado por IA — {new Date().toLocaleDateString('es-ES')}. Orientativo. No constituye asesoramiento financiero regulado.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
import { Rocket, Sparkles } from 'lucide-react';

const MODULE_INFO = {
  seo: { label: 'SEO Center', desc: 'Investigación de keywords, clustering, auditorías on-page y seguimiento de posiciones.', phase: 2 },
  'ai-visibility': { label: 'AI Visibility / GEO / AEO', desc: 'Optimización para buscadores con IA, snippets generativos y autoridad temática.', phase: 2 },
  landings: { label: 'Landing Builder', desc: 'Constructor de páginas de captación con bloques de conversión y compliance integrado.', phase: 2 },
  forms: { label: 'Formularios y Captación', desc: 'Formularios inteligentes con Lead Fit Score automático por cada lead entrante.', phase: 1 },
  'lead-magnets': { label: 'Lead Magnets', desc: 'Generador de recursos de captación: guías, calculadoras, checklists y diagnósticos.', phase: 1 },
  funnels: { label: 'Funnel Center', desc: 'Constructor visual de embudos con Funnel Leak Detector y mapa de rentabilidad.', phase: 2 },
  leads: { label: 'Calidad de Leads', desc: 'Lead Fit Score, calificación automática y segmentación por potencial de cierre.', phase: 2 },
  proposals: { label: 'Generador de Propuestas', desc: 'Propuestas comerciales basadas en diagnóstico con planes Básico/Pro/Premium.', phase: 1 },
  pricing: { label: 'Pricing Guardrail', desc: 'Calculadora de precio mínimo, margen estimado y alertas de infraprecio.', phase: 2 },
  email: { label: 'Email Marketing', desc: 'Listas, segmentos, secuencias de nurturing y plantillas por tipo de cliente.', phase: 2 },
  whatsapp: { label: 'WhatsApp Sales Center', desc: 'Plantillas, secuencias de seguimiento y WhatsApp Closing Assistant con IA.', phase: 2 },
  ads: { label: 'Ads Center', desc: 'Meta, Google, TikTok y LinkedIn con Ad Spend Guardian y Creative Library.', phase: 2 },
  benchmarks: { label: 'Benchmark & Competencia', desc: 'Análisis de competidores, gaps de mercado y señales de posicionamiento.', phase: 2 },
  reputation: { label: 'Reputación & Customer Voice', desc: 'Social listening, Pain Mining Engine y Voice of Customer Center.', phase: 2 },
  referrals: { label: 'Referidos & Partners', desc: 'Programa de referidos, Partner Center y Partner ROI Score.', phase: 2 },
  partners: { label: 'Partners', desc: 'Gestión de red de partners con métricas de ROI y calidad por partner.', phase: 2 },
  compliance: { label: 'Marketing Compliance', desc: 'RGPD, claims fiscales, publicidad engañosa y Legal Risk Checker automático.', phase: 2 },
  forecast: { label: 'Growth Forecast', desc: 'Simulador de escenarios conservador/base/agresivo con impacto en MRR.', phase: 3 },
  goals: { label: 'Objetivos de Growth', desc: 'OKRs de crecimiento con Goal-to-Action Planner automático.', phase: 2 },
  automation: { label: 'Automatizaciones Growth', desc: 'Builder en lenguaje natural para automatizaciones de captación y seguimiento.', phase: 3 },
};

export default function GrowthComingSoon({ module }) {
  const urlParams = new URLSearchParams(window.location.search);
  const path = window.location.pathname.split('/').pop();
  const info = MODULE_INFO[path] || { label: 'Módulo en construcción', desc: 'Este módulo estará disponible próximamente.', phase: 2 };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Rocket className="w-8 h-8 text-primary" />
        </div>
        <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-semibold mb-3">
          <Sparkles className="w-3 h-3" />Fase {info.phase} · Próximamente
        </div>
        <h2 className="text-xl font-bold font-jakarta mb-2">{info.label}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{info.desc}</p>
        <div className="mt-6 p-4 bg-secondary/50 rounded-xl text-xs text-muted-foreground">
          La arquitectura de datos ya está preparada. Este módulo se activará en la siguiente fase.
        </div>
      </div>
    </div>
  );
}
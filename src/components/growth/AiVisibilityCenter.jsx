import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Brain, Loader2, Star, AlertCircle, ChevronRight, CheckCircle2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const VERTICALES = [
  { id: 'igic', label: 'IGIC Canarias', cobertura: 85, contenido_ok: 8, faltante: 3, pilar: 'Guia completa IGIC para autonomos y pymes', prio: 'critica', eeat: 'experiencia local unica' },
  { id: 'autonomos', label: 'Fiscalidad autonomos', cobertura: 60, contenido_ok: 12, faltante: 8, pilar: 'Todo sobre la fiscalidad del autonomo espanol', prio: 'alta', eeat: 'experiencia practica + casos reales' },
  { id: 'contabilidad', label: 'Contabilidad pyme', cobertura: 45, contenido_ok: 7, faltante: 9, pilar: 'Contabilidad para pymes: guia sin tecnicismos', prio: 'alta', eeat: 'casos reales + simplificacion' },
  { id: 'financiero', label: 'Control financiero', cobertura: 30, contenido_ok: 4, faltante: 12, pilar: 'Control financiero para duenos de negocio', prio: 'media', eeat: 'herramientas practicas + portal integrado' },
  { id: 'ecommerce', label: 'Ecommerce fiscal', cobertura: 25, contenido_ok: 3, faltante: 10, pilar: 'Fiscalidad del ecommerce espanol: IVA, OSS, aduanas', prio: 'media', eeat: 'especializacion nicho' },
  { id: 'erp', label: 'ERP para pymes', cobertura: 15, contenido_ok: 2, faltante: 15, pilar: 'Que es un ERP y por que lo necesita tu pyme', prio: 'baja', eeat: 'demostracion producto propio' },
];

const FAQS = [
  { pregunta: 'Cuanto me cuesta ser autonomo en Canarias?', intencion: 'calculadora', pilar: 'IGIC + cuotas', gap: 'Falta calculadora interactiva' },
  { pregunta: 'Que diferencia hay entre IVA e IGIC?', intencion: 'informacional', pilar: 'IGIC Canarias', gap: 'Existe, falta schema FAQ' },
  { pregunta: 'Puedo deducirme el coche siendo autonomo?', intencion: 'informacional + legal', pilar: 'Deducciones autonomo', gap: 'Falta respuesta prudente con matices' },
  { pregunta: 'Cuando conviene montar una SL?', intencion: 'decision', pilar: 'SL vs autonomo', gap: 'Existe parcialmente' },
  { pregunta: 'Que es el control financiero para pymes?', intencion: 'informacional', pilar: 'Control financiero', gap: 'No existe' },
  { pregunta: 'Cual es la mejor gestoria online para autonomos en Canarias?', intencion: 'transaccional', pilar: 'Comparativa', gap: 'No existe — maxima prioridad' },
];

const PRIO_COLORS = { critica: 'bg-red-100 text-red-700', alta: 'bg-amber-100 text-amber-700', media: 'bg-blue-100 text-blue-700', baja: 'bg-slate-100 text-slate-600' };

export default function AiVisibilityCenter() {
  const [selected, setSelected] = useState(null);
  const [aiContent, setAiContent] = useState({});
  const [loading, setLoading] = useState({});
  const [tab, setTab] = useState('authority');

  const generateContent = async (vertical) => {
    setLoading(p => ({ ...p, [vertical.id]: true }));
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto en GEO (Generative Engine Optimization) y AEO (Answer Engine Optimization) para servicios fiscales espanoles.\n\nPara la vertical "${vertical.label}" de Taxea genera:\n1. 5 preguntas que hace el usuario ideal en ChatGPT/Perplexity/Gemini\n2. Respuesta estructurada ideal para cada pregunta (que Taxea deberia tener en su web)\n3. Schema JSON-LD recomendado (FAQPage)\n4. Que necesita Taxea para aparecer en respuestas de IA (E-E-A-T, menciones, autoridad)\n5. Gap principal vs competidores\n\nBrief: ${vertical.pilar}\nFortaleza E-E-A-T: ${vertical.eeat}\n\nRespuesta concisa y accionable. Borrador.`,
    });
    setAiContent(p => ({ ...p, [vertical.id]: typeof res === 'string' ? res : res?.response || '' }));
    setLoading(p => ({ ...p, [vertical.id]: false }));
    setSelected(vertical.id);
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><Globe className="w-5 h-5 text-blue-600" />AI Visibility / GEO / AEO Center</h1>
        <p className="text-sm text-muted-foreground">Optimiza Taxea para aparecer en ChatGPT, Perplexity, Gemini y buscadores IA — generative engine optimization</p>
      </div>

      <div className="flex gap-2">
        {[['authority','Authority Builder'],['faqs','FAQs para IA'],['gaps','Content Gaps']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', tab===v ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground')}>{l}</button>
        ))}
      </div>

      {tab === 'authority' && (
        <div className="space-y-3">
          {VERTICALES.map(v => (
            <div key={v.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <p className="font-semibold">{v.label}</p>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', PRIO_COLORS[v.prio])}>{v.prio}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                      <div className={cn('h-3 rounded-full', v.cobertura >= 70 ? 'bg-emerald-500' : v.cobertura >= 40 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${v.cobertura}%` }} />
                    </div>
                    <span className="text-xs font-bold w-12 text-right">{v.cobertura}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{v.contenido_ok} piezas existentes · {v.faltante} faltantes · E-E-A-T: {v.eeat}</p>
                </div>
                <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0" onClick={() => generateContent(v)} disabled={loading[v.id]}>
                  {loading[v.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}Optimizar para IA
                </Button>
              </div>
              {selected === v.id && aiContent[v.id] && (
                <div className="mt-3 bg-slate-900 text-white text-xs p-4 rounded-xl whitespace-pre-wrap leading-relaxed">
                  <p className="text-white/40 mb-2 text-[10px] uppercase tracking-wide">Borrador GEO/AEO — Requiere revision</p>
                  {aiContent[v.id]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'faqs' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Preguntas que hace el cliente ideal en buscadores IA. Taxea debe tener respuestas estructuradas para cada una.</p>
          {FAQS.map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{i+1}</div>
                <div className="flex-1">
                  <p className="font-medium mb-1">"{f.pregunta}"</p>
                  <p className="text-xs text-muted-foreground">Intencion: {f.intencion} · Pilar: {f.pilar}</p>
                  <p className="text-xs mt-1"><span className={cn('font-semibold', f.gap.includes('No existe') ? 'text-red-600' : f.gap.includes('Falta') ? 'text-amber-600' : 'text-emerald-600')}>{f.gap}</span></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'gaps' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Verticales cubiertas', v: VERTICALES.filter(v => v.cobertura >= 60).length, color: 'text-emerald-600' },
              { label: 'Cobertura media', v: `${Math.round(VERTICALES.reduce((s,v) => s+v.cobertura,0)/VERTICALES.length)}%`, color: 'text-amber-600' },
              { label: 'Piezas faltantes est.', v: VERTICALES.reduce((s,v) => s+v.faltante,0), color: 'text-red-600' },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <p className={cn('text-3xl font-bold', s.color)}>{s.v}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="font-semibold text-sm mb-2">Oportunidad principal detectada</p>
            <p className="text-sm text-muted-foreground">Taxea tiene ventaja competitiva unica en <strong>IGIC Canarias</strong> — tema con poca competencia editorial y alta intencion transaccional. Crear 5 piezas sobre IGIC puede generar leads de alta calidad organicamente en 3-6 meses con inversion minima.</p>
          </div>
        </div>
      )}
    </div>
  );
}
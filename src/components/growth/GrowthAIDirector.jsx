import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Brain, Loader2, Send, TrendingUp, Search, FileText, MessageSquare, BarChart2, Shield, DollarSign, Bot, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NoCompanyState from '@/components/ui/NoCompanyState';

const MODES = [
  { id: 'strategist', label: 'Growth Strategist', icon: TrendingUp, desc: 'Estrategia de crecimiento y priorizacion de canales' },
  { id: 'seo', label: 'SEO Analyst', icon: Search, desc: 'Keywords, clusters y estrategia de contenido organico' },
  { id: 'copywriter', label: 'Copywriter', icon: FileText, desc: 'Copies, hooks, CTAs y mensajes de venta' },
  { id: 'sales', label: 'Sales Coach', icon: MessageSquare, desc: 'Scripts, objeciones y tecnicas de cierre' },
  { id: 'funnel', label: 'Funnel Auditor', icon: BarChart2, desc: 'Deteccion de fugas en el embudo y mejoras de conversion' },
  { id: 'compliance', label: 'Compliance Reviewer', icon: Shield, desc: 'Revision de claims fiscales y legales en marketing' },
  { id: 'revenue', label: 'Revenue Analyst', icon: DollarSign, desc: 'CAC, LTV, Marketing P&L y rentabilidad de canales' },
];

const SYSTEM_PROMPTS = {
  strategist: 'Eres el Director de Growth de una asesoria fiscal y financiera para pymes espanolas. Tu mision es priorizar acciones de crecimiento basandote en datos reales, rentabilidad y prudencia. Responde con datos, recomendaciones concretas y sin grandilocuencia.',
  seo: 'Eres un especialista SEO para el mercado espanol, experto en fiscalidad, contabilidad y servicios para pymes. Genera estrategias de keywords, clusters tematicos y contenido orientado a posicionar en Google y buscadores IA. Siempre con criterio de intencion de busqueda.',
  copywriter: 'Eres un copywriter B2B especialista en servicios fiscales y financieros para pymes espanolas. Generas copies persuasivos, honestos y sin promesas absolutas. Cada copy debe marcarse como borrador pendiente de revision.',
  sales: 'Eres un coach de ventas consultivas para equipos de asesoria y despachos. Ayudas a gestionar objeciones, mejorar guiones y cerrar mas con menos presion. Tono profesional, empatico y orientado al cliente.',
  funnel: 'Eres un auditor de embudos de venta. Analizas tasas de conversion por etapa, detectas fugas, propones mejoras y priorizas por impacto economico. Siempre explicas el "por que" de cada recomendacion.',
  compliance: 'Eres un revisor de compliance de marketing legal y fiscal. Detectas afirmaciones peligrosas, promesas absolutas, claims fiscales arriesgados y sugieres versiones seguras. Siempre marcas las propuestas como "borrador prudente, requiere validacion profesional".',
  revenue: 'Eres un analista de revenue para pymes con conocimiento de metricas SaaS aplicadas a servicios recurrentes: CAC, LTV, churn, MRR, payback. Analiza datos y genera insights accionables para mejorar la rentabilidad del marketing.',
};

const QUICK_PROMPTS = {
  strategist: ['Que canal debo escalar primero?', 'Como reduzco el CAC sin bajar la calidad de leads?', 'Dame un plan de crecimiento para los proximos 90 dias'],
  seo: ['Dame 10 keywords para autonomos en Canarias', 'Crea un cluster SEO sobre fiscalidad para ecommerce', 'Como mejoro mi autoridad en temas de IVA?'],
  copywriter: ['Escribe un hook para anuncio sobre gestoria low cost', 'Dame 5 asuntos para email de diagnostico gratuito', 'Genera el copy de una landing para SL con control financiero'],
  sales: ['Como respondo a ya tengo gestoria?', 'Dame un script de WhatsApp para seguimiento de propuesta', 'Cual es el mejor momento para pedir el cierre?'],
  funnel: ['Mi landing convierte al 2%, que puede estar fallando?', 'Tengo leads pero nadie agenda cita, por que?', 'Solo el 20% de mis propuestas se aceptan, como mejorar?'],
  compliance: ['Revisa este texto: Te garantizamos pagar menos impuestos', 'Es legal usar testimonios de clientes en anuncios?', 'Que debo incluir en el formulario de captacion para RGPD?'],
  revenue: ['Mi CAC es 180EUR y mi ticket medio 120EUR/mes, es sostenible?', 'Tengo 12% de churn mensual, como afecta al LTV?', 'Calcula el breakeven de una campana de 1000EUR'],
};

export default function GrowthAIDirector() {
  const { company } = useOutletContext() || {};
  const [mode, setMode] = useState('strategist');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const modeName = MODES.find(m => m.id === mode)?.label || 'Asistente';
    setMessages([{
      role: 'assistant',
      content: `Hola, soy tu ${modeName} de Taxea Growth. En que puedo ayudarte hoy?\n\nPuedes preguntarme sobre estrategia, campanas, contenido, SEO, ventas o cualquier aspecto de tu crecimiento comercial.`
    }]);
  }, [mode]);

  const send = async (text) => {
    const userMsg = text || input;
    if (!userMsg.trim()) return;
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);
    const history = newMessages.slice(-8).map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n\n');
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `${SYSTEM_PROMPTS[mode]}\n\nContexto de empresa: ${company?.nombre || 'asesoria/pyme espanola'}\n\nConversacion:\n${history}`,
      model: 'claude_sonnet_4_6',
    });
    const reply = typeof res === 'string' ? res : res?.response || '';
    setMessages(p => [...p, { role: 'assistant', content: reply }]);
    setLoading(false);
  };

  if (!company) return <NoCompanyState pageName="IA Director de Growth" />;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="px-6 pt-6 pb-4 border-b border-border bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><Bot className="w-5 h-5" /></div>
          <div>
            <h1 className="text-lg font-bold font-jakarta">Growth AI Director</h1>
            <p className="text-xs text-white/50">Taxea - Marketing, Sales &amp; Growth - IA aplicada al crecimiento</p>
          </div>
          <button onClick={() => setMessages([{ role: 'assistant', content: 'Nueva sesion iniciada. En que puedo ayudarte?' }])} className="ml-auto text-white/40 hover:text-white/80 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} className={cn('flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all', mode === m.id ? 'bg-white text-slate-900' : 'bg-white/10 text-white/70 hover:bg-white/20')}>
              <m.icon className="w-3 h-3" />{m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5"><Brain className="w-4 h-4 text-primary" /></div>}
            <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap', msg.role === 'user' ? 'bg-primary text-white' : 'bg-card border border-border')}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Brain className="w-4 h-4 text-primary" /></div>
            <div className="bg-card border border-border rounded-2xl px-4 py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-border bg-secondary/20 overflow-x-auto">
        <div className="flex gap-2">
          {(QUICK_PROMPTS[mode] || []).map((p, i) => (
            <button key={i} onClick={() => send(p)} className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary hover:text-primary transition-all">{p}</button>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            className="flex-1 h-10 rounded-xl border border-input bg-card px-4 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={`Pregunta al ${MODES.find(m => m.id === mode)?.label || 'Asistente'}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          />
          <Button onClick={() => send()} disabled={!input.trim() || loading} size="icon" className="h-10 w-10 rounded-xl">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
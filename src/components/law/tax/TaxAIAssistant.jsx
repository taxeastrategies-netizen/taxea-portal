import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Brain, Send, Sparkles, FileText, Zap, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const QUICK_ACTIONS = [
  { label: 'Redactar recurso alzada', icon: FileText, prompt: 'Necesito redactar un recurso de alzada ante el TEAR por una liquidación de IVA. La cuantía es de €12.400. El motivo es que la administración ha denegado la deducción de una factura de servicios profesionales argumentando falta de correlación con los ingresos.' },
  { label: 'Analizar riesgo fiscal', icon: Zap, prompt: 'Analiza el riesgo fiscal de la siguiente situación: una sociedad española con filial en Portugal factura servicios de gestión a la filial por €200.000 anuales. El tipo aplicado es el 8% sobre ventas. ¿Cuál es el riesgo de precios de transferencia?' },
  { label: 'Interpretar consulta DGT', icon: Brain, prompt: 'Interpreta la Consulta DGT V1234-24 sobre la deducibilidad de los gastos de formación de empleados en el Impuesto sobre Sociedades y explica su aplicación práctica para una empresa de tecnología.' },
  { label: 'Generar alegaciones', icon: Sparkles, prompt: 'Genera un borrador de alegaciones ante la AEAT en respuesta a un requerimiento de información sobre operaciones con partes vinculadas del ejercicio 2023, argumentando la correcta valoración a mercado de los servicios intergrupo.' },
];

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: `Soy el **Tax AI Assistant** de Taxea — tu asesor de inteligencia tributaria avanzada.

Puedo ayudarte a:
- **Redactar recursos y alegaciones** ante AEAT, TEAR, TEAC, AN y TS
- **Analizar riesgos fiscales** y generar matrices de riesgo
- **Interpretar consultas vinculantes DGT** y resoluciones TEAC/TEAR
- **Generar estrategias fiscales** y planificación tributaria
- **Resumir jurisprudencia** tributaria relevante
- **Detectar contingencias** fiscales en operaciones

¿En qué puedo ayudarte hoy?`,
};

export default function TaxAIAssistant() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un asesor fiscal y tributario experto especializado en derecho tributario español. Contexto: Taxea Business OS — Tax Law AI Assistant.

Usuario: ${userText}

Responde de forma profesional, precisa y estructurada. Si es relevante, cita normativa española (LGT, LIVA, TRLIS, LIRPF), consultas DGT, resoluciones TEAC/TEAR o jurisprudencia del TS/AN. Si generas un documento legal, usa formato profesional con secciones claras.`,
    });
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[800px]">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <Brain className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Tax AI Assistant</h2>
            <p className="text-sm text-slate-400">IA tributaria enterprise · DGT · TEAC · TEAR · TS · AN</p>
          </div>
        </div>
        <button onClick={() => setMessages([INITIAL_MESSAGE])} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Nueva sesión
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex-shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {QUICK_ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <button key={i} onClick={() => sendMessage(a.prompt)}
              className="flex items-center gap-2 p-3 bg-white border border-slate-100 rounded-xl hover:border-amber-200 hover:bg-amber-50/30 transition-all text-left group">
              <Icon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-xs font-medium text-slate-600 group-hover:text-amber-700">{a.label}</span>
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-4 mb-4">
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-3", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Brain className="w-3.5 h-3.5 text-amber-600" />
              </div>
            )}
            <div className={cn("max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-foreground border border-slate-100')}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
              <Brain className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 flex gap-2">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Pregunta sobre fiscalidad española, redacta un recurso, analiza un riesgo tributario..."
          rows={2}
          className="flex-1 resize-none px-4 py-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-200 bg-white" />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
          className="w-12 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-sm self-end">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
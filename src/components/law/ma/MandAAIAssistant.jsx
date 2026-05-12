import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Brain, Send, Target, FileSearch, BarChart2, FileText, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const QUICK_ACTIONS = [
  { label: 'Executive Summary DD', icon: FileSearch, prompt: 'Genera un Executive Summary profesional de Due Diligence para una adquisición de una empresa SaaS B2B española con EBITDA de €1.2M, deuda neta de €300K y 3 litigios laborales activos.' },
  { label: 'Redactar Term Sheet', icon: FileText, prompt: 'Redacta un Term Sheet para una ronda de inversión Serie A de €5M en una startup española de fintech. Incluye condiciones estándar: anti-dilución, liquidation preference, board representation, vesting y drag-along.' },
  { label: 'Análisis red flags', icon: Target, prompt: 'Lista los principales red flags que un comprador debe identificar en la due diligence de una empresa de distribución logística española con 50 empleados y facturación de €8M.' },
  { label: 'Valoración por comparables', icon: BarChart2, prompt: 'Explica la metodología de valoración por múltiplos de mercado (EV/EBITDA) para una empresa de servicios profesionales B2B española y proporciona rangos de múltiplos comparables del sector.' },
];

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: `Soy el **M&A AI Assistant** de Taxea — tu asesor de operaciones corporativas enterprise.

Puedo ayudarte a:
- **Generar Executive Summaries** de Due Diligence
- **Redactar documentos de operación** (LOI, Term Sheet, SPA, SHA, investment agreements)
- **Detectar red flags y contingencias** en procesos de DD
- **Valorar empresas** con análisis de múltiplos y comparables
- **Analizar sinergias** y optimizaciones post-deal
- **Interpretar contratos M&A** y explicar cláusulas clave

¿En qué operación puedo ayudarte?`,
};

export default function MandAAIAssistant() {
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
      prompt: `Eres un asesor M&A experto en fusiones y adquisiciones, corporate finance y operaciones corporativas en España. Tienes experiencia en Due Diligence, valoraciones, negociación de SPAs y SHAs, y asesoramiento a despachos Big Four y boutiques de inversión. Contexto: Taxea Business OS — M&A AI Assistant.

Usuario: ${userText}

Responde de forma profesional, precisa y ejecutiva. Si es relevante, incluye normativa española (LSC, CCom), regulación europea (Reglamento UE concentraciones) o estándares de mercado internacionales. Si generas documentos de operación, usa formato profesional completo.`,
    });
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[800px]">
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
            <Brain className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">M&A AI Assistant</h2>
            <p className="text-sm text-slate-400">DD IA · Deal docs · Red flags · Executive Summary · Valoraciones</p>
          </div>
        </div>
        <button onClick={() => setMessages([INITIAL_MESSAGE])} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Nueva sesión
        </button>
      </div>

      <div className="flex-shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {QUICK_ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <button key={i} onClick={() => sendMessage(a.prompt)}
              className="flex items-center gap-2 p-3 bg-white border border-slate-100 rounded-xl hover:border-violet-200 hover:bg-violet-50/30 transition-all text-left group">
              <Icon className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
              <span className="text-xs font-medium text-slate-600 group-hover:text-violet-700">{a.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-4 mb-4">
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-3", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Brain className="w-3.5 h-3.5 text-violet-600" />
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
            <div className="w-7 h-7 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
              <Brain className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">{[0, 1, 2].map(d => <span key={d} className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />)}</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 flex gap-2">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Due diligence, valoraciones, Term Sheet, SPA, red flags, executive summary..."
          rows={2}
          className="flex-1 resize-none px-4 py-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white" />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
          className="w-12 h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-sm self-end">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
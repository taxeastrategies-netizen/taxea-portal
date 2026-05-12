import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Brain, Send, Sparkles, FileText, Building2, Shield, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const QUICK_ACTIONS = [
  { label: 'Generar acta junta', icon: Building2, prompt: 'Genera un modelo completo de Acta de Junta General Ordinaria para una SL española con 3 socios. Incluye todos los requisitos legales de la LSC.' },
  { label: 'Redactar contrato NDA', icon: FileText, prompt: 'Redacta un contrato NDA bilateral completo bajo derecho español para dos empresas que van a iniciar negociaciones sobre una posible adquisición.' },
  { label: 'Análisis compliance RGPD', icon: Shield, prompt: 'Realiza un análisis de los principales obligaciones RGPD para una empresa española de e-commerce que trata datos de clientes en la UE.' },
  { label: 'Revisar cláusulas SPA', icon: Brain, prompt: 'Explica las cláusulas clave que debe contener un SPA (Sale and Purchase Agreement) para la adquisición de una SL española y los riesgos legales de cada una.' },
];

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: `Soy el **Legal AI Assistant** de Taxea — tu asesor jurídico empresarial avanzado.

Puedo ayudarte a:
- **Redactar contratos** (NDA, SPA, SHA, Servicios, Distribución, Licensing...)
- **Generar documentos societarios** (actas, convocatorias, certificaciones, poderes)
- **Analizar compliance** (RGPD, AML, Compliance Penal, Canal Denuncias)
- **Revisar cláusulas** y detectar riesgos contractuales
- **Interpretar normativa** mercantil, societaria y contractual española
- **Asistir en operaciones M&A** (DD legal, SPA, SHA, LOI)

¿En qué área legal puedo ayudarte?`,
};

export default function LegalAIAssistant() {
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
      prompt: `Eres un abogado experto en derecho mercantil, societario, contractual y compliance español. Contexto: Taxea Business OS — Legal AI Assistant.

Usuario: ${userText}

Responde de forma profesional, precisa y estructurada. Si es relevante, cita normativa española (LSC, CCom, CC, LSSI, RGPD, LGT, etc.), jurisprudencia del TS o normativa de la UE. Si generas un documento legal, usa formato profesional con secciones claramente numeradas y todas las cláusulas necesarias.`,
    });
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[800px]">
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
            <Brain className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Legal AI Assistant</h2>
            <p className="text-sm text-slate-400">IA jurídica · Contratos · Societario · Compliance · M&A</p>
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
              className="flex items-center gap-2 p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all text-left">
              <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <span className="text-xs font-medium text-slate-600">{a.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-4 mb-4">
        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={cn("flex gap-3", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Brain className="w-3.5 h-3.5 text-slate-600" />
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
            <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
              <Brain className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">{[0, 1, 2].map(d => <span key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />)}</div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 flex gap-2">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Redactar contrato, generar acta, analizar compliance, revisar cláusulas..."
          rows={2}
          className="flex-1 resize-none px-4 py-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-200 bg-white" />
        <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
          className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-sm self-end">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Brain, Send, User, RefreshCw, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  '¿Cómo se calcula la indemnización por despido improcedente?',
  '¿Cuántos días de vacaciones corresponden por convenio?',
  '¿Qué documentación necesito para un alta en la empresa?',
  '¿Cómo funciona el permiso de paternidad/maternidad?',
  '¿Qué debe incluir un plan de onboarding efectivo?',
  'Genera un checklist de offboarding completo',
  '¿Cuáles son los indicadores clave de burnout?',
  '¿Cómo diseñar un plan de evaluación 360°?',
];

export default function HRAIAssistant() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async (text) => {
    const q = text || input;
    if (!q.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un asistente de Recursos Humanos experto integrado en Taxea Business OS. 
Empresa: ${company?.nombre_comercial || company?.razon_social || 'N/A'}

Respondes en español, con profesionalidad, de forma clara y concisa (máx 250 palabras). 
Cubres: legislación laboral española, convenios, contratos, vacaciones, permisos, onboarding, offboarding, evaluaciones, desarrollo profesional, burnout, bienestar laboral, RRHH general.
Si la pregunta es sobre legislación, aclara que es orientativo y no sustituye asesoramiento legal.

Pregunta del empleado: ${q}`,
    });
    const answer = typeof res === 'string' ? res : res?.result || res?.text || 'No pude generar respuesta.';
    setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow-md">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-jakarta font-bold text-foreground">HR AI Assistant</h2>
          <p className="text-sm text-slate-400">Asistente inteligente de Recursos Humanos</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col" style={{ minHeight: 500 }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground">¿En qué puedo ayudarte?</p>
                <p className="text-sm text-slate-400 mt-1">Pregunta sobre contratos, vacaciones, onboarding, evaluaciones…</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full mt-2">
                {SUGGESTIONS.slice(0, 4).map((s, i) => (
                  <button key={i} onClick={() => send(s)}
                    className="text-left px-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Brain className="w-3.5 h-3.5 text-slate-500" />
                </div>
              )}
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-50 border border-slate-100 text-slate-700')}>
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-taxea-red flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm text-slate-400">
                Pensando…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Escribe tu pregunta…"
              className="flex-1 px-4 py-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-200 bg-slate-50" />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40 transition-all">
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            ⚠ Orientativo. No sustituye asesoramiento legal ni laboral profesional.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
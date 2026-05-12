import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Brain, Search, BookOpen, ExternalLink, Tag, Sparkles, Send, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SOURCES = [
  { id: 'boe', label: 'BOE', desc: 'Boletín Oficial del Estado', color: 'text-red-600', bg: 'bg-red-50' },
  { id: 'cendoj', label: 'CENDOJ', desc: 'Jurisprudencia TS · AN · TSJ', color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'dgt', label: 'DGT', desc: 'Consultas vinculantes', color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'teac', label: 'TEAC', desc: 'Resoluciones TEAC', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'tjue', label: 'TJUE', desc: 'Tribunal de Justicia UE', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'vlex', label: 'vLex', desc: 'Base jurídica premium', color: 'text-violet-600', bg: 'bg-violet-50' },
  { id: 'lefebvre', label: 'Lefebvre', desc: 'Memento Práctico', color: 'text-pink-600', bg: 'bg-pink-50' },
  { id: 'tirant', label: 'Tirant lo Blanch', desc: 'Biblioteca jurídica', color: 'text-slate-600', bg: 'bg-slate-100' },
];

const SAMPLE_DOCS = [
  { titulo: 'STS 1456/2024 — Regularización IVA intracomunitario', fuente: 'TS', fecha: '15/06/2024', area: 'Tributario', summary: 'La regularización de IVA en operaciones intracomunitarias debe realizarse en el período de devengo, sin posibilidad de regularización voluntaria posterior según doctrina consolidada.' },
  { titulo: 'Consulta DGT V1234-24 — Deducibilidad gastos teletrabajo', fuente: 'DGT', fecha: '12/03/2024', area: 'Tributario', summary: 'Los gastos de equipamiento en teletrabajo son deducibles en IS si existe correlación con la actividad, justificación documental y registro contable adecuado.' },
  { titulo: 'Resolución TEAC 00/2134/2023 — Op. vinculadas documentación', fuente: 'TEAC', fecha: '28/11/2023', area: 'Tributario', summary: 'La falta de documentación de operaciones vinculadas no constituye infracción si las operaciones están valoradas a mercado y así puede acreditarse.' },
  { titulo: 'SAN 234/2024 — Nulidad cláusula suelo préstamo mercantil', fuente: 'AN', fecha: '20/04/2024', area: 'Mercantil', summary: 'Las cláusulas suelo en préstamos mercantiles pueden anularse si no superan el control de incorporación y transparencia material.' },
];

const FUENTE_COLORS = {
  TS: 'bg-red-50 text-red-700 border-red-200', DGT: 'bg-amber-50 text-amber-700 border-amber-200',
  TEAC: 'bg-indigo-50 text-indigo-700 border-indigo-200', AN: 'bg-blue-50 text-blue-700 border-blue-200',
  BOE: 'bg-slate-50 text-slate-600 border-slate-200',
};

const INITIAL_MSG = {
  role: 'assistant',
  content: `Soy el **Legal Knowledge Engine** de Taxea — tu biblioteca jurídica IA viva.

Puedo ayudarte a:
- **Buscar jurisprudencia** del TS, AN, TSJ, TJUE
- **Consultas vinculantes DGT** y resoluciones TEAC/TEAR
- **Resumir sentencias** y resoluciones de forma ejecutiva
- **Comparar líneas jurisprudenciales** y evolución doctrinal
- **Generar alertas** sobre cambios normativos relevantes
- **Interpretar normativa** española y europea

Escribe tu consulta jurídica o usa la búsqueda semántica.`,
};

export default function LegalKnowledgeEngine() {
  const [messages, setMessages] = useState([INITIAL_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ia');
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto jurídico y consultor legal español con conocimiento profundo de: derecho tributario (AEAT, DGT, TEAC, TEAR, TS, AN), derecho mercantil (LSC, CCom), derecho de la UE y jurisprudencia española e internacional.

Contexto: Legal Knowledge Engine de Taxea Business OS. El usuario busca información jurídica, jurisprudencia o análisis doctrinal.

Consulta: ${userText}

Responde con: 1) Respuesta directa y precisa, 2) Referencias normativas o jurisprudenciales relevantes (con año), 3) Tendencia jurisprudencial actual si aplica. Sé específico y ejecutivo.`,
    });
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 p-6 text-white shadow-2xl">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #7c3aed, transparent 60%), radial-gradient(circle at 80% 20%, #2563eb, transparent 50%)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <Brain className="w-7 h-7 text-violet-300" />
            <div>
              <h2 className="text-2xl font-jakarta font-bold">Legal Knowledge Engine</h2>
              <p className="text-slate-300 text-sm">Biblioteca jurídica IA viva · Búsqueda semántica · Jurisprudencia · Doctrina</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['BOE', 'CENDOJ', 'DGT', 'TEAC', 'TEAR', 'TS', 'AN', 'TJUE', 'vLex', 'Lefebvre', 'Tirant', 'Westlaw'].map(s => (
              <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/8 text-slate-300 border border-white/10">{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[{ id: 'ia', label: 'IA Jurídica' }, { id: 'docs', label: 'Biblioteca' }, { id: 'fuentes', label: 'Fuentes' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all",
              activeTab === t.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'ia' && (
        <div className="flex flex-col h-[550px]">
          <div className="flex-shrink-0 flex flex-wrap gap-2 mb-3">
            {['Deducción IVA vehículos', 'Op. vinculadas IS', 'Nulidad cláusulas abusivas', 'RGPD España últimas sentencias'].map(q => (
              <button key={q} onClick={() => sendMessage(`Busca jurisprudencia y doctrina sobre: ${q}`)}
                className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 font-medium hover:border-violet-300 hover:text-violet-700 transition-colors">
                {q}
              </button>
            ))}
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
                <div className={cn("max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
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
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
              placeholder="Busca jurisprudencia, normativa, consultas DGT, resoluciones TEAC..."
              className="flex-1 px-4 py-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white" />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              className="w-12 h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white flex items-center justify-center transition-all shadow-sm">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'docs' && (
        <div className="space-y-3">
          {SAMPLE_DOCS.map((doc, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", FUENTE_COLORS[doc.fuente] || 'bg-slate-50 text-slate-600 border-slate-200')}>{doc.fuente}</span>
                <span className="text-[10px] text-slate-400">{doc.fecha}</span>
                <span className="text-[10px] font-semibold text-blue-600">{doc.area}</span>
              </div>
              <p className="text-sm font-bold text-foreground mb-1">{doc.titulo}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{doc.summary}</p>
              <button className="mt-3 text-xs font-semibold text-violet-600 flex items-center gap-1 hover:underline">
                Consultar IA <ExternalLink className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {activeTab === 'fuentes' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {SOURCES.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group text-center">
              <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-2", s.bg)}>
                <BookOpen className={cn("w-5 h-5", s.color)} />
              </div>
              <p className={cn("text-sm font-bold", s.color)}>{s.label}</p>
              <p className="text-[11px] text-slate-400 mt-1">{s.desc}</p>
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 mt-2 inline-block">Conexión futura</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
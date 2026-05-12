import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileText, Plus, Search, Brain, AlertTriangle, Clock, CheckCircle2, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const CONTRACT_TYPES = ['Todos', 'NDA', 'SPA', 'SHA', 'Servicios', 'Alquiler', 'Laboral', 'Distribución', 'Licensing', 'Préstamo', 'Software/SaaS'];

const SAMPLE = [
  { nombre: 'NDA — TechSoft SL', tipo: 'NDA', contraparte: 'TechSoft SL', estado: 'firma_pendiente', vencimiento: '2026-06-30', valor: null, riesgo: 'bajo' },
  { nombre: 'SHA — Ronda Serie A', tipo: 'SHA', contraparte: 'VC Partners Fund I', estado: 'negociacion', vencimiento: '2027-12-31', valor: '€8M', riesgo: 'alto' },
  { nombre: 'Servicios IT — Cliente Global', tipo: 'Servicios', contraparte: 'Global Corp SA', estado: 'activo', vencimiento: '2026-12-31', valor: '€180.000/año', riesgo: 'medio' },
  { nombre: 'Alquiler oficinas Madrid', tipo: 'Alquiler', contraparte: 'Inmobiliaria Centro SL', estado: 'activo', vencimiento: '2027-01-15', valor: '€4.500/mes', riesgo: 'bajo' },
  { nombre: 'Distribución exclusiva — Portugal', tipo: 'Distribución', contraparte: 'Distrib Lusitana SA', estado: 'en_revision', vencimiento: '2026-09-01', valor: '€95.000/año', riesgo: 'medio' },
];

const ESTADO_CONFIG = {
  activo: { label: 'Activo', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  firma_pendiente: { label: 'Firma pendiente', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  negociacion: { label: 'En negociación', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  en_revision: { label: 'En revisión IA', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  vencido: { label: 'Vencido', color: 'bg-red-50 text-red-700 border-red-200' },
};

export default function ContractsCenter() {
  const [tipoFilter, setTipoFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const filtered = SAMPLE.filter(c => {
    const q = search.toLowerCase();
    const matchQ = !q || `${c.nombre} ${c.contraparte} ${c.tipo}`.toLowerCase().includes(q);
    const matchT = tipoFilter === 'Todos' || c.tipo === tipoFilter;
    return matchQ && matchT;
  });

  const runAI = async (prompt) => {
    setAiLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un abogado experto en derecho contractual español e internacional. ${prompt}`,
    });
    setAiResult(res);
    setAiLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Contracts Center</h2>
            <p className="text-sm text-slate-400">NDA · SPA · SHA · Servicios · Distribución · Licensing · IA contractual</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAI(!showAI)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-all">
            <Brain className="w-3.5 h-3.5" /> IA Contratos
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo contrato
          </button>
        </div>
      </div>

      {/* AI Panel */}
      {showAI && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-semibold text-violet-800">Legal AI — Contratos</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Generar NDA', p: 'Genera un modelo de NDA bilateral estándar bajo ley española para uso empresarial B2B.' },
              { label: 'Revisar cláusulas', p: 'Explica qué cláusulas críticas debe tener un contrato de distribución exclusiva y cuáles son los riesgos legales más comunes.' },
              { label: 'Detectar riesgos', p: 'Lista los 10 principales riesgos legales en un contrato de SHA (Shareholders Agreement) para una startup en ronda Serie A.' },
              { label: 'Resumir contrato', p: 'Explica cómo debe redactarse una cláusula de limitación de responsabilidad en un contrato de servicios IT conforme al derecho español.' },
            ].map((a, i) => (
              <button key={i} onClick={() => { setAiPrompt(a.p); runAI(a.p); }}
                className="text-xs px-3 py-2 rounded-xl bg-white border border-violet-200 text-violet-700 font-medium hover:bg-violet-100 transition-colors text-left">
                {a.label}
              </button>
            ))}
          </div>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={2}
            placeholder="Describe lo que necesitas: generar un contrato, revisar cláusulas, detectar riesgos..."
            className="w-full px-3 py-2 text-sm border border-violet-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white mb-2 resize-none" />
          <button onClick={() => runAI(aiPrompt)} disabled={!aiPrompt.trim() || aiLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-all">
            {aiLoading ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Ejecutar IA
          </button>
          {aiResult && (
            <div className="mt-4 bg-white border border-violet-100 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
              {aiResult}
            </div>
          )}
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contrato, contraparte..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white" />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
          {CONTRACT_TYPES.slice(0, 6).map(t => (
            <button key={t} onClick={() => setTipoFilter(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                tipoFilter === t ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Contracts list */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          {filtered.map((c, i) => {
            const ec = ESTADO_CONFIG[c.estado] || ESTADO_CONFIG.activo;
            const isExp = expanded === i;
            return (
              <div key={i}>
                <div className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  onClick={() => setExpanded(isExp ? null : i)}>
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", c.riesgo === 'alto' ? 'bg-red-400' : c.riesgo === 'medio' ? 'bg-amber-400' : 'bg-emerald-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.nombre}</p>
                    <p className="text-xs text-slate-400">{c.contraparte} · Vence: {c.vencimiento}{c.valor ? ` · ${c.valor}` : ''}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">{c.tipo}</span>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", ec.color)}>{ec.label}</span>
                  {isExp ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                </div>
                {isExp && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="px-5 pb-4 bg-slate-50/50 border-t border-slate-50">
                    <div className="flex flex-wrap gap-2 pt-3">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 border border-violet-100 hover:bg-violet-100 transition-colors">
                        <Brain className="w-3 h-3" /> Revisar con IA
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
                        <FileText className="w-3 h-3" /> Ver documento
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition-colors">
                        <Clock className="w-3 h-3" /> Enviar a firma
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
              <FileText className="w-10 h-10" />
              <p className="text-sm text-slate-400">Sin contratos que mostrar.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
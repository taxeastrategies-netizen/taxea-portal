import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BookOpen, Search, ExternalLink, Tag, Calendar, ArrowRight } from 'lucide-react';

const SOURCES = [
  { id: 'dgt', label: 'DGT Consultas vinculantes', count: '12.400+', color: 'text-amber-600', bg: 'bg-amber-50' },
  { id: 'teac', label: 'Resoluciones TEAC', count: '45.000+', color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'tear', label: 'Resoluciones TEAR', count: '180.000+', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'ts', label: 'Tribunal Supremo (TS)', count: '8.200+', color: 'text-red-600', bg: 'bg-red-50' },
  { id: 'an', label: 'Audiencia Nacional (AN)', count: '14.000+', color: 'text-violet-600', bg: 'bg-violet-50' },
  { id: 'boe', label: 'BOE / Normativa', count: 'Actualizado', color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

const SAMPLE_RESULTS = [
  {
    titulo: 'Consulta DGT V1234-24 — Deducibilidad gastos formación empleados IS',
    fuente: 'DGT', ref: 'V1234-24', fecha: '12/03/2024', impuesto: 'IS',
    resumen: 'Los gastos de formación de empleados son deducibles en el IS cuando estén correlacionados con los ingresos de la actividad, debidamente justificados y contabilizados.',
    relevancia: 95,
  },
  {
    titulo: 'Resolución TEAC 00/2134/2023 — Op. vinculadas documentación',
    fuente: 'TEAC', ref: '00/2134/2023', fecha: '28/11/2023', impuesto: 'IS',
    resumen: 'La falta de aportación de la documentación de operaciones vinculadas no constituye per se una infracción si las operaciones están valoradas a mercado.',
    relevancia: 88,
  },
  {
    titulo: 'STS 1456/2024 — Regularización IVA intracomunitario',
    fuente: 'TS', ref: 'STS 1456/2024', fecha: '15/06/2024', impuesto: 'IVA',
    resumen: 'La regularización de IVA en operaciones intracomunitarias debe realizarse en el período en que se devengó la operación, sin posibilidad de regularización voluntaria posterior.',
    relevancia: 92,
  },
];

const FUENTE_COLORS = {
  DGT: 'bg-amber-50 text-amber-700 border-amber-200',
  TEAC: 'bg-blue-50 text-blue-700 border-blue-200',
  TS: 'bg-red-50 text-red-700 border-red-200',
  AN: 'bg-violet-50 text-violet-700 border-violet-200',
  TEAR: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export default function TaxKnowledgeBase() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(SAMPLE_RESULTS);

  const handleSearch = () => {
    if (!query.trim()) return;
    setSearching(true);
    setTimeout(() => { setSearching(false); }, 800);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-jakarta font-bold text-foreground">DGT & Base de Conocimiento Fiscal</h2>
          <p className="text-sm text-slate-400">Consultas vinculantes · TEAC · TEAR · TS · AN · BOE · Jurisprudencia IA</p>
        </div>
      </div>

      {/* Semantic search */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 shadow-xl">
        <p className="text-white text-sm font-semibold mb-3">Búsqueda semántica jurídica con IA</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Ej: gastos deducibles teletrabajo IS... o deducción IVA vehículos mixtos..."
              className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/15 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
          </div>
          <button onClick={handleSearch}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all flex items-center gap-2">
            {searching ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {['Op. vinculadas IS', 'IVA deducible vehículos', 'Reducción IRPF empresa familiar', 'Exención dividendos'].map(s => (
            <button key={s} onClick={() => setQuery(s)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white/8 text-slate-300 border border-white/10 hover:bg-white/15 transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Sources */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SOURCES.map(s => (
          <div key={s.id} className={cn("bg-white border border-slate-100 rounded-xl p-3 text-center shadow-sm hover:shadow-md cursor-pointer transition-all")}>
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2", s.bg)}>
              <BookOpen className={cn("w-4 h-4", s.color)} />
            </div>
            <p className="text-[10px] font-bold text-foreground leading-tight">{s.label}</p>
            <p className={cn("text-[10px] font-semibold mt-0.5", s.color)}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{query ? 'Resultados de búsqueda' : 'Documentos recientes'}</p>
        {results.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", FUENTE_COLORS[r.fuente] || 'bg-slate-50 text-slate-600 border-slate-200')}>{r.fuente}</span>
                <span className="text-[10px] text-slate-400 font-medium">{r.ref}</span>
                <span className="text-[10px] text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{r.fecha}</span>
                <span className="text-[10px] font-semibold text-blue-600">{r.impuesto}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{r.relevancia}% relevante</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">{r.titulo}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{r.resumen}</p>
            <div className="flex gap-2 mt-3">
              <button className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 font-medium hover:bg-blue-100 transition-colors flex items-center gap-1">
                Ver completo <ArrowRight className="w-3 h-3" />
              </button>
              <button className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-100 font-medium hover:bg-slate-100 transition-colors">
                Guardar en biblioteca
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
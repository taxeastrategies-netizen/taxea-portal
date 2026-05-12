import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Target, Plus, DollarSign, AlertTriangle, Users, Calendar } from 'lucide-react';

const FASES = ['Prospección', 'NDA', 'Term Sheet', 'Due Diligence', 'Negociación', 'Cierre'];

const DEALS = [
  { nombre: 'Adquisición TechStart SL', tipo: 'Adquisición', fase: 'Due Diligence', valoracion: 4200000, buyer: 'Taxea Group', seller: 'Fundadores TechStart', riesgo: 'medio', progreso: 65, sector: 'Tech' },
  { nombre: 'Fusión Logística Norte SA', tipo: 'Fusión', fase: 'Negociación', valoracion: 12500000, buyer: 'Taxea Logística', seller: 'Logística Norte SA', riesgo: 'alto', progreso: 82, sector: 'Logística' },
  { nombre: 'Investment Round — Serie A', tipo: 'Investment', fase: 'Term Sheet', valoracion: 8000000, buyer: 'VC Partners Fund I', seller: 'Startup B', riesgo: 'bajo', progreso: 35, sector: 'SaaS' },
  { nombre: 'Desinversión División Digital', tipo: 'Desinversión', fase: 'Prospección', valoracion: 2800000, buyer: 'Grupo Digital SA', seller: 'Taxea Group', riesgo: 'bajo', progreso: 15, sector: 'Digital' },
];

const RIESGO_COLORS = {
  alto: 'bg-red-50 text-red-700 border-red-200',
  medio: 'bg-amber-50 text-amber-700 border-amber-200',
  bajo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export default function DealPipeline() {
  const [view, setView] = useState('kanban');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
            <Target className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Deal Pipeline</h2>
            <p className="text-sm text-slate-400">Adquisiciones · Fusiones · Investment rounds · Desinversiones</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {['kanban', 'lista'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                  view === v ? "bg-white text-foreground shadow-sm" : "text-slate-500")}>
                {v}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo deal
          </button>
        </div>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Deals en pipeline', value: DEALS.length, color: 'text-violet-600' },
          { label: 'Valor total pipeline', value: fmt(DEALS.reduce((s, d) => s + d.valoracion, 0)), color: 'text-emerald-600' },
          { label: 'En Due Diligence', value: DEALS.filter(d => d.fase === 'Due Diligence').length, color: 'text-amber-600' },
          { label: 'Risk deals', value: DEALS.filter(d => d.riesgo === 'alto').length, color: 'text-red-600' },
        ].map((k, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <p className={cn("text-2xl font-jakarta font-bold", k.color)}>{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Kanban */}
      {view === 'kanban' && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-2">
            {FASES.map(fase => {
              const faseDeals = DEALS.filter(d => d.fase === fase);
              return (
                <div key={fase} className="w-64">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{fase}</p>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{faseDeals.length}</span>
                  </div>
                  <div className="space-y-3">
                    {faseDeals.map((d, i) => (
                      <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-bold text-foreground leading-snug">{d.nombre}</p>
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0", RIESGO_COLORS[d.riesgo])}>{d.riesgo}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{d.sector} · {d.tipo}</p>
                        <p className="text-base font-jakarta font-bold text-foreground">{fmt(d.valoracion)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-400 rounded-full" style={{ width: `${d.progreso}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400">{d.progreso}%</span>
                        </div>
                      </div>
                    ))}
                    {faseDeals.length === 0 && (
                      <div className="h-16 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center">
                        <p className="text-xs text-slate-300">Sin deals</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista */}
      {view === 'lista' && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {DEALS.map((d, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 cursor-pointer transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{d.nombre}</p>
                  <p className="text-xs text-slate-400">{d.tipo} · {d.sector} · Buyer: {d.buyer}</p>
                </div>
                <p className="text-sm font-bold text-foreground">{fmt(d.valoracion)}</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">{d.fase}</span>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", RIESGO_COLORS[d.riesgo])}>{d.riesgo}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
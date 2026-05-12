import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Gavel, Plus, Clock, AlertTriangle, CheckCircle2, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const PROCEDIMIENTOS = [
  { id: 1, titulo: 'Recurso alzada IVA T3/2024', organo: 'TEAR Canarias', tipo: 'Recurso alzada', estado: 'activo', cuantia: '€18.400', plazo: '15/06/2026', fase: 'Alegaciones', riesgo: 'medio' },
  { id: 2, titulo: 'Inspección IS 2021-2022', organo: 'AEAT — DCGC', tipo: 'Inspección', estado: 'activo', cuantia: '€142.000', plazo: '20/05/2026', fase: 'Acta disconformidad', riesgo: 'alto' },
  { id: 3, titulo: 'Recurso contencioso IRPF', organo: 'AN Sala 3ª', tipo: 'Contencioso', estado: 'activo', cuantia: '€8.200', plazo: '01/09/2026', fase: 'Demanda admitida', riesgo: 'medio' },
  { id: 4, titulo: 'Sanción retenciones 2023', organo: 'AEAT Canarias', tipo: 'Sanción', estado: 'resuelto', cuantia: '€2.100', plazo: '—', fase: 'Archivado', riesgo: 'bajo' },
  { id: 5, titulo: 'Resolución TEAC IS 2020', organo: 'TEAC Madrid', tipo: 'TEAC', estado: 'resuelto', cuantia: '€28.000', plazo: '—', fase: 'Estimado parcialmente', riesgo: 'bajo' },
];

const ESTADO_CONFIG = {
  activo: { label: 'Activo', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  resuelto: { label: 'Resuelto', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  suspendido: { label: 'Suspendido', color: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const RIESGO_COLORS = {
  alto: 'text-red-500',
  medio: 'text-amber-500',
  bajo: 'text-emerald-500',
};

export default function TaxLitigation() {
  const [expanded, setExpanded] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const activos = PROCEDIMIENTOS.filter(p => p.estado === 'activo').length;
  const cuantiaTotal = PROCEDIMIENTOS.filter(p => p.estado === 'activo')
    .reduce((s, p) => s + parseFloat(p.cuantia.replace('€', '').replace('.', '').replace(',', '.')), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
            <Gavel className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Tax Litigation</h2>
            <p className="text-sm text-slate-400">TEAR · TEAC · AN · TS · Recursos · Inspecciones · Sanciones</p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Nuevo procedimiento
        </button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Procedimientos activos</p>
          <p className="text-3xl font-jakarta font-bold text-red-700">{activos}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-1">Cuantía en litigio</p>
          <p className="text-3xl font-jakarta font-bold text-amber-700">€168.6K</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Próximo plazo crítico</p>
          <p className="text-3xl font-jakarta font-bold text-blue-700">20 May</p>
        </div>
      </div>

      {/* Procedimientos list */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <p className="text-sm font-semibold text-foreground">Todos los procedimientos</p>
        </div>
        <div className="divide-y divide-slate-50">
          {PROCEDIMIENTOS.map((p) => {
            const ec = ESTADO_CONFIG[p.estado] || ESTADO_CONFIG.activo;
            const isExpanded = expanded === p.id;
            return (
              <div key={p.id}>
                <div className="px-5 py-4 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : p.id)}>
                  <div className="flex items-center gap-4">
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", p.riesgo === 'alto' ? 'bg-red-400' : p.riesgo === 'medio' ? 'bg-amber-400' : 'bg-emerald-400')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.titulo}</p>
                      <p className="text-xs text-slate-400">{p.organo} · {p.tipo} · Fase: {p.fase}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">{p.cuantia}</p>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", ec.color)}>{ec.label}</span>
                      {p.plazo !== '—' && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{p.plazo}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="px-5 pb-4 bg-slate-50/50">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      {[
                        { label: 'Órgano', value: p.organo },
                        { label: 'Tipo', value: p.tipo },
                        { label: 'Cuantía', value: p.cuantia },
                        { label: 'Próximo plazo', value: p.plazo },
                      ].map(f => (
                        <div key={f.label}>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wide">{f.label}</p>
                          <p className="text-xs font-semibold text-foreground">{f.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition-colors">
                        <FileText className="w-3 h-3" /> Generar alegaciones con IA
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
                        <FileText className="w-3 h-3" /> Añadir documento
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Calculator, AlertTriangle, FileSearch, Shield, BookOpen, Brain,
  ChevronRight, TrendingUp, Clock, CheckCircle2, XCircle, Plus,
  Gavel, Building2, FileText, Calendar, Zap
} from 'lucide-react';

const MODULES = [
  { id: 'compliance', label: 'Tax Compliance', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '/law/tax/compliance', desc: 'IVA · IS · IRPF · IGIC · ROI' },
  { id: 'litigation', label: 'Tax Litigation', icon: Gavel, color: 'text-red-600', bg: 'bg-red-50', path: '/law/tax/litigation', desc: 'TEAR · TEAC · AN · TS · Recursos' },
  { id: 'inspections', label: 'Inspecciones AEAT', icon: FileSearch, color: 'text-orange-600', bg: 'bg-orange-50', path: '/law/tax/inspections', desc: 'Requerimientos · Cronología · Defensa' },
  { id: 'knowledge', label: 'DGT & Base de Conocimiento', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50', path: '/law/tax/knowledge', desc: 'Consultas vinculantes · Resoluciones · Doctrina' },
  { id: 'ai', label: 'Tax AI Assistant', icon: Brain, color: 'text-violet-600', bg: 'bg-violet-50', path: '/law/tax/ai', desc: 'IA tributaria · Recursos · Alegaciones' },
];

const SAMPLE_PROCEDURES = [
  { tipo: 'Inspección IS 2023', estado: 'activo', plazo: '15 días', riesgo: 'alto', organo: 'AEAT Canarias' },
  { tipo: 'Recurso alzada IVA T3/24', estado: 'pendiente', plazo: '2 meses', riesgo: 'medio', organo: 'TEAR Canarias' },
  { tipo: 'Consulta vinculante DGT', estado: 'resuelto', plazo: '—', riesgo: 'bajo', organo: 'DGT' },
  { tipo: 'Sanción retenciones IRPF', estado: 'activo', plazo: '10 días', riesgo: 'alto', organo: 'AEAT' },
];

const RIESGO_COLORS = {
  alto: 'bg-red-50 text-red-700 border-red-200',
  medio: 'bg-amber-50 text-amber-700 border-amber-200',
  bajo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const ESTADO_CONFIG = {
  activo: { icon: AlertTriangle, color: 'text-amber-500' },
  pendiente: { icon: Clock, color: 'text-blue-500' },
  resuelto: { icon: CheckCircle2, color: 'text-emerald-500' },
};

export default function TaxLawDashboard() {
  const navigate = useNavigate();
  const [activeRisk] = useState(2);

  const kpis = [
    { label: 'Procedimientos activos', value: activeRisk, icon: Gavel, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Riesgo fiscal estimado', value: '€142K', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Consultas DGT', value: 8, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Compliance score', value: '87%', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-600 to-orange-700 p-6 text-white shadow-xl">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #fbbf24, transparent 60%)' }} />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-5 h-5 text-amber-200" />
              <span className="text-amber-200 text-xs font-semibold uppercase tracking-widest">Tax Law</span>
            </div>
            <h2 className="text-2xl font-jakarta font-bold">Tax Law Dashboard</h2>
            <p className="text-amber-100 text-sm mt-1">Centro de inteligencia tributaria · AEAT · DGT · TEAC · TEAR · AN · TS</p>
          </div>
          <button onClick={() => navigate('/law/tax/ai')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-all backdrop-blur border border-white/20">
            <Brain className="w-3.5 h-3.5" /> Tax AI
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={cn("bg-white border rounded-2xl p-4 shadow-sm", `border-slate-100`)}>
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-3", k.bg)}>
                <Icon className={cn("w-4 h-4", k.color)} />
              </div>
              <p className="text-2xl font-jakarta font-bold text-foreground">{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Módulos */}
        <div className="lg:col-span-2 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Módulos Tax Law</p>
          {MODULES.map(mod => {
            const Icon = mod.icon;
            return (
              <button key={mod.id} onClick={() => navigate(mod.path)}
                className="w-full flex items-center gap-3 p-3.5 bg-white border border-slate-100 rounded-2xl hover:border-amber-200 hover:shadow-sm transition-all group text-left">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", mod.bg)}>
                  <Icon className={cn("w-4 h-4", mod.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{mod.label}</p>
                  <p className="text-[11px] text-slate-400">{mod.desc}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
              </button>
            );
          })}
        </div>

        {/* Procedimientos */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Procedimientos activos</p>
            <button className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
              <Plus className="w-3 h-3" /> Nuevo
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {SAMPLE_PROCEDURES.map((p, i) => {
              const EC = ESTADO_CONFIG[p.estado] || ESTADO_CONFIG.pendiente;
              const EstadoIcon = EC.icon;
              return (
                <div key={i} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors cursor-pointer">
                  <EstadoIcon className={cn("w-4 h-4 flex-shrink-0", EC.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.tipo}</p>
                    <p className="text-xs text-slate-400">{p.organo}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{p.plazo}</span>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", RIESGO_COLORS[p.riesgo])}>{p.riesgo}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Risk matrix preview */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground">Matriz de riesgo fiscal</p>
          <button onClick={() => navigate('/law/tax/compliance')} className="text-xs text-amber-600 hover:underline font-medium">Ver compliance</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Riesgo IVA', nivel: 'medio', items: ['Prorrata', 'Intracomunitarias', 'ROI/VIES'] },
            { label: 'Riesgo IS', nivel: 'alto', items: ['Op. vinculadas', 'Diferimiento', 'Reservas'] },
            { label: 'Riesgo IRPF/Retenciones', nivel: 'bajo', items: ['Modelo 111', 'Modelo 190', 'Pagos fraccionados'] },
          ].map((r, i) => (
            <div key={i} className={cn("rounded-xl p-4 border", r.nivel === 'alto' ? 'bg-red-50 border-red-100' : r.nivel === 'medio' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100')}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-foreground">{r.label}</p>
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", r.nivel === 'alto' ? 'bg-red-100 text-red-700' : r.nivel === 'medio' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                  {r.nivel.toUpperCase()}
                </span>
              </div>
              <ul className="space-y-1">
                {r.items.map(it => (
                  <li key={it} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className={cn("w-1 h-1 rounded-full flex-shrink-0", r.nivel === 'alto' ? 'bg-red-400' : r.nivel === 'medio' ? 'bg-amber-400' : 'bg-emerald-400')} />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
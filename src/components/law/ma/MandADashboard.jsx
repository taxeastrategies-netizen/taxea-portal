import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  TrendingUp, Layers, FileSearch, Lock, BarChart2, FileText,
  Brain, ChevronRight, AlertTriangle, Clock, CheckCircle2,
  DollarSign, Users, Plus, Activity, Zap, Target
} from 'lucide-react';

const MODULES = [
  { id: 'pipeline', label: 'Deal Pipeline', icon: Target, color: 'text-violet-600', bg: 'bg-violet-50', path: '/law/ma/pipeline', desc: 'Targets · Buyers · Fases · CRM M&A' },
  { id: 'due-diligence', label: 'Due Diligence', icon: FileSearch, color: 'text-blue-600', bg: 'bg-blue-50', path: '/law/ma/due-diligence', desc: 'Fiscal · Legal · Financiera · HR · Tech' },
  { id: 'data-rooms', label: 'Data Rooms', icon: Lock, color: 'text-slate-600', bg: 'bg-slate-100', path: '/law/ma/data-rooms', desc: 'Carpetas seguras · Permisos · NDA · Logs' },
  { id: 'valuation', label: 'Valuation Center', icon: BarChart2, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '/law/ma/valuation', desc: 'EBITDA · DCF · Múltiplos · Comparables' },
  { id: 'ai', label: 'M&A AI Assistant', icon: Brain, color: 'text-indigo-600', bg: 'bg-indigo-50', path: '/law/ma/ai', desc: 'DD IA · Red flags · Executive summary' },
];

const SAMPLE_DEALS = [
  { nombre: 'Adquisición TechStart SL', tipo: 'Adquisición', fase: 'Due Diligence', valoracion: '€4.2M', riesgo: 'medio', progreso: 65 },
  { nombre: 'Fusión Logística Norte SA', tipo: 'Fusión', fase: 'Negociación SPA', valoracion: '€12.5M', riesgo: 'alto', progreso: 82 },
  { nombre: 'Investment Round — Serie A', tipo: 'Investment', fase: 'Term Sheet', valoracion: '€8M', riesgo: 'bajo', progreso: 35 },
  { nombre: 'Desinversión División Digital', tipo: 'Desinversión', fase: 'Prospección', valoracion: '€2.8M', riesgo: 'bajo', progreso: 15 },
];

const FASE_COLORS = {
  'Prospección': 'bg-slate-50 text-slate-600 border-slate-200',
  'Term Sheet': 'bg-blue-50 text-blue-700 border-blue-200',
  'Due Diligence': 'bg-amber-50 text-amber-700 border-amber-200',
  'Negociación SPA': 'bg-violet-50 text-violet-700 border-violet-200',
  'Cierre': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const RIESGO_COLORS = {
  alto: 'text-red-500',
  medio: 'text-amber-500',
  bajo: 'text-emerald-500',
};

export default function MandADashboard() {
  const navigate = useNavigate();

  const kpis = [
    { label: 'Deals activos', value: 4, icon: Target, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Valoración pipeline', value: '€27.5M', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'En Due Diligence', value: 2, icon: FileSearch, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Red flags detectados', value: 3, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 to-indigo-900 p-6 text-white shadow-xl">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #a78bfa, transparent 60%)' }} />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-violet-300" />
              <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">M&A Center</span>
            </div>
            <h2 className="text-2xl font-jakarta font-bold">M&A Dashboard</h2>
            <p className="text-violet-100 text-sm mt-1">Deal Pipeline · Due Diligence · Data Rooms · Valuation · Corporate Finance</p>
          </div>
          <button onClick={() => navigate('/law/ma/ai')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all backdrop-blur border border-white/15">
            <Brain className="w-3.5 h-3.5" /> M&A AI
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
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
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Módulos M&A</p>
          {MODULES.map(mod => {
            const Icon = mod.icon;
            return (
              <button key={mod.id} onClick={() => navigate(mod.path)}
                className="w-full flex items-center gap-3 p-3.5 bg-white border border-slate-100 rounded-2xl hover:border-violet-200 hover:shadow-sm transition-all group text-left">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", mod.bg)}>
                  <Icon className={cn("w-4 h-4", mod.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{mod.label}</p>
                  <p className="text-[11px] text-slate-400">{mod.desc}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-all" />
              </button>
            );
          })}
        </div>

        {/* Deal pipeline */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Deal Pipeline</p>
            <button className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700">
              <Plus className="w-3 h-3" /> Nuevo deal
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {SAMPLE_DEALS.map((deal, i) => {
              const faseColor = FASE_COLORS[deal.fase] || 'bg-slate-50 text-slate-600 border-slate-200';
              return (
                <div key={i} className="px-5 py-4 hover:bg-slate-50/50 cursor-pointer transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{deal.nombre}</p>
                      <p className="text-xs text-slate-400">{deal.tipo} · {deal.valoracion}</p>
                    </div>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", faseColor)}>{deal.fase}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full transition-all" style={{ width: `${deal.progreso}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium w-8 text-right">{deal.progreso}%</span>
                    <AlertTriangle className={cn("w-3 h-3 flex-shrink-0", RIESGO_COLORS[deal.riesgo])} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DD Status overview */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Estado Due Diligence — Deal activo</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { area: 'Fiscal', pct: 80, color: 'bg-amber-400' },
            { area: 'Legal', pct: 60, color: 'bg-blue-400' },
            { area: 'Financiera', pct: 95, color: 'bg-emerald-400' },
            { area: 'Laboral', pct: 45, color: 'bg-violet-400' },
            { area: 'Tech', pct: 30, color: 'bg-indigo-400' },
            { area: 'Compliance', pct: 70, color: 'bg-rose-400' },
          ].map(dd => (
            <div key={dd.area} className="text-center">
              <div className="relative w-12 h-12 mx-auto mb-2">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3"
                    strokeDasharray={`${dd.pct * 0.879} 87.9`}
                    className={dd.color.replace('bg-', 'text-')} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">{dd.pct}%</span>
              </div>
              <p className="text-[11px] font-medium text-slate-600">{dd.area}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
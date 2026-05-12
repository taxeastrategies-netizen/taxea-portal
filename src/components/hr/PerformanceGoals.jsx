import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Target, CheckSquare, Star, TrendingUp, Users, BarChart2, Award, Zap } from 'lucide-react';

const TABS = [
  { id: 'objectives', label: 'Objetivos', icon: Target },
  { id: 'tasks', label: 'Tareas', icon: CheckSquare },
  { id: 'evaluations', label: 'Evaluaciones', icon: Star },
  { id: 'skills', label: 'Skills Matrix', icon: BarChart2 },
];

export default function PerformanceGoals() {
  const [tab, setTab] = useState('objectives');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
          <Target className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-xl font-jakarta font-bold text-foreground">Tasks, Goals & Performance</h2>
          <p className="text-sm text-slate-400">Objetivos, evaluaciones, competencias y productividad</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all",
                tab === t.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {tab === 'objectives' && (
        <div className="space-y-4">
          {[
            { title: 'Incrementar NPS a 85+', progress: 72, status: 'En progreso', due: '2026-06-30', owner: 'Equipo Producto', color: 'bg-blue-500' },
            { title: 'Reducir tiempo onboarding a 3 días', progress: 45, status: 'En progreso', due: '2026-07-15', owner: 'RRHH', color: 'bg-violet-500' },
            { title: 'Lanzar programa formación interna', progress: 100, status: 'Completado', due: '2026-04-30', owner: 'People', color: 'bg-emerald-500' },
            { title: 'Contratar 5 perfiles tech', progress: 60, status: 'En progreso', due: '2026-08-01', owner: 'Recruiting', color: 'bg-amber-500' },
          ].map((obj, i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-violet-500" />
                    <p className="text-sm font-semibold text-foreground">{obj.title}</p>
                  </div>
                  <p className="text-xs text-slate-400">{obj.owner} · Vence: {obj.due}</p>
                </div>
                <span className={cn("text-[11px] font-semibold px-2 py-1 rounded-full border",
                  obj.status === 'Completado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200')}>
                  {obj.status}
                </span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Progreso</span>
                  <span className="font-bold text-foreground">{obj.progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${obj.progress}%` }} transition={{ duration: 1 }}
                    className={cn("h-full rounded-full", obj.color)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-center py-16">
          <CheckSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Sistema de tareas HR próximamente.</p>
          <p className="text-xs text-slate-300 mt-1">Se conectará con el módulo general de Tareas de Taxea.</p>
        </div>
      )}

      {tab === 'evaluations' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-center py-16">
          <Star className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Evaluaciones de desempeño próximamente.</p>
          <p className="text-xs text-slate-300 mt-1">360° feedback, evaluaciones manager y autoevaluaciones.</p>
        </div>
      )}

      {tab === 'skills' && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-center py-16">
          <BarChart2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Skills Matrix próximamente.</p>
          <p className="text-xs text-slate-300 mt-1">Mapeo de competencias, desarrollo profesional y plan de carrera.</p>
        </div>
      )}
    </motion.div>
  );
}
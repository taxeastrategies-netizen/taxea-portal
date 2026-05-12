import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Shield, AlertTriangle, CheckCircle2, Plus, Users, Eye, FileText } from 'lucide-react';

const AREAS = [
  { label: 'RGPD / Protección de Datos', score: 88, alertas: 1, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'AML / KYC', score: 92, alertas: 0, icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Compliance Penal (art. 31 bis CP)', score: 75, alertas: 2, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  { label: 'Canal de Denuncias (Ley 2/2023)', score: 60, alertas: 3, icon: Users, color: 'text-red-600', bg: 'bg-red-50' },
  { label: 'PBC / Financiación Terrorismo', score: 95, alertas: 0, icon: Shield, color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'ESG & Sostenibilidad', score: 45, alertas: 2, icon: FileText, color: 'text-slate-600', bg: 'bg-slate-100' },
];

export default function ComplianceCenter() {
  const globalScore = Math.round(AREAS.reduce((s, a) => s + a.score, 0) / AREAS.length);
  const totalAlertas = AREAS.reduce((s, a) => s + a.alertas, 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Compliance Center</h2>
            <p className="text-sm text-slate-400">AML · KYC · RGPD · Canal denuncias · Compliance penal · ESG</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Nueva auditoría
        </button>
      </div>

      {/* Global score */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white flex flex-col items-center justify-center text-center">
          <div className="relative w-20 h-20 mb-3">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#334155" strokeWidth="3" />
              <circle cx="18" cy="18" r="14" fill="none"
                stroke={globalScore >= 80 ? '#10b981' : globalScore >= 60 ? '#f59e0b' : '#ef4444'}
                strokeWidth="3" strokeDasharray={`${globalScore * 0.879} 87.9`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-jakarta font-bold">{globalScore}</span>
              <span className="text-[9px] text-slate-400">/100</span>
            </div>
          </div>
          <p className="text-sm font-bold">Compliance Score</p>
          <p className="text-xs text-slate-400 mt-0.5">{totalAlertas} alertas activas</p>
        </div>
        <div className="sm:col-span-2 grid grid-cols-2 gap-3">
          {[
            { label: 'Áreas en regla', value: AREAS.filter(a => a.alertas === 0).length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
            { label: 'Alertas activas', value: totalAlertas, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
            { label: 'Revisión pendiente', value: AREAS.filter(a => a.score < 70).length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
            { label: 'Áreas monitorizadas', value: AREAS.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          ].map((k, i) => (
            <div key={i} className={cn("bg-white border rounded-xl p-3", k.bg)}>
              <p className={cn("text-2xl font-jakarta font-bold", k.color)}>{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Areas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {AREAS.map((area, i) => {
          const Icon = area.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", area.bg)}>
                  <Icon className={cn("w-4 h-4", area.color)} />
                </div>
                {area.alertas > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                    {area.alertas} alerta{area.alertas !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-foreground mb-2">{area.label}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", area.score >= 80 ? 'bg-emerald-400' : area.score >= 60 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${area.score}%` }} />
                </div>
                <span className="text-xs font-bold text-foreground">{area.score}%</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Recommended actions */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Plan de acción compliance — IA Recomendaciones</p>
        <div className="space-y-3">
          {[
            { area: 'Canal de Denuncias', accion: 'Implementar canal digital conforme Ley 2/2023 (obligatorio desde 1/12/2023)', prioridad: 'urgente' },
            { area: 'Compliance Penal', accion: 'Revisar y actualizar el Modelo de Prevención de Delitos conforme al art. 31 bis CP', prioridad: 'alta' },
            { area: 'RGPD', accion: 'Actualizar Registro de Actividades de Tratamiento (RAT) con nuevas categorías de datos', prioridad: 'media' },
            { area: 'ESG', accion: 'Iniciar proceso de diagnóstico para CSRD/NFRD si empresa supera umbrales legales', prioridad: 'media' },
          ].map((a, i) => (
            <div key={i} className={cn("flex items-start gap-3 p-3 rounded-xl border",
              a.prioridad === 'urgente' ? 'bg-red-50 border-red-100' : a.prioridad === 'alta' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100')}>
              <AlertTriangle className={cn("w-4 h-4 flex-shrink-0 mt-0.5", a.prioridad === 'urgente' ? 'text-red-500' : a.prioridad === 'alta' ? 'text-amber-500' : 'text-slate-400')} />
              <div>
                <p className="text-xs font-bold text-foreground">[{a.area}] {a.accion}</p>
              </div>
              <span className={cn("ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase",
                a.prioridad === 'urgente' ? 'bg-red-100 text-red-600' : a.prioridad === 'alta' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500')}>
                {a.prioridad}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
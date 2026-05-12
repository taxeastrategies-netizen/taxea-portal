import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Shield, CheckCircle2, AlertTriangle, XCircle, Plus, RefreshCw, Download } from 'lucide-react';

const COMPLIANCE_AREAS = [
  { label: 'IVA / IGIC', score: 92, estado: 'ok', alertas: 0, modelos: ['303', '390', '349', '360'] },
  { label: 'Impuesto Sociedades', score: 78, estado: 'alerta', alertas: 2, modelos: ['200', '202', '220'] },
  { label: 'IRPF Retenciones', score: 95, estado: 'ok', alertas: 0, modelos: ['111', '115', '190', '180'] },
  { label: 'Intracomunitarias / ROI', score: 65, estado: 'riesgo', alertas: 3, modelos: ['349', '303', 'VIES'] },
  { label: 'DAC7 / CRS / FATCA', score: 88, estado: 'ok', alertas: 0, modelos: ['DAC7', 'CRS', 'FATCA'] },
  { label: 'Op. Vinculadas (IS)', score: 55, estado: 'riesgo', alertas: 4, modelos: ['232', 'Doc. Precios'] },
];

const ESTADO_CONFIG = {
  ok: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Correcto' },
  alerta: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Alerta' },
  riesgo: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Riesgo alto' },
};

export default function TaxCompliance() {
  const [selected, setSelected] = useState(null);

  const overallScore = Math.round(COMPLIANCE_AREAS.reduce((s, a) => s + a.score, 0) / COMPLIANCE_AREAS.length);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Tax Compliance</h2>
            <p className="text-sm text-slate-400">Matrices de riesgo · Cumplimiento fiscal · Monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>
      </div>

      {/* Global score */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl flex items-center gap-8">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#334155" strokeWidth="3" />
            <circle cx="18" cy="18" r="14" fill="none" stroke={overallScore >= 80 ? '#10b981' : overallScore >= 65 ? '#f59e0b' : '#ef4444'}
              strokeWidth="3" strokeDasharray={`${overallScore * 0.879} 87.9`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-jakarta font-bold">{overallScore}</span>
            <span className="text-[9px] text-slate-400">/ 100</span>
          </div>
        </div>
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-1">Tax Compliance Score Global</p>
          <p className="text-3xl font-jakarta font-bold">{overallScore >= 80 ? 'Cumplimiento alto' : overallScore >= 65 ? 'Riesgo moderado' : 'Riesgo elevado'}</p>
          <p className="text-slate-300 text-sm mt-1">{COMPLIANCE_AREAS.filter(a => a.estado !== 'ok').length} área{COMPLIANCE_AREAS.filter(a => a.estado !== 'ok').length !== 1 ? 's' : ''} requiere atención inmediata</p>
        </div>
      </div>

      {/* Areas grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {COMPLIANCE_AREAS.map((area, i) => {
          const ec = ESTADO_CONFIG[area.estado];
          const Icon = ec.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              onClick={() => setSelected(selected === i ? null : i)}
              className={cn("bg-white border rounded-2xl p-5 shadow-sm cursor-pointer transition-all hover:shadow-md",
                selected === i ? "border-taxea-red ring-2 ring-taxea-red/10" : "border-slate-100")}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-bold text-foreground">{area.label}</p>
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", ec.bg)}>
                  <Icon className={cn("w-4 h-4", ec.color)} />
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", area.score >= 80 ? 'bg-emerald-400' : area.score >= 65 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${area.score}%` }} />
                </div>
                <span className="text-xs font-bold text-foreground w-8 text-right">{area.score}%</span>
              </div>
              {area.alertas > 0 && (
                <p className="text-[11px] text-red-500 font-medium">{area.alertas} alerta{area.alertas !== 1 ? 's' : ''} activa{area.alertas !== 1 ? 's' : ''}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {area.modelos.map(m => (
                  <span key={m} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-100">{m}</span>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pending actions */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Acciones recomendadas por IA</p>
        <div className="space-y-3">
          {[
            { accion: 'Revisar documentación precios de transferencia IS 2023', urgencia: 'alta', impacto: 'Riesgo estimado €35K' },
            { accion: 'Verificar operaciones ROI/VIES pendientes de declaración', urgencia: 'alta', impacto: '3 operaciones sin declarar' },
            { accion: 'Actualizar documentación DPT para grupo vinculado', urgencia: 'media', impacto: 'Sanción potencial €6K' },
            { accion: 'Revisar prorrata definitiva IVA ejercicio 2025', urgencia: 'baja', impacto: 'Regularización positiva estimada' },
          ].map((a, i) => (
            <div key={i} className={cn("flex items-start gap-3 p-3 rounded-xl border",
              a.urgencia === 'alta' ? 'bg-red-50 border-red-100' : a.urgencia === 'media' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100')}>
              <AlertTriangle className={cn("w-4 h-4 flex-shrink-0 mt-0.5", a.urgencia === 'alta' ? 'text-red-500' : a.urgencia === 'media' ? 'text-amber-500' : 'text-slate-400')} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground">{a.accion}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{a.impacto}</p>
              </div>
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase",
                a.urgencia === 'alta' ? 'bg-red-100 text-red-600' : a.urgencia === 'media' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500')}>
                {a.urgencia}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
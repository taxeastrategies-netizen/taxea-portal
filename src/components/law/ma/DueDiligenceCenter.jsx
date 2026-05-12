import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileSearch, AlertTriangle, CheckCircle2, Circle, Brain, Download, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const DD_AREAS = [
  {
    area: 'Fiscal', icon: '💼', progress: 80, status: 'en_curso',
    items: [
      { label: 'Análisis últimas 4 declaraciones IS', done: true },
      { label: 'Revisión IVA intracomunitario', done: true },
      { label: 'Op. vinculadas documentación', done: false, flag: true },
      { label: 'Contingencias AEAT históricas', done: false },
    ]
  },
  {
    area: 'Legal', icon: '⚖️', progress: 60, status: 'en_curso',
    items: [
      { label: 'Revisión contratos clave', done: true },
      { label: 'Litigios activos y pasivos', done: false, flag: true },
      { label: 'Propiedad intelectual registrada', done: true },
      { label: 'Compliance RGPD', done: false },
    ]
  },
  {
    area: 'Financiera', icon: '📊', progress: 95, status: 'completado',
    items: [
      { label: 'Cuentas anuales 3 ejercicios', done: true },
      { label: 'Análisis WC y deuda', done: true },
      { label: 'Proyecciones financieras', done: true },
      { label: 'Revisión activos fijos', done: true },
    ]
  },
  {
    area: 'Laboral', icon: '👥', progress: 45, status: 'pendiente',
    items: [
      { label: 'Plantilla y estructura salarial', done: true },
      { label: 'Convenio colectivo aplicable', done: false },
      { label: 'Litigios laborales activos', done: false },
      { label: 'Seguridad Social al corriente', done: false },
    ]
  },
  {
    area: 'Tecnológica', icon: '💻', progress: 30, status: 'pendiente',
    items: [
      { label: 'Inventario sistemas y licencias', done: true },
      { label: 'Ciberseguridad y auditoría', done: false },
      { label: 'Deuda técnica estimada', done: false },
      { label: 'Propiedad código fuente', done: false },
    ]
  },
  {
    area: 'Compliance', icon: '🛡️', progress: 70, status: 'en_curso',
    items: [
      { label: 'AML/KYC revisión', done: true },
      { label: 'Canal denuncias activo', done: true },
      { label: 'Compliance penal actualizado', done: false },
      { label: 'Sanciones regulatorias', done: false },
    ]
  },
];

const STATUS_CONFIG = {
  completado: { label: 'Completado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  en_curso: { label: 'En curso', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  pendiente: { label: 'Pendiente', color: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export default function DueDiligenceCenter() {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  const generateSummary = async () => {
    setAiLoading(true);
    const flags = DD_AREAS.flatMap(a => a.items.filter(i => i.flag).map(i => `[${a.area}] ${i.label}`));
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Genera un Executive Summary de Due Diligence profesional en formato de informe ejecutivo para M&A. 
      
Progreso general por área: ${DD_AREAS.map(a => `${a.area} (${a.progress}%)`).join(', ')}.

Red flags detectados: ${flags.join('; ')}.

El informe debe incluir: 1) Resumen ejecutivo, 2) Estado general de la DD, 3) Red flags críticos y recomendaciones, 4) Próximos pasos. Formato ejecutivo profesional.`,
    });
    setAiSummary(res);
    setAiLoading(false);
  };

  const totalProgress = Math.round(DD_AREAS.reduce((s, a) => s + a.progress, 0) / DD_AREAS.length);
  const redFlags = DD_AREAS.flatMap(a => a.items.filter(i => i.flag)).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Due Diligence Center</h2>
            <p className="text-sm text-slate-400">Fiscal · Legal · Financiera · Laboral · Tech · Compliance</p>
          </div>
        </div>
        <button onClick={generateSummary} disabled={aiLoading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-all shadow-sm">
          {aiLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Brain className="w-4 h-4" />}
          Generar Executive Summary IA
        </button>
      </div>

      {/* Summary bar */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">Progreso global DD</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />{redFlags} red flag{redFlags !== 1 ? 's' : ''}
            </span>
            <span className="text-lg font-jakarta font-bold text-foreground">{totalProgress}%</span>
          </div>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${totalProgress}%` }} transition={{ duration: 1 }}
            className={cn("h-full rounded-full", totalProgress >= 80 ? 'bg-emerald-400' : totalProgress >= 50 ? 'bg-amber-400' : 'bg-red-400')} />
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">Executive Summary — Generado por IA</p>
            <button className="text-xs font-semibold text-violet-700 flex items-center gap-1 hover:underline">
              <Download className="w-3 h-3" /> Exportar
            </button>
          </div>
          <div className="bg-white rounded-xl p-4 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {aiSummary}
          </div>
        </div>
      )}

      {/* DD Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DD_AREAS.map((area, i) => {
          const sc = STATUS_CONFIG[area.status];
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{area.icon}</span>
                  <p className="text-sm font-bold text-foreground">{area.area}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{area.progress}%</span>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", sc.color)}>{sc.label}</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
                <div className={cn("h-full rounded-full", area.progress >= 80 ? 'bg-emerald-400' : area.progress >= 50 ? 'bg-amber-400' : 'bg-red-400')}
                  style={{ width: `${area.progress}%` }} />
              </div>
              <div className="space-y-2">
                {area.items.map((item, j) => (
                  <div key={j} className="flex items-center gap-2">
                    {item.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                    <span className={cn("text-xs flex-1", item.done ? 'text-slate-600 line-through' : 'text-slate-700')}>{item.label}</span>
                    {item.flag && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronLeft, FileText, BarChart2, TrendingUp, BookOpen, Layers, Info } from 'lucide-react';

const IMPORT_TYPES = [
  {
    id: 'dat',
    icon: '📊',
    label: 'A3 .dat',
    sublabel: 'Vía principal',
    desc: 'Diario contable, mayor o balance exportado desde A3 Asesor, A3 ERP o A3CON en formato .dat',
    badge: 'Recomendado',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    border: 'border-emerald-300',
    bg: 'bg-emerald-50/30',
  },
  {
    id: 'excel_balance',
    icon: '📋',
    label: 'Excel — Balance',
    sublabel: 'Balance de sumas y saldos',
    desc: 'Archivo Excel con estructura de activo, pasivo y patrimonio neto. Saldos por cuenta.',
    badge: 'Excel',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    border: 'border-blue-200',
    bg: '',
  },
  {
    id: 'excel_pyg',
    icon: '📈',
    label: 'Excel — PyG',
    sublabel: 'Pérdidas y ganancias',
    desc: 'Archivo Excel con la cuenta de resultados: ingresos, gastos, márgenes y resultado del ejercicio.',
    badge: 'Excel',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    border: 'border-blue-200',
    bg: '',
  },
  {
    id: 'excel_diario',
    icon: '📒',
    label: 'Excel — Diario',
    sublabel: 'Libro diario / Mayor',
    desc: 'Archivo Excel con apuntes contables: fecha, cuenta, debe, haber. El más completo para análisis operativo.',
    badge: 'Excel',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    border: 'border-blue-200',
    bg: '',
  },
  {
    id: 'excel_combined',
    icon: '🗂️',
    label: 'Importación combinada',
    sublabel: 'Balance + PyG + Diario',
    desc: 'Sube uno, dos o tres archivos Excel para cruzar información y generar un análisis más completo y validado.',
    badge: 'Análisis cruzado',
    badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
    border: 'border-violet-200',
    bg: 'bg-violet-50/20',
  },
];

export default function ImportSelector({ onSelect, onCancel }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">Selecciona el tipo de importación</h2>
          <p className="text-xs text-slate-400">Elige el formato de tu exportación contable para comenzar</p>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <strong>Análisis preliminar basado en los datos importados.</strong> No constituye auditoría ni validación fiscal definitiva. Las conclusiones dependen de la calidad y completitud del archivo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {IMPORT_TYPES.map(t => (
          <button key={t.id} onClick={() => onSelect(t.id)}
            className={cn("p-5 rounded-2xl border-2 text-left transition-all hover:shadow-md group", t.border || 'border-slate-200', t.bg || 'bg-white')}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{t.icon}</span>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", t.badgeColor)}>{t.badge}</span>
            </div>
            <p className="text-sm font-bold text-foreground">{t.label}</p>
            <p className="text-xs text-slate-500 font-medium mb-2">{t.sublabel}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
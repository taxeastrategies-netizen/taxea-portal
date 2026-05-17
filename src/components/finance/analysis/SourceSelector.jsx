import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronLeft, Info } from 'lucide-react';

const SOURCES = [
  {
    group: 'PDF — Vía principal recomendada',
    groupColor: 'text-blue-700',
    items: [
      { id: 'pdf_auto',     emoji: '📄', label: 'PDF Balance / PyG',      sublabel: 'Detección automática', desc: 'Sube un PDF digital o escaneado. La IA detecta si contiene Balance, PyG o ambos, y extrae las cifras.', badge: 'Recomendado', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200', border: 'border-blue-300', bg: 'bg-blue-50/20' },
      { id: 'pdf_combined', emoji: '🗂️', label: 'PDF Balance + PyG',       sublabel: 'Combinado en un PDF',  desc: 'PDF con balance de situación y cuenta de resultados en el mismo archivo. Extracción cruzada.', badge: 'PDF múltiple', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200', border: 'border-blue-200', bg: '' },
    ],
  },
  {
    group: 'Excel — Complementario o alternativo',
    groupColor: 'text-emerald-700',
    items: [
      { id: 'excel_balance',  emoji: '📋', label: 'Excel Balance',           sublabel: 'Balance de sumas y saldos', desc: 'Hoja Excel con activo, pasivo y patrimonio.', badge: 'Excel', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: 'border-emerald-200', bg: '' },
      { id: 'excel_pyg',      emoji: '📈', label: 'Excel PyG',               sublabel: 'Pérdidas y ganancias',      desc: 'Hoja Excel con ingresos, gastos y resultado.', badge: 'Excel', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: 'border-emerald-200', bg: '' },
      { id: 'excel_combined', emoji: '📊', label: 'Excel Balance + PyG + Diario', sublabel: 'Importación combinada', desc: 'Sube uno, dos o los tres Excel. El análisis se adapta y cruza los datos.', badge: 'Análisis cruzado', badgeColor: 'bg-violet-50 text-violet-700 border-violet-200', border: 'border-violet-200', bg: 'bg-violet-50/20' },
    ],
  },
  {
    group: 'A3 .dat — Exportación contable',
    groupColor: 'text-slate-600',
    items: [
      { id: 'dat', emoji: '🗄️', label: 'A3 .dat', sublabel: 'Diario / Mayor / Balance', desc: 'Archivo .dat exportado desde A3 Asesor, A3 ERP o A3CON. Parser multi-estrategia con diagnóstico de líneas.', badge: 'A3', badgeColor: 'bg-slate-100 text-slate-600 border-slate-200', border: 'border-slate-200', bg: '' },
    ],
  },
];

export default function SourceSelector({ onSelect, onCancel }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <h2 className="text-lg font-jakarta font-bold text-foreground">¿Qué documentos tienes disponibles?</h2>
          <p className="text-xs text-slate-400">Elige el formato. Si tienes PDF, empieza por ahí — es la vía más directa.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <strong>¿Tu .dat no se interpreta bien?</strong> Prueba con el PDF del balance o PyG, o con el Excel. El sistema puede trabajar con cualquier fuente y combinarlas.
        </p>
      </div>

      <div className="space-y-6">
        {SOURCES.map((group) => (
          <div key={group.group}>
            <p className={cn("text-xs font-bold uppercase tracking-widest mb-3", group.groupColor)}>{group.group}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.items.map(t => (
                <button key={t.id} onClick={() => onSelect(t.id)}
                  className={cn("p-5 rounded-2xl border-2 text-left transition-all hover:shadow-md group", t.border, t.bg || 'bg-white')}>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{t.emoji}</span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", t.badgeColor)}>{t.badge}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{t.label}</p>
                  <p className="text-xs text-slate-500 font-medium mb-2">{t.sublabel}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
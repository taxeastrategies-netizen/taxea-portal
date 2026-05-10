import { Zap } from 'lucide-react';

const PREGUNTAS_SUGERIDAS = [
  { texto: '¿Qué gastos puedo deducirme?', icono: '💡' },
  { texto: '¿Cuándo tengo que presentar el IVA?', icono: '📅' },
  { texto: '¿Es deducible el portátil?', icono: '💻' },
  { texto: '¿Qué es el modelo 130?', icono: '📋' },
  { texto: '¿Puedo deducirme el home office?', icono: '🏠' },
  { texto: '¿Cuánto tiempo guardo las facturas?', icono: '🗂️' },
  { texto: '¿Tengo que retener IRPF?', icono: '📊' },
  { texto: '¿Qué diferencia hay entre IVA e IGIC?', icono: '🏝️' },
];

export default function SugerenciasRapidas({ onSelect }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Consultas frecuentes</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {PREGUNTAS_SUGERIDAS.map((p, i) => (
          <button
            key={i}
            onClick={() => onSelect(p.texto)}
            className="flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg border border-border/60 hover:border-primary/30 hover:bg-accent/40 transition-all text-sm text-foreground group"
          >
            <span className="text-base leading-none flex-shrink-0">{p.icono}</span>
            <span className="group-hover:text-primary transition-colors">{p.texto}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
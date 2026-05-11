const SUGERENCIAS = [
  { emoji: '🏢', texto: '¿Cuándo tengo que darme de alta como autónomo?' },
  { emoji: '📊', texto: '¿Qué gastos puedo deducir como autónomo?' },
  { emoji: '📄', texto: '¿Cuándo se presenta el modelo 303 de IVA?' },
  { emoji: '🏝️', texto: '¿Qué diferencia hay entre IVA e IGIC en Canarias?' },
  { emoji: '🚗', texto: '¿El vehículo es deducible para un autónomo?' },
  { emoji: '🏠', texto: '¿Puedo deducir gastos si trabajo desde casa?' },
  { emoji: '💻', texto: '¿Puedo deducir el software y suscripciones digitales?' },
  { emoji: '📱', texto: '¿Puedo deducir el teléfono móvil?' },
  { emoji: '📅', texto: '¿Cuándo presento el modelo 130 de IRPF?' },
  { emoji: '🧾', texto: '¿Qué debe contener una factura correcta?' },
  { emoji: '🌍', texto: '¿Cómo facturo a una empresa de la Unión Europea?' },
  { emoji: '🤝', texto: '¿Qué es el REPEP en Canarias y quién puede acogerse?' },
];

export default function SugerenciasRapidas({ onSelect }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">Preguntas frecuentes:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {SUGERENCIAS.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(s.texto)}
            className="flex items-start gap-2 text-left text-xs px-3 py-2 rounded-lg border border-border/60 bg-card hover:bg-accent hover:border-primary/30 hover:text-primary transition-all group"
          >
            <span className="text-sm flex-shrink-0 mt-0.5">{s.emoji}</span>
            <span className="text-muted-foreground group-hover:text-primary leading-snug">{s.texto}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
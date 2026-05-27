import { Clock } from 'lucide-react';

export default function ImpuestosComingSoon({ tab }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Clock className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{tab || 'Sección'} — Próximamente</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Esta sección está planificada para la siguiente fase de implementación.
      </p>
    </div>
  );
}
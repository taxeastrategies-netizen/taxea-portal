import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

const CONFIG = {
  verde: {
    icon: CheckCircle,
    label: 'Todo correcto',
    description: 'Tu documentación está revisada y no hay incidencias relevantes.',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    dot: 'bg-green-500',
    ring: 'ring-green-200',
  },
  amarillo: {
    icon: AlertTriangle,
    label: 'Atención requerida',
    description: 'Faltan documentos o hay elementos pendientes de revisión.',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
  },
  rojo: {
    icon: XCircle,
    label: 'Urgente',
    description: 'Hay incidencias urgentes o vencimientos próximos que requieren actuación inmediata.',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    dot: 'bg-red-500',
    ring: 'ring-red-200',
  },
  gris: {
    icon: Clock,
    label: 'Sin datos',
    description: 'Pendiente de configuración o sin actividad registrada.',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    ring: 'ring-slate-200',
  },
};

export default function EstadoFiscal({ estado = 'gris', compact = false }) {
  const cfg = CONFIG[estado] || CONFIG.gris;
  const Icon = cfg.icon;

  if (compact) {
    return (
      <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium text-sm", cfg.bg, cfg.border, cfg.text)}>
        <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
        {cfg.label}
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border-2 p-5 flex items-start gap-4", cfg.bg, cfg.border)}>
      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center ring-4 flex-shrink-0", cfg.bg, cfg.ring)}>
        <Icon className={cn("w-6 h-6", cfg.text)} />
      </div>
      <div>
        <p className="font-jakarta font-bold text-foreground text-base">Estado fiscal actual</p>
        <p className={cn("font-semibold text-lg mt-0.5", cfg.text)}>{cfg.label}</p>
        <p className="text-sm text-muted-foreground mt-1">{cfg.description}</p>
      </div>
    </div>
  );
}
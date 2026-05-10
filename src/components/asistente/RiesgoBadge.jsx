import { cn } from '@/lib/utils';
import { Shield, AlertTriangle, ShieldAlert } from 'lucide-react';

const config = {
  verde: {
    label: 'Consulta general',
    icon: Shield,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  amarillo: {
    label: 'Revisar circunstancias',
    icon: AlertTriangle,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  rojo: {
    label: 'Requiere asesor',
    icon: ShieldAlert,
    className: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
};

export default function RiesgoBadge({ nivel, compact = false }) {
  const c = config[nivel] || config.verde;
  const Icon = c.icon;

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', c.className)}>
        <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
        {c.label}
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium', c.className)}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{c.label}</span>
    </div>
  );
}
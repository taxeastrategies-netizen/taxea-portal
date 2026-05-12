import { motion } from 'framer-motion';
import { Heart, Flame, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export default function SurvivalMode({ financials }) {
  const { cashDisponible, burnRate, runway, cobrosPendientes } = financials;

  const runwayMonths = runway || 0;
  const runwayDays = Math.round(runwayMonths * 30);

  const level =
    runwayMonths >= 6 ? 'stable' :
    runwayMonths >= 3 ? 'caution' :
    runwayMonths >= 1 ? 'warning' : 'critical';

  const levelConfig = {
    stable: {
      label: 'Zona Segura',
      sub: 'Liquidez suficiente para operar con estabilidad',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/25',
      bar: 'bg-emerald-500',
      pct: Math.min(100, (runwayMonths / 12) * 100),
    },
    caution: {
      label: 'Precaución',
      sub: 'Liquidez moderada. Monitoriza cobros activamente',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/25',
      bar: 'bg-amber-500',
      pct: Math.min(100, (runwayMonths / 6) * 100),
    },
    warning: {
      label: 'Alerta',
      sub: 'Liquidez baja. Actúa inmediatamente para evitar tensión',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/25',
      bar: 'bg-orange-500',
      pct: Math.min(100, (runwayMonths / 3) * 100),
    },
    critical: {
      label: 'Crítico',
      sub: 'Cash insuficiente. Riesgo inminente de insolvencia operativa',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/25',
      bar: 'bg-red-500',
      pct: Math.max(5, runwayMonths * 10),
    },
  };

  const cfg = levelConfig[level];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("rounded-2xl p-5 border", cfg.bg, cfg.border)}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Heart className={cn("w-4 h-4", cfg.color)} />
        <h3 className="text-sm font-semibold text-white">Survival Mode</h3>
        <span className={cn("ml-auto text-xs font-bold px-2.5 py-1 rounded-lg border", cfg.color, cfg.bg, cfg.border)}>
          {cfg.label}
        </span>
      </div>

      {/* Big runway number */}
      <div className="text-center py-4">
        <p className="text-5xl font-jakarta font-black tracking-tight" style={{ color: cfg.color === 'text-emerald-400' ? '#10b981' : cfg.color === 'text-amber-400' ? '#f59e0b' : cfg.color === 'text-orange-400' ? '#f97316' : '#ef4444' }}>
          {runwayMonths > 0 ? runwayMonths.toFixed(1) : '< 1'}
        </p>
        <p className="text-xs text-white/35 mt-1 font-medium">meses de runway</p>
        <p className="text-xs text-white/25 mt-0.5">{runwayDays > 0 ? `≈ ${runwayDays} días` : 'Sin datos suficientes'}</p>
      </div>

      {/* Survival bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-white/30 mb-1.5">
          <span>0</span>
          <span>3m</span>
          <span>6m</span>
          <span>12m+</span>
        </div>
        <div className="h-2 bg-white/6 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${cfg.pct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={cn("h-full rounded-full", cfg.bar)}
          />
        </div>
      </div>

      <p className="text-xs text-white/40 text-center leading-relaxed">{cfg.sub}</p>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-white/4 rounded-xl p-3 border border-white/6">
          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Cash actual</p>
          <p className="text-sm font-bold text-white">{fmt(cashDisponible)}</p>
        </div>
        <div className="bg-white/4 rounded-xl p-3 border border-white/6">
          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">Burn rate / mes</p>
          <p className="text-sm font-bold text-white">{fmt(burnRate)}</p>
        </div>
      </div>
    </motion.div>
  );
}
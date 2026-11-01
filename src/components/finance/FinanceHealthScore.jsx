import { motion } from 'framer-motion';
import { Shield, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

import { deriveFinanceHealth } from '@/lib/financeSignals.mjs';

export default function FinanceHealthScore({ financials }) {
  const health = deriveFinanceHealth(financials);
  const score = health.score;
  const pct = score === null ? 0 : score / 100;

  const config = score === null ? { label: 'Lectura parcial: faltan fuentes', color: 'text-muted-foreground', ring: '#94a3b8', bg: 'bg-secondary', icon: Minus } : score >= 75
    ? { label: 'Señales favorables en datos registrados', color: 'text-emerald-600', ring: '#10b981', bg: 'bg-emerald-500/10', icon: TrendingUp }
    : score >= 50
      ? { label: 'Hay indicadores que revisar', color: 'text-amber-600', ring: '#f59e0b', bg: 'bg-amber-500/10', icon: Minus }
      : { label: 'Atención a los indicadores observados', color: 'text-red-500', ring: '#ef4444', bg: 'bg-red-500/10', icon: TrendingDown };

  const Icon = config.icon;

  // SVG circle params
  const r = 40;
  const cx = 54;
  const cy = 54;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Seguimiento financiero</h3>
          <p className="text-xs text-muted-foreground">Cobertura {health.coverage}% · resultado, saldo y vencimientos</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Ring */}
        <div className="relative flex-shrink-0">
          <svg width="108" height="108" viewBox="0 0 108 108">
            {/* Background circle */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
            {/* Progress circle */}
            <motion.circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={config.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
              style={{ transformOrigin: `${cx}px ${cy}px`, transform: 'rotate(-90deg)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-2xl font-jakarta font-bold", config.color)}>{score ?? '—'}</span>
            <span className="text-[10px] text-muted-foreground font-medium">{score === null ? 'sin datos completos' : '/100'}</span>
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1">
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg inline-flex mb-2", config.bg)}>
            <Icon className={cn("w-3.5 h-3.5", config.color)} />
            <span className={cn("text-xs font-semibold", config.color)}>{config.label}</span>
          </div>

          <div className="space-y-1.5 mt-2">
            {health.dimensions.map(bar => (
              <div key={bar.label}>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] text-muted-foreground">{bar.label}</span>
                  <span className="text-[10px] text-muted-foreground">{bar.known ? `${Math.round(bar.score)}%` : 'N/D'}</span>
                </div>
                <div className="h-1 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${bar.known ? bar.score : 0}%` }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="h-full rounded-full"
                    style={{ background: bar.known ? '#3b82f6' : '#94a3b8' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

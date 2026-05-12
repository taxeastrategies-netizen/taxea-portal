import { motion } from 'framer-motion';
import { Shield, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

function calcScore(financials) {
  let score = 50;
  const { margenNeto, runway, dso, ingresosDelta, vencidas, workingCapital, burnRate, totalIngresos } = financials;

  // Margin
  if (margenNeto > 20) score += 15;
  else if (margenNeto > 10) score += 8;
  else if (margenNeto > 0) score += 3;
  else score -= 10;

  // Runway
  if (runway === null) {}
  else if (runway > 12) score += 15;
  else if (runway > 6) score += 8;
  else if (runway > 3) score += 3;
  else score -= 15;

  // DSO
  if (dso < 30) score += 10;
  else if (dso < 45) score += 5;
  else if (dso > 60) score -= 10;
  else score -= 5;

  // Ingresos trend
  if (ingresosDelta > 10) score += 8;
  else if (ingresosDelta > 0) score += 4;
  else if (ingresosDelta < -15) score -= 12;
  else if (ingresosDelta < -5) score -= 6;

  // Vencidas
  if (vencidas.length === 0) score += 5;
  else if (vencidas.length > 3) score -= 8;
  else score -= 3;

  // Working capital
  if (workingCapital > 0) score += 5;
  else score -= 5;

  // Burn rate
  if (totalIngresos > 0 && burnRate < totalIngresos * 0.6) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export default function FinanceHealthScore({ financials }) {
  const score = calcScore(financials);
  const pct = score / 100;

  const config = score >= 75
    ? { label: 'Salud financiera sólida', color: 'text-emerald-600', ring: '#10b981', bg: 'bg-emerald-500/10', icon: TrendingUp }
    : score >= 50
      ? { label: 'Salud financiera moderada', color: 'text-amber-600', ring: '#f59e0b', bg: 'bg-amber-500/10', icon: Minus }
      : { label: 'Salud financiera en riesgo', color: 'text-red-500', ring: '#ef4444', bg: 'bg-red-500/10', icon: TrendingDown };

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
          <h3 className="text-sm font-semibold text-foreground">Financial Health Score</h3>
          <p className="text-xs text-muted-foreground">Puntuación de salud financiera</p>
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
            <span className={cn("text-2xl font-jakarta font-bold", config.color)}>{score}</span>
            <span className="text-[10px] text-muted-foreground font-medium">/100</span>
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1">
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg inline-flex mb-2", config.bg)}>
            <Icon className={cn("w-3.5 h-3.5", config.color)} />
            <span className={cn("text-xs font-semibold", config.color)}>{config.label}</span>
          </div>

          <div className="space-y-1.5 mt-2">
            {[
              { label: 'Rentabilidad', pct: Math.min(100, Math.max(0, (financials.margenNeto + 5) * 2)), color: config.ring },
              { label: 'Liquidez', pct: financials.runway ? Math.min(100, (financials.runway / 12) * 100) : 30, color: '#3b82f6' },
              { label: 'Cobros', pct: Math.max(0, 100 - (financials.dso / 90) * 100), color: '#10b981' },
            ].map(bar => (
              <div key={bar.label}>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] text-muted-foreground">{bar.label}</span>
                  <span className="text-[10px] text-muted-foreground">{Math.round(bar.pct)}%</span>
                </div>
                <div className="h-1 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${bar.pct}%` }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="h-full rounded-full"
                    style={{ background: bar.color }}
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
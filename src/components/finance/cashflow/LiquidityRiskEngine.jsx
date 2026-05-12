import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Shield, AlertTriangle, Zap, TrendingDown } from 'lucide-react';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function ScoreRing({ score }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease, stroke 0.5s ease' }}
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-2xl font-jakarta font-bold" style={{ color }}>{score}</p>
        <p className="text-[10px] text-white/30 font-medium">/ 100</p>
      </div>
    </div>
  );
}

function RiskBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/45">{label}</span>
        <span className={cn("font-medium", color)}>{fmt(value)}</span>
      </div>
      <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: pct > 75 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981' }}
        />
      </div>
    </div>
  );
}

function StressTest({ financials }) {
  const scenarios = [
    {
      label: 'Caída ventas 30%',
      icon: TrendingDown,
      impact: financials.totalIngresos * -0.3,
      severity: 'medium',
    },
    {
      label: 'Retraso cobros 60 días',
      icon: AlertTriangle,
      impact: financials.cobrosPendientes * -0.8,
      severity: 'high',
    },
    {
      label: 'Impago cliente clave',
      icon: Zap,
      impact: financials.cobrosPendientes * -0.4,
      severity: 'high',
    },
    {
      label: 'Aumento costes 15%',
      icon: TrendingDown,
      impact: financials.gastoTotal * -0.15,
      severity: 'low',
    },
  ];

  const sevColor = { low: 'text-emerald-400', medium: 'text-amber-400', high: 'text-red-400' };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Stress Test</p>
      {scenarios.map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.07 }}
          className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/4 border border-white/6 hover:bg-white/6 transition-all group"
        >
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
            s.severity === 'high' ? 'bg-red-500/15' : s.severity === 'medium' ? 'bg-amber-500/15' : 'bg-emerald-500/15'
          )}>
            <s.icon className={cn("w-3.5 h-3.5", sevColor[s.severity])} />
          </div>
          <span className="flex-1 text-xs text-white/55 group-hover:text-white/75 transition-colors">{s.label}</span>
          <span className={cn("text-xs font-semibold", 'text-red-400')}>
            {fmt(s.impact)}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

export default function LiquidityRiskEngine({ financials }) {
  const {
    cashDisponible, cobrosPendientes, pagosPendientes,
    burnRate, runway, workingCapital, gastoTotal, totalIngresos
  } = financials;

  // Liquidity score calculation
  const runwayScore = runway ? Math.min(40, runway * 8) : 0;
  const workCapScore = workingCapital > 0 ? Math.min(25, (workingCapital / (gastoTotal || 1)) * 25) : 0;
  const coverageScore = burnRate > 0 ? Math.min(20, (cashDisponible / burnRate) * 5) : 0;
  const balanceScore = totalIngresos > 0 ? Math.min(15, ((totalIngresos - gastoTotal) / totalIngresos) * 15) : 0;

  const score = Math.round(Math.max(0, Math.min(100, runwayScore + workCapScore + coverageScore + balanceScore)));

  const level = score >= 70 ? 'Estable' : score >= 40 ? 'Moderado' : 'Crítico';
  const levelColor = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
  const levelBg = score >= 70 ? 'bg-emerald-500/10 border-emerald-500/20' : score >= 40 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl bg-[#0d0d10] border border-white/8 p-5 space-y-5"
    >
      {/* Title */}
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Liquidity Risk Engine</h3>
      </div>

      {/* Score ring + level */}
      <div className="flex items-center gap-5">
        <ScoreRing score={score} />
        <div className="space-y-2">
          <div>
            <p className="text-xs text-white/35 mb-1">Estado de Liquidez</p>
            <span className={cn("text-sm font-semibold px-2.5 py-1 rounded-lg border", levelColor, levelBg)}>
              {level}
            </span>
          </div>
          {runway && (
            <div>
              <p className="text-xs text-white/35">Runway</p>
              <p className="text-sm font-bold text-white">{runway.toFixed(1)} meses</p>
            </div>
          )}
        </div>
      </div>

      {/* Risk bars */}
      <div className="space-y-3">
        <RiskBar label="Cash vs Pagos" value={cashDisponible} max={cashDisponible + pagosPendientes} color="text-emerald-400" />
        <RiskBar label="Cobros pendientes" value={cobrosPendientes} max={totalIngresos || cobrosPendientes} color="text-blue-400" />
        <RiskBar label="Pagos comprometidos" value={pagosPendientes} max={gastoTotal || pagosPendientes} color="text-amber-400" />
      </div>

      {/* Divider */}
      <div className="border-t border-white/6" />

      {/* Stress test */}
      <StressTest financials={financials} />
    </motion.div>
  );
}
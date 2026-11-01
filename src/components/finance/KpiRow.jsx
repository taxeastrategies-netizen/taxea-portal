import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, BarChart3, Clock, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SparklineChart } from './SparklineChart';

function fmt(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function KpiCard({ title, value, subtitle, icon: KpiIcon, color, bgColor, glowColor, delta, deltaLabel, sparkData, delay = 0 }) {
  const Icon = KpiIcon;
  const isPositiveDelta = delta > 0;
  const isNeutralDelta = delta === 0 || delta === null || delta === undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-card border border-border p-5",
        "hover:shadow-xl transition-all duration-300 cursor-default group",
        `hover:shadow-${glowColor}/10`
      )}
    >
      {/* Top accent */}
      <div className={cn("absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl", bgColor)} />

      {/* Glow bg */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl",
        `bg-gradient-to-br ${bgColor.replace('bg-', 'from-')}/5 to-transparent`
      )} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", `${bgColor}/15`)}>
            <Icon className={cn("w-4.5 h-4.5", color)} style={{ width: 18, height: 18 }} />
          </div>
          {delta !== null && delta !== undefined && (
            <div className={cn(
              "flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full",
              isNeutralDelta
                ? "bg-secondary text-muted-foreground"
                : isPositiveDelta
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
            )}>
              {isNeutralDelta ? <Minus className="w-3 h-3" /> : isPositiveDelta ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {!isNeutralDelta && fmtPct(Math.abs(delta))}
            </div>
          )}
        </div>

        <div className="mb-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-jakarta font-bold text-foreground mt-0.5 tracking-tight">{value}</p>
        </div>

        {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}

        {sparkData && (
          <div className="mt-3 h-10">
            <SparklineChart data={sparkData} color={color} />
          </div>
        )}

        {deltaLabel && (
          <p className="text-xs text-muted-foreground mt-1">{deltaLabel}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function KpiRow({ financials }) {
  const { totalIngresos, gastoTotal, beneficio, cashDisponible, cashSource, bankConnected, bankUnreconciled, burnRate, runway, ingresosDelta, sparkData: sd } = financials;

  const kpis = [
    {
      title: 'Saldo bancario EUR',
      value: financials.bankKnown ? fmt(cashDisponible) : '—',
      subtitle: cashSource === 'bank' ? bankConnected + ' cuentas conectadas' : 'Sin saldo bancario verificable',
      icon: Wallet,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500',
      glowColor: 'emerald-500',
      delta: null,
      deltaLabel: cashSource === 'bank' ? bankUnreconciled + ' movimientos por conciliar' : 'Revisa la conexión y su sincronización',
      sparkData: sd?.cash || null,
      delay: 0,
    },
    {
      title: 'Ingresos contables',
      value: fmt(totalIngresos),
      subtitle: 'Asientos confirmados del periodo',
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500',
      glowColor: 'blue-500',
      delta: ingresosDelta,
      deltaLabel: 'vs. periodo anterior',
      sparkData: sd?.ingresos || null,
      delay: 0.05,
    },
    {
      title: 'Gastos contables',
      value: fmt(gastoTotal),
      subtitle: 'Según clasificación contable',
      icon: TrendingDown,
      color: 'text-red-500',
      bgColor: 'bg-red-500',
      glowColor: 'red-500',
      delta: null,
      deltaLabel: null,
      sparkData: sd?.gastos || null,
      delay: 0.1,
    },
    {
      title: 'Resultado contable',
      value: fmt(beneficio),
      subtitle: financials.accountingProvisional ? 'Lectura parcial · revisión pendiente' : 'PyG de asientos admitidos',
      icon: beneficio >= 0 ? TrendingUp : TrendingDown,
      color: beneficio >= 0 ? 'text-primary' : 'text-destructive',
      bgColor: beneficio >= 0 ? 'bg-taxea-red' : 'bg-destructive',
      glowColor: 'primary',
      delta: null,
      deltaLabel: null,
      sparkData: sd?.beneficio || null,
      delay: 0.15,
    },
    {
      title: 'EBITDA contable',
      value: fmt(financials.ebitda),
      subtitle: financials.ebitda === null ? 'Sin desglose contable verificable' : 'Resultado ajustado por cuentas PGC',
      icon: BarChart3,
      color: 'text-violet-600',
      bgColor: 'bg-violet-500',
      glowColor: 'violet-500',
      delta: null,
      deltaLabel: financials.ebitdaProvisional ? 'Indicador orientativo · revisar clasificación' : 'Sin intereses, amortización ni impuesto sobre beneficios',
      sparkData: null,
      delay: 0.2,
    },
    {
      title: 'Runway',
      value: runway !== null ? `${runway.toFixed(1)} meses` : '—',
      subtitle: runway !== null ? `Burn rate ${fmt(burnRate)}/mes` : 'Requiere saldo y 28 días de salidas observadas',
      icon: Clock,
      color: runway !== null && runway < 3 ? 'text-red-500' : runway && runway < 6 ? 'text-amber-500' : 'text-amber-600',
      bgColor: runway && runway < 3 ? 'bg-red-500' : 'bg-amber-500',
      glowColor: 'amber-500',
      delta: null,
      deltaLabel: 'Saldo / salidas bancarias mensuales observadas',
      sparkData: null,
      delay: 0.25,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
}
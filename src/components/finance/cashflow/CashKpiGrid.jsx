import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function CashKpi({ label, value, sub, trend, trendLabel, color = 'emerald', delay = 0, large = false }) {
  const colorMap = {
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', glow: 'shadow-blue-500/10' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/10' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', glow: 'shadow-red-500/10' },
    violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-400', glow: 'shadow-violet-500/10' },
    slate: { bg: 'bg-white/6', border: 'border-white/10', text: 'text-white/70', glow: '' },
  };
  const c = colorMap[color] || colorMap.slate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className={cn(
        "relative rounded-2xl p-4 border transition-all duration-300 group cursor-default",
        "hover:-translate-y-0.5 hover:shadow-xl",
        c.bg, c.border, c.glow
      )}
    >
      <p className="text-xs text-white/40 font-medium mb-2 uppercase tracking-wider">{label}</p>
      <p className={cn("font-jakarta font-bold tracking-tight", large ? "text-2xl" : "text-xl", c.text)}>
        {typeof value === 'number' ? fmt(value) : value}
      </p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
      {trendLabel && (
        <div className={cn(
          "flex items-center gap-1 mt-2 text-xs font-medium",
          trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-white/30'
        )}>
          {trend === 'up' && <ArrowUpRight className="w-3 h-3" />}
          {trend === 'down' && <ArrowDownRight className="w-3 h-3" />}
          {trend === 'neutral' && <Minus className="w-3 h-3" />}
          {trendLabel}
        </div>
      )}
    </motion.div>
  );
}

export default function CashKpiGrid({ financials }) {
  const {
    cashDisponible, cobrosPendientes, pagosPendientes,
    workingCapital, burnRate, runway,
    totalIngresos, gastoTotal, beneficio,
    dso, dpo, ingresosDelta
  } = financials;

  const liquidezNeta = cashDisponible - pagosPendientes;
  const runwayLabel = runway ? `${runway.toFixed(1)} meses runway` : null;
  const deltaLabel = ingresosDelta !== 0 ? `${ingresosDelta > 0 ? '+' : ''}${ingresosDelta.toFixed(1)}% vs período anterior` : null;

  return (
    <div className="space-y-3">
      {/* Top row — main cash KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CashKpi
          label="Cash Disponible"
          value={cashDisponible}
          sub="Facturas cobradas"
          trend={cashDisponible > 0 ? 'up' : 'neutral'}
          trendLabel={runwayLabel}
          color="emerald"
          delay={0}
          large
        />
        <CashKpi
          label="Cobros Pendientes"
          value={cobrosPendientes}
          sub="Facturas emitidas sin cobrar"
          color="blue"
          delay={0.05}
          large
        />
        <CashKpi
          label="Pagos Pendientes"
          value={pagosPendientes}
          sub="Facturas recibidas sin pagar"
          color="amber"
          delay={0.1}
          large
        />
        <CashKpi
          label="Liquidez Neta"
          value={liquidezNeta}
          sub="Cash − pagos comprometidos"
          trend={liquidezNeta >= 0 ? 'up' : 'down'}
          trendLabel={liquidezNeta >= 0 ? 'Posición positiva' : 'Posición negativa'}
          color={liquidezNeta >= 0 ? 'emerald' : 'red'}
          delay={0.15}
          large
        />
      </div>

      {/* Second row — secondary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <CashKpi
          label="Ingresos Período"
          value={totalIngresos}
          trend={ingresosDelta > 0 ? 'up' : ingresosDelta < 0 ? 'down' : 'neutral'}
          trendLabel={deltaLabel}
          color="blue"
          delay={0.2}
        />
        <CashKpi
          label="Gastos Período"
          value={gastoTotal}
          color="red"
          delay={0.22}
        />
        <CashKpi
          label="Beneficio"
          value={beneficio}
          trend={beneficio >= 0 ? 'up' : 'down'}
          color={beneficio >= 0 ? 'emerald' : 'red'}
          delay={0.24}
        />
        <CashKpi
          label="Burn Rate"
          value={burnRate}
          sub="/ mes"
          color="amber"
          delay={0.26}
        />
        <CashKpi
          label="DSO"
          value={`${Math.round(dso)} días`}
          sub="Días cobro medio"
          color={dso > 45 ? 'red' : dso > 30 ? 'amber' : 'emerald'}
          delay={0.28}
        />
        <CashKpi
          label="Capital Trabajo"
          value={workingCapital}
          trend={workingCapital >= 0 ? 'up' : 'down'}
          color={workingCapital >= 0 ? 'emerald' : 'red'}
          delay={0.3}
        />
      </div>
    </div>
  );
}
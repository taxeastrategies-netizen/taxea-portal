import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function CashKpi({ label, value, sub, trend, trendLabel, color = 'slate', delay = 0, large = false }) {
  const colorMap = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500' },
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500' },
    red:     { bg: 'bg-red-50',     border: 'border-red-100',     text: 'text-red-600',     dot: 'bg-red-500' },
    violet:  { bg: 'bg-violet-50',  border: 'border-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500' },
    slate:   { bg: 'bg-white',      border: 'border-slate-200',   text: 'text-slate-800',   dot: 'bg-slate-400' },
  };
  const c = colorMap[color] || colorMap.slate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className={cn(
        "relative rounded-2xl p-4 border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-default group"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <span className={cn("w-1.5 h-1.5 rounded-full mt-1", c.dot)} />
      </div>
      <p className={cn("font-jakarta font-bold tracking-tight text-foreground", large ? "text-2xl" : "text-xl")}>
        {typeof value === 'number' ? fmt(value) : value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {trendLabel && (
        <div className={cn(
          "flex items-center gap-1 mt-2 text-xs font-medium",
          trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400'
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
    dso, ingresosDelta
  } = financials;

  const liquidezNeta = cashDisponible - pagosPendientes;
  const runwayLabel = runway ? `${runway.toFixed(1)} meses runway` : null;
  const deltaLabel = ingresosDelta !== 0 ? `${ingresosDelta > 0 ? '+' : ''}${ingresosDelta.toFixed(1)}% vs período anterior` : null;

  return (
    <div className="space-y-3">
      {/* Top row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CashKpi label="Cash Disponible" value={cashDisponible} sub="Facturas cobradas"
          trend={cashDisponible > 0 ? 'up' : 'neutral'} trendLabel={runwayLabel} color="emerald" delay={0} large />
        <CashKpi label="Cobros Pendientes" value={cobrosPendientes} sub="Sin cobrar" color="blue" delay={0.05} large />
        <CashKpi label="Pagos Pendientes" value={pagosPendientes} sub="Sin pagar" color="amber" delay={0.1} large />
        <CashKpi label="Liquidez Neta" value={liquidezNeta} sub="Cash − compromisos"
          trend={liquidezNeta >= 0 ? 'up' : 'down'}
          trendLabel={liquidezNeta >= 0 ? 'Posición positiva' : 'Posición negativa'}
          color={liquidezNeta >= 0 ? 'emerald' : 'red'} delay={0.15} large />
      </div>
      {/* Second row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <CashKpi label="Ingresos" value={totalIngresos}
          trend={ingresosDelta > 0 ? 'up' : ingresosDelta < 0 ? 'down' : 'neutral'} trendLabel={deltaLabel} color="blue" delay={0.2} />
        <CashKpi label="Gastos" value={gastoTotal} color="red" delay={0.22} />
        <CashKpi label="Beneficio" value={beneficio} trend={beneficio >= 0 ? 'up' : 'down'} color={beneficio >= 0 ? 'emerald' : 'red'} delay={0.24} />
        <CashKpi label="Burn Rate" value={burnRate} sub="/ mes" color="amber" delay={0.26} />
        <CashKpi label="DSO" value={`${Math.round(dso)} días`} sub="Cobro medio"
          color={dso > 45 ? 'red' : dso > 30 ? 'amber' : 'emerald'} delay={0.28} />
        <CashKpi label="Capital Trabajo" value={workingCapital} trend={workingCapital >= 0 ? 'up' : 'down'}
          color={workingCapital >= 0 ? 'emerald' : 'red'} delay={0.3} />
      </div>
    </div>
  );
}
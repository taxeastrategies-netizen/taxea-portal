import { motion } from 'framer-motion';
import { Zap, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function ForecastPanel({ financials }) {
  const { cashDisponible, burnRate } = financials;
  if (!financials.bankKnown || !financials.cashHistorySufficient || financials.bankInflows === null) return <div className="bg-card border border-border rounded-2xl p-5"><h3 className="text-sm font-semibold">Escenario de caja</h3><p className="text-xs text-muted-foreground mt-3">Requiere saldo bancario reciente y al menos 28 días de movimientos observados. No se proyecta caja a partir de facturas.</p></div>;

  // Simple linear projections
  const avgMonthlyIngresos = financials.bankInflows / financials.periodDays * 30;
  const forecast7 = cashDisponible + (avgMonthlyIngresos * (7 / 30)) - (burnRate * (7 / 30));
  const forecast30 = cashDisponible + avgMonthlyIngresos - burnRate;
  const forecast90 = cashDisponible + (avgMonthlyIngresos * 3) - (burnRate * 3);

  const scenarios = [
    {
      label: '7 días',
      value: fmt(forecast7),
      ingresos: fmt(avgMonthlyIngresos * (7 / 30)),
      pagos: fmt(burnRate * (7 / 30)),
      risk: forecast7 < 0 ? 'critical' : forecast7 < cashDisponible * 0.5 ? 'warning' : 'ok',
      delay: 0,
    },
    {
      label: '30 días',
      value: fmt(forecast30),
      ingresos: fmt(avgMonthlyIngresos),
      pagos: fmt(burnRate),
      risk: forecast30 < 0 ? 'critical' : forecast30 < cashDisponible * 0.5 ? 'warning' : 'ok',
      delay: 0.05,
    },
    {
      label: '90 días',
      value: fmt(forecast90),
      ingresos: fmt(avgMonthlyIngresos * 3),
      pagos: fmt(burnRate * 3),
      risk: forecast90 < 0 ? 'critical' : forecast90 < cashDisponible ? 'warning' : 'ok',
      delay: 0.1,
    },
  ];

  const riskConfig = {
    ok: { color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: TrendingUp, label: 'Estable' },
    warning: { color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/20', icon: AlertTriangle, label: 'Alerta' },
    critical: { color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', icon: TrendingDown, label: 'Crítico' },
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Zap className="w-4 h-4 text-violet-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Escenario de caja</h3>
          <p className="text-xs text-muted-foreground">Simulación con movimientos bancarios disponibles</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {scenarios.map((s) => {
          const cfg = riskConfig[s.risk];
          const RiskIcon = cfg.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: s.delay }}
              className={cn("rounded-xl border p-3.5", cfg.bg)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RiskIcon className={cn("w-3.5 h-3.5", cfg.color)} />
                  <span className="text-xs font-semibold text-foreground">{s.label}</span>
                </div>
                <div className={cn("text-sm font-jakarta font-bold", cfg.color)}>{s.value}</div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>↑ {s.ingresos}</span>
                <span>↓ {s.pagos}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground/50 mt-3 text-center">
        Simulación lineal; no incorpora nuevos compromisos, financiación ni impuestos sin importe confirmado
      </p>
    </div>
  );
}

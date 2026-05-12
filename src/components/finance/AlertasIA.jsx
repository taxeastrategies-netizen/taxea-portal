import { motion } from 'framer-motion';
import { Brain, AlertTriangle, TrendingDown, Clock, Users, Flame, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function AlertasIA({ financials, invoices, obligations }) {
  const { cashDisponible, burnRate, runway, gastoTotal, totalIngresos, vencidas, dso, ingresosDelta } = financials;

  const alerts = [];

  // Liquidez
  if (runway !== null && runway < 3) {
    alerts.push({
      id: 'liquidez',
      icon: Flame,
      severity: 'critical',
      title: 'Riesgo de liquidez crítico',
      desc: `Tu empresa solo puede operar ${runway.toFixed(1)} meses con el gasto actual. Revisa los gastos urgentemente.`,
    });
  } else if (runway !== null && runway < 6) {
    alerts.push({
      id: 'runway-warning',
      icon: AlertTriangle,
      severity: 'warning',
      title: 'Runway ajustado',
      desc: `Tu runway es de ${runway.toFixed(1)} meses. Considera aumentar ingresos o reducir costes.`,
    });
  }

  // Caída ingresos
  if (ingresosDelta < -15) {
    alerts.push({
      id: 'ingresos-caida',
      icon: TrendingDown,
      severity: 'critical',
      title: 'Caída significativa de ingresos',
      desc: `Los ingresos han caído un ${Math.abs(ingresosDelta).toFixed(1)}% respecto al periodo anterior.`,
    });
  } else if (ingresosDelta < -5) {
    alerts.push({
      id: 'ingresos-leve',
      icon: TrendingDown,
      severity: 'warning',
      title: 'Ingresos a la baja',
      desc: `Los ingresos han disminuido un ${Math.abs(ingresosDelta).toFixed(1)}%. Analiza las causas.`,
    });
  }

  // Impagos
  if (vencidas.length > 0) {
    const totalVencido = vencidas.reduce((s, i) => s + (i.total_factura || 0), 0);
    alerts.push({
      id: 'impagos',
      icon: Users,
      severity: vencidas.length > 3 ? 'critical' : 'warning',
      title: `${vencidas.length} factura${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''} sin cobrar`,
      desc: `Tienes ${fmt(totalVencido)} pendientes de cobro en facturas vencidas. Contacta a los clientes.`,
    });
  }

  // DSO elevado
  if (dso > 60) {
    alerts.push({
      id: 'dso',
      icon: Clock,
      severity: 'warning',
      title: 'Cobro lento (DSO elevado)',
      desc: `El tiempo medio de cobro es ${dso.toFixed(0)} días. Lo recomendado es inferior a 45 días.`,
    });
  }

  // Burn rate alto
  if (burnRate > totalIngresos * 0.9 && totalIngresos > 0) {
    alerts.push({
      id: 'burn',
      icon: Flame,
      severity: 'warning',
      title: 'Burn rate muy elevado',
      desc: `Los gastos representan el ${((burnRate / totalIngresos) * 100).toFixed(0)}% de los ingresos. Margen muy ajustado.`,
    });
  }

  // Obligaciones próximas
  const urgentObl = (obligations || []).filter(o => {
    try {
      const days = Math.ceil((new Date(o.fecha_limite) - new Date()) / 86400000);
      return days >= 0 && days <= 15 && o.estado !== 'finalizado' && o.estado !== 'presentado';
    } catch { return false; }
  });
  if (urgentObl.length > 0) {
    alerts.push({
      id: 'fiscal',
      icon: Shield,
      severity: 'warning',
      title: `${urgentObl.length} obligación${urgentObl.length > 1 ? 'es' : ''} fiscal${urgentObl.length > 1 ? 'es' : ''} próxima${urgentObl.length > 1 ? 's' : ''}`,
      desc: `Tienes obligaciones fiscales con vencimiento en menos de 15 días. Revisa el calendario fiscal.`,
    });
  }

  // No alerts
  if (alerts.length === 0) {
    alerts.push({
      id: 'ok',
      icon: Shield,
      severity: 'ok',
      title: 'Sin alertas financieras activas',
      desc: 'La salud financiera de tu empresa está dentro de los parámetros normales. Sigue monitorizando.',
    });
  }

  const severityConfig = {
    critical: { border: 'border-red-500/30', bg: 'bg-red-500/5', iconBg: 'bg-red-500/15', iconColor: 'text-red-500', badge: 'bg-red-500/15 text-red-600', badgeLabel: 'Crítico' },
    warning: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', iconBg: 'bg-amber-500/15', iconColor: 'text-amber-500', badge: 'bg-amber-500/15 text-amber-600', badgeLabel: 'Atención' },
    ok: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-500', badge: 'bg-emerald-500/15 text-emerald-600', badgeLabel: 'OK' },
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Brain className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Alertas IA</h3>
          <p className="text-xs text-muted-foreground">Análisis automático de riesgos financieros</p>
        </div>
        <span className={cn(
          "text-xs font-bold px-2 py-0.5 rounded-full",
          alerts.some(a => a.severity === 'critical')
            ? "bg-red-500/15 text-red-600"
            : alerts.some(a => a.severity === 'warning')
              ? "bg-amber-500/15 text-amber-600"
              : "bg-emerald-500/15 text-emerald-600"
        )}>
          {alerts.filter(a => a.id !== 'ok').length || '✓'}
        </span>
      </div>

      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {alerts.map((alert, i) => {
          const cfg = severityConfig[alert.severity];
          const Icon = alert.icon;
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn("rounded-xl border p-3.5 flex gap-3", cfg.border, cfg.bg)}
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", cfg.iconBg)}>
                <Icon className={cn("w-4 h-4", cfg.iconColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-semibold text-foreground leading-snug">{alert.title}</p>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0", cfg.badge)}>{cfg.badgeLabel}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{alert.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
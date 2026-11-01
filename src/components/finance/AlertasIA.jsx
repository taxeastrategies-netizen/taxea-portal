import { motion } from 'framer-motion';
import { Brain, AlertTriangle, Clock, Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { financeAlerts } from '@/lib/financeSignals.mjs';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function AlertasIA({ financials, invoices, obligations, calendarError = false }) {
  const alerts = financeAlerts(financials, obligations, { calendarError }).map(row => ({ ...row, icon: row.id.includes('tax') ? Shield : row.id.includes('invoice') ? Users : row.id.includes('bank') ? Clock : AlertTriangle }));

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
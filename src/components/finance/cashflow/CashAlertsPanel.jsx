import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { financeAlerts } from '@/lib/financeSignals.mjs';



const sevCfg = {
  warning: { border: 'border-amber-200', bg: 'bg-amber-50', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700', label: 'Revisar' },
  critical: { border: 'border-red-200',    bg: 'bg-red-50',    icon: 'text-red-600',    badge: 'bg-red-100 text-red-700',    label: 'Crítico' },
  high:     { border: 'border-orange-200', bg: 'bg-orange-50', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-700', label: 'Alto' },
  medium:   { border: 'border-amber-200',  bg: 'bg-amber-50',  icon: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700',  label: 'Moderado' },
  ok:       { border: 'border-emerald-200',bg: 'bg-emerald-50',icon: 'text-emerald-600',badge: 'bg-emerald-100 text-emerald-700', label: 'OK' },
  unknown:  { border: 'border-slate-200',bg: 'bg-slate-50',icon: 'text-slate-600',badge: 'bg-slate-100 text-slate-700', label: 'Sin dato' },
};

export default function CashAlertsPanel({ financials, obligations, calendarError = false }) {
  const alerts = financeAlerts(financials, obligations, { calendarError });
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">Alertas de tesorería</h3>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
          {alerts.filter(a => !['ok', 'unknown'].includes(a.severity)).length} activas
        </span>
      </div>
      <div className="space-y-2.5">
        <AnimatePresence>
          {alerts.map((alert, i) => {
            const cfg = sevCfg[alert.severity];
            const Icon = alert.severity === 'ok' ? CheckCircle : AlertTriangle;
            return (
              <motion.div key={alert.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={cn("rounded-xl border p-3.5", cfg.border, cfg.bg)}>
                <div className="flex items-start gap-3">
                  <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", cfg.icon)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-semibold text-foreground">{alert.title}</p>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0", cfg.badge)}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{alert.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
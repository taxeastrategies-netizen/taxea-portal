import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Zap, TrendingDown, Clock, Users, CreditCard, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function buildAlerts(financials, obligations) {
  const { cashDisponible, cobrosPendientes, pagosPendientes, burnRate, runway, vencidas, dso, gastoTotal, totalIngresos } = financials;
  const alerts = [];

  if (runway !== null && runway < 3) {
    alerts.push({ id: 'runway', severity: 'critical', icon: Zap, title: 'Runway crítico',
      desc: `Con el burn rate actual, tu caja se agotaría en ${runway.toFixed(1)} meses. Acelera cobros o reduce gastos.` });
  }
  if (cashDisponible < pagosPendientes) {
    alerts.push({ id: 'cash_low', severity: 'high', icon: AlertTriangle, title: 'Cash insuficiente para pagos comprometidos',
      desc: `Tienes ${fmt(cashDisponible)} disponible pero ${fmt(pagosPendientes)} en pagos pendientes. Gap de ${fmt(pagosPendientes - cashDisponible)}.` });
  }
  if (vencidas && vencidas.length > 0) {
    const total = vencidas.reduce((s, i) => s + (i.total_factura || 0), 0);
    alerts.push({ id: 'overdue', severity: 'high', icon: Clock, title: `${vencidas.length} facturas vencidas sin cobrar`,
      desc: `${fmt(total)} en facturas vencidas. Riesgo de impago elevado. Revisa el estado de cada cliente.` });
  }
  if (dso > 60) {
    alerts.push({ id: 'dso', severity: 'medium', icon: TrendingDown, title: 'Período medio de cobro elevado',
      desc: `Tu DSO es de ${Math.round(dso)} días. El recomendado es < 30 días. Esto impacta directamente tu liquidez.` });
  }
  const upcomingObl = obligations.filter(o => {
    try { const diff = (new Date(o.fecha_limite) - new Date()) / 86400000; return diff >= 0 && diff <= 15 && o.estado !== 'finalizado'; }
    catch { return false; }
  });
  if (upcomingObl.length > 0) {
    const total = upcomingObl.reduce((s, o) => s + (o.importe || 0), 0);
    alerts.push({ id: 'tax_soon', severity: 'medium', icon: CreditCard, title: `${upcomingObl.length} obligaciones fiscales en 15 días`,
      desc: `${fmt(total)} en impuestos próximos. Asegúrate de tener cash disponible.` });
  }
  if (cobrosPendientes > cashDisponible * 2) {
    alerts.push({ id: 'pending_high', severity: 'medium', icon: Users, title: 'Concentración alta en cobros pendientes',
      desc: `${fmt(cobrosPendientes)} en cobros pendientes supera 2x tu cash actual. Evalúa riesgo de concentración.` });
  }
  if (alerts.length === 0) {
    alerts.push({ id: 'ok', severity: 'ok', icon: CheckCircle, title: 'Tesorería en buen estado',
      desc: 'No se detectan alertas críticas en este momento. Sigue monitorizando tu cashflow.' });
  }
  return alerts;
}

const sevCfg = {
  critical: { border: 'border-red-200',    bg: 'bg-red-50',    icon: 'text-red-600',    badge: 'bg-red-100 text-red-700',    label: 'Crítico' },
  high:     { border: 'border-orange-200', bg: 'bg-orange-50', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-700', label: 'Alto' },
  medium:   { border: 'border-amber-200',  bg: 'bg-amber-50',  icon: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700',  label: 'Moderado' },
  ok:       { border: 'border-emerald-200',bg: 'bg-emerald-50',icon: 'text-emerald-600',badge: 'bg-emerald-100 text-emerald-700', label: 'OK' },
};

export default function CashAlertsPanel({ financials, obligations }) {
  const alerts = buildAlerts(financials, obligations);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">Alertas IA — Tesorería</h3>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
          {alerts.filter(a => a.severity !== 'ok').length} activas
        </span>
      </div>
      <div className="space-y-2.5">
        <AnimatePresence>
          {alerts.map((alert, i) => {
            const cfg = sevCfg[alert.severity];
            const Icon = alert.icon;
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
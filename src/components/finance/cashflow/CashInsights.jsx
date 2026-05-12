import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function buildInsights(financials) {
  const { cashDisponible, burnRate, runway, cobrosPendientes, pagosPendientes,
    totalIngresos, gastoTotal, beneficio, margenNeto, ingresosDelta, dso, workingCapital } = financials;
  const insights = [];

  if (ingresosDelta !== 0) {
    insights.push({ trend: ingresosDelta > 0 ? 'up' : 'down',
      text: `Tus ingresos ${ingresosDelta > 0 ? 'crecen' : 'caen'} un ${Math.abs(ingresosDelta).toFixed(1)}% respecto al período anterior. ${ingresosDelta > 0 ? 'Tendencia positiva.' : 'Atención al pipeline comercial.'}` });
  }
  if (gastoTotal > 0 && totalIngresos > 0) {
    const taxShare = (pagosPendientes / gastoTotal) * 100;
    if (taxShare > 15) {
      insights.push({ trend: 'down', text: `Los pagos comprometidos representan el ${taxShare.toFixed(0)}% de tus gastos. Optimiza plazos de pago con proveedores.` });
    }
  }
  if (dso > 30) {
    insights.push({ trend: 'down', text: `Tu período medio de cobro es de ${Math.round(dso)} días. Cada día de mejora en DSO libera ${fmt(totalIngresos / 365)} de liquidez adicional.` });
  }
  if (workingCapital > 0) {
    insights.push({ trend: 'up', text: `Tu capital de trabajo es positivo (${fmt(workingCapital)}). Tienes capacidad de maniobra financiera a corto plazo.` });
  } else if (workingCapital < 0) {
    insights.push({ trend: 'down', text: `Capital de trabajo negativo (${fmt(workingCapital)}). Los cobros pendientes no cubren los pagos comprometidos.` });
  }
  if (margenNeto > 20) {
    insights.push({ trend: 'up', text: `Margen neto del ${margenNeto.toFixed(1)}%. Excelente eficiencia operativa. La rentabilidad soporta bien el crecimiento.` });
  } else if (margenNeto < 0) {
    insights.push({ trend: 'down', text: `Margen neto negativo (${margenNeto.toFixed(1)}%). Los gastos superan los ingresos del período. Revisa la estructura de costes.` });
  }
  if (insights.length === 0) {
    insights.push({ trend: 'neutral', text: 'Registra más facturas y gastos para obtener insights financieros personalizados basados en tus datos reales.' });
  }
  return insights;
}

export default function CashInsights({ financials }) {
  const insights = buildInsights(financials);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-violet-500" />
        <h3 className="text-sm font-semibold text-foreground">Insights IA — Cashflow</h3>
      </div>
      <div className="space-y-2.5">
        {insights.map((ins, i) => {
          const Icon = ins.trend === 'up' ? TrendingUp : ins.trend === 'down' ? TrendingDown : Minus;
          const styles = ins.trend === 'up'
            ? { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'text-emerald-600' }
            : ins.trend === 'down'
            ? { bg: 'bg-red-50',     border: 'border-red-100',     icon: 'text-red-500' }
            : { bg: 'bg-slate-50',   border: 'border-slate-100',   icon: 'text-slate-400' };
          return (
            <motion.div key={i} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn("flex items-start gap-3 p-3 rounded-xl border", styles.bg, styles.border)}>
              <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", styles.icon)} />
              <p className="text-xs text-slate-600 leading-relaxed">{ins.text}</p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
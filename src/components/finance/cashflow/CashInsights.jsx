import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function buildInsights(financials) {
  const { totalIngresos, gastoTotal, beneficio, ingresosDelta, dso, workingCapital, bankKnown } = financials;
  const insights = [];

  if (bankKnown && ingresosDelta !== 0) {
    insights.push({ trend: ingresosDelta > 0 ? 'up' : 'down',
      text: `Las entradas bancarias observadas ${ingresosDelta > 0 ? 'aumentan' : 'disminuyen'} un ${Math.abs(ingresosDelta).toFixed(1)}% frente a los 30 días anteriores. No equivale a ventas devengadas.` });
  }
  if (bankKnown && gastoTotal > totalIngresos) insights.push({ trend: 'down', text: `En los últimos 30 días las salidas bancarias superan las entradas en ${fmt(Math.abs(beneficio))}. Revisa conceptos y fechas antes de proyectar una tendencia.` });
  if (dso > 30) {
    insights.push({ trend: 'down', text: `Las facturas con cobros registrados tardaron de media ${Math.round(dso)} días desde emisión. La muestra puede no cubrir todas las ventas.` });
  }
  if (workingCapital > 0) {
    insights.push({ trend: 'up', text: `Los cobros pendientes superan las facturas por pagar en ${fmt(workingCapital)}. No equivale al capital circulante contable ni garantiza su cobro.` });
  } else if (workingCapital < 0) {
    insights.push({ trend: 'down', text: `Las facturas por pagar superan los cobros pendientes en ${fmt(Math.abs(workingCapital))}. Revisa otras obligaciones no incluidas.` });
  }
  if (!bankKnown) insights.unshift({ trend: 'neutral', text: 'No hay un saldo bancario verificable. Los indicadores de liquidez quedan sin calcular hasta revisar la conexión.' });
  if (insights.length === 0) {
    insights.push({ trend: 'neutral', text: 'No hay suficientes operaciones verificadas para emitir una lectura útil de tesorería.' });
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
        <h3 className="text-sm font-semibold text-foreground">Lectura de tesorería</h3>
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
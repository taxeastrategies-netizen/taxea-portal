import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, Clock, PieChart, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InsightsIA({ financials }) {
  const { totalIngresos, gastoTotal, beneficio, margenNeto, dso, dpo, burnRate, ingresosDelta, workingCapital } = financials;

  const insights = [];

  // Margen
  if (margenNeto > 20) {
    insights.push({
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
      text: `Tu margen neto del ${margenNeto.toFixed(1)}% es saludable y superior a la media del sector servicios.`,
    });
  } else if (margenNeto > 5) {
    insights.push({
      icon: PieChart,
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
      text: `Margen neto del ${margenNeto.toFixed(1)}%. Hay margen de mejora optimizando gastos operativos.`,
    });
  } else if (gastoTotal > 0) {
    insights.push({
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      text: `El margen neto es del ${margenNeto.toFixed(1)}%. Los gastos consumen la mayoría de los ingresos.`,
    });
  }

  // Tendencia ingresos
  if (ingresosDelta > 10) {
    insights.push({
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
      text: `Tus ingresos crecen un ${ingresosDelta.toFixed(1)}% respecto al periodo anterior. Tendencia muy positiva.`,
    });
  } else if (ingresosDelta < -10) {
    insights.push({
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      text: `Caída del ${Math.abs(ingresosDelta).toFixed(1)}% en ingresos. Analiza si es estacional o estructural.`,
    });
  }

  // DSO
  if (dso > 0) {
    const dsoMsg = dso > 60
      ? `El tiempo de cobro (${dso.toFixed(0)} días) supera ampliamente el estándar. Refuerza la gestión de cobros.`
      : dso > 45
        ? `El tiempo medio de cobro (${dso.toFixed(0)} días) está por encima del óptimo recomendado (< 45 días).`
        : `Buen tiempo de cobro: ${dso.toFixed(0)} días de media. Por debajo del estándar de 45 días.`;
    insights.push({
      icon: Clock,
      color: dso > 60 ? 'text-red-500' : dso > 45 ? 'text-amber-600' : 'text-emerald-600',
      bg: dso > 60 ? 'bg-red-500/10' : dso > 45 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
      text: dsoMsg,
    });
  }

  // Working capital
  if (workingCapital > 0) {
    insights.push({
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
      text: `Tu capital de trabajo es positivo (${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(workingCapital)}). Buena posición de liquidez a corto plazo.`,
    });
  } else if (workingCapital < 0) {
    insights.push({
      icon: TrendingDown,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      text: `Capital de trabajo negativo. Los pagos pendientes superan los cobros pendientes. Riesgo de tensión de caja.`,
    });
  }

  // Fallback
  if (insights.length === 0) {
    insights.push({
      icon: Sparkles,
      color: 'text-muted-foreground',
      bg: 'bg-secondary',
      text: 'Registra más movimientos financieros para que la IA pueda generar insights personalizados.',
    });
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 h-full">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Insights IA</h3>
          <p className="text-xs text-muted-foreground">Interpretación automática de tus datos</p>
        </div>
      </div>

      <div className="space-y-3">
        {insights.map((insight, i) => {
          const Icon = insight.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn("flex gap-3 rounded-xl p-3.5", insight.bg)}
            >
              <div className="flex-shrink-0 mt-0.5">
                <Icon className={cn("w-4 h-4", insight.color)} />
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">{insight.text}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground/50">Análisis basado en datos reales de Taxea</p>
          <div className="flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
            <span>Ver más</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
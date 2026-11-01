import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { financeInsights } from '@/lib/financeSignals.mjs';

export default function InsightsIA({ financials }) {
  const insights = financeInsights(financials).map(row => ({ ...row, icon: row.kind === 'down' ? TrendingDown : row.kind === 'up' ? TrendingUp : Sparkles, color: row.kind === 'down' ? 'text-amber-600' : row.kind === 'up' ? 'text-emerald-600' : 'text-blue-600', bg: row.kind === 'down' ? 'bg-amber-500/10' : row.kind === 'up' ? 'bg-emerald-500/10' : 'bg-blue-500/10' }));

  return (
    <div className="bg-card border border-border rounded-2xl p-5 h-full">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Insights IA</h3>
          <p className="text-xs text-muted-foreground">Lectura de fuentes, muestras y periodos</p>
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
          <p className="text-[10px] text-muted-foreground/50">Sin referencias sectoriales no documentadas</p>
          <div className="flex items-center gap-1 text-xs text-primary">
            <a href="/tax-accounting/contabilidad">Ver contabilidad</a>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
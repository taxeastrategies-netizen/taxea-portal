import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, icon: Icon, trend, trendLabel, colorClass = 'text-taxea-red', bgClass = 'bg-accent', suffix = '€', accent }) {
  return (
    <div className={cn(
      "group relative bg-card rounded-2xl border border-border p-5 overflow-hidden",
      "hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5",
      "transition-all duration-300 cursor-default"
    )}>
      {/* Subtle top accent line */}
      {accent && <div className={cn("absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl", accent)} />}

      {/* Background glow */}
      <div className={cn("absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-500", bgClass)} />

      <div className="flex items-start justify-between mb-3 relative">
        <p className="text-xs font-medium text-muted-foreground leading-tight uppercase tracking-wide">{title}</p>
        {Icon && (
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shadow-sm",
            "ring-1 ring-inset ring-white/10",
            bgClass
          )}>
            <Icon className={cn("w-4 h-4", colorClass)} />
          </div>
        )}
      </div>

      <p className="text-2xl font-jakarta font-bold text-foreground relative">
        {typeof value === 'number'
          ? value.toLocaleString('es-ES', { minimumFractionDigits: suffix === '€' ? 2 : 0, maximumFractionDigits: 2 })
          : value}
        {typeof value === 'number' && suffix && (
          <span className="text-sm font-medium text-muted-foreground ml-1">{suffix}</span>
        )}
      </p>

      {trendLabel && (
        <div className="flex items-center gap-1 mt-2">
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-destructive" />}
          <span className="text-xs text-muted-foreground">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
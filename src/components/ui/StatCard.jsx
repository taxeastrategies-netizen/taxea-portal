import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, icon: Icon, trend, trendLabel, colorClass = 'text-taxea-red', bgClass = 'bg-accent', suffix = '€' }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-5 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground leading-tight">{title}</p>
        {Icon && (
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bgClass)}>
            <Icon className={cn("w-4 h-4", colorClass)} />
          </div>
        )}
      </div>
      <p className="text-2xl font-jakarta font-700 text-foreground">
        {typeof value === 'number' ? value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
        {typeof value === 'number' && <span className="text-base font-medium text-muted-foreground ml-1">{suffix}</span>}
      </p>
      {trendLabel && (
        <div className="flex items-center gap-1 mt-2">
          {trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-green-500" />}
          {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-destructive" />}
          <span className="text-xs text-muted-foreground">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
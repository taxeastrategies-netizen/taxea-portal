import { cn } from '@/lib/utils';

export default function HealthScore({ score = 75, showDetail = false, motivos = [] }) {
  const getCategory = (s) => {
    if (s >= 80) return { label: 'Excelente', color: 'text-green-600', bg: 'bg-green-500', trackBg: 'bg-green-100' };
    if (s >= 60) return { label: 'Controlado', color: 'text-blue-600', bg: 'bg-blue-500', trackBg: 'bg-blue-100' };
    if (s >= 40) return { label: 'Riesgo medio', color: 'text-amber-600', bg: 'bg-amber-500', trackBg: 'bg-amber-100' };
    return { label: 'Riesgo alto', color: 'text-red-600', bg: 'bg-red-500', trackBg: 'bg-red-100' };
  };

  const cat = getCategory(score);

  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">Health Score</p>
        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", cat.color, cat.trackBg)}>{cat.label}</span>
      </div>
      <div className="flex items-end gap-3">
        <p className={cn("text-4xl font-jakarta font-bold", cat.color)}>{score}</p>
        <p className="text-muted-foreground mb-1">/100</p>
      </div>
      <div className={cn("mt-3 h-2 rounded-full", cat.trackBg)}>
        <div
          className={cn("h-2 rounded-full transition-all duration-700", cat.bg)}
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
      {showDetail && motivos.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Factores detectados:</p>
          {motivos.map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
              {m}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
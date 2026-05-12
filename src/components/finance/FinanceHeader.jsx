import { RefreshCw, Download, Share2, Settings, TrendingUp, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const PERIODS = [
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: 'Trimestre' },
  { id: '365d', label: 'Anual' },
];

export default function FinanceHeader({ company, period, setPeriod, lastSync, loading }) {
  const companyName = company?.nombre_comercial || company?.razon_social || 'Mi Empresa';

  return (
    <div className="flex flex-col gap-4">
      {/* Top row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Finance</span>
              <span className="text-xs text-muted-foreground/40">/</span>
              <span className="text-xs font-semibold text-foreground">Dashboard</span>
            </div>
            <h1 className="text-xl font-jakarta font-bold text-foreground leading-tight">{companyName}</h1>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Activity className="w-3 h-3 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600">En vivo</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Share2 className="w-3.5 h-3.5" />
            Compartir
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Period selector + sync info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center bg-secondary/60 rounded-xl p-1 gap-0.5">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                period === p.id
                  ? "bg-white dark:bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className={cn("w-1.5 h-1.5 rounded-full", loading ? "bg-amber-400 animate-pulse" : "bg-emerald-400")} />
          <span>
            {loading ? "Sincronizando..." : `Actualizado ${formatDistanceToNow(lastSync, { locale: es, addSuffix: true })}`}
          </span>
          <button className="p-1 hover:text-foreground transition-colors rounded">
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          </button>
        </div>
      </div>
    </div>
  );
}
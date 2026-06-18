import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingUp, Lock, CheckCircle, Infinity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function OcrUsageCard({ compact = false, onUpgradeClick }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getOcrUsageSummary', {});
      setUsage(res.data);
    } catch {
      setUsage(null);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="h-4 w-32 bg-muted animate-pulse rounded" />;
  }

  if (!usage || !usage.period) return null;

  const { period, pct, available, status, planInfo, nextResetDate } = usage;
  const isUnlimited = period?.isUnlimited;
  const consumed = period?.consumedCredits || 0;
  const limit = period?.currentPlanLimit + (period?.manualCredits || 0);

  const statusConfig = {
    available: { color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    warning: { color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    critical: { color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
    exhausted: { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200' },
    manually_extended: { color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
    unlimited: { color: 'bg-primary', text: 'text-primary', bg: 'bg-accent border-border' },
    suspended: { color: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
  };
  const cfg = statusConfig[status] || statusConfig.available;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border ${cfg.bg}`}>
        {isUnlimited ? (
          <>
            <Infinity className={`w-3.5 h-3.5 ${cfg.text}`} />
            <span className={cfg.text}>{consumed} facturas OCR (sin límite)</span>
          </>
        ) : (
          <>
            <span className={`font-semibold ${cfg.text}`}>{consumed}</span>
            <span className="text-muted-foreground">/ {limit}</span>
            <span className="text-muted-foreground">facturas OCR</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-card border rounded-xl p-5 shadow-card ${status === 'exhausted' ? 'border-red-300' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-jakarta font-semibold text-sm">Créditos OCR — {usage.quarterKey}</h3>
        {planInfo && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{planInfo.displayName}</span>}
      </div>

      {isUnlimited ? (
        <div className="flex items-center gap-2 mb-3">
          <Infinity className="w-5 h-5 text-primary" />
          <span className="text-2xl font-bold font-jakarta">{consumed}</span>
          <span className="text-muted-foreground text-sm">facturas procesadas (sin máximo contractual)</span>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-1 mb-2">
            <span className="text-2xl font-bold font-jakarta">{consumed}</span>
            <span className="text-muted-foreground mb-1">de {limit} facturas procesadas este trimestre</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${cfg.color}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <span className={`text-xs font-semibold ${cfg.text}`}>{pct}%</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {status === 'exhausted'
              ? `Has alcanzado el límite. Restablecimiento: ${nextResetDate}`
              : `Te quedan ${available} créditos · Restablecimiento: ${nextResetDate}`}
          </p>
        </>
      )}

      {status === 'warning' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 mb-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Has utilizado el {pct}% de las facturas incluidas en tu plan este trimestre.</span>
        </div>
      )}

      {status === 'critical' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-800 mb-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Estás cerca del límite. Te quedan {available} facturas.</span>
        </div>
      )}

      {status === 'exhausted' && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800 mb-3 flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Has utilizado las {limit} facturas incluidas en tu plan para este trimestre. El OCR está bloqueado.</span>
        </div>
      )}

      {(status === 'warning' || status === 'critical' || status === 'exhausted') && planInfo?.nextPlanCode && (
        <div className="flex gap-2 flex-wrap">
          {(status === 'critical' || status === 'exhausted') && (
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs gap-1"
              onClick={() => onUpgradeClick ? onUpgradeClick() : navigate('/suscripcion')}>
              <TrendingUp className="w-3.5 h-3.5" />
              Ampliar al siguiente plan
            </Button>
          )}
          {status === 'warning' && (
            <Button size="sm" variant="outline" className="text-xs"
              onClick={() => navigate('/suscripcion')}>
              Ver opciones
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
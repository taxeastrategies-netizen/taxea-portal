import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Infinity } from 'lucide-react';

export default function OcrTopBarBadge({ isAdmin }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (isAdmin) return;
    base44.functions.invoke('getOcrUsageSummary', {})
      .then(res => setData(res.data))
      .catch(() => {});
  }, [isAdmin]);

  if (isAdmin || !data || !data.period) return null;

  const { period, pct, available, status } = data;
  const isUnlimited = period?.isUnlimited;
  const consumed = period?.consumedCredits || 0;
  const limit = (period?.currentPlanLimit || 0) + (period?.manualCredits || 0);

  const colorMap = {
    available: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    critical: 'bg-orange-50 border-orange-200 text-orange-700',
    exhausted: 'bg-red-50 border-red-200 text-red-700',
    manually_extended: 'bg-blue-50 border-blue-200 text-blue-700',
    unlimited: 'bg-primary/8 border-primary/20 text-primary',
    suspended: 'bg-slate-50 border-slate-200 text-slate-500',
  };
  const cls = colorMap[status] || colorMap.available;

  return (
    <Link to="/suscripcion" title="Créditos OCR este trimestre" className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors hover:opacity-80 ${cls}`}>
      {isUnlimited ? (
        <>
          <Infinity className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-mono">{consumed}</span>
          <span className="opacity-70 hidden md:inline">facturas OCR</span>
        </>
      ) : (
        <>
          <span className="font-mono font-semibold">{consumed}</span>
          <span className="opacity-60">/</span>
          <span className="font-mono">{limit}</span>
          <span className="opacity-70 hidden md:inline ml-0.5">OCR</span>
          {status === 'exhausted' && <span className="ml-0.5 font-semibold">— Agotado</span>}
        </>
      )}
    </Link>
  );
}
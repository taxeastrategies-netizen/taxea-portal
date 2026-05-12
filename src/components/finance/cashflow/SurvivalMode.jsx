import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export default function SurvivalMode({ financials }) {
  const { cashDisponible, burnRate, runway } = financials;
  const runwayMonths = runway || 0;
  const runwayDays = Math.round(runwayMonths * 30);

  const level = runwayMonths >= 6 ? 'stable' : runwayMonths >= 3 ? 'caution' : runwayMonths >= 1 ? 'warning' : 'critical';

  const cfg = {
    stable:   { label: 'Zona Segura',  sub: 'Liquidez suficiente para operar con estabilidad', color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', bar: 'bg-emerald-500', pct: Math.min(100, (runwayMonths/12)*100) },
    caution:  { label: 'Precaución',   sub: 'Liquidez moderada. Monitoriza cobros activamente', color: '#d97706', bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-50 border-amber-200 text-amber-700',   bar: 'bg-amber-500',   pct: Math.min(100, (runwayMonths/6)*100) },
    warning:  { label: 'Alerta',       sub: 'Liquidez baja. Actúa para evitar tensión financiera', color: '#ea580c', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-50 border-orange-200 text-orange-700', bar: 'bg-orange-500', pct: Math.min(100, (runwayMonths/3)*100) },
    critical: { label: 'Crítico',      sub: 'Cash insuficiente. Riesgo inminente de insolvencia', color: '#dc2626', bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-50 border-red-200 text-red-700',         bar: 'bg-red-500',    pct: Math.max(5, runwayMonths * 10) },
  }[level];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Heart className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-foreground">Survival Mode</h3>
        <span className={cn("ml-auto text-xs font-semibold px-2.5 py-1 rounded-lg border", cfg.badge)}>{cfg.label}</span>
      </div>

      <div className="text-center py-4">
        <p className="text-5xl font-jakarta font-black tracking-tight" style={{ color: cfg.color }}>
          {runwayMonths > 0 ? runwayMonths.toFixed(1) : '< 1'}
        </p>
        <p className="text-xs text-slate-400 mt-1 font-medium">meses de runway</p>
        <p className="text-xs text-slate-300 mt-0.5">{runwayDays > 0 ? `≈ ${runwayDays} días` : 'Sin datos suficientes'}</p>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-300 mb-1.5">
          <span>0</span><span>3m</span><span>6m</span><span>12m+</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${cfg.pct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={cn("h-full rounded-full", cfg.bar)} />
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center leading-relaxed mb-4">{cfg.sub}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Cash actual</p>
          <p className="text-sm font-bold text-foreground">{fmt(cashDisponible)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Burn rate / mes</p>
          <p className="text-sm font-bold text-foreground">{fmt(burnRate)}</p>
        </div>
      </div>
    </motion.div>
  );
}
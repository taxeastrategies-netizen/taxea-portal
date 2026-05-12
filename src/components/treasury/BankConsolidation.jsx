import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, Wallet, Lock, Zap } from 'lucide-react';

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

const COLORS = ['#be1a35', '#059669', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#dc2626'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{payload[0].name}</p>
      <p className="text-slate-600 mt-0.5">{fmt(payload[0].value)}</p>
      <p className="text-slate-400">{payload[0].payload.pct?.toFixed(1)}%</p>
    </div>
  );
};

export default function BankConsolidation({ accounts }) {
  const stats = useMemo(() => {
    const total = accounts.reduce((s, a) => s + (a.saldo_disponible || 0), 0);
    const operativo = accounts.filter(a => a.estado_conexion === 'conectado').reduce((s, a) => s + (a.saldo_disponible || 0), 0);
    const retenido = accounts.reduce((s, a) => s + (a.saldo_retenido || 0), 0);
    const pieData = accounts.map((a, i) => ({
      name: a.nombre_banco,
      value: Math.max(0, a.saldo_disponible || 0),
      pct: total > 0 ? ((a.saldo_disponible || 0) / total) * 100 : 0,
      color: COLORS[i % COLORS.length],
    })).filter(d => d.value > 0);
    return { total, operativo, retenido, pieData };
  }, [accounts]);

  if (accounts.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">Consolidación bancaria</h3>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { icon: Wallet, label: 'Total bancos', value: stats.total, color: 'text-taxea-red', bg: 'bg-taxea-red/8' },
          { icon: Zap,    label: 'Operativo',    value: stats.operativo, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { icon: Lock,   label: 'Retenido',     value: stats.retenido,  color: 'text-amber-600',  bg: 'bg-amber-50' },
        ].map((k, i) => (
          <div key={i} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mb-2", k.bg)}>
              <k.icon className={cn("w-3.5 h-3.5", k.color)} />
            </div>
            <p className="text-xs text-slate-400">{k.label}</p>
            <p className={cn("text-sm font-bold mt-0.5", k.color)}>{fmt(k.value)}</p>
          </div>
        ))}
      </div>

      {/* Pie + legend */}
      <div className="flex items-center gap-4">
        <div className="w-28 h-28 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={48}
                dataKey="value" paddingAngle={3}>
                {stats.pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          {stats.pieData.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-xs text-slate-600 truncate flex-1">{d.name}</span>
              <span className="text-xs font-semibold text-foreground flex-shrink-0">{fmt(d.value)}</span>
              <span className="text-[10px] text-slate-400 flex-shrink-0">{d.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
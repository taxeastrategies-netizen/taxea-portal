import { cn } from '@/lib/utils';
import { Building2, AlertTriangle, CheckCircle, Zap } from 'lucide-react';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function LiquidityRadar({ liquidez, bankAccounts }) {
  const { saldo, minOperativa, exceso, gastosM } = liquidez;
  const excessPct = saldo > 0 ? (exceso / saldo) * 100 : 0;
  const status = exceso > 50000 ? 'high' : exceso > 10000 ? 'medium' : 'low';

  return (
    <div className="space-y-5">
      {/* Semáforo liquidez */}
      <div className={cn("rounded-2xl p-6 border shadow-sm",
        status === 'high' ? "bg-emerald-50 border-emerald-200" :
        status === 'medium' ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Exceso de liquidez detectado</p>
            <p className={cn("text-4xl font-jakarta font-bold",
              status === 'high' ? "text-emerald-700" : status === 'medium' ? "text-amber-700" : "text-slate-500")}>
              {fmt(exceso)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Capital potencialmente no operativo · {excessPct.toFixed(0)}% del saldo total</p>
          </div>
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0",
            status === 'high' ? "bg-emerald-100" : status === 'medium' ? "bg-amber-100" : "bg-slate-200")}>
            {status === 'low' ? <CheckCircle className="w-8 h-8 text-slate-400" /> :
             status === 'medium' ? <AlertTriangle className="w-8 h-8 text-amber-500" /> :
             <Zap className="w-8 h-8 text-emerald-500" />}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Saldo total cuentas', value: fmt(saldo), sub: `${bankAccounts.length} cuentas conectadas`, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Liquidez mínima operativa', value: fmt(minOperativa), sub: 'Estimada: 3 meses gastos', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
          { label: 'Exceso potencial', value: fmt(exceso), sub: 'Capital sin uso operativo estimado', color: status === 'high' ? 'text-emerald-600' : 'text-amber-600', bg: status === 'high' ? 'bg-emerald-50' : 'bg-amber-50', border: status === 'high' ? 'border-emerald-100' : 'border-amber-100' },
          { label: 'Gasto mensual medio', value: fmt(gastosM), sub: 'Base cálculo liquidez mínima', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
        ].map((c, i) => (
          <div key={i} className={cn("bg-white border rounded-2xl p-4 shadow-sm", c.border)}>
            <p className="text-[11px] text-slate-400 mb-1">{c.label}</p>
            <p className={cn("text-xl font-jakarta font-bold", c.color)}>{c.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Barra visual */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-3">Distribución de la tesorería</p>
        <div className="flex h-8 rounded-full overflow-hidden gap-0.5">
          <div className="bg-blue-400 flex items-center justify-center text-[10px] text-white font-bold transition-all"
            style={{ width: `${saldo > 0 ? (minOperativa / saldo) * 100 : 50}%` }}>
            Operativa
          </div>
          <div className="bg-emerald-400 flex items-center justify-center text-[10px] text-white font-bold flex-1">
            Exceso potencial
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-400 inline-block" /> Liquidez operativa ({fmt(minOperativa)})</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block" /> Exceso potencial ({fmt(exceso)})</span>
        </div>
      </div>

      {/* IA insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <span className="text-lg flex-shrink-0">🤖</span>
        <div>
          <p className="text-xs font-semibold text-blue-800 mb-0.5">Análisis interno — Liquidez</p>
          <p className="text-xs text-blue-700">
            {exceso > 50000
              ? `Se detecta liquidez significativa sin uso operativo estimado (${fmt(exceso)}). La tesorería disponible supera ampliamente las necesidades previstas a corto plazo. Existen alternativas de treasury orientativas en la pestaña "Plataformas".`
              : exceso > 10000
              ? `Existe liquidez no utilizada superior al promedio operativo mínimo (${fmt(exceso)}). Revisar si parte puede asignarse a instrumentos de tesorería de corto plazo.`
              : `La liquidez disponible se aproxima a la necesidad operativa mínima estimada. No se detecta exceso significativo en este momento.`
            }
          </p>
        </div>
      </div>

      {/* Cuentas por saldo */}
      {bankAccounts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-foreground">Saldo por cuenta bancaria</p>
          </div>
          <div className="divide-y divide-slate-50">
            {bankAccounts.sort((a, b) => (b.saldo_disponible || 0) - (a.saldo_disponible || 0)).map(b => (
              <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">{b.nombre_banco}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{b.estado_conexion}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-foreground">{fmt(b.saldo_disponible)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
import { useMemo } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { AlertTriangle, TrendingDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function ARRiskRadar({ invoices, contacts }) {
  const now = new Date();

  const { clientRisks, alerts, totalExposure } = useMemo(() => {
    const pending = invoices.filter(i => i.estado_cobro !== 'cobrada');
    const totalIngresos = invoices.filter(i => i.tipo === 'emitida').reduce((s, i) => s + (i.total_factura || 0), 0);
    const totalExposure = pending.reduce((s, i) => s + (i.total_factura || 0), 0);

    // Agrupar por cliente
    const clientMap = {};
    invoices.filter(i => i.tipo === 'emitida').forEach(inv => {
      const k = inv.cliente_nombre || 'Sin cliente';
      if (!clientMap[k]) clientMap[k] = { name: k, nif: inv.cliente_nif, facturas: [], pendiente: 0, cobrado: 0, maxRetraso: 0, retrasos: 0 };
      clientMap[k].facturas.push(inv);
      if (inv.estado_cobro !== 'cobrada') {
        clientMap[k].pendiente += inv.total_factura || 0;
        if (inv.fecha_vencimiento) {
          const d = differenceInDays(now, parseISO(inv.fecha_vencimiento));
          if (d > 0) { clientMap[k].retrasos++; clientMap[k].maxRetraso = Math.max(clientMap[k].maxRetraso, d); }
        }
      } else {
        clientMap[k].cobrado += inv.total_factura || 0;
      }
    });

    // Calcular score y riesgo
    const clientRisks = Object.values(clientMap).map(c => {
      const totalCliente = c.pendiente + c.cobrado;
      const concentracion = totalIngresos > 0 ? (totalCliente / totalIngresos) * 100 : 0;
      let score = 100;
      if (c.retrasos > 0) score -= c.retrasos * 15;
      if (c.maxRetraso > 60) score -= 30;
      if (c.maxRetraso > 90) score -= 25;
      if (concentracion > 30) score -= 20;
      if (concentracion > 50) score -= 20;
      score = Math.max(0, Math.min(100, score));
      const riesgo = score >= 70 ? 'bajo' : score >= 40 ? 'medio' : 'alto';
      return { ...c, score, riesgo, concentracion: concentracion.toFixed(1) };
    }).filter(c => c.pendiente > 0).sort((a, b) => a.score - b.score);

    // Alertas IA
    const alerts = [];
    clientRisks.forEach(c => {
      if (c.concentracion > 30) alerts.push({ type: 'concentracion', msg: `${c.name} representa el ${c.concentracion}% de tus ingresos totales.`, level: 'warning' });
      if (c.maxRetraso > 90) alerts.push({ type: 'retraso', msg: `${c.name} acumula ${c.maxRetraso} días de retraso. Riesgo de impago elevado.`, level: 'danger' });
      else if (c.maxRetraso > 45) alerts.push({ type: 'retraso', msg: `${c.name} lleva ${c.maxRetraso} días sin pagar. Envía recordatorio urgente.`, level: 'warning' });
    });

    return { clientRisks, alerts, totalExposure };
  }, [invoices]);

  const RISK_CFG = {
    bajo:  { label: 'Riesgo bajo',  bar: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    medio: { label: 'Riesgo medio', bar: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    alto:  { label: 'Riesgo alto',  bar: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200' },
  };

  return (
    <div className="space-y-5">
      {/* Alertas IA */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={cn("flex items-start gap-3 p-4 rounded-2xl border",
              a.level === 'danger' ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200")}>
              <AlertTriangle className={cn("w-4 h-4 flex-shrink-0 mt-0.5", a.level === 'danger' ? "text-red-500" : "text-amber-500")} />
              <div>
                <p className={cn("text-xs font-semibold", a.level === 'danger' ? "text-red-700" : "text-amber-700")}>
                  {a.type === 'concentracion' ? '⚠ Concentración excesiva' : '⚠ Retraso acumulado'}
                </p>
                <p className={cn("text-xs mt-0.5", a.level === 'danger' ? "text-red-600" : "text-amber-600")}>{a.msg}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ranking de riesgo */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Customer Risk Score</p>
            <p className="text-xs text-slate-400 mt-0.5">Análisis de riesgo por cliente · Exposición total: {fmt(totalExposure)}</p>
          </div>
          <Users className="w-4 h-4 text-slate-300" />
        </div>

        {clientRisks.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-10">Sin datos de riesgo — no hay facturas pendientes.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {clientRisks.map((c, i) => {
              const rc = RISK_CFG[c.riesgo];
              return (
                <div key={i} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-lg border", rc.badge)}>{rc.label}</span>
                      </div>
                      {c.nif && <p className="text-[10px] text-slate-400">{c.nif}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">{fmt(c.pendiente)}</p>
                      <p className="text-[10px] text-slate-400">pendiente</p>
                    </div>
                  </div>
                  {/* Score bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", rc.bar)} style={{ width: `${c.score}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 w-12 text-right">Score {c.score}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-[10px] text-slate-400">{c.facturas.length} facturas totales</span>
                    {c.retrasos > 0 && <span className="text-[10px] text-amber-600 font-medium">{c.retrasos} con retraso</span>}
                    {c.maxRetraso > 0 && <span className="text-[10px] text-red-500 font-medium">Máx. {c.maxRetraso}d</span>}
                    <span className="text-[10px] text-slate-400">{c.concentracion}% de ingresos</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
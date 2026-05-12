import { cn } from '@/lib/utils';
import { CheckCircle, Clock, PauseCircle, XCircle, ExternalLink, TrendingUp } from 'lucide-react';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0);
}

const ESTADO_CFG = {
  activo: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Activo' },
  pausado: { icon: PauseCircle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Pausado' },
  negociacion: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: 'Negociación' },
  inactivo: { icon: XCircle, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200', label: 'Inactivo' },
};

export default function PartnerDashboard({ partners, clicks, kpis, onRefresh }) {
  const totalPayoutPendiente = partners.reduce((s, p) => s + (p.payout_pendiente || 0), 0);
  const totalPayoutPagado = partners.reduce((s, p) => s + (p.payout_total || 0), 0);
  const activePartners = partners.filter(p => p.estado === 'activo');

  return (
    <div className="space-y-5">
      {/* Resumen ejecutivo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Partners activos', value: activePartners.length, sub: `${partners.length} totales`, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Total conversiones', value: kpis.totalConversiones, sub: `${kpis.totalClicks} clicks`, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
          { label: 'Payout pendiente', value: fmt(totalPayoutPendiente), sub: 'Por cobrar', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'Total ingresos afiliados', value: fmt(kpis.ingresos + totalPayoutPagado), sub: 'Histórico total', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
        ].map((c, i) => (
          <div key={i} className={cn("bg-white border rounded-2xl p-4 shadow-sm", c.border)}>
            <p className="text-[11px] text-slate-400 mb-1">{c.label}</p>
            <p className={cn("text-xl font-jakarta font-bold", c.color)}>{c.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Lista partners */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-foreground">Estado de partnerships</p>
        </div>
        {partners.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-10">Sin partners configurados. Ve a "Referral Engine" para añadir.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {partners.map(p => {
              const cfg = ESTADO_CFG[p.estado] || ESTADO_CFG.inactivo;
              const StatusIcon = cfg.icon;
              const convRate = (p.total_clicks || 0) > 0
                ? (((p.total_conversiones || 0) / p.total_clicks) * 100).toFixed(1)
                : '0.0';

              return (
                <div key={p.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{p.nombre}</p>
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-lg border flex items-center gap-1", cfg.bg)}>
                            <StatusIcon className={cn("w-2.5 h-2.5", cfg.color)} />{cfg.label}
                          </span>
                          {p.destacado && <span className="text-[9px] bg-amber-400 text-white font-bold px-1.5 py-0.5 rounded-full">DESTACADO</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{p.categoria} · {p.tipo_comision?.replace('_', ' ')}</p>
                      </div>
                    </div>
                    {p.referral_link && p.referral_link !== '#' && (
                      <a href={p.referral_link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 text-xs font-medium flex-shrink-0">
                        <ExternalLink className="w-3 h-3" /> Link
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { label: 'Clicks', value: p.total_clicks || 0 },
                      { label: 'Registros', value: p.total_registros || 0 },
                      { label: 'Conversiones', value: p.total_conversiones || 0 },
                      { label: 'Conv. Rate', value: `${convRate}%` },
                      { label: 'Ingresos', value: fmt(p.ingresos_generados || 0) },
                    ].map((s, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-2 text-center">
                        <p className="text-sm font-bold text-foreground">{s.value}</p>
                        <p className="text-[9px] text-slate-400">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {p.notas_internas && (
                    <p className="text-[10px] text-slate-400 mt-2 italic">{p.notas_internas}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Settings, RefreshCw, CheckCircle, PauseCircle, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const ESTADO_NEXT = { activo: 'pausado', pausado: 'activo', negociacion: 'activo', inactivo: 'activo' };
const ESTADO_COLOR = {
  activo: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  pausado: 'text-amber-600 bg-amber-50 border-amber-200',
  negociacion: 'text-blue-600 bg-blue-50 border-blue-200',
  inactivo: 'text-slate-400 bg-slate-50 border-slate-200',
};

export default function AdminInvestConsole({ partners, onRefresh }) {
  const [updating, setUpdating] = useState(null);

  const handleToggle = async (p) => {
    setUpdating(p.id);
    await base44.entities.InvestmentPartner.update(p.id, { estado: ESTADO_NEXT[p.estado] || 'activo' });
    setUpdating(null);
    onRefresh();
  };

  const handleToggleDestacado = async (p) => {
    setUpdating(p.id + '_d');
    await base44.entities.InvestmentPartner.update(p.id, { destacado: !p.destacado });
    setUpdating(null);
    onRefresh();
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.nombre}" permanentemente?`)) return;
    await base44.entities.InvestmentPartner.delete(p.id);
    onRefresh();
  };

  const handleResetStats = async (p) => {
    if (!window.confirm(`¿Resetear estadísticas de "${p.nombre}"?`)) return;
    await base44.entities.InvestmentPartner.update(p.id, { total_clicks: 0, total_registros: 0, total_conversiones: 0 });
    onRefresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-slate-500" />
        <p className="text-sm font-semibold text-foreground">Admin Investment Console</p>
        <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">PRIVADO</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Control de plataformas partner</p>
          <button onClick={onRefresh} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
        </div>

        {partners.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-10">Sin partners. Añade en "Referral Engine".</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {partners.map(p => (
              <div key={p.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-bold text-foreground">{p.nombre}</p>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-lg border", ESTADO_COLOR[p.estado])}>
                      {p.estado}
                    </span>
                    {p.destacado && <span className="text-[9px] bg-amber-400 text-white font-bold px-1.5 py-0.5 rounded-full">DEST.</span>}
                  </div>
                  <p className="text-[10px] text-slate-400 capitalize">{p.categoria} · {p.tipo_comision?.replace('_', ' ')} · {p.total_clicks || 0} clicks</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle estado */}
                  <button onClick={() => handleToggle(p)} disabled={updating === p.id}
                    title={p.estado === 'activo' ? 'Pausar' : 'Activar'}
                    className={cn("p-1.5 rounded-lg transition-all",
                      p.estado === 'activo' ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}>
                    {p.estado === 'activo' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>

                  {/* Toggle destacado */}
                  <button onClick={() => handleToggleDestacado(p)} disabled={updating === p.id + '_d'}
                    title={p.destacado ? 'Quitar destacado' : 'Marcar destacado'}
                    className={cn("p-1.5 rounded-lg transition-all text-xs font-bold",
                      p.destacado ? "bg-amber-50 text-amber-500 hover:bg-amber-100" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}>
                    ★
                  </button>

                  {/* Reset stats */}
                  <button onClick={() => handleResetStats(p)}
                    title="Resetear estadísticas"
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button onClick={() => handleDelete(p)}
                    title="Eliminar partner"
                    className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info sistema */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-600">Infraestructura futura preparada para:</p>
        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400">
          {['APIs brokers directas', 'Treasury yield automático', 'Open Finance / PSD2', 'Affiliate automation', 'Embedded finance', 'Financial partnerships', 'Investment tracking', 'Wealth management layer', 'Marketplace financiero', 'Scoring financiero', 'Brokers externos', 'Refinancing engine'].map(f => (
            <div key={f} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
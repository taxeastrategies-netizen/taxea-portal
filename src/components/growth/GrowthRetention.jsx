import { useState } from 'react';
import { TrendingDown, TrendingUp, AlertTriangle, Star, Users, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEMO_CLIENTS = [
  { name: 'Autonomo Tech SL', plan: 'Profesional', mrr: 240, months: 14, risk: 'bajo', upsell: 'Modulo financiero', status: 'activo', engagement: 'alto' },
  { name: 'Panaderia Garcia', plan: 'Basico', mrr: 95, months: 3, risk: 'alto', upsell: 'Plan Profesional', status: 'riesgo', engagement: 'bajo' },
  { name: 'Clinica Dental Mar', plan: 'Premium', mrr: 380, months: 22, risk: 'bajo', upsell: 'Modulo RRHH', status: 'activo', engagement: 'alto' },
  { name: 'Ecommerce Moda SL', plan: 'Profesional', mrr: 190, months: 8, risk: 'medio', upsell: 'Logistica + inventario', status: 'activo', engagement: 'medio' },
  { name: 'Reformas Canarias', plan: 'Basico', mrr: 85, months: 2, risk: 'alto', upsell: 'Plan Profesional', status: 'riesgo', engagement: 'bajo' },
  { name: 'Asesoria Medina', plan: 'Premium', mrr: 450, months: 31, risk: 'bajo', upsell: 'Segundo escritorio', status: 'referidor', engagement: 'muy_alto' },
  { name: 'Tienda Surf Lanzarote', plan: 'Basico', mrr: 95, months: 5, risk: 'medio', upsell: 'IGIC + logistica', status: 'activo', engagement: 'medio' },
  { name: 'Gestor Autonomo Pro', plan: 'Profesional', mrr: 180, months: 11, risk: 'bajo', upsell: 'Pack anual', status: 'upsell', engagement: 'alto' },
];

const RISK_COLORS = { bajo: 'text-emerald-600 bg-emerald-50', medio: 'text-amber-600 bg-amber-50', alto: 'text-red-600 bg-red-50' };
const STATUS_COLORS = { activo: 'bg-emerald-100 text-emerald-700', riesgo: 'bg-red-100 text-red-700', referidor: 'bg-purple-100 text-purple-700', upsell: 'bg-blue-100 text-blue-700' };
const ENGAGEMENT_LABELS = { alto: '████', medio: '███░', bajo: '██░░', muy_alto: '█████' };

export default function GrowthRetention() {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? DEMO_CLIENTS : filter === 'riesgo' ? DEMO_CLIENTS.filter(c => c.risk === 'alto') : filter === 'upsell' ? DEMO_CLIENTS.filter(c => c.upsell) : DEMO_CLIENTS;

  const totalMrr = DEMO_CLIENTS.reduce((s, c) => s + c.mrr, 0);
  const churnRisk = DEMO_CLIENTS.filter(c => c.risk === 'alto');
  const upsellOps = DEMO_CLIENTS.filter(c => c.upsell && c.risk === 'bajo');

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-xl font-bold font-jakarta">Retencion y Expansion</h1><p className="text-sm text-muted-foreground">Clientes en riesgo, oportunidades de upsell y base de referidores</p></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'MRR total', value: `${totalMrr.toLocaleString('es-ES')}EUR/mes`, color: 'text-emerald-600' },
          { label: 'En riesgo de baja', value: churnRisk.length, color: 'text-red-600' },
          { label: 'Oportunidades upsell', value: upsellOps.length, color: 'text-blue-600' },
          { label: 'Referidores activos', value: DEMO_CLIENTS.filter(c=>c.status==='referidor').length, color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {[['all', 'Todos'], ['riesgo', 'En riesgo'], ['upsell', 'Upsell']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', filter === v ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground')}>{l}</button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase tracking-wide">
            <th className="text-left p-3">Cliente</th>
            <th className="text-left p-3">Plan</th>
            <th className="text-right p-3">MRR</th>
            <th className="text-left p-3">Meses</th>
            <th className="text-left p-3">Riesgo</th>
            <th className="text-left p-3">Engagement</th>
            <th className="text-left p-3">Accion sugerida</th>
          </tr></thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{c.name}</p>
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', STATUS_COLORS[c.status])}>{c.status}</span>
                  </div>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{c.plan}</td>
                <td className="p-3 text-right font-bold text-emerald-600">{c.mrr}EUR</td>
                <td className="p-3 text-xs">{c.months} meses</td>
                <td className="p-3"><span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', RISK_COLORS[c.risk])}>{c.risk}</span></td>
                <td className="p-3 text-xs font-mono text-primary">{ENGAGEMENT_LABELS[c.engagement]}</td>
                <td className="p-3 text-xs text-muted-foreground">
                  {c.risk === 'alto' ? (
                    <span className="text-red-600 font-medium">Llamada de retencion urgente</span>
                  ) : c.status === 'referidor' ? (
                    <span className="text-purple-600 font-medium">Pedir referido - alta probabilidad</span>
                  ) : c.upsell ? (
                    <span className="text-blue-600 font-medium">Upsell: {c.upsell}</span>
                  ) : (
                    <span>Pedir resena Google</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {churnRisk.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Clientes en riesgo de baja - Accion inmediata</p>
          <div className="space-y-2">
            {churnRisk.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-medium text-red-900">{c.name}</span>
                <span className="text-red-700">{c.mrr}EUR/mes en riesgo</span>
                <span className="text-xs text-red-600 font-medium">Engagement: {c.engagement}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-red-600 mt-2 italic">Contactar en menos de 48h. Ofrecer revision gratuita del servicio.</p>
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart2, Brain, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const INSIGHTS = [
  { id: 1, tipo: 'oportunidad', titulo: 'Referidos: menor volumen, mayor rentabilidad', desc: 'Canal con 11 leads pero 5 cierres (45% conv) y mayor LTV. Cada cliente de referido dura 22 meses vs 14 de Meta Ads.', impacto: 4200, confianza: 85, accion: 'Crear programa formal de referidos con incentivo para clientes activos.' },
  { id: 2, tipo: 'riesgo', titulo: 'Meta Ads: leads baratos, clientes de baja calidad', desc: '98 leads generados, 7 cierres, ROAS 0.8x en campana "Vendes Ganas Poco". Clientes con mayor churn (6.8% vs media 4.2%).', impacto: -2100, confianza: 78, accion: 'Pausar campana especifica. Revisar segmentacion y copy.' },
  { id: 3, tipo: 'oportunidad', titulo: 'Contenido sobre "errores de gestoria" convierte mejor', desc: 'Trafico inferior (-40%) al de "deducciones", pero leads 3x mas cualificados y tasa de cita del 34% vs 12%.', impacto: 1800, confianza: 72, accion: 'Crear 3 variantes del articulo con distintos angulos de "error de gestoria".' },
  { id: 4, tipo: 'riesgo', titulo: 'Plan Basico: margen insuficiente con soporte alto', desc: 'Clientes con >40 facturas/mes en plan Basico (85EUR) consumen 5.2h/mes. Margen negativo a 45EUR/h.', impacto: -1400, confianza: 82, accion: 'Aplicar Pricing Guardrail. Migrar a plan Profesional o limitar soporte.' },
  { id: 5, tipo: 'oportunidad', titulo: 'Segmento SL: subvalorado y con mayor LTV', desc: 'Solo 30% de cartera son SL pero generan 55% del MRR. Su LTV es 2.4x el de autonomos.', impacto: 5600, confianza: 88, accion: 'Crear landing especifica SL, campana Google Ads y propuesta diferenciada.' },
  { id: 6, tipo: 'oportunidad', titulo: 'Lead magnet "Checklist IGIC" atrae mejores leads', desc: 'Leads que descargan el checklist IGIC tienen 22% tasa de cita vs 8% de los otros lead magnets.', impacto: 960, confianza: 70, accion: 'Crear mas lead magnets especificos (calculadora IGIC, guia REF Canarias).' },
];

const TIPO_COLORS = { oportunidad: 'border-emerald-200 bg-emerald-50', riesgo: 'border-red-200 bg-red-50' };
const TIPO_ICON = { oportunidad: <TrendingUp className="w-4 h-4 text-emerald-600" />, riesgo: <TrendingDown className="w-4 h-4 text-red-600" /> };

export default function RevenueIntelligence() {
  const [filter, setFilter] = useState('all');
  const [aiPlan, setAiPlan] = useState('');
  const [loading, setLoading] = useState(false);

  const filtered = filter === 'all' ? INSIGHTS : INSIGHTS.filter(i => i.tipo === filter);
  const totalOpp = INSIGHTS.filter(i => i.tipo === 'oportunidad').reduce((s, i) => s + i.impacto, 0);
  const totalRisk = Math.abs(INSIGHTS.filter(i => i.tipo === 'riesgo').reduce((s, i) => s + i.impacto, 0));

  const generatePlan = async () => {
    setLoading(true);
    const top = INSIGHTS.slice(0, 4).map(i => `- ${i.titulo}: ${i.accion}`).join('\n');
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres el Director de Revenue de Taxea. Basandote en estos insights de Revenue Intelligence:\n\n${top}\n\nOportunidad total estimada: ${totalOpp.toLocaleString('es-ES')}EUR\nRiesgo estimado: ${totalRisk.toLocaleString('es-ES')}EUR\n\nGenera un plan de accion de 30 dias con las 5 acciones de mayor impacto, ordenadas por prioridad. Borrador.`,
    });
    setAiPlan(typeof res === 'string' ? res : res?.response || '');
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div><h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><BarChart2 className="w-5 h-5 text-blue-600" />Revenue Intelligence Center</h1><p className="text-sm text-muted-foreground">Convierte datos dispersos en decisiones de crecimiento accionables</p></div>
        <Button onClick={generatePlan} disabled={loading} size="sm" className="gap-2">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}Plan 30 dias
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-emerald-600">+{totalOpp.toLocaleString('es-ES')}€</p>
          <p className="text-xs text-emerald-700 mt-1">Oportunidad estimada</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-red-600">-{totalRisk.toLocaleString('es-ES')}€</p>
          <p className="text-xs text-red-700 mt-1">Riesgo estimado</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-foreground">{INSIGHTS.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Insights detectados</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[['all','Todos'],['oportunidad','Oportunidades'],['riesgo','Riesgos']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', filter===v ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground')}>{l}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(insight => (
          <div key={insight.id} className={cn('border rounded-xl p-4', TIPO_COLORS[insight.tipo])}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{TIPO_ICON[insight.tipo]}</div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-semibold text-sm">{insight.titulo}</p>
                  <span className={cn('text-xs font-bold ml-2 shrink-0', insight.tipo === 'oportunidad' ? 'text-emerald-600' : 'text-red-600')}>
                    {insight.tipo === 'oportunidad' ? '+' : ''}{insight.impacto.toLocaleString('es-ES')}€
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{insight.desc}</p>
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold text-primary">→ {insight.accion}</p>
                  <span className="text-xs text-muted-foreground ml-auto">Confianza: {insight.confianza}%</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {aiPlan && (
        <div className="bg-slate-900 text-white rounded-2xl p-5">
          <p className="text-xs text-white/40 mb-2">Plan 30 dias — Borrador IA</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiPlan}</p>
        </div>
      )}
    </div>
  );
}
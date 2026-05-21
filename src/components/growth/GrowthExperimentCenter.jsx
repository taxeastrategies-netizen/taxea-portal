import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, FlaskConical, Target, Loader2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  idea: 'bg-slate-100 text-slate-600', en_analisis: 'bg-blue-100 text-blue-700',
  priorizada: 'bg-indigo-100 text-indigo-700', en_ejecucion: 'bg-amber-100 text-amber-700',
  test_activo: 'bg-orange-100 text-orange-700', ganadora: 'bg-emerald-100 text-emerald-700',
  perdedora: 'bg-red-100 text-red-600', escalada: 'bg-purple-100 text-purple-700',
  archivada: 'bg-gray-100 text-gray-500',
};

const DEMO_EXPERIMENTS = [
  { id: 'd1', hypothesis: 'Si añadimos un testimonio en la landing aumentará la conversión', type: 'landing_ab', channel: 'meta_ads', metric: 'Conversión de landing', variant_a: 'Landing actual sin testimonios', variant_b: 'Landing con 3 testimonios de clientes', status: 'ganadora', impact_score: 8, confidence_score: 7, effort_score: 3, category: 'landing', result: '+34% conversión con variante B', learning: 'La prueba social funciona en este segmento. Siempre incluir testimonios.', revenue_impact_eur: 2400 },
  { id: 'd2', hypothesis: 'Un hook de miedo (riesgo fiscal) genera más CTR que un hook de beneficio', type: 'hook_ab', channel: 'meta_ads', metric: 'CTR del anuncio', variant_a: '"Controla tu fiscalidad"', variant_b: '"¿Sabes cuánto le pagas de más a Hacienda?"', status: 'ganadora', impact_score: 7, confidence_score: 8, effort_score: 2, category: 'ads', result: 'CTR +52% con variante B (hook de dolor)', learning: 'El miedo a pagar de más convierte mejor que el beneficio genérico.', revenue_impact_eur: 1800 },
  { id: 'd3', hypothesis: 'Reducir campos del formulario de 8 a 4 aumentará conversiones', type: 'landing_ab', channel: 'google_ads', metric: 'Envíos de formulario', variant_a: 'Formulario con 8 campos', variant_b: 'Formulario con 4 campos', status: 'en_ejecucion', impact_score: 9, confidence_score: 9, effort_score: 2, category: 'conversion' },
  { id: 'd4', hypothesis: 'Ofrecer diagnóstico gratuito como CTA convierte más que "solicitar presupuesto"', type: 'cta_ab', channel: 'google_ads', metric: 'Clicks en CTA', variant_a: '"Solicitar presupuesto"', variant_b: '"Diagnóstico gratuito"', status: 'test_activo', impact_score: 8, confidence_score: 7, effort_score: 1, category: 'conversion' },
  { id: 'd5', hypothesis: 'El email de seguimiento a las 24h tiene mejor tasa de apertura que a las 72h', type: 'email_subject_ab', channel: 'email', metric: 'Tasa de apertura', variant_a: 'Envío a las 72h', variant_b: 'Envío a las 24h', status: 'priorizada', impact_score: 6, confidence_score: 7, effort_score: 2, category: 'email' },
  { id: 'd6', hypothesis: 'WhatsApp con audio de voz tiene más respuestas que texto', type: 'whatsapp_ab', channel: 'whatsapp', metric: 'Tasa de respuesta', variant_a: 'Mensaje de texto', variant_b: 'Nota de voz personalizada', status: 'idea', impact_score: 7, confidence_score: 4, effort_score: 4, category: 'whatsapp' },
];

const DEMO_BACKLOG = [
  { id: 'b1', title: 'Añadir contador de urgencia en landing principal', category: 'landing', status: 'priorizada', impact: 'alto', effort: 'bajo', revenue_impact_eur: 3200 },
  { id: 'b2', title: 'Crear calculadora de IGIC para Canarias como lead magnet', category: 'lead_magnet', status: 'en_analisis', impact: 'alto', effort: 'medio', revenue_impact_eur: 2100 },
  { id: 'b3', title: 'Mejorar la secuencia de email post-descarga (3 emails en 7 días)', category: 'email', status: 'en_ejecucion', impact: 'medio', effort: 'bajo', revenue_impact_eur: 1500 },
  { id: 'b4', title: 'Implementar chat de WhatsApp directo en landing', category: 'conversion', status: 'idea', impact: 'alto', effort: 'bajo', revenue_impact_eur: 2800 },
  { id: 'b5', title: 'Crear página de precios pública con comparativa', category: 'conversion', status: 'idea', impact: 'medio', effort: 'medio', revenue_impact_eur: 1200 },
  { id: 'b6', title: 'Publicar 3 casos de éxito de clientes en LinkedIn', category: 'contenido', status: 'priorizada', impact: 'alto', effort: 'bajo', revenue_impact_eur: 1800 },
  { id: 'b7', title: 'Segmentar email list por tipo de cliente y enviar nurturing diferente', category: 'email', status: 'en_analisis', impact: 'alto', effort: 'medio', revenue_impact_eur: 2200 },
  { id: 'b8', title: 'Test A/B: página de inicio con video vs sin video', category: 'landing', status: 'idea', impact: 'medio', effort: 'alto', revenue_impact_eur: 1400 },
  { id: 'b9', title: 'Activar remarketing de visitantes de pricing que no convirtieron', category: 'ads', status: 'idea', impact: 'alto', effort: 'bajo', revenue_impact_eur: 3500 },
  { id: 'b10', title: 'Añadir sección de preguntas frecuentes en landing', category: 'landing', status: 'priorizada', impact: 'medio', effort: 'bajo', revenue_impact_eur: 900 },
  { id: 'b11', title: 'Script automatizado de seguimiento de propuestas no respondidas', category: 'conversion', status: 'en_analisis', impact: 'alto', effort: 'bajo', revenue_impact_eur: 2600 },
  { id: 'b12', title: 'Crear programa formal de referidos con incentivos', category: 'referidos', status: 'idea', impact: 'alto', effort: 'medio', revenue_impact_eur: 4200 },
];

function ExperimentCard({ exp, onClick }) {
  const ice = Math.round((exp.impact_score + exp.confidence_score) / (exp.effort_score || 1) * 10) / 10;
  return (
    <div className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all" onClick={onClick}>
      <div className="flex items-start gap-2 mb-3">
        <FlaskConical className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1"><p className="text-sm font-semibold">{exp.hypothesis}</p><p className="text-xs text-muted-foreground mt-0.5 capitalize">{exp.channel} · {exp.type?.replace(/_/g,' ')}</p></div>
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0', STATUS_COLORS[exp.status] || STATUS_COLORS.idea)}>{exp.status?.replace(/_/g,' ')}</span>
      </div>
      {(exp.variant_a || exp.variant_b) && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {exp.variant_a && <div className="bg-secondary/50 rounded-lg p-2 text-xs"><span className="font-semibold text-muted-foreground">A:</span> {exp.variant_a}</div>}
          {exp.variant_b && <div className="bg-secondary/50 rounded-lg p-2 text-xs"><span className="font-semibold text-muted-foreground">B:</span> {exp.variant_b}</div>}
        </div>
      )}
      {exp.result && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs text-emerald-800 mb-2">✓ {exp.result}</div>}
      {exp.learning && <p className="text-xs text-muted-foreground italic mb-2">💡 {exp.learning}</p>}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted-foreground">ICE: <span className="font-bold text-foreground">{ice}</span></span>
        {exp.revenue_impact_eur > 0 && <span className="text-emerald-600 font-semibold">+{exp.revenue_impact_eur.toLocaleString('es-ES')}€</span>}
      </div>
    </div>
  );
}

export default function GrowthExperimentCenter() {
  const { company } = useOutletContext() || {};
  const [experiments, setExperiments] = useState(DEMO_EXPERIMENTS);
  const [backlog, setBacklog] = useState(DEMO_BACKLOG);
  const [tab, setTab] = useState('experiments');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredExp = filterStatus === 'all' ? experiments : experiments.filter(e => e.status === filterStatus);
  const totalImpact = backlog.reduce((s, b) => s + (b.revenue_impact_eur || 0), 0);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-jakarta">Growth Lab</h1>
        <p className="text-sm text-muted-foreground">Experimentos A/B, hipótesis y backlog de acciones de crecimiento</p>
      </div>

      <div className="flex gap-0 border-b border-border">
        {[['experiments', 'Experimentos', FlaskConical], ['backlog', 'Backlog Growth', Target]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all', tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === 'experiments' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select className="h-8 text-sm rounded-md border border-input bg-transparent px-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">Todos los estados</option>
              {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
            <div className="flex gap-2 ml-auto">
              {['test_activo','ganadora','perdedora'].map(s => (
                <div key={s} className={cn('px-3 py-1 rounded-lg text-xs font-semibold', STATUS_COLORS[s])}>
                  {experiments.filter(e=>e.status===s).length} {s.replace(/_/g,' ')}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredExp.map(exp => <ExperimentCard key={exp.id} exp={exp} onClick={() => {}} />)}
          </div>
        </div>
      )}

      {tab === 'backlog' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
              <p className="text-xs text-emerald-600 font-medium">Impacto potencial total</p>
              <p className="text-lg font-bold text-emerald-700">+{totalImpact.toLocaleString('es-ES')}€</p>
            </div>
            <div className="text-xs text-muted-foreground">{backlog.length} ideas en el backlog · {backlog.filter(b=>b.status!=='archivada').length} activas</div>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-secondary/30 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left p-3">Tarea Growth</th>
                <th className="text-left p-3">Categoría</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-left p-3">Impacto</th>
                <th className="text-left p-3">Esfuerzo</th>
                <th className="text-right p-3">€ potencial</th>
              </tr></thead>
              <tbody>
                {[...backlog].sort((a, b) => (b.revenue_impact_eur || 0) - (a.revenue_impact_eur || 0)).map((item, i) => (
                  <tr key={item.id || i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="p-3 font-medium">{item.title}</td>
                    <td className="p-3 text-xs text-muted-foreground capitalize">{item.category}</td>
                    <td className="p-3"><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[item.status] || STATUS_COLORS.idea)}>{item.status?.replace(/_/g,' ')}</span></td>
                    <td className="p-3"><span className={cn('text-xs font-semibold', item.impact==='alto'?'text-emerald-600':item.impact==='medio'?'text-amber-600':'text-slate-500')}>{item.impact}</span></td>
                    <td className="p-3"><span className={cn('text-xs font-semibold', item.effort==='bajo'?'text-emerald-600':item.effort==='medio'?'text-amber-600':'text-red-600')}>{item.effort}</span></td>
                    <td className="p-3 text-right font-bold text-emerald-600">+{(item.revenue_impact_eur||0).toLocaleString('es-ES')}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Zap, Brain, Loader2, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEMO_TASKS = [
  { id: 1, tarea: 'Corregir CTA y formulario landing principal', canal: 'landing', esfuerzo: 'bajo', impacto: 9, confianza: 8, urgencia: 9, coste: 0, funnel: 'MOFU', metrica: 'Conversion landing', potencial_eur: 3200, ice: 0 },
  { id: 2, tarea: 'Activar WhatsApp automatico tras formulario (<10 min)', canal: 'whatsapp', esfuerzo: 'bajo', impacto: 9, confianza: 9, urgencia: 8, coste: 0, funnel: 'MOFU-BOFU', metrica: 'Lead->cita', potencial_eur: 2800, ice: 0 },
  { id: 3, tarea: 'Crear campana referidos para clientes activos', canal: 'referidos', esfuerzo: 'medio', impacto: 8, confianza: 7, urgencia: 6, coste: 200, funnel: 'TOFU', metrica: 'Nuevos leads', potencial_eur: 4200, ice: 0 },
  { id: 4, tarea: 'Publicar articulo pilar "Alta autonomo IGIC Canarias"', canal: 'seo', esfuerzo: 'medio', impacto: 8, confianza: 6, urgencia: 5, coste: 300, funnel: 'BOFU', metrica: 'Trafico organico', potencial_eur: 1800, ice: 0 },
  { id: 5, tarea: 'Pausar Meta Ads campana "Vendes Ganas Poco" — ROAS 0.8x', canal: 'meta_ads', esfuerzo: 'bajo', impacto: 6, confianza: 9, urgencia: 9, coste: 0, funnel: '-', metrica: 'ROAS', potencial_eur: 1400, ice: 0 },
  { id: 6, tarea: 'Crear secuencia email onboarding (5 emails, 30 dias)', canal: 'email', esfuerzo: 'medio', impacto: 7, confianza: 7, urgencia: 5, coste: 150, funnel: 'Post-venta', metrica: 'Churn 30d', potencial_eur: 960, ice: 0 },
  { id: 7, tarea: 'Escalar Google Ads "Diagnostico Fiscal Canarias" (+500EUR/mes)', canal: 'google_ads', esfuerzo: 'bajo', impacto: 9, confianza: 9, urgencia: 7, coste: 500, funnel: 'BOFU', metrica: 'Leads cualificados', potencial_eur: 3900, ice: 0 },
  { id: 8, tarea: 'Implementar seguimiento propuestas (recordatorio 48h)', canal: 'ventas', esfuerzo: 'bajo', impacto: 8, confianza: 8, urgencia: 7, coste: 0, funnel: 'BOFU', metrica: 'Aceptacion propuesta', potencial_eur: 2400, ice: 0 },
  { id: 9, tarea: 'Crear lead magnet PDF "Checklist deducciones autonomo"', canal: 'seo+email', esfuerzo: 'medio', impacto: 6, confianza: 6, urgencia: 4, coste: 200, funnel: 'TOFU-MOFU', metrica: 'Lead magnet descargas', potencial_eur: 800, ice: 0 },
  { id: 10, tarea: 'Grabar video testimonial cliente (formato reel)', canal: 'social', esfuerzo: 'bajo', impacto: 5, confianza: 5, urgencia: 3, coste: 0, funnel: 'TOFU', metrica: 'Confianza/conversion', potencial_eur: 600, ice: 0 },
  { id: 11, tarea: 'Optimizar pagina precios: mostrar valor, no solo precio', canal: 'landing', esfuerzo: 'bajo', impacto: 7, confianza: 7, urgencia: 6, coste: 0, funnel: 'BOFU', metrica: 'Conversion propuesta', potencial_eur: 1600, ice: 0 },
  { id: 12, tarea: 'Configurar retargeting Google/Meta para visitantes sin conversion', canal: 'retargeting', esfuerzo: 'medio', impacto: 6, confianza: 6, urgencia: 5, coste: 300, funnel: 'MOFU-BOFU', metrica: 'Recovery rate', potencial_eur: 1100, ice: 0 },
];

const ESFUERZO_SCORES = { bajo: 9, medio: 5, alto: 2 };

const calcIce = (t) => {
  const impact = t.impacto;
  const confidence = t.confianza;
  const ease = ESFUERZO_SCORES[t.esfuerzo];
  return Math.round((impact + confidence + ease) / 3 * 10) / 10;
};

const CANAL_COLORS = {
  landing: 'bg-blue-100 text-blue-700', whatsapp: 'bg-green-100 text-green-700',
  referidos: 'bg-purple-100 text-purple-700', seo: 'bg-emerald-100 text-emerald-700',
  meta_ads: 'bg-indigo-100 text-indigo-700', email: 'bg-amber-100 text-amber-700',
  google_ads: 'bg-red-100 text-red-700', ventas: 'bg-orange-100 text-orange-700',
  'seo+email': 'bg-teal-100 text-teal-700', social: 'bg-pink-100 text-pink-700',
  retargeting: 'bg-cyan-100 text-cyan-700',
};

export default function RevenueTaskPrioritizer() {
  const [method, setMethod] = useState('ice');
  const [aiPlan, setAiPlan] = useState('');
  const [loading, setLoading] = useState(false);

  const tasks = DEMO_TASKS.map(t => ({ ...t, ice: calcIce(t) })).sort((a, b) => {
    if (method === 'ice') return b.ice - a.ice;
    if (method === 'revenue') return b.potencial_eur - a.potencial_eur;
    if (method === 'esfuerzo') return ESFUERZO_SCORES[b.esfuerzo] - ESFUERZO_SCORES[a.esfuerzo];
    return b.urgencia - a.urgencia;
  });

  const generatePlan = async () => {
    setLoading(true);
    const top5 = tasks.slice(0, 5).map(t => `- ${t.tarea} (ICE: ${t.ice}, Potencial: ${t.potencial_eur}EUR)`).join('\n');
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres el Growth Director de una asesoria fiscal. Crea un plan de accion semanal con estas 5 tareas prioritarias:\n\n${top5}\n\nGenera:\n1. Orden de ejecucion optimo con justificacion\n2. Responsables sugeridos (marketing, ventas, tecnico)\n3. Tiempo estimado total\n4. Metrica de exito por tarea\n5. Alerta si alguna tarea depende de otra\n\nBrief ejecutivo, maximo 300 palabras. Borrador.`,
    });
    setAiPlan(typeof res === 'string' ? res : res?.response || '');
    setLoading(false);
  };

  const prio = (ice) => ice >= 8 ? 'critica' : ice >= 6.5 ? 'alta' : ice >= 5 ? 'media' : 'baja';
  const PRIO_COLORS = { critica: 'bg-red-100 text-red-700', alta: 'bg-amber-100 text-amber-700', media: 'bg-blue-100 text-blue-700', baja: 'bg-slate-100 text-slate-600' };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div><h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" />Revenue Task Prioritizer</h1><p className="text-sm text-muted-foreground">Prioriza tareas de Growth segun impacto esperado en ingresos — metodo ICE, RICE y urgencia</p></div>
        <Button onClick={generatePlan} disabled={loading} className="gap-2 shrink-0" size="sm">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}Plan semanal IA
        </Button>
      </div>

      <div className="flex gap-2">
        {[['ice','ICE Score'],['revenue','Potencial EUR'],['esfuerzo','Facilidad'],['urgencia','Urgencia']].map(([v,l]) => (
          <button key={v} onClick={() => setMethod(v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', method===v ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground')}>{l}</button>
        ))}
      </div>

      <div className="space-y-2">
        {tasks.map((t, i) => (
          <div key={t.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-all">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{t.tarea}</p>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', PRIO_COLORS[prio(t.ice)])}>{prio(t.ice)}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded', CANAL_COLORS[t.canal] || 'bg-slate-100 text-slate-600')}>{t.canal}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>ICE: <strong className="text-foreground">{t.ice}</strong></span>
                  <span>Potencial: <strong className="text-emerald-600">{t.potencial_eur.toLocaleString('es-ES')}EUR</strong></span>
                  <span>Esfuerzo: {t.esfuerzo}</span>
                  <span>Funnel: {t.funnel}</span>
                  <span>Metrica: {t.metrica}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {aiPlan && (
        <div className="bg-slate-900 text-white rounded-2xl p-5">
          <p className="text-xs text-white/40 mb-2">Plan semanal IA — Borrador, requiere validacion</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiPlan}</p>
        </div>
      )}
    </div>
  );
}
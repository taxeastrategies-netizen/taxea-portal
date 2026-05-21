import { useState } from 'react';
import { AlertTriangle, CheckCircle2, AlertCircle, TrendingDown, DollarSign, Brain, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FUNNEL_STAGES = [
  { id: 'impressions', label: 'Impresiones', value: 48200, prev: 45000, benchmark: null, cost: 1800, unit: '' },
  { id: 'clicks', label: 'Clics', value: 1930, prev: 1820, benchmark: null, cost: null, unit: '' },
  { id: 'landing', label: 'Visita landing', value: 1640, prev: 1540, benchmark: null, cost: null, unit: '' },
  { id: 'form_started', label: 'Formulario iniciado', value: 410, prev: 450, benchmark: 35, cost: null, unit: '%' },
  { id: 'form_sent', label: 'Formulario enviado', value: 247, prev: 280, benchmark: 60, cost: null, unit: '%' },
  { id: 'qualified', label: 'Lead cualificado', value: 118, prev: 130, benchmark: 55, cost: null, unit: '%' },
  { id: 'appointment', label: 'Cita agendada', value: 62, prev: 74, benchmark: 55, cost: null, unit: '%' },
  { id: 'appointment_done', label: 'Cita realizada', value: 51, prev: 60, benchmark: 85, cost: null, unit: '%' },
  { id: 'proposal', label: 'Propuesta enviada', value: 37, prev: 42, benchmark: 75, cost: null, unit: '%' },
  { id: 'accepted', label: 'Propuesta aceptada', value: 27, prev: 29, benchmark: 60, cost: null, unit: '%' },
  { id: 'onboarding', label: 'Alta + Onboarding', value: 24, prev: 26, benchmark: 90, cost: null, unit: '%' },
];

const TICKET = 240; // EUR/mes MRR medio

function getConv(stage, idx, stages) {
  if (idx === 0) return 100;
  return Math.round(stage.value / stages[idx - 1].value * 100 * 10) / 10;
}

function getSeverity(conv, benchmark) {
  if (!benchmark) return 'ok';
  if (conv >= benchmark * 0.9) return 'ok';
  if (conv >= benchmark * 0.7) return 'warning';
  return 'critical';
}

const SEV_COLORS = { ok: 'bg-emerald-500', warning: 'bg-amber-400', critical: 'bg-red-500' };
const SEV_BG = { ok: 'border-emerald-200 bg-emerald-50/30', warning: 'border-amber-200 bg-amber-50/30', critical: 'border-red-200 bg-red-50/50' };
const SEV_LABELS = { ok: 'Sano', warning: 'Perdida moderada', critical: 'Fuga critica' };

const CAUSES = {
  form_started: 'Landing sin CTA claro o propuesta de valor debil.',
  form_sent: 'Formulario demasiado largo o solicita datos sensibles prematuramente.',
  qualified: 'Trafico de baja calidad o segmentacion incorrecta.',
  appointment: 'Friccion en el proceso de agendado. Sin calendario visible tras formulario.',
  appointment_done: 'Recordatorios insuficientes. Alta tasa de no-show.',
  proposal: 'Asesor sin tiempo para propuesta inmediata. Retrasos en el proceso.',
  accepted: 'Precio no defendido, sin argumento de valor claro.',
  onboarding: 'Proceso de alta lento. Cliente pierde confianza.',
};

export default function FunnelLeakDetector() {
  const [aiInsight, setAiInsight] = useState('');
  const [loading, setLoading] = useState(false);

  const leaks = FUNNEL_STAGES.map((s, i) => {
    const conv = getConv(s, i, FUNNEL_STAGES);
    const sev = i > 0 ? getSeverity(conv, FUNNEL_STAGES[i].benchmark ? conv : null) : 'ok';
    const lost = i > 0 ? FUNNEL_STAGES[i - 1].value - s.value : 0;
    const lostRevenue = lost * TICKET * 0.3; // estimated pipeline
    return { ...s, conv, sev, lost, lostRevenue };
  });

  const criticalLeaks = leaks.filter(l => l.sev === 'critical');
  const warnings = leaks.filter(l => l.sev === 'warning');
  const totalLostRevenue = leaks.reduce((s, l) => s + l.lostRevenue, 0);

  const generateInsight = async () => {
    setLoading(true);
    const summary = FUNNEL_STAGES.slice(1).map((s, i) => {
      const conv = getConv(s, i + 1, FUNNEL_STAGES);
      return `${s.label}: ${conv}% conv`;
    }).join(', ');
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto en optimizacion de embudos de ventas para asesorias fiscales. Analiza este embudo y da las 3 acciones prioritarias con mayor impacto economico:\n\n${summary}\n\nIngreso medio por cliente: 240EUR/mes. Leads totales: 247.\n\nIdentifica la fuga principal, calcula el impacto economico y recomienda la accion concreta con mayor ROI. Responde en maximo 4 parrafos. Marca estimaciones claramente.`,
    });
    setAiInsight(typeof res === 'string' ? res : res?.response || '');
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold font-jakarta">Funnel Leak Detector</h1>
          <p className="text-sm text-muted-foreground">Detecta donde se pierden leads y cuanto dinero representa cada fuga</p>
        </div>
        <Button onClick={generateInsight} disabled={loading} className="gap-2 shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          Analizar con IA
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{criticalLeaks.length}</p>
          <p className="text-xs text-red-700 mt-1">Fugas criticas</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{warnings.length}</p>
          <p className="text-xs text-amber-700 mt-1">Perdidas moderadas</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{Math.round(totalLostRevenue / 1000)}K EUR</p>
          <p className="text-xs text-muted-foreground mt-1">Pipeline perdido (est.)</p>
        </div>
      </div>

      {/* Funnel Visual */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold mb-4">Mapa de fugas del embudo</p>
        <div className="space-y-2">
          {leaks.map((stage, i) => {
            const barWidth = Math.round(stage.value / leaks[0].value * 100);
            return (
              <div key={stage.id} className={cn('rounded-xl border p-3', i > 0 ? SEV_BG[stage.sev] : 'bg-emerald-50/30 border-emerald-200')}>
                <div className="flex items-center gap-3 mb-1.5">
                  <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', i > 0 ? SEV_COLORS[stage.sev] : 'bg-emerald-500')} />
                  <span className="text-sm font-medium flex-1">{stage.label}</span>
                  <span className="text-sm font-bold">{stage.value.toLocaleString('es-ES')}</span>
                  {i > 0 && <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', stage.sev === 'critical' ? 'bg-red-100 text-red-700' : stage.sev === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>{stage.conv}%</span>}
                </div>
                <div className="h-4 bg-black/5 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', i > 0 ? SEV_COLORS[stage.sev] : 'bg-emerald-500')} style={{ width: `${barWidth}%`, opacity: 0.7 }} />
                </div>
                {i > 0 && stage.sev !== 'ok' && CAUSES[stage.id] && (
                  <p className="text-xs text-muted-foreground mt-1.5 italic">
                    <span className="font-semibold not-italic text-foreground">Causa probable:</span> {CAUSES[stage.id]}
                    {stage.lostRevenue > 0 && <span className="ml-2 font-semibold text-red-600">~{Math.round(stage.lostRevenue).toLocaleString('es-ES')}EUR pipeline</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical leaks detail */}
      {criticalLeaks.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500" />Fugas criticas — Accion inmediata</p>
          <div className="space-y-3">
            {criticalLeaks.filter(l => CAUSES[l.id]).map(l => (
              <div key={l.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-red-900">{l.label}</p>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">{l.conv}% conversion</span>
                </div>
                <p className="text-sm text-red-800 mb-2">{CAUSES[l.id]}</p>
                <p className="text-xs text-red-600">Pipeline en riesgo: <strong>~{Math.round(l.lostRevenue).toLocaleString('es-ES')}EUR</strong> (estimado)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insight */}
      {aiInsight && (
        <div className="bg-slate-900 text-white rounded-2xl p-5">
          <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5"><Brain className="w-3 h-3" />Analisis IA — Estimacion, requiere validacion</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
        </div>
      )}
    </div>
  );
}
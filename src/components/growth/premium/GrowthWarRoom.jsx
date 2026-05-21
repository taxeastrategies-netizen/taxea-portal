import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Zap, TrendingUp, TrendingDown, AlertTriangle, Brain, Loader2, Target, CheckCircle2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PERIOD_DATA = {
  semanal: {
    mrr: 6480, cac: 84, ltv: 3840, payback: 2.1,
    objetivo: 8000, avance: 81, riesgo: 'medio',
    canales_ok: ['Google Ads', 'Referidos', 'SEO'],
    canales_pausar: ['Meta Ads Vendes-Ganas-Poco'],
    fugas: ['Lead->Cita: 26% (benchmark 55%)', 'Propuesta->Cierre: 73% (bueno)'],
    upsell: ['Clinica Dental Gomez - Modulo RRHH', 'Asesoria Medina - Pack Premium'],
    churn_riesgo: ['Panaderia Garcia (3 meses)', 'Reformas Canarias (2 meses)'],
    tareas_criticas: ['Corregir CTA landing', 'Activar WA tras formulario', 'Seguimiento propuestas 48h'],
  },
  mensual: {
    mrr: 6480, cac: 84, ltv: 3840, payback: 2.1,
    objetivo: 10000, avance: 65, riesgo: 'alto',
    canales_ok: ['Google Ads', 'Referidos'],
    canales_pausar: ['Meta Ads - ROAS < 1'],
    fugas: ['Formulario->Lead: 60%', 'Cita->Propuesta: 59%'],
    upsell: ['3 clientes en plan Basico con 12+ meses'],
    churn_riesgo: ['2 clientes < 3 meses con baja actividad'],
    tareas_criticas: ['Lanzar campana referidos', 'Publicar IGIC article', 'Onboarding call para nuevos'],
  },
  trimestral: {
    mrr: 6480, cac: 84, ltv: 3840, payback: 2.1,
    objetivo: 12000, avance: 54, riesgo: 'alto',
    canales_ok: ['SEO (organico creciendo)', 'Google Ads'],
    canales_pausar: ['TikTok (sin datos)'],
    fugas: ['SEO: trafico sin conversion BOFU'],
    upsell: ['Segmento SL: subvalorado, 80% en plan Basico'],
    churn_riesgo: ['Churn 4.2% sobre objetivo 3%'],
    tareas_criticas: ['Plan contenido SEO Q3', 'Crear landing SL', 'Programa referidos'],
  },
};

const RIESGO_COLOR = { bajo: 'text-emerald-600 bg-emerald-50', medio: 'text-amber-600 bg-amber-50', alto: 'text-red-600 bg-red-50' };

export default function GrowthWarRoom() {
  const { company } = useOutletContext() || {};
  const [period, setPeriod] = useState('semanal');
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const d = PERIOD_DATA[period];

  const generateReport = async () => {
    setLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres el Director de Growth de "${company?.nombre || 'Taxea'}". Genera un informe ejecutivo brevísimo (War Room ${period}) basado en estos datos:\n\nMRR: ${d.mrr}EUR | CAC: ${d.cac}EUR | LTV: ${d.ltv}EUR | Objetivo: ${d.objetivo}EUR | Avance: ${d.avance}% | Riesgo: ${d.riesgo}\nCanales OK: ${d.canales_ok.join(', ')}\nFugas: ${d.fugas.join(', ')}\nRiesgos churn: ${d.churn_riesgo.join(', ')}\nTareas críticas: ${d.tareas_criticas.join(', ')}\n\nFormato: 5 bullets ejecutivos. Tono director. Sin adornos. Marca estimaciones.`,
    });
    setReport(typeof res === 'string' ? res : res?.response || '');
    setLoading(false);
  };

  const pct = d.avance;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold font-jakarta flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />Executive Growth War Room
          </h1>
          <p className="text-sm text-muted-foreground">Vista ejecutiva para decisiones de crecimiento — datos demo marcados</p>
        </div>
        <div className="flex gap-2">
          {['semanal','mensual','trimestral'].map(p => (
            <button key={p} onClick={() => { setPeriod(p); setReport(''); }} className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize', period===p ? 'bg-slate-900 text-white border-slate-900' : 'bg-card border-border text-muted-foreground')}>{p}</button>
          ))}
        </div>
      </div>

      {/* KPIs top */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'MRR', v: `${d.mrr.toLocaleString('es-ES')}€`, icon: DollarSign, good: true },
          { label: 'CAC', v: `${d.cac}€`, icon: Target, good: d.cac < 150 },
          { label: 'LTV', v: `${d.ltv.toLocaleString('es-ES')}€`, icon: TrendingUp, good: true },
          { label: 'Payback', v: `${d.payback}m`, icon: TrendingUp, good: d.payback < 3 },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className={cn('text-xl font-bold', s.good ? 'text-emerald-600' : 'text-red-500')}>{s.v}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Objetivo progress */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex justify-between items-center mb-2">
          <p className="font-semibold text-sm">Objetivo MRR {period}</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{pct}%</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', RIESGO_COLOR[d.riesgo])}>Riesgo {d.riesgo}</span>
          </div>
        </div>
        <div className="h-4 bg-secondary rounded-full overflow-hidden mb-1">
          <div className={cn('h-4 rounded-full transition-all', pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">{d.mrr.toLocaleString('es-ES')}€ de {d.objetivo.toLocaleString('es-ES')}€ objetivo</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Canales */}
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs font-bold text-emerald-800 mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Canales ganadores — Escalar</p>
            {d.canales_ok.map(c => <p key={c} className="text-sm text-emerald-900 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{c}</p>)}
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs font-bold text-red-800 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Pausar / Revisar</p>
            {d.canales_pausar.map(c => <p key={c} className="text-sm text-red-900 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{c}</p>)}
          </div>
        </div>

        {/* Retención y upsell */}
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-800 mb-2">Riesgo de baja</p>
            {d.churn_riesgo.map(c => <p key={c} className="text-sm text-amber-900">{c}</p>)}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-bold text-blue-800 mb-2">Oportunidades upsell</p>
            {d.upsell.map(c => <p key={c} className="text-sm text-blue-900">{c}</p>)}
          </div>
        </div>
      </div>

      {/* Tareas críticas */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Tareas criticas ahora</p>
        <div className="space-y-2">
          {d.tareas_criticas.map((t, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold flex-shrink-0">{i+1}</div>
              <p className="text-sm font-medium">{t}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={generateReport} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          Generar informe ejecutivo IA
        </Button>
      </div>

      {report && (
        <div className="bg-slate-900 text-white rounded-2xl p-5">
          <p className="text-xs text-white/40 mb-3 uppercase tracking-wide">War Room — Borrador IA</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{report}</p>
        </div>
      )}
    </div>
  );
}
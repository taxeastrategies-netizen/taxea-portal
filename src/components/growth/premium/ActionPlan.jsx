import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Target, Brain, Loader2, Calendar, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const HORIZONS = [
  { key: '7', label: '7 dias', sub: 'Acciones inmediatas de alto impacto' },
  { key: '30', label: '30 dias', sub: 'Plan mensual completo' },
  { key: '90', label: '90 dias', sub: 'Plan trimestral de crecimiento' },
];

const DEFAULT = {
  objetivo: 'Conseguir 10 clientes nuevos y reducir churn a 3%',
  presupuesto: 2000, equipo: '1 comercial + 1 marketing part-time',
  estado: 'MRR actual 6.480EUR, CAC 84EUR, conversion landing 7.8%, WhatsApp 18%',
  restricciones: 'Sin agencia externa. Sin publicar contenido sin revision.',
};

export default function ActionPlan() {
  const { company } = useOutletContext() || {};
  const [form, setForm] = useState(DEFAULT);
  const [horizon, setHorizon] = useState('30');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const generate = async () => {
    setLoading(true);
    setPlan(null);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres el Director de Growth de "${company?.nombre || 'Taxea'}". Genera un plan de accion de ${horizon} dias basado en:\n\nObjetivo: ${form.objetivo}\nPresupuesto: ${form.presupuesto}EUR/mes\nEquipo: ${form.equipo}\nEstado actual: ${form.estado}\nRestricciones: ${form.restricciones}\n\nEstructura del plan:\n\n# PLAN DE ACCION ${horizon} DIAS — ${company?.nombre || 'TAXEA'}\n\n## Prioridades clave\n(3 prioridades con justificacion)\n\n## Acciones por semana\n${horizon === '7' ? '## Dia 1-3\n## Dia 4-7' : horizon === '30' ? '## Semana 1\n## Semana 2\n## Semana 3\n## Semana 4' : '## Mes 1 (detallado)\n## Mes 2 (objetivos)\n## Mes 3 (objetivos)'}\n\n## Campanas a lanzar\n## Contenidos a crear\n## Landings a corregir\n## Seguimientos comerciales\n## Experimentos\n## Metricas de exito\n\n## Riesgos\n## Puntos de revision\n\nTono: ejecutivo, directo, accionable. Cada accion con responsable, metrica y tiempo estimado. BORRADOR.`,
    });
    setPlan(typeof res === 'string' ? res : res?.response || '');
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><Target className="w-5 h-5 text-primary" />Premium Growth Action Plan</h1><p className="text-sm text-muted-foreground">Genera planes de accion ejecutables de 7, 30 o 90 dias basados en tu estado real</p></div>

      <div className="flex gap-3">
        {HORIZONS.map(h => (
          <button key={h.key} onClick={() => setHorizon(h.key)} className={cn('flex-1 border rounded-xl p-3 text-left transition-all', horizon===h.key ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:shadow-sm')}>
            <p className="font-bold text-sm">{h.label}</p>
            <p className="text-xs text-muted-foreground">{h.sub}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Objetivo del plan</label>
          <textarea className="w-full h-20 rounded-xl border border-input bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" value={form.objetivo} onChange={e => set('objetivo', e.target.value)} />
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Estado actual</label>
            <textarea className="w-full h-20 rounded-xl border border-input bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" value={form.estado} onChange={e => set('estado', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Equipo disponible</label>
          <input className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={form.equipo} onChange={e => set('equipo', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Restricciones</label>
          <input className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={form.restricciones} onChange={e => set('restricciones', e.target.value)} />
        </div>
      </div>

      <Button onClick={generate} disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
        Generar plan de {horizon} dias
      </Button>

      {loading && <div className="flex items-center gap-3 justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Generando plan de accion...</p></div>}

      {plan && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4">
            <p className="text-white font-bold">{company?.nombre || 'Taxea'} — Plan de Accion {horizon} dias</p>
            <p className="text-white/50 text-xs mt-0.5">Generado {new Date().toLocaleDateString('es-ES')} · BORRADOR PENDIENTE DE APROBACION</p>
          </div>
          <div className="p-6 text-sm leading-relaxed whitespace-pre-wrap">{plan}</div>
        </div>
      )}
    </div>
  );
}
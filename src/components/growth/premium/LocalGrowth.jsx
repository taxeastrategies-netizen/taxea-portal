import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin, Brain, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEMO_PLANS = [
  { ciudad: 'Santa Cruz de Tenerife', sector: 'Asesoria fiscal IGIC', keywords: ['asesor fiscal tenerife', 'gestoria santa cruz tenerife', 'autonomo igic tenerife'], gbp_resenas: 23, objetivo_resenas: 50, competidores: 4, oportunidad: 'alta' },
  { ciudad: 'Las Palmas de Gran Canaria', sector: 'Contabilidad pymes IGIC', keywords: ['contabilidad pymes las palmas', 'gestoria igic gran canaria', 'asesor fiscal canarias'], gbp_resenas: 8, objetivo_resenas: 40, competidores: 6, oportunidad: 'alta' },
  { ciudad: 'Lanzarote', sector: 'Autonomos IGIC turismo', keywords: ['asesor fiscal lanzarote', 'autonomo igic lanzarote', 'gestoria online canarias'], gbp_resenas: 2, objetivo_resenas: 20, competidores: 1, oportunidad: 'critica' },
];

export default function LocalGrowth() {
  const [form, setForm] = useState({ ciudad: 'Santa Cruz de Tenerife', sector: 'asesor fiscal', presupuesto: 300, prio: 'seo' });
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const generate = async () => {
    setLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto en SEO y marketing local para Canarias. Genera un plan de dominacion local para:\n\nCiudad: ${form.ciudad}\nSector: ${form.sector}\nPresupuesto: ${form.presupuesto}EUR/mes\nPrioridad: ${form.prio}\n\nGenera:\n\n# PLAN LOCAL 30 DIAS\n## Keywords locales (10 con volumen estimado)\n## Google Business Profile (5 acciones)\n## Resenas (objetivo y estrategia)\n## Contenido local (3 articulos/posts)\n## Google Ads local (si presupuesto > 200EUR)\n## Directorios y menciones locales\n\n# PLAN LOCAL 90 DIAS\n## Acciones clave mes 2 y 3\n## Metricas de exito\n\nBorrador. Datos estimados marcados como tal.`,
    });
    setPlan(typeof res === 'string' ? res : res?.response || '');
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><MapPin className="w-5 h-5 text-red-500" />Local Market Dominator</h1><p className="text-sm text-muted-foreground">Domina tu mercado local en Canarias y resto de Espana — SEO, Google Business, resenas y ads</p></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Ciudad / Zona</label>
          <input className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={form.ciudad} onChange={e => set('ciudad', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Servicio / Sector</label>
          <input className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={form.sector} onChange={e => set('sector', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Presupuesto EUR/mes</label>
          <input type="number" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={form.presupuesto} onChange={e => set('presupuesto', +e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Prioridad</label>
          <select className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={form.prio} onChange={e => set('prio', e.target.value)}>
            <option value="seo">SEO primero</option>
            <option value="ads">Ads primero</option>
            <option value="gbp">Google Business</option>
            <option value="mixto">Mixto</option>
          </select>
        </div>
      </div>
      <Button onClick={generate} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}Generar plan local
      </Button>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3">Zonas con mayor oportunidad — Datos demo</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DEMO_PLANS.map(p => (
            <div key={p.ciudad} className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:shadow-sm transition-all" onClick={() => set('ciudad', p.ciudad)}>
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-sm">{p.ciudad}</p>
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase', p.oportunidad === 'critica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{p.oportunidad}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{p.sector}</p>
              <div className="flex items-center gap-1 mb-1">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="text-xs">{p.gbp_resenas} resenas · objetivo: {p.objetivo_resenas}</span>
              </div>
              <p className="text-xs text-muted-foreground">{p.competidores} competidores detectados</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.keywords.slice(0, 2).map(k => <span key={k} className="text-[10px] bg-secondary/60 px-1.5 py-0.5 rounded">{k}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading && <div className="flex items-center gap-3 justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Generando plan local...</p></div>}

      {plan && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-xs text-amber-600 font-semibold mb-3">Borrador pendiente de revision — Datos estimados marcados</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{plan}</p>
        </div>
      )}
    </div>
  );
}
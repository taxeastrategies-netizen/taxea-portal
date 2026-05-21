import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Cpu, Brain, Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEFAULT = {
  objetivo: '', segmento: 'autonomos', sector: 'servicios',
  oferta: 'Diagnostico fiscal gratuito', canal: 'meta_ads',
  presupuesto: 500, plazo: 30, tono: 'consultivo',
  lead_magnet: 'Checklist deducciones', agresividad: 'media',
};

const EJEMPLOS = [
  { label: '10 diagnósticos SL', objetivo: 'Conseguir 10 diagnosticos gratuitos para SL con problemas de control financiero' },
  { label: 'Autonomos IGIC', objetivo: 'Atraer autonomos en Canarias que no conocen sus obligaciones IGIC y quieren regularizarse' },
  { label: 'Ecommerce margen', objetivo: 'Captar ecommerce que vende mucho pero no conoce su margen real ni controla fiscalidad' },
  { label: 'Cambio de gestoria', objetivo: 'Captar pymes insatisfechas con su gestoria actual que buscan un servicio mas proactivo' },
];

function Section({ title, content, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(p => !p)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold bg-secondary/30 hover:bg-secondary/50 transition-colors">
        {title}
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed text-foreground/80">{content}</div>}
    </div>
  );
}

export default function CampaignAutopilot() {
  const { company } = useOutletContext() || {};
  const [form, setForm] = useState(DEFAULT);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const generate = async () => {
    if (!form.objetivo.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto en campanas de marketing para asesorias fiscales espanolas. Genera una campana completa basada en este objetivo:\n\nObjetivo: ${form.objetivo}\nSegmento: ${form.segmento}\nSector: ${form.sector}\nOferta: ${form.oferta}\nCanal principal: ${form.canal}\nPresupuesto: ${form.presupuesto}EUR\nPlazo: ${form.plazo} dias\nTono: ${form.tono}\nLead magnet: ${form.lead_magnet}\nAgresividad comercial: ${form.agresividad}\nEmpresa: ${company?.nombre || 'Taxea'}\n\nDevuelve un JSON con exactamente estas secciones:\n{\n  "nombre": "...",\n  "posicionamiento": "...",\n  "buyer_persona": "...",\n  "dolor_principal": "...",\n  "promesa_prudente": "...",\n  "oferta": "...",\n  "landing_sugerida": "descripcion de la landing",\n  "secuencia_email": "3 emails con asunto y cuerpo",\n  "secuencia_whatsapp": "3 mensajes con timing",\n  "copies_ads": "3 copies de anuncio con hook",\n  "hooks": "5 hooks creativos",\n  "posts_organicos": "3 ideas de post",\n  "articulos_seo": "3 titulos con keyword",\n  "metricas_objetivo": "CPL, leads, cierres esperados",\n  "presupuesto_detalle": "desglose por canal",\n  "riesgos": "3 riesgos a considerar",\n  "compliance_checklist": "5 puntos de revision legal",\n  "tareas_lanzamiento": "10 tareas ordenadas"\n}\n\nIMPORTANTE: Todo es BORRADOR pendiente de aprobacion. No prometer resultados garantizados. No usar claims fiscales absolutos.`,
      response_json_schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string' }, posicionamiento: { type: 'string' }, buyer_persona: { type: 'string' },
          dolor_principal: { type: 'string' }, promesa_prudente: { type: 'string' }, oferta: { type: 'string' },
          landing_sugerida: { type: 'string' }, secuencia_email: { type: 'string' }, secuencia_whatsapp: { type: 'string' },
          copies_ads: { type: 'string' }, hooks: { type: 'string' }, posts_organicos: { type: 'string' },
          articulos_seo: { type: 'string' }, metricas_objetivo: { type: 'string' }, presupuesto_detalle: { type: 'string' },
          riesgos: { type: 'string' }, compliance_checklist: { type: 'string' }, tareas_lanzamiento: { type: 'string' },
        },
      },
    });
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><Cpu className="w-5 h-5 text-blue-600" />Campaign Autopilot</h1>
        <p className="text-sm text-muted-foreground">Genera una campana completa desde un objetivo — todo queda como borrador pendiente de aprobacion</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex gap-2">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        Todo lo generado es borrador. Ninguna campana, email o WhatsApp se activa automaticamente. Revision humana obligatoria.
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Objetivos de ejemplo</p>
        <div className="flex flex-wrap gap-2">
          {EJEMPLOS.map(e => (
            <button key={e.label} onClick={() => set('objetivo', e.objetivo)} className="text-xs px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary hover:text-primary transition-all">{e.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Objetivo de la campana *</label>
            <textarea className="w-full h-20 rounded-xl border border-input bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Describe el objetivo en una frase..." value={form.objetivo} onChange={e => set('objetivo', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['segmento', 'Segmento', [['autonomos','Autonomos'],['sl','SL / SA'],['ecommerce','Ecommerce'],['despachos','Despachos']]],
              ['canal', 'Canal principal', [['meta_ads','Meta Ads'],['google_ads','Google Ads'],['seo','SEO'],['email','Email'],['whatsapp','WhatsApp'],['referidos','Referidos']]],
              ['tono', 'Tono', [['consultivo','Consultivo'],['educativo','Educativo'],['urgente','Urgente'],['empatico','Empatico']]],
              ['agresividad', 'Agresividad comercial', [['baja','Baja'],['media','Media'],['alta','Alta']]],
            ].map(([k, label, options]) => (
              <div key={k}>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
                <select className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={form[k]} onChange={e => set(k, e.target.value)}>
                  {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Presupuesto EUR</label>
              <input type="number" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={form.presupuesto} onChange={e => set('presupuesto', +e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Plazo dias</label>
              <input type="number" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={form.plazo} onChange={e => set('plazo', +e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Oferta</label>
            <input className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={form.oferta} onChange={e => set('oferta', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Lead magnet</label>
            <input className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={form.lead_magnet} onChange={e => set('lead_magnet', e.target.value)} />
          </div>
          <Button onClick={generate} disabled={!form.objetivo.trim() || loading} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            Generar campana completa
          </Button>
        </div>
      </div>

      {loading && <div className="flex items-center gap-3 justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Construyendo campana completa...</p></div>}

      {result && (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl px-5 py-4">
            <p className="text-xs text-white/40 mb-1 uppercase tracking-widest">Borrador — Pendiente de aprobacion</p>
            <p className="text-xl font-bold">{result.nombre}</p>
            <p className="text-sm text-white/60 mt-1">{result.posicionamiento}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-3"><p className="text-xs font-bold text-muted-foreground mb-1">Buyer persona</p><p className="text-sm">{result.buyer_persona}</p></div>
            <div className="bg-card border border-border rounded-xl p-3"><p className="text-xs font-bold text-muted-foreground mb-1">Dolor principal</p><p className="text-sm">{result.dolor_principal}</p></div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3"><p className="text-xs font-bold text-emerald-700 mb-1">Promesa prudente</p><p className="text-sm text-emerald-900">{result.promesa_prudente}</p></div>
          </div>
          <Section title="Hooks y Copies de Anuncios" content={result.hooks + '\n\n' + result.copies_ads} defaultOpen={true} />
          <Section title="Secuencia Email (3 emails)" content={result.secuencia_email} />
          <Section title="Secuencia WhatsApp (3 mensajes)" content={result.secuencia_whatsapp} />
          <Section title="Landing sugerida" content={result.landing_sugerida} />
          <Section title="Posts organicos + Articulos SEO" content={result.posts_organicos + '\n\n' + result.articulos_seo} />
          <Section title="Metricas objetivo + Presupuesto" content={result.metricas_objetivo + '\n\n' + result.presupuesto_detalle} />
          <Section title="Tareas de lanzamiento" content={result.tareas_lanzamiento} defaultOpen={true} />
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs font-bold text-red-800 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Riesgos y Compliance</p>
            <p className="text-sm text-red-900 whitespace-pre-wrap">{result.riesgos}</p>
            <p className="text-sm text-red-800 mt-2 whitespace-pre-wrap">{result.compliance_checklist}</p>
          </div>
        </div>
      )}
    </div>
  );
}
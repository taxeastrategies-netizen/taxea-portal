import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Library, Brain, Loader2, Copy, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TEMPLATES = [
  { id: 'gestoria-low-cost', nombre: 'Gestoria Low Cost', dolor: 'Pago mucho por poco servicio o busco precio bajo', publico: 'Pymes y autonomos con gestoria cara o descuidada', hook: '"¿Tu gestoria solo te llama cuando hay problemas?"', oferta: 'Plan de asesoria proactiva + dashboard fiscal', lead_magnet: 'Checklist para cambiar de gestoria sin riesgo', canal: 'Google Ads + SEO', compliance: 'No comparar precios directamente de competidores' },
  { id: 'no-sabes-pagar', nombre: 'No sabes cuanto vas a pagar', dolor: 'Incertidumbre fiscal trimestral', publico: 'Autonomos y SL con sorpresas fiscales', hook: '"Cada trimestre un susto. Hay una forma de saberlo antes."', oferta: 'Prevision fiscal trimestral + alerta anticipada', lead_magnet: 'Calculadora de estimacion IRPF/IS', canal: 'Google Ads', compliance: 'No prometer exactitud en estimaciones fiscales' },
  { id: 'negocio-crece', nombre: 'Tu negocio crece, tu asesoria no', dolor: 'Han crecido pero su asesor no ha evolucionado', publico: 'SL en expansion con gestoria basica', hook: '"Tu empresa ya no es la de hace 3 anos. Tu asesor, si."', oferta: 'Asesoria fiscal + financiero + ERP integrado', lead_magnet: 'Auditoria de madurez fiscal gratuita', canal: 'LinkedIn + Google Ads', compliance: 'No criticar gestores por nombre o empresa' },
  { id: 'vendes-ganas-poco', nombre: 'Vendes mucho, ganas poco', dolor: 'Alta facturacion, margen desconocido', publico: 'Ecommerce, comercios, hosteleria', hook: '"Tus ventas suben. Tu cuenta no."', oferta: 'Control financiero + fiscalidad integrada', lead_magnet: 'Calculadora de margen real', canal: 'Meta Ads + SEO', compliance: 'No afirmar causas de perdida sin analisis' },
  { id: 'canarias-igic', nombre: 'Canarias IGIC', dolor: 'Confusion IGIC/IVA, REF, alta en Canarias', publico: 'Autonomos y SL en Canarias', hook: '"En Canarias las reglas fiscales son distintas. ¿Las conoces?"', oferta: 'Especialista IGIC + REF + Canarias', lead_magnet: 'Guia IGIC 2025 para autonomos y SL', canal: 'Google Ads Local + SEO', compliance: 'No afirmar exenciones sin revisar caso a caso' },
  { id: 'control-financiero-sl', nombre: 'Control financiero para SL', dolor: 'No saben si ganan, sin dashboard, sin forecast', publico: 'SL de 3-20 empleados', hook: '"¿Tienes SL y no sabes si vas bien o mal? Es mas comun de lo que crees."', oferta: 'Dashboard financiero + asesoria fiscal + reporting', lead_magnet: 'Plantilla de KPIs financieros para SL', canal: 'LinkedIn + Google Ads', compliance: 'No prometer mejora de rentabilidad garantizada' },
  { id: 'ecommerce-margen', nombre: 'Ecommerce con margen real', dolor: 'IVA OSS, marketplaces, stock, margen oculto', publico: 'Tiendas online con ventas cross-border', hook: '"Tu ecommerce vende. ¿Sabes cuanto queda despues de impuestos, fees y devoluciones?"', oferta: 'Fiscalidad ecommerce + logistica + financiero', lead_magnet: 'Guia IVA ecommerce espanol 2025', canal: 'Meta Ads + SEO', compliance: 'No afirmar reglas de OSS sin actualizar normativa' },
  { id: 'cambio-asesoria', nombre: 'Cambio ordenado de asesoria', dolor: 'Quieren cambiar pero tienen miedo', publico: 'Cualquier empresa con asesor que no les convence', hook: '"Cambiar de asesoria no tiene que ser un problema."', oferta: 'Onboarding ordenado + traspaso documental', lead_magnet: 'Checklist cambio de asesoria sin riesgos', canal: 'Google Ads + SEO', compliance: 'No prometer que el traspaso sera sin problemas' },
  { id: 'diagnostico-fiscal', nombre: 'Diagnostico fiscal preventivo', dolor: 'No saben si tienen riesgos fiscales latentes', publico: 'Empresas con 3+ anos sin revision fiscal', hook: '"¿Cuanto tiempo llevas sin revisar tu situacion fiscal?"', oferta: 'Diagnostico fiscal preventivo gratuito 30 min', lead_magnet: 'Checklist de riesgos fiscales frecuentes', canal: 'Google Ads + Email', compliance: 'No afirmar que se detectaran todos los problemas' },
  { id: 'regularizacion', nombre: 'Regularizacion documental', dolor: 'Documentacion caida, anos sin orden', publico: 'Negocios con documentacion atrasada', hook: '"Hay empresas que llevan anos sin poner orden. Tiene solucion."', oferta: 'Puesta al dia fiscal + limpieza documental', lead_magnet: 'Guia de regularizacion paso a paso', canal: 'Google Ads', compliance: 'No prometer plazos ni ausencia de sanciones' },
];

export default function CampaignLibrary() {
  const [selected, setSelected] = useState(null);
  const [aiAdapt, setAiAdapt] = useState({});
  const [loading, setLoading] = useState({});
  const [sector, setSector] = useState('');

  const adapt = async (t) => {
    setLoading(p => ({ ...p, [t.id]: true }));
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto en marketing para asesorias. Adapta la campana "${t.nombre}" ${sector ? `para el sector "${sector}"` : 'con un toque fresco'}.\n\nDatos base:\n- Hook: ${t.hook}\n- Oferta: ${t.oferta}\n- Lead magnet: ${t.lead_magnet}\n- Compliance: ${t.compliance}\n\nGenera:\n1. Hook adaptado (1 frase)\n2. 2 copies de anuncio\n3. Asunto de email (3 opciones)\n4. Mensaje WhatsApp inicial\n5. 3 tareas de lanzamiento\n\nBorrador pendiente de aprobacion. Sin promesas garantizadas.`,
    });
    setAiAdapt(p => ({ ...p, [t.id]: typeof res === 'string' ? res : res?.response || '' }));
    setLoading(p => ({ ...p, [t.id]: false }));
    setSelected(t.id);
  };

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><Library className="w-5 h-5 text-purple-600" />Campaign Library Taxea</h1><p className="text-sm text-muted-foreground">10 campanas preconfiguradas para asesorias inteligentes — adapta y lanza en borrador</p></div>

      <div className="flex items-center gap-3">
        <input className="h-9 rounded-xl border border-input bg-card px-3 text-sm flex-1 max-w-xs focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Adaptar por sector (ecommerce, clinicas...)" value={sector} onChange={e => setSector(e.target.value)} />
        <p className="text-xs text-muted-foreground">Opcional: especifica el sector para adaptar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLATES.map(t => (
          <div key={t.id} className={cn('bg-card border rounded-xl overflow-hidden transition-all', selected === t.id ? 'border-primary ring-1 ring-primary/20' : 'border-border hover:shadow-md')}>
            <div className="p-4 cursor-pointer" onClick={() => setSelected(selected === t.id ? null : t.id)}>
              <p className="font-bold text-sm mb-1">{t.nombre}</p>
              <p className="text-xs text-muted-foreground mb-2 italic">"{t.hook}"</p>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="bg-secondary/60 px-2 py-0.5 rounded">{t.canal}</span>
                <span className="bg-secondary/60 px-2 py-0.5 rounded">{t.publico.split(' ')[0]}...</span>
              </div>
            </div>
            {selected === t.id && (
              <div className="border-t border-border p-4 bg-secondary/10 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="font-bold text-muted-foreground mb-0.5">Oferta</p><p>{t.oferta}</p></div>
                  <div><p className="font-bold text-muted-foreground mb-0.5">Lead magnet</p><p>{t.lead_magnet}</p></div>
                  <div className="col-span-2"><p className="font-bold text-amber-600 mb-0.5">Compliance</p><p className="text-amber-700">{t.compliance}</p></div>
                </div>
                <Button size="sm" className="w-full gap-1.5 text-xs" onClick={() => adapt(t)} disabled={loading[t.id]}>
                  {loading[t.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}Adaptar y generar activos
                </Button>
                {aiAdapt[t.id] && (
                  <div className="bg-slate-900 text-white text-xs p-3 rounded-xl whitespace-pre-wrap leading-relaxed">
                    <p className="text-white/40 mb-1 text-[10px]">BORRADOR — Revisar antes de usar</p>
                    {aiAdapt[t.id]}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
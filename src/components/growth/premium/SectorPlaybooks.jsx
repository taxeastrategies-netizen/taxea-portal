import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BookOpen, Brain, Loader2, ChevronDown, ChevronRight, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PLAYBOOKS = [
  { id: 'autonomos', label: 'Autonomos profesionales', icon: '👤', prio: 'critica', dolor: 'Susto trimestral, deducciones desconocidas, asesor reactivo', oferta: 'Plan Profesional + Asistente Fiscal 24/7', lead_magnet: 'Checklist de deducciones 2025', hook: '"Cada trimestre un susto. Hay una forma mejor."', canal: 'Google Ads + SEO', precio: '95-180EUR/mes', upsell: 'Plan Financiero + OCR', kpis: 'CPL < 12EUR, conv 12%, LTV > 3.000EUR', riesgos: 'Claims fiscales absolutos sobre deducciones' },
  { id: 'sl', label: 'Sociedades Limitadas', icon: '🏢', prio: 'critica', dolor: 'No conocen margen, IS confuso, crecen pero no ganan', oferta: 'Control fiscal + Dashboard financiero', lead_magnet: 'Calculadora de margen real SL', hook: '"Tu empresa factura bien. ¿Pero sabes cuanto ganas?"', canal: 'Google Ads + LinkedIn', precio: '180-380EUR/mes', upsell: 'Modulo Finance + Reporting', kpis: 'CPL < 35EUR, conv 8%, LTV > 6.000EUR', riesgos: 'Comparar IS vs IRPF sin matices' },
  { id: 'ecommerce', label: 'Ecommerce', icon: '🛒', prio: 'alta', dolor: 'IVA OSS, marketplaces, stock, margen desconocido', oferta: 'Fiscalidad ecommerce + Inventario + Financiero', lead_magnet: 'Guia IVA para ecommerce espanol', hook: '"Vendes mucho. ¿Sabes cuanto queda despues de impuestos?"', canal: 'Meta Ads + SEO', precio: '200-350EUR/mes', upsell: 'Logistica + Dashboard', kpis: 'CPL < 25EUR, conv 7%', riesgos: 'Claims sobre OSS/IGIC sin matices' },
  { id: 'canarias', label: 'Canarias / IGIC', icon: '🌴', prio: 'critica', dolor: 'Confusion IVA/IGIC, REF, alta como autonomo', oferta: 'Especialista IGIC + REF Canarias', lead_magnet: 'Guia completa IGIC 2025', hook: '"¿IGIC o IVA? No es lo mismo y te puede salir caro."', canal: 'Google Ads Local + SEO', precio: '85-200EUR/mes', upsell: 'Plan Profesional full', kpis: 'CPL < 10EUR, conv 15%', riesgos: 'Afirmar exenciones sin revisar cada caso' },
  { id: 'clinicas', label: 'Clinicas y salud', icon: '🏥', prio: 'alta', dolor: 'Exenciones IVA sanitario, nominas medicos, ticketaje', oferta: 'Asesoria fiscal sanitaria especializada', lead_magnet: 'Checklist exenciones IVA sanitario', hook: '"La fiscalidad sanitaria tiene reglas propias. ¿Las conoces?"', canal: 'Google Ads + LinkedIn', precio: '250-500EUR/mes', upsell: 'RRHH + Finance', kpis: 'CPL < 40EUR, conv 6%', riesgos: 'Claims sobre exenciones IVA sin casuistica' },
  { id: 'reformas', label: 'Reformas y construccion', icon: '🔧', prio: 'media', dolor: 'IVA reducido construccion, retenciones, subcontratistas', oferta: 'Asesoria fiscal construccion', lead_magnet: 'Guia IVA en obras y reformas', hook: '"El IVA en obras no siempre es el que crees."', canal: 'Google Ads', precio: '120-220EUR/mes', upsell: 'Plan logistica materiales', kpis: 'CPL < 18EUR, conv 9%', riesgos: 'Claims sobre tipos IVA sin revisar uso' },
  { id: 'inmobiliaria', label: 'Inmobiliarias', icon: '🏠', prio: 'media', dolor: 'IRPF venta, plusvalia, ITP, alquiler', oferta: 'Asesoria fiscal inmobiliaria', lead_magnet: 'Calculadora plusvalia y IRPF', hook: '"Vender un piso tiene mas impuestos de los que imaginas."', canal: 'Google Ads + SEO', precio: '150-300EUR/mes', upsell: 'Control financiero + inversiones', kpis: 'CPL < 30EUR', riesgos: 'Calculos de plusvalia sin datos reales' },
  { id: 'despachos', label: 'Despachos profesionales', icon: '⚖️', prio: 'alta', dolor: 'Quieren digitalizar, ERP propio, ver KPIs', oferta: 'Taxea como ERP del despacho', lead_magnet: 'Demo portal Taxea para despachos', hook: '"Tu despacho necesita la misma tecnologia que tus clientes."', canal: 'LinkedIn + Referidos', precio: '300-600EUR/mes', upsell: 'White label + formacion', kpis: 'CPL < 60EUR, conv 5%', riesgos: 'Promesas de automatizacion total' },
];

const PRIO_COLORS = { critica: 'bg-red-100 text-red-700', alta: 'bg-amber-100 text-amber-700', media: 'bg-blue-100 text-blue-700' };

export default function SectorPlaybooks() {
  const [expanded, setExpanded] = useState(null);
  const [launching, setLaunching] = useState({});
  const [launchResult, setLaunchResult] = useState({});
  const [filter, setFilter] = useState('all');

  const launchPlaybook = async (pb) => {
    setLaunching(p => ({ ...p, [pb.id]: true }));
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Genera un plan de lanzamiento completo para el playbook "${pb.label}".\n\nDatos del playbook:\n- Dolor: ${pb.dolor}\n- Oferta: ${pb.oferta}\n- Hook: ${pb.hook}\n- Canal: ${pb.canal}\n- Precio: ${pb.precio}\n- Lead magnet: ${pb.lead_magnet}\n- KPIs objetivo: ${pb.kpis}\n\nDevuelve:\n1. 3 copies para anuncios\n2. Email de bienvenida (borrador)\n3. WhatsApp de primer contacto\n4. 5 tareas de lanzamiento ordenadas\n5. Experimento A/B recomendado\n\nTodo como BORRADOR pendiente de revision. No prometer resultados garantizados.`,
    });
    setLaunchResult(p => ({ ...p, [pb.id]: typeof res === 'string' ? res : res?.response || '' }));
    setLaunching(p => ({ ...p, [pb.id]: false }));
  };

  const filtered = filter === 'all' ? PLAYBOOKS : PLAYBOOKS.filter(p => p.prio === filter);

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-600" />Sector Growth Playbooks</h1><p className="text-sm text-muted-foreground">Playbooks accionables por sector — convierte en campana, contenido o experimento en un clic</p></div>

      <div className="flex gap-2">
        {[['all','Todos'],['critica','Prioritarios'],['alta','Alta'],['media','Media']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all', filter===v ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground')}>{l}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(pb => (
          <div key={pb.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => setExpanded(expanded === pb.id ? null : pb.id)}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{pb.icon}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <p className="font-semibold">{pb.label}</p>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', PRIO_COLORS[pb.prio])}>{pb.prio}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{pb.dolor}</p>
                </div>
                {expanded === pb.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>
            {expanded === pb.id && (
              <div className="border-t border-border p-4 space-y-3 bg-secondary/10">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="bg-card rounded-xl p-3"><p className="text-xs font-bold text-muted-foreground mb-1">Hook principal</p><p className="italic">"{pb.hook}"</p></div>
                  <div className="bg-card rounded-xl p-3"><p className="text-xs font-bold text-muted-foreground mb-1">Oferta</p><p>{pb.oferta}</p></div>
                  <div className="bg-card rounded-xl p-3"><p className="text-xs font-bold text-muted-foreground mb-1">Lead magnet</p><p>{pb.lead_magnet}</p></div>
                  <div className="bg-card rounded-xl p-3"><p className="text-xs font-bold text-muted-foreground mb-1">Canal</p><p>{pb.canal}</p></div>
                  <div className="bg-card rounded-xl p-3"><p className="text-xs font-bold text-muted-foreground mb-1">Pricing orientativo</p><p>{pb.precio}</p></div>
                  <div className="bg-card rounded-xl p-3"><p className="text-xs font-bold text-muted-foreground mb-1">Upsell</p><p>{pb.upsell}</p></div>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700"><strong>Riesgo compliance:</strong> {pb.riesgos}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5 text-xs" onClick={() => launchPlaybook(pb)} disabled={launching[pb.id]}>
                    {launching[pb.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}Lanzar playbook con IA
                  </Button>
                </div>
                {launchResult[pb.id] && (
                  <div className="bg-slate-900 text-white text-xs p-4 rounded-xl whitespace-pre-wrap leading-relaxed">
                    <p className="text-white/40 mb-2 uppercase tracking-wide text-[10px]">Borrador pendiente de aprobacion</p>
                    {launchResult[pb.id]}
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
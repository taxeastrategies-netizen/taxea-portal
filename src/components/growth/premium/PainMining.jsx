import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Flame, Brain, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEMO_PAINS = [
  { id: 1, dolor: 'Mi asesor solo aparece para pedirme facturas el ultimo dia del trimestre', fuente: 'Google Reviews', frecuencia: 28, sector: 'general', urgencia: 'alta', sentimiento: 'frustracion' },
  { id: 2, dolor: 'No entiendo cuanto voy a pagar cada trimestre hasta que llega la liquidacion', fuente: 'Formulario perdida', frecuencia: 22, sector: 'autonomos', urgencia: 'alta', sentimiento: 'ansiedad' },
  { id: 3, dolor: 'Tengo miedo a una inspeccion de Hacienda porque no tengo todo en orden', fuente: 'WhatsApp clientes', frecuencia: 19, sector: 'general', urgencia: 'critica', sentimiento: 'miedo' },
  { id: 4, dolor: 'Pago mucho y no veo que hace mi gestoria por mi', fuente: 'Encuesta NPS', frecuencia: 17, sector: 'sl', urgencia: 'alta', sentimiento: 'frustracion' },
  { id: 5, dolor: 'Vendo bien pero no se si gano dinero de verdad', fuente: 'Llamadas de ventas', frecuencia: 15, sector: 'ecommerce', urgencia: 'alta', sentimiento: 'confusion' },
  { id: 6, dolor: 'No se la diferencia entre IGIC e IVA y me da miedo equivocarme', fuente: 'SEO busquedas', frecuencia: 14, sector: 'canarias', urgencia: 'media', sentimiento: 'confusion' },
  { id: 7, dolor: 'Tengo facturas de todo el ano desordenadas y no se como presentarlo', fuente: 'Tickets soporte', frecuencia: 13, sector: 'autonomos', urgencia: 'media', sentimiento: 'estres' },
  { id: 8, dolor: 'Mi gestoria me dice que no me puedo deducir el coche pero no me explica por que', fuente: 'Encuestas', frecuencia: 12, sector: 'autonomos', urgencia: 'media', sentimiento: 'confusion' },
  { id: 9, dolor: 'Quiero cambiar de asesoria pero me da miedo perder documentos o tener problemas', fuente: 'Formulario perdida', frecuencia: 11, sector: 'general', urgencia: 'media', sentimiento: 'miedo_cambio' },
  { id: 10, dolor: 'No tengo ningun informe financiero real. No se si voy bien o mal', fuente: 'Encuesta NPS', frecuencia: 10, sector: 'sl', urgencia: 'alta', sentimiento: 'confusion' },
  { id: 11, dolor: 'Hacienda me manda cartas y no se si es una inspeccion o un tramite normal', fuente: 'Llamadas', frecuencia: 9, sector: 'general', urgencia: 'critica', sentimiento: 'panico' },
  { id: 12, dolor: 'Tengo varios negocios y nadie me ayuda a ver el total de lo que gano y pago', fuente: 'CRM notas', frecuencia: 8, sector: 'sl', urgencia: 'alta', sentimiento: 'confusion' },
];

const URG_COLORS = { critica: 'bg-red-100 text-red-700', alta: 'bg-amber-100 text-amber-700', media: 'bg-blue-100 text-blue-700' };

export default function PainMining() {
  const [selected, setSelected] = useState(null);
  const [aiOutput, setAiOutput] = useState({});
  const [loading, setLoading] = useState({});

  const convert = async (pain) => {
    setSelected(pain.id);
    setLoading(p => ({ ...p, [pain.id]: true }));
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto en marketing de contenidos y ventas para asesorias fiscales. Convierte este dolor de cliente en activos de marketing:\n\nDolor: "${pain.dolor}"\nSector: ${pain.sector}\nUrgencia: ${pain.urgencia}\nSentimiento: ${pain.sentimiento}\n\nGenera:\n1. Hook para anuncio (1 frase)\n2. Titular de landing\n3. Titulo de articulo SEO con keyword\n4. Asunto de email\n5. Mensaje WhatsApp (max 2 frases)\n6. Oferta que resuelve el dolor\n7. Objecion probable y respuesta\n\nTodo como borrador. Sin promesas absolutas.`,
    });
    setAiOutput(p => ({ ...p, [pain.id]: typeof res === 'string' ? res : res?.response || '' }));
    setLoading(p => ({ ...p, [pain.id]: false }));
  };

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><Flame className="w-5 h-5 text-orange-500" />Pain Mining Engine</h1><p className="text-sm text-muted-foreground">Dolores reales del mercado extraidos de resenas, llamadas y formularios — convertibles en activos de marketing</p></div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Dolores identificados', v: DEMO_PAINS.length },
          { label: 'Frecuencia total', v: DEMO_PAINS.reduce((s,p)=>s+p.frecuencia,0) },
          { label: 'Criticos / urgentes', v: DEMO_PAINS.filter(p=>p.urgencia==='critica'||p.urgencia==='alta').length },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{s.v}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {DEMO_PAINS.map(pain => (
          <div key={pain.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{pain.id}</div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-medium text-sm italic">"{pain.dolor}"</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={cn('px-2 py-0.5 rounded-full font-semibold', URG_COLORS[pain.urgencia])}>urgencia {pain.urgencia}</span>
                    <span className="text-muted-foreground">Fuente: {pain.fuente}</span>
                    <span className="text-muted-foreground">x{pain.frecuencia} menciones</span>
                    <span className="text-muted-foreground">{pain.sector}</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 text-xs h-8 gap-1" onClick={() => convert(pain)} disabled={loading[pain.id]}>
                  {loading[pain.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}Convertir
                </Button>
              </div>
            </div>
            {aiOutput[pain.id] && selected === pain.id && (
              <div className="border-t border-border p-4 bg-secondary/10">
                <p className="text-[10px] text-amber-600 font-semibold mb-2">BORRADOR — Revisar antes de usar</p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiOutput[pain.id]}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
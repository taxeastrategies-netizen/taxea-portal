import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle, Brain, Loader2, AlertTriangle, CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEMO_CONVOS = [
  { label: 'Objecion: ya tengo gestoria', text: 'Cliente: Gracias, pero ya tengo gestor desde hace anos y no quiero complicarme ahora.' },
  { label: 'Objecion: precio alto', text: 'Cliente: Me parece caro para lo que ofreceis. Mi otro presupuesto es 60EUR menos al mes.' },
  { label: 'Senales de compra', text: 'Cliente: Cuanto tiempo tardais en empezar? Tenemos que presentar el trimestre pronto y estamos un poco perdidos.' },
  { label: 'Falta de urgencia', text: 'Cliente: Me interesa si, pero ahora mismo estoy muy liado. Ya os llamare en agosto.' },
  { label: 'Inseguridad sobre el cambio', text: 'Cliente: Me da un poco de miedo cambiar justo ahora con los modelos pendientes. No se si es el momento.' },
  { label: 'Comparacion competidor', text: 'Cliente: He visto que Holded ofrece algo parecido por menos. Que diferencia hay con vosotros?' },
];

const STATE_COLORS = {
  caliente: 'bg-red-100 text-red-700',
  'necesita confianza': 'bg-amber-100 text-amber-700',
  'objecion precio': 'bg-orange-100 text-orange-700',
  'objecion cambio': 'bg-yellow-100 text-yellow-700',
  'falta urgencia': 'bg-blue-100 text-blue-700',
  'comparar competencia': 'bg-purple-100 text-purple-700',
  'perdido probable': 'bg-slate-100 text-slate-600',
  'reactivar mas adelante': 'bg-cyan-100 text-cyan-700',
};

export default function WhatsAppClosingAssistant() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = async (text) => {
    const convo = text || input;
    if (!convo.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto en ventas consultivas para asesorias fiscales espanolas. Analiza esta conversacion de WhatsApp y devuelve un JSON con el siguiente formato exacto:
{
  "estado": "caliente|necesita confianza|objecion precio|objecion cambio|falta urgencia|comparar competencia|perdido probable|reactivar mas adelante",
  "probabilidad_cierre": 75,
  "diagnostico": "texto breve de 2-3 frases",
  "objecion_real": "texto",
  "objecion_aparente": "texto o null",
  "mensaje_corto": "mensaje WhatsApp directo de max 2 frases",
  "mensaje_consultivo": "mensaje mas elaborado y empatico",
  "pregunta_reencuadre": "pregunta para cambiar el frame",
  "siguiente_paso": "accion concreta recomendada",
  "riesgo_legal": "si hay alguna promesa peligrosa en el mensaje del asesor, indicar. Si no hay, null",
  "riesgo_agresividad": "si el mensaje sugerido puede sonar agresivo, advertir. Si no, null"
}

Conversacion:
${convo}

IMPORTANTE: Todo el contenido es BORRADOR. No prometas resultados garantizados. Responde SOLO con el JSON valido, sin explicaciones adicionales.`,
      response_json_schema: {
        type: 'object',
        properties: {
          estado: { type: 'string' },
          probabilidad_cierre: { type: 'number' },
          diagnostico: { type: 'string' },
          objecion_real: { type: 'string' },
          objecion_aparente: { type: 'string' },
          mensaje_corto: { type: 'string' },
          mensaje_consultivo: { type: 'string' },
          pregunta_reencuadre: { type: 'string' },
          siguiente_paso: { type: 'string' },
          riesgo_legal: { type: 'string' },
          riesgo_agresividad: { type: 'string' },
        },
      },
    });
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><MessageCircle className="w-5 h-5 text-green-600" />WhatsApp Closing Assistant</h1>
        <p className="text-sm text-muted-foreground">Pega una conversacion, recibe diagnostico, mensajes sugeridos y siguiente paso optimo</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex gap-2">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        Todo lo generado es borrador pendiente de revision. No envies mensajes sin revisar. No hagas promesas de resultados garantizados.
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Conversaciones demo</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_CONVOS.map(d => (
            <button key={d.label} onClick={() => { setInput(d.text); setResult(null); }} className="text-xs px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary hover:text-primary transition-all">{d.label}</button>
          ))}
        </div>
      </div>

      <div>
        <textarea
          className="w-full h-32 rounded-xl border border-input bg-card px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Pega aqui la conversacion de WhatsApp o un resumen del contacto..."
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <Button onClick={() => analyze()} disabled={!input.trim() || loading} className="mt-2 gap-2 w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          Analizar conversacion
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analizando la conversacion...</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-lg">{result.probabilidad_cierre}% probabilidad de cierre</p>
                <p className="text-sm text-muted-foreground">{result.diagnostico}</p>
              </div>
              {result.estado && <span className={cn('px-2 py-1 rounded-full text-xs font-bold uppercase', STATE_COLORS[result.estado] || 'bg-slate-100 text-slate-600')}>{result.estado}</span>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="bg-secondary/40 rounded-xl p-3"><p className="text-xs text-muted-foreground font-semibold mb-1">Objecion real</p><p>{result.objecion_real}</p></div>
              {result.objecion_aparente && <div className="bg-secondary/40 rounded-xl p-3"><p className="text-xs text-muted-foreground font-semibold mb-1">Objecion aparente</p><p>{result.objecion_aparente}</p></div>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-bold text-green-800 mb-2 flex items-center gap-1.5"><Send className="w-3 h-3" />Mensaje corto (WhatsApp)</p>
              <p className="text-sm text-green-900 leading-relaxed">{result.mensaje_corto}</p>
              <p className="text-[10px] text-green-600 mt-2 italic">Borrador — revisar antes de enviar</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-800 mb-2">Mensaje consultivo</p>
              <p className="text-sm text-blue-900 leading-relaxed">{result.mensaje_consultivo}</p>
              <p className="text-[10px] text-blue-600 mt-2 italic">Borrador — revisar antes de enviar</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-bold text-muted-foreground mb-2">Pregunta de reencuadre</p>
              <p className="text-sm italic">"{result.pregunta_reencuadre}"</p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-xs font-bold text-primary mb-2">Siguiente paso recomendado</p>
              <p className="text-sm font-medium">{result.siguiente_paso}</p>
            </div>
          </div>

          {(result.riesgo_legal || result.riesgo_agresividad) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-red-800 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" />Advertencias</p>
              {result.riesgo_legal && <p className="text-sm text-red-700"><strong>Riesgo legal:</strong> {result.riesgo_legal}</p>}
              {result.riesgo_agresividad && <p className="text-sm text-red-700"><strong>Riesgo agresividad:</strong> {result.riesgo_agresividad}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
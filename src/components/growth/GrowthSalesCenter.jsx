import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MessageSquare, FileText, DollarSign, HelpCircle, Loader2, Sparkles, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'objections', label: 'Objeciones', icon: MessageSquare },
  { id: 'scripts', label: 'Scripts', icon: FileText },
  { id: 'pricing', label: 'Pricing Guardrail', icon: DollarSign },
  { id: 'proposals', label: 'Propuestas', icon: HelpCircle },
];

const OBJECTIONS = [
  { objection: 'Es caro', response_short: '¿Caro respecto a qué? Si cada mes cometes errores fiscales que cuestan más de nuestra tarifa, el coste real está en el riesgo que asumes.', response_consultive: 'Entiendo que el precio importa. ¿Puedo preguntarte cuánto te cuestan hoy los errores fiscales, el tiempo invertido y el no tener control financiero? Muchos clientes descubren que el coste de no tener asesoramiento supera con creces nuestra tarifa.', reframe: '¿Qué te costaría un error en la declaración trimestral o un requerimiento de Hacienda?' },
  { objection: 'Ya tengo gestoría', response_short: '¿Te está dando control financiero, alertas fiscales y visibilidad sobre tu margen? Nosotros no somos una gestoría, somos un equipo de gestión del negocio.', response_consultive: 'Me alegra que ya trabajes con alguien. ¿Tienes claro cuánto pagas de impuestos cada trimestre antes de recibirlo? ¿Tienes informes de rentabilidad? Eso es lo que añadimos nosotros, no la gestión básica.', reframe: '¿Cuándo fue la última vez que tu gestoría te llamó para adelantarte una oportunidad fiscal?' },
  { objection: 'Me lo pienso', response_short: 'Claro, es normal. ¿Qué información te ayudaría a decidir? Así te preparo algo concreto.', response_consultive: '¿Qué parte necesitas pensar más? Si es el precio, vemos cómo adaptarlo. Si es el encaje, podemos hacer una sesión de diagnóstico sin compromiso y verás si hay valor real.', reframe: '¿Qué necesitaría pasar para que dijeras que sí hoy?' },
  { objection: 'No lo necesito ahora', response_short: 'El mejor momento para ordenar las finanzas es antes de que sea urgente. Esperar suele costar más.', response_consultive: '¿Cuándo crees que lo necesitarías? A veces la urgencia llega antes de lo esperado: una inspección, un cambio fiscal, una oportunidad de inversión. ¿Querrías estar preparado o reaccionar?', reframe: '¿Qué tendría que ocurrir para que esto se convirtiera en urgente?' },
  { objection: 'Mi familiar me lo lleva', response_short: 'Entendido. Solo te digo que hay una diferencia entre cumplir con Hacienda y optimizar tu situación fiscal y financiera.', response_consultive: '¿Tu familiar tiene experiencia específica en tu tipo de actividad y en IGIC/IVA? ¿Te hace informes de rentabilidad? No digo que no sea bueno, pero hay servicios que van más allá de la declaración básica.', reframe: '¿Sabes si estás pagando más de lo necesario o si podrías optimizar alguna deducción?' },
  { objection: 'No tengo presupuesto', response_short: 'Cuéntame tu situación y vemos el formato que tiene sentido ahora mismo. Hay opciones.', response_consultive: '¿Qué significaría para tu negocio reducir el tiempo que dedicas a gestionar tu fiscalidad o no tener sorpresas en las declaraciones? A veces el presupuesto aparece cuando el valor es claro.', reframe: '¿Cuánto te cuesta ahora mismo en tiempo, errores y estrés no tener esto controlado?' },
  { objection: 'Uso Holded', response_short: 'Holded es una herramienta de gestión. Nosotros somos el equipo que toma las decisiones fiscales y financieras correctas con tus datos.', response_consultive: 'Perfecto, Holded es buena herramienta. Nosotros nos conectamos con ello y añadimos la capa de interpretación fiscal, alertas de Hacienda y control financiero que el software solo no puede dar.', reframe: '¿Quién revisa en Holded que las categorías contables están bien y que no te falta ninguna deducción?' },
  { objection: 'Prefiero seguir como estoy', response_short: 'Respeto eso. ¿Puedo preguntarte si hay algo que no funciona bien en el modelo actual?', response_consultive: 'Totalmente válido. Si en algún momento cambias de opinión, o si hay alguna situación concreta donde crees que podríamos aportarte algo, estaré aquí.', reframe: '¿Hay algo en la gestión actual que te gustaría que fuera diferente?' },
];

const SCRIPTS = [
  { title: 'Llamada de diagnóstico inicial', type: 'llamada', script: `[Apertura] "Hola [nombre], soy [tu nombre] de Taxea. Te llamo porque me llegó tu solicitud de diagnóstico fiscal y quería hacer una llamada rápida de 10 minutos para entender tu situación. ¿Es buen momento?"\n\n[Contexto] "¿Cuéntame, cuál es tu actividad principal y cómo llevas ahora mismo la gestión fiscal?"\n\n[Dolor] "¿Hay algo que te preocupe o que sientas que no estás controlando bien?"\n\n[Propuesta] "Con lo que me cuentas, creo que tiene mucho sentido hacer el diagnóstico completo. Es gratuito, sin compromiso y en 30 minutos sabemos si podemos ayudarte."\n\n[Cierre] "¿Tienes disponibilidad esta semana o la próxima?"` },
  { title: 'WhatsApp: primer contacto post-lead', type: 'whatsapp', script: `Hola [nombre] 👋\n\nSoy [nombre] de Taxea. Vi que descargaste nuestra guía de gastos deducibles.\n\n¿Hay alguna situación fiscal o financiera concreta que te preocupe ahora mismo?\n\nSi quieres, hacemos un diagnóstico rápido gratuito y te digo si puedo ayudarte. Sin compromiso.\n\n¿Te va bien esta semana?` },
  { title: 'Email: seguimiento propuesta sin respuesta', type: 'email', script: `Asunto: Sobre la propuesta que te envié\n\nHola [nombre],\n\nTe escribo porque te envié la propuesta hace unos días y no he tenido noticias.\n\nEntiendo que hay mil cosas en el día a día. Solo quería saber si tienes alguna duda o si hay algo que no encaja.\n\nNo me importa ajustarlo si es necesario.\n\n¿Cómo lo ves?\n\nUn saludo,\n[nombre]` },
  { title: 'WhatsApp: reactivación lead frío', type: 'whatsapp', script: `Hola [nombre], ¿qué tal?\n\nHace unas semanas hablamos sobre tu situación fiscal. Quería ver cómo va todo.\n\nAcabamos de cerrar el trimestre y hay algunos cambios fiscales que afectan a [tipo actividad].\n\n¿Te interesa que te haga un repaso rápido de 15 minutos? Sin coste ni compromiso.\n\n¿Cuándo tienes un hueco?` },
  { title: 'WhatsApp: cierre de propuesta', type: 'whatsapp', script: `Hola [nombre],\n\nRevisa la propuesta cuando puedas. Quiero asegurarme de que todo está claro antes de que tomes una decisión.\n\nLa propuesta incluye [resumen breve]. El próximo paso sería [acción concreta].\n\n¿Hay algo que quieras que ajuste o que no te cuadre?\n\n¿Empezamos esta semana o la próxima?` },
];

const PRICING_FACTORS = [
  { label: 'Actividad económica', options: ['Servicios profesionales', 'Ecommerce', 'Hostelería', 'Construcción', 'Otro'] },
  { label: 'Facturación anual estimada', options: ['< 30.000€', '30.000-80.000€', '80.000-250.000€', '> 250.000€'] },
  { label: 'Nº de facturas/mes', options: ['< 20', '20-50', '50-150', '> 150'] },
  { label: 'Nº de empleados', options: ['0', '1-3', '4-10', '> 10'] },
  { label: 'Régimen', options: ['Autónomo RETA', 'SL/SA', 'Cooperativa', 'Otro'] },
];

function ObjectionAssistant() {
  const [selected, setSelected] = useState(null);
  const [custom, setCustom] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');

  const copy = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000); };

  const handleAI = async () => {
    if (!custom) return;
    setLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un asesor de ventas experto en servicios de asesoría fiscal y financiera para pymes españolas. Un prospecto dice: "${custom}"\n\nGenera 3 respuestas:\n1. Respuesta directa para WhatsApp (máx 2 frases)\n2. Respuesta consultiva para llamada (3-4 frases)\n3. Pregunta de reencuadre\n\nTono: profesional, empático, sin presión. Sin promesas absolutas.`
    });
    setAiResponse(typeof res === 'string' ? res : res?.response || '');
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Selecciona una objeción frecuente o escribe una personalizada:</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {OBJECTIONS.map((o, i) => (
          <button key={i} onClick={() => setSelected(o === selected ? null : o)} className={cn('px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left', selected === o ? 'bg-primary text-white border-primary' : 'bg-card border-border hover:border-primary hover:text-primary')}>{o.objection}</button>
        ))}
      </div>

      {selected && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="bg-secondary/50 px-4 py-3 border-b border-border"><p className="font-semibold text-sm">"{selected.objection}"</p></div>
          <div className="p-4 space-y-4">
            {[
              { key: 'short', label: '💬 Respuesta directa (WhatsApp)', text: selected.response_short },
              { key: 'consultive', label: '📞 Respuesta consultiva (llamada)', text: selected.response_consultive },
              { key: 'reframe', label: '🔄 Pregunta de reencuadre', text: selected.reframe },
            ].map(({ key, label, text }) => (
              <div key={key}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{label}</p>
                <div className="bg-secondary/30 rounded-xl p-3 relative group">
                  <p className="text-sm pr-8">{text}</p>
                  <button onClick={() => copy(text, key)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {copied === key ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <p className="text-xs font-semibold mb-2">O escribe una objeción personalizada:</p>
        <div className="flex gap-2">
          <input className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm" placeholder="Ej: Ya probé otra asesoría y fue un desastre..." value={custom} onChange={e => setCustom(e.target.value)} />
          <Button size="sm" onClick={handleAI} disabled={!custom || loading} className="gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}IA
          </Button>
        </div>
        {aiResponse && <div className="mt-3 bg-slate-900 text-white rounded-xl p-4 text-sm whitespace-pre-wrap">{aiResponse}</div>}
      </div>
    </div>
  );
}

function PricingGuardrail() {
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);

  const calc = () => {
    let base = 85;
    if (values.facturacion?.includes('30.000-80.000')) base = 120;
    if (values.facturacion?.includes('80.000-250.000')) base = 180;
    if (values.facturacion?.includes('> 250.000')) base = 280;
    if (values.facturas?.includes('20-50')) base += 20;
    if (values.facturas?.includes('50-150')) base += 60;
    if (values.facturas?.includes('> 150')) base += 120;
    if (values.empleados?.includes('1-3')) base += 30;
    if (values.empleados?.includes('4-10')) base += 80;
    if (values.empleados?.includes('> 10')) base += 160;
    if (values.actividad?.includes('Ecommerce')) base += 40;
    if (values.actividad?.includes('Hostelería')) base += 30;
    const min = Math.round(base * 0.75);
    const rec = Math.round(base);
    const premium = Math.round(base * 1.4);
    const margin = Math.round(rec * 0.45);
    setResult({ min, rec, premium, margin, risk: rec < 100 ? 'Precio mínimo muy bajo. Revisar si el volumen lo justifica.' : null });
  };

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-sm text-muted-foreground">Calcula el precio mínimo recomendado según el perfil del cliente:</p>
      <div className="grid grid-cols-2 gap-3">
        {PRICING_FACTORS.map(f => (
          <div key={f.label}>
            <label className="text-xs font-medium mb-1 block">{f.label}</label>
            <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={values[f.label] || ''} onChange={e => setValues(p => ({ ...p, [f.label]: e.target.value }))}>
              <option value="">Seleccionar...</option>
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>
      <Button onClick={calc} className="w-full">Calcular precio recomendado</Button>
      {result && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-sm">Resultado del Pricing Guardrail</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Precio mínimo', value: `${result.min}€/mes`, color: 'text-red-600' },
              { label: 'Precio recomendado', value: `${result.rec}€/mes`, color: 'text-emerald-600' },
              { label: 'Precio premium', value: `${result.premium}€/mes`, color: 'text-blue-600' },
            ].map(p => (
              <div key={p.label} className="bg-secondary/50 rounded-xl p-3 text-center"><p className={cn('text-xl font-bold', p.color)}>{p.value}</p><p className="text-xs text-muted-foreground mt-1">{p.label}</p></div>
            ))}
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
            <p className="font-semibold mb-1">Margen estimado al precio recomendado:</p>
            <p>~{result.margin}€/mes · ~{Math.round(result.margin * 12).toLocaleString('es-ES')}€/año por cliente</p>
          </div>
          {result.risk && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">⚠ {result.risk}</div>}
          <p className="text-xs text-muted-foreground italic">Borrador orientativo. El precio final depende del margen deseado, la competencia y la estrategia comercial.</p>
        </div>
      )}
    </div>
  );
}

export default function GrowthSalesCenter() {
  const [tab, setTab] = useState('objections');

  return (
    <div className="p-6 space-y-5">
      <div><h1 className="text-xl font-bold font-jakarta">Sales Enablement Center</h1><p className="text-sm text-muted-foreground">Herramientas de venta: objeciones, scripts, pricing y propuestas</p></div>

      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all', tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'objections' && <ObjectionAssistant />}

      {tab === 'scripts' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Scripts comerciales listos para usar. Edita antes de enviar.</p>
          {SCRIPTS.map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{s.type}</span><p className="font-semibold text-sm">{s.title}</p></div>
                <button onClick={() => navigator.clipboard.writeText(s.script)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Copy className="w-3 h-3" />Copiar</button>
              </div>
              <pre className="p-4 text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{s.script}</pre>
            </div>
          ))}
        </div>
      )}

      {tab === 'pricing' && <PricingGuardrail />}

      {tab === 'proposals' && (
        <div className="bg-secondary/30 rounded-2xl p-8 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-semibold text-lg mb-2">Generador de Propuestas</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">Constructor de propuestas comerciales basadas en diagnóstico, con planes Básico/Pro/Premium. Disponible en Fase 2.</p>
          <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-semibold mt-4"><Sparkles className="w-3 h-3" />Fase 2 · Próximamente</div>
        </div>
      )}
    </div>
  );
}
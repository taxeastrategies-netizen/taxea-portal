import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, Loader2, AlertTriangle, CheckCircle2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEMO_TEXTS = [
  { label: 'Anuncio garantia fiscal', text: 'Te garantizamos pagar menos impuestos. Ahorro fiscal asegurado desde el primer trimestre. Sin riesgo y sin complicaciones.' },
  { label: 'Landing testimonios', text: 'Nuestros clientes ahorran de media un 30% en impuestos. Somos los mejores asesores fiscales de Canarias. Resultados garantizados.' },
  { label: 'Email captacion', text: 'Cambia a Taxea y pagaras menos seguro. Si no ahorras en tu primera declaracion te devolvemos el dinero.' },
  { label: 'WhatsApp marketing', text: 'Hola! Te escribo de Taxea. Tenemos una oferta especial de asesoria fiscal. Responde SI para recibir mas informacion.' },
  { label: 'Post redes sociales', text: 'Puedes deducirte todos los gastos del coche siendo autonomo. Consulta con nosotros y maximiza tus deducciones.' },
  { label: 'Texto prudente (OK)', text: 'En Taxea te ayudamos a mantener tu fiscalidad al dia, identificar posibles optimizaciones dentro del marco legal y tomar decisiones con informacion clara. Cada caso es diferente.' },
];

const RISK_COLORS = {
  bajo: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  medio: 'bg-amber-50 border-amber-200 text-amber-800',
  alto: 'bg-orange-50 border-orange-200 text-orange-800',
  critico: 'bg-red-50 border-red-200 text-red-800',
};
const RISK_BADGE = {
  bajo: 'bg-emerald-100 text-emerald-700',
  medio: 'bg-amber-100 text-amber-700',
  alto: 'bg-orange-100 text-orange-700',
  critico: 'bg-red-100 text-red-700',
};

export default function MarketingLegalRiskChecker() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = async (text) => {
    const txt = text || input;
    if (!txt.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto en compliance de marketing para servicios fiscales y financieros en Espana. Analiza el texto publicitario y devuelve un JSON con este formato exacto:
{
  "nivel_riesgo": "bajo|medio|alto|critico",
  "resumen": "evaluacion breve de 2-3 frases",
  "problemas": [
    {
      "fragmento": "texto con el problema",
      "tipo": "promesa garantizada|publicidad enganosa|claim fiscal|testimonios|urgencia agresiva|RGPD|falta aviso legal|otro",
      "motivo": "explicacion del riesgo legal",
      "version_corregida": "texto mejorado prudente",
      "gravedad": "bajo|medio|alto|critico"
    }
  ],
  "version_comercial_prudente": "reescritura completa del texto de forma segura y vendedora",
  "checklist": ["item1", "item2"]
}

Texto a analizar:
${txt}

RECUERDA: Todo output es borrador que requiere validacion profesional.`,
      response_json_schema: {
        type: 'object',
        properties: {
          nivel_riesgo: { type: 'string' },
          resumen: { type: 'string' },
          problemas: { type: 'array', items: { type: 'object' } },
          version_comercial_prudente: { type: 'string' },
          checklist: { type: 'array', items: { type: 'string' } },
        },
      },
    });
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><Shield className="w-5 h-5 text-primary" />Marketing Legal Risk Checker</h1>
        <p className="text-sm text-muted-foreground">Revisa textos publicitarios antes de publicar — detecta claims peligrosos, promesas y riesgos RGPD</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Ejemplos para probar</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_TEXTS.map(d => (
            <button key={d.label} onClick={() => { setInput(d.text); setResult(null); }} className="text-xs px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary hover:text-primary transition-all">{d.label}</button>
          ))}
        </div>
      </div>

      <div>
        <textarea
          className="w-full h-32 rounded-xl border border-input bg-card px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Pega aqui el texto: anuncio, landing, email, WhatsApp, post, propuesta..."
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <Button onClick={() => analyze()} disabled={!input.trim() || loading} className="mt-2 gap-2 w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          Analizar riesgo legal
        </Button>
      </div>

      {loading && <div className="flex items-center gap-3 justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Analizando riesgos...</p></div>}

      {result && (
        <div className="space-y-4">
          <div className={cn('border rounded-2xl p-5', RISK_COLORS[result.nivel_riesgo] || 'bg-card border-border')}>
            <div className="flex items-center gap-3 mb-2">
              {result.nivel_riesgo === 'bajo' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
              <p className="font-bold text-lg">Nivel de riesgo: <span className={cn('px-2 py-0.5 rounded-full text-sm uppercase', RISK_BADGE[result.nivel_riesgo])}>{result.nivel_riesgo}</span></p>
            </div>
            <p className="text-sm leading-relaxed">{result.resumen}</p>
          </div>

          {result.problemas && result.problemas.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-3">Problemas detectados ({result.problemas.length})</p>
              <div className="space-y-3">
                {result.problemas.map((p, i) => (
                  <div key={i} className={cn('border rounded-xl p-4', RISK_COLORS[p.gravedad] || 'bg-card border-border')}>
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-wide">{p.tipo}</p>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', RISK_BADGE[p.gravedad])}>{p.gravedad}</span>
                    </div>
                    <p className="text-sm font-semibold mb-1 italic">"{p.fragmento}"</p>
                    <p className="text-sm mb-2">{p.motivo}</p>
                    <div className="bg-white/60 rounded-lg p-3">
                      <p className="text-xs font-semibold mb-1 text-emerald-700">Version corregida:</p>
                      <p className="text-sm">{p.version_corregida}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.version_comercial_prudente && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-bold text-emerald-800 mb-2">Version comercial prudente — BORRADOR</p>
              <p className="text-sm text-emerald-900 leading-relaxed">{result.version_comercial_prudente}</p>
              <p className="text-[10px] text-emerald-600 mt-2 italic">Borrador prudente. Requiere validacion profesional antes de publicar.</p>
            </div>
          )}

          {result.checklist && result.checklist.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold mb-2 text-muted-foreground">Checklist antes de publicar</p>
              {result.checklist.map((item, i) => (
                <p key={i} className="text-sm flex items-start gap-2 mb-1"><span className="text-primary mt-0.5">☐</span>{item}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
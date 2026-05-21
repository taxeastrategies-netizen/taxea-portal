import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Brain, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEMO_TEXTS = [
  { label: 'Deducciones coche', text: 'Puedes deducirte todos los gastos del coche siendo autonomo. El 100% de la amortizacion y combustible son deducibles si lo usas para el negocio.' },
  { label: 'Ahorro IGIC', text: 'En Canarias no pagas IVA gracias al IGIC. El tipo general es del 7% y muchos productos estan exentos. Ahorra impuestos con IGIC.' },
  { label: 'SL vs Autonomo', text: 'Montar una SL siempre es mas ventajoso fiscalmente que ser autonomo cuando facturas mas de 40.000EUR al ano. El Impuesto de Sociedades es mas barato.' },
  { label: 'Texto prudente OK', text: 'La deducibilidad de los gastos del vehiculo para autonomos depende de varios factores: el grado de afectacion a la actividad, la justificacion documental y la casuistica especifica de cada caso. Es recomendable consultar con un asesor antes de aplicar cualquier deduccion.' },
];

export default function FiscalSeoComplianceChecker() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = async (text) => {
    const txt = text || input;
    if (!txt.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un experto en compliance fiscal y editorial para contenidos de marketing en Espana. Revisa este texto para publicacion SEO/editorial y devuelve un JSON:
{
  "nivel_riesgo": "bajo|medio|alto|critico",
  "apto_publicar": false,
  "resumen": "evaluacion en 2-3 frases",
  "problemas": [
    {
      "parrafo": "fragmento problematico",
      "tipo": "afirmacion absoluta|confusion IVA-IGIC|deduccion automatica|ausencia prudencia|requisitos omitidos|territorio incorrecto|otro",
      "motivo": "por que es problematico",
      "version_prudente": "reescritura correcta"
    }
  ],
  "version_final": "texto completo reescrito de forma prudente y publicable",
  "checklist_publicacion": ["item1", "item2", "item3"]
}

Texto:
${txt}

TODO es borrador. Requiere validacion de asesor fiscal.`,
      response_json_schema: {
        type: 'object',
        properties: {
          nivel_riesgo: { type: 'string' },
          apto_publicar: { type: 'boolean' },
          resumen: { type: 'string' },
          problemas: { type: 'array', items: { type: 'object' } },
          version_final: { type: 'string' },
          checklist_publicacion: { type: 'array', items: { type: 'string' } },
        },
      },
    });
    setResult(res);
    setLoading(false);
  };

  const RISK_STYLE = { bajo: 'bg-emerald-50 border-emerald-200', medio: 'bg-amber-50 border-amber-200', alto: 'bg-orange-50 border-orange-200', critico: 'bg-red-50 border-red-200' };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />Fiscal SEO Compliance Checker</h1>
        <p className="text-sm text-muted-foreground">Revisa articulos y landings fiscales antes de publicar — detecta afirmaciones absolutas, confusion IVA/IGIC y ausencia de prudencia</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Textos de ejemplo</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_TEXTS.map(d => (
            <button key={d.label} onClick={() => { setInput(d.text); setResult(null); }} className="text-xs px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary hover:text-primary transition-all">{d.label}</button>
          ))}
        </div>
      </div>

      <div>
        <textarea className="w-full h-32 rounded-xl border border-input bg-card px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Pega el articulo, parrafo o landing page para revisar..." value={input} onChange={e => setInput(e.target.value)} />
        <Button onClick={() => analyze()} disabled={!input.trim() || loading} className="mt-2 gap-2 w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}Revisar compliance fiscal
        </Button>
      </div>

      {loading && <div className="flex items-center gap-3 justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Analizando compliance fiscal...</p></div>}

      {result && (
        <div className="space-y-4">
          <div className={cn('border rounded-2xl p-5', RISK_STYLE[result.nivel_riesgo] || 'bg-card border-border')}>
            <div className="flex items-center gap-3 mb-2">
              {result.apto_publicar ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
              <p className="font-bold">{result.apto_publicar ? 'Apto para publicar (con revision)' : 'No apto — requiere correccion'} · Riesgo: <span className="uppercase">{result.nivel_riesgo}</span></p>
            </div>
            <p className="text-sm">{result.resumen}</p>
          </div>

          {result.problemas && result.problemas.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-3">Problemas detectados</p>
              <div className="space-y-3">
                {result.problemas.map((p, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-bold uppercase text-muted-foreground">{p.tipo}</span>
                    </div>
                    <p className="text-sm italic mb-1">"{p.parrafo}"</p>
                    <p className="text-sm text-red-700 mb-2">{p.motivo}</p>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-emerald-700 mb-1">Version prudente:</p>
                      <p className="text-sm text-emerald-900">{p.version_prudente}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.version_final && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-bold text-emerald-800 mb-2">Texto corregido — BORRADOR</p>
              <p className="text-sm text-emerald-900 leading-relaxed whitespace-pre-wrap">{result.version_final}</p>
              <p className="text-[10px] text-emerald-600 mt-2 italic">Borrador pendiente de validacion por asesor fiscal antes de publicar.</p>
            </div>
          )}

          {result.checklist_publicacion && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-semibold mb-2 text-muted-foreground">Checklist de publicacion</p>
              {result.checklist_publicacion.map((item, i) => (
                <p key={i} className="text-sm flex items-start gap-2 mb-1"><span className="text-primary mt-0.5">☐</span>{item}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
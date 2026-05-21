import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { DollarSign, Brain, Loader2, AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEFAULT = {
  tipo_cliente: 'autonomo', facturacion: 80000, actividad: 'servicios', facturas_mes: 25,
  trabajadores: 0, sociedades: 0, regimen: 'irpf', ecommerce: false,
  operaciones_ext: false, desorden: 'medio', urgencia: 'media',
  regularizacion: false, soporte_esperado: 'normal', reuniones_mes: 1,
  reporting: false, coste_hora: 45, margen_objetivo: 40, descuento: 0,
};

const PLANS = [
  { name: 'Basico', base: 95, desc: 'Autonomo sencillo, poca complejidad' },
  { name: 'Profesional', base: 180, desc: 'Autonomo o SL con actividad moderada' },
  { name: 'Premium', base: 320, desc: 'SL compleja, reporting, soporte avanzado' },
];

function calcPrice(data) {
  let hours = 3; // base mensual
  if (data.tipo_cliente === 'sl') hours += 3;
  if (data.facturacion > 200000) hours += 2;
  if (data.facturacion > 500000) hours += 3;
  if (data.facturas_mes > 50) hours += 1.5;
  if (data.trabajadores > 0) hours += data.trabajadores * 0.5;
  if (data.ecommerce) hours += 2;
  if (data.operaciones_ext) hours += 2;
  if (data.desorden === 'alto') hours += 2;
  if (data.regularizacion) hours += 3;
  if (data.soporte_esperado === 'alto') hours += 2;
  if (data.reuniones_mes > 1) hours += (data.reuniones_mes - 1) * 1.5;
  if (data.reporting) hours += 2;

  const coste_bruto = hours * data.coste_hora;
  const precio_minimo = Math.round(coste_bruto * (1 + 0.15)); // 15% minimo
  const precio_recomendado = Math.round(coste_bruto / (1 - data.margen_objetivo / 100));
  const margen_estimado = Math.round((1 - coste_bruto / precio_recomendado) * 100);

  return { hours: Math.round(hours * 10) / 10, coste_bruto: Math.round(coste_bruto), precio_minimo, precio_recomendado, margen_estimado };
}

export default function PricingGuardrailV2() {
  const [data, setData] = useState(DEFAULT);
  const [result, setResult] = useState(null);
  const [aiArg, setAiArg] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setData(p => ({ ...p, [k]: v }));

  const calculate = () => setResult(calcPrice(data));

  const generateArgument = async () => {
    if (!result) return;
    setLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Eres un asesor comercial experto en venta de servicios de asesoria fiscal. Genera un argumento para defender el precio de ${result.precio_recomendado}EUR/mes a un cliente ${data.tipo_cliente} con facturacion de ${data.facturacion.toLocaleString('es-ES')}EUR/ano.\n\nEl precio minimo es ${result.precio_minimo}EUR/mes. Horas estimadas mensuales: ${result.hours}h. Coste interno: ${result.coste_bruto}EUR.\n\nGenera:\n1. Argumento principal de valor (2 frases)\n2. Respuesta a "es demasiado caro"\n3. Comparativa con coste de errores fiscales\n4. Condiciones negociables\n\nTono: consultivo, no vendedor. Borrador.`,
    });
    setAiArg(typeof res === 'string' ? res : res?.response || '');
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold font-jakarta flex items-center gap-2"><Shield className="w-5 h-5 text-primary" />Pricing Guardrail</h1>
        <p className="text-sm text-muted-foreground">Calcula el precio minimo defendible y el precio optimo segun complejidad operativa del cliente</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Tipo cliente</label>
              <select className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={data.tipo_cliente} onChange={e => set('tipo_cliente', e.target.value)}>
                <option value="autonomo">Autonomo</option>
                <option value="sl">SL / SA</option>
                <option value="cooperativa">Cooperativa</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Facturacion EUR/ano</label>
              <input type="number" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={data.facturacion} onChange={e => set('facturacion', +e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Facturas/mes</label>
              <input type="number" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={data.facturas_mes} onChange={e => set('facturas_mes', +e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Trabajadores</label>
              <input type="number" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={data.trabajadores} onChange={e => set('trabajadores', +e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Desorden documental</label>
              <select className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={data.desorden} onChange={e => set('desorden', e.target.value)}>
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Soporte esperado</label>
              <select className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={data.soporte_esperado} onChange={e => set('soporte_esperado', e.target.value)}>
                <option value="bajo">Bajo (email)</option>
                <option value="normal">Normal</option>
                <option value="alto">Alto (WhatsApp)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Coste/hora interno (EUR)</label>
              <input type="number" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={data.coste_hora} onChange={e => set('coste_hora', +e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Margen objetivo (%)</label>
              <input type="number" className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm" value={data.margen_objetivo} onChange={e => set('margen_objetivo', +e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            {[['ecommerce','Ecommerce'],['operaciones_ext','Op. exteriores'],['regularizacion','Regularizacion'],['reporting','Reporting']].map(([k,l]) => (
              <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={data[k]} onChange={e => set(k, e.target.checked)} className="rounded" />
                {l}
              </label>
            ))}
          </div>
          <Button onClick={calculate} className="w-full">Calcular precio</Button>
        </div>

        {result && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Resultado del calculo</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-2xl font-bold text-white">{result.precio_recomendado}EUR/mes</p>
                  <p className="text-xs text-white/50 mt-0.5">Precio recomendado</p>
                  <p className="text-xs text-white/30">{result.margen_estimado}% margen estimado</p>
                </div>
                <div className="bg-white/8 rounded-xl p-3">
                  <p className="text-xl font-bold text-amber-400">{result.precio_minimo}EUR/mes</p>
                  <p className="text-xs text-white/50 mt-0.5">Precio minimo</p>
                  <p className="text-xs text-white/30">No negociar por debajo</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between"><span className="text-white/40">Horas estimadas</span><span className="text-white/80">{result.hours}h/mes</span></div>
                <div className="flex justify-between"><span className="text-white/40">Coste interno</span><span className="text-white/80">{result.coste_bruto}EUR</span></div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Planes recomendados</p>
              {PLANS.map(p => (
                <div key={p.name} className={cn('border rounded-xl p-3 mb-2', result.precio_recomendado >= p.base && result.precio_recomendado < p.base + 150 ? 'border-primary bg-primary/5' : 'border-border')}>
                  <div className="flex justify-between items-center">
                    <div><p className="font-semibold text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.desc}</p></div>
                    <p className="font-bold text-sm">{p.base}EUR+/mes</p>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={generateArgument} variant="outline" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}Generar argumento de defensa de precio
            </Button>

            {aiArg && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-[10px] text-amber-600 font-semibold mb-2">BORRADOR — Revisar antes de usar</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiArg}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
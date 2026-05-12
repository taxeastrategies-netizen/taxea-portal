import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Shield } from 'lucide-react';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function InvestSimulator({ liquidez }) {
  const { exceso } = liquidez;
  const [importe, setImporte] = useState(Math.min(exceso || 20000, 100000));
  const [horizonte, setHorizonte] = useState(12);
  const [rendimiento, setRendimiento] = useState(3.5);
  const [inflacion, setInflacion] = useState(2.5);

  const result = useMemo(() => {
    const meses = horizonte;
    const tasaMensual = rendimiento / 100 / 12;
    const capitalFinal = importe * Math.pow(1 + tasaMensual, meses);
    const gananciaNominal = capitalFinal - importe;
    const inflacionAcum = importe * Math.pow(1 + inflacion / 100 / 12, meses) - importe;
    const gananciaReal = gananciaNominal - inflacionAcum;
    const rendimientoReal = rendimiento - inflacion;
    return { capitalFinal, gananciaNominal, gananciaReal, rendimientoReal };
  }, [importe, horizonte, rendimiento, inflacion]);

  const sliderCls = "w-full h-2 rounded-full accent-violet-600 cursor-pointer";

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <p className="text-xs text-amber-700"><strong>Simulación orientativa.</strong> Los resultados son estimaciones matemáticas. No garantizan rentabilidad real. Las inversiones conllevan riesgo de pérdida de capital.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sliders */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <p className="text-sm font-semibold text-foreground">Parámetros de simulación</p>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Capital a simular</label>
              <span className="text-sm font-bold text-violet-600">{fmt(importe)}</span>
            </div>
            <input type="range" min={1000} max={500000} step={1000} value={importe}
              onChange={e => setImporte(Number(e.target.value))} className={sliderCls} />
            <div className="flex justify-between text-[10px] text-slate-300 mt-1"><span>1.000€</span><span>500.000€</span></div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Horizonte</label>
              <span className="text-sm font-bold text-violet-600">{horizonte} meses ({(horizonte / 12).toFixed(1)} años)</span>
            </div>
            <input type="range" min={1} max={120} step={1} value={horizonte}
              onChange={e => setHorizonte(Number(e.target.value))} className={sliderCls} />
            <div className="flex justify-between text-[10px] text-slate-300 mt-1"><span>1 mes</span><span>10 años</span></div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Rendimiento anual orientativo</label>
              <span className="text-sm font-bold text-violet-600">{rendimiento.toFixed(1)}%</span>
            </div>
            <input type="range" min={0} max={12} step={0.1} value={rendimiento}
              onChange={e => setRendimiento(Number(e.target.value))} className={sliderCls} />
            <div className="flex justify-between text-[10px] text-slate-300 mt-1"><span>0%</span><span>12%</span></div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Inflación estimada</label>
              <span className="text-sm font-bold text-slate-500">{inflacion.toFixed(1)}%</span>
            </div>
            <input type="range" min={0} max={10} step={0.1} value={inflacion}
              onChange={e => setInflacion(Number(e.target.value))} className={sliderCls} />
            <div className="flex justify-between text-[10px] text-slate-300 mt-1"><span>0%</span><span>10%</span></div>
          </div>
        </div>

        {/* Resultados */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
            <p className="text-xs text-violet-200 mb-1 uppercase tracking-wider">Capital final orientativo</p>
            <p className="text-4xl font-jakarta font-bold">{fmt(result.capitalFinal)}</p>
            <p className="text-xs text-violet-200 mt-1">Desde {fmt(importe)} · {horizonte} meses</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Ganancia nominal orient.', value: fmt(result.gananciaNominal), color: 'text-emerald-600', note: `${rendimiento}% anual` },
              { label: 'Ganancia real orient.', value: fmt(result.gananciaReal), color: result.gananciaReal > 0 ? 'text-emerald-600' : 'text-red-500', note: `vs inflación ${inflacion}%` },
              { label: 'Rendimiento real', value: `${result.rendimientoReal.toFixed(2)}%`, color: result.rendimientoReal > 0 ? 'text-emerald-600' : 'text-red-500', note: 'Ajustado inflación' },
              { label: 'Impacto en tesorería', value: `+${fmt(result.capitalFinal - importe)}`, color: 'text-violet-600', note: 'Ganancia potencial' },
            ].map((m, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                <p className="text-[10px] text-slate-400 mb-1">{m.label}</p>
                <p className={cn("text-lg font-jakarta font-bold", m.color)}>{m.value}</p>
                <p className="text-[9px] text-slate-300">{m.note}</p>
              </div>
            ))}
          </div>

          {/* Evolución visual */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-foreground mb-3">Evolución estimada</p>
            <div className="flex items-end gap-1 h-20">
              {Array.from({ length: Math.min(horizonte, 24) }, (_, i) => {
                const m = Math.floor((i / Math.min(horizonte, 24)) * horizonte) + 1;
                const cap = importe * Math.pow(1 + rendimiento / 100 / 12, m);
                const h = ((cap - importe) / (result.capitalFinal - importe || 1)) * 100;
                return (
                  <div key={i} className="flex-1 bg-violet-400 rounded-t" style={{ height: `${Math.max(h, 3)}%` }} />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
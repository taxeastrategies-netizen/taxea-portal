import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Sliders, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

function calcCuota(importe, tinAnual, meses) {
  if (meses <= 0 || importe <= 0) return 0;
  if (tinAnual === 0) return importe / meses;
  const r = tinAnual / 100 / 12;
  return importe * (r * Math.pow(1 + r, meses)) / (Math.pow(1 + r, meses) - 1);
}

function calcInteresesTotales(importe, tin, meses) {
  const cuota = calcCuota(importe, tin, meses);
  return cuota * meses - importe;
}

export default function DebtSimulator({ debts, kpis }) {
  const [sim, setSim] = useState({
    importe: 50000,
    tin: 5.5,
    meses: 60,
    tipo: 'prestamo_bancario',
  });

  const setSim_ = (k, v) => setSim(s => ({ ...s, [k]: v }));

  const result = useMemo(() => {
    const cuota = calcCuota(sim.importe, sim.tin, sim.meses);
    const interesesTotales = calcInteresesTotales(sim.importe, sim.tin, sim.meses);
    const costeTotalFinanciacion = sim.importe + interesesTotales;
    const nuevaDeudaTotal = (kpis.deudaTotal || 0) + sim.importe;
    const nuevaCuotaMensual = (kpis.cuotaMensual || 0) + cuota;
    const impactoCashflowAnual = cuota * 12;
    const deudaEbitdaNuevo = kpis.ebitda > 0 ? nuevaDeudaTotal / kpis.ebitda : null;
    const runwayImpact = kpis.ebitda > 0 ? (cuota * 12) / kpis.ebitda * 100 : 0;

    return { cuota, interesesTotales, costeTotalFinanciacion, nuevaDeudaTotal, nuevaCuotaMensual, impactoCashflowAnual, deudaEbitdaNuevo, runwayImpact };
  }, [sim, kpis]);

  const riesgo = result.deudaEbitdaNuevo === null ? 'green' : result.deudaEbitdaNuevo < 3 ? 'green' : result.deudaEbitdaNuevo < 5 ? 'amber' : 'red';

  const TIPOS = [
    { value: 'prestamo_bancario', label: 'Préstamo bancario' },
    { value: 'ico', label: 'ICO' },
    { value: 'leasing', label: 'Leasing' },
    { value: 'linea_credito', label: 'Línea de crédito' },
  ];

  const sliderCls = "w-full h-2 rounded-full accent-taxea-red cursor-pointer";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs simulador */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold text-foreground">Parámetros del nuevo instrumento</p>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Tipo de financiación</label>
            <div className="flex gap-2 flex-wrap">
              {TIPOS.map(t => (
                <button key={t.value} onClick={() => setSim_('tipo', t.value)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                    sim.tipo === t.value ? "bg-taxea-red text-white border-taxea-red" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Importe */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Importe</label>
              <span className="text-sm font-bold text-taxea-red">{fmt(sim.importe)}</span>
            </div>
            <input type="range" min={5000} max={500000} step={5000} value={sim.importe}
              onChange={e => setSim_('importe', Number(e.target.value))} className={sliderCls} />
            <div className="flex justify-between text-[10px] text-slate-300 mt-1">
              <span>5.000€</span><span>500.000€</span>
            </div>
          </div>

          {/* TIN */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Tipo de interés (TIN)</label>
              <span className="text-sm font-bold text-taxea-red">{sim.tin.toFixed(2)}%</span>
            </div>
            <input type="range" min={0} max={15} step={0.1} value={sim.tin}
              onChange={e => setSim_('tin', Number(e.target.value))} className={sliderCls} />
            <div className="flex justify-between text-[10px] text-slate-300 mt-1">
              <span>0%</span><span>15%</span>
            </div>
          </div>

          {/* Plazo */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Plazo</label>
              <span className="text-sm font-bold text-taxea-red">{sim.meses} meses ({(sim.meses / 12).toFixed(1)} años)</span>
            </div>
            <input type="range" min={6} max={300} step={6} value={sim.meses}
              onChange={e => setSim_('meses', Number(e.target.value))} className={sliderCls} />
            <div className="flex justify-between text-[10px] text-slate-300 mt-1">
              <span>6 meses</span><span>25 años</span>
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="space-y-4">
          {/* Semáforo */}
          <div className={cn("rounded-2xl p-5 border", riesgo === 'green' ? "bg-emerald-50 border-emerald-200" : riesgo === 'amber' ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200")}>
            <div className="flex items-center gap-2 mb-2">
              {riesgo === 'green' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className={cn("w-5 h-5", riesgo === 'amber' ? "text-amber-600" : "text-red-600")} />}
              <p className={cn("text-sm font-bold", riesgo === 'green' ? "text-emerald-700" : riesgo === 'amber' ? "text-amber-700" : "text-red-700")}>
                {riesgo === 'green' ? 'Impacto manejable' : riesgo === 'amber' ? 'Impacto moderado — vigilar' : 'Impacto elevado — riesgo alto'}
              </p>
            </div>
            <p className={cn("text-xs", riesgo === 'green' ? "text-emerald-600" : riesgo === 'amber' ? "text-amber-600" : "text-red-600")}>
              {result.deudaEbitdaNuevo !== null
                ? `Con esta operación, tu ratio Deuda/EBITDA pasaría a ${result.deudaEbitdaNuevo.toFixed(2)}x.`
                : `Cuota mensual estimada: ${fmt(result.cuota)}`}
            </p>
          </div>

          {/* Métricas resultado */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-foreground mb-3">Resultados de la simulación</p>
            {[
              { label: 'Cuota mensual', value: fmt(result.cuota), highlight: true },
              { label: 'Total intereses pagados', value: fmt(result.interesesTotales) },
              { label: 'Coste total financiación', value: fmt(result.costeTotalFinanciacion) },
              { label: 'Nueva deuda total empresa', value: fmt(result.nuevaDeudaTotal) },
              { label: 'Nueva cuota mensual total', value: fmt(result.nuevaCuotaMensual) },
              { label: 'Impacto cashflow anual', value: fmt(result.impactoCashflowAnual), note: `${result.runwayImpact.toFixed(1)}% del EBITDA` },
            ].map((m, i) => (
              <div key={i} className={cn("flex items-center justify-between py-1.5", i < 5 ? "border-b border-slate-50" : "")}>
                <span className="text-xs text-slate-500">{m.label}</span>
                <div className="text-right">
                  <span className={cn("text-sm font-bold", m.highlight ? "text-taxea-red" : "text-foreground")}>{m.value}</span>
                  {m.note && <p className="text-[10px] text-slate-400">{m.note}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Cuadro amortización mini */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-foreground mb-3">Evolución capital — primeros 12 meses</p>
            <div className="flex items-end gap-1 h-20">
              {Array.from({ length: 12 }, (_, m) => {
                const capitalRestante = sim.importe - (sim.importe / sim.meses) * (m + 1);
                const h = (capitalRestante / sim.importe) * 100;
                return (
                  <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full bg-blue-400 rounded-t" style={{ height: `${h}%` }} />
                    <span className="text-[8px] text-slate-400">{m + 1}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
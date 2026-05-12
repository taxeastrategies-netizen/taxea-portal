import { useMemo } from 'react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}
function pct(n) { return `${(n || 0).toFixed(2)}%`; }

export default function DebtCostPanel({ debts, kpis }) {
  const active = debts.filter(d => d.estado === 'activo');

  const { byCost, totalIntereses, costoMedio, costoMensual } = useMemo(() => {
    let totalCap = 0, totalCosto = 0;
    const byCost = active.map(d => {
      const cap = d.capital_pendiente || d.importe_inicial || 0;
      const interesAnual = cap * ((d.tin || 0) / 100);
      totalCap += cap;
      totalCosto += interesAnual;
      return { ...d, cap, interesAnual, interesAnualPct: d.tin || 0 };
    }).sort((a, b) => b.interesAnual - a.interesAnual);

    const costoMedio = totalCap > 0 ? (totalCosto / totalCap) * 100 : 0;
    return { byCost, totalIntereses: totalCosto, costoMedio, costoMensual: totalCosto / 12 };
  }, [active]);

  const TIPO_BADGE = {
    prestamo_bancario: 'bg-blue-50 text-blue-700 border-blue-200',
    ico: 'bg-taxea-red/8 text-taxea-red border-taxea-red/20',
    leasing: 'bg-violet-50 text-violet-700 border-violet-200',
    renting: 'bg-slate-100 text-slate-600 border-slate-200',
    linea_credito: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    poliza: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  const TIPO_LABEL = {
    prestamo_bancario: 'Bancario', ico: 'ICO', leasing: 'Leasing',
    renting: 'Renting', linea_credito: 'Línea', poliza: 'Póliza', otro: 'Otro',
  };

  const costoPctEbitda = kpis.ebitda > 0 ? (totalIntereses / kpis.ebitda) * 100 : 0;
  const costoStatus = costoPctEbitda < 10 ? 'green' : costoPctEbitda < 20 ? 'amber' : 'red';

  return (
    <div className="space-y-5">
      {/* KPIs coste */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Intereses anuales', value: fmt(totalIntereses), sub: 'Coste total de deuda/año', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
          { label: 'Intereses mensuales', value: fmt(costoMensual), sub: 'Media mensual estimada', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'Tipo de interés medio', value: pct(costoMedio), sub: 'Coste ponderado deuda', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Carga vs EBITDA', value: pct(costoPctEbitda), sub: 'Referencia: < 20% saludable',
            color: costoStatus === 'green' ? 'text-emerald-600' : costoStatus === 'amber' ? 'text-amber-600' : 'text-red-600',
            bg: costoStatus === 'green' ? 'bg-emerald-50' : costoStatus === 'amber' ? 'bg-amber-50' : 'bg-red-50',
            border: costoStatus === 'green' ? 'border-emerald-100' : costoStatus === 'amber' ? 'border-amber-100' : 'border-red-100' },
        ].map((c, i) => (
          <div key={i} className={cn("bg-white border rounded-2xl p-4 shadow-sm", c.border)}>
            <p className="text-[11px] text-slate-400 mb-1">{c.label}</p>
            <p className={cn("text-xl font-jakarta font-bold", c.color)}>{c.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Ranking coste por instrumento */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-1">Coste financiero por instrumento</p>
        <p className="text-xs text-slate-400 mb-4">Ordenado por mayor coste anual absoluto</p>
        {byCost.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Sin instrumentos activos.</p>
        ) : (
          <div className="space-y-3">
            {byCost.map((d, i) => {
              const pctOfTotal = totalIntereses > 0 ? (d.interesAnual / totalIntereses) * 100 : 0;
              const badge = TIPO_BADGE[d.tipo] || 'bg-slate-100 text-slate-600 border-slate-200';
              return (
                <div key={d.id}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-lg border flex-shrink-0", badge)}>
                      {TIPO_LABEL[d.tipo] || d.tipo}
                    </span>
                    <span className="text-xs font-medium text-foreground flex-1 truncate">{d.nombre}</span>
                    <span className="text-xs font-bold text-foreground">{fmt(d.interesAnual)}/año</span>
                    <span className="text-[10px] text-slate-400 w-12 text-right">{pct(d.interesAnualPct)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-taxea-red/70 rounded-full" style={{ width: `${pctOfTotal}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* IA insight */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <span className="text-lg flex-shrink-0">🤖</span>
        <div>
          <p className="text-xs font-semibold text-blue-800 mb-0.5">Análisis IA — Coste financiero</p>
          <p className="text-xs text-blue-700">
            {costoStatus === 'green'
              ? `Tu coste financiero anual de ${fmt(totalIntereses)} representa el ${pct(costoPctEbitda)} de tu EBITDA estimado. Situación saludable. Mantén el tipo de interés medio (${pct(costoMedio)}) bajo control.`
              : costoStatus === 'amber'
              ? `Tu coste financiero anual de ${fmt(totalIntereses)} representa el ${pct(costoPctEbitda)} de tu EBITDA. Está en zona de vigilancia. Considera refinanciar los instrumentos con mayor TIN.`
              : `⚠ Tu carga financiera anual de ${fmt(totalIntereses)} supera el ${pct(costoPctEbitda)} del EBITDA. Nivel de riesgo elevado. Prioritiza reducir los instrumentos más costosos o refinancia a mejores condiciones.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}
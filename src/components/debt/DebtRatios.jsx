import { useMemo } from 'react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

function RatioCard({ label, value, display, benchmark, description, status, iaText }) {
  const colors = { green: { bg: 'bg-emerald-50', border: 'border-emerald-200', val: 'text-emerald-700', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', val: 'text-amber-700', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    red: { bg: 'bg-red-50', border: 'border-red-200', val: 'text-red-700', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200' },
  };
  const cfg = colors[status] || colors.green;
  const statusLabel = status === 'green' ? 'Saludable' : status === 'amber' ? 'Vigilar' : 'Riesgo';
  return (
    <div className={cn("bg-white border rounded-2xl p-5 shadow-sm", cfg.border)}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-slate-400 font-medium">{label}</p>
          <p className={cn("text-3xl font-jakarta font-bold mt-1", cfg.val)}>{display}</p>
        </div>
        <span className={cn("text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1.5", cfg.badge)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />{statusLabel}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-1">{description}</p>
      {benchmark && <p className="text-[10px] text-slate-300">Benchmark: {benchmark}</p>}
      {iaText && (
        <div className={cn("mt-3 p-2.5 rounded-xl", cfg.bg)}>
          <p className={cn("text-[10px]", cfg.val)}>🤖 {iaText}</p>
        </div>
      )}
    </div>
  );
}

export default function DebtRatios({ debts, kpis, invoices, expenses }) {
  const { ratios } = useMemo(() => {
    const active = debts.filter(d => d.estado === 'activo');
    const deudaTotal = active.reduce((s, d) => s + (d.capital_pendiente || d.importe_inicial || 0), 0);
    const ingresosTotal = invoices.filter(i => i.tipo === 'emitida').reduce((s, i) => s + (i.total_factura || 0), 0);
    const gastosTotal = expenses.filter(e => e.tipo === 'gasto').reduce((s, e) => s + (e.total || 0), 0);
    const ebitda = Math.max(0, ingresosTotal - gastosTotal * 0.85);
    const equity = Math.max(1, ingresosTotal * 0.4);
    const intereses = kpis.interesesAnuales || 0;
    const cuotaAnual = (kpis.cuotaMensual || 0) * 12;

    const deudaEbitda = ebitda > 0 ? deudaTotal / ebitda : null;
    const deudaEquity = deudaTotal / equity;
    const coberturaIntereses = intereses > 0 && ebitda > 0 ? ebitda / intereses : null;
    const leverage = (deudaTotal / Math.max(deudaTotal + equity, 1)) * 100;
    const servicioDeuda = ingresosTotal > 0 ? (cuotaAnual / ingresosTotal) * 100 : 0;
    const autonomiaFinanciera = (equity / Math.max(deudaTotal + equity, 1)) * 100;

    return { ratios: { deudaEbitda, deudaEquity, coberturaIntereses, leverage, servicioDeuda, autonomiaFinanciera, deudaTotal, ebitda, equity, ingresosTotal } };
  }, [debts, kpis, invoices, expenses]);

  const r = ratios;

  const ratioCards = [
    {
      label: 'Deuda / EBITDA',
      value: r.deudaEbitda,
      display: r.deudaEbitda !== null ? `${r.deudaEbitda.toFixed(2)}x` : 'N/D',
      benchmark: '< 3x (recomendado)',
      description: 'Veces que el EBITDA cubre la deuda total',
      status: r.deudaEbitda === null ? 'green' : r.deudaEbitda < 3 ? 'green' : r.deudaEbitda < 5 ? 'amber' : 'red',
      iaText: r.deudaEbitda === null ? null : r.deudaEbitda < 3
        ? `Ratio sano. Tu deuda equivale a ${r.deudaEbitda.toFixed(1)} años de EBITDA.`
        : r.deudaEbitda < 5
        ? `Ratio en zona de vigilancia. Trabaja en reducir deuda o aumentar EBITDA.`
        : `Ratio elevado (${r.deudaEbitda.toFixed(1)}x). Riesgo financiero significativo.`,
    },
    {
      label: 'Deuda / Equity',
      value: r.deudaEquity,
      display: `${r.deudaEquity.toFixed(2)}x`,
      benchmark: '< 1x (saludable)',
      description: 'Apalancamiento financiero respecto al patrimonio',
      status: r.deudaEquity < 1 ? 'green' : r.deudaEquity < 2 ? 'amber' : 'red',
      iaText: r.deudaEquity < 1
        ? `Bajo apalancamiento. Empresa solvente.`
        : r.deudaEquity < 2
        ? `Apalancamiento moderado. Vigila la evolución.`
        : `Alto apalancamiento. Capacidad de endeudamiento comprometida.`,
    },
    {
      label: 'Cobertura de intereses',
      value: r.coberturaIntereses,
      display: r.coberturaIntereses !== null ? `${r.coberturaIntereses.toFixed(1)}x` : 'N/D',
      benchmark: '> 3x (recomendado)',
      description: 'Veces que el EBITDA cubre los intereses anuales',
      status: r.coberturaIntereses === null ? 'green' : r.coberturaIntereses > 3 ? 'green' : r.coberturaIntereses > 1.5 ? 'amber' : 'red',
      iaText: r.coberturaIntereses === null ? null : r.coberturaIntereses > 3
        ? `Excelente cobertura. Tu EBITDA cubre los intereses ${r.coberturaIntereses.toFixed(1)} veces.`
        : r.coberturaIntereses > 1.5
        ? `Cobertura ajustada. Cualquier caída de EBITDA podría generar tensión.`
        : `Cobertura insuficiente. Los intereses consumen demasiado EBITDA.`,
    },
    {
      label: 'Ratio de endeudamiento',
      value: r.leverage,
      display: `${r.leverage.toFixed(1)}%`,
      benchmark: '< 60% (recomendado)',
      description: 'Deuda sobre activos totales (deuda + equity)',
      status: r.leverage < 50 ? 'green' : r.leverage < 70 ? 'amber' : 'red',
      iaText: r.leverage < 50
        ? `Estructura financiera sólida. Bajo nivel de endeudamiento.`
        : r.leverage < 70
        ? `Endeudamiento moderado. Margen de maniobra reducido.`
        : `Endeudamiento elevado. Estructura financiera bajo presión.`,
    },
    {
      label: 'Servicio de la deuda',
      value: r.servicioDeuda,
      display: `${r.servicioDeuda.toFixed(1)}%`,
      benchmark: '< 30% sobre ingresos',
      description: 'Cuotas anuales sobre ingresos totales',
      status: r.servicioDeuda < 20 ? 'green' : r.servicioDeuda < 35 ? 'amber' : 'red',
      iaText: r.servicioDeuda < 20
        ? `Servicio de deuda saludable. Las cuotas son manejables respecto a ingresos.`
        : r.servicioDeuda < 35
        ? `Servicio de deuda moderado. Evita incrementar más la deuda.`
        : `Servicio de deuda elevado. Las cuotas suponen una carga importante sobre ingresos.`,
    },
    {
      label: 'Autonomía financiera',
      value: r.autonomiaFinanciera,
      display: `${r.autonomiaFinanciera.toFixed(1)}%`,
      benchmark: '> 40% (saludable)',
      description: 'Proporción de recursos propios sobre total',
      status: r.autonomiaFinanciera > 40 ? 'green' : r.autonomiaFinanciera > 20 ? 'amber' : 'red',
      iaText: r.autonomiaFinanciera > 40
        ? `Alta autonomía financiera. Empresa con buena base de recursos propios.`
        : r.autonomiaFinanciera > 20
        ? `Autonomía moderada. Dependencia elevada de financiación externa.`
        : `Baja autonomía. Alta dependencia de deuda externa. Riesgo solvencia.`,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
        <div className="text-sm text-slate-500">Datos base:</div>
        <div className="flex gap-4 flex-wrap text-xs">
          <span><span className="font-semibold text-foreground">{fmt(r.deudaTotal)}</span> deuda total</span>
          <span><span className="font-semibold text-foreground">{fmt(r.ebitda)}</span> EBITDA est.</span>
          <span><span className="font-semibold text-foreground">{fmt(r.ingresosTotal)}</span> ingresos</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {ratioCards.map((rc, i) => <RatioCard key={i} {...rc} />)}
      </div>
    </div>
  );
}
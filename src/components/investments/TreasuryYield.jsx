import { cn } from '@/lib/utils';
import { TrendingUp, Clock, Shield } from 'lucide-react';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

const OPCIONES = [
  { nombre: 'Cuenta remunerada (neobank)', rendimiento: 3.0, liquidez: 'Inmediata', riesgo: 'Muy bajo', plazo: 'Sin plazo', tipo: 'Cuenta corriente remunerada' },
  { nombre: 'Fondo monetario €', rendimiento: 3.6, liquidez: '1-3 días', riesgo: 'Muy bajo', plazo: 'Sin plazo fijo', tipo: 'Fondo de inversión' },
  { nombre: 'Depósito bancario 3M', rendimiento: 2.8, liquidez: 'Al vencimiento', riesgo: 'Bajo', plazo: '3 meses', tipo: 'Depósito a plazo' },
  { nombre: 'Depósito bancario 6M', rendimiento: 3.1, liquidez: 'Al vencimiento', riesgo: 'Bajo', plazo: '6 meses', tipo: 'Depósito a plazo' },
  { nombre: 'Letra del Tesoro 6M', rendimiento: 2.9, liquidez: 'Al vencimiento / mercado', riesgo: 'Muy bajo', plazo: '6 meses', tipo: 'Deuda pública' },
  { nombre: 'ETF mercado monetario', rendimiento: 3.5, liquidez: 'T+1 - T+2', riesgo: 'Bajo', plazo: 'Sin plazo', tipo: 'ETF' },
];

export default function TreasuryYield({ liquidez }) {
  const { exceso } = liquidez;

  return (
    <div className="space-y-5">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        <p className="text-xs text-indigo-700">
          <strong>Información estrictamente orientativa.</strong> Los rendimientos mostrados son estimaciones basadas en condiciones históricas y de mercado generales. No constituyen recomendación ni garantía. Consultad con asesor financiero regulado.
        </p>
      </div>

      {/* Oportunidad */}
      {exceso > 0 && (
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-xs text-emerald-200 uppercase tracking-wider mb-1">Potencial treasury orientativo</p>
          <p className="text-3xl font-jakarta font-bold">{fmt(exceso * 0.035)}<span className="text-base font-normal text-emerald-200">/año</span></p>
          <p className="text-xs text-emerald-200 mt-1">Estimación orientativa sobre {fmt(exceso)} de exceso potencial al ~3.5%</p>
          <p className="text-[10px] text-emerald-300 mt-2">⚠ Solo orientativo · No garantizado · Sujeto a condiciones de mercado</p>
        </div>
      )}

      {/* Opciones de treasury */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-foreground">Alternativas de treasury orientativas</p>
          <p className="text-xs text-slate-400 mt-0.5">Categorías de productos financieros de corto plazo · Solo informativo</p>
        </div>
        <div className="divide-y divide-slate-50">
          {OPCIONES.map((o, i) => {
            const rendAnual = exceso * (o.rendimiento / 100);
            return (
              <div key={i} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{o.nombre}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-slate-400">{o.tipo}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{o.liquidez}</span>
                    <span className="text-[10px] text-slate-400">Riesgo: {o.riesgo}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-emerald-600">~{o.rendimiento}%</p>
                  <p className="text-[10px] text-slate-400">~{fmt(rendAnual)}/año orient.</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
        <p className="text-[10px] text-slate-400">Módulo Treasury Yield en desarrollo. En futuras versiones conectará con tipos BCE, Euríbor y benchmarks bancarios en tiempo real.</p>
      </div>
    </div>
  );
}
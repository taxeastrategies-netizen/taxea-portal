import { useMemo } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { AlertTriangle, Bell, TrendingDown, CheckCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function DebtAlerts({ debts, kpis }) {
  const now = new Date();
  const active = debts.filter(d => d.estado === 'activo');

  const alerts = useMemo(() => {
    const list = [];

    // Vencimientos próximos
    active.forEach(d => {
      if (!d.fecha_vencimiento) return;
      const dias = differenceInDays(parseISO(d.fecha_vencimiento), now);
      if (dias < 0) {
        list.push({ level: 'danger', icon: '🔴', title: 'Instrumento vencido', msg: `"${d.nombre}" venció hace ${Math.abs(dias)} días. Requiere acción inmediata.`, category: 'vencimiento' });
      } else if (dias <= 30) {
        list.push({ level: 'danger', icon: '🚨', title: 'Vencimiento inminente', msg: `"${d.nombre}" vence en ${dias} días (${fmt(d.capital_pendiente || d.importe_inicial)}). Prepara la renovación o liquidación.`, category: 'vencimiento' });
      } else if (dias <= 90) {
        list.push({ level: 'warning', icon: '⚠️', title: 'Vencimiento próximo', msg: `"${d.nombre}" vence en ${dias} días. Revisa condiciones y negocia renovación con antelación.`, category: 'vencimiento' });
      }
    });

    // TIN alto
    const altoCoste = active.filter(d => (d.tin || 0) > 8);
    if (altoCoste.length > 0) {
      list.push({ level: 'warning', icon: '💰', title: 'Instrumentos con alto coste financiero', msg: `${altoCoste.length} instrumento(s) con TIN > 8%: ${altoCoste.map(d => d.nombre).join(', ')}. Considera refinanciar a mejores condiciones.`, category: 'coste' });
    }

    // Carga financiera EBITDA
    const costoPctEbitda = kpis.ebitda > 0 ? (kpis.interesesAnuales / kpis.ebitda) * 100 : 0;
    if (costoPctEbitda > 25) {
      list.push({ level: 'danger', icon: '📊', title: 'Carga financiera excesiva', msg: `Tu coste financiero anual (${fmt(kpis.interesesAnuales)}) supera el ${costoPctEbitda.toFixed(1)}% del EBITDA estimado. Nivel de riesgo alto.`, category: 'ratio' });
    } else if (costoPctEbitda > 15) {
      list.push({ level: 'warning', icon: '📊', title: 'Carga financiera elevada', msg: `Tu coste financiero representa el ${costoPctEbitda.toFixed(1)}% del EBITDA. Por encima del umbral recomendado del 15%.`, category: 'ratio' });
    }

    // Ratio deuda/EBITDA
    const deudaEbitda = kpis.ebitda > 0 ? kpis.deudaTotal / kpis.ebitda : null;
    if (deudaEbitda !== null && deudaEbitda > 5) {
      list.push({ level: 'danger', icon: '⚡', title: 'Ratio Deuda/EBITDA crítico', msg: `Tu ratio Deuda/EBITDA es de ${deudaEbitda.toFixed(2)}x, muy por encima del umbral de 3x recomendado. Prioriza reducción de deuda.`, category: 'ratio' });
    } else if (deudaEbitda !== null && deudaEbitda > 3) {
      list.push({ level: 'warning', icon: '⚡', title: 'Ratio Deuda/EBITDA elevado', msg: `Tu ratio Deuda/EBITDA es de ${deudaEbitda.toFixed(2)}x. Está por encima del umbral recomendado de 3x. Vigila el nivel de endeudamiento.`, category: 'ratio' });
    }

    // Líneas crédito alta utilización
    const lineas = active.filter(d => (d.tipo === 'linea_credito' || d.tipo === 'poliza') && d.limite_credito > 0);
    lineas.forEach(d => {
      const util = (d.dispuesto / d.limite_credito) * 100;
      if (util > 90) {
        list.push({ level: 'danger', icon: '💳', title: 'Línea de crédito al límite', msg: `"${d.nombre}": ${util.toFixed(0)}% utilizado. Capacidad de financiación urgente comprometida.`, category: 'liquidez' });
      } else if (util > 70) {
        list.push({ level: 'warning', icon: '💳', title: 'Línea de crédito con alta utilización', msg: `"${d.nombre}": ${util.toFixed(0)}% utilizado. Considera ampliar el límite o reducir la disposición.`, category: 'liquidez' });
      }
    });

    // Carencia terminando
    active.filter(d => d.en_carencia && d.fecha_fin_carencia).forEach(d => {
      const dias = differenceInDays(parseISO(d.fecha_fin_carencia), now);
      if (dias >= 0 && dias <= 60) {
        list.push({ level: 'warning', icon: '⏰', title: 'Carencia próxima a finalizar', msg: `El período de carencia de "${d.nombre}" termina en ${dias} días. A partir de entonces comenzarás a pagar capital.`, category: 'vencimiento' });
      }
    });

    // Cuota mensual alta
    const pctCuotaEbitda = kpis.ebitda > 0 ? ((kpis.cuotaMensual * 12) / kpis.ebitda) * 100 : 0;
    if (pctCuotaEbitda > 40) {
      list.push({ level: 'warning', icon: '📉', title: 'Servicio de deuda elevado', msg: `Las cuotas anuales de deuda representan el ${pctCuotaEbitda.toFixed(1)}% del EBITDA. Considera renegociar plazos.`, category: 'ratio' });
    }

    // Sin deuda (positivo)
    if (active.length === 0) {
      list.push({ level: 'success', icon: '✅', title: 'Sin deuda financiera activa', msg: 'Tu empresa no tiene instrumentos de deuda activos. Posición financiera muy sólida.', category: 'info' });
    }

    return list;
  }, [active, kpis]);

  const byLevel = {
    danger: alerts.filter(a => a.level === 'danger'),
    warning: alerts.filter(a => a.level === 'warning'),
    success: alerts.filter(a => a.level === 'success'),
  };

  const LEVEL_CFG = {
    danger: { bg: 'bg-red-50', border: 'border-red-200', title: 'text-red-700', text: 'text-red-600', icon: AlertTriangle, iconColor: 'text-red-500' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', title: 'text-amber-700', text: 'text-amber-600', icon: AlertTriangle, iconColor: 'text-amber-500' },
    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-700', text: 'text-emerald-600', icon: CheckCircle, iconColor: 'text-emerald-500' },
  };

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Alertas críticas', count: byLevel.danger.length, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
          { label: 'Alertas aviso', count: byLevel.warning.length, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Estado positivo', count: byLevel.success.length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        ].map((c, i) => (
          <div key={i} className={cn("bg-white border rounded-2xl p-4 shadow-sm text-center", c.border)}>
            <p className={cn("text-2xl font-jakarta font-bold", c.color)}>{c.count}</p>
            <p className="text-[10px] text-slate-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {alerts.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-emerald-700">Sin alertas de deuda</p>
          <p className="text-xs text-emerald-600 mt-1">Tu estructura financiera no presenta alertas en este momento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a, i) => {
            const cfg = LEVEL_CFG[a.level];
            const Icon = cfg.icon;
            return (
              <div key={i} className={cn("flex items-start gap-3 p-4 rounded-2xl border", cfg.bg, cfg.border)}>
                <span className="text-lg flex-shrink-0 leading-none">{a.icon}</span>
                <div className="flex-1">
                  <p className={cn("text-xs font-semibold mb-0.5", cfg.title)}>{a.title}</p>
                  <p className={cn("text-xs", cfg.text)}>{a.msg}</p>
                </div>
                <span className={cn("text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full border flex-shrink-0", cfg.border, cfg.title, cfg.bg)}>
                  {a.category}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
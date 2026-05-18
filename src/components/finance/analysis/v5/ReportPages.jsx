/**
 * ReportPages V5 — Todas las páginas del informe como componentes A4
 * Cada página: título + conclusión ejecutiva + datos + visualización + interpretación + recomendación
 */
import { cn } from '@/lib/utils';
import { fmtEUR, fmtPct, fmtX, SOURCE } from './ReportEngine';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Info, Clock } from 'lucide-react';

const TAXEA_LOGO = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';

// ── Helpers UI ─────────────────────────────────────────────────────────────────
export function A4Page({ id, children, className }) {
  return (
    <div id={id}
      className={cn('bg-white rounded-2xl border border-slate-200 shadow-sm p-8 mb-6 print:shadow-none print:border-0 print:rounded-none print:mb-0 print:page-break-after-always', className)}
      style={{ minHeight: '297mm', maxWidth: '210mm', margin: '0 auto 24px' }}>
      {children}
    </div>
  );
}

export function PageHeader({ n, title, empresa, ejercicio }) {
  return (
    <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-100">
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1">Taxea Strategies · Informe Financiero Premium V5</p>
        <h2 className="text-lg font-jakarta font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{empresa} · Ejercicio {ejercicio}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">{n}</span>
      </div>
    </div>
  );
}

export function Sem({ estado, size = 'md' }) {
  const cfg = {
    verde: 'bg-emerald-500',
    ambar: 'bg-amber-400',
    rojo: 'bg-red-500',
    gris: 'bg-slate-300',
  };
  const s = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' };
  return <span className={cn('rounded-full inline-block flex-shrink-0', cfg[estado] || cfg.gris, s[size])} />;
}

export function SemCard({ label, estado, desc }) {
  const bg = { verde: 'bg-emerald-50 border-emerald-200', ambar: 'bg-amber-50 border-amber-200', rojo: 'bg-red-50 border-red-200', gris: 'bg-slate-50 border-slate-200' };
  const tc = { verde: 'text-emerald-700', ambar: 'text-amber-700', rojo: 'text-red-700', gris: 'text-slate-600' };
  const lbl = { verde: 'FAVORABLE', ambar: 'REVISAR', rojo: 'ALERTA', gris: 'SIN DATOS' };
  return (
    <div className={cn('border rounded-xl p-3', bg[estado] || bg.gris)}>
      <div className="flex items-center gap-1.5 mb-1">
        <Sem estado={estado} />
        <p className="text-[10px] font-bold text-slate-800">{label}</p>
        <span className={cn('ml-auto text-[9px] font-bold', tc[estado] || tc.gris)}>{lbl[estado] || '—'}</span>
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

export function KpiMini({ label, value, color, badge }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
      <p className={cn('text-base font-jakarta font-bold', color || 'text-slate-800')}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
      {badge && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
    </div>
  );
}

export function DataRow({ label, value, color, indent, note }) {
  return (
    <div className={cn('flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0', indent && 'pl-4')}>
      <div>
        <p className={cn('text-xs', indent ? 'text-slate-500' : 'font-medium text-slate-700')}>{label}</p>
        {note && <p className="text-[9px] text-slate-400">{note}</p>}
      </div>
      <p className={cn('text-xs font-bold', color || 'text-slate-800')}>{value}</p>
    </div>
  );
}

export function LimitNote({ children }) {
  return (
    <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 mt-3">
      <Info className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
      <p className="text-[10px] text-blue-700 leading-relaxed">{children}</p>
    </div>
  );
}

export function RatioCard({ nombre, formula, valor, semColor, refValue, interpretacion, limitacion }) {
  const bg = { verde: 'border-emerald-200 bg-emerald-50', ambar: 'border-amber-200 bg-amber-50', rojo: 'border-red-200 bg-red-50', gris: 'border-slate-200 bg-slate-50' };
  const vc = { verde: 'text-emerald-700', ambar: 'text-amber-700', rojo: 'text-red-700', gris: 'text-slate-500' };
  return (
    <div className={cn('border rounded-xl p-4', bg[semColor] || bg.gris)}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-bold text-slate-800">{nombre}</p>
        <Sem estado={semColor} />
      </div>
      <p className={cn('text-xl font-jakarta font-bold', vc[semColor] || vc.gris)}>{valor || '—'}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{formula}</p>
      {refValue && <p className="text-[9px] text-slate-400">Ref: {refValue}</p>}
      {interpretacion && <p className="text-[10px] text-slate-600 mt-1.5 leading-relaxed">{interpretacion}</p>}
      {limitacion && <p className="text-[9px] text-amber-600 mt-1 italic">{limitacion}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 1 — PORTADA
// ══════════════════════════════════════════════════════════════════════════════
export function PagePortada({ calc, imp, today }) {
  return (
    <A4Page id="page-portada">
      <div className="flex flex-col justify-between h-full" style={{ minHeight: '600px' }}>
        {/* Logo */}
        <div className="flex justify-between items-start">
          <img src={TAXEA_LOGO} alt="Taxea Strategies" className="h-14 object-contain" />
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Análisis Financiero Premium V5</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Confidencial</p>
          </div>
        </div>

        {/* Título */}
        <div className="flex-1 flex flex-col justify-center py-12">
          <div className="border-l-4 border-slate-900 pl-5 mb-8">
            <p className="text-3xl font-jakarta font-bold text-slate-900 leading-tight">Informe Financiero<br/>Premium</p>
            <p className="text-slate-500 text-base mt-1">Análisis Integral de Estados Financieros</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <table className="w-full text-xs">
              <tbody>
                {[
                  ['Sociedad analizada', calc.empresa],
                  ['Período analizado', `${imp?.periodo_inicio || '—'} — ${imp?.periodo_fin || '—'}`],
                  ['Fuente documental', `${imp?.origen || '—'} · ${imp?.nombre_archivo || '—'}`],
                  ['Fecha de generación', today],
                  ['Nivel de revisión', 'Preliminar — pendiente validación contable definitiva'],
                  ['Confianza extracción IA', calc.confianza ? `${calc.confianza}%` : 'N/D'],
                  ['Motor análisis', 'Taxea IA V5 · Corporate Finance Grade'],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-4 text-slate-500 font-medium w-44">{k}</td>
                    <td className="py-1.5 text-slate-800 font-semibold">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Aviso */}
        <div className="bg-slate-900 rounded-xl px-4 py-3">
          <p className="text-[10px] text-slate-300 leading-relaxed">
            <strong className="text-white">Aviso de alcance:</strong> Informe elaborado por Taxea Strategies con base en la documentación facilitada. Carácter preliminar. No constituye auditoría, certificación contable ni asesoramiento jurídico definitivo. Las conclusiones deben contrastarse con documentación soporte, modelos fiscales y libros contables.
          </p>
        </div>
        <div className="text-center mt-3">
          <p className="text-[9px] text-slate-300">© {new Date().getFullYear()} Taxea Strategies · Todos los derechos reservados</p>
        </div>
      </div>
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 2 — RESUMEN EJECUTIVO + SEMÁFORO
// ══════════════════════════════════════════════════════════════════════════════
export function PageResumen({ calc, aiContent }) {
  const { empresa, ejercicio } = calc;
  const semaforos = [
    { label: 'Liquidez', estado: calc.ratioLiquidez === null ? 'gris' : calc.ratioLiquidez >= 1.2 ? 'verde' : calc.ratioLiquidez >= 1 ? 'ambar' : 'rojo', desc: calc.ratioLiquidez !== null ? `Ratio corriente: ${fmtX(calc.ratioLiquidez)}. Fondo de maniobra: ${fmtEUR(calc.fondoManiobra)}.` : 'No calculable: falta balance completo.' },
    { label: 'Solvencia', estado: calc.autonomia === null ? 'gris' : calc.autonomia >= 0.35 ? 'verde' : calc.autonomia >= 0.2 ? 'ambar' : 'rojo', desc: calc.autonomia !== null ? `Autonomía financiera: ${fmtPct(calc.autonomia * 100)}. Endeudamiento: ${fmtX(calc.endeudamiento)}.` : 'No calculable: falta balance.' },
    { label: 'Rentabilidad', estado: !calc.hasPyG ? 'gris' : calc.resultado > 0 ? 'verde' : 'rojo', desc: calc.hasPyG ? `Resultado: ${fmtEUR(calc.resultado)}. Margen neto: ${fmtPct((calc.margenNeto || 0) * 100)}.` : 'No calculable: falta PyG.' },
    { label: 'Cashflow', estado: !calc.hasPyG ? 'gris' : calc.cashflowContable > 0 ? 'verde' : 'rojo', desc: calc.hasPyG ? `Cashflow contable estimado: ${fmtEUR(calc.cashflowContable)}.` : 'No calculable con seguridad sin PyG.' },
    { label: 'Fiscalidad', estado: 'ambar', desc: 'Análisis fiscal preliminar. Contrastar con modelos tributarios para conclusión definitiva.' },
    { label: 'Calidad contable', estado: calc.calidadScore >= 80 ? 'verde' : calc.calidadScore >= 60 ? 'ambar' : 'rojo', desc: `Calificación: ${calc.calidadLabel}. Puntuación: ${calc.calidadScore}/100.` },
    { label: 'Riesgo mercantil', estado: calc.patrimonioNeto < 0 ? 'rojo' : calc.patrimonioNeto < calc.totalActivo * 0.1 ? 'ambar' : 'verde', desc: calc.patrimonioNeto < 0 ? 'Patrimonio neto negativo. Posible causa de disolución.' : `Patrimonio neto: ${fmtEUR(calc.patrimonioNeto)} (${fmtPct((calc.autonomia || 0) * 100)} del activo).` },
    { label: 'M&A', estado: !calc.hasPyG ? 'gris' : calc.deudaNetaEbitda === null ? 'ambar' : calc.deudaNetaEbitda < 3 ? 'verde' : calc.deudaNetaEbitda < 5 ? 'ambar' : 'rojo', desc: calc.hasPyG ? `EBITDA: ${fmtEUR(calc.ebitda)}. DFN/EBITDA: ${calc.deudaNetaEbitda !== null ? fmtX(calc.deudaNetaEbitda) : 'N/D'}.` : 'Sin PyG, lectura M&A limitada.' },
  ];

  return (
    <A4Page id="page-resumen">
      <PageHeader n="02" title="Resumen ejecutivo" empresa={empresa} ejercicio={ejercicio} />

      {/* KPIs fotográficos */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiMini label="Total Activo" value={fmtEUR(calc.totalActivo)} color="text-blue-700" />
        <KpiMini label="Patrimonio Neto" value={fmtEUR(calc.patrimonioNeto)} color={calc.patrimonioNeto >= 0 ? 'text-emerald-700' : 'text-red-600'} />
        <KpiMini label="Fondo de maniobra" value={fmtEUR(calc.fondoManiobra)} color={calc.fondoManiobra >= 0 ? 'text-emerald-700' : 'text-red-600'} />
        <KpiMini label="Ingresos" value={calc.hasPyG ? fmtEUR(calc.ingresos) : '—'} color="text-emerald-700" badge={!calc.hasPyG ? 'Sin PyG' : null} />
        <KpiMini label="Resultado" value={calc.hasPyG ? fmtEUR(calc.resultado) : '—'} color={calc.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'} />
        <KpiMini label="EBITDA" value={calc.hasPyG ? fmtEUR(calc.ebitda) : '—'} color="text-blue-600" />
        <KpiMini label="Tesorería" value={fmtEUR(calc.tesoreria)} color="text-slate-700" />
        <KpiMini label="Deuda Financiera Neta" value={fmtEUR(calc.deudaFinancieraNeta)} color={calc.deudaFinancieraNeta <= 0 ? 'text-emerald-600' : 'text-amber-600'} />
        <KpiMini label="Runway estimado" value={calc.runwayBruto !== null ? `${calc.runwayBruto.toFixed(1)} meses` : '—'} color={calc.runwayBruto !== null && calc.runwayBruto < 6 ? 'text-red-600' : 'text-slate-700'} badge={calc.runwaySource === 'supuesto_usuario' ? 'Supuesto' : null} />
      </div>

      {/* Diagnóstico */}
      {aiContent?.diagnostico_ejecutivo && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Diagnóstico ejecutivo</p>
          <p className="text-xs text-slate-700 leading-relaxed">{aiContent.diagnostico_ejecutivo}</p>
        </div>
      )}

      {/* Semáforo 8 áreas */}
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Semáforo financiero Taxea Strategies — 8 áreas</p>
      <div className="grid grid-cols-2 gap-2">
        {semaforos.map((s, i) => <SemCard key={i} {...s} />)}
      </div>
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 3 — ALCANCE Y LIMITACIONES
// ══════════════════════════════════════════════════════════════════════════════
export function PageAlcance({ calc, imp }) {
  const fuentes = [
    { label: 'Balance de situación', disponible: calc.hasBalance },
    { label: 'Cuenta de PyG', disponible: calc.hasPyG },
    { label: 'Balance comparativo anterior', disponible: false },
    { label: 'Libro diario / mayor', disponible: false },
    { label: 'Modelos fiscales (303, 200...)', disponible: false },
    { label: 'Extractos bancarios', disponible: false },
  ];
  return (
    <A4Page id="page-alcance">
      <PageHeader n="03" title="Alcance, fuentes y limitaciones" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-800 mb-1">Principio fundamental</p>
          <p className="text-xs text-amber-700 leading-relaxed">Este informe se construye exclusivamente sobre datos extraídos del documento aportado. No se inventan cifras. Si un dato no existe o no es calculable con seguridad, se indica expresamente. Las estimaciones y escenarios se presentan como tales, nunca como hechos.</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-700 mb-2">Documentación aportada y estado</p>
          <div className="space-y-1.5">
            {fuentes.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {f.disponible
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                <span className={f.disponible ? 'text-slate-700' : 'text-slate-400'}>{f.label}</span>
                <span className={cn('ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded', f.disponible ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400')}>
                  {f.disponible ? 'Disponible' : 'No aportado'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-700 mb-2">Limitaciones del análisis</p>
          <ul className="space-y-1">
            {[
              !calc.hasPyG && 'Sin PyG: ratios de rentabilidad, cashflow y burn rate no son calculables con certeza.',
              !calc.hasBalance && 'Sin balance: ningún ratio de liquidez, endeudamiento o solvencia es calculable.',
              calc.descuadre && `Balance con descuadre detectado de ${fmtEUR(calc.diferencia)}: todos los ratios derivados deben tomarse con cautela.`,
              'Sin balance comparativo: no es posible calcular variaciones de working capital ni cashflow indirecto.',
              'Sin modelos fiscales: el análisis fiscal tiene carácter exclusivamente preliminar.',
              'Sin extractos bancarios: la posición de tesorería no ha sido conciliada con movimientos reales.',
            ].filter(Boolean).map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <Info className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />{l}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 4 — BALANCE
// ══════════════════════════════════════════════════════════════════════════════
export function PageBalance({ calc, aiContent }) {
  if (!calc.hasBalance) return (
    <A4Page id="page-balance">
      <PageHeader n="04" title="Balance de situación" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <LimitNote>Balance no disponible en la documentación aportada. Para este bloque se requiere balance de situación o balance de sumas y saldos.</LimitNote>
    </A4Page>
  );

  const chartData = [
    { name: 'Activo NC', value: calc.activoNoCorriente, fill: '#1d4ed8' },
    { name: 'Activo C', value: calc.activoCorriente, fill: '#3b82f6' },
    { name: 'PN', value: Math.max(0, calc.patrimonioNeto), fill: '#059669' },
    { name: 'Pasivo NC', value: calc.pasivoNoCorriente, fill: '#d97706' },
    { name: 'Pasivo C', value: calc.pasivoCorriente, fill: '#f59e0b' },
  ].filter(d => d.value > 0);

  return (
    <A4Page id="page-balance">
      <PageHeader n="04" title="Balance de situación reconstruido" empresa={calc.empresa} ejercicio={calc.ejercicio} />

      {!calc.balanceCuadra && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-700 font-semibold">Descuadre detectado: diferencia de {fmtEUR(calc.diferencia)} entre activo y PN+Pasivo. Revisar antes de validar.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 mb-5">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Estructura patrimonial</p>
          <DataRow label="Total Activo" value={fmtEUR(calc.totalActivo)} color="text-blue-700" note={`${fmtEUR(calc.activoNoCorriente)} NC + ${fmtEUR(calc.activoCorriente)} C`} />
          <DataRow label="Activo No Corriente" value={fmtEUR(calc.activoNoCorriente)} indent />
          <DataRow label="Activo Corriente" value={fmtEUR(calc.activoCorriente)} indent />
          <div className="my-2 border-t border-slate-100" />
          <DataRow label="Total PN + Pasivo" value={fmtEUR(calc.patrimonioNeto + calc.totalPasivo)} color={calc.balanceCuadra ? 'text-emerald-700' : 'text-red-600'} />
          <DataRow label="Patrimonio Neto" value={fmtEUR(calc.patrimonioNeto)} color={calc.patrimonioNeto >= 0 ? 'text-emerald-700' : 'text-red-600'} indent />
          <DataRow label="Pasivo No Corriente" value={fmtEUR(calc.pasivoNoCorriente)} indent />
          <DataRow label="Pasivo Corriente" value={fmtEUR(calc.pasivoCorriente)} indent />
          <div className="my-2 border-t border-slate-100" />
          <DataRow label="Fondo de Maniobra" value={fmtEUR(calc.fondoManiobra)} color={calc.fondoManiobra >= 0 ? 'text-emerald-600' : 'text-red-600'} note="Activo C − Pasivo C" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Distribución</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={55} />
              <Tooltip formatter={v => fmtEUR(v)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Narrativa automática del balance */}
      {(() => {
        const { totalActivo, patrimonioNeto, activoCorriente, activoNoCorriente, pasivoCorriente, pasivoNoCorriente, fondoManiobra, autonomia } = calc;
        const partes = [];
        if (totalActivo > 0) {
          const pctNC = totalActivo > 0 ? activoNoCorriente / totalActivo * 100 : 0;
          partes.push(`La estructura del activo muestra un ${fmtPct(pctNC)} de activos no corrientes y un ${fmtPct(100 - pctNC)} de activos corrientes sobre el total de ${fmtEUR(totalActivo)}.`);
        }
        if (patrimonioNeto > 0 && autonomia !== null) partes.push(`El patrimonio neto (${fmtEUR(patrimonioNeto)}) financia el ${fmtPct(autonomia * 100)} del activo, indicando ${autonomia >= 0.4 ? 'una estructura patrimonial sólida' : autonomia >= 0.25 ? 'una dependencia moderada de recursos ajenos' : 'una alta dependencia de recursos ajenos'}.`);
        if (patrimonioNeto < 0) partes.push(`El patrimonio neto es negativo (${fmtEUR(patrimonioNeto)}): situación que podría constituir causa de disolución legal según el artículo 363 LSC.`);
        if (fondoManiobra !== 0) partes.push(`El fondo de maniobra es ${fondoManiobra >= 0 ? 'positivo' : 'negativo'} (${fmtEUR(fondoManiobra)}), ${fondoManiobra >= 0 ? 'lo que indica equilibrio financiero en el corto plazo' : 'lo que puede generar tensiones de liquidez a corto plazo'}.`);
        return partes.length > 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mt-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Interpretación del balance</p>
            <p className="text-xs text-slate-700 leading-relaxed">{partes.join(' ')}</p>
          </div>
        ) : null;
      })()}

      {aiContent?.analisis_balance && (
        <div className="space-y-2 mt-3">
          <p className="text-[10px] font-bold text-violet-500 uppercase">Análisis IA</p>
          {Object.entries({
            'Activo no corriente': aiContent.analisis_balance.activo_no_corriente,
            'Activo corriente': aiContent.analisis_balance.activo_corriente,
            'Patrimonio neto': aiContent.analisis_balance.patrimonio_neto,
            'Pasivo no corriente': aiContent.analisis_balance.pasivo_no_corriente,
            'Pasivo corriente': aiContent.analisis_balance.pasivo_corriente,
          }).map(([k, v]) => v && (
            <div key={k}><p className="text-[10px] font-bold text-slate-600">{k}</p><p className="text-xs text-slate-600 leading-relaxed mb-1">{v}</p></div>
          ))}
        </div>
      )}
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 5 — PyG
// ══════════════════════════════════════════════════════════════════════════════
export function PagePyG({ calc, aiContent }) {
  if (!calc.hasPyG) return (
    <A4Page id="page-pyg">
      <PageHeader n="05" title="Cuenta de pérdidas y ganancias" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <LimitNote>Cuenta de PyG no disponible en la documentación aportada. Para este bloque se requiere la cuenta de pérdidas y ganancias del ejercicio. Los ratios de rentabilidad, cashflow y burn rate no son calculables con seguridad.</LimitNote>
    </A4Page>
  );

  const pygData = [
    { name: 'Ingresos', value: calc.ingresos, fill: '#059669' },
    { name: 'Personal', value: calc.personalGasto, fill: '#f59e0b' },
    { name: 'Servicios', value: calc.serviciosGasto, fill: '#8b5cf6' },
    { name: 'G.Financiero', value: calc.gastoFinanciero, fill: '#ef4444' },
    { name: 'Amortiz.', value: calc.amortizacion, fill: '#64748b' },
  ].filter(d => d.value > 0);

  return (
    <A4Page id="page-pyg">
      <PageHeader n="05" title="Cuenta de pérdidas y ganancias" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div>
          <DataRow label="Ingresos — Cifra de negocios" value={fmtEUR(calc.ingresos)} color="text-emerald-700" />
          <DataRow label="Gastos de explotación" value={fmtEUR(calc.gastos)} />
          <DataRow label="  — Personal (64x)" value={fmtEUR(calc.personalGasto)} indent note={calc.ingresos > 0 ? `${fmtPct(calc.personalGasto/calc.ingresos*100)} s/ingresos` : ''} />
          <DataRow label="  — Servicios exteriores (62x)" value={fmtEUR(calc.serviciosGasto)} indent note={calc.ingresos > 0 ? `${fmtPct(calc.serviciosGasto/calc.ingresos*100)} s/ingresos` : ''} />
          <DataRow label="  — Gasto financiero (66x)" value={fmtEUR(calc.gastoFinanciero)} indent />
          <DataRow label="  — Amortizaciones (68x)" value={fmtEUR(calc.amortizacion)} indent />
          <div className="my-2 border-t border-slate-100" />
          <DataRow label="Resultado estimado" value={fmtEUR(calc.resultado)} color={calc.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'} />
          <DataRow label="EBITDA estimado" value={fmtEUR(calc.ebitda)} color="text-blue-700" note="Resultado + Amortizaciones" />
          <DataRow label="Margen neto" value={fmtPct((calc.margenNeto || 0) * 100)} color={calc.resultado >= 0 ? 'text-blue-600' : 'text-red-600'} />
          <DataRow label="Margen EBITDA" value={fmtPct((calc.margenEBITDA || 0) * 100)} />
        </div>
        <div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pygData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={65} />
              <Tooltip formatter={v => fmtEUR(v)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {pygData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Narrativa automática PyG */}
      {(() => {
        const { ingresos, gastos, resultado, ebitda, amortizacion, personalGasto, serviciosGasto, margenNeto } = calc;
        const partes = [];
        if (ingresos > 0) partes.push(`Los ingresos del ejercicio ascienden a ${fmtEUR(ingresos)}.`);
        if (gastos > 0 && ingresos > 0) partes.push(`La carga de gastos totales es de ${fmtEUR(gastos)}, representando el ${fmtPct(gastos / ingresos * 100)} de los ingresos.`);
        if (personalGasto > 0 && ingresos > 0) partes.push(`Los gastos de personal (${fmtEUR(personalGasto)}) suponen el ${fmtPct(personalGasto / ingresos * 100)} de la cifra de negocio.`);
        if (resultado !== 0) partes.push(`El resultado del ejercicio es ${resultado > 0 ? 'positivo' : 'negativo'} por ${fmtEUR(Math.abs(resultado))} (margen neto: ${fmtPct((margenNeto || 0) * 100)}).`);
        if (ebitda !== 0) partes.push(`El EBITDA (resultado + amortizaciones de ${fmtEUR(amortizacion)}) se sitúa en ${fmtEUR(ebitda)}, que es la medida de generación de caja operativa más utilizada en valoración y análisis de deuda.`);
        return partes.length > 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mt-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Interpretación de la PyG</p>
            <p className="text-xs text-slate-700 leading-relaxed">{partes.join(' ')}</p>
          </div>
        ) : null;
      })()}

      {aiContent?.analisis_pyg && (
        <div className="space-y-1.5 mt-3">
          <p className="text-[10px] font-bold text-violet-500 uppercase">Análisis IA</p>
          {Object.entries({ Ingresos: aiContent.analisis_pyg.ingresos, Gastos: aiContent.analisis_pyg.gastos, Resultado: aiContent.analisis_pyg.resultado }).map(([k, v]) => v && (
            <div key={k}><p className="text-[10px] font-bold text-slate-600">{k}</p><p className="text-xs text-slate-600 leading-relaxed">{v}</p></div>
          ))}
        </div>
      )}
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 6 — LIQUIDEZ & TESORERÍA
// ══════════════════════════════════════════════════════════════════════════════
function narrativaLiquidez(calc) {
  const { ratioLiquidez, fondoManiobra, tesoreria, pruebaAcida, clientes, proveedores } = calc;
  const partes = [];
  if (ratioLiquidez !== null) {
    if (ratioLiquidez >= 1.5) partes.push(`La empresa presenta una posición de liquidez corriente sólida (${fmtX(ratioLiquidez)}), con activos corrientes que cubren holgadamente las obligaciones a corto plazo. Este nivel es considerado óptimo y refleja una gestión saludable del circulante.`);
    else if (ratioLiquidez >= 1) partes.push(`El ratio de liquidez corriente (${fmtX(ratioLiquidez)}) es positivo pero ajustado: los activos corrientes cubren el pasivo corriente con escaso margen. Cualquier deterioro en el cobro de clientes o aceleración de pagos podría generar tensiones de tesorería.`);
    else partes.push(`El ratio de liquidez corriente (${fmtX(ratioLiquidez)}) es inferior a 1, lo que indica que el pasivo corriente supera al activo corriente. Esta situación requiere atención prioritaria: la empresa no dispone de activos líquidos suficientes para cubrir sus compromisos inmediatos con garantía.`);
  }
  if (fondoManiobra !== 0) {
    if (fondoManiobra >= 0) partes.push(`El fondo de maniobra es positivo (${fmtEUR(fondoManiobra)}), lo que indica que los activos corrientes financian en parte el capital de trabajo de forma estructural.`);
    else partes.push(`El fondo de maniobra negativo (${fmtEUR(fondoManiobra)}) señala una financiación del activo fijo con recursos a corto plazo, lo que aumenta el riesgo financiero y limita la flexibilidad operativa.`);
  }
  if (tesoreria > 0) partes.push(`La posición de tesorería disponible asciende a ${fmtEUR(tesoreria)} (cuentas 57x).`);
  if (clientes > 0 && proveedores > 0) partes.push(`Los saldos de clientes (${fmtEUR(clientes)}) frente a proveedores (${fmtEUR(proveedores)}) determinan la posición neta del circulante comercial.`);
  if (pruebaAcida !== null && pruebaAcida < ratioLiquidez * 0.7) partes.push(`La prueba ácida (${fmtX(pruebaAcida)}) muestra una diferencia significativa respecto al ratio corriente, indicando un peso relevante de existencias en el activo corriente.`);
  return partes.join(' ');
}

export function PageLiquidez({ calc }) {
  const { ratioLiquidez, pruebaAcida, liquidezInmediata, fondoManiobra, tesoreria, hasBalance } = calc;
  if (!hasBalance) return (
    <A4Page id="page-liquidez">
      <PageHeader n="06" title="Liquidez, tesorería y runway" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <LimitNote>No calculable: falta balance de situación.</LimitNote>
    </A4Page>
  );

  const s1 = ratioLiquidez === null ? 'gris' : ratioLiquidez >= 1.5 ? 'verde' : ratioLiquidez >= 1 ? 'ambar' : 'rojo';
  const s2 = pruebaAcida === null ? 'gris' : pruebaAcida >= 1 ? 'verde' : pruebaAcida >= 0.7 ? 'ambar' : 'rojo';
  const s3 = liquidezInmediata === null ? 'gris' : liquidezInmediata >= 0.3 ? 'verde' : liquidezInmediata >= 0.15 ? 'ambar' : 'rojo';
  const narrativa = narrativaLiquidez(calc);

  return (
    <A4Page id="page-liquidez">
      <PageHeader n="06" title="Liquidez, tesorería y runway" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <div className="grid grid-cols-3 gap-3 mb-5">
        <RatioCard nombre="Liquidez corriente" formula="Activo C / Pasivo C" valor={fmtX(ratioLiquidez)} semColor={s1} refValue="≥ 1,5" interpretacion={ratioLiquidez >= 1.5 ? 'Nivel óptimo. Activo corriente cubre ampliamente el pasivo corriente.' : ratioLiquidez >= 1 ? 'Nivel ajustado. Cubre el pasivo corriente pero con margen reducido.' : 'Nivel crítico. El pasivo corriente supera el activo corriente.'} />
        <RatioCard nombre="Prueba ácida" formula="(Activo C − Exist.) / Pasivo C" valor={fmtX(pruebaAcida)} semColor={s2} refValue="≥ 1,0" interpretacion={pruebaAcida >= 1 ? 'Posición solvente excluyendo existencias.' : pruebaAcida >= 0.7 ? 'Cobertura ajustada sin existencias. Monitorizar.' : 'Insuficiente sin existencias. Riesgo de liquidez.'} />
        <RatioCard nombre="Liquidez inmediata" formula="Tesorería / Pasivo C" valor={fmtX(liquidezInmediata)} semColor={s3} refValue="≥ 0,2" interpretacion={liquidezInmediata >= 0.3 ? 'Caja suficiente para cobertura inmediata de obligaciones.' : liquidezInmediata >= 0.15 ? 'Cobertura de caja ajustada. Vigilar vencimientos.' : 'Caja insuficiente para cobertura inmediata del pasivo corriente.'} />
      </div>

      {narrativa && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Diagnóstico de liquidez</p>
          <p className="text-xs text-slate-700 leading-relaxed">{narrativa}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Posición de tesorería</p>
          <DataRow label="Tesorería disponible (57x)" value={fmtEUR(tesoreria)} color="text-slate-800" />
          <DataRow label="Fondo de maniobra" value={fmtEUR(fondoManiobra)} color={fondoManiobra >= 0 ? 'text-emerald-600' : 'text-red-600'} />
          <DataRow label="Clientes pendientes" value={fmtEUR(calc.clientes)} />
          <DataRow label="Proveedores pendientes" value={fmtEUR(calc.proveedores)} />
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Runway & burn rate</p>
          {calc.burnRateBruto ? (
            <>
              <DataRow label="Burn rate bruto/mes" value={fmtEUR(calc.burnRateBruto)} note={calc.runwaySource === SOURCE.SUPUESTO ? '⚠ Supuesto usuario' : 'Calculado de PyG'} />
              <DataRow label="Runway escenario base" value={calc.runwayBruto ? `${calc.runwayBruto.toFixed(1)} meses` : '—'} color={calc.runwayBruto && calc.runwayBruto < 6 ? 'text-red-600' : 'text-emerald-600'} />
              <DataRow label="Runway tensión (+20%)" value={calc.runwayEscenarioTension ? `${calc.runwayEscenarioTension.toFixed(1)} meses` : '—'} />
              <DataRow label="Runway estrés (+50%)" value={calc.runwayEscenarioEstres ? `${calc.runwayEscenarioEstres.toFixed(1)} meses` : '—'} />
            </>
          ) : (
            <LimitNote>Burn rate no calculable: aportar gastos mensuales en supuestos editables o adjuntar PyG.</LimitNote>
          )}
        </div>
      </div>

      {calc.runwaySource === SOURCE.SUPUESTO && (
        <LimitNote>El burn rate y runway mostrados son escenarios basados en supuestos introducidos por el usuario, no datos contables extraídos del documento.</LimitNote>
      )}
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 7 — ENDEUDAMIENTO & SOLVENCIA
// ══════════════════════════════════════════════════════════════════════════════
function narrativaEndeudamiento(calc) {
  const { autonomia, endeudamiento, solvencia, deudaFinancieraTotal, deudaFinancieraNeta, deudaNetaEbitda, coberturaIntereses, patrimonioNeto, totalActivo } = calc;
  const partes = [];
  if (autonomia !== null) {
    if (autonomia >= 0.5) partes.push(`La empresa presenta una sólida autonomía financiera del ${fmtPct(autonomia * 100)}: más de la mitad del activo está financiado con recursos propios, lo que otorga estabilidad y capacidad de maniobra ante dificultades.`);
    else if (autonomia >= 0.35) partes.push(`La autonomía financiera (${fmtPct(autonomia * 100)}) se sitúa en niveles razonables. Los recursos propios financian una parte significativa del activo, aunque la dependencia de financiación ajena es considerable.`);
    else if (autonomia >= 0.2) partes.push(`La autonomía financiera es baja (${fmtPct(autonomia * 100)}): la empresa depende mayoritariamente de financiación ajena para sostener su estructura de activos. Esto eleva el riesgo financiero y limita la capacidad de endeudamiento adicional.`);
    else partes.push(`La autonomía financiera es muy reducida (${fmtPct(autonomia * 100)}). La casi totalidad del activo está financiada con recursos ajenos, lo que implica una alta dependencia de acreedores y una vulnerabilidad estructural significativa.`);
  }
  if (endeudamiento !== null) {
    partes.push(`El ratio de endeudamiento (Pasivo/PN) es de ${fmtX(endeudamiento)}, ${endeudamiento < 1.5 ? 'dentro de parámetros conservadores' : endeudamiento < 2.5 ? 'en niveles moderados' : 'en niveles elevados que deben monitorizarse'}.`);
  }
  if (deudaFinancieraTotal > 0 && deudaNetaEbitda !== null) {
    partes.push(`La deuda financiera neta (DFN) equivale a ${fmtX(deudaNetaEbitda)} el EBITDA. ${deudaNetaEbitda < 2 ? 'Este nivel es conservador y proporciona flexibilidad para nueva financiación.' : deudaNetaEbitda < 3.5 ? 'Nivel estándar en operaciones de deuda bancaria.' : deudaNetaEbitda < 5 ? 'Nivel que puede limitar el acceso a nueva financiación.' : 'Nivel elevado que requiere un plan activo de desapalancamiento.'}`);
  }
  if (coberturaIntereses !== null) {
    partes.push(`La cobertura de intereses (EBITDA/Gasto financiero) es de ${fmtX(coberturaIntereses)}, ${coberturaIntereses > 5 ? 'muy holgada' : coberturaIntereses > 3 ? 'razonable' : 'ajustada, lo que puede limitar la generación de caja libre'}.`);
  }
  if (deudaFinancieraTotal === 0) partes.push('No se identifican cuentas de deuda financiera bancaria (17x/52x) en la documentación aportada.');
  return partes.join(' ');
}

export function PageEndeudamiento({ calc }) {
  if (!calc.hasBalance) return (
    <A4Page id="page-deuda">
      <PageHeader n="07" title="Endeudamiento y solvencia" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <LimitNote>No calculable sin balance de situación.</LimitNote>
    </A4Page>
  );
  const narrativa = narrativaEndeudamiento(calc);
  return (
    <A4Page id="page-deuda">
      <PageHeader n="07" title="Endeudamiento y solvencia" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <RatioCard nombre="Autonomía financiera" formula="PN / Total Activo" valor={fmtPct((calc.autonomia || 0) * 100)} semColor={calc.autonomia >= 0.35 ? 'verde' : calc.autonomia >= 0.2 ? 'ambar' : 'rojo'} refValue="≥ 35%" interpretacion={calc.autonomia >= 0.5 ? 'Estructura sólida. Mayoría de activos financiados con recursos propios.' : calc.autonomia >= 0.35 ? 'Estructura razonable. Dependencia moderada de financiación ajena.' : 'Alta dependencia de recursos ajenos. Riesgo estructural elevado.'} />
        <RatioCard nombre="Endeudamiento total" formula="Pasivo / PN" valor={fmtX(calc.endeudamiento)} semColor={calc.endeudamiento === null ? 'gris' : calc.endeudamiento < 1.5 ? 'verde' : calc.endeudamiento < 2.5 ? 'ambar' : 'rojo'} refValue="< 2,0" interpretacion={calc.endeudamiento < 1.5 ? 'Endeudamiento conservador. Buena capacidad de financiación adicional.' : calc.endeudamiento < 2.5 ? 'Endeudamiento moderado. Dentro de rangos habituales del mercado.' : 'Endeudamiento elevado. Puede dificultar nueva financiación bancaria.'} />
        <RatioCard nombre="Solvencia patrimonial" formula="Total Activo / Pasivo" valor={fmtX(calc.solvencia)} semColor={calc.solvencia === null ? 'gris' : calc.solvencia >= 1.5 ? 'verde' : calc.solvencia >= 1.2 ? 'ambar' : 'rojo'} refValue="≥ 1,5" interpretacion={calc.solvencia >= 1.5 ? 'El activo cubre con holgura todas las deudas de la empresa.' : calc.solvencia >= 1 ? 'Solvencia ajustada. Activo cubre deudas pero sin margen amplio.' : 'Insolvencia técnica: el pasivo supera el activo total.'} />
      </div>

      {narrativa && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Diagnóstico de endeudamiento y solvencia</p>
          <p className="text-xs text-slate-700 leading-relaxed">{narrativa}</p>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Deuda financiera identificada (cuentas 17x / 52x)</p>
        <DataRow label="Deuda financiera CP (52x)" value={fmtEUR(calc.deudaFinancieraCp)} />
        <DataRow label="Deuda financiera LP (17x)" value={fmtEUR(calc.deudaFinancieraLp)} />
        <DataRow label="Deuda financiera total" value={fmtEUR(calc.deudaFinancieraTotal)} color="text-slate-800" />
        <DataRow label="Deuda financiera neta (DFN)" value={fmtEUR(calc.deudaFinancieraNeta)} color={calc.deudaFinancieraNeta <= 0 ? 'text-emerald-600' : 'text-amber-600'} note="Deuda financiera bruta − Tesorería" />
        {calc.deudaNetaEbitda !== null && <DataRow label="DFN / EBITDA" value={fmtX(calc.deudaNetaEbitda)} color={calc.deudaNetaEbitda < 3 ? 'text-emerald-600' : calc.deudaNetaEbitda < 5 ? 'text-amber-600' : 'text-red-600'} note="Referencia: < 3x conservador, < 5x transaccional" />}
        {calc.coberturaIntereses !== null && <DataRow label="Cobertura de intereses" value={fmtX(calc.coberturaIntereses)} color={calc.coberturaIntereses > 3 ? 'text-emerald-600' : 'text-amber-600'} note="EBITDA / Gasto financiero. Ref: > 3x" />}
      </div>

      {calc.deudaFinancieraTotal === 0 && <LimitNote>No se han identificado cuentas de deuda financiera (17x / 52x) en el documento. Confirmar si la empresa carece de deuda financiera o si no figura en la fuente aportada.</LimitNote>}
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 8 — RENTABILIDAD
// ══════════════════════════════════════════════════════════════════════════════
function narrativaRentabilidad(calc) {
  const { margenNeto, margenEBITDA, roa, roe, pesPersonal, pesServicios, resultado, ebitda, ingresos } = calc;
  const partes = [];
  if (margenNeto !== null) {
    if (margenNeto > 0.15) partes.push(`La empresa presenta un margen neto excelente del ${fmtPct(margenNeto * 100)}: por cada euro de ingresos retiene más de ${fmtPct(margenNeto * 100)} de beneficio neto, lo que refleja una estructura de costes eficiente y una propuesta de valor con capacidad de pricing.`);
    else if (margenNeto > 0.05) partes.push(`El margen neto (${fmtPct(margenNeto * 100)}) es positivo y razonable. La empresa genera beneficio, aunque existe margen de mejora en la optimización de la estructura de costes.`);
    else if (margenNeto > 0) partes.push(`El margen neto es positivo pero muy ajustado (${fmtPct(margenNeto * 100)}). Pequeñas variaciones en ingresos o costes pueden llevar el resultado a territorio negativo.`);
    else partes.push(`El margen neto es negativo (${fmtPct(margenNeto * 100)}), lo que indica que los gastos totales superan los ingresos generados en el ejercicio analizado. Es prioritario identificar las partidas de coste con mayor impacto y revisar el modelo de negocio.`);
  }
  if (margenEBITDA !== null) {
    partes.push(`El margen EBITDA es del ${fmtPct(margenEBITDA * 100)} (EBITDA: ${fmtEUR(ebitda)}), que representa la generación de caja operativa antes de amortizaciones, intereses e impuestos.`);
  }
  if (roa !== null) partes.push(`El ROA (${fmtPct(roa * 100)}) indica la rentabilidad que la empresa obtiene sobre sus activos totales.`);
  if (roe !== null) partes.push(`El ROE (${fmtPct(roe * 100)}) refleja el retorno generado sobre los fondos propios invertidos por los accionistas.`);
  if (pesPersonal !== null) {
    partes.push(`El gasto de personal representa el ${fmtPct(pesPersonal * 100)} de los ingresos, ${pesPersonal < 0.35 ? 'dentro de parámetros eficientes' : pesPersonal < 0.5 ? 'en niveles que merecen seguimiento' : 'un nivel elevado que presiona significativamente la rentabilidad'}.`);
  }
  return partes.join(' ');
}

export function PageRentabilidad({ calc }) {
  if (!calc.hasPyG) return (
    <A4Page id="page-rentabilidad">
      <PageHeader n="08" title="Rentabilidad y eficiencia" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <LimitNote>Ratios de rentabilidad no calculables: falta cuenta de PyG.</LimitNote>
    </A4Page>
  );
  const narrativa = narrativaRentabilidad(calc);
  return (
    <A4Page id="page-rentabilidad">
      <PageHeader n="08" title="Rentabilidad y eficiencia" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <RatioCard nombre="Margen neto" formula="Resultado / Ingresos" valor={fmtPct((calc.margenNeto || 0) * 100)} semColor={calc.resultado > 0 ? 'verde' : 'rojo'} refValue="> 0%" interpretacion={calc.resultado > 0 ? `Resultado positivo: ${fmtEUR(calc.resultado)} de beneficio neto en el ejercicio.` : `Resultado negativo: ${fmtEUR(calc.resultado)}. La empresa consume más recursos de los que genera.`} />
        <RatioCard nombre="Margen EBITDA" formula="EBITDA / Ingresos" valor={fmtPct((calc.margenEBITDA || 0) * 100)} semColor={calc.ebitda > 0 ? 'verde' : 'rojo'} refValue="> 10%" interpretacion={calc.ebitda > 0 ? `EBITDA positivo (${fmtEUR(calc.ebitda)}): la operación genera caja antes de amortizaciones e intereses.` : `EBITDA negativo: la operación no genera caja suficiente. Revisión urgente.`} />
        <RatioCard nombre="ROA" formula="Resultado / Total Activo" valor={fmtPct((calc.roa || 0) * 100)} semColor={calc.roa === null ? 'gris' : calc.roa > 0.05 ? 'verde' : calc.roa > 0 ? 'ambar' : 'rojo'} refValue="> 5%" interpretacion={calc.roa > 0.08 ? 'Buena eficiencia en el uso de activos.' : calc.roa > 0 ? 'Rentabilidad sobre activos positiva pero mejorable.' : 'Activos no generan retorno positivo en el ejercicio.'} />
        <RatioCard nombre="ROE" formula="Resultado / PN" valor={fmtPct((calc.roe || 0) * 100)} semColor={calc.roe === null ? 'gris' : calc.roe > 0.1 ? 'verde' : calc.roe > 0 ? 'ambar' : 'rojo'} refValue="> 10%" interpretacion={calc.roe > 0.15 ? 'Retorno sobre equity atractivo para accionistas.' : calc.roe > 0 ? 'Rentabilidad sobre fondos propios positiva pero por debajo del 10% de referencia.' : 'Fondos propios generan pérdidas en el ejercicio.'} />
        <RatioCard nombre="Peso personal / ingresos" formula="Gasto personal / Ingresos" valor={fmtPct((calc.pesPersonal || 0) * 100)} semColor={calc.pesPersonal === null ? 'gris' : calc.pesPersonal < 0.35 ? 'verde' : calc.pesPersonal < 0.5 ? 'ambar' : 'rojo'} refValue="< 35-40%" interpretacion={calc.pesPersonal < 0.35 ? 'Estructura salarial eficiente respecto a ingresos.' : calc.pesPersonal < 0.5 ? 'Coste de personal significativo. Monitorizar productividad.' : 'Coste de personal muy elevado. Impacto directo en rentabilidad.'} />
        <RatioCard nombre="Peso servicios / ingresos" formula="Serv. exteriores / Ingresos" valor={fmtPct((calc.pesServicios || 0) * 100)} semColor={calc.pesServicios === null ? 'gris' : calc.pesServicios < 0.3 ? 'verde' : calc.pesServicios < 0.45 ? 'ambar' : 'rojo'} refValue="< 30%" interpretacion={calc.pesServicios < 0.3 ? 'Gasto en servicios exteriores bajo control.' : 'Servicios exteriores representan una parte relevante del coste. Revisar externalización.'} />
      </div>
      {narrativa && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Diagnóstico de rentabilidad</p>
          <p className="text-xs text-slate-700 leading-relaxed">{narrativa}</p>
        </div>
      )}
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 9 — CASHFLOW
// ══════════════════════════════════════════════════════════════════════════════
export function PageCashflow({ calc }) {
  const disponible = calc.hasPyG;
  return (
    <A4Page id="page-cashflow">
      <PageHeader n="09" title="Cashflow y generación de caja" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      {!disponible ? (
        <LimitNote>Cashflow no calculable con seguridad con la documentación aportada. Para este bloque se requiere: PyG del ejercicio, balance comparativo, detalle de amortizaciones y movimientos bancarios.</LimitNote>
      ) : (
        <>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Cashflow contable estimado (método indirecto simplificado)</p>
            <DataRow label="Resultado neto" value={fmtEUR(calc.resultado)} color={calc.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'} />
            <DataRow label="(+) Amortizaciones y deterioros (68x)" value={fmtEUR(calc.amortizacion)} />
            <DataRow label="Cashflow contable (EBITDA proxy)" value={fmtEUR(calc.cashflowContable)} color="text-blue-700" note="Dato calculado — no es cashflow libre" />
          </div>
          <LimitNote>El cashflow contable mostrado es una aproximación (resultado + amortizaciones) calculada sobre la PyG extraída. No refleja variaciones de working capital, capex, ni movimientos financieros. Para cashflow libre real se requiere balance comparativo, diario o mayor contable.</LimitNote>
          <div className="mt-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Información adicional necesaria para cashflow completo</p>
            {['Balance de situación comparativo (ejercicio anterior)', 'Detalle de amortizaciones y deterioros', 'Movimientos bancarios del período', 'Detalle de inversiones (capex)', 'Variaciones de deuda financiera'].map((i, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-slate-500 py-1">
                <Clock className="w-3 h-3 text-slate-300" />{i}
              </div>
            ))}
          </div>
        </>
      )}
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 10 — M&A
// ══════════════════════════════════════════════════════════════════════════════
export function PageMA({ calc, aiContent }) {
  return (
    <A4Page id="page-ma">
      <PageHeader n="10" title="Análisis M&A y corporate finance" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4">
        <p className="text-[10px] text-amber-800"><strong>Lectura M&A preliminar.</strong> Sin valoración de empresa, sin múltiplos de transacción ni rango de precio. El presente análisis identifica los parámetros disponibles y señala qué información adicional requeriría un comprador o inversor para completar una due diligence financiera.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Parámetros M&A disponibles</p>
          <DataRow label="EBITDA reportado" value={calc.hasPyG ? fmtEUR(calc.ebitda) : '—'} note="Dato calculado" />
          <DataRow label="EBITDA ajustado" value={calc.ebitdaAjustado !== null ? fmtEUR(calc.ebitdaAjustado) : '—'} note={calc.ebitdaAjustado ? 'Incluye ajustes de usuario' : 'Sin ajustes identificados'} />
          <DataRow label="Deuda financiera bruta" value={fmtEUR(calc.deudaFinancieraTotal)} />
          <DataRow label="Caja y equivalentes" value={fmtEUR(calc.tesoreria)} />
          <DataRow label="Deuda financiera neta (DFN)" value={fmtEUR(calc.deudaFinancieraNeta)} color={calc.deudaFinancieraNeta <= 0 ? 'text-emerald-600' : 'text-amber-600'} />
          <DataRow label="DFN / EBITDA" value={calc.deudaNetaEbitda !== null ? fmtX(calc.deudaNetaEbitda) : '—'} note="Referencia: < 3x conservador" />
          <DataRow label="Calidad de ingresos" value={calc.calidad_ingresos?.replace(/_/g, ' ') || '—'} />
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Información pendiente para DD financiera</p>
          {[
            'Serie histórica PyG — mínimo 3 ejercicios',
            'Detalle y documentación de ajustes EBITDA',
            'Working capital normalizado (promedio histórico)',
            'Pasivos contingentes conocidos',
            'Capex recurrente y de mantenimiento',
            'Concentración de clientes (top 5)',
            'Recurrencia de ingresos y contratos en vigor',
            'Deuda-like items (compromisos off-balance)',
            'Cash-like items (depósitos restringidos)',
          ].map((i, idx) => (
            <div key={idx} className="flex items-center gap-2 text-[10px] text-slate-500 py-0.5">
              <AlertTriangle className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" />{i}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl p-4">
        <p className="text-[10px] font-bold text-white mb-1">Principales observaciones M&A</p>
        <p className="text-[10px] text-slate-300 leading-relaxed">
          {calc.hasPyG
            ? `La empresa presenta ingresos de ${fmtEUR(calc.ingresos)} y EBITDA de ${fmtEUR(calc.ebitda)} para el período analizado, con una posición cash-free debt-free estimada de ${calc.posicionCFDF}. Sin serie histórica no es posible evaluar crecimiento ni recurrencia. La calidad del EBITDA requiere contraste con los ajustes identificados. No se emite valoración ni rango de múltiplo sin información adicional.`
            : 'Sin cuenta de PyG, la lectura M&A está significativamente limitada. No es posible calcular EBITDA, márgenes ni DFN/EBITDA. Se recomienda aportar PyG antes de cualquier proceso de valoración o due diligence.'}
        </p>
      </div>
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 11 — CALIDAD CONTABLE
// ══════════════════════════════════════════════════════════════════════════════
export function PageCalidadContable({ calc }) {
  const indicadores = [
    { label: 'Balance cuadra A = PN + P', ok: calc.balanceCuadra !== false, detalle: calc.balanceCuadra ? 'Activo = PN + Pasivo' : `Diferencia: ${fmtEUR(calc.diferencia)}` },
    { label: 'Sin saldos negativos atípicos', ok: calc.saldosNegativos === 0, detalle: calc.saldosNegativos > 0 ? `${calc.saldosNegativos} cuentas activo con saldo negativo` : 'Sin anomalías detectadas' },
    { label: 'Cuentas clasificadas', ok: calc.cuentasSinClasificar <= 3, detalle: calc.cuentasSinClasificar > 0 ? `${calc.cuentasSinClasificar} cuentas sin clasificar` : 'Todas clasificadas' },
    { label: 'PyG disponible', ok: calc.hasPyG, detalle: calc.hasPyG ? 'Cuenta de PyG presente' : 'No aportada' },
    { label: 'Cuentas pendientes revisión', ok: calc.pendientesRevision <= 2, detalle: `${calc.pendientesRevision} cuentas marcadas para revisión` },
  ];

  return (
    <A4Page id="page-calidad">
      <PageHeader n="11" title="Calidad contable" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <div className="flex items-center gap-4 mb-5">
        <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0', calc.calidadScore >= 80 ? 'bg-emerald-100' : calc.calidadScore >= 60 ? 'bg-amber-100' : 'bg-red-100')}>
          <p className={cn('text-xl font-jakarta font-bold', calc.calidadScore >= 80 ? 'text-emerald-700' : calc.calidadScore >= 60 ? 'text-amber-700' : 'text-red-700')}>{calc.calidadScore}</p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">Calidad {calc.calidadLabel}</p>
          <p className="text-xs text-slate-500">Puntuación interna basada en validaciones automáticas. No equivale a auditoría.</p>
        </div>
      </div>

      <div className="space-y-2 mb-5">
        {indicadores.map((ind, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
            {ind.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
            <p className="text-xs font-medium text-slate-700 flex-1">{ind.label}</p>
            <p className="text-xs text-slate-500">{ind.detalle}</p>
          </div>
        ))}
      </div>

      <LimitNote>Esta calificación de calidad contable es automática y orientativa. No sustituye una revisión contable profesional ni una auditoría de cuentas. Se basa exclusivamente en las validaciones técnicas aplicadas sobre los datos extraídos.</LimitNote>
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 12 — FISCALIDAD PRELIMINAR
// ══════════════════════════════════════════════════════════════════════════════
export function PageFiscalidad({ calc }) {
  const cuentas = calc.cuentas || [];
  const cuentasFiscales = cuentas.filter(c => ['472', '474', '475', '476', '477', '470', '471'].some(p => String(c.cuenta).startsWith(p)));
  return (
    <A4Page id="page-fiscal">
      <PageHeader n="12" title="Fiscalidad — Análisis preliminar" empresa={calc.empresa} ejercicio={calc.ejercicio} />
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
        <p className="text-xs text-amber-800"><strong>Análisis fiscal preliminar</strong> basado exclusivamente en las cuentas contables aportadas. No sustituye revisión de modelos tributarios, liquidaciones oficiales ni dictamen fiscal. Para conclusiones definitivas es necesario contrastar con modelos 303/390/420/425/200/111/115 y libros registro.</p>
      </div>
      {cuentasFiscales.length > 0 ? (
        <div className="mb-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Cuentas fiscales identificadas (grupo 47x)</p>
          <div className="space-y-1">
            {cuentasFiscales.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 text-xs">
                <span className="font-mono font-semibold text-slate-700 w-16">{c.cuenta}</span>
                <span className="text-slate-600 flex-1 px-2">{c.descripcion}</span>
                <span className="font-bold text-slate-800">{fmtEUR(c.importe_actual, 2)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <LimitNote>No se han identificado cuentas fiscales (47x) en el documento aportado. Para análisis fiscal completo aportar modelos tributarios.</LimitNote>
      )}
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 13 — ALERTAS
// ══════════════════════════════════════════════════════════════════════════════
export function PageAlertas({ alertas }) {
  const colorCfg = {
    critico: 'border-red-300 bg-red-50',
    alta: 'border-red-200 bg-red-50',
    media: 'border-amber-200 bg-amber-50',
    baja: 'border-blue-200 bg-blue-50',
    informativo: 'border-slate-200 bg-slate-50',
  };
  const badgeCfg = {
    critico: 'bg-red-600 text-white',
    alta: 'bg-red-100 text-red-700',
    media: 'bg-amber-100 text-amber-700',
    baja: 'bg-blue-100 text-blue-700',
    informativo: 'bg-slate-100 text-slate-600',
  };

  return (
    <A4Page id="page-alertas">
      <PageHeader n="13" title="Alertas críticas detectadas" empresa="" ejercicio="" />
      {alertas.length === 0 ? (
        <div className="text-center py-8"><CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" /><p className="text-sm text-slate-500">Sin alertas relevantes detectadas.</p></div>
      ) : (
        <div className="space-y-3">
          {alertas.map((a, i) => (
            <div key={i} className={cn('border rounded-xl px-4 py-3', colorCfg[a.nivel] || colorCfg.informativo)}>
              <div className="flex items-start gap-2 mb-1 flex-wrap">
                <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full uppercase flex-shrink-0', badgeCfg[a.nivel] || badgeCfg.informativo)}>{a.nivel}</span>
                <p className="text-xs font-bold text-slate-800 flex-1">{a.titulo}</p>
                {a.area && <span className="text-[9px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">{a.area}</span>}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{a.desc}</p>
              {a.accion && <p className="text-[10px] text-slate-500 mt-1 italic">Acción: {a.accion}</p>}
            </div>
          ))}
        </div>
      )}
    </A4Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA 14 — RECOMENDACIONES & PLAN DE ACCIÓN
// ══════════════════════════════════════════════════════════════════════════════
export function PagePlan({ recs, aiContent }) {
  const bloques = [
    { label: 'Acción inmediata', key: 'inmediata', color: 'border-red-300 bg-red-50', badge: 'bg-red-600 text-white' },
    { label: 'Corto plazo (< 3 meses)', key: 'corto', color: 'border-amber-300 bg-amber-50', badge: 'bg-amber-500 text-white' },
    { label: 'Medio plazo (3-12 meses)', key: 'medio', color: 'border-blue-300 bg-blue-50', badge: 'bg-blue-600 text-white' },
    { label: 'Información adicional necesaria', key: 'info', color: 'border-slate-200 bg-slate-50', badge: 'bg-slate-600 text-white' },
  ];

  return (
    <A4Page id="page-plan">
      <PageHeader n="14" title="Recomendaciones y plan de acción" empresa="" ejercicio="" />
      <div className="space-y-4">
        {bloques.map(b => recs[b.key]?.length > 0 && (
          <div key={b.key} className={cn('border rounded-xl p-4', b.color)}>
            <span className={cn('text-[10px] font-bold px-3 py-1 rounded-full inline-block mb-3', b.badge)}>{b.label}</span>
            <ul className="space-y-1.5">
              {recs[b.key].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                  <span className="text-slate-400 flex-shrink-0 mt-0.5">→</span>{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {aiContent?.conclusion_final && (
          <div className="bg-slate-900 rounded-xl px-4 py-4 mt-4">
            <p className="text-[10px] font-bold text-white mb-1">Conclusión profesional Taxea IA</p>
            <p className="text-xs text-slate-300 leading-relaxed">{aiContent.conclusion_final}</p>
          </div>
        )}
      </div>
      <div className="mt-6 pt-4 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 leading-relaxed italic">El presente informe ha sido elaborado por Taxea Strategies con base en la documentación facilitada y tiene carácter preliminar. Las conclusiones deben contrastarse con la documentación soporte, modelos fiscales presentados y libros contables. No sustituye auditoría, certificación contable ni asesoramiento jurídico.</p>
      </div>
    </A4Page>
  );
}
/**
 * PremiumReportViewer — Informe Taxea Strategies V4
 * Visualiza el informe financiero generado desde AnalysisDashboard
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, Shield, FileText, BarChart2, AlertTriangle,
  CheckCircle2, TrendingUp, TrendingDown, Info, Printer
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useEffect } from 'react';

const fmt = n =>
  typeof n === 'number'
    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
    : '—';
const pct = n => typeof n === 'number' ? `${n.toFixed(1)}%` : '—';

const TABS = ['Resumen', 'Balance', 'PyG', 'Ratios', 'Alertas', 'Trazabilidad'];

function Section({ title, children }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 space-y-4">
      <p className="text-sm font-bold text-foreground border-b border-slate-100 pb-2">{title}</p>
      {children}
    </div>
  );
}

function KpiRow({ label, value, color, note }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-xs font-medium text-slate-600">{label}</p>
        {note && <p className="text-[10px] text-slate-400">{note}</p>}
      </div>
      <p className={cn('text-sm font-bold', color || 'text-foreground')}>{value}</p>
    </div>
  );
}

export default function PremiumReportViewer({ imp, onBack }) {
  const [tab, setTab] = useState(0);
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (!imp?.id) return;
    base44.entities.FinancialReport.filter({ import_id: imp.id }, '-created_date', 1)
      .then(results => { if (results?.length > 0) setReport(results[0]); });
  }, [imp?.id]);

  const m = report?.contenido || imp?.metricas_calculadas || {};
  const balance = m.balance || {};
  const pyg = m.pyg || {};
  const cuentas = m.cuentas || [];
  const alertas = m.alertas || report?.alertas || [];
  const supuestos = imp?.supuestos_aplicados || [];
  const confianza = m.confianza_media;
  const ejercicio = imp?.periodo_fin?.substring(0, 4) || '2024';

  const totalActivo = balance.totalActivo || 0;
  const patrimonioNeto = balance.patrimonioNeto || 0;
  const activoCorriente = balance.activoCorriente || 0;
  const pasivoCorriente = balance.pasivoCorriente || 0;
  const pasivoNoCorriente = balance.pasivoNoCorriente || 0;
  const ingresos = pyg.ingresos || 0;
  const gastos = pyg.gastos || 0;
  const resultado = pyg.resultado || 0;
  const ebitda = pyg.ebitda || 0;
  const fondoManiobra = activoCorriente - pasivoCorriente;

  // Simple ratio calculation
  const ratios = [
    { nombre: 'Liquidez corriente', formula: 'Activo C / Pasivo C', valor: pasivoCorriente > 0 ? (activoCorriente / pasivoCorriente).toFixed(2) : '—', ok: pasivoCorriente > 0 && activoCorriente / pasivoCorriente >= 1 },
    { nombre: 'Autonomía financiera', formula: 'PN / Total Activo', valor: totalActivo > 0 ? pct(patrimonioNeto / totalActivo * 100) : '—', ok: totalActivo > 0 && patrimonioNeto / totalActivo >= 0.3 },
    { nombre: 'Margen neto', formula: 'Resultado / Ingresos', valor: ingresos > 0 ? pct(resultado / ingresos * 100) : '—', ok: resultado > 0 },
    { nombre: 'Endeudamiento', formula: '(PC + PNC) / PN', valor: patrimonioNeto > 0 ? ((pasivoCorriente + pasivoNoCorriente) / patrimonioNeto).toFixed(2) : '—', ok: patrimonioNeto > 0 && (pasivoCorriente + pasivoNoCorriente) / patrimonioNeto < 2 },
  ];

  // Balance mass groups
  const MASA_GROUPS = [
    { label: 'Activo No Corriente', masa: 'activo_no_corriente', color: 'bg-blue-50 text-blue-700' },
    { label: 'Activo Corriente', masa: 'activo_corriente', color: 'bg-cyan-50 text-cyan-700' },
    { label: 'Patrimonio Neto', masa: 'patrimonio_neto', color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Pasivo No Corriente', masa: 'pasivo_no_corriente', color: 'bg-amber-50 text-amber-700' },
    { label: 'Pasivo Corriente', masa: 'pasivo_corriente', color: 'bg-orange-50 text-orange-700' },
    { label: 'Ingresos', masa: 'pyg_ingreso', color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Gastos', masa: 'pyg_gasto', color: 'bg-red-50 text-red-700' },
  ];

  const accountsByMasa = {};
  for (const a of cuentas) {
    if (!accountsByMasa[a.masa]) accountsByMasa[a.masa] = [];
    accountsByMasa[a.masa].push(a);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Volver
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-700" />
              <h2 className="text-lg font-jakarta font-bold">Informe Taxea Strategies</h2>
            </div>
            <p className="text-xs text-slate-400">{imp?.empresa_nombre || 'Empresa'} · Ejercicio {ejercicio}</p>
          </div>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300">
          <strong className="text-white">Informe preliminar basado exclusivamente en datos extraídos del documento aportado.</strong>{' '}
          Confianza media: <span className="text-blue-300">{confianza ? `${confianza}%` : '—'}</span>.
          No constituye auditoría ni certificación contable. Pendiente validación profesional.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 pb-0">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            className={cn('px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap',
              tab === i ? 'bg-white border border-b-white border-slate-100 text-foreground -mb-px' : 'text-slate-400 hover:text-slate-600')}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Resumen */}
      {tab === 0 && (
        <div className="space-y-4">
          {report?.resumen_ejecutivo && (
            <Section title="Resumen ejecutivo">
              <p className="text-sm text-slate-600 leading-relaxed">{report.resumen_ejecutivo}</p>
            </Section>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total activo', value: fmt(totalActivo), icon: BarChart2, color: 'text-blue-700' },
              { label: 'Patrimonio neto', value: fmt(patrimonioNeto), icon: TrendingUp, color: 'text-emerald-700' },
              { label: 'Fondo de maniobra', value: fmt(fondoManiobra), icon: fondoManiobra >= 0 ? TrendingUp : TrendingDown, color: fondoManiobra >= 0 ? 'text-emerald-700' : 'text-red-600' },
              { label: 'Ingresos', value: fmt(ingresos), icon: TrendingUp, color: 'text-emerald-600' },
              { label: 'Resultado', value: fmt(resultado), icon: resultado >= 0 ? TrendingUp : TrendingDown, color: resultado >= 0 ? 'text-emerald-600' : 'text-red-600' },
              { label: 'EBITDA estimado', value: fmt(ebitda), icon: BarChart2, color: 'text-blue-600' },
            ].map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                  <Icon className={cn('w-4 h-4 mb-2', k.color)} />
                  <p className={cn('text-xl font-jakarta font-bold', k.color)}>{k.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
                </div>
              );
            })}
          </div>
          {report?.conclusiones?.length > 0 && (
            <Section title="Conclusiones clave">
              <ul className="space-y-2">
                {report.conclusiones.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {c}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {/* Tab: Balance */}
      {tab === 1 && (
        <div className="space-y-4">
          <Section title="Balance de situación reconstruido">
            <KpiRow label="Total Activo" value={fmt(totalActivo)} color="text-blue-700" note="Activo NC + Activo C" />
            <KpiRow label="  Activo No Corriente" value={fmt(totalActivo - activoCorriente)} />
            <KpiRow label="  Activo Corriente" value={fmt(activoCorriente)} />
            <KpiRow label="Total PN + Pasivo" value={fmt(patrimonioNeto + pasivoCorriente + pasivoNoCorriente)} color={balance.cuadra ? 'text-emerald-700' : 'text-red-600'} note={balance.cuadra ? '✓ Cuadra con activo' : `⚠ Diferencia: ${fmt(balance.diferencia)}`} />
            <KpiRow label="  Patrimonio Neto" value={fmt(patrimonioNeto)} color="text-emerald-700" />
            <KpiRow label="  Pasivo No Corriente" value={fmt(pasivoNoCorriente)} />
            <KpiRow label="  Pasivo Corriente" value={fmt(pasivoCorriente)} />
            <KpiRow label="Fondo de maniobra" value={fmt(fondoManiobra)} color={fondoManiobra >= 0 ? 'text-emerald-600' : 'text-red-600'} note="Activo C − Pasivo C" />
          </Section>
          {cuentas.filter(a => ['activo_no_corriente', 'activo_corriente', 'patrimonio_neto', 'pasivo_no_corriente', 'pasivo_corriente'].includes(a.masa)).length > 0 && (
            <Section title="Cuentas de balance extraídas">
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Cuenta', 'Descripción', 'Masa', 'Importe actual', 'Conf.'].map(h => (
                        <th key={h} className="py-2 px-3 text-left font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {cuentas.filter(a => !a.excluida && ['activo_no_corriente', 'activo_corriente', 'patrimonio_neto', 'pasivo_no_corriente', 'pasivo_corriente'].includes(a.masa)).map((a, i) => {
                      const masaLabel = { activo_no_corriente: 'Activo NC', activo_corriente: 'Activo C', patrimonio_neto: 'PN', pasivo_no_corriente: 'Pasivo NC', pasivo_corriente: 'Pasivo C' };
                      const masaColor = { activo_no_corriente: 'bg-blue-50 text-blue-700', activo_corriente: 'bg-cyan-50 text-cyan-700', patrimonio_neto: 'bg-emerald-50 text-emerald-700', pasivo_no_corriente: 'bg-amber-50 text-amber-700', pasivo_corriente: 'bg-orange-50 text-orange-700' };
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-semibold text-slate-700">{a.cuenta || '—'}</td>
                          <td className="py-2 px-3 text-slate-600 max-w-48 truncate">{a.descripcion}</td>
                          <td className="py-2 px-3"><span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', masaColor[a.masa] || 'bg-slate-100 text-slate-500')}>{masaLabel[a.masa] || a.masa}</span></td>
                          <td className="py-2 px-3 font-mono text-right">{fmt(a.importe_actual)}</td>
                          <td className="py-2 px-3">
                            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', a.confianza >= 85 ? 'bg-emerald-50 text-emerald-700' : a.confianza >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600')}>{a.confianza}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Tab: PyG */}
      {tab === 2 && (
        <div className="space-y-4">
          <Section title="Cuenta de pérdidas y ganancias reconstruida">
            <KpiRow label="Ingresos (Grupo 7)" value={fmt(ingresos)} color="text-emerald-700" />
            <KpiRow label="Gastos (Grupo 6)" value={fmt(gastos)} color="text-slate-600" />
            <KpiRow label="Resultado antes de impuestos" value={fmt(resultado)} color={resultado >= 0 ? 'text-emerald-600' : 'text-red-600'} />
            <KpiRow label="Margen neto estimado" value={ingresos > 0 ? pct(resultado / ingresos * 100) : '—'} color={resultado >= 0 ? 'text-blue-600' : 'text-red-600'} />
            <KpiRow label="EBITDA estimado" value={fmt(ebitda)} color="text-blue-700" note="Resultado + Amortizaciones (68x)" />
          </Section>
          {cuentas.filter(a => ['pyg_ingreso', 'pyg_gasto'].includes(a.masa)).length > 0 && (
            <Section title="Cuentas de PyG extraídas">
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Cuenta', 'Descripción', 'Tipo', 'Importe', 'Conf.'].map(h => (
                        <th key={h} className="py-2 px-3 text-left font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {cuentas.filter(a => !a.excluida && ['pyg_ingreso', 'pyg_gasto'].includes(a.masa)).map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-semibold text-slate-700">{a.cuenta || '—'}</td>
                        <td className="py-2 px-3 text-slate-600 max-w-48 truncate">{a.descripcion}</td>
                        <td className="py-2 px-3"><span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', a.masa === 'pyg_ingreso' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>{a.masa === 'pyg_ingreso' ? 'Ingreso' : 'Gasto'}</span></td>
                        <td className="py-2 px-3 font-mono text-right">{fmt(a.importe_actual)}</td>
                        <td className="py-2 px-3"><span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', a.confianza >= 85 ? 'bg-emerald-50 text-emerald-700' : a.confianza >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600')}>{a.confianza}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Tab: Ratios */}
      {tab === 3 && (
        <Section title="Ratios financieros calculados">
          <p className="text-xs text-slate-400">Calculados exclusivamente sobre cuentas extraídas. Orientativos.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {ratios.map((r, i) => (
              <div key={i} className={cn('border rounded-xl p-4', r.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100')}>
                <p className={cn('text-xl font-jakarta font-bold', r.ok ? 'text-emerald-700' : 'text-amber-700')}>{r.valor}</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{r.nombre}</p>
                <p className="text-[10px] text-slate-400">{r.formula}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Tab: Alertas */}
      {tab === 4 && (
        <Section title="Alertas y observaciones">
          {alertas.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Sin alertas registradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertas.map((a, i) => {
                const colors = { critico: 'bg-red-50 border-red-200 text-red-700', revisar: 'bg-amber-50 border-amber-200 text-amber-700', informativo: 'bg-blue-50 border-blue-200 text-blue-700' };
                return (
                  <div key={i} className={cn('border rounded-xl px-4 py-3 text-xs', colors[a.nivel] || colors.informativo)}>
                    <p className="font-semibold">{a.nivel === 'critico' ? '🔴' : a.nivel === 'revisar' ? '🟡' : 'ℹ️'} {a.titulo}</p>
                    <p className="opacity-80 mt-0.5">{a.desc}</p>
                    {a.area && <p className="opacity-50 mt-0.5 text-[10px]">Área: {a.area}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* Tab: Trazabilidad */}
      {tab === 5 && (
        <div className="space-y-4">
          <Section title="Origen y trazabilidad de los datos">
            <KpiRow label="Archivo" value={imp?.nombre_archivo || '—'} />
            <KpiRow label="Tipo de origen" value={imp?.origen || '—'} />
            <KpiRow label="Empresa" value={imp?.empresa_nombre || '—'} />
            <KpiRow label="Período" value={`${imp?.periodo_inicio || '—'} → ${imp?.periodo_fin || '—'}`} />
            <KpiRow label="Cuentas extraídas" value={cuentas.length || '—'} />
            <KpiRow label="Confianza media OCR/IA" value={confianza ? `${confianza}%` : '—'} color={confianza >= 85 ? 'text-emerald-600' : confianza >= 70 ? 'text-amber-600' : 'text-red-600'} />
            <KpiRow label="Motor extracción" value="Taxea IA V4 — Análisis cuenta a cuenta" />
            <KpiRow label="Correcciones manuales" value={cuentas.filter(a => a.estado === 'corregida').length} />
          </Section>
          {supuestos.length > 0 && (
            <Section title="Supuestos y método aplicados">
              <ul className="space-y-1.5">
                {supuestos.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {cuentas.length > 0 && (
            <Section title="Todas las cuentas con trazabilidad">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="text-xs w-full min-w-[500px]">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-100">
                      {['Pág.', 'Cuenta', 'Descripción', 'Masa', 'Importe', 'Método', 'Estado', 'Conf.'].map(h => (
                        <th key={h} className="py-2 px-2 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {cuentas.map((a, i) => {
                      const metodLabel = { pdf_ia: 'PDF IA', corregida: 'Manual', extraida: 'Extraída', validada: 'Validada' };
                      return (
                        <tr key={i} className={cn('hover:bg-slate-50', a.excluida && 'opacity-40')}>
                          <td className="py-1.5 px-2 font-mono text-slate-400">{a.pagina}</td>
                          <td className="py-1.5 px-2 font-mono font-semibold text-slate-700">{a.cuenta || '—'}</td>
                          <td className="py-1.5 px-2 text-slate-600 max-w-36 truncate">{a.descripcion}</td>
                          <td className="py-1.5 px-2 text-slate-400 text-[10px]">{a.masa}</td>
                          <td className="py-1.5 px-2 font-mono text-right text-slate-700">{fmt(a.importe_actual)}</td>
                          <td className="py-1.5 px-2 text-slate-400">{metodLabel[a.metodo] || a.metodo}</td>
                          <td className="py-1.5 px-2">
                            <span className={cn('text-[9px] px-1 py-0.5 rounded font-semibold', a.estado === 'validada' ? 'bg-emerald-100 text-emerald-700' : a.estado === 'corregida' ? 'bg-blue-100 text-blue-700' : a.estado === 'pendiente_revision' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}>
                              {a.estado}
                            </span>
                          </td>
                          <td className="py-1.5 px-2">
                            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', a.confianza >= 85 ? 'bg-emerald-50 text-emerald-700' : a.confianza >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600')}>{a.confianza}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
      )}
    </motion.div>
  );
}
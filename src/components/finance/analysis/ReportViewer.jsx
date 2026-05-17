import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronLeft, FileText, AlertTriangle, CheckCircle2, Info, Printer } from 'lucide-react';

const fmt = n => typeof n === 'number'
  ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  : '—';
const pct = n => typeof n === 'number' ? `${n.toFixed(1)}%` : '—';

const METODO_LABEL = {
  pdf_auto: 'PDF — Extracción IA',
  pdf_combined: 'PDF combinado — Extracción IA',
  a3: 'A3 .dat — Parser multi-estrategia',
  excel_balance: 'Excel Balance',
  excel_pyg: 'Excel PyG',
  excel_diario: 'Excel Diario',
  excel_combined: 'Excel combinado',
};

export default function ReportViewer({ imp, onBack }) {
  const [activeSection, setActiveSection] = useState('portada');

  const m = imp?.metricas_calculadas || {};
  const balance = m.balance;
  const pyg = m.pyg;
  const alerts = m.alertas || imp?.advertencias || [];
  const confianza = m.confianza_media;
  const isPdf = imp?.origen?.startsWith('pdf');
  const metodo = METODO_LABEL[imp?.origen] || imp?.origen || 'Importación contable';

  const SECTIONS = [
    { id: 'portada',     label: '📄 Portada' },
    { id: 'alcance',     label: '🔍 Alcance y método' },
    { id: 'balance',     label: '📋 Balance' },
    { id: 'pyg',         label: '📈 PyG' },
    { id: 'ratios',      label: '📊 Ratios' },
    { id: 'alertas',     label: '⚠️ Alertas' },
    { id: 'interpretacion', label: '💡 Interpretación' },
    { id: 'trazabilidad',label: '🗂️ Trazabilidad' },
  ];

  const ingresos = m.ingresos || 0;
  const gastos = m.gastos || 0;
  const resultado = m.resultado_neto || 0;
  const margen = m.margen_neto || 0;
  const totalActivo = m.total_activo || 0;
  const patrimonioNeto = m.patrimonio_neto || 0;
  const pasivoCorriente = m.pasivo_corriente || 0;
  const activoCorriente = m.activo_corriente || 0;
  const fondoManiobra = m.fondo_maniobra ?? (activoCorriente - pasivoCorriente);
  const endeudamiento = m.endeudamiento ?? 0;
  const autonomia = m.autonomia ?? 0;
  const liquidez = m.liquidez_corriente ?? null;

  const critCount = alerts.filter(a => a.nivel === 'critico').length;
  const revisarCount = alerts.filter(a => a.nivel === 'revisar').length;
  const hasBalance = totalActivo > 0;
  const hasPyg = ingresos > 0 || resultado !== 0;

  function SectionCard({ title, children }) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="text-base font-jakarta font-bold text-foreground border-b border-slate-100 pb-3">{title}</h3>
        {children}
      </div>
    );
  }

  function DataRow({ label, value, sub, highlight }) {
    return (
      <div className={cn("flex items-start justify-between py-2 border-b border-slate-50 last:border-0", highlight && "font-semibold")}>
        <span className="text-xs text-slate-600 flex-1">{label}</span>
        <div className="text-right">
          <span className={cn("text-xs font-mono font-semibold", highlight ? "text-foreground" : "text-slate-700")}>{value}</span>
          {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Volver al dashboard
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <h2 className="text-lg font-jakarta font-bold text-foreground">Informe financiero</h2>
            <p className="text-xs text-slate-400">{imp?.empresa_nombre} · {imp?.periodo_fin?.substring(0,7)}</p>
          </div>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      {/* Nav */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
              activeSection === s.id ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-500 hover:text-foreground")}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Sections */}
      {activeSection === 'portada' && (
        <SectionCard title="Informe Financiero-Contable">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 text-white text-center">
            <div className="text-5xl mb-4">📊</div>
            <h1 className="text-2xl font-jakarta font-bold mb-2">{imp?.empresa_nombre || 'Empresa analizada'}</h1>
            <p className="text-slate-300 text-sm mb-1">Análisis financiero-contable</p>
            <p className="text-slate-400 text-xs">Ejercicio {imp?.periodo_fin?.substring(0,4) || '—'} · Generado por Taxea Business OS</p>
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[
                { label: 'Fuente', val: metodo },
                { label: 'Calidad dato', val: imp?.calidad_dato === 'alta' ? 'Alta' : imp?.calidad_dato === 'media' ? 'Media' : 'Baja' },
                { label: 'Confianza', val: confianza ? `${confianza}%` : '—' },
              ].map((k, i) => (
                <div key={i} className="bg-white/10 rounded-xl p-3">
                  <p className="text-white font-bold text-sm">{k.val}</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-red-700 mb-1">⚠ Aviso legal y de alcance</p>
            <p className="text-xs text-red-600">
              Este informe ha sido generado automáticamente a partir de datos importados. {isPdf ? 'Las cifras han sido extraídas de PDFs mediante IA/OCR y pueden contener errores. ' : ''}
              No constituye auditoría, informe de revisión limitada ni certificación contable. Las cifras deben ser verificadas por un profesional cualificado antes de su uso en decisiones financieras, fiscales o legales.
              {critCount > 0 && ` Se han detectado ${critCount} alerta(s) crítica(s) que requieren atención.`}
            </p>
          </div>
        </SectionCard>
      )}

      {activeSection === 'alcance' && (
        <SectionCard title="Alcance del análisis y método de obtención de datos">
          <DataRow label="Empresa analizada" value={imp?.empresa_nombre || '—'} />
          <DataRow label="Período" value={`${imp?.periodo_inicio || '—'} – ${imp?.periodo_fin || '—'}`} />
          <DataRow label="Método de extracción" value={metodo} />
          <DataRow label="Archivo(s) analizados" value={imp?.nombre_archivo || '—'} />
          <DataRow label="Calidad del dato" value={imp?.calidad_dato === 'alta' ? 'Alta' : imp?.calidad_dato === 'media' ? 'Media' : imp?.calidad_dato === 'baja' ? 'Baja' : '—'} />
          {confianza && <DataRow label="Confianza media de extracción" value={`${confianza}%`} />}
          <DataRow label="Alertas críticas" value={critCount} />
          <DataRow label="Alertas de revisión" value={revisarCount} />

          {imp?.supuestos_aplicados?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-600 mb-2 mt-3">Supuestos y limitaciones</p>
              <ul className="space-y-1.5">
                {imp.supuestos_aplicados.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <Info className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" /> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mt-2">
            <p className="text-xs text-blue-700">
              <strong>Cobertura del análisis:</strong>
              {hasBalance && hasPyg ? ' Balance y PyG disponibles — análisis completo posible.' : hasBalance ? ' Solo Balance disponible — análisis patrimonial sin resultados.' : hasPyg ? ' Solo PyG disponible — análisis de resultados sin balance patrimonial.' : ' Datos limitados — análisis parcial.'}
              {!hasBalance || !hasPyg ? ' Algunos ratios e indicadores no pueden calcularse por falta de datos.' : ''}
            </p>
          </div>
        </SectionCard>
      )}

      {activeSection === 'balance' && (
        <SectionCard title="Balance de situación">
          {!hasBalance ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">Balance no disponible en esta importación</p>
              <p className="text-xs mt-1">Importa un PDF o Excel de Balance para ver este apartado</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 italic">Datos extraídos automáticamente. Revisar antes de usar como referencia definitiva.</p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-blue-700 mb-2">ACTIVO</p>
                  {balance?.activo?.activoNoCorriente?.items?.map((item, i) => (
                    <DataRow key={i} label={item.label} value={fmt(item.valor)} />
                  ))}
                  <DataRow label="Total Activo No Corriente" value={fmt(balance?.activo?.activoNoCorriente?.valor || m.activo_no_corriente)} highlight />
                  <div className="mt-3" />
                  {balance?.activo?.activoCorriente?.items?.map((item, i) => (
                    <DataRow key={i} label={item.label} value={fmt(item.valor)} />
                  ))}
                  <DataRow label="Total Activo Corriente" value={fmt(balance?.activo?.activoCorriente?.valor || activoCorriente)} highlight />
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <DataRow label="TOTAL ACTIVO" value={fmt(totalActivo)} highlight />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-700 mb-2">PATRIMONIO NETO Y PASIVO</p>
                  {balance?.patrimonioPasivo?.patrimonioNeto?.items?.map((item, i) => (
                    <DataRow key={i} label={item.label} value={fmt(item.valor)} />
                  ))}
                  <DataRow label="Total Patrimonio Neto" value={fmt(patrimonioNeto)} highlight />
                  <div className="mt-3" />
                  {balance?.patrimonioPasivo?.pasivoNoCorriente?.items?.map((item, i) => (
                    <DataRow key={i} label={item.label} value={fmt(item.valor)} />
                  ))}
                  <DataRow label="Total Pasivo No Corriente" value={fmt(m.pasivo_no_corriente || 0)} highlight />
                  <div className="mt-3" />
                  {balance?.patrimonioPasivo?.pasivoCorriente?.items?.map((item, i) => (
                    <DataRow key={i} label={item.label} value={fmt(item.valor)} />
                  ))}
                  <DataRow label="Total Pasivo Corriente" value={fmt(pasivoCorriente)} highlight />
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <DataRow label="TOTAL PN + PASIVO" value={fmt(balance?.patrimonioPasivo?.totalPatrimonioPasivo || totalActivo)} highlight />
                  </div>
                </div>
              </div>
              {balance?.validacion?.cuadra !== undefined && (
                <div className={cn("border rounded-xl px-4 py-3 flex items-center gap-2", balance.validacion.cuadra ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
                  {balance.validacion.cuadra ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                  <p className={cn("text-xs font-semibold", balance.validacion.cuadra ? 'text-emerald-700' : 'text-red-700')}>
                    {balance.validacion.cuadra ? 'Balance cuadra: Activo = Patrimonio Neto + Pasivo' : `Balance no cuadra — diferencia: ${fmt(balance.validacion.diferencia || 0)}`}
                  </p>
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}

      {activeSection === 'pyg' && (
        <SectionCard title="Pérdidas y ganancias">
          {!hasPyg ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">PyG no disponible en esta importación</p>
              <p className="text-xs mt-1">Importa un PDF o Excel de PyG para ver este apartado</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 italic mb-2">Datos extraídos automáticamente. Cifras con confianza &lt;70% requieren revisión.</p>
              {pyg?.partidas ? pyg.partidas.map((p, i) => (
                <div key={i} className={cn("flex items-center justify-between py-2 border-b border-slate-50 last:border-0",
                  p.tipo === 'subtotal' || p.tipo === 'resultado' ? 'font-semibold bg-slate-50 rounded-lg px-2' : '')}>
                  <span className="text-xs text-slate-600 flex-1">{p.label}</span>
                  <div className="flex items-center gap-2">
                    {p.confianza && (
                      <span className={cn("text-[9px] font-bold px-1 py-0.5 rounded-full",
                        p.confianza >= 85 ? 'bg-emerald-50 text-emerald-700' : p.confianza >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>
                        {p.confianza}%
                      </span>
                    )}
                    <span className={cn("text-xs font-mono font-semibold min-w-20 text-right", p.valor < 0 ? 'text-red-600' : 'text-slate-800')}>{fmt(p.valor)}</span>
                  </div>
                </div>
              )) : (
                <>
                  <DataRow label="Ingresos" value={fmt(ingresos)} />
                  <DataRow label="Gastos totales" value={fmt(-gastos)} />
                  <DataRow label="Resultado del ejercicio" value={fmt(resultado)} highlight />
                </>
              )}
            </>
          )}
        </SectionCard>
      )}

      {activeSection === 'ratios' && (
        <SectionCard title="Ratios financieros (estimados)">
          <p className="text-xs text-slate-400 italic">Todos los ratios son estimados a partir de los datos importados. No sustituyen un análisis financiero profesional.</p>
          {[
            { label: 'Margen neto', value: pct(margen), desc: 'Resultado / Ingresos × 100', ok: margen > 0 },
            { label: 'Liquidez corriente', value: liquidez?.toFixed(2) ?? '—', desc: 'Activo corriente / Pasivo corriente', ok: liquidez !== null && liquidez >= 1 },
            { label: 'Autonomía financiera', value: pct(autonomia), desc: 'Patrimonio neto / Total activo × 100', ok: autonomia >= 40 },
            { label: 'Endeudamiento', value: pct(endeudamiento), desc: 'Pasivo total / Total activo × 100', ok: endeudamiento < 60 },
            { label: 'Fondo de maniobra', value: fmt(fondoManiobra), desc: 'Activo corriente − Pasivo corriente', ok: fondoManiobra >= 0 },
            ...(ingresos > 0 ? [{ label: 'Rentabilidad explotación (est.)', value: pct((resultado / ingresos) * 100), desc: 'Resultado / Ingresos × 100', ok: resultado > 0 }] : []),
          ].map((r, i) => (
            <div key={i} className={cn("flex items-start justify-between py-3 border-b border-slate-50 last:border-0")}>
              <div>
                <p className="text-xs font-semibold text-slate-700">{r.label}</p>
                <p className="text-[10px] text-slate-400">{r.desc}</p>
              </div>
              <span className={cn("text-sm font-bold font-jakarta", r.ok ? 'text-emerald-600' : 'text-amber-600')}>{r.value}</span>
            </div>
          ))}
        </SectionCard>
      )}

      {activeSection === 'alertas' && (
        <SectionCard title="Alertas y descuadres detectados">
          {alerts.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">Sin alertas relevantes detectadas</div>
          ) : (
            <div className="space-y-3">
              {alerts.map((a, i) => {
                const colors = { critico: 'bg-red-50 border-red-200', revisar: 'bg-amber-50 border-amber-200', informativo: 'bg-blue-50 border-blue-200' };
                const tc = { critico: 'text-red-700', revisar: 'text-amber-700', informativo: 'text-blue-700' };
                return (
                  <div key={i} className={cn("border rounded-xl px-4 py-3", colors[a.nivel] || colors.informativo)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-[9px] font-bold uppercase tracking-widest", tc[a.nivel])}>{a.nivel}</span>
                      {a.area && <span className="text-[9px] text-slate-400">· {a.area}</span>}
                    </div>
                    <p className={cn("text-xs font-semibold", tc[a.nivel])}>{a.titulo}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{a.desc}</p>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}

      {activeSection === 'interpretacion' && (
        <SectionCard title="Interpretación financiera">
          <div className="prose prose-sm max-w-none space-y-3 text-xs text-slate-600 leading-relaxed">
            {hasBalance && (
              <div>
                <p className="font-bold text-slate-800 mb-1">📋 Situación patrimonial</p>
                <p>El total activo de {fmt(totalActivo)} se financia en un {pct(autonomia)} con fondos propios y en un {pct(endeudamiento)} con deuda. {autonomia >= 40 ? 'La estructura financiera presenta un nivel adecuado de autonomía.' : autonomia >= 20 ? 'El nivel de autonomía es moderado. Se recomienda revisar la estructura de financiación.' : 'El nivel de endeudamiento es elevado. Requiere atención.'}</p>
                <p>El fondo de maniobra es {fmt(fondoManiobra)}{fondoManiobra >= 0 ? ', indicando una posición de liquidez positiva a corto plazo' : ', lo que puede indicar tensión de liquidez a corto plazo. Se recomienda revisar el ciclo de cobro y pago'}.</p>
              </div>
            )}
            {hasPyg && (
              <div>
                <p className="font-bold text-slate-800 mb-1">📈 Resultados</p>
                <p>Los ingresos ascienden a {fmt(ingresos)} y los gastos a {fmt(gastos)}, generando un resultado de {fmt(resultado)} ({pct(margen)} de margen neto). {margen > 0 ? 'La empresa genera beneficios en el período analizado.' : margen === 0 ? 'El resultado es nulo en el período.' : 'La empresa presenta pérdidas en el período analizado. Se recomienda revisar la estructura de costes.'}</p>
              </div>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="font-semibold text-amber-700 mb-1">⚠ Limitaciones de este análisis</p>
              <ul className="space-y-1">
                <li>• El análisis se basa en datos importados que pueden ser incompletos o contener errores de extracción.</li>
                {isPdf && <li>• Las cifras han sido extraídas de PDF mediante IA. Pueden existir discrepancias con los documentos originales.</li>}
                <li>• Los ratios son estimados y no contemplan información cualitativa, proyecciones ni circunstancias específicas del negocio.</li>
                <li>• Este informe no sustituye la revisión de un profesional contable o financiero.</li>
              </ul>
            </div>
          </div>
        </SectionCard>
      )}

      {activeSection === 'trazabilidad' && (
        <SectionCard title="Trazabilidad del origen de los datos">
          <p className="text-xs text-slate-400 italic mb-3">Registro del origen de cada dato para garantizar la transparencia del análisis.</p>
          <div className="space-y-2">
            {[
              { campo: 'Archivo(s) origen', valor: imp?.nombre_archivo || '—', origen: 'Subida del usuario' },
              { campo: 'Método extracción', valor: metodo, origen: 'Taxea IA v3.0' },
              { campo: 'Confianza media', valor: confianza ? `${confianza}%` : '—', origen: 'Calculada por bloque' },
              ...(isPdf && m.balance ? [
                { campo: 'Balance — páginas origen', valor: m.balance?.paginas?.join(', ') || '—', origen: 'PDF' },
                { campo: 'Balance — confianza', valor: `${m.balance?.confianzaGlobal || '—'}%`, origen: 'Extracción IA' },
              ] : []),
              ...(isPdf && m.pyg ? [
                { campo: 'PyG — páginas origen', valor: m.pyg?.paginas?.join(', ') || '—', origen: 'PDF' },
                { campo: 'PyG — confianza', valor: `${m.pyg?.confianzaGlobal || '—'}%`, origen: 'Extracción IA' },
              ] : []),
              { campo: 'Correcciones manuales', valor: m.correcciones ? `${Object.keys(m.correcciones).length}` : '0', origen: 'Usuario' },
              { campo: 'Generado por', valor: 'Taxea Business OS — Análisis Financiero v3.0', origen: 'Sistema' },
            ].map((row, i) => (
              <div key={i} className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-xs font-semibold text-slate-700">{row.campo}</p>
                  <p className="text-[10px] text-slate-400">{row.origen}</p>
                </div>
                <p className="text-xs text-slate-600 font-mono text-right max-w-48 truncate">{row.valor}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mt-3">
            <p className="text-xs font-semibold text-slate-700 mb-1">Supuestos aplicados</p>
            <ul className="space-y-1">
              {(imp?.supuestos_aplicados || []).map((s, i) => (
                <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />{s}</li>
              ))}
            </ul>
          </div>
        </SectionCard>
      )}
    </motion.div>
  );
}
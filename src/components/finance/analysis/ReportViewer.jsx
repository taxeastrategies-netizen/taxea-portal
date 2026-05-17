import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronLeft, FileText, Download, AlertTriangle, CheckCircle2, Info, Shield, BarChart2 } from 'lucide-react';

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const today = () => new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

const NIVEL_COLORS = {
  critico: 'border-l-4 border-red-400 bg-red-50 text-red-700',
  revisar: 'border-l-4 border-amber-400 bg-amber-50 text-amber-700',
  informativo: 'border-l-4 border-blue-300 bg-blue-50 text-blue-700',
};

export default function ReportViewer({ report, imp, onBack }) {
  const fin = report.contenido?.financials || {};

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-10">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-foreground flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Volver al dashboard
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all">
            <Download className="w-3.5 h-3.5" /> Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Portada */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 text-white">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-2">Taxea Business OS · Finanzas</p>
              <h1 className="text-3xl font-jakarta font-bold mb-1">{report.empresa_nombre || 'Análisis Financiero'}</h1>
              <p className="text-slate-300 text-sm">{report.periodo_inicio} – {report.periodo_fin}</p>
            </div>
            <div className="text-right">
              <BarChart2 className="w-10 h-10 text-slate-500 ml-auto mb-2" />
              <p className="text-xs text-slate-400">Generado: {today()}</p>
              <p className="text-xs text-slate-500">Origen: {imp?.origen?.toUpperCase()}</p>
            </div>
          </div>
          <div className="bg-white/8 rounded-2xl px-5 py-4 border border-white/10">
            <p className="text-xs text-slate-300 font-semibold mb-1 uppercase tracking-wide">⚠ Aviso de alcance</p>
            <p className="text-xs text-slate-400 leading-relaxed">{report.aviso_alcance}</p>
          </div>
        </div>

        {/* Calidad del dato */}
        <Section title="Calidad y alcance de los datos" badge="Metadatos de importación">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Archivo', value: imp?.nombre_archivo || '—' },
              { label: 'Registros', value: imp?.total_lineas || 0 },
              { label: 'Calidad dato', value: imp?.calidad_dato || '—' },
              { label: 'Advertencias', value: imp?.lineas_advertencia || 0 },
            ].map((k, i) => (
              <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <p className="text-sm font-bold text-foreground">{k.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>
          {imp?.supuestos_aplicados?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Supuestos aplicados:</p>
              <ul className="space-y-1">
                {imp.supuestos_aplicados.map((s, i) => (
                  <li key={i} className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full flex-shrink-0" />{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Resumen ejecutivo */}
        <Section title="Resumen ejecutivo" badge="Resultado preliminar · Pendiente revisión">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {report.resumen_ejecutivo || 'Resultado preliminar basado en los datos importados. Pendiente de revisión contable.'}
            </p>
          </div>
          {report.conclusiones?.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-slate-700">Puntos identificados:</p>
              {report.conclusiones.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-xs flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</span>
                  {c}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* PyG */}
        <Section title="Cuenta de Pérdidas y Ganancias" badge="Clasificación estimada">
          <div className="space-y-1">
            {[
              { label: 'Ingresos totales', value: fin.ingresos, bold: true },
              { label: 'Gastos totales', value: -fin.gastos, bold: true },
              { label: 'Resultado de explotación (est.)', value: fin.resultado, bold: true, border: true },
              { label: 'Margen neto estimado', value: `${fin.margen?.toFixed(1)}%`, bold: true, isText: true },
            ].map((r, i) => (
              <div key={i} className={cn("flex items-center justify-between py-2.5 px-1", r.border && 'border-t border-slate-200 mt-2')}>
                <span className={cn("text-sm", r.bold ? 'font-bold text-foreground' : 'text-slate-600')}>{r.label}</span>
                {r.isText ? (
                  <span className="text-sm font-bold text-blue-600">{r.value}</span>
                ) : (
                  <span className={cn("text-sm font-bold", r.value >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {fmt(Math.abs(r.value))}
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 italic mt-3 pt-3 border-t border-slate-100">
            Clasificación estimada por rango de cuentas PGC. Pendiente de validación profesional.
          </p>
        </Section>

        {/* Balance */}
        <Section title="Balance" badge="Estimado · Dato no disponible con precisión suficiente">
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">Balance estimado a partir de movimientos. Si el archivo no incluye saldos de apertura/cierre, este apartado puede ser incompleto.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Activo corriente', fin.balance?.activo_corriente],
              ['Activo no corriente', fin.balance?.activo_no_corriente],
              ['Pasivo corriente', fin.balance?.pasivo_corriente],
              ['Patrimonio neto (est.)', fin.balance?.patrimonio],
            ].map(([l, v], i) => (
              <div key={i} className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">{l}</span>
                <span className="text-sm font-bold text-foreground">{fmt(v)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-emerald-800">Fondo de maniobra estimado</p>
            <p className="text-base font-jakarta font-bold text-emerald-600">{fmt((fin.balance?.activo_corriente || 0) - (fin.balance?.pasivo_corriente || 0))}</p>
          </div>
        </Section>

        {/* Ratios */}
        <Section title="Ratios financieros" badge="Calculados sobre datos importados">
          <div className="space-y-3">
            {(fin.ratios || []).map((r, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-bold text-foreground">{r.nombre}</p>
                  <p className="text-xs text-slate-500">{r.interpretacion}</p>
                </div>
                <p className={cn("text-lg font-jakarta font-bold ml-4 flex-shrink-0", r.color)}>{r.valor}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Alertas */}
        <Section title="Alertas y puntos de revisión" badge="Accionable">
          <div className="space-y-3">
            {(fin.alertas || report.alertas || []).map((a, i) => (
              <div key={i} className={cn("rounded-xl p-4 text-sm", NIVEL_COLORS[a.nivel] || 'bg-slate-50')}>
                <p className="font-bold mb-0.5">{a.titulo}</p>
                <p className="text-xs">{a.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Recomendaciones */}
        <Section title="Recomendaciones operativas">
          <div className="space-y-3">
            {[
              'Revisar la clasificación de cuentas detectadas sin asignar antes de cerrar el período.',
              'Actualizar el análisis con los saldos bancarios reales para validar la posición de caja estimada.',
              'Diversificar la base de clientes para reducir el riesgo de concentración detectado.',
              'Validar los movimientos con el libro diario oficial antes de utilizar estos datos para declaraciones o reporting externo.',
              'Consultar con el asesor contable los supuestos de clasificación aplicados.',
            ].map((r, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-center text-emerald-700 font-bold flex-shrink-0">{i + 1}</span>
                <p className="text-sm text-slate-600 leading-relaxed">{r}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer aviso */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-center">
          <Shield className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500 leading-relaxed max-w-xl mx-auto">
            Este informe es de carácter <strong>preliminar y analítico</strong>. No constituye auditoría, certificación contable, validación fiscal definitiva ni sustituto del criterio profesional. Los resultados dependen de la calidad y completitud del archivo importado. Taxea no asume responsabilidad sobre decisiones tomadas exclusivamente en base a este análisis.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function Section({ title, badge, children }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {badge && <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}
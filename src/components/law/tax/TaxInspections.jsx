import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileSearch, AlertTriangle, Clock, CheckCircle2, Plus, Calendar, FileText } from 'lucide-react';

const INSPECCIONES = [
  {
    titulo: 'Inspección IS 2021-2022 — DCGC', organo: 'AEAT DCGC', impuesto: 'IS', ejercicios: '2021-2022',
    estado: 'activo', fase: 'Acta disconformidad', inicio: '2025-09-15', cuantia_riesgo: '€142.000',
    proxima_actuacion: '20/05/2026', descripcion: 'Procedimiento inspector iniciado por discrepancias en operaciones vinculadas y gastos no deducibles.',
    documentos_aportados: 8, documentos_pendientes: 3,
  },
  {
    titulo: 'Comprobación IRPF 2023 — Administración', organo: 'AEAT Canarias', impuesto: 'IRPF', ejercicios: '2023',
    estado: 'resuelto', fase: 'Liquidación firme', inicio: '2025-03-01', cuantia_riesgo: '€0',
    proxima_actuacion: '—', descripcion: 'Comprobación de rendimientos de capital inmobiliario. Resuelta sin regularización.',
    documentos_aportados: 5, documentos_pendientes: 0,
  },
];

const REQUERIMIENTOS = [
  { num: 'REQ-2026-04-0012', impuesto: 'IVA', plazo: '30/05/2026', estado: 'pendiente', descripcion: 'Aportación facturas emitidas T1/2025' },
  { num: 'REQ-2026-03-0087', impuesto: 'IS', plazo: '15/05/2026', estado: 'contestado', descripcion: 'Documentación precios transferencia' },
];

export default function TaxInspections() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Inspecciones AEAT</h2>
            <p className="text-sm text-slate-400">Control total · Cronología · Documentación · Estrategia defensa</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Nueva inspección
        </button>
      </div>

      {/* Inspecciones */}
      <div className="space-y-4">
        {INSPECCIONES.map((insp, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className={cn("bg-white border rounded-2xl shadow-sm overflow-hidden", insp.estado === 'activo' ? 'border-amber-200' : 'border-slate-100')}>
            {insp.estado === 'activo' && <div className="h-1 bg-gradient-to-r from-amber-400 to-red-400" />}
            <div className="p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-base font-bold text-foreground">{insp.titulo}</p>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", insp.estado === 'activo' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200')}>
                      {insp.estado === 'activo' ? 'ACTIVA' : 'RESUELTA'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{insp.descripcion}</p>
                </div>
                {insp.estado === 'activo' && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">Riesgo estimado</p>
                    <p className="text-xl font-jakarta font-bold text-red-600">{insp.cuantia_riesgo}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Órgano', value: insp.organo },
                  { label: 'Impuesto / Ejercicios', value: `${insp.impuesto} · ${insp.ejercicios}` },
                  { label: 'Fase actual', value: insp.fase },
                  { label: 'Próx. actuación', value: insp.proxima_actuacion },
                ].map(f => (
                  <div key={f.label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                    <p className="text-xs font-bold text-foreground">{f.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />{insp.documentos_aportados} docs aportados
                  </span>
                  {insp.documentos_pendientes > 0 && (
                    <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />{insp.documentos_pendientes} docs pendientes
                    </span>
                  )}
                </div>
                {insp.estado === 'activo' && (
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100 hover:bg-orange-100 transition-colors">
                      Añadir doc
                    </button>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition-colors flex items-center gap-1">
                      <FileText className="w-3 h-3" /> IA — Generar estrategia defensa
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Requerimientos */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Requerimientos AEAT</p>
          <button className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700">
            <Plus className="w-3 h-3" /> Añadir
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {REQUERIMIENTOS.map((r, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", r.estado === 'pendiente' ? 'bg-red-400' : 'bg-emerald-400')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{r.num}</p>
                <p className="text-xs text-slate-400">{r.descripcion}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-slate-400 font-medium">{r.impuesto}</span>
                <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{r.plazo}</span>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  r.estado === 'pendiente' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200')}>
                  {r.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}